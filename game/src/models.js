// Neon Bay 3D — low-poly model factories. Every vehicle and character is built
// from boxes/cylinders in code: no external models, no textures beyond the city's.
const T = window.THREE;

const _box = new T.BoxGeometry(1, 1, 1);
const _cyl = new T.CylinderGeometry(0.42, 0.42, 0.3, 10);
const _sphere = new T.SphereGeometry(0.5, 8, 6);

function mat(color, opts) {
  return new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.25 }, opts || {}));
}
function box(parent, sx, sy, sz, x, y, z, material) {
  const m = new T.Mesh(_box, material);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

// A car: body + cabin + 4 wheels + headlights/taillights. Kinds change proportions.
// Returns { group, wheels:[4 meshes], lights:{head:[], tail:[]}, lightBar (police) }
export function makeCar(kind, color) {
  const g = new T.Group();
  const bodyMat = mat(color);
  const glassMat = mat(0x1a2530, { roughness: 0.15, metalness: 0.6 });
  const darkMat = mat(0x14161a, { roughness: 0.9 });
  const dims = {
    sedan: { l: 4.4, w: 2.0, h: 0.75, cabL: 2.2, cabH: 0.65, y: 0.55 },
    sports: { l: 4.6, w: 2.0, h: 0.6, cabL: 2.0, cabH: 0.55, y: 0.5 },
    taxi: { l: 4.4, w: 2.0, h: 0.75, cabL: 2.2, cabH: 0.65, y: 0.55 },
    truck: { l: 6.2, w: 2.3, h: 1.0, cabL: 1.8, cabH: 0.9, y: 0.7 },
    police: { l: 4.5, w: 2.0, h: 0.78, cabL: 2.2, cabH: 0.65, y: 0.55 },
    swat: { l: 5.4, w: 2.3, h: 1.9, cabL: 0, cabH: 0, y: 1.0 },
  }[kind] || { l: 4.4, w: 2.0, h: 0.75, cabL: 2.2, cabH: 0.65, y: 0.55 };
  const { l, w, h, cabL, cabH, y } = dims;
  box(g, l, h, w, 0, y, 0, bodyMat);
  if (cabL > 0) box(g, cabL, cabH, w * 0.86, -l * 0.05, y + h / 2 + cabH / 2, 0, glassMat);
  if (kind === 'sports') box(g, 1.2, 0.1, w * 0.9, -l / 2 + 0.2, y + h + 0.15, 0, darkMat); // spoiler
  if (kind === 'taxi') {
    box(g, 1.0, 0.35, 0.7, 0, y + h + cabH + 0.15, 0, mat(0xf2c200, { emissive: 0xaa8800, emissiveIntensity: 0.6 }));
  }
  if (kind === 'truck') {
    box(g, l * 0.45, 0.5, w * 0.9, -l * 0.22, y + h + 0.25, 0, darkMat); // cargo bed walls
  }
  // Wheels.
  const wheelMat = mat(0x111111, { roughness: 0.95 });
  const wheels = [];
  const wy = 0.42;
  for (const [wx, wz] of [[l * 0.32, w / 2], [l * 0.32, -w / 2], [-l * 0.32, w / 2], [-l * 0.32, -w / 2]]) {
    const wheel = new T.Mesh(_cyl, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    wheel.castShadow = true;
    g.add(wheel);
    wheels.push(wheel);
  }
  // Headlights + taillights (emissive so they read at dusk).
  const headMat = mat(0xfff6c0, { emissive: 0xffee88, emissiveIntensity: 1.4 });
  const tailMat = mat(0xff2222, { emissive: 0xff2222, emissiveIntensity: 1.2 });
  const heads = [], tails = [];
  for (const wz of [w * 0.32, -w * 0.32]) {
    heads.push(box(g, 0.15, 0.22, 0.4, l / 2, y + 0.1, wz, headMat));
    tails.push(box(g, 0.15, 0.22, 0.4, -l / 2, y + 0.1, wz, tailMat));
  }
  let lightBar = null;
  if (kind === 'police' || kind === 'swat') {
    lightBar = new T.Group();
    const red = box(lightBar, 0.5, 0.22, 0.5, 0, 0, 0.45, mat(0xff2222, { emissive: 0xff2222, emissiveIntensity: 2 }));
    const blue = box(lightBar, 0.5, 0.22, 0.5, 0, 0, -0.45, mat(0x2244ff, { emissive: 0x2244ff, emissiveIntensity: 2 }));
    lightBar.position.set(0, y + h + cabH + 0.15, 0);
    lightBar.userData = { red, blue };
    g.add(lightBar);
    // Police livery: white doors.
    box(g, l * 0.5, h * 0.7, w + 0.06, 0, y, 0, mat(0xf0f0f0, { roughness: 0.6 }));
  }
  return { group: g, wheels, heads, tails, lightBar, bodyMat, length: l, width: w };
}

// A person: legs, torso, head, arms. userData holds limbs for walk animation.
export function makeCharacter(shirt, pants, skin) {
  const g = new T.Group();
  const legL = box(g, 0.32, 0.8, 0.36, -0.2, 0.4, 0, mat(pants));
  const legR = box(g, 0.32, 0.8, 0.36, 0.2, 0.4, 0, mat(pants));
  const torso = box(g, 0.95, 0.9, 0.5, 0, 1.25, 0, mat(shirt));
  const head = new T.Mesh(_sphere, mat(skin || 0xd8a080));
  head.scale.set(0.85, 1, 0.85); head.position.set(0, 2.05, 0); head.castShadow = true;
  g.add(head);
  const armL = box(g, 0.26, 0.8, 0.3, -0.62, 1.25, 0, mat(shirt));
  const armR = box(g, 0.26, 0.8, 0.3, 0.62, 1.25, 0, mat(shirt));
  // A simple cap for the player / a hat for some peds.
  const cap = box(g, 0.9, 0.18, 0.9, 0, 2.35, 0, mat(0x222831));
  g.userData = { legL, legR, armL, armR, torso, head, cap };
  return g;
}

// Police helicopter: body, tail, main + tail rotors, searchlight.
export function makeHeli() {
  const g = new T.Group();
  const bodyMat = mat(0x1a1a22);
  box(g, 3.2, 1.6, 1.8, 0, 0, 0, bodyMat);
  box(g, 0.7, 0.7, 1.0, 0, 0.1, 1.35, mat(0x1a2530, { roughness: 0.15, metalness: 0.6 })); // nose glass
  box(g, 3.4, 0.5, 0.5, 0, 0.2, -2.6, bodyMat); // tail boom
  box(g, 0.3, 1.6, 1.2, 0, 0.6, -4.2, bodyMat); // tail fin
  const skids = mat(0x333333);
  box(g, 2.6, 0.15, 0.15, 0, -1.1, 0.7, skids);
  box(g, 2.6, 0.15, 0.15, 0, -1.1, -0.7, skids);
  const rotor = new T.Group();
  const bladeMat = mat(0x111111);
  box(rotor, 7.5, 0.08, 0.5, 0, 0, 0, bladeMat);
  box(rotor, 0.5, 0.08, 7.5, 0, 0, 0, bladeMat);
  rotor.position.y = 1.1;
  g.add(rotor);
  const tailRotor = new T.Group();
  box(tailRotor, 0.08, 2.2, 0.4, 0, 0, 0, bladeMat);
  tailRotor.position.set(0.4, 0.6, -4.2);
  g.add(tailRotor);
  const spot = new T.SpotLight(0xfff2c0, 0, 90, 0.35, 0.4, 1.2);
  spot.position.set(0, -0.8, 1.2);
  g.add(spot);
  const cone = new T.Mesh(
    new T.ConeGeometry(6, 40, 16, 1, true),
    new T.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.10, side: T.DoubleSide, depthWrite: false }),
  );
  cone.rotation.x = Math.PI; // apex up at the heli
  cone.position.y = -21;
  g.add(cone);
  g.userData = { rotor, tailRotor, spot, cone };
  return g;
}

// A cash drop: green glowing bundle.
export function makeCashDrop() {
  const g = new T.Group();
  const bundle = box(g, 0.9, 0.5, 0.6, 0, 0.5, 0, mat(0x2ea86a, { emissive: 0x1a6a3a, emissiveIntensity: 0.8 }));
  const band = box(g, 0.95, 0.15, 0.65, 0, 0.5, 0, mat(0xffd76a, { emissive: 0xaa8800, emissiveIntensity: 0.8 }));
  const glow = new T.Mesh(_sphere, new T.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.25 }));
  glow.scale.setScalar(2.4); glow.position.y = 0.6;
  g.add(glow);
  g.userData = { bundle, band, glow };
  return g;
}
