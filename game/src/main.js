// The full game loop for Neon Bay 3D: menu, play, pause, busted and done
// states wired to missions, HUD, audio, saving, Vic's small garage repair,
// and the screenshot mode behind ?shot=. Exports: nothing (it runs on load).

import { TUNING } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { buildWorld } from './world.js';
import { createTraffic } from './vehicles.js';
import { createActors } from './actors.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { createShots, SHOT_NAMES } from './shots.js';

const SAVE_KEY = 'neon-bay-3d-save';
const GARAGE = { x: -100, z: -100 };

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const pauseScreen = document.getElementById('pause-screen');
const resumeButton = document.getElementById('resume-button');
const retryButton = document.getElementById('retry-button');

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    return data;
  } catch (err) {
    return null;
  }
}

function saveGame(player, missionIndex) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: Math.round(player.money),
      respect: player.respect,
      missionIndex,
      x: Math.round(player.pos.x),
      z: Math.round(player.pos.z),
    }));
  } catch (err) {
    /* saving is best-effort */
  }
}

const rng = createRandom(1);
const world = buildWorld(rng);
const renderer = createRenderer(canvas, world);
renderer.scene.add(world.group);
renderer.resize();

const input = createInput(window);
const audio = createAudio();
const traffic = createTraffic(world, rng, 8);
const actors = createActors(world, input, rng, audio, traffic);
actors.setCamera(renderer.camera);
const hud = createHud();
const missions = createMissions(actors, world, rng, {
  onMissionComplete(done, reward) {
    audio.missionComplete();
    audio.cash();
    hud.showDialogue(done.giver, `Job done, Rex. $${reward} is yours.`);
    saveGame(actors.player, missions.index);
  },
  onDialogue(speaker, text) {
    hud.showDialogue(speaker, text);
  },
});
const shots = createShots(renderer, actors, missions, world);

const player = actors.player;
const saved = loadSave();
if (saved) {
  player.money = saved.money;
  player.respect = saved.respect;
  statusEl.textContent = `Save found — $${saved.money} and respect ${saved.respect} restored. Press Start the night.`;
} else {
  statusEl.textContent = 'Neon Bay 3D. Press Start the night.';
}

let state = 'menu';
let timeOfDay = 0.35;
let speedSmooth = 0;
let prevX = player.pos.x;
let prevZ = player.pos.z;
let shotName = null;

const params = new URLSearchParams(window.location.search);
const wanted = params.get('shot');
if (wanted && SHOT_NAMES.includes(wanted)) {
  shotName = wanted;
  state = 'shot';
  startScreen.style.display = 'none';
  timeOfDay = 0.62;
  shots.applyShot(shotName);
  statusEl.textContent = `Neon Bay 3D. Screenshot scene: ${shotName}.`;
}

function hudState() {
  const inCar = !player.onFoot && !!player.car;
  const district = world.districtAt(player.pos.x, player.pos.z);
  const police = [];
  for (const entry of actors.police) {
    police.push({ x: entry.vehicle.mesh.position.x, z: entry.vehicle.mesh.position.z });
  }
  const heli = actors.helicopter.active
    ? { x: actors.helicopter.mesh.position.x, z: actors.helicopter.mesh.position.z }
    : null;
  return {
    money: player.money,
    respect: player.respect,
    stars: actors.wanted.stars,
    hp: player.hp,
    maxHp: TUNING.player.maxHp,
    speedKmh: speedSmooth * 3.6,
    weaponName: TUNING.weapons[player.weapon].name,
    ammo: player.ammo[player.weapon],
    objective: state === 'menu'
      ? 'Press Start the night to begin'
      : (state === 'shot' && !missions.current
        ? 'Neon Bay 3D — an open-world crime game'
        : missions.objectiveText()),
    districtName: district ? district.name : 'Midtown',
    playerX: player.pos.x,
    playerZ: player.pos.z,
    playerHeading: player.heading,
    police,
    marker: missions.currentMarker(),
    helicopter: heli,
    timeOfDay,
  };
}

function renderState() {
  const inCar = !player.onFoot && !!player.car;
  return {
    mode: state === 'menu' ? 'menu' : 'play',
    playerPos: player.pos,
    playerHeading: player.heading,
    playerInCar: inCar,
    playerSpeed: speedSmooth,
    playerHp: player.hp,
    playerMaxHp: TUNING.player.maxHp,
    carMesh: inCar ? player.car.mesh : null,
    helicopterPos: actors.helicopter.active
      ? actors.helicopter.mesh.position
      : null,
    timeOfDay,
  };
}

function trackSpeed(dt) {
  if (dt <= 0) return;
  const dx = player.pos.x - prevX;
  const dz = player.pos.z - prevZ;
  const instant = Math.sqrt(dx * dx + dz * dz) / dt;
  speedSmooth += (instant - speedSmooth) * 0.25;
  prevX = player.pos.x;
  prevZ = player.pos.z;
}

