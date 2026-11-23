// Neon Bay 3D — HUD: DOM overlay, 2D minimap, screens (title/pause/wasted/
// busted), weapon wheel, garage shop, dispatch board, dialogue.
import { WORLD, DISTRICTS, WEAPONS, UPGRADES, CREW, rankFor } from './config.js';
import { clamp } from './random.js';

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

export class HUD {
  constructor() {
    this.root = el('div', 'hud', document.body);
    // Top-left: wanted, money, respect, district.
    this.stars = el('div', 'stars', this.root);
    this.money = el('div', 'money', this.root);
    this.respect = el('div', 'respect', this.root);
    this.district = el('div', 'district', this.root);
    // Top-right: minimap + dispatch board.
    this.mapWrap = el('div', 'mapwrap', this.root);
    this.minimap = el('canvas', 'minimap', this.mapWrap);
    this.minimap.width = 200; this.minimap.height = 200;
    this.dispatch = el('div', 'dispatch', this.mapWrap);
    // Bottom-left: health, weapon, speed.
    this.health = el('div', 'health', this.root);
    this.healthBar = el('div', 'healthbar', this.health);
    this.weapon = el('div', 'weapon', this.root);
    this.speed = el('div', 'speed', this.root);
    // Bottom-center: objective + dialogue.
    this.objective = el('div', 'objective', this.root);
    this.dialogue = el('div', 'dialogue', this.root);
    // Center crosshair.
    this.crosshair = el('div', 'crosshair', this.root, '+');
    // Low-health vignette: a red edge glow that pulses when the player is
    // nearly down. Driven from update() by hp.
    this.vignette = el('div', 'vignette', document.body);
    this.vignette.style.opacity = '0';
    // Weapon wheel.
    this.wheel = el('div', 'wheel', document.body);
    this.wheelSlots = WEAPONS.map((w, i) => {
      const s = el('div', 'wheelslot', this.wheel, `<b>${w.key}</b> ${w.name}`);
      s.dataset.index = i;
      return s;
    });
    this.wheel.style.display = 'none';
    // Garage shop.
    this.garage = el('div', 'garage', document.body);
    this.garage.style.display = 'none';
    // Screens.
    this.screen = el('div', 'screen', document.body);
    this.dialogueTimer = 0;
    this.lastDialogue = '';
  }

