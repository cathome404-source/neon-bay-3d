// Neon Bay 3D — actors: the player (on foot + combat), pedestrians, the Bay PD
// (patrol pursuit, RAM/PIT interceptors, SWAT at 5 stars, NEON-1 helicopter,
// roadblocks, dispatch board), and the Tide crew rivals.
import { TUNING, WEAPONS, COLORS, WORLD } from './config.js';
import { makeCharacter, makeHeli } from './models.js';
import { Car, stepCarPhysics, collideCars } from './vehicles.js';
import { clamp, angleDiff, dist2, pick, range } from './random.js';
import { collideCircle, hasLineOfSight } from './world.js';

const T = window.THREE;

// ---------------------------------------------------------------- player ----
export class Player {
  constructor(scene, x, z, heading) {
    this.group = makeCharacter(0xe86a20, 0x2a3550, 0xd8a080);
    scene.add(this.group);
    this.x = x; this.z = z; this.heading = heading || 0;
    this.hp = TUNING.playerHp;
    this.money = 0;
    this.respect = 0;
    this.ammo = WEAPONS.map((w) => (w.ammo === Infinity ? Infinity : w.ammo));
    this.weapon = 1; // pistol default
    this.cooldown = 0;
    this.inCar = null;
    this.invulnerable = 0;
    this.walkPhase = 0;
    this.dead = false;
    this.updateMesh();
  }
  updateMesh() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = -this.heading + Math.PI / 2;
  }
  // On-foot movement, relative to camera yaw. Returns whether moving.
  stepOnFoot(dt, input, camYaw, colliders) {
    const { f, s } = input.axis();
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = run ? TUNING.runSpeed : TUNING.walkSpeed;
    const moving = f !== 0 || s !== 0;
    if (moving) {
      const mx = Math.cos(camYaw) * f - Math.sin(camYaw) * s;
      const mz = Math.sin(camYaw) * f + Math.cos(camYaw) * s;
      const len = Math.hypot(mx, mz) || 1;
      const nx = this.x + (mx / len) * speed * dt;
      const nz = this.z + (mz / len) * speed * dt;
      const fixed = collideCircle(colliders, nx, nz, 0.8);
      this.x = clamp(fixed.x, -340, 340);
      this.z = clamp(fixed.z, -340, 340);
      this.heading = Math.atan2(mz, mx);
      this.walkPhase += dt * speed * 1.6;
      const swing = Math.sin(this.walkPhase) * 0.5;
      const u = this.group.userData;
      u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing; u.armR.rotation.x = swing;
    } else {
      const u = this.group.userData;
      u.legL.rotation.x *= 0.8; u.legR.rotation.x *= 0.8;
      u.armL.rotation.x *= 0.8; u.armR.rotation.x *= 0.8;
    }
    if (this.invulnerable > 0) this.invulnerable -= dt;
    if (this.cooldown > 0) this.cooldown -= dt;
    this.updateMesh();
    return moving;
  }
  damage(amount) {
    if (this.invulnerable > 0 || this.dead) return;
    this.hp -= amount;
    this.invulnerable = 0.4;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }
  // Punch: hits the nearest damageable within range in front.
  punch(targets) {
    if (this.cooldown > 0) return false;
    this.cooldown = WEAPONS[0].rate;
    let best = null, bestD = WEAPONS[0].range;
    for (const t of targets) {
      if (t.dead || t.wreck) continue;
      const d = dist2(this.x, this.z, t.x, t.z);
      if (d < bestD) { best = t; bestD = d; }
    }
    if (best) {
      best.damage ? best.damage(WEAPONS[0].damage) : best.hp -= WEAPONS[0].damage;
      return true;
    }
    return false;
  }
}

