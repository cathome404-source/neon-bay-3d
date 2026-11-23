// Driving and traffic for Neon Bay 3D: a drivable vehicle wrapper with
// acceleration, steering and damage, plus a self-driving traffic stream
// that keeps cars flowing around the player at all times.
// Exports: createVehicle, createRoadDriver, createTraffic.

import { TUNING } from './config.js';
import { makeCar } from './models.js';
import { range, int, pick, chance } from './random.js';

const HALF_CITY = 300;
const GRID = [-300, -240, -180, -120, -60, 0, 60, 120, 180, 240, 300];
const CAR_RADIUS = 2.2;

function clamp(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

// Smallest signed turn from angle a to angle b, in (-PI, PI].
function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// Push a circle (x, z, radius) out of every building box it overlaps.
// Returns the impact speed that was lost, or 0 when nothing was hit.
function collideBuildings(pos, radius, world) {
  let lost = 0;
  const list = world.buildings;
  for (let i = 0; i < list.length; i += 1) {
    const b = list[i];
    const hx = b.w / 2 + radius;
    const hz = b.d / 2 + radius;
    const dx = pos.x - b.x;
    const dz = pos.z - b.z;
    if (Math.abs(dx) >= hx || Math.abs(dz) >= hz) continue;
    const pushX = hx - Math.abs(dx);
    const pushZ = hz - Math.abs(dz);
    if (pushX < pushZ) {
      pos.x = b.x + (dx >= 0 ? hx : -hx);
    } else {
      pos.z = b.z + (dz >= 0 ? hz : -hz);
    }
    lost = 1;
  }
  return lost;
}

function nearestGridLine(v) {
  let best = GRID[0];
  let bestD = Math.abs(v - GRID[0]);
  for (let i = 1; i < GRID.length; i += 1) {
    const d = Math.abs(v - GRID[i]);
    if (d < bestD) {
      bestD = d;
      best = GRID[i];
    }
  }
  return { line: best, dist: bestD };
}

export function createVehicle(mesh, opts) {
  const options = opts || {};
  const car = TUNING.car;
  const topSpeed = options.maxSpeed || car.maxSpeed;
  const vehicle = {
    mesh,
    heading: options.heading || 0,
    speed: 0,
    hp: options.hp !== undefined ? options.hp : car.maxHp,
    wrecked: false,
    wheelSpin: 0,
    steerAngle: 0,
  };

  // Brake lights share a cached material across cars, so give this car its
  // own copies to flash them independently.
  const brakeMats = [];
  const lights = mesh.userData.brakeLights || [];
  for (const lamp of lights) {
    lamp.material = lamp.material.clone();
    brakeMats.push(lamp.material);
  }

  vehicle.damage = function damage(amount) {
    if (vehicle.wrecked) return;
    vehicle.hp -= amount;
    if (vehicle.hp <= 0) {
      vehicle.hp = 0;
      vehicle.wrecked = true;
      vehicle.speed = 0;
    }
  };

  vehicle.isWrecked = function isWrecked() {
    return vehicle.wrecked;
  };

  vehicle.setBraking = function setBraking(on) {
    for (const m of brakeMats) m.emissiveIntensity = on ? 2.6 : 0.4;
  };

  vehicle.update = function update(dt, controls, world) {
    if (vehicle.wrecked) {
      vehicle.speed *= Math.max(0, 1 - 3 * dt);
      return;
    }
    const ctl = controls || {};
    const throttle = clamp(ctl.throttle || 0, -1, 1);
    const steer = clamp(ctl.steer || 0, -1, 1);
    const braking = !!ctl.brake;

    // Longitudinal: gas accelerates, brake stops hard, reverse is capped.
    if (throttle > 0) {
      vehicle.speed += car.accel * throttle * dt;
    } else if (throttle < 0) {
      if (vehicle.speed > 0.5) {
        vehicle.speed -= car.brakeForce * 0.6 * dt;
      } else {
        vehicle.speed += car.accel * 0.7 * throttle * dt;
      }
    } else {
      vehicle.speed -= vehicle.speed * 0.9 * dt;
    }
    if (braking) {
      const decel = car.brakeForce * dt;
      if (vehicle.speed > 0) vehicle.speed = Math.max(0, vehicle.speed - decel);
      else vehicle.speed = Math.min(0, vehicle.speed + decel);
    }
    if (vehicle.speed > topSpeed) vehicle.speed = topSpeed;
    if (vehicle.speed < -car.reverseSpeed) vehicle.speed = -car.reverseSpeed;
    if (Math.abs(vehicle.speed) < 0.02 && throttle === 0) vehicle.speed = 0;

    // Steering bites harder the faster the car goes, and fades at a stop.
    // Pressing D (positive steer) turns the car toward screen-right, which
    // is a decreasing heading when the chase camera sits behind the car.
    const steerAuthority = clamp(Math.abs(vehicle.speed) / 10, 0, 1);
    const dirSign = vehicle.speed >= 0 ? 1 : -1;
    vehicle.heading -= steer * car.steerSpeed * steerAuthority * dirSign * dt;
    vehicle.steerAngle = steer * 0.42 * steerAuthority;

    // Integrate and keep the car inside the city.
    const fx = Math.sin(vehicle.heading);
    const fz = Math.cos(vehicle.heading);
    const p = mesh.position;
    p.x += fx * vehicle.speed * dt;
    p.z += fz * vehicle.speed * dt;
    p.x = clamp(p.x, -HALF_CITY, HALF_CITY);
    p.z = clamp(p.z, -HALF_CITY, HALF_CITY);

    // Building collision: shove out, scrub speed, dent the car on hard hits.
    if (world && collideBuildings(p, CAR_RADIUS, world)) {
      const hit = Math.abs(vehicle.speed);
      vehicle.speed *= 0.35;
      if (hit > 14) vehicle.damage((hit - 14) * 0.6);
    }

    // Pose: face along the heading, lean into the turn, spin the wheels.
    mesh.rotation.y = vehicle.heading;
    mesh.rotation.z = -steer * car.bodyRoll * steerAuthority * (vehicle.speed >= 0 ? 1 : -1);
    vehicle.wheelSpin += (vehicle.speed * dt) / 0.36;
    const wheels = mesh.userData.wheels || [];
    for (let i = 0; i < wheels.length; i += 1) {
      const front = i < 2;
      wheels[i].rotation.set(vehicle.wheelSpin, front ? vehicle.steerAngle : 0, Math.PI / 2);
    }
    vehicle.setBraking(braking || throttle < 0);
  };

  return vehicle;
}

// A helper that drives a vehicle along the road grid on its own: straight
// down a grid line, and at each crossing it may turn left, right, or carry on.
export function createRoadDriver(vehicle, world, rng) {
  const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  let dir = dirs[int(rng, 0, 3)];
  let sinceTurn = 99;
  vehicle.heading = dir;

  function snapToLine() {
    const p = vehicle.mesh.position;
    if (Math.abs(Math.sin(dir)) < 0.5) {
      p.x = nearestGridLine(p.x).line;
    } else {
      p.z = nearestGridLine(p.z).line;
    }
  }
  snapToLine();

  return {
    dir() {
      return dir;
    },
    update(dt, targetSpeed) {
      const p = vehicle.mesh.position;
      sinceTurn += dt;
      // At a crossing, decide whether to turn; never reverse.
      const across = Math.abs(Math.sin(dir)) < 0.5
        ? nearestGridLine(p.z)
        : nearestGridLine(p.x);
      if (across.dist < 2.5 && sinceTurn > 1.2) {
        const roll = rng();
        if (roll < 0.18) dir += Math.PI / 2;
        else if (roll < 0.36) dir -= Math.PI / 2;
        dir = Math.atan2(Math.sin(dir), Math.cos(dir));
        sinceTurn = 0;
        snapToLine();
      }
      // Ease the heading toward the chosen grid direction.
      const want = dir;
      const diff = angleDiff(vehicle.heading, want);
      const turn = clamp(diff, -2.2 * dt, 2.2 * dt);
      vehicle.heading += turn;
      // Simple speed control toward the target.
      const wantSpeed = targetSpeed === undefined ? 12 : targetSpeed;
      const throttle = vehicle.speed < wantSpeed ? 0.7 : 0;
      vehicle.update(dt, { throttle, steer: 0, brake: vehicle.speed > wantSpeed + 4 }, world);
    },
  };
}

const TRAFFIC_COLORS = [0xc23b5e, 0x2e7dc2, 0x3fae5a, 0xd9a03e, 0x8a8f96, 0x7a6ab8, 0xe8e8ec, 0x223044];

export function createTraffic(world, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const spot = world.randomRoadPoint(rng);
    const mesh = makeCar(pick(rng, TRAFFIC_COLORS), { spoiler: chance(rng, 0.25) });
    mesh.position.set(spot.x, 0, spot.z);
    world.group.add(mesh);
    const vehicle = createVehicle(mesh, { maxSpeed: range(rng, 10, 15) });
    const driver = createRoadDriver(vehicle, world, rng);
    cars.push({ vehicle, driver, cruise: range(rng, 9, 14) });
  }

  return {
    cars,
    update(dt, playerPos) {
      for (const entry of cars) {
        const v = entry.vehicle;
        const p = v.mesh.position;
        // Keep traffic around the player: respawn far cars on a nearby road.
        if (playerPos) {
          const dx = p.x - playerPos.x;
          const dz = p.z - playerPos.z;
          if (dx * dx + dz * dz > 260 * 260) {
            let spot = null;
            for (let tries = 0; tries < 8; tries += 1) {
              const cand = world.randomRoadPoint(rng);
              const cx = cand.x - playerPos.x;
              const cz = cand.z - playerPos.z;
              if (cx * cx + cz * cz < 180 * 180) {
                spot = cand;
                break;
              }
              spot = cand;
            }
            p.set(spot.x, 0, spot.z);
            v.speed = 0;
          }
        }
        // Slow down when the player is right ahead of this car.
        let target = entry.cruise;
        if (playerPos) {
          const dx = playerPos.x - p.x;
          const dz = playerPos.z - p.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const fx = Math.sin(v.heading);
          const fz = Math.cos(v.heading);
          const ahead = dist > 0.01 ? (dx * fx + dz * fz) / dist : 0;
          if (dist < 14 && ahead > 0.6) target = 0;
        }
        entry.driver.update(dt, target);
      }
    },
  };
}
