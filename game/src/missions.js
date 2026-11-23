// Ten story jobs for Neon Bay 3D, each a small state machine that tracks
// where Rex is, pays out when the job lands, and hands the next job over
// through dialogue callbacks. Exports: createMissions.

import { TUNING, MISSION_TITLES, DISTRICTS } from './config.js';
import { makeCar, makePedestrian } from './models.js';
import { createVehicle } from './vehicles.js';

const HALF_CITY = 300;

function clamp(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// Pick a road point near a district centre: try a few random road points and
// keep the closest one to the target, so markers sit on roads and in-district.
function pointNear(world, rng, cx, cz) {
  let best = world.randomRoadPoint(rng);
  let bestD = dist2D(best.x, best.z, cx, cz);
  for (let tries = 0; tries < 12; tries += 1) {
    const cand = world.randomRoadPoint(rng);
    const d = dist2D(cand.x, cand.z, cx, cz);
    if (d < bestD) {
      best = cand;
      bestD = d;
    }
  }
  return best;
}

// Spread several road points apart so cash drops never stack on each other.
function spreadPoints(world, rng, count, minGap) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard < 200) {
    guard += 1;
    const cand = world.randomRoadPoint(rng);
    let ok = true;
    for (const p of out) {
      if (dist2D(p.x, p.z, cand.x, cand.z) < minGap) {
        ok = false;
        break;
      }
    }
    if (ok) out.push({ x: cand.x, z: cand.z, taken: false });
  }
  return out;
}

