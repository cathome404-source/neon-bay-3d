// Neon Bay 3D — the mission engine: 10 story missions, step state machine,
// cash drops, race gates, turf claims, rewards, district standing.
import { MISSIONS } from './config.js';
import { makeCashDrop } from './models.js';
import { dist2 } from './random.js';

const T = window.THREE;

export class MissionManager {
  constructor(scene, beacon) {
    this.scene = scene;
    this.beacon = beacon;
    this.index = 0;          // current mission
    this.stepIndex = 0;
    this.active = false;
    this.timer = 0;          // race timer / channel timer
    this.channel = 0;        // seconds stood in a claim/pickup marker
    this.collected = 0;
    this.drops = [];         // {mesh, x, z, taken}
    this.gates = [];         // race gate meshes
    this.gateIndex = 0;
    this.takedownTarget = 0;
    this.ambientTimer = 40;
    this.ambientDrops = [];
    this.events = [];        // {type, text} for the HUD/dialogue
  }
  current() { return MISSIONS[this.index] || null; }
  currentStep() {
    const m = this.current();
    return m ? m.steps[this.stepIndex] : null;
  }
  say(text, who) { this.events.push({ type: 'dialogue', text, who: who || '' }); }
  takeEvents() { const e = this.events; this.events = []; return e; }