  showDialogue(text, who) {
    if (!text) return;
    this.lastDialogue = (who ? `<b>${who}:</b> ` : '') + text;
    this.dialogue.innerHTML = this.lastDialogue;
    this.dialogue.style.opacity = '1';
    this.dialogueTimer = 5;
  }
  tickDialogue(dt) {
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.dialogue.style.opacity = '0.25';
    }
  }
  update(s) {
    // s: {wanted, money, respect, district, standing, hp, maxHp, weaponIndex,
    // ammo[], speedKmh, inCar, objective, objectiveDist, carHp, radio, station}
    const stars = '★'.repeat(s.wanted) + '☆'.repeat(Math.max(0, 5 - s.wanted));
    this.stars.textContent = stars;
    this.stars.style.color = s.wanted > 0 ? '#ffd76a' : '#888';
    this.money.textContent = `$${s.money.toLocaleString('en-US')}`;
    this.respect.textContent = `${rankFor(s.respect)} · ${s.respect} respect`;
    const d = s.district;
    this.district.textContent = `${d.name} · standing ${s.standing[d.name] || 0}`;
    this.district.style.color = d.color;
    const hpPct = Math.max(0, (s.hp / s.maxHp) * 100);
    this.healthBar.style.width = `${hpPct}%`;
    this.healthBar.style.background = hpPct > 50 ? '#4caf50' : hpPct > 25 ? '#ff9800' : '#f44336';
    const w = WEAPONS[s.weaponIndex];
    const ammo = s.ammo[s.weaponIndex];
    this.weapon.textContent = `${w.name} · ${ammo === Infinity ? '∞' : ammo}  ${s.inCar ? '' : ''}`;
    this.speed.textContent = s.inCar ? `${Math.round(s.speedKmh)} km/h${s.carHp !== undefined ? ` · car ${Math.max(0, Math.round(s.carHp))}%` : ''}` : 'On foot';
    this.objective.textContent = s.objective + (s.objectiveDist !== null && s.objectiveDist !== undefined ? ` — ${Math.round(s.objectiveDist)}m` : '');
    this.crosshair.style.display = s.inCar ? 'none' : 'block';
    // Low-health vignette: pulses red under 25 HP, fades out above it.
    const hpFrac = s.hp / s.maxHp;
    const pulse = 0.45 + 0.25 * Math.sin(performance.now() / 180);
    this.vignette.style.opacity = hpFrac < 0.25 ? String(pulse) : '0';
  }
  drawMinimap(s) {
    // s: {playerX, playerZ, playerHeading, cars:[{x,z,kind}], police:[{x,z}],
    // heli:{x,z}|null, mission:{x,z}|null, drops:[{x,z}], showDrops, peds}
    const c = this.minimap.getContext('2d');
    const W = 200, half = 340;
    const px = (x) => ((x + half) / (half * 2)) * W;
    const pz = (z) => ((z + half) / (half * 2)) * W;
    c.clearRect(0, 0, W, W);
    c.fillStyle = '#1d2733'; c.fillRect(0, 0, W, W);
    // Water: south + east + north.
    c.fillStyle = '#2e7f9e';
    c.fillRect(0, pz(330), W, W - pz(330));
    c.fillRect(px(330), 0, W - px(330), W);
    c.fillRect(0, 0, W, pz(-330));
    // Districts (faint tint).
    for (const d of DISTRICTS) {
      c.fillStyle = d.color + '22';
      c.fillRect(px(d.x0), pz(d.z0), px(d.x1) - px(d.x0), pz(d.z1) - pz(d.z0));
    }
    // District labels + north arrow, so the minimap reads at a glance.
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.font = 'bold 8px sans-serif';
    c.textAlign = 'center';
    for (const d of DISTRICTS) {
      c.fillText(d.name.toUpperCase(), (px(d.x0) + px(d.x1)) / 2, (pz(d.z0) + pz(d.z1)) / 2);
    }
    c.fillStyle = '#ffd76a';
    c.font = 'bold 10px sans-serif';
    c.fillText('N ↑', W / 2, 10);
    // Roads.
    c.strokeStyle = '#5a6270'; c.lineWidth = 3;
    for (const r of WORLD.roads) {
      c.beginPath(); c.moveTo(px(r), 0); c.lineTo(px(r), W); c.stroke();
      c.beginPath(); c.moveTo(0, pz(r)); c.lineTo(W, pz(r)); c.stroke();
    }
    // Cash drops (Lena's Spotter ability).
    if (s.showDrops) {
      c.fillStyle = '#2eff8a';
      for (const d of s.drops || []) { c.beginPath(); c.arc(px(d.x), pz(d.z), 2.5, 0, 7); c.fill(); }
    }
    // Mission marker.
    if (s.mission) {
      c.fillStyle = '#ffd76a';
      c.save();
      c.translate(px(s.mission.x), pz(s.mission.z));
      c.rotate(Math.PI / 4);
      c.fillRect(-4, -4, 8, 8);
      c.restore();
    }
    // Cars.
    for (const car of s.cars || []) {
      c.fillStyle = car.kind === 'police' ? '#3a86ff' : '#ffffff';
      c.beginPath(); c.arc(px(car.x), pz(car.z), car.kind === 'police' ? 3.5 : 2.5, 0, 7); c.fill();
    }
    // Heli.
    if (s.heli) {
      c.fillStyle = '#ffea00';
      c.beginPath(); c.arc(px(s.heli.x), pz(s.heli.z), 4, 0, 7); c.fill();
    }
    // Player arrow.
    c.save();
    c.translate(px(s.playerX), pz(s.playerZ));
    c.rotate(Math.PI / 2 + s.playerHeading);
    c.fillStyle = '#ff4f6a';
    c.beginPath(); c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(-4.5, 5); c.closePath(); c.fill();
    c.restore();
  }
  setDispatch(messages, units) {
    let html = `<div class="dispatch-title">BAY PD DISPATCH · ${units} unit${units === 1 ? '' : 's'} active</div>`;
    for (const m of messages) html += `<div class="dispatch-line">${m.text}</div>`;
    this.dispatch.innerHTML = html;
  }
  showWheel(current) {
    this.wheel.style.display = 'flex';
    this.wheelSlots.forEach((s, i) => s.classList.toggle('active', i === current));
  }
  hideWheel() { this.wheel.style.display = 'none'; }
  selectWheel(i) {
    this.wheelSlots.forEach((s, j) => s.classList.toggle('active', j === i));
  }
  // Garage shop overlay. onBuy(kind, level) / onRepair() / onClose() callbacks.
  showGarage(state, callbacks) {
    const g = this.garage;
    g.style.display = 'block';
    let html = `<h2>Vic's Garage</h2><p class="gmoney">Cash: $${state.money.toLocaleString('en-US')}</p>`;
    html += `<p>Car health: ${Math.round(state.carHp)}% — <button data-act="repair">${state.freeRepair ? 'Repair — FREE (Vic)' : 'Repair — $100'}</button></p>`;
    for (const kind of ['engine', 'armor']) {
      html += `<h3>${kind === 'engine' ? 'Engine' : 'Armor'}</h3>`;
      UPGRADES[kind].forEach((u, lvl) => {
        const owned = state.upgrades[kind] >= lvl;
        const next = state.upgrades[kind] + 1 === lvl;
        html += `<div class="grow"><span>${u.name}${kind === 'engine' ? ` — ${u.maxSpeed * 3.6 | 0} km/h` : ` — ${u.hp} HP`}</span> ` +
          (owned ? '<span class="owned">INSTALLED</span>' : next ? `<button data-act="buy" data-kind="${kind}" data-lvl="${lvl}">Buy $${u.cost}</button>` : `<span>$${u.cost}</span>`) + '</div>';
      });
    }
    html += '<h3>Paint</h3><div class="paintrow">';
    UPGRADES.paint.forEach((p, lvl) => {
      html += `<button data-act="paint" data-lvl="${lvl}" style="background:#${p.color.toString(16).padStart(6, '0')}">${p.name} $${p.cost}</button>`;
    });
    html += `</div><p class="gclose"><button data-act="close">Close [G]</button></p>`;
    g.innerHTML = html;
    g.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'close') callbacks.onClose();
        else if (act === 'repair') callbacks.onRepair();
        else if (act === 'buy') callbacks.onBuy(b.dataset.kind, Number(b.dataset.lvl));
        else if (act === 'paint') callbacks.onPaint(Number(b.dataset.lvl));
      });
    });
  }
  hideGarage() { this.garage.style.display = 'none'; }
  // Full-screen overlays. kind: title|paused|wasted|busted. onStart/onResume/onRestart.
  showScreen(kind, data, callbacks) {
    const s = this.screen;
    s.style.display = 'flex';
    if (kind === 'title') {
      s.innerHTML = `<div class="panel"><h1>NEON BAY <span>3D</span></h1>
        <p class="tag">An original open-world crime game in the spirit of GTA 6.</p>
        <p class="story">Rex Marlowe came back to Neon Bay for one quiet summer. Instead the Tide crew
        took the streets, the Bay PD put a price on his head, and Vic's garage needs a driver who
        doesn't ask questions. Ten jobs. Four districts. One city that never sleeps.</p>
        <p class="controls">WASD move / drive · Mouse drag: camera · E: enter / steal car · Click: punch / shoot ·
        1-4 / Q: weapons · Tab: weapon wheel · R: radio · G: garage (near Vic's) · M: next mission · P: pause</p>
        <p class="stats">${data.save ? `Save found: $${data.save.money} · ${data.save.missionIndex}/10 jobs done · ${data.save.respect} respect` : 'No save yet — a new story begins.'}</p>
        <div class="buttons"><button id="btn-start">${data.save ? 'CONTINUE' : 'START'}</button>
        ${data.save ? '<button id="btn-new">NEW GAME</button>' : ''}</div>
        <p class="foot">Original city, characters and story. No Rockstar / GTA content.</p></div>`;
      document.getElementById('btn-start').addEventListener('click', () => callbacks.onStart(false));
      const nb = document.getElementById('btn-new');
      if (nb) nb.addEventListener('click', () => callbacks.onStart(true));
    } else if (kind === 'paused') {
      s.innerHTML = `<div class="panel"><h1>PAUSED</h1><p class="story">Neon Bay waits for no one. Well — except now.</p>
        <div class="buttons"><button id="btn-resume">RESUME</button><button id="btn-quit">QUIT TO TITLE</button></div></div>`;
      document.getElementById('btn-resume').addEventListener('click', callbacks.onResume);
      document.getElementById('btn-quit').addEventListener('click', callbacks.onQuit);
    } else if (kind === 'wasted' || kind === 'busted') {
      const title = kind === 'wasted' ? 'WASTED' : 'BUSTED';
      s.innerHTML = `<div class="panel"><h1>${title}</h1>
        <p class="story">${kind === 'wasted' ? 'Rex went down in the streets of Neon Bay.' : 'The Bay PD finally put the cuffs on Rex.'}</p>
        <p class="stats">Money kept: $${data.money} · Jobs done: ${data.missionIndex}/10</p>
        <div class="buttons"><button id="btn-restart">TRY AGAIN</button></div></div>`;
      document.getElementById('btn-restart').addEventListener('click', callbacks.onRestart);
    }
  }
  hideScreen() { this.screen.style.display = 'none'; }
}
