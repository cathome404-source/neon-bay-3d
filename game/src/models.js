// Mesh builders for every moving thing in Neon Bay 3D: cars, people, police,
// helicopter, palms, containers, cranes and single buildings. All use the
// global THREE (loaded as a classic script). Each builder returns a THREE.Group
// with the parts later sessions need stored in userData.
// Exports: makeCar, makePlayer, makePoliceCar, makeHelicopter, makePedestrian,
// makeBuildingMesh, makePalm, makeContainer, makeCrane.

const matCache = new Map();
function mat(color, emissive, intensity, transparent, opacity) {
  const key = `${color}|${emissive || 0}|${intensity || 0}|${transparent ? 1 : 0}|${opacity || 0}`;
  if (!matCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color });
    if (emissive) {
      m.emissive = new THREE.Color(emissive);
      m.emissiveIntensity = intensity || 1;
    }
    if (transparent) {
      m.transparent = true;
      m.opacity = opacity;
    }
    matCache.set(key, m);
  }
  return matCache.get(key);
}

function box(w, h, d, color, x, y, z, emissive, intensity) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, emissive, intensity));
  mesh.position.set(x || 0, y || 0, z || 0);
  return mesh;
}

function wheel(x, z) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10), mat(0x14141a));
  mesh.rotation.z = Math.PI / 2;
  mesh.position.set(x, 0.36, z);
  return mesh;
}

export function makeCar(color, options) {
  const opts = options || {};
  const group = new THREE.Group();
  const bodyColor = color === undefined ? 0xc23b5e : color;
  group.add(box(1.9, 0.55, 4.2, bodyColor, 0, 0.62, 0));
  group.add(box(1.7, 0.5, 2.1, 0x1a2030, 0, 1.12, -0.25));
  group.add(box(1.92, 0.12, 0.9, 0x2a2a33, 0, 0.42, 1.7));
  const wheels = [wheel(-0.88, 1.35), wheel(0.88, 1.35), wheel(-0.88, -1.35), wheel(0.88, -1.35)];
  for (const w of wheels) group.add(w);
  const headlights = [
    box(0.34, 0.14, 0.08, 0xfff2c0, -0.62, 0.62, 2.12, 0xfff2c0, 2.2),
    box(0.34, 0.14, 0.08, 0xfff2c0, 0.62, 0.62, 2.12, 0xfff2c0, 2.2),
  ];
  for (const h of headlights) group.add(h);
  const brakeLights = [
    box(0.4, 0.14, 0.08, 0x881111, -0.6, 0.66, -2.12, 0xff2222, 0.4),
    box(0.4, 0.14, 0.08, 0x881111, 0.6, 0.66, -2.12, 0xff2222, 0.4),
  ];
  for (const b of brakeLights) group.add(b);
  if (opts.spoiler) group.add(box(1.7, 0.08, 0.4, 0x14141a, 0, 1.05, -2.0));
  group.userData = { wheels, brakeLights, headlights };
  return group;
}

export function makePlayer() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.add(box(0.34, 0.62, 0.2, 0x2a2a33, -0.11, 0.36, 0));
  body.add(box(0.34, 0.62, 0.2, 0x2a2a33, 0.11, 0.36, 0));
  body.add(box(0.56, 0.72, 0.32, 0x3fae5a, 0, 1.05, 0));
  body.add(box(0.16, 0.5, 0.16, 0xd9a06a, -0.38, 1.0, 0));
  body.add(box(0.16, 0.5, 0.16, 0xd9a06a, 0.38, 1.0, 0));
  const head = box(0.34, 0.34, 0.32, 0xe8b98a, 0, 1.6, 0);
  body.add(head);
  group.add(body);
  group.userData = { body };
  return group;
}

export function makePoliceCar() {
  const group = makeCar(0xe8e8ec, {});
  group.add(box(1.2, 0.1, 0.5, 0x14141a, 0, 1.42, -0.25));
  const lightBar = new THREE.Group();
  lightBar.add(box(0.5, 0.16, 0.34, 0xff2222, -0.32, 1.55, -0.25, 0xff2222, 2.0));
  lightBar.add(box(0.5, 0.16, 0.34, 0x2266ff, 0.32, 1.55, -0.25, 0x2266ff, 2.0));
  group.add(lightBar);
  group.userData.lightBar = lightBar;
  return group;
}

