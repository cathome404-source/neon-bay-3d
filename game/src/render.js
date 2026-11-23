// Neon Bay 3D — rendering: scene, golden-hour sun, chase camera with shake,
// particles (exhaust, smoke, explosions), skid marks.
import { COLORS, TUNING } from './config.js';
import { clamp, clampAngle, lerp } from './random.js';

const T = window.THREE;
const MAX_PARTICLES = 600;

export class Renderer {
  constructor() {
    this.renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    document.getElementById('game').appendChild(this.renderer.domElement);
    this.scene = new T.Scene();
    this.scene.background = new T.Color(COLORS.sky);
    this.scene.fog = new T.Fog(0xffd9a0, 180, 520);
    this.camera = new T.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    // Lights: warm sun + hemisphere fill.
    this.sun = new T.DirectionalLight(COLORS.sun, 1.8);
    this.sun.position.set(120, 220, 180);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -160; this.sun.shadow.camera.right = 160;
    this.sun.shadow.camera.top = 160; this.sun.shadow.camera.bottom = -160;
    this.sun.shadow.camera.far = 700;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun);
    this.sunTarget = new T.Object3D();
    this.scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;
    this.hemi = new T.HemisphereLight(0xbfd8ff, 0x8a6a4a, 0.75);
    this.scene.add(this.hemi);
    // Particles: one Points cloud, per-particle velocity/life in JS arrays.
    this.pGeo = new T.BufferGeometry();
    this.pPos = new Float32Array(MAX_PARTICLES * 3);
    this.pCol = new Float32Array(MAX_PARTICLES * 3);
    this.pGeo.setAttribute('position', new T.BufferAttribute(this.pPos, 3));
    this.pGeo.setAttribute('color', new T.BufferAttribute(this.pCol, 3));
    this.pMat = new T.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
    this.points = new T.Points(this.pGeo, this.pMat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.parts = [];
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      this.parts.push({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, grav: 0, r: 1, g: 1, b: 1 });
      this.pPos[i * 3 + 1] = -100;
    }
    // Skid marks: pool of dark quads on the road.
    this.skids = [];
    const skidGeo = new T.PlaneGeometry(0.5, 1.6);
    const skidMat = new T.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.55, depthWrite: false });
    for (let i = 0; i < 80; i += 1) {
      const m = new T.Mesh(skidGeo, skidMat);
      m.rotation.order = 'YXZ';
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.08;
      m.visible = false;
      this.scene.add(m);
      this.skids.push({ mesh: m, life: 0 });
    }
    this.skidIndex = 0;
    // Camera state.
    this.camYaw = 0; this.camPitch = 0.32; this.camDist = 13;
    this.trauma = 0;
    this.dusk = 0; // 0 golden hour, 1 dusk
    // Aim override for staged shots: look ahead of the target (metres) and
    // at a fixed height instead of at the target itself. The chase shot uses
    // this to level the camera so the helicopter is in frame.
    this.aimAhead = 0;
    this.aimY = null;
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }
  setDusk(v) {
    this.dusk = clamp(v, 0, 1);
    const sunCol = new T.Color(COLORS.sun).lerp(new T.Color(0xff7a3c), this.dusk);
    this.sun.color.copy(sunCol);
    this.sun.intensity = 1.8 - this.dusk * 0.7;
    this.sun.position.set(180 - this.dusk * 120, 220 - this.dusk * 140, 120);
    this.scene.background = new T.Color(COLORS.sky).lerp(new T.Color(0x3a2a55), this.dusk);
    this.scene.fog.color.copy(this.scene.background);
    this.hemi.intensity = 0.75 - this.dusk * 0.35;
  }
  burst(x, y, z, color, count, speed, life, grav, up) {
    let spawned = 0;
    for (const p of this.parts) {
      if (spawned >= count) break;
      if (p.life > 0) continue;
      p.life = p.max = life * (0.6 + Math.random() * 0.7);
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      p.vx = Math.cos(a) * s; p.vz = Math.sin(a) * s;
      p.vy = (up || 0) + Math.random() * speed * 0.6;
      p.grav = grav;
      const c = new T.Color(color);
      p.r = c.r; p.g = c.g; p.b = c.b;
      const idx = this.parts.indexOf(p);
      this.pPos[idx * 3] = x; this.pPos[idx * 3 + 1] = y; this.pPos[idx * 3 + 2] = z;
      spawned += 1;
    }
  }
  smoke(x, y, z) { this.burst(x, y, z, 0x555555, 3, 1.2, 1.6, 1.5, 2.5); }
  explosion(x, y, z) {
    this.burst(x, y + 1, z, 0xff8822, 40, 14, 0.9, -2, 6);
    this.burst(x, y + 1, z, 0xffcc33, 25, 9, 0.7, -1, 8);
    this.burst(x, y + 2, z, 0x333333, 25, 3, 2.2, 1.2, 4);
    this.trauma = Math.min(1, this.trauma + 0.7);
  }
  exhaust(x, y, z, heading) {
    this.burst(x - Math.cos(heading) * 2, y + 0.4, z - Math.sin(heading) * 2, 0x888888, 1, 0.8, 0.7, 0.8, 0.8);
  }
  addSkid(x, z, heading) {
    const s = this.skids[this.skidIndex];
    this.skidIndex = (this.skidIndex + 1) % this.skids.length;
    s.mesh.visible = true;
    s.mesh.position.set(x, 0.08, z);
    s.mesh.rotation.y = -heading - Math.PI / 2;
    s.life = 20;
  }
  updateParticles(dt) {
    for (let i = 0; i < this.parts.length; i += 1) {
      const p = this.parts[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { this.pPos[i * 3 + 1] = -100; continue; }
      p.vy -= p.grav * dt;
      this.pPos[i * 3] += p.vx * dt;
      this.pPos[i * 3 + 1] += p.vy * dt;
      this.pPos[i * 3 + 2] += p.vz * dt;
      const fade = p.life / p.max;
      this.pCol[i * 3] = p.r * fade; this.pCol[i * 3 + 1] = p.g * fade; this.pCol[i * 3 + 2] = p.b * fade;
    }
    this.pGeo.attributes.position.needsUpdate = true;
    this.pGeo.attributes.color.needsUpdate = true;
    for (const s of this.skids) {
      if (s.life > 0) {
        s.life -= dt;
        if (s.life <= 0) s.mesh.visible = false;
      }
    }
  }
  // Third-person chase camera. target: {x,z,heading}; inCar changes distance.
  // speedNorm (0..1) widens the FOV at top speed — the sense of speed.
  updateCamera(dt, target, inCar, yawDelta, pitchDelta, speedNorm) {
    this.camYaw += yawDelta;
    this.camPitch = clamp(this.camPitch + pitchDelta, 0.08, 0.9);
    const dist = inCar ? 15 : 12;
    const height = inCar ? 5.5 : 5;
    // Camera yaw follows the target heading loosely when driving.
    const desiredYaw = target.heading;
    const dy = clampAngle(desiredYaw - this.camYaw);
    this.camYaw += dy * Math.min(1, dt * (inCar ? 2.2 : 1.2));
    // FOV kick: the camera opens up as the car approaches top speed.
    const sn = clamp(speedNorm || 0, 0, 1);
    const fov = 62 + (inCar ? sn * TUNING.fovKick : 0);
    if (Math.abs(fov - this.camera.fov) > 0.1) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    const cx = target.x - Math.cos(this.camYaw) * dist;
    const cz = target.z - Math.sin(this.camYaw) * dist;
    const cy = height + Math.sin(this.camPitch) * dist * 0.5;
    // Shake.
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const sh = this.trauma * this.trauma;
    const shx = (Math.random() - 0.5) * sh * 1.2;
    const shy = (Math.random() - 0.5) * sh * 0.8;
    this.camera.position.set(cx + shx, cy + shy, cz);
    // Aim: by default at the target; a staged shot can aim ahead and higher
    // (aimAhead / aimY) to level the frame, e.g. to keep a helicopter in view.
    const lookX = target.x + Math.cos(this.camYaw) * this.aimAhead;
    const lookZ = target.z + Math.sin(this.camYaw) * this.aimAhead;
    const lookY = this.aimY !== null ? this.aimY : (inCar ? 2 : 1.6);
    this.camera.lookAt(lookX, lookY, lookZ);
    // Sun follows the action so shadows stay local.
    this.sunTarget.position.set(target.x, 0, target.z);
    this.sun.position.set(target.x + 120, 220, target.z + 180);
  }
  render() { this.renderer.render(this.scene, this.camera); }
}