// ------------------------------------------------------------ pedestrians ----
export class Pedestrians {
  constructor(scene, rng, colliders) {
    this.scene = scene; this.rng = rng; this.colliders = colliders;
    this.list = [];
    this.shirts = [0x4a7fb5, 0xc25a7a, 0x7ab55a, 0xd8b13c, 0x8a6fc2, 0xe8e8e8, 0x3a3a3a];
  }
  spawnInitial(count, avoid) {
    for (let i = 0; i < count; i += 1) this.spawnOne(avoid);
  }
  spawnOne(avoid) {
    const rng = this.rng;
    // On a sidewalk: near a road, offset to the side.
    const road = pick(rng, WORLD.roads);
    const along = (rng() * 2 - 1) * 260;
    const side = rng() < 0.5 ? 1 : -1;
    const onX = rng() < 0.5;
    const x = onX ? along : road + side * 9;
    const z = onX ? road + side * 9 : along;
    if (avoid && dist2(x, z, avoid.x, avoid.z) < 40) return;
    const g = makeCharacter(pick(rng, this.shirts), pick(rng, [0x2a3550, 0x4a3a2a, 0x5a5a5a]), pick(rng, [0xd8a080, 0x8a5a3a, 0xe8c0a0]));
    g.userData.cap.visible = rng() < 0.5;
    this.scene.add(g);
    this.list.push({
      group: g, x, z, heading: rng() * Math.PI * 2,
      speed: 1.2 + rng() * 1.2, fear: 0, walkPhase: rng() * 6,
      hp: 100, dead: false, isPed: true,
      damage(amount) { this.hp -= amount; if (this.hp <= 0) this.dead = true; },
    });
  }
  update(dt, player, playerCar, gunshotAt) {
    const rng = this.rng;
    for (const p of this.list) {
      if (p.dead) { p.group.visible = false; continue; }
      // Flee from the player/car or a gunshot.
      const threat = playerCar || player;
      const d = dist2(p.x, p.z, threat.x, threat.z);
      if (gunshotAt && dist2(p.x, p.z, gunshotAt.x, gunshotAt.z) < 30) p.fear = 1;
      if (d < 10) p.fear = 1;
      if (p.fear > 0) {
        p.fear = Math.max(0, p.fear - dt * 0.1);
        const away = Math.atan2(p.z - threat.z, p.x - threat.x);
        p.heading += angleDiff(p.heading, away) * Math.min(1, dt * 4);
        const sp = 5;
        const nx = p.x + Math.cos(p.heading) * sp * dt;
        const nz = p.z + Math.sin(p.heading) * sp * dt;
        const fixed = collideCircle(this.colliders, nx, nz, 0.7);
        p.x = fixed.x; p.z = fixed.z;
        p.walkPhase += dt * 10;
      } else {
        if (rng() < dt * 0.1) p.heading += (rng() - 0.5) * 1.5;
        const nx = p.x + Math.cos(p.heading) * p.speed * dt;
        const nz = p.z + Math.sin(p.heading) * p.speed * dt;
        const fixed = collideCircle(this.colliders, nx, nz, 0.7);
        // Turn around if blocked.
        if (fixed.x === p.x && fixed.z === p.z && (nx !== p.x || nz !== p.z)) p.heading += Math.PI / 2;
        p.x = clamp(fixed.x, -330, 330); p.z = clamp(fixed.z, -330, 330);
        p.walkPhase += dt * p.speed * 3;
      }
      const swing = Math.sin(p.walkPhase) * 0.45;
      const u = p.group.userData;
      u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing; u.armR.rotation.x = swing;
      p.group.position.set(p.x, 0, p.z);
      p.group.rotation.y = -p.heading + Math.PI / 2;
    }
    if (this.list.filter((p) => !p.dead).length < 14) this.spawnOne(player);
  }
}