export function makeHelicopter() {
  const group = new THREE.Group();
  group.add(box(2.0, 1.3, 4.2, 0x223044, 0, 1.1, 0));
  group.add(box(1.6, 0.8, 1.4, 0x2a3a52, 0, 1.0, 2.4));
  const tail = box(0.5, 0.5, 3.6, 0x223044, 0, 1.3, -3.6);
  group.add(tail);
  group.add(box(0.2, 1.2, 0.9, 0x223044, 0, 1.8, -5.2));
  const rotor = new THREE.Group();
  rotor.add(box(0.5, 0.08, 9.0, 0x14141a, 0, 0, 0));
  rotor.add(box(9.0, 0.08, 0.5, 0x14141a, 0, 0, 0));
  rotor.position.set(0, 1.95, 0.2);
  group.add(rotor);
  group.add(box(0.08, 0.5, 0.08, 0x14141a, 0, 1.7, 0.2));
  group.add(box(1.9, 0.08, 0.5, 0x14141a, -1.0, 0.35, 0.8));
  group.add(box(1.9, 0.08, 0.5, 0x14141a, 1.0, 0.35, 0.8));
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 12, 12, 1, true),
    mat(0xfff2c0, 0xfff2c0, 0.8, true, 0.22),
  );
  cone.position.set(0, -5.0, 1.5);
  cone.rotation.x = Math.PI;
  group.add(cone);
  group.userData = { rotor, searchlight: cone };
  return group;
}

export function makePedestrian(color) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const shirt = color === undefined ? 0x7a6ab8 : color;
  body.add(box(0.3, 0.5, 0.16, 0x2a2a33, -0.09, 0.28, 0));
  body.add(box(0.3, 0.5, 0.16, 0x2a2a33, 0.09, 0.28, 0));
  body.add(box(0.48, 0.6, 0.26, shirt, 0, 0.85, 0));
  body.add(box(0.3, 0.3, 0.28, 0xe8b98a, 0, 1.32, 0));
  group.add(body);
  group.userData = { body };
  return group;
}

export function makeBuildingMesh(w, d, h, color, options) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  base.position.y = h / 2;
  group.add(base);
  if (options && options.pitched) {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, h * 0.18 + 1.2, 4), mat(0x2a2a33));
    roof.position.y = h + (h * 0.18 + 1.2) / 2;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
  } else {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.35, d * 1.02), mat(0x23232e));
    slab.position.y = h + 0.17;
    group.add(slab);
  }
  group.userData = { w, d, h };
  return group;
}

export function makePalm() {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.4, 6), mat(0x6a4a2a));
  trunk.position.y = 1.7;
  trunk.rotation.z = 0.08;
  group.add(trunk);
  for (let i = 0; i < 5; i += 1) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 4), mat(0x2e8a4a));
    const angle = (i / 5) * Math.PI * 2;
    frond.position.set(Math.cos(angle) * 0.9, 3.6, Math.sin(angle) * 0.9);
    frond.rotation.z = Math.cos(angle) * 1.1;
    frond.rotation.x = -Math.sin(angle) * 1.1;
    group.add(frond);
  }
  return group;
}

export function makeContainer(color) {
  const group = new THREE.Group();
  const shade = color === undefined ? 0xc23b2e : color;
  group.add(box(6, 2.6, 2.6, shade, 0, 0, 0));
  for (let i = -1; i <= 1; i += 1) {
    group.add(box(0.12, 2.6, 2.66, 0x000000, i * 1.8, 0, 0));
  }
  return group;
}

export function makeCrane() {
  const group = new THREE.Group();
  const legMat = 0xd9a03e;
  const positions = [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]];
  for (const [x, z] of positions) {
    group.add(box(0.5, 18, 0.5, legMat, x, 9, z));
  }
  group.add(box(5.4, 0.6, 5.4, legMat, 0, 18.3, 0));
  group.add(box(1.0, 1.0, 22, legMat, 0, 19.4, 6));
  group.add(box(1.0, 1.0, 6, legMat, 0, 19.4, -6));
  group.add(box(1.4, 1.2, 1.4, 0x2a2a33, 0, 19.4, -5));
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 9, 5), mat(0x14141a));
  line.position.set(0, 14.5, 14);
  group.add(line);
  group.add(box(1.2, 1.0, 1.2, 0xc23b2e, 0, 9.5, 14));
  return group;
}
