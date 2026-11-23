// The on-screen HUD for Neon Bay 3D: cash, respect, wanted stars, health,
// speed, current weapon, objective line, dialogue box, weapon wheel, end
// screen, and a live minimap that plots the whole 600x600 city.
// Exports: createHud.

import { DISTRICTS } from './config.js';

const CITY_HALF = 300;
const MAP_SIZE = 168;

export function createHud() {
  const moneyEl = document.getElementById('hud-money');
  const respectEl = document.getElementById('hud-respect');
  const starsEl = document.getElementById('hud-stars');
  const hpFill = document.getElementById('hud-hp-fill');
  const speedEl = document.getElementById('hud-speed');
  const weaponEl = document.getElementById('hud-weapon');
  const objectiveEl = document.getElementById('objective');
  const dialogueEl = document.getElementById('dialogue');
  const wheelEl = document.getElementById('wheel');
  const wheelSpans = Array.from(wheelEl.querySelectorAll('span[data-w]'));
  const endScreen = document.getElementById('end-screen');
  const endTitle = document.getElementById('end-title');
  const endSub = document.getElementById('end-sub');
  const mapCanvas = document.getElementById('minimap');
  const mapCtx = mapCanvas.getContext('2d');

  function toMap(x, z) {
    return {
      px: ((x + CITY_HALF) / (CITY_HALF * 2)) * MAP_SIZE,
      py: ((z + CITY_HALF) / (CITY_HALF * 2)) * MAP_SIZE,
    };
  }

  function drawMinimap(state) {
    const ctx = mapCtx;
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.fillStyle = 'rgba(12, 10, 28, 0.9)';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Road grid: one line every 60 world units.
    ctx.strokeStyle = 'rgba(160, 160, 190, 0.45)';
    ctx.lineWidth = 1;
    for (let line = -CITY_HALF; line <= CITY_HALF; line += 60) {
      const a = toMap(line, -CITY_HALF);
      const b = toMap(line, CITY_HALF);
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();
      const c = toMap(-CITY_HALF, line);
      const d = toMap(CITY_HALF, line);
      ctx.beginPath();
      ctx.moveTo(c.px, c.py);
      ctx.lineTo(d.px, d.py);
      ctx.stroke();
    }

    // District accents: a soft dot at each district centre.
    for (const district of DISTRICTS) {
      const at = toMap(district.centre.x, district.centre.z);
      ctx.fillStyle = `#${district.accent.toString(16).padStart(6, '0')}`;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(at.px, at.py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Mission marker: a yellow diamond.
    if (state.marker) {
      const at = toMap(state.marker.x, state.marker.z);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(at.px, at.py - 6);
      ctx.lineTo(at.px + 6, at.py);
      ctx.lineTo(at.px, at.py + 6);
      ctx.lineTo(at.px - 6, at.py);
      ctx.closePath();
      ctx.fill();
    }

    // Police cruisers: red dots.
    if (state.police) {
      ctx.fillStyle = '#ff4d6d';
      for (const cop of state.police) {
        const at = toMap(cop.x, cop.z);
        ctx.beginPath();
        ctx.arc(at.px, at.py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Helicopter: a blue dot.
    if (state.helicopter) {
      const at = toMap(state.helicopter.x, state.helicopter.z);
      ctx.fillStyle = '#2ec8ff';
      ctx.beginPath();
      ctx.arc(at.px, at.py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // The player: a white triangle pointing along the heading.
    const at = toMap(state.playerX, state.playerZ);
    const fx = Math.sin(state.playerHeading);
    const fz = Math.cos(state.playerHeading);
    const tipX = at.px + fx * 7;
    const tipY = at.py + fz * 7;
    const leftX = at.px + (-fz) * 5 - fx * 4;
    const leftY = at.py + fx * 5 - fz * 4;
    const rightX = at.px + fz * 5 - fx * 4;
    const rightY = at.py - fx * 5 - fz * 4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.fill();

    // District name and a night tint.
    if (state.districtName) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(state.districtName, 6, 14);
    }
    if (typeof state.timeOfDay === 'number' && state.timeOfDay > 0.55) {
      ctx.fillStyle = `rgba(8, 6, 30, ${(state.timeOfDay - 0.55) * 0.5})`;
      ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    }
  }

  function update(state) {
    if (moneyEl) moneyEl.textContent = `$${Math.round(state.money).toLocaleString('en-US')}`;
    if (respectEl) respectEl.textContent = `Respect ${state.respect}`;
    if (starsEl) {
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += i < state.stars ? '★' : '☆';
      starsEl.textContent = stars;
    }
    if (hpFill) {
      const ratio = Math.max(0, Math.min(1, state.hp / state.maxHp));
      hpFill.style.width = `${Math.round(ratio * 100)}%`;
    }
    if (speedEl) speedEl.textContent = `${Math.round(state.speedKmh)} km/h`;
    if (weaponEl) {
      const ammo = state.ammo === Infinity ? '∞' : state.ammo;
      weaponEl.textContent = `${state.weaponName} · ${ammo}`;
    }
    if (objectiveEl && state.objective !== undefined) objectiveEl.textContent = state.objective;
    drawMinimap(state);
  }

  function showDialogue(speaker, text) {
    dialogueEl.textContent = `${speaker}: ${text}`;
    dialogueEl.style.display = 'block';
  }

  function hideDialogue() {
    dialogueEl.style.display = 'none';
  }

  function showWheel(index) {
    for (const span of wheelSpans) {
      span.classList.toggle('on', Number(span.dataset.w) === index);
    }
    wheelEl.style.display = 'flex';
  }

  function hideWheel() {
    wheelEl.style.display = 'none';
  }

  function setObjective(text) {
    objectiveEl.textContent = text;
  }

  function setEnd(title, sub) {
    endTitle.textContent = title;
    endSub.textContent = sub || '';
    endScreen.style.display = 'flex';
  }

  return {
    update,
    showDialogue,
    hideDialogue,
    showWheel,
    hideWheel,
    setObjective,
    setEnd,
  };
}
