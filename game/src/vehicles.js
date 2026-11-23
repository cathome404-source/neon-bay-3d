// Neon Bay 3D — cars: arcade physics, traffic AI, parked cars, burning wrecks,
// explosions, stunt-ramp jumps. Player driving is driven from main.js input.
import { WORLD, TUNING, COLORS } from './config.js';
import { makeCar } from './models.js';
import { clamp, angleDiff, dist2, pick } from './random.js';
import { collideCircle } from './world.js';

const T = window.THREE;

export class Car {
  constructor(scene, kind, color, x, z, heading) {
    this.kind = kind;
    this.color = color;
    this.model = makeCar(kind, color);
    this.group = this.model.group;
    scene.add(this.group);
    this.x = x; this.z = z; this.heading = heading || 0;
    this.speed = 0;
    this.hp = TUNING.carHp;
    this.maxHp = TUNING.carHp;
    this.isPlayer = false;
    this.isPolice = kind === 'police';
    this.isSwat = kind === 'swat';
    this.isTraffic = false;
    this.isParked = false;
    this.burning = false;
    this.burnTimer = 0;
    this.wreck = false;
    this.airTime = 0;      // >0 while airborne off a ramp
    this.y = 0;
    this.steer = 0;
    this.ramCooldown = 0;
    this.bumpCooldown = 0;
    this.headlight = null; // SpotLight, added for the player's car
    this.updateMesh();
  }
  updateMesh() {
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = -this.heading;
    // Wheel spin + front-wheel steer.
    const spin = this.speed * 0.12;
    this.model.wheels.forEach((w, i) => {
      w.rotation.y = i < 2 ? this.steer * 0.4 : 0;
      w.rotation.z += 0; // spin handled by rotating around local x after y-rotation is awkward; skip
    });
    void spin;
    // Police light bar flash.
    if (this.model.lightBar) {
      const phase = (performance.now() / 180) % 2 < 1;
      this.model.lightBar.userData.red.material.emissiveIntensity = phase ? 3 : 0.2;
      this.model.lightBar.userData.blue.material.emissiveIntensity = phase ? 0.2 : 3;
    }
  }
  damage(amount, fx) {
    if (this.wreck || this.burning) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.burning = true;
      this.burnTimer = 0;
      if (fx) fx('ignite', this);
    }
  }
}