function tryGarage() {
  if (!input.takePressed('KeyG')) return;
  const dx = player.pos.x - GARAGE.x;
  const dz = player.pos.z - GARAGE.z;
  if (dx * dx + dz * dz > 64) return;
  if (!player.car) {
    hud.showDialogue('Vic', 'Bring the car in, Rex — I fix cars, not shoes.');
    return;
  }
  if (player.car.hp >= TUNING.car.maxHp) {
    hud.showDialogue('Vic', 'She is already cherry, Rex. Go earn.');
    return;
  }
  if (player.money < TUNING.economy.repairCost) {
    hud.showDialogue('Vic', 'Repairs are $120. Come back when you have the cash.');
    return;
  }
  player.money -= TUNING.economy.repairCost;
  player.car.hp = TUNING.car.maxHp;
  audio.cash();
  hud.showDialogue('Vic', 'Patched her up. $120.');
}

function checkEnd() {
  if (player.hp <= 0) {
    state = 'busted';
    hud.setEnd('Busted', `The night caught up with Rex. $${Math.round(player.money)} banked, respect ${player.respect}.`);
    return true;
  }
  if (player.onFoot && actors.wanted.stars >= 2) {
    for (const entry of actors.police) {
      const p = entry.vehicle.mesh.position;
      const dx = p.x - player.pos.x;
      const dz = p.z - player.pos.z;
      if (dx * dx + dz * dz < 25 && !entry.vehicle.isWrecked()) {
        state = 'busted';
        hud.setEnd('Busted', 'The police took Rex in on foot. The city keeps your cash.');
        return true;
      }
    }
  }
  if (missions.index >= TUNING.missions.count && !missions.current) {
    state = 'done';
    hud.setEnd('Neon Bay is yours', `All ten jobs done. $${Math.round(player.money)} banked, respect ${player.respect}.`);
    return true;
  }
  return false;
}

function startGame() {
  audio.resume();
  startScreen.style.display = 'none';
  pauseScreen.style.display = 'none';
  if (missions.index < 0) missions.startNext();
  state = 'playing';
  statusEl.textContent = 'Neon Bay 3D. Playing.';
}

startButton.addEventListener('click', startGame);
resumeButton.addEventListener('click', () => {
  pauseScreen.style.display = 'none';
  state = 'playing';
});
retryButton.addEventListener('click', () => {
  window.location.reload();
});
window.addEventListener('resize', () => renderer.resize());

window.__neonBay = {
  get state() { return state; },
  player,
  wanted: actors.wanted,
  get missionIndex() { return missions.index; },
  get timeOfDay() { return timeOfDay; },
  actors,
  missions,
  renderer,
};

let shotFrames = 0;
window.__shotReady = false;
window.__nbState = function __nbState() {
  const heli = actors.helicopter;
  let heliScreen = null;
  if (heli.active) {
    const v = heli.mesh.position.clone().project(renderer.camera);
    heliScreen = { x: Math.round(v.x * 1000) / 1000, y: Math.round(v.y * 1000) / 1000 };
  }
  return {
    state,
    missionIndex: missions.index,
    money: Math.round(player.money),
    respect: player.respect,
    wanted: actors.wanted.stars,
    player: {
      x: Math.round(player.pos.x),
      z: Math.round(player.pos.z),
      heading: Math.round(player.heading * 100) / 100,
      onFoot: player.onFoot,
    },
    heli: {
      active: heli.active,
      x: Math.round(heli.mesh.position.x),
      y: Math.round(heli.mesh.position.y),
      z: Math.round(heli.mesh.position.z),
      screen: heliScreen,
    },
    marker: missions.currentMarker(),
    objective: missions.objectiveText(),
  };
};

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  if (state === 'menu') {
    renderer.update(dt, {
      mode: 'menu',
      playerPos: { x: 0, z: 0 },
      playerHeading: 0,
      playerInCar: false,
      playerSpeed: 0,
      playerHp: player.hp,
      playerMaxHp: TUNING.player.maxHp,
      carMesh: null,
      timeOfDay: 0.5,
    });
    return;
  }

  if (state === 'paused' || state === 'busted' || state === 'done') {
    renderer.update(0, renderState());
    return;
  }

  if (state === 'shot') {
    traffic.update(dt, player.pos);
    actors.update(dt);
    missions.update(dt);
    trackSpeed(dt);
    renderer.update(dt, renderState());
    hud.update(hudState());
    shotFrames += 1;
    if (shotFrames > 20) window.__shotReady = true;
    return;
  }

  // Playing.
  if (input.takePressed('KeyP')) {
    state = 'paused';
    pauseScreen.style.display = 'flex';
    saveGame(player, missions.index);
    return;
  }
  if (input.takePressed('KeyM')) audio.nextStation();
  if (input.held('Tab')) hud.showWheel(input.weaponIndex());
  else hud.hideWheel();

  traffic.update(dt, player.pos);
  actors.update(dt);
  missions.update(dt);
  timeOfDay = Math.min(0.95, timeOfDay + dt / TUNING.world.dayLength);
  trackSpeed(dt);
  tryGarage();

  const inCar = !player.onFoot && !!player.car;
  audio.engine(inCar ? Math.abs(player.car.speed) : 0, inCar);

  renderer.update(dt, renderState());
  hud.update(hudState());
  checkEnd();
}
requestAnimationFrame(frame);