  start(index, ctx) {
    this.index = index;
    this.stepIndex = 0;
    const m = this.current();
    if (!m) { this.active = false; return; }
    this.active = true;
    this.say(m.intro, m.giver);
    this.beginStep(ctx);
  }
  beginStep(ctx) {
    const step = this.currentStep();
    this.timer = 0; this.channel = 0; this.collected = 0;
    this.clearDrops(); this.clearGates();
    if (!step) return;
    if (step.type === 'collect' && step.spots) {
      for (const [x, z] of step.spots) this.addDrop(x, z, false);
    }
    if (step.type === 'takedown') {
      ctx.rivals.spawnAt(step.x, step.z, step.count);
      this.takedownTarget = step.count;
    }
    if (step.type === 'race' && step.gates) {
      this.timer = step.time;
      this.gateIndex = 0;
      for (const [x, z] of step.gates) {
        const gate = new T.Mesh(
          new T.TorusGeometry(5, 0.5, 8, 32),
          new T.MeshBasicMaterial({ color: 0x2eff8a }),
        );
        gate.rotation.x = Math.PI / 2;
        gate.position.set(x, 3, z);
        this.scene.add(gate);
        this.gates.push(gate);
      }
    }
    if (step.type === 'heat' && step.wanted) {
      ctx.police.setWanted(step.wanted, 'mission heat');
    }
    this.updateBeacon(ctx);
  }
  addDrop(x, z, ambient) {
    const mesh = makeCashDrop();
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const drop = { mesh, x, z, taken: false, ambient: !!ambient };
    if (ambient) this.ambientDrops.push(drop);
    else this.drops.push(drop);
    return drop;
  }
  clearDrops() {
    for (const d of this.drops) this.scene.remove(d.mesh);
    this.drops = [];
  }
  clearGates() {
    for (const g of this.gates) this.scene.remove(g);
    this.gates = [];
  }
  updateBeacon(ctx) {
    const step = this.currentStep();
    if (!step || !this.active) { this.beacon.visible = false; return; }
    let pos = null;
    if (step.x !== undefined) pos = { x: step.x, z: step.z };
    else if (step.type === 'collect' && this.drops.length) {
      const d = this.drops.find((dd) => !dd.taken);
      if (d) pos = { x: d.x, z: d.z };
    } else if (step.type === 'race' && this.gates[this.gateIndex]) {
      pos = { x: this.gates[this.gateIndex].position.x, z: this.gates[this.gateIndex].position.z };
    }
    if (pos) {
      this.beacon.visible = true;
      this.beacon.position.set(pos.x, 0, pos.z);
    } else this.beacon.visible = false;
  }
  completeStep(ctx) {
    const m = this.current();
    this.stepIndex += 1;
    if (this.stepIndex >= m.steps.length) {
      // Mission complete.
      ctx.player.money += m.reward;
      ctx.player.respect += m.respect;
      const d = ctx.world.districtAt(ctx.player.x, ctx.player.z);
      ctx.standing[d.name] = Math.min(100, (ctx.standing[d.name] || 0) + 10);
      this.say(`${m.done} (+$${m.reward})`, m.giver);
      this.events.push({ type: 'mission-complete', title: m.title, reward: m.reward });
      ctx.audio.jingle();
      this.active = false;
      this.beacon.visible = false;
      ctx.rivals.clear();
      this.index += 1;
      if (this.index < MISSIONS.length) {
        this.events.push({ type: 'mission-available', title: MISSIONS[this.index].title });
      } else {
        this.events.push({ type: 'story-complete' });
      }
      ctx.save();
      return;
    }
    this.beginStep(ctx);
    const step = this.currentStep();
    this.say(step.label, '');
  }
  failStep(ctx, reason) {
    this.say(`${reason} — mission failed. Try again.`, 'Vic');
    ctx.audio.fail();
    this.events.push({ type: 'mission-failed' });
    this.stepIndex = 0;
    this.beginStep(ctx);
  }
  // Called every frame while playing. ctx: {player, playerCar, police, rivals,
  // world, audio, fx, save, standing}
  update(dt, ctx) {
    this.rivalsAlive = ctx.rivals.aliveCount();
    // Ambient cash drops: one spawns every ~45s, max 3, worth $50.
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 45;
      if (this.ambientDrops.length < 3) {
        const spots = [[35, 105], [-105, -35], [175, 175], [-175, 35], [105, -175], [-35, -105]];
        const s = spots[Math.floor(Math.random() * spots.length)];
        this.addDrop(s[0], s[1], true);
      }
    }
    // Spin cash drops.
    for (const d of [...this.drops, ...this.ambientDrops]) {
      if (d.taken) continue;
      d.mesh.rotation.y += dt * 2;
      d.mesh.position.y = Math.sin(performance.now() / 300 + d.x) * 0.2 + 0.2;
      const px = ctx.player.x, pz = ctx.player.z;
      if (dist2(px, pz, d.x, d.z) < 3.5) {
        d.taken = true;
        this.scene.remove(d.mesh);
        if (d.ambient) {
          ctx.player.money += 50;
          ctx.audio.pickup();
          this.events.push({ type: 'pickup-cash', amount: 50 });
          this.ambientDrops = this.ambientDrops.filter((x) => x !== d);
        } else {
          this.collected += 1;
          ctx.audio.pickup();
          this.updateBeacon(ctx);
          if (this.collected >= this.currentStep().count) this.completeStep(ctx);
        }
      }
    }
    if (!this.active) return;
    const step = this.currentStep();
    if (!step) return;
    const p = ctx.player;
    const target = ctx.playerCar || p;
    switch (step.type) {
      case 'goto':
      case 'deliver': {
        if (dist2(target.x, target.z, step.x, step.z) < 9) {
          if (step.type === 'deliver' && this.index === 6 && ctx.playerCar) {
            // Rescue Lena: passenger delivered.
          }
          this.completeStep(ctx);
        }
        break;
      }
      case 'pickup': {
        // 8m radius so a car parked next to the marker still counts —
        // the player is usually in a vehicle for pickups.
        if (dist2(p.x, p.z, step.x, step.z) < 8) {
          this.channel += dt;
          if (this.channel > 0.8) this.completeStep(ctx);
        } else this.channel = 0;
        break;
      }
      case 'claim': {
        if (dist2(p.x, p.z, step.x, step.z) < 7) {
          this.channel += dt;
          if (this.channel > 3) {
            ctx.standing[step.district] = Math.min(100, (ctx.standing[step.district] || 0) + 25);
            this.say(`${step.district} is ours now.`, 'Lena');
            this.completeStep(ctx);
          }
        } else this.channel = 0;
        break;
      }
      case 'collect': break; // handled by drop pickup above
      case 'race': {
        this.timer -= dt;
        const gate = this.gates[this.gateIndex];
        if (gate && dist2(target.x, target.z, gate.position.x, gate.position.z) < 9) {
          this.scene.remove(gate);
          this.gateIndex += 1;
          ctx.audio.pickup();
          if (this.gateIndex >= this.gates.length) { this.completeStep(ctx); break; }
          this.updateBeacon(ctx);
        }
        if (this.timer <= 0) this.failStep(ctx, 'Out of time');
        break;
      }
      case 'takedown': {
        if (ctx.rivals.aliveCount() === 0) this.completeStep(ctx);
        break;
      }
      case 'loseheat': {
        if (ctx.police.wanted === 0) this.completeStep(ctx);
        break;
      }
      case 'steal': {
        if (ctx.playerCar && ctx.playerCar.stolen) {
          // Must be a sports car for Hot Wheels.
          if (ctx.playerCar.kind === 'sports' || this.index !== 1) this.completeStep(ctx);
          else this.say('That is not a Comet GT. Find a sports car.', 'Vic');
        }
        break;
      }
      case 'heat': {
        if (ctx.police.wanted >= step.wanted) this.completeStep(ctx);
        break;
      }
      default: break;
    }
    // Race gate pulse.
    const gate = this.gates[this.gateIndex];
    if (gate) gate.scale.setScalar(1 + Math.sin(performance.now() / 200) * 0.1);
  }
  // HUD-facing info.
  objectiveText() {
    if (!this.active) {
      if (this.index >= MISSIONS.length) return 'Story complete — free roam. Press M for the next job board.';
      return `Press M to start: ${MISSIONS[this.index].title}`;
    }
    const m = this.current();
    const step = this.currentStep();
    let label = step ? step.label : '';
    if (step && step.type === 'collect') label += ` (${this.collected}/${step.count})`;
    if (step && step.type === 'takedown') label += ` (${this.takedownTarget - (this.rivalsAlive || 0)}/${step.count})`;
    if (step && step.type === 'race') label += ` — ${Math.max(0, Math.ceil(this.timer))}s`;
    if (step && step.type === 'claim') label += ` — hold ${Math.max(0, (3 - this.channel)).toFixed(0)}s`;
    return `${m.title}: ${label}`;
  }
  targetPos() {
    const step = this.currentStep();
    if (!step || !this.active) return null;
    if (step.x !== undefined) return { x: step.x, z: step.z };
    if (step.type === 'collect') {
      const d = this.drops.find((dd) => !dd.taken);
      return d ? { x: d.x, z: d.z } : null;
    }
    if (step.type === 'race') {
      const g = this.gates[this.gateIndex];
      return g ? { x: g.position.x, z: g.position.z } : null;
    }
    return null;
  }
}
