// Neon Bay 3D — boot and the one loop: input every frame, the world advances in
// real time, and the renderer paints what is there. Screens: title, play, garage
// shop, paused, wasted/busted. ?shot=cover|drive|chase|mission stages that scene
// and sets window.__shotReady for a screenshot.
import { TUNING, WEAPONS, UPGRADES, MISSIONS } from './config.js';
import { makeRng, dist2 } from './random.js';
import { buildWorld, collideCircle } from './world.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { Renderer } from './render.js';
import { HUD } from './hud.js';
import { Player, Pedestrians, Police, Rivals } from './actors.js';
import { Car, Traffic, spawnParked, stepCarPhysics, collideCars } from './vehicles.js';
import { MissionManager } from './missions.js';
import { setupShot } from './shots.js';

const T = window.THREE;
const SAVE_KEY = 'neonbay3d-save-v1';

class Game {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.shotName = params.get('shot');
    this.seed = Number(params.get('seed') || 1);
    this.rng = makeRng(this.seed);
    this.mode = 'title'; // title | playing | paused | wasted | busted
    this.garageOpen = false;
    this.renderer = new Renderer();
    this.world = buildWorld(this.renderer.scene, this.rng);
    this.colliders = this.world.colliders;
    this.input = new Input(this.renderer.renderer.domElement);
    this.audio = new AudioEngine();
    this.hud = new HUD();
    const spawn = this.world.playerSpawn;
    this.player = new Player(this.renderer.scene, spawn.x, spawn.z, spawn.heading);
    this.traffic = new Traffic(this.renderer.scene, this.rng, this.colliders);
    this.parked = spawnParked(this.renderer.scene, this.rng, this.colliders, 12);
    this.looseCars = [];
    this.playerCar = null;
    this.peds = new Pedestrians(this.renderer.scene, this.rng, this.colliders);
    this.police = new Police(this.renderer.scene, this.rng, this.colliders, (t, o) => this.fx(t, o));
    this.rivals = new Rivals(this.renderer.scene, this.rng, this.colliders, (t, o) => this.fx(t, o));
    this.missions = new MissionManager(this.renderer.scene, this.world.animated.beacon);
    this.standing = { Downtown: 0, Beachfront: 0, Docks: 0, 'The Hills': 0 };
    this.upgrades = { engine: 0, armor: 0, paint: 0 };
    this.camYaw = undefined;
    this.shot = null;
    this.shotTimer = 0;
    this.shotReady = false;
    this.exhaustTimer = 0;
    this.smokeTimers = new Map();
    this.wantedThrottle = 0;
    this.saveData = this.loadSave();
    this.ctx = {
      player: this.player,
      playerCar: null,
      police: this.police,
      rivals: this.rivals,
      world: this.world,
      audio: this.audio,
      fx: (t, o) => this.fx(t, o),
      save: () => this.save(),
      standing: this.standing,
    };
    this.raycaster = new T.Raycaster();
    this.downPos = null;
    this.justClicked = false;
    this.bindMouse();
    this.bindWheelSlots();
    // World population.
    this.traffic.spawnInitial(TUNING.trafficCount, { x: spawn.x, z: spawn.z });
    this.peds.spawnInitial(18, { x: spawn.x, z: spawn.z });
    this.spawnPlayerCar('sedan', 0xe86a20, spawn.x + 4, spawn.z - 6, spawn.heading);
    this.playerCar = null; // spawned car is parked, not driven yet
    if (this.shotName) {
      // Screenshot mode: skip the title, stage the scene, drive it for a few seconds.
      this.mode = 'playing';
      this.shot = setupShot(this.shotName, this);
      if (typeof this.camYaw === 'number') this.renderer.camYaw = this.camYaw;
    } else {
      this.hud.showScreen('title', { save: this.saveData }, {
        onStart: (newGame) => this.startGame(newGame),
      });
    }
    window.__nbState = () => this.debugState();
    // Loop.
    let last = performance.now();
    const tick = (now) => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (this.mode === 'playing' && !this.garageOpen) this.update(dt);
      this.renderer.render();
    };
    requestAnimationFrame(tick);
  }

  // ---- setup helpers ------------------------------------------------------
  spawnPlayerCar(kind, color, x, z, heading) {
    const car = new Car(this.renderer.scene, kind, color, x, z, heading);
    car.owned = true;
    car.stolen = false;
    // Headlights: a spotlight that only turns on at dusk for the driven car.
    const spot = new T.SpotLight(0xfff2c0, 0, 70, 0.45, 0.5, 1.0);
    spot.position.set(2.2, 1, 0);
    const spotTarget = new T.Object3D();
    spotTarget.position.set(14, 0, 0);
    car.group.add(spotTarget);
    spot.target = spotTarget;
    car.group.add(spot);
    car.headlight = spot;
    this.applyUpgrades(car);
    this.looseCars.push(car);
    return car;
  }
  applyUpgrades(car) {
    const eng = UPGRADES.engine[this.upgrades.engine] || UPGRADES.engine[0];
    const arm = UPGRADES.armor[this.upgrades.armor] || UPGRADES.armor[0];
    car.maxSpeed = eng.maxSpeed;
    car.accel = eng.accel;
    car.maxHp = arm.hp;
    car.hp = Math.min(car.hp, car.maxHp);
    const paint = UPGRADES.paint[this.upgrades.paint] || UPGRADES.paint[0];
    if (car.model.bodyMat) car.model.bodyMat.color.setHex(paint.color);
    car.color = paint.color;
  }
  bindMouse() {
    const canvas = this.renderer.renderer.domElement;
    canvas.addEventListener('mousedown', (e) => { this.downPos = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('mouseup', (e) => {
      if (!this.downPos) return;
      const dx = e.clientX - this.downPos.x, dy = e.clientY - this.downPos.y;
      if (dx * dx + dy * dy < 36) this.justClicked = true;
      this.downPos = null;
    });
  }
  bindWheelSlots() {
    this.hud.wheelSlots.forEach((slot, i) => {
      slot.addEventListener('click', () => {
        this.player.weapon = i;
        this.hud.hideWheel();
        this.wheelOpen = false;
      });
    });
  }

  // ---- save / load --------------------------------------------------------
  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  save() {
    try {
      const cars = [];
      for (const c of this.looseCars) {
        if (c.wreck) continue;
        cars.push({ kind: c.kind, color: c.color, x: c.x, z: c.z, heading: c.heading });
      }
      if (this.playerCar && !this.playerCar.wreck) {
        cars.push({ kind: this.playerCar.kind, color: this.playerCar.color, x: this.playerCar.x, z: this.playerCar.z, heading: this.playerCar.heading });
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.player.money,
        respect: this.player.respect,
        missionIndex: this.missions.index,
        standing: this.standing,
        upgrades: this.upgrades,
        cars,
        px: this.player.x, pz: this.player.z, heading: this.player.heading,
        hp: this.player.hp, ammo: this.player.ammo, weapon: this.player.weapon,
      }));
    } catch { /* storage unavailable — the game still runs */ }
  }
  applySave(d) {
    this.player.money = d.money || 0;
    this.player.respect = d.respect || 0;
    this.missions.index = Math.min(d.missionIndex || 0, MISSIONS.length - 1);
    Object.assign(this.standing, d.standing || {});
    Object.assign(this.upgrades, d.upgrades || {});
    this.player.hp = d.hp || TUNING.playerHp;
    this.player.ammo = d.ammo || this.player.ammo;
    this.player.weapon = d.weapon || 1;
    if (d.px !== undefined) { this.player.x = d.px; this.player.z = d.pz; this.player.heading = d.heading || 0; }
    // Owned cars from the save replace the starter car.
    if (d.cars && d.cars.length) {
      for (const c of this.looseCars) this.renderer.scene.remove(c.group);
      this.looseCars = [];
      for (const c of d.cars) this.spawnPlayerCar(c.kind, c.color, c.x, c.z, c.heading);
    }
    this.player.updateMesh();
  }
  startGame(newGame) {
    this.audio.init();
    this.audio.resume();
    if (newGame) {
      try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
      this.saveData = null;
    } else if (this.saveData) {
      this.applySave(this.saveData);
    }
    this.hud.hideScreen();
    this.mode = 'playing';
    if (!this.missions.active && this.missions.index < MISSIONS.length) {
      this.missions.start(this.missions.index, this.ctx);
    }
  }

  // ---- effects ------------------------------------------------------------
  fx(type, obj) {
    const R = this.renderer;
    if (type === 'crash') {
      R.burst(obj.x, 1, obj.z, 0xffcc66, 12, 6, 0.5, -4, 2);
      R.trauma = Math.min(1, R.trauma + 0.3);
      this.audio.blip(90, 0.2, 'sawtooth', 0.3);
    } else if (type === 'ram') {
      R.trauma = Math.min(1, R.trauma + 0.25);
      this.audio.blip(70, 0.2, 'square', 0.3);
    } else if (type === 'jump') {
      R.burst(obj.x, 0.5, obj.z, 0xcccccc, 8, 3, 0.5, 0, 1);
    } else if (type === 'land') {
      R.burst(obj.x, 0.5, obj.z, 0xaaaaaa, 10, 4, 0.4, 0, 1);
      R.trauma = Math.min(1, R.trauma + 0.15);
    } else if (type === 'ignite') {
      this.audio.blip(200, 0.4, 'sawtooth', 0.2);
    }
  }
  explodeCar(car) {
    this.renderer.explosion(car.x, 1, car.z);
    this.audio.blip(60, 0.6, 'sawtooth', 0.5);
    car.wreck = true;
    car.burning = false;
    // Char the mesh.
    car.group.traverse((m) => {
      if (m.isMesh && m.material && m.material.color) m.material.color.multiplyScalar(0.25);
    });
    // Blast damage.
    if (dist2(this.player.x, this.player.z, car.x, car.z) < 12) this.player.damage(25);
    for (const p of this.peds.list) {
      if (!p.dead && dist2(p.x, p.z, car.x, car.z) < 10) p.damage(200);
    }
    if (this.playerCar === car) {
      // Eject the player from the wreck.
      this.playerCar = null;
      this.player.inCar = null;
      this.ctx.playerCar = null;
      this.player.x = car.x + 4; this.player.z = car.z + 4;
      this.player.updateMesh();
    }
  }

  // ---- combat ---------------------------------------------------------------
  shootables() {
    const list = [];
    for (const r of this.rivals.list) if (!r.dead) list.push({ group: r.group, entity: r });
    for (const p of this.peds.list) if (!p.dead) list.push({ group: p.group, entity: p });
    for (const s of this.police.swat) if (!s.dead) list.push({ group: s.group, entity: s });
    for (const c of [...this.traffic.cars, ...this.parked, ...this.looseCars, ...this.police.cars]) {
      if (!c.wreck && !c.burning) list.push({ group: c.group, entity: c });
    }
    return list;
  }
  shoot() {
    const w = WEAPONS[this.player.weapon];
    if (this.player.cooldown > 0) return;
    if (this.player.ammo[this.player.weapon] <= 0) {
      this.audio.blip(160, 0.08, 'square', 0.15);
      return;
    }
    this.player.cooldown = w.rate;
    if (this.player.ammo[this.player.weapon] !== Infinity) this.player.ammo[this.player.weapon] -= 1;
    this.audio.gunshot();
    const pellets = w.pellets || 1;
    const targets = this.shootables();
    let hitAny = false;
    for (let i = 0; i < pellets; i += 1) {
      const ox = (Math.random() - 0.5) * w.spread * 2;
      const oy = (Math.random() - 0.5) * w.spread * 2;
      this.raycaster.setFromCamera({ x: ox, y: oy }, this.renderer.camera);
      this.raycaster.far = w.range;
      let best = null, bestD = Infinity;
      for (const t of targets) {
        const hits = this.raycaster.intersectObject(t.group, true);
        if (hits.length && hits[0].distance < bestD) { best = { t, hit: hits[0] }; bestD = hits[0].distance; }
      }
      if (best) {
        hitAny = true;
        const p = best.hit.point;
        this.renderer.burst(p.x, p.y, p.z, 0xffdd88, 6, 4, 0.3, -2, 1);
        const e = best.t.entity;
        e.damage(w.damage);
        if (e.isPed && e.dead) this.police.addWanted(1, 'pedestrian down');
        if (this.police.swat.includes(e) && e.dead) this.police.addWanted(1, 'officer down');
        // A shot the police see raises the heat (throttled).
        if (this.police.cars.some((c) => dist2(c.x, c.z, this.player.x, this.player.z) < 45) && this.wantedThrottle <= 0) {
          this.police.addWanted(1, 'shots fired');
          this.wantedThrottle = 5;
        }
      }
    }
    if (!hitAny) {
      // Tracer dust where the shot landed.
      const end = this.raycaster.ray.at(w.range, new T.Vector3());
      this.renderer.burst(end.x, end.y, end.z, 0x999999, 2, 1, 0.3, 0, 0);
    }
  }
  punch() {
    const targets = [
      ...this.rivals.list.filter((r) => !r.dead),
      ...this.peds.list.filter((p) => !p.dead),
      ...this.police.swat.filter((s) => !s.dead),
    ];
    const hit = this.player.punch(targets);
    if (hit) {
      this.audio.blip(140, 0.1, 'square', 0.3);
      for (const t of targets) if (t.dead && t.isPed) this.police.addWanted(1, 'pedestrian down');
    }
  }

  // ---- entering / exiting cars ----------------------------------------------
  nearestCar(maxD) {
    let best = null, bestD = maxD;
    const all = [...this.parked, ...this.traffic.cars, ...this.looseCars, ...this.police.cars];
    for (const c of all) {
      if (c.wreck || c.burning) continue;
      const d = dist2(this.player.x, this.player.z, c.x, c.z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }
  enterCar(car) {
    // Remove from its source list.
    let idx = this.parked.indexOf(car); if (idx >= 0) this.parked.splice(idx, 1);
    idx = this.traffic.cars.indexOf(car); if (idx >= 0) this.traffic.cars.splice(idx, 1);
    idx = this.looseCars.indexOf(car); if (idx >= 0) this.looseCars.splice(idx, 1);
    idx = this.police.cars.indexOf(car); if (idx >= 0) this.police.cars.splice(idx, 1);
    if (!car.owned) {
      car.stolen = true;
      this.police.addWanted(car.isPolice ? 2 : 1, car.isPolice ? 'stolen police car' : 'grand theft auto');
      this.hud.showDialogue('Nice ride. Shame it is not yours.', '');
    }
    this.applyUpgrades(car);
    this.playerCar = car;
    this.player.inCar = car;
    this.ctx.playerCar = car;
    car.isPlayer = true;
    this.player.x = car.x; this.player.z = car.z;
    this.player.group.visible = false;
    if (car.headlight) car.headlight.intensity = this.renderer.dusk > 0.3 ? 2.5 : 0;
    this.audio.blip(300, 0.1, 'square', 0.2);
  }
  exitCar() {
    const car = this.playerCar;
    if (!car) return;
    car.speed = 0;
    car.isPlayer = false;
    if (car.headlight) car.headlight.intensity = 0;
    // Step out to the side.
    const side = car.heading + Math.PI / 2;
    this.player.x = car.x + Math.cos(side) * 3;
    this.player.z = car.z + Math.sin(side) * 3;
    this.player.heading = car.heading;
    this.player.group.visible = true;
    this.player.updateMesh();
    car.owned = true;
    car.stolen = false;
    this.looseCars.push(car);
    this.playerCar = null;
    this.player.inCar = null;
    this.ctx.playerCar = null;
  }

  // ---- garage shop ------------------------------------------------------------
  garageZone() {
    const g = this.world.garagePos;
    return dist2(this.player.x, this.player.z, g.x, g.z) < 22;
  }
  openGarage() {
    const car = this.playerCar;
    if (!car) return;
    this.garageOpen = true;
    const freeRepair = this.player.respect >= 15;
    this.hud.showGarage({
      money: this.player.money,
      carHp: car.hp,
      freeRepair,
      upgrades: this.upgrades,
    }, {
      onClose: () => { this.garageOpen = false; this.hud.hideGarage(); },
      onRepair: () => {
        const cost = freeRepair ? 0 : 100;
        if (this.player.money < cost) { this.hud.showDialogue('Not enough cash for repairs.', 'Vic'); return; }
        this.player.money -= cost;
        car.hp = car.maxHp; car.burning = false;
        this.hud.showDialogue(freeRepair ? 'On the house, kid. Vic takes care of his own.' : 'Good as new. That will be $100.', 'Vic');
        this.openGarage();
      },
      onBuy: (kind, lvl) => {
        const cost = UPGRADES[kind][lvl].cost;
        if (this.player.money < cost) { this.hud.showDialogue('Not enough cash.', 'Vic'); return; }
        this.player.money -= cost;
        this.upgrades[kind] = lvl;
        this.applyUpgrades(car);
        this.hud.showDialogue(`${UPGRADES[kind][lvl].name} installed.`, 'Vic');
        this.openGarage();
      },
      onPaint: (lvl) => {
        const cost = UPGRADES.paint[lvl].cost;
        if (this.player.money < cost) { this.hud.showDialogue('Not enough cash.', 'Vic'); return; }
        this.player.money -= cost;
        this.upgrades.paint = lvl;
        this.applyUpgrades(car);
        this.openGarage();
      },
    });
  }

  // ---- death ------------------------------------------------------------------
  die() {
    const busted = this.police.wanted >= 3 && this.police.cars.some((c) => dist2(c.x, c.z, this.player.x, this.player.z) < 14);
    const fee = busted ? 200 : 100;
    this.player.money = Math.max(0, this.player.money - fee);
    this.mode = busted ? 'busted' : 'wasted';
    this.audio.fail();
    this.hud.showScreen(this.mode, { money: this.player.money, missionIndex: this.missions.index }, {
      onRestart: () => this.respawn(),
    });
  }
  respawn() {
    const spawn = this.world.playerSpawn;
    this.player.hp = TUNING.playerHp;
    this.player.dead = false;
    this.player.x = spawn.x; this.player.z = spawn.z; this.player.heading = spawn.heading;
    this.player.group.visible = true;
    this.player.updateMesh();
    this.police.setWanted(0, 'released');
    this.playerCar = null;
    this.player.inCar = null;
    this.ctx.playerCar = null;
    this.hud.hideScreen();
    this.mode = 'playing';
    this.save();
  }

  // ---- per-frame ---------------------------------------------------------------
  update(dt) {
    const inp = this.input;
    const P = this.player;
    // Shot-mode autopilot drives for the first few frames. Frame-counted (not
    // wall-clock), so slow software renderers still reach the staged state.
    let auto = null;
    if (this.shot) {
      this.shotFrames = (this.shotFrames || 0) + 1;
      const settleFrames = this.shot.settleFrames || 150;
      if (this.shotFrames < settleFrames && this.shot.autopilot) auto = this.shot.autopilot();
      else if (!this.shotReady) {
        this.shotReady = true;
        window.__shotReady = true;
      }
    }
    // Edge-triggered keys.
    if (inp.wasPressed('KeyE')) {
      if (P.inCar) this.exitCar();
      else {
        const car = this.nearestCar(4.5);
        if (car) this.enterCar(car);
      }
    }
    if (inp.wasPressed('KeyG') && P.inCar && this.garageZone()) this.openGarage();
    if (inp.wasPressed('KeyM') && !this.missions.active && this.missions.index < MISSIONS.length) {
      this.missions.start(this.missions.index, this.ctx);
    }
    if (inp.wasPressed('KeyR')) {
      const on = this.audio.toggleRadio();
      this.hud.showDialogue(on ? `Radio on — station ${this.audio.radioStation + 1}` : 'Radio off', '');
    }
    if (inp.wasPressed('KeyT')) {
      const s = this.audio.nextStation();
      if (this.audio.radioOn) this.hud.showDialogue(`Radio — station ${s + 1}`, '');
    }
    if (inp.wasPressed('KeyQ')) {
      P.weapon = (P.weapon + 1) % WEAPONS.length;
    }
    for (let i = 0; i < 4; i += 1) {
      if (inp.wasPressed(`Digit${i + 1}`)) {
        P.weapon = i;
        if (this.wheelOpen) { this.hud.hideWheel(); this.wheelOpen = false; }
      }
    }
    if (inp.wasPressed('Tab')) {
      inp.keys.delete('Tab');
      this.wheelOpen = !this.wheelOpen;
      if (this.wheelOpen) this.hud.showWheel(P.weapon);
      else this.hud.hideWheel();
    }
    if (inp.wasPressed('KeyP') || inp.wasPressed('Escape')) {
      if (this.mode === 'playing') {
        this.mode = 'paused';
        this.save();
        this.hud.showScreen('paused', {}, {
          onResume: () => { this.mode = 'playing'; this.hud.hideScreen(); },
          onQuit: () => { this.mode = 'title'; this.hud.hideScreen(); this.hud.showScreen('title', { save: this.loadSave() }, { onStart: (ng) => this.startGame(ng) }); },
        });
      } else if (this.mode === 'paused') {
        this.mode = 'playing';
        this.hud.hideScreen();
      }
    }
    // Combat clicks.
    if (this.justClicked && !P.inCar && this.mode === 'playing') {
      if (P.weapon === 0) this.punch();
      else this.shoot();
    }
    this.justClicked = false;
    if (inp.mouseDown && P.weapon === 3 && !P.inCar && this.mode === 'playing') this.shoot(); // SMG auto-fire
    // Player movement.
    if (P.inCar) {
      const car = P.inCar;
      let drive;
      if (auto) drive = auto;
      else {
        const { f, s } = inp.axis();
        drive = { throttle: f, steer: s, handbrake: inp.down('Space') };
      }
      if (!car.burning) stepCarPhysics(car, drive, dt, this.colliders, this.world.ramps, (t, o) => this.fx(t, o));
      P.x = car.x; P.z = car.z; P.heading = car.heading;
      // Exhaust puffs + skid marks.
      this.exhaustTimer -= dt;
      if (this.exhaustTimer <= 0 && Math.abs(car.speed) > 3) {
        this.exhaustTimer = 0.12;
        this.renderer.exhaust(car.x, 0.5, car.z, car.heading);
      }
      if ((drive.handbrake && Math.abs(car.speed) > 10) || (Math.abs(drive.steer) > 0.8 && Math.abs(car.speed) > 22)) {
        const back = car.heading + Math.PI;
        this.renderer.addSkid(car.x + Math.cos(back) * 2, car.z + Math.sin(back) * 2, car.heading);
      }
      if (car.headlight) car.headlight.intensity = this.renderer.dusk > 0.3 ? 2.5 : 0;
    } else {
      P.stepOnFoot(dt, inp, this.renderer.camYaw, this.colliders);
    }
    // Car-car collisions for the player's car.
    if (P.inCar) {
      const others = [...this.traffic.cars, ...this.police.cars, ...this.parked, ...this.looseCars];
      for (const o of others) if (!o.wreck) collideCars(P.inCar, o, (t, c) => this.fx(t, c));
      // Running over pedestrians.
      for (const ped of this.peds.list) {
        if (ped.dead) continue;
        if (dist2(ped.x, ped.z, P.inCar.x, P.inCar.z) < 2.6 && Math.abs(P.inCar.speed) > 5) {
          ped.damage(200);
          this.police.addWanted(1, 'pedestrian down');
          this.renderer.burst(ped.x, 1, ped.z, 0xcc2222, 8, 3, 0.5, 0, 1);
        }
      }
    }
    // Burning cars: smoke, then explode.
    const allCars = [
      ...(P.inCar ? [P.inCar] : []),
      ...this.traffic.cars, ...this.police.cars, ...this.parked, ...this.looseCars,
    ];
    for (const car of allCars) {
      if (!car.burning || car.wreck) continue;
      car.burnTimer += dt;
      const lastSmoke = this.smokeTimers.get(car) || 0;
      if (car.burnTimer - lastSmoke > 0.12) {
        this.smokeTimers.set(car, car.burnTimer);
        this.renderer.smoke(car.x, 1.5, car.z);
      }
      if (car.burnTimer > 2.5) this.explodeCar(car);
    }
    // World systems.
    this.ctx.playerCar = P.inCar;
    this.traffic.update(dt, P.inCar, (t, o) => this.fx(t, o));
    this.peds.update(dt, P, P.inCar, null);
    this.police.update(dt, P, P.inCar, (t, o) => this.fx(t, o));
    this.rivals.update(dt, P, (t, o) => this.fx(t, o));
    this.missions.update(dt, this.ctx);
    for (const e of this.missions.takeEvents()) {
      if (e.type === 'dialogue') this.hud.showDialogue(e.text, e.who);
      else if (e.type === 'mission-complete') this.hud.showDialogue(`Job done: ${e.title} (+$${e.reward})`, '');
      else if (e.type === 'mission-available') this.hud.showDialogue(`New job: ${e.title} — press M`, '');
      else if (e.type === 'story-complete') this.hud.showDialogue('Story complete — Neon Bay is yours, Kingpin.', '');
      else if (e.type === 'mission-failed') this.hud.showDialogue('Job failed — try again.', '');
    }
    // Camera + particles.
    const target = P.inCar || P;
    this.renderer.updateCamera(dt, target, !!P.inCar, inp.yawDelta, inp.pitchDelta);
    this.renderer.updateParticles(dt);
    // Water shimmer + beacon pulse.
    const t = performance.now() / 1000;
    for (const w of this.world.animated.water) w.position.y = 0.05 + Math.sin(t * 0.7 + w.position.x) * 0.04;
    const beacon = this.world.animated.beacon;
    if (beacon.visible) beacon.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
    // Audio levels.
    const speedNorm = P.inCar ? Math.abs(P.inCar.speed) / (P.inCar.maxSpeed || TUNING.carMaxSpeed) : 0;
    this.audio.setEngine(speedNorm, !!P.inCar);
    const nearestPolice = this.police.cars.reduce((m, c) => Math.min(m, dist2(c.x, c.z, P.x, P.z)), Infinity);
    this.audio.setSiren(nearestPolice < 60 ? 1 - nearestPolice / 60 : 0);
    this.audio.setHeli(this.police.heli ? 0.8 : 0);
    if (this.wantedThrottle > 0) this.wantedThrottle -= dt;
    // HUD.
    const targetPos = this.missions.targetPos();
    this.hud.update({
      wanted: this.police.wanted,
      money: P.money,
      respect: P.respect,
      district: this.world.districtAt(P.x, P.z),
      standing: this.standing,
      hp: P.hp, maxHp: TUNING.playerHp,
      weaponIndex: P.weapon,
      ammo: P.ammo,
      speedKmh: P.inCar ? Math.abs(P.inCar.speed) * 3.6 : 0,
      inCar: !!P.inCar,
      objective: this.missions.objectiveText(),
      objectiveDist: targetPos ? dist2(P.x, P.z, targetPos.x, targetPos.z) : null,
      carHp: P.inCar ? P.inCar.hp : undefined,
    });
    this.hud.tickDialogue(dt);
    this.hud.drawMinimap({
      playerX: P.x, playerZ: P.z, playerHeading: P.heading,
      cars: [
        ...this.traffic.cars.filter((c) => !c.wreck).map((c) => ({ x: c.x, z: c.z, kind: c.kind })),
        ...this.parked.filter((c) => !c.wreck).map((c) => ({ x: c.x, z: c.z, kind: c.kind })),
        ...this.police.cars.filter((c) => !c.wreck).map((c) => ({ x: c.x, z: c.z, kind: 'police' })),
      ],
      heli: this.police.heli ? { x: this.police.heli.x, z: this.police.heli.z } : null,
      mission: targetPos,
      drops: [...this.missions.drops, ...this.missions.ambientDrops].filter((d) => !d.taken).map((d) => ({ x: d.x, z: d.z })),
      showDrops: P.respect >= 40,
    });
    this.hud.setDispatch(this.police.dispatch, this.police.cars.length + (this.police.heli ? 1 : 0) + this.police.swat.filter((s) => !s.dead).length);
    // Death.
    if (P.dead && this.mode === 'playing') this.die();
    inp.endFrame();
  }

  debugState() {
    const P = this.player;
    return {
      mode: this.mode,
      px: Math.round(P.x), pz: Math.round(P.z),
      heading: Number(P.heading.toFixed(3)),
      money: P.money, respect: P.respect,
      missionIndex: this.missions.index,
      mission: this.missions.current() ? this.missions.current().title : 'none',
      missionActive: this.missions.active,
      objective: this.missions.objectiveText(),
      wanted: this.police.wanted,
      hp: P.hp,
      ammo: P.ammo,
      weapon: P.weapon,
      inCar: !!P.inCar,
      carSpeed: P.inCar ? Math.round(P.inCar.speed * 3.6) : 0,
      traffic: this.traffic.cars.length,
      peds: this.peds.list.filter((p) => !p.dead).length,
      policeCars: this.police.cars.length,
      heli: !!this.police.heli,
      rivals: this.rivals.aliveCount(),
      drops: this.missions.drops.filter((d) => !d.taken).length + this.missions.ambientDrops.filter((d) => !d.taken).length,
      shotReady: this.shotReady,
    };
  }
}

new Game();
