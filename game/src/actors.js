// The living city for Neon Bay 3D: the player on foot and behind the wheel,
// police cars that patrol, chase and ram, a search helicopter, wandering
// pedestrians, and the wanted system that ties them together.
// Exports: createActors.

import { TUNING } from './config.js';
import { makeCar, makePlayer, makePoliceCar, makeHelicopter, makePedestrian } from './models.js';
import { createVehicle, createRoadDriver } from './vehicles.js';
import { range, pick } from './random.js';

const HALF_CITY = 300;
const PED_COLORS = [0x7a6ab8, 0xd9a03e, 0x3fae5a, 0xc23b5e, 0x2e7dc2, 0xe8b98a, 0x8a8f96];
const PARKED_COLORS = [0xd9a03e, 0x2e7dc2, 0xc23b5e];

function clamp(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function createActors(world, input, rng, audio, traffic) {
  const group = world.group;
  let camera = null;
  let time = 0;

  function sfx(name) {
    if (audio && typeof audio.play === 'function') {
      try {
        audio.play(name);
      } catch (err) {
        /* audio is best-effort */
      }
    }
  }

  // ---------- player ----------
  const playerMesh = makePlayer();
  playerMesh.position.set(0, 0, 0);
  group.add(playerMesh);
  const ammo = {};
  for (const key of Object.keys(TUNING.weapons)) ammo[key] = TUNING.weapons[key].ammo;
  const player = {
    mesh: playerMesh,
    pos: playerMesh.position,
    heading: 0,
    hp: TUNING.player.maxHp,
    money: TUNING.player.money,
    respect: 0,
    onFoot: true,
    car: null,
    weapon: 'fists',
    ammo,
  };
  let punchTimer = 0;
  let fireTimer = 0;

  // A few parked cars near the spawn so the player can drive right away.
  const parkedCars = [];
  const parkedSpots = [
    { x: 2.5, z: 2, heading: 0.4 },
    { x: -7, z: 9, heading: -1.2 },
    { x: 9, z: -7, heading: 2.4 },
  ];
  for (let i = 0; i < parkedSpots.length; i += 1) {
    const spot = parkedSpots[i];
    const mesh = makeCar(PARKED_COLORS[i % PARKED_COLORS.length], {});
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = spot.heading;
    group.add(mesh);
    const vehicle = createVehicle(mesh, { heading: spot.heading });
    parkedCars.push(vehicle);
  }

  function enterableVehicles() {
    const list = parkedCars.slice();
    if (traffic) {
      for (const entry of traffic.cars) {
        if (!entry.vehicle.isWrecked()) list.push(entry.vehicle);
      }
    }
    return list;
  }

  function nearestVehicle(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const v of enterableVehicles()) {
      const d = dist2D(player.pos.x, player.pos.z, v.mesh.position.x, v.mesh.position.z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  // ---------- wanted ----------
  const wanted = { stars: 0, heat: 0 };
  let unseenTimer = 0;

  function addWanted(n) {
    wanted.heat = Math.min(125, wanted.heat + n * 25);
    wanted.stars = Math.min(5, Math.floor(wanted.heat / 25));
  }

  function setWanted(n) {
    wanted.stars = clamp(n, 0, 5);
    wanted.heat = wanted.stars * 25;
    unseenTimer = 0;
  }

  // ---------- pedestrians ----------
  const pedestrians = [];
  for (let i = 0; i < 14; i += 1) {
    const spot = world.randomRoadPoint(rng);
    const side = pick(rng, [-1, 1]);
    const mesh = makePedestrian(pick(rng, PED_COLORS));
    mesh.position.set(spot.x + side * range(rng, 8, 11), 0, spot.z + side * range(rng, -4, 4));
    group.add(mesh);
    pedestrians.push({
      mesh,
      heading: rng() * Math.PI * 2,
      speed: range(rng, 0.9, 1.5),
      dirTimer: range(rng, 1, 4),
      fleeTimer: 0,
      hp: 30,
      down: false,
      walkPhase: rng() * 6,
    });
  }

  function scarePedestrians(x, z, radius) {
    for (const ped of pedestrians) {
      if (ped.down) continue;
      const d = dist2D(x, z, ped.mesh.position.x, ped.mesh.position.z);
      if (d < radius) ped.fleeTimer = Math.max(ped.fleeTimer, 3);
    }
  }

  // ---------- police ----------
  const police = [];
  let spawnTimer = 0;
  let ramWantedTimer = 0;

  function spawnPolice() {
    let spot = null;
    for (let tries = 0; tries < 10; tries += 1) {
      const cand = world.randomRoadPoint(rng);
      const d = dist2D(cand.x, cand.z, player.pos.x, player.pos.z);
      if (d > 45 && d < 85) {
        spot = cand;
        break;
      }
      spot = cand;
    }
    const mesh = makePoliceCar();
    mesh.position.set(spot.x, 0, spot.z);
    group.add(mesh);
    // The light bar shares cached materials, so clone them per car to flash.
    const redMat = mesh.userData.lightBar.children[0].material.clone();
    const blueMat = mesh.userData.lightBar.children[1].material.clone();
    mesh.userData.lightBar.children[0].material = redMat;
    mesh.userData.lightBar.children[1].material = blueMat;
    const vehicle = createVehicle(mesh, { maxSpeed: TUNING.police.chaseSpeed });
    vehicle.heading = Math.atan2(player.pos.x - spot.x, player.pos.z - spot.z);
    const driver = createRoadDriver(vehicle, world, rng);
    police.push({
      vehicle, driver, state: 'patrol', ramTimer: 0, wreckTimer: 0,
      flashT: rng() * 2, redMat, blueMat,
    });
  }

  function removePolice(index) {
    const entry = police[index];
    group.remove(entry.vehicle.mesh);
    police.splice(index, 1);
  }

  // ---------- helicopter ----------
  const heliMesh = makeHelicopter();
  heliMesh.visible = false;
  heliMesh.position.set(0, 0, 0);
  group.add(heliMesh);
  const helicopter = { mesh: heliMesh, active: false, orbitAngle: 0 };

  // ---------- shooting ----------
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  function aimPoint() {
    if (!camera) return null;
    const m = input.mouse();
    const nx = (m.x / window.innerWidth) * 2 - 1;
    const ny = -(m.y / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera({ x: nx, y: ny }, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null;
    return hit;
  }

  function shootAt(target, aim, dirX, dirZ, weaponDef) {
    const dx = target.x - player.pos.x;
    const dz = target.z - player.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > weaponDef.range || dist < 0.01) return false;
    const dot = (dx * dirX + dz * dirZ) / dist;
    const aimDist = Math.sqrt(
      (target.x - aim.x) * (target.x - aim.x) + (target.z - aim.z) * (target.z - aim.z),
    );
    return dot > 0.93 || aimDist < 5;
  }

  function fireWeapon() {
    const key = player.weapon;
    const def = TUNING.weapons[key];
    if (fireTimer > 0) return;
    if (key !== 'fists' && ammo[key] <= 0) {
      player.weapon = 'fists';
      return;
    }
    const aim = aimPoint();
    if (!aim) return;
    fireTimer = 1 / def.fireRate;
    if (key !== 'fists') ammo[key] -= 1;
    sfx(key === 'fists' ? 'punch' : 'shot');
    scarePedestrians(player.pos.x, player.pos.z, 20);

    const baseDirX = aim.x - player.pos.x;
    const baseDirZ = aim.z - player.pos.z;
    const baseLen = Math.sqrt(baseDirX * baseDirX + baseDirZ * baseDirZ) || 1;
    const pellets = key === 'shotgun' ? def.pellets : 1;
    let hitPolice = false;
    let hitPed = false;
    for (let p = 0; p < pellets; p += 1) {
      const jitter = key === 'shotgun' ? (rng() - 0.5) * 0.14 : 0;
      const cos = Math.cos(jitter);
      const sin = Math.sin(jitter);
      const dirX = (baseDirX * cos - baseDirZ * sin) / baseLen;
      const dirZ = (baseDirX * sin + baseDirZ * cos) / baseLen;
      for (const entry of police) {
        if (entry.vehicle.isWrecked()) continue;
        const t = entry.vehicle.mesh.position;
        if (shootAt(t, aim, dirX, dirZ, def)) {
          entry.vehicle.damage(def.damage);
          hitPolice = true;
        }
      }
      for (const ped of pedestrians) {
        if (ped.down) continue;
        const t = ped.mesh.position;
        if (shootAt(t, aim, dirX, dirZ, def)) {
          ped.hp -= def.damage;
          ped.fleeTimer = 4;
          hitPed = true;
          if (ped.hp <= 0) {
            ped.down = true;
            ped.mesh.rotation.x = -Math.PI / 2;
          }
        }
      }
    }
    if (hitPolice || hitPed) addWanted(1);
  }

  function punch() {
    if (punchTimer > 0) return;
    punchTimer = TUNING.player.punchCooldown;
    sfx('punch');
    let best = null;
    let bestD = TUNING.player.punchRange;
    let bestKind = null;
    for (const entry of police) {
      if (entry.vehicle.isWrecked()) continue;
      const t = entry.vehicle.mesh.position;
      const d = dist2D(player.pos.x, player.pos.z, t.x, t.z);
      if (d < bestD) {
        bestD = d;
        best = entry.vehicle;
        bestKind = 'police';
      }
    }
    for (const ped of pedestrians) {
      if (ped.down) continue;
      const t = ped.mesh.position;
      const d = dist2D(player.pos.x, player.pos.z, t.x, t.z);
      if (d < bestD) {
        bestD = d;
        best = ped;
        bestKind = 'ped';
      }
    }
    if (!best) return;
    if (bestKind === 'police') best.damage(TUNING.player.punchDamage);
    else {
      best.hp -= TUNING.player.punchDamage;
      best.fleeTimer = 4;
      if (best.hp <= 0) {
        best.down = true;
        best.mesh.rotation.x = -Math.PI / 2;
      }
    }
  }

  // ---------- player update ----------
  function updatePlayer(dt) {
    punchTimer = Math.max(0, punchTimer - dt);
    fireTimer = Math.max(0, fireTimer - dt);
    const axes = input.moveAxes();
    const key = input.weapon();
    player.weapon = ammo[key] > 0 ? key : 'fists';

    if (input.takePressed('KeyE')) {
      if (player.onFoot) {
        const near = nearestVehicle(TUNING.player.enterCarRange);
        if (near) {
          player.car = near;
          player.onFoot = false;
          playerMesh.visible = false;
          sfx('enter');
        }
      } else if (player.car) {
        const car = player.car;
        const sideX = Math.cos(car.heading);
        const sideZ = -Math.sin(car.heading);
        player.pos.set(
          car.mesh.position.x + sideX * TUNING.car.enterOffset,
          0,
          car.mesh.position.z + sideZ * TUNING.car.enterOffset,
        );
        player.heading = car.heading;
        playerMesh.rotation.y = player.heading;
        playerMesh.visible = true;
        player.car = null;
        player.onFoot = true;
        sfx('exit');
      }
    }

    if (!player.onFoot && player.car) {
      const car = player.car;
      car.update(dt, {
        throttle: axes.forward,
        steer: axes.strafe,
        brake: input.brake(),
      }, world);
      if (car.isWrecked()) {
        player.pos.set(
          car.mesh.position.x + Math.cos(car.heading) * TUNING.car.enterOffset,
          0,
          car.mesh.position.z - Math.sin(car.heading) * TUNING.car.enterOffset,
        );
        playerMesh.visible = true;
        player.car = null;
        player.onFoot = true;
      }
      return;
    }

    // On foot: move relative to the camera when one is set, else world axes.
    let moveX = 0;
    let moveZ = 0;
    if (camera) {
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      moveX = fwd.x * axes.forward + right.x * axes.strafe;
      moveZ = fwd.z * axes.forward + right.z * axes.strafe;
    } else {
      moveX = axes.strafe;
      moveZ = -axes.forward;
    }
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0.01) {
      const speed = input.sprint() ? TUNING.player.runSpeed : TUNING.player.walkSpeed;
      player.pos.x += (moveX / len) * speed * dt;
      player.pos.z += (moveZ / len) * speed * dt;
      player.heading = Math.atan2(moveX, moveZ);
      playerMesh.rotation.y = player.heading;
    }
    player.pos.x = clamp(player.pos.x, -HALF_CITY, HALF_CITY);
    player.pos.z = clamp(player.pos.z, -HALF_CITY, HALF_CITY);

    if (input.takePressed('KeyF')) punch();
    if (input.takeClick()) fireWeapon();
  }

  // ---------- police update ----------
  function updatePolice(dt) {
    ramWantedTimer = Math.max(0, ramWantedTimer - dt);
    const desired = Math.min(wanted.stars, TUNING.police.maxChasers);
    spawnTimer -= dt;
    if (police.length < desired && spawnTimer <= 0) {
      spawnPolice();
      spawnTimer = 1.2;
    }

    for (let i = police.length - 1; i >= 0; i -= 1) {
      const entry = police[i];
      const v = entry.vehicle;
      const p = v.mesh.position;

      if (v.isWrecked()) {
        entry.wreckTimer += dt;
        v.update(dt, { throttle: 0, steer: 0, brake: true }, world);
        if (entry.wreckTimer > 6) removePolice(i);
        continue;
      }

      // Flash the light bar while on duty.
      entry.flashT += dt;
      const phase = Math.floor(entry.flashT * 6) % 2;
      entry.redMat.emissiveIntensity = phase === 0 ? 2.6 : 0.25;
      entry.blueMat.emissiveIntensity = phase === 0 ? 0.25 : 2.6;

      const dPlayer = dist2D(p.x, p.z, player.pos.x, player.pos.z);
      if (wanted.stars >= 2) {
        entry.state = 'chase';
        const wantHeading = Math.atan2(player.pos.x - p.x, player.pos.z - p.z);
        const steer = -clamp(angleDiff(v.heading, wantHeading) * 1.6, -1, 1);
        v.update(dt, { throttle: 1, steer, brake: false }, world);
      } else {
        entry.state = 'patrol';
        entry.driver.update(dt, TUNING.police.patrolSpeed);
      }

      // Ram the player's car up close; the player ramming a cruiser counts too.
      if (player.car && dPlayer < 5) {
        entry.ramTimer -= dt;
        if (entry.ramTimer <= 0) {
          player.car.damage(TUNING.police.ramDamage);
          entry.ramTimer = TUNING.police.ramCooldown;
          sfx('ram');
        }
      }
      if (player.car && dPlayer < 4.5 && Math.abs(player.car.speed) > 8 && ramWantedTimer <= 0) {
        v.damage(10);
        addWanted(1);
        ramWantedTimer = 2;
      }

      // Stand down once the heat is gone and the cruiser is far away.
      if (wanted.stars === 0 && dPlayer > 90) removePolice(i);
    }
  }

  // ---------- helicopter update ----------
  function updateHelicopter(dt) {
    const wantActive = wanted.stars >= 3;
    if (wantActive && !helicopter.active) {
      helicopter.active = true;
      heliMesh.visible = true;
      heliMesh.position.set(player.pos.x, 0, player.pos.z);
      sfx('heli');
    }
    if (!helicopter.active) return;
    if (!wantActive) {
      heliMesh.position.y -= TUNING.helicopter.riseSpeed * dt;
      if (heliMesh.position.y <= 1) {
        helicopter.active = false;
        heliMesh.visible = false;
      }
      return;
    }
    helicopter.orbitAngle += TUNING.helicopter.orbitSpeed * dt;
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    const ahead = TUNING.helicopter.aheadDistance;
    const targetX = player.pos.x + fx * ahead + Math.sin(helicopter.orbitAngle) * 8;
    const targetZ = player.pos.z + fz * ahead + Math.cos(helicopter.orbitAngle) * 8;
    heliMesh.position.x += (targetX - heliMesh.position.x) * Math.min(1, 2.5 * dt);
    heliMesh.position.z += (targetZ - heliMesh.position.z) * Math.min(1, 2.5 * dt);
    heliMesh.position.y += (TUNING.helicopter.hoverHeight - heliMesh.position.y)
      * Math.min(1, (TUNING.helicopter.riseSpeed / TUNING.helicopter.hoverHeight) * dt * 4);
    heliMesh.rotation.y = helicopter.orbitAngle;
    heliMesh.userData.rotor.rotation.y += dt * 22;
    // Keep the searchlight cone hanging below the helicopter, over the player.
    heliMesh.userData.searchlight.position.x += (player.pos.x - heliMesh.position.x) * 0.1;
    heliMesh.userData.searchlight.position.z += (player.pos.z - heliMesh.position.z) * 0.1 + 1.5;
  }

  // ---------- pedestrian update ----------
  function updatePedestrians(dt) {
    for (const ped of pedestrians) {
      if (ped.down) continue;
      const p = ped.mesh.position;
      ped.walkPhase += dt * 7;
      if (ped.fleeTimer > 0) {
        ped.fleeTimer -= dt;
        const away = Math.atan2(p.x - player.pos.x, p.z - player.pos.z);
        ped.heading = away;
        p.x += Math.sin(away) * 4 * dt;
        p.z += Math.cos(away) * 4 * dt;
      } else {
        ped.dirTimer -= dt;
        if (ped.dirTimer <= 0) {
          ped.heading = rng() * Math.PI * 2;
          ped.dirTimer = range(rng, 2, 5);
        }
        p.x += Math.sin(ped.heading) * ped.speed * dt;
        p.z += Math.cos(ped.heading) * ped.speed * dt;
      }
      // A fast car nearby sends the crowd running.
      if (player.car && Math.abs(player.car.speed) > 15) {
        const d = dist2D(p.x, p.z, player.car.mesh.position.x, player.car.mesh.position.z);
        if (d < 10) ped.fleeTimer = Math.max(ped.fleeTimer, 2);
      }
      p.x = clamp(p.x, -HALF_CITY, HALF_CITY);
      p.z = clamp(p.z, -HALF_CITY, HALF_CITY);
      ped.mesh.rotation.y = ped.heading;
      ped.mesh.userData.body.rotation.z = Math.sin(ped.walkPhase) * 0.07;
    }
  }

  function isUnseen() {
    if (helicopter.active) return false;
    for (const entry of police) {
      if (entry.vehicle.isWrecked()) continue;
      const p = entry.vehicle.mesh.position;
      if (dist2D(p.x, p.z, player.pos.x, player.pos.z) < 40) return false;
    }
    return true;
  }

  function update(dt) {
    time += dt;
    updatePlayer(dt);
    updatePolice(dt);
    updateHelicopter(dt);
    updatePedestrians(dt);
    if (isUnseen()) {
      unseenTimer += dt;
      if (unseenTimer >= TUNING.police.decaySeconds && wanted.stars > 0) {
        wanted.stars -= 1;
        wanted.heat = wanted.stars * 25;
        unseenTimer = 0;
      }
    } else {
      unseenTimer = 0;
    }
  }

  return {
    player,
    police,
    helicopter,
    pedestrians,
    parkedCars,
    wanted,
    update,
    addWanted,
    setWanted,
    isUnseen,
    setCamera(next) {
      camera = next;
    },
  };
}