// Arcade car step. input: {throttle -1..1, steer -1..1, handbrake bool}.
export function stepCarPhysics(car, input, dt, colliders, ramps, fx) {
  if (car.wreck) return;
  const maxSpeed = car.maxSpeed || TUNING.carMaxSpeed;
  const accel = car.accel || TUNING.carAccel;
  if (input.throttle > 0) car.speed += accel * input.throttle * dt;
  else if (input.throttle < 0) {
    if (car.speed > 0.5) car.speed -= TUNING.carBrake * dt;
    else car.speed -= accel * 0.6 * dt; // reverse
  } else {
    car.speed -= Math.sign(car.speed) * 8 * dt;
    if (Math.abs(car.speed) < 0.4) car.speed = 0;
  }
  car.speed = clamp(car.speed, -TUNING.carReverseMax, maxSpeed);
  // Steering: less effective at very low speed, sharper when slow.
  const spd = Math.abs(car.speed);
  const steerTarget = input.steer * TUNING.carTurn * clamp(spd / 8, 0, 1) * (input.handbrake ? 1.6 : 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * dt * Math.sign(car.speed || 1) * (input.handbrake ? 0.8 : 1);
  if (input.handbrake) car.speed *= (1 - 1.4 * dt);
  const nx = car.x + Math.cos(car.heading) * car.speed * dt;
  const nz = car.z + Math.sin(car.heading) * car.speed * dt;
  const before = { x: car.x, z: car.z };
  const fixed = collideCircle(colliders, nx, nz, 2.1);
  const hitWall = (fixed.x !== nx || fixed.z !== nz);
  if (hitWall && spd > 10) {
    car.damage(spd * 0.15, fx);
    car.speed *= 0.45;
    if (fx) fx('crash', car);
  }
  car.x = fixed.x; car.z = fixed.z;
  // World bounds (city + beach + docks + causeway).
  car.x = clamp(car.x, -340, 340);
  car.z = clamp(car.z, -340, 340);
  // Stunt ramps: launch if crossing fast.
  if (car.airTime <= 0) {
    for (const r of ramps) {
      if (dist2(car.x, car.z, r.x, r.z) < 5 && spd > 18) {
        const a = angleDiff(car.heading, r.heading);
        if (Math.abs(a) < 0.8) { car.airTime = 0.75; if (fx) fx('jump', car); }
      }
    }
  }
  if (car.airTime > 0) {
    car.airTime -= dt;
    const t = 1 - Math.max(0, car.airTime) / 0.75;
    car.y = Math.sin(t * Math.PI) * 4.5;
    if (car.airTime <= 0) { car.y = 0; if (fx) fx('land', car); }
  }
  if (car.ramCooldown > 0) car.ramCooldown -= dt;
  if (car.bumpCooldown > 0) car.bumpCooldown -= dt;
  car.updateMesh();
  void before;
}

// Simple car-car collision: push apart, damage on hard hits.
export function collideCars(a, b, fx) {
  const d = dist2(a.x, a.z, b.x, b.z);
  const min = 4.2;
  if (d >= min || d === 0) return;
  const push = (min - d) / 2;
  const nx = (a.x - b.x) / d, nz = (a.z - b.z) / d;
  a.x += nx * push; a.z += nz * push;
  b.x -= nx * push; b.z -= nz * push;
  const rel = Math.abs(a.speed - b.speed);
  if (rel > 8 && a.bumpCooldown <= 0 && b.bumpCooldown <= 0) {
    a.damage(rel * 0.2, fx); b.damage(rel * 0.2, fx);
    a.bumpCooldown = 0.6; b.bumpCooldown = 0.6;
    const avg = (a.speed + b.speed) / 2;
    a.speed = avg * 0.7; b.speed = avg * 0.7;
    if (fx) fx('crash', a);
  }
}

// ---- Traffic: cars that follow the road grid, turn at intersections. ----
export class Traffic {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.cars = [];
  }
  spawnInitial(count, avoid) {
    for (let i = 0; i < count; i += 1) this.spawnOne(avoid);
  }
  spawnOne(avoid) {
    const rng = this.rng;
    const axis = rng() < 0.5 ? 'x' : 'z';
    const road = pick(rng, WORLD.roads);
    const along = (rng() * 2 - 1) * 260;
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = 3; // right-hand side
    let x, z, heading;
    if (axis === 'x') { x = along; z = road + lane * dir; heading = dir > 0 ? 0 : Math.PI; }
    else { x = road - lane * dir; z = along; heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    if (avoid && dist2(x, z, avoid.x, avoid.z) < 60) return;
    const kind = pick(rng, ['sedan', 'sedan', 'sedan', 'taxi', 'sports', 'truck']);
    const color = kind === 'taxi' ? COLORS.taxi : pick(rng, COLORS.carColors);
    const car = new Car(this.scene, kind, color, x, z, heading);
    car.isTraffic = true;
    car.speed = TUNING.trafficSpeed * (0.8 + rng() * 0.4);
    car.traffic = { axis, dir, lane };
    this.cars.push(car);
  }
  update(dt, playerCar, fx) {
    const rng = this.rng;
    for (const car of this.cars) {
      if (car.wreck || car.burning) continue;
      const t = car.traffic;
      // At an intersection, sometimes turn.
      const nearRoad = WORLD.roads.find((r) => Math.abs((t.axis === 'x' ? car.z : car.x) - r) < 8);
      const alongCoord = t.axis === 'x' ? car.x : car.z;
      const atCross = WORLD.roads.some((r) => Math.abs(alongCoord - r) < 4);
      if (atCross && nearRoad !== undefined && rng() < dt * 0.5) {
        // Turn onto the crossing road.
        const newAxis = t.axis === 'x' ? 'z' : 'x';
        const newDir = rng() < 0.5 ? 1 : -1;
        const roadHere = t.axis === 'x' ? car.z : car.x;
        const snapped = WORLD.roads.reduce((a, b) => Math.abs(b - roadHere) < Math.abs(a - roadHere) ? b : a);
        if (newAxis === 'x') { car.z = snapped + 3 * newDir; car.heading = newDir > 0 ? 0 : Math.PI; }
        else { car.x = snapped + 3 * newDir; car.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2; }
        car.traffic = { axis: newAxis, dir: newDir, lane: 3 };
        continue;
      }
      // Slow down if a car is close ahead.
      let ahead = false;
      for (const other of this.cars) {
        if (other === car || other.wreck) continue;
        const dx = other.x - car.x, dz = other.z - car.z;
        const fwd = Math.cos(car.heading) * dx + Math.sin(car.heading) * dz;
        const side = Math.abs(-Math.sin(car.heading) * dx + Math.cos(car.heading) * dz);
        if (fwd > 0 && fwd < 14 && side < 3) { ahead = true; break; }
      }
      if (playerCar && !playerCar.wreck) {
        const dx = playerCar.x - car.x, dz = playerCar.z - car.z;
        const fwd = Math.cos(car.heading) * dx + Math.sin(car.heading) * dz;
        const side = Math.abs(-Math.sin(car.heading) * dx + Math.cos(car.heading) * dz);
        if (fwd > 0 && fwd < 14 && side < 3) ahead = true;
      }
      const target = ahead ? 0 : TUNING.trafficSpeed;
      car.speed += (target - car.speed) * Math.min(1, dt * 2);
      const nx = car.x + Math.cos(car.heading) * car.speed * dt;
      const nz = car.z + Math.sin(car.heading) * car.speed * dt;
      const fixed = collideCircle(this.colliders, nx, nz, 2.1);
      car.x = fixed.x; car.z = fixed.z;
      car.updateMesh();
    }
    // Keep the count topped up.
    if (this.cars.filter((c) => !c.wreck).length < TUNING.trafficCount) {
      this.spawnOne(playerCar ? { x: playerCar.x, z: playerCar.z } : null);
    }
  }
  remove(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    this.scene.remove(car.group);
  }
}

// Parked cars along roads, stealable. Returns the list.
export function spawnParked(scene, rng, colliders, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const road = pick(rng, WORLD.roads);
    const along = (rng() * 2 - 1) * 250;
    const side = rng() < 0.5 ? 1 : -1;
    let x, z, heading;
    if (axis === 'x') { x = along; z = road + side * 5; heading = side > 0 ? Math.PI : 0; }
    else { x = road + side * 5; z = along; heading = side > 0 ? -Math.PI / 2 : Math.PI / 2; }
    if (collideCircle(colliders, x, z, 2.5).x !== x) continue;
    const kind = pick(rng, ['sedan', 'sedan', 'sports', 'taxi', 'truck']);
    const color = kind === 'taxi' ? COLORS.taxi : pick(rng, COLORS.carColors);
    const car = new Car(scene, kind, color, x, z, heading);
    car.isParked = true;
    cars.push(car);
  }
  return cars;
}