// -------------------------------------------------------------- police -----
export class Police {
  constructor(scene, rng, colliders, fx) {
    this.scene = scene; this.rng = rng; this.colliders = colliders; this.fx = fx;
    this.wanted = 0;
    this.unseenTimer = 0;
    this.cars = [];        // pursuit cars (patrol + interceptors)
    this.swat = [];        // SWAT officers on foot
    this.heli = null;      // {group, x, z, y, rotor}
    this.roadblock = null; // {cars:[], timer}
    this.roadblockTimer = 0;
    this.dispatch = [];    // {text, t} messages for the HUD board
    this.lastSpawn = 0;
  }
  say(text) {
    this.dispatch.push({ text, t: 0 });
    if (this.dispatch.length > 4) this.dispatch.shift();
  }
  setWanted(n, reason) {
    const before = this.wanted;
    this.wanted = clamp(n, 0, 5);
    if (this.wanted > before) {
      this.say(`Dispatch: ${this.wanted}-star alert — ${reason || 'officer needs assistance'}`);
      if (this.wanted >= 3 && before < 3) this.say('Dispatch: NEON-1 air unit is overhead');
      if (this.wanted >= 4 && before < 4) this.say('Dispatch: roadblocks going up across Neon Bay');
      if (this.wanted >= 5 && before < 5) this.say('Dispatch: SWAT deployed — lethal force authorised');
    }
  }
  addWanted(n, reason) { this.setWanted(this.wanted + n, reason); }
  spawnPursuit(player, interceptor) {
    const rng = this.rng;
    // Spawn on a road near the player, out of immediate sight.
    const angle = rng() * Math.PI * 2;
    const dist = 90 + rng() * 60;
    let x = player.x + Math.cos(angle) * dist;
    let z = player.z + Math.sin(angle) * dist;
    x = clamp(x, -260, 260); z = clamp(z, -260, 260);
    return this.spawnAt(x, z, player, interceptor);
  }
  // Spawn a pursuit car at an exact spot, heading toward the player.
  // opts: {heading, speed, hold} — hold cars stay put (roadblock look).
  spawnAt(x, z, player, interceptor, opts) {
    const o = opts || {};
    const car = new Car(this.scene, 'police', COLORS.police, x, z,
      o.heading !== undefined ? o.heading : Math.atan2(player.z - z, player.x - x));
    car.isPolice = true;
    car.isInterceptor = !!interceptor;
    car.maxSpeed = interceptor ? 56 : 50;
    car.accel = interceptor ? 38 : 32;
    car.stuckTimer = 0;
    car.lastPos = { x, z };
    car.hold = !!o.hold;
    car.speed = o.speed !== undefined ? o.speed : 0;
    this.cars.push(car);
    return car;
  }
  spawnSwat(player) {
    const rng = this.rng;
    for (let i = 0; i < 2; i += 1) {
      const a = rng() * Math.PI * 2;
      const x = clamp(player.x + Math.cos(a) * 25, -260, 260);
      const z = clamp(player.z + Math.sin(a) * 25, -260, 260);
      const g = makeCharacter(0x1a1a22, 0x1a1a22, 0xd8a080);
      g.userData.cap.visible = false;
      this.scene.add(g);
      this.swat.push({
        group: g, x, z, heading: 0, hp: 100, dead: false, shootCd: 1 + rng(),
        damage(amount) { this.hp -= amount; if (this.hp <= 0) this.dead = true; },
      });
    }
    this.say('Dispatch: SWAT team on the ground');
  }
  spawnHeli(player) {
    if (this.heli) return;
    const group = makeHeli();
    this.scene.add(group);
    this.heli = { group, x: player.x, z: player.z - 40, y: 42, rotor: group.userData.rotor };
    this.say('Dispatch: NEON-1 is tracking the suspect');
  }
  removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli.group);
    this.heli = null;
  }
  spawnRoadblock(player, heading) {
    // Three police cars parked across the road ahead of the player.
    const ahead = 55;
    const cx = player.x + Math.cos(heading) * ahead;
    const cz = player.z + Math.sin(heading) * ahead;
    const perp = heading + Math.PI / 2;
    const cars = [];
    for (const off of [-7, 0, 7]) {
      const car = new Car(this.scene, 'police', COLORS.police,
        cx + Math.cos(perp) * off, cz + Math.sin(perp) * off, perp);
      car.isPolice = true;
      car.maxSpeed = 50; car.accel = 32;
      car.stuckTimer = 0; car.lastPos = { x: car.x, z: car.z };
      cars.push(car);
      this.cars.push(car);
    }
    this.roadblock = { cars, timer: 0 };
    this.say('Dispatch: roadblock ahead — do not approach');
  }
  update(dt, player, playerCar, fx) {
    this.time = (this.time || 0) + dt;
    const target = playerCar || player;
    const wanted = this.wanted;
    // Wanted 0: every unit stands down and leaves.
    if (wanted === 0 && this.cars.length > 0) {
      for (const c of this.cars) this.scene.remove(c.group);
      this.cars = [];
      this.say('Dispatch: all units standing down');
    }
    // Desired pursuit count: wanted patrol cars + interceptors at 3+.
    const wantPatrol = Math.min(wanted, 3);
    const wantInterceptors = wanted >= 3 ? Math.min(2, wanted - 2) : 0;
    const patrols = this.cars.filter((c) => !c.isInterceptor && !c.wreck).length;
    const interceptors = this.cars.filter((c) => c.isInterceptor && !c.wreck).length;
    if (patrols < wantPatrol) this.spawnPursuit(player, false);
    if (interceptors < wantInterceptors) this.spawnPursuit(player, true);
    // SWAT at 5 stars.
    if (wanted >= 5 && this.swat.filter((s) => !s.dead).length === 0) this.spawnSwat(player);
    if (wanted < 5) {
      for (const s of this.swat) if (!s.dead) { s.dead = true; this.scene.remove(s.group); }
      this.swat = this.swat.filter((s) => !s.dead);
    }
    // Helicopter at 3+.
    if (wanted >= TUNING.heliMinWanted) this.spawnHeli(player);
    else this.removeHeli();
    // Roadblocks at 4+.
    this.roadblockTimer -= dt;
    if (wanted >= TUNING.roadblockMinWanted && this.roadblockTimer <= 0 && !this.roadblock) {
      this.spawnRoadblock(player, playerCar ? playerCar.heading : player.heading);
      this.roadblockTimer = 28;
    }
    if (this.roadblock) {
      this.roadblock.timer += dt;
      if (this.roadblock.timer > 40) {
        for (const c of this.roadblock.cars) {
          const i = this.cars.indexOf(c);
          if (i >= 0) this.cars.splice(i, 1);
          this.scene.remove(c.group);
        }
        this.roadblock = null;
      }
    }
    // Pursuit AI.
    for (const car of this.cars) {
      if (car.wreck || car.burning) continue;
      if (car.hold) {
        // Parked roadblock unit: stays put, lights flashing.
        const nx = car.x + Math.cos(car.heading) * car.speed * dt;
        const nz = car.z + Math.sin(car.heading) * car.speed * dt;
        const fixed = collideCircle(this.colliders, nx, nz, 2.1);
        car.x = fixed.x; car.z = fixed.z;
        car.updateMesh();
        continue;
      }
      const d = dist2(car.x, car.z, target.x, target.z);
      // Remember the last seen position: chase the player while there is
      // line of sight, search the last seen spot when the trail goes cold.
      const los = hasLineOfSight(this.colliders, car.x, car.z, target.x, target.z);
      if (los && d < 90) car.lastSeen = { x: target.x, z: target.z, t: this.time };
      const chasePlayer = car.lastSeen && (this.time - car.lastSeen.t) < 8;
      // PIT: interceptors aim at the rear quarter (only while chasing).
      let tx = chasePlayer ? target.x : (car.lastSeen ? car.lastSeen.x : target.x);
      let tz = chasePlayer ? target.z : (car.lastSeen ? car.lastSeen.z : target.z);
      if (car.isInterceptor && playerCar && chasePlayer) {
        const rear = playerCar.heading + Math.PI;
        tx = target.x + Math.cos(rear) * 4;
        tz = target.z + Math.sin(rear) * 4;
      }
      const desired = Math.atan2(tz - car.z, tx - car.x);
      const steer = clamp(angleDiff(car.heading, desired) * 1.6, -1, 1);
      const dd = dist2(car.x, car.z, tx, tz);
      const throttle = dd > 6 ? 1 : 0.3;
      stepCarPhysics(car, { throttle, steer, handbrake: false }, dt, this.colliders, [], fx);
      // Ram damage.
      if (d < 4.6 && car.ramCooldown <= 0) {
        car.ramCooldown = 1.2;
        if (playerCar) { playerCar.damage(TUNING.policeRamDamage, fx); }
        else { player.damage(8); }
        if (fx) fx('ram', car);
      }
      // Unstick: if barely moved in 4s, teleport near the player.
      if (dist2(car.x, car.z, car.lastPos.x, car.lastPos.z) < 2) car.stuckTimer += dt;
      else { car.stuckTimer = 0; car.lastPos = { x: car.x, z: car.z }; }
      if (car.stuckTimer > 4) {
        // Teleport back to the trail (last seen spot), not on top of the player.
        const lx = car.lastSeen ? car.lastSeen.x : target.x;
        const lz = car.lastSeen ? car.lastSeen.z : target.z;
        const a = this.rng() * Math.PI * 2;
        car.x = clamp(lx + Math.cos(a) * 70, -260, 260);
        car.z = clamp(lz + Math.sin(a) * 70, -260, 260);
        car.stuckTimer = 0;
      }
    }
    // Remove wrecks.
    for (let i = this.cars.length - 1; i >= 0; i -= 1) {
      if (this.cars[i].wreck) { this.scene.remove(this.cars[i].group); this.cars.splice(i, 1); }
    }
    // SWAT officers: advance and shoot.
    for (const s of this.swat) {
      if (s.dead) { s.group.visible = false; continue; }
      const d = dist2(s.x, s.z, player.x, player.z);
      if (d > 26) {
        const desired = Math.atan2(player.z - s.z, player.x - s.x);
        s.heading += angleDiff(s.heading, desired) * Math.min(1, dt * 4);
        const nx = s.x + Math.cos(s.heading) * 5 * dt;
        const nz = s.z + Math.sin(s.heading) * 5 * dt;
        const fixed = collideCircle(this.colliders, nx, nz, 0.7);
        s.x = fixed.x; s.z = fixed.z;
        s.group.position.set(s.x, 0, s.z);
        s.group.rotation.y = -s.heading + Math.PI / 2;
      } else {
        s.shootCd -= dt;
        if (s.shootCd <= 0) {
          s.shootCd = 1.4;
          if (this.rng() < 0.55) { player.damage(7); if (fx) fx('shot-at', s); }
        }
      }
    }
    // Helicopter: hover ahead and to the side so the player (and the camera)
    // can see it, rotor spins, searchlight tracks the player.
    if (this.heli) {
      const h = this.heli;
      const hd = target.heading || 0;
      // Hover ahead and slightly to the side, close to the camera axis so
      // the chase camera (62 deg FOV) can see it: ~18 deg off-axis, ~27 deg
      // elevation at hover height 30.
      const tx = target.x + Math.cos(hd) * 45 - Math.sin(hd) * 15;
      const tz = target.z + Math.sin(hd) * 45 + Math.cos(hd) * 15;
      h.x += (tx - h.x) * Math.min(1, dt * 0.7);
      h.z += (tz - h.z) * Math.min(1, dt * 0.7);
      h.y = (h.hoverY || 42) + Math.sin(performance.now() / 900) * 1.5;
      h.group.position.set(h.x, h.y, h.z);
      h.group.rotation.y = Math.PI / 2 - Math.atan2(target.z - h.z, target.x - h.x);
      h.rotor.rotation.y += dt * 22;
      h.group.userData.tailRotor.rotation.x += dt * 30;
      h.group.userData.spot.target.position.set(target.x - h.x, -h.y, target.z - h.z);
      h.group.userData.spot.target.updateMatrixWorld();
      h.group.userData.spot.intensity = 2.2;
    }
    // Wanted decay: if NO ground unit has line of sight to the player, the
    // trail goes cold and the heat drops a star. The helicopter tracks from
    // the air but cannot hold the trail on its own — hiding behind a
    // building and staying quiet is a real way to lose the cops.
    if (wanted > 0) {
      const seen = this.cars.some((c) => {
        if (c.wreck || c.burning || c.hold) return false;
        if (dist2(c.x, c.z, target.x, target.z) > 90) return false;
        return hasLineOfSight(this.colliders, c.x, c.z, target.x, target.z);
      });
      if (!seen) {
        this.unseenTimer += dt;
        if (this.unseenTimer > TUNING.wantedDecayTime) {
          this.unseenTimer = 0;
          this.setWanted(wanted - 1, 'losing the suspect');
          this.say(`Dispatch: heat dropping — ${this.wanted} star${this.wanted === 1 ? '' : 's'} left`);
        }
      } else this.unseenTimer = 0;
    }
    // Dispatch board ages out.
    for (const m of this.dispatch) m.t += dt;
    this.dispatch = this.dispatch.filter((m) => m.t < 9);
  }
}