export function createMissions(actors, world, rng, callbacks) {
  const cb = callbacks || {};
  const player = actors.player;
  const group = world.group;

  function say(speaker, text) {
    if (typeof cb.onDialogue === 'function') cb.onDialogue(speaker, text);
  }

  function actorPos() {
    if (player.car) return player.car.mesh.position;
    return player.pos;
  }

  // ---------- rival cars (missions 6 and 9) ----------
  const rivals = [];
  const RIVAL_COLOR = 0x9b30ff;

  function spawnRival(nearX, nearZ) {
    const spot = pointNear(world, rng, nearX, nearZ);
    const mesh = makeCar(RIVAL_COLOR, { spoiler: true });
    mesh.position.set(spot.x, 0, spot.z);
    group.add(mesh);
    const vehicle = createVehicle(mesh, { hp: 100 });
    vehicle.heading = rng() * Math.PI * 2;
    const rival = { vehicle, ramCooldown: 0, wrecked: false };
    rivals.push(rival);
    return rival;
  }

  function clearRivals() {
    for (const r of rivals) group.remove(r.vehicle.mesh);
    rivals.length = 0;
  }

  // Chase the player and take damage from hard rams by the player's car.
  function updateRivals(dt) {
    const p = actorPos();
    const playerSpeed = player.car ? Math.abs(player.car.speed) : 0;
    for (const r of rivals) {
      if (r.wrecked) continue;
      const v = r.vehicle;
      const m = v.mesh.position;
      r.ramCooldown = Math.max(0, r.ramCooldown - dt);
      if (v.isWrecked()) {
        r.wrecked = true;
        continue;
      }
      // Steer toward the player and keep the throttle down.
      const want = Math.atan2(p.x - m.x, p.z - m.z);
      let diff = want - v.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff <= -Math.PI) diff += Math.PI * 2;
      const steer = -clamp(diff * 1.4, -1, 1);
      v.update(dt, { throttle: 0.85, steer, brake: false }, world);
      // A fast ram dents the rival; the player's own car takes a little too.
      const d = dist2D(p.x, p.z, m.x, m.z);
      if (player.car && d < 4.5 && playerSpeed > 8 && r.ramCooldown <= 0) {
        v.damage(30);
        player.car.damage(4);
        r.ramCooldown = 0.8;
        if (v.isWrecked()) r.wrecked = true;
      }
    }
  }

  function aliveRivals() {
    return rivals.filter((r) => !r.wrecked);
  }

  // ---------- Lena, the escort (mission 7) ----------
  let lena = null;
  function spawnLena(x, z) {
    const mesh = makePedestrian(0xff8fc0);
    mesh.position.set(x, 0, z);
    group.add(mesh);
    lena = { mesh, following: false };
    return lena;
  }
  function clearLena() {
    if (lena) {
      group.remove(lena.mesh);
      lena = null;
    }
  }

  // ---------- mission definitions ----------
  // Each mission is built fresh when it starts: stages are plain objects the
  // update loop walks through in order. Stage kinds: goto, collect, lose,
  // race, wreck, escort, hold, escape.
  function buildMission(index) {
    const downtown = DISTRICTS[0].centre;
    const beach = DISTRICTS[1].centre;
    const docks = DISTRICTS[2].centre;
    const hills = DISTRICTS[3].centre;
    switch (index) {
      case 0: {
        const pickup = pointNear(world, rng, docks.x, docks.z);
        const drop = pointNear(world, rng, downtown.x, downtown.z);
        return {
          title: MISSION_TITLES[0],
          giver: 'Vic',
          briefing: 'Rex. A package is sitting in the Docks and the buyer is waiting Downtown. Don\'t scratch the paint.',
          reward: 300,
          respect: 10,
          stages: [
            { kind: 'goto', target: pickup, label: 'Pick up the package in the Docks' },
            { kind: 'goto', target: drop, label: 'Deliver the package Downtown' },
          ],
        };
      }
      case 1: {
        const garage = pointNear(world, rng, downtown.x, downtown.z);
        return {
          title: MISSION_TITLES[1],
          giver: 'Vic',
          briefing: 'There is a sports car parked near the garage with no owner in sight. Bring it to me and I will make it worth your while.',
          reward: 450,
          respect: 10,
          stages: [
            { kind: 'steal', label: 'Steal the parked sports car' },
            { kind: 'goto', target: garage, label: 'Deliver the car to Vic\'s garage' },
          ],
        };
      }
      case 2: {
        const drops = spreadPoints(world, rng, 5, 80);
        return {
          title: MISSION_TITLES[2],
          giver: 'Lena',
          briefing: 'Cash drops all over the city, Rex. Five of them. Grab them before someone else does.',
          reward: 500,
          respect: 10,
          stages: [{ kind: 'collect', drops, label: 'Collect the cash drops' }],
        };
      }
      case 3: {
        return {
          title: MISSION_TITLES[3],
          giver: 'Lena',
          briefing: 'You have two stars and a tail. Lose them — no shortcuts, no witnesses.',
          reward: 400,
          respect: 15,
          stages: [{ kind: 'lose', timer: 60, label: 'Lose the police' }],
        };
      }
      case 4: {
        const gates = [];
        for (let i = 0; i < 4; i += 1) gates.push(world.randomRoadPoint(rng));
        return {
          title: MISSION_TITLES[4],
          giver: 'Lena',
          briefing: 'Bridge Sprint. Four gates, ninety seconds. Show this city how fast you really are.',
          reward: 600,
          respect: 15,
          stages: [{ kind: 'race', gates, gateIndex: 0, timer: 90, label: 'Race through the gates' }],
        };
      }
      case 5: {
        return {
          title: MISSION_TITLES[5],
          giver: 'Vic',
          briefing: 'A rival crew is rolling through my streets, Rex. Put their cars in the scrapyard.',
          reward: 700,
          respect: 15,
          stages: [{ kind: 'wreck', total: 3, spawned: false, label: 'Wreck the rival cars' }],
        };
      }
      case 6: {
        const spot = pointNear(world, rng, docks.x, docks.z);
        const home = pointNear(world, rng, downtown.x, downtown.z);
        return {
          title: MISSION_TITLES[6],
          giver: 'Lena',
          briefing: 'I am pinned down in the Docks, Rex. Come get me, and get me home.',
          reward: 800,
          respect: 15,
          stages: [
            { kind: 'escort', lenaSpot: spot, home, label: 'Reach Lena in the Docks' },
          ],
        };
      }
      case 7: {
        const bank = pointNear(world, rng, downtown.x, downtown.z);
        const safe = pointNear(world, rng, hills.x, hills.z);
        return {
          title: MISSION_TITLES[7],
          giver: 'Vic',
          briefing: 'The bank job is on. Get in, hold the floor, and do not get cute.',
          reward: 1200,
          respect: 20,
          stages: [
            { kind: 'goto', target: bank, label: 'Reach the bank Downtown' },
            { kind: 'hold', target: bank, holdTime: 10, held: 0, label: 'Hold the bank' },
            { kind: 'escape', target: safe, stars: 3, armed: false, label: 'Escape to the Hills safehouse' },
          ],
        };
      }
      case 8: {
        const block = pointNear(world, rng, downtown.x, downtown.z);
        return {
          title: MISSION_TITLES[8],
          giver: 'Lena',
          briefing: 'They are hitting our block in Downtown. Hold the turf, Rex. All four waves.',
          reward: 900,
          respect: 20,
          stages: [{ kind: 'waves', total: 4, wave: 0, spawned: false, target: block, label: 'Defend the block' }],
        };
      }
      default: {
        const crew = pointNear(world, rng, downtown.x, downtown.z);
        const t1 = pointNear(world, rng, docks.x, docks.z);
        const t2 = pointNear(world, rng, beach.x, beach.z);
        const t3 = pointNear(world, rng, downtown.x, downtown.z);
        const safe = pointNear(world, rng, hills.x, hills.z);
        return {
          title: MISSION_TITLES[9],
          giver: 'Vic',
          briefing: 'This is the big one, Rex. Crew, three targets, then vanish into the Hills. We retire after this.',
          reward: 2000,
          respect: 25,
          stages: [
            { kind: 'goto', target: crew, label: 'Pick up the crew Downtown' },
            { kind: 'goto', target: t1, label: 'Hit the first target in the Docks' },
            { kind: 'goto', target: t2, label: 'Hit the second target at Beachfront' },
            { kind: 'goto', target: t3, label: 'Hit the third target Downtown' },
            { kind: 'escape', target: safe, stars: 4, armed: false, label: 'Escape to the Hills safehouse' },
          ],
        };
      }
    }
  }

  // ---------- state ----------
  let index = -1;
  let current = null;
  let stageIndex = 0;
  let stealTarget = null;

  function stage() {
    if (!current) return null;
    return current.stages[stageIndex];
  }

  function startNext() {
    clearRivals();
    clearLena();
    stealTarget = null;
    index += 1;
    if (index >= TUNING.missions.count) {
      current = null;
      say('Lena', 'That is every job in the book, Rex. Neon Bay is yours now.');
      return;
    }
    current = buildMission(index);
    stageIndex = 0;
    const first = stage();
    if (first && first.kind === 'lose') actors.setWanted(2);
    if (typeof cb.onMissionStart === 'function') cb.onMissionStart(current);
    say(current.giver, current.briefing);
  }

  function advanceStage() {
    stageIndex += 1;
    if (stageIndex >= current.stages.length) {
      const done = current;
      player.money += done.reward;
      player.respect += done.respect;
      if (typeof cb.onMissionComplete === 'function') cb.onMissionComplete(done, done.reward);
      startNext();
    }
  }

  function nearestDrop(drops) {
    const p = actorPos();
    let best = null;
    let bestD = Infinity;
    for (const d of drops) {
      if (d.taken) continue;
      const dist = dist2D(p.x, p.z, d.x, d.z);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best;
  }

  function update(dt) {
    if (!current) return;
    const s = stage();
    if (!s) return;
    const p = actorPos();
    const reach = TUNING.missions.markerRadius;

    switch (s.kind) {
      case 'goto': {
        if (dist2D(p.x, p.z, s.target.x, s.target.z) < reach) advanceStage();
        break;
      }
      case 'steal': {
        // Find a parked car the player is now driving.
        if (player.car && actors.parkedCars.includes(player.car)) {
          stealTarget = player.car;
          advanceStage();
          break;
        }
        // Point at the closest drivable parked car.
        break;
      }
      case 'collect': {
        for (const d of s.drops) {
          if (!d.taken && dist2D(p.x, p.z, d.x, d.z) < TUNING.missions.pickupRadius) {
            d.taken = true;
            player.money += TUNING.economy.cashDropValue;
          }
        }
        if (s.drops.every((d) => d.taken)) advanceStage();
        break;
      }
      case 'lose': {
        s.timer -= dt;
        if (actors.wanted.stars === 0) {
          advanceStage();
        } else if (s.timer <= 0) {
          s.timer = 60;
          say('Lena', 'They are still on you — break line of sight and stay out of view.');
        }
        break;
      }
      case 'race': {
        s.timer -= dt;
        const gate = s.gates[s.gateIndex];
        if (gate && dist2D(p.x, p.z, gate.x, gate.z) < reach) {
          s.gateIndex += 1;
          if (s.gateIndex >= s.gates.length) advanceStage();
        } else if (s.timer <= 0) {
          s.gateIndex = 0;
          s.timer = 90;
          say('Lena', 'Too slow. Back to the start — run it again.');
        }
        break;
      }
      case 'wreck': {
        if (!s.spawned) {
          for (let i = 0; i < s.total; i += 1) {
            spawnRival(p.x + (rng() - 0.5) * 60, p.z + (rng() - 0.5) * 60);
          }
          s.spawned = true;
        }
        updateRivals(dt);
        if (rivals.length > 0 && rivals.every((r) => r.wrecked)) advanceStage();
        break;
      }
      case 'escort': {
        if (!lena) {
          spawnLena(s.lenaSpot.x, s.lenaSpot.z);
        }
        if (!lena.following) {
          if (dist2D(p.x, p.z, s.lenaSpot.x, s.lenaSpot.z) < reach) {
            lena.following = true;
            s.label = 'Escort Lena back Downtown';
            say('Lena', 'You came. Okay — lead the way, and keep it smooth.');
          }
        } else {
          // Lena trails a few steps behind the player. If the player drives
          // off in a car she hops in and rides along instead of being left
          // behind on foot, where she could never keep up.
          const lp = lena.mesh.position;
          if (player.car && dist2D(lp.x, lp.z, p.x, p.z) > 12) {
            lp.set(p.x, 0, p.z);
          }
          const tx = p.x - Math.sin(player.heading) * 3;
          const tz = p.z - Math.cos(player.heading) * 3;
          const dx = tx - lp.x;
          const dz = tz - lp.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d > 0.5) {
            const speed = Math.min(9, d * 2);
            lp.x += (dx / d) * speed * dt;
            lp.z += (dz / d) * speed * dt;
            lena.mesh.rotation.y = Math.atan2(dx, dz);
          }
          if (dist2D(p.x, p.z, s.home.x, s.home.z) < reach
            && dist2D(lp.x, lp.z, s.home.x, s.home.z) < reach + 8) {
            advanceStage();
          }
        }
        break;
      }
      case 'hold': {
        if (dist2D(p.x, p.z, s.target.x, s.target.z) < reach) {
          s.held += dt;
          if (s.held >= s.holdTime) advanceStage();
        } else {
          s.held = Math.max(0, s.held - dt * 2);
        }
        break;
      }
      case 'escape': {
        if (!s.armed) {
          actors.setWanted(s.stars);
          s.armed = true;
        }
        if (dist2D(p.x, p.z, s.target.x, s.target.z) < reach) advanceStage();
        break;
      }
      case 'waves': {
        if (!s.spawned) {
          s.wave += 1;
          for (let i = 0; i < 2; i += 1) {
            spawnRival(s.target.x + (rng() - 0.5) * 50, s.target.z + (rng() - 0.5) * 50);
          }
          s.spawned = true;
          say('Lena', `Wave ${s.wave} of ${s.total} — incoming.`);
        }
        updateRivals(dt);
        if (rivals.length > 0 && rivals.every((r) => r.wrecked)) {
          clearRivals();
          if (s.wave >= s.total) {
            advanceStage();
          } else {
            s.spawned = false;
          }
        }
        break;
      }
      default:
        break;
    }
  }

  function currentMarker() {
    if (!current) return null;
    const s = stage();
    if (!s) return null;
    switch (s.kind) {
      case 'goto':
      case 'hold':
      case 'escape':
        return { x: s.target.x, z: s.target.z };
      case 'steal': {
        // Nearest parked car the player could take.
        let best = null;
        let bestD = Infinity;
        const p = actorPos();
        for (const v of actors.parkedCars) {
          if (v.isWrecked()) continue;
          const d = dist2D(p.x, p.z, v.mesh.position.x, v.mesh.position.z);
          if (d < bestD) {
            bestD = d;
            best = v;
          }
        }
        return best ? { x: best.mesh.position.x, z: best.mesh.position.z } : null;
      }
      case 'collect': {
        const next = nearestDrop(s.drops);
        return next ? { x: next.x, z: next.z } : null;
      }
      case 'race':
        return s.gates[s.gateIndex] ? { x: s.gates[s.gateIndex].x, z: s.gates[s.gateIndex].z } : null;
      case 'wreck':
      case 'waves': {
        const alive = aliveRivals();
        if (alive.length === 0) return null;
        const p = actorPos();
        let best = alive[0];
        let bestD = dist2D(p.x, p.z, best.vehicle.mesh.position.x, best.vehicle.mesh.position.z);
        for (const r of alive) {
          const d = dist2D(p.x, p.z, r.vehicle.mesh.position.x, r.vehicle.mesh.position.z);
          if (d < bestD) {
            bestD = d;
            best = r;
          }
        }
        return { x: best.vehicle.mesh.position.x, z: best.vehicle.mesh.position.z };
      }
      case 'escort':
        if (lena && lena.following) return { x: s.home.x, z: s.home.z };
        return { x: s.lenaSpot.x, z: s.lenaSpot.z };
      case 'lose':
        return null;
      default:
        return null;
    }
  }

  function objectiveText() {
    if (!current) return 'All missions complete — Neon Bay is yours.';
    const s = stage();
    if (!s) return current.title;
    const base = `${current.title}: ${s.label}`;
    switch (s.kind) {
      case 'collect': {
        const got = s.drops.filter((d) => d.taken).length;
        return `${base} (${got}/${s.drops.length})`;
      }
      case 'race':
        return `${base} — gate ${s.gateIndex + 1}/${s.gates.length}, ${Math.max(0, Math.ceil(s.timer))}s left`;
      case 'lose':
        return `${base} — ${Math.max(0, Math.ceil(s.timer))}s left`;
      case 'hold':
        return `${base} — ${Math.floor(s.held)}s / ${s.holdTime}s`;
      case 'wreck': {
        const wrecked = rivals.filter((r) => r.wrecked).length;
        return `${base} (${wrecked}/${s.total})`;
      }
      case 'waves': {
        const wrecked = rivals.filter((r) => r.wrecked).length;
        return `${base} — wave ${Math.max(1, s.wave)}/${s.total} (${wrecked}/2 wrecked)`;
      }
      default:
        return base;
    }
  }

  return {
    get current() {
      return current;
    },
    get index() {
      return index;
    },
    update,
    startNext,
    objectiveText,
    currentMarker,
  };
}
