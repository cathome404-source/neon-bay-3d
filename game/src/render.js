// The 3D renderer for Neon Bay 3D: lighting that slides from dusk into night,
// a chase camera that aims ahead of the player so chases stay in frame,
// car headlights, soft shadows, and the named framings used for screenshots.
// Exports: createRenderer.

import { TUNING, DISTRICTS } from './config.js';

function clamp(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(a, b, t) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return (r << 16) | (g << 8) | bl;
}

export function createRenderer(canvas, world) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1840);
  scene.fog = new THREE.Fog(0x2a1840, 80, 420);

  const camera = new THREE.PerspectiveCamera(
    62, window.innerWidth / window.innerHeight, 0.1, 900,
  );
  camera.position.set(0, 26, 60);
  camera.lookAt(0, 0, 0);

  const hemi = new THREE.HemisphereLight(0xffc890, 0x241a3a, 0.7);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x8a7fd0, 0.4);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffb36b, 1.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(sun.target);

  // Two headlight beams that follow the player's car once night falls.
  const headA = new THREE.SpotLight(0xffe9b0, 0, 60, 0.5, 0.5, 1.2);
  const headB = new THREE.SpotLight(0xffe9b0, 0, 60, 0.5, 0.5, 1.2);
  const headTargetA = new THREE.Object3D();
  const headTargetB = new THREE.Object3D();
  headA.target = headTargetA;
  headB.target = headTargetB;
  scene.add(headA);
  scene.add(headB);
  scene.add(headTargetA);
  scene.add(headTargetB);

  // Red edge glow shown while the player's health is low.
  const vignette = document.createElement('div');
  vignette.style.position = 'fixed';
  vignette.style.inset = '0';
  vignette.style.pointerEvents = 'none';
  vignette.style.zIndex = '4';
  vignette.style.background = 'radial-gradient(ellipse at center, transparent 55%, rgba(255, 20, 60, 0.55) 100%)';
  vignette.style.opacity = '0';
  vignette.style.transition = 'opacity 0.25s';
  document.body.appendChild(vignette);

  let shot = null;
  let menuAngle = 0;
  let fov = 62;
  const camPos = new THREE.Vector3(0, 26, 60);
  const camLook = new THREE.Vector3(0, 0, 0);

  function duskAmount(timeOfDay) {
    return clamp((timeOfDay - TUNING.world.duskStart) / (1 - TUNING.world.duskStart), 0, 1);
  }

  function updateLighting(timeOfDay, focus) {
    const dusk = duskAmount(timeOfDay);
    const fogColor = mixColor(0x3a2350, 0x0a0618, dusk);
    scene.background.setHex(fogColor);
    scene.fog.color.setHex(fogColor);
    scene.fog.near = lerp(90, 60, dusk);
    scene.fog.far = lerp(460, 320, dusk);
    hemi.color.setHex(mixColor(0xffc890, 0x5a4a9a, dusk));
    hemi.groundColor.setHex(mixColor(0x241a3a, 0x0c0818, dusk));
    hemi.intensity = lerp(0.75, 0.35, dusk);
    ambient.intensity = lerp(0.45, 0.22, dusk);
    sun.color.setHex(mixColor(0xffb36b, 0xff5a3c, dusk));
    sun.intensity = lerp(1.25, 0.35, dusk);
    const elev = lerp(0.9, 0.18, dusk);
    const azim = lerp(-0.6, -1.4, dusk);
    sun.position.set(
      focus.x + Math.sin(azim) * 160,
      focus.y + elev * 220,
      focus.z + Math.cos(azim) * 160,
    );
    sun.target.position.set(focus.x, 0, focus.z);
  }

  function updateHeadlights(state, night) {
    const car = state.carMesh;
    const on = night && !!car;
    headA.intensity = on ? 2.4 : 0;
    headB.intensity = on ? 2.4 : 0;
    if (!on) return;
    const fx = Math.sin(state.playerHeading);
    const fz = Math.cos(state.playerHeading);
    const px = state.playerPos.x;
    const pz = state.playerPos.z;
    const rx = Math.cos(state.playerHeading);
    const rz = -Math.sin(state.playerHeading);
    headA.position.set(px + fx * 2.4 + rx * 0.7, 0.9, pz + fz * 2.4 + rz * 0.7);
    headB.position.set(px + fx * 2.4 - rx * 0.7, 0.9, pz + fz * 2.4 - rz * 0.7);
    headTargetA.position.set(px + fx * 26, 0, pz + fz * 26);
    headTargetB.position.set(px + fx * 26, 0, pz + fz * 26);
  }

  function chaseCam(state, dist, height, ahead, lookY, dt) {
    const fx = Math.sin(state.playerHeading);
    const fz = Math.cos(state.playerHeading);
    const wantX = state.playerPos.x - fx * dist;
    const wantZ = state.playerPos.z - fz * dist;
    const wantY = height;
    const snap = Math.min(1, 6 * dt + 0.12);
    camPos.x += (wantX - camPos.x) * snap;
    camPos.y += (wantY - camPos.y) * snap;
    camPos.z += (wantZ - camPos.z) * snap;
    camLook.x = state.playerPos.x + fx * ahead;
    camLook.y = lookY;
    camLook.z = state.playerPos.z + fz * ahead;
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  function update(dt, state) {
    const timeOfDay = state.timeOfDay === undefined ? 0.4 : state.timeOfDay;
    const focus = state.playerPos || { x: 0, z: 0 };
    updateLighting(timeOfDay, focus);
    const night = duskAmount(timeOfDay) > 0.15;

    if (state.mode === 'menu') {
      menuAngle += dt * 0.05;
      const cx = Math.sin(menuAngle) * 130;
      const cz = Math.cos(menuAngle) * 130;
      camera.position.set(cx, 58, cz);
      camera.lookAt(-60, 6, -60);
      camera.fov = 60;
      camera.updateProjectionMatrix();
      updateHeadlights(state, false);
    } else if (shot === 'cover') {
      const d = DISTRICTS[0].centre;
      camera.position.set(d.x + 90, 52, d.z + 95);
      camera.lookAt(d.x, 10, d.z);
      camera.fov = 58;
      camera.updateProjectionMatrix();
      updateHeadlights(state, night);
    } else if (shot === 'drive') {
      chaseCam(state, 9, 2.8, 20, 1.4, dt);
      const wantFov = 62 + clamp(Math.abs(state.playerSpeed || 0) / 42, 0, 1) * 9;
      fov += (wantFov - fov) * Math.min(1, 4 * dt);
      camera.fov = fov;
      camera.updateProjectionMatrix();
      updateHeadlights(state, night);
    } else if (shot === 'chase') {
      chaseCam(state, 15, 7.5, 26, 6, dt);
      const wantFov = 62 + clamp(Math.abs(state.playerSpeed || 0) / 42, 0, 1) * 7;
      fov += (wantFov - fov) * Math.min(1, 4 * dt);
      camera.fov = fov;
      camera.updateProjectionMatrix();
      updateHeadlights(state, night);
    } else if (shot === 'mission') {
      chaseCam(state, 11, 5, 16, 2, dt);
      camera.fov = 62;
      camera.updateProjectionMatrix();
      updateHeadlights(state, night);
    } else {
      const dist = state.playerInCar ? 13 : 10;
      const height = state.playerInCar ? 5.5 : 4.5;
      chaseCam(state, dist, height, 13, 1.6, dt);
      const wantFov = 62 + clamp(Math.abs(state.playerSpeed || 0) / 42, 0, 1) * 8;
      fov += (wantFov - fov) * Math.min(1, 4 * dt);
      camera.fov = fov;
      camera.updateProjectionMatrix();
      updateHeadlights(state, night);
    }

    const hpRatio = state.playerHp === undefined || state.playerMaxHp === undefined
      ? 1
      : clamp(state.playerHp / state.playerMaxHp, 0, 1);
    vignette.style.opacity = hpRatio < 0.25 ? String(1 - hpRatio / 0.25) : '0';

    renderer.render(scene, camera);
  }

  function setShot(name) {
    shot = name || null;
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  return {
    scene,
    camera,
    update,
    setShot,
    resize,
  };
}