// ---------------------------------------------------------------- rivals ----
// Tide crew enforcers: armed, they shoot at the player when in range.
export class Rivals {
  constructor(scene, rng, colliders, fx) {
    this.scene = scene; this.rng = rng; this.colliders = colliders; this.fx = fx;
    this.list = [];
  }
  spawnAt(x, z, count) {
    for (let i = 0; i < count; i += 1) {
      const g = makeCharacter(0x3a6a4a, 0x222222, 0xc08a60);
      g.userData.cap.visible = false;
      this.scene.add(g);
      const px = x + (this.rng() - 0.5) * 16;
      const pz = z + (this.rng() - 0.5) * 16;
      this.list.push({
        group: g, x: px, z: pz, heading: this.rng() * Math.PI * 2,
        hp: 100, dead: false, shootCd: 0.5 + this.rng(), walkPhase: 0,
        damage(amount) { this.hp -= amount; if (this.hp <= 0) this.dead = true; },
      });
    }
  }
  update(dt, player, fx) {
    for (const r of this.list) {
      if (r.dead) { r.group.visible = false; continue; }
      const d = dist2(r.x, r.z, player.x, player.z);
      if (d < 42) {
        const desired = Math.atan2(player.z - r.z, player.x - r.x);
        r.heading += angleDiff(r.heading, desired) * Math.min(1, dt * 5);
        r.shootCd -= dt;
        if (r.shootCd <= 0) {
          r.shootCd = 1.1 + this.rng() * 0.6;
          if (this.rng() < 0.5) { player.damage(6); if (fx) fx('shot-at', r); }
        }
      } else if (d < 90) {
        const desired = Math.atan2(player.z - r.z, player.x - r.x);
        r.heading += angleDiff(r.heading, desired) * Math.min(1, dt * 3);
        const nx = r.x + Math.cos(r.heading) * 4 * dt;
        const nz = r.z + Math.sin(r.heading) * 4 * dt;
        const fixed = collideCircle(this.colliders, nx, nz, 0.7);
        r.x = fixed.x; r.z = fixed.z;
        r.walkPhase += dt * 8;
      }
      const swing = Math.sin(r.walkPhase) * 0.4;
      const u = r.group.userData;
      u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
      r.group.position.set(r.x, 0, r.z);
      r.group.rotation.y = -r.heading + Math.PI / 2;
    }
  }
  aliveCount() { return this.list.filter((r) => !r.dead).length; }
  clear() {
    for (const r of this.list) this.scene.remove(r.group);
    this.list = [];
  }
}
