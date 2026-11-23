// Neon Bay 3D — the city: roads, buildings, beach, docks, causeway, garage,
// palms, streetlights, stunt ramps. All geometry is built in code (no models).
// Returns colliders (AABBs), road helpers, and animated bits (water, heli pad).
import { WORLD, COLORS, NEON_COLORS, districtAt } from './config.js';
import { pick, range } from './random.js';

const T = window.THREE;

function windowTexture(rng, litRatio) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3f46'; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 12) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? (rng() < 0.7 ? '#ffd98a' : '#9fd8ff') : '#232830';
      g.fillRect(x, y, 7, 8);
    }
  }
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

export function buildWorld(scene, rng) {
  const colliders = [];   // {x0,z0,x1,z1}
  const animated = { water: [], beacon: null };
  const boxGeo = new T.BoxGeometry(1, 1, 1);
  const cylGeo = new T.CylinderGeometry(0.35, 0.5, 6, 6);
  const coneGeo = new T.ConeGeometry(2.2, 2.4, 6);
  const sphereGeo = new T.SphereGeometry(0.5, 8, 6);

  const mats = {
    asphalt: new T.MeshStandardMaterial({ color: COLORS.asphalt, roughness: 0.95 }),
    line: new T.MeshStandardMaterial({ color: COLORS.asphaltLine, roughness: 0.9 }),
    sidewalk: new T.MeshStandardMaterial({ color: COLORS.sidewalk, roughness: 1 }),
    sand: new T.MeshStandardMaterial({ color: COLORS.sand, roughness: 1 }),
    water: new T.MeshStandardMaterial({ color: COLORS.water, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.9 }),
    grass: new T.MeshStandardMaterial({ color: COLORS.grass, roughness: 1 }),
    trunk: new T.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 }),
    frond: new T.MeshStandardMaterial({ color: 0x3f8f4f, roughness: 1 }),
    pole: new T.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.6, metalness: 0.6 }),
    lamp: new T.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 1.6 }),
    containerA: new T.MeshStandardMaterial({ color: 0xc2502e, roughness: 0.8 }),
    containerB: new T.MeshStandardMaterial({ color: 0x2e6fc2, roughness: 0.8 }),
    containerC: new T.MeshStandardMaterial({ color: 0x2ea86a, roughness: 0.8 }),
    crane: new T.MeshStandardMaterial({ color: 0xd8a020, roughness: 0.7 }),
    ramp: new T.MeshStandardMaterial({ color: 0xe86a20, roughness: 0.7 }),
    garage: new T.MeshStandardMaterial({ color: 0x8a2e2e, roughness: 0.85 }),
    garageDoor: new T.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.5, metalness: 0.5 }),
    pier: new T.MeshStandardMaterial({ color: 0x8a7a66, roughness: 1 }),
  };

  const winTexDay = windowTexture(rng, 0.35);
  const winTexDusk = windowTexture(rng, 0.6);
  const winMats = [winTexDay, winTexDusk].map((tex) => (tint) =>
    new T.MeshStandardMaterial({ map: tex, color: tint, roughness: 0.85 }));
  const roofMat = new T.MeshStandardMaterial({ color: 0x2a2e36, roughness: 1 });

  function addBox(x, y, z, sx, sy, sz, mat, parent) {
    const m = new T.Mesh(boxGeo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = sy > 2; m.receiveShadow = true;
    (parent || scene).add(m);
    return m;
  }

  // ---- ground: grass base, city slab, beach sand, pier ----
  const ground = new T.Mesh(new T.PlaneGeometry(1200, 1200), mats.grass);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 0); ground.receiveShadow = true;
  scene.add(ground);
  const citySlab = new T.Mesh(new T.PlaneGeometry(560, 560), mats.sidewalk);
  citySlab.rotation.x = -Math.PI / 2; citySlab.position.set(0, 0, 0); citySlab.receiveShadow = true;
  scene.add(citySlab);
  const sand = new T.Mesh(new T.PlaneGeometry(560, 55), mats.sand);
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, 302); sand.receiveShadow = true;
  scene.add(sand);
  const pier = new T.Mesh(new T.PlaneGeometry(55, 560), mats.pier);
  pier.rotation.x = -Math.PI / 2; pier.position.set(302, 0.02, 0); pier.receiveShadow = true;
  scene.add(pier);

  // ---- water: south sea, east bay, north bay (animated) ----
  function waterPlane(w, h, x, z) {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), mats.water.clone());
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.05, z);
    scene.add(m); animated.water.push(m);
    return m;
  }
  waterPlane(1200, 300, 0, 480);    // south sea
  waterPlane(300, 1200, 480, 0);    // east bay
  waterPlane(1200, 120, 0, -390);   // north bay

  // ---- roads: dark strips + dashed centre lines ----
  for (const r of WORLD.roads) {
    addBox(r, 0.01, 0, WORLD.roadHalf * 2, 0.1, 560, mats.asphalt);
    addBox(0, 0.01, r, 560, 0.1, WORLD.roadHalf * 2, mats.asphalt);
    for (let d = -266; d <= 266; d += 14) {
      addBox(r, 0.06, d, 0.5, 0.06, 6, mats.line);
      addBox(d, 0.06, r, 6, 0.06, 0.5, mats.line);
    }
  }

  // ---- north causeway (the bridge): deck over the north bay + railings ----
  addBox(-35, 0.15, -305, 16, 0.5, 55, mats.asphalt);
  addBox(-44, 0.8, -305, 0.8, 1.4, 55, mats.pole);
  addBox(-26, 0.8, -305, 0.8, 1.4, 55, mats.pole);
  for (let d = -282; d >= -328; d -= 8) addBox(-35, 0.45, d, 0.5, 0.06, 4, mats.line);

  // ---- buildings: one per block slot, taller downtown ----
  const blockCenters = [];
  for (let i = -3; i <= 3; i += 1) for (let j = -3; j <= 3; j += 1) blockCenters.push([i * 70, j * 70]);
  for (const [cx, cz] of blockCenters) {
    const downtown = Math.abs(cx) < 140 && Math.abs(cz) < 140;
    const n = downtown ? 1 + Math.floor(rng() * 2) : 1 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k += 1) {
      const bx = cx + (n === 1 ? 0 : range(rng, -14, 14));
      const bz = cz + (n === 1 ? 0 : range(rng, -14, 14));
      // Keep the garage block clear for Vic's garage.
      if (Math.abs(bx + 70) < 20 && Math.abs(bz + 70) < 20) continue;
      const w = range(rng, 14, 26);
      const d = range(rng, 14, 26);
      const h = downtown ? range(rng, 30, 85) : range(rng, 7, 22);
      const tint = pick(rng, downtown ? COLORS.downtownPalette : COLORS.buildingPalette);
      const side = winMats[Math.floor(rng() * winMats.length)](tint);
      const mesh = new T.Mesh(boxGeo, [side, side, roofMat, roofMat, side, side]);
      mesh.position.set(bx, h / 2, bz);
      mesh.scale.set(w, h, d);
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);
      colliders.push({ x0: bx - w / 2 - 0.5, z0: bz - d / 2 - 0.5, x1: bx + w / 2 + 0.5, z1: bz + d / 2 + 0.5 });
      // Rooftop beacon on the tallest downtown towers.
      if (downtown && h > 60 && rng() < 0.5) {
        const b = new T.Mesh(sphereGeo, new T.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 }));
        b.scale.setScalar(1.2); b.position.set(bx, h + 1, bz);
        scene.add(b);
      }
      // Neon sign on the face of tall downtown towers: a glowing bar that
      // faces the nearest road, so the skyline reads at dusk.
      if (downtown && h > 40 && rng() < 0.6) {
        const neonCol = pick(rng, NEON_COLORS);
        const sign = new T.Mesh(boxGeo, new T.MeshStandardMaterial({ color: neonCol, emissive: neonCol, emissiveIntensity: 1.8 }));
        const faceZ = bz + d / 2 + 0.4;
        sign.scale.set(Math.min(w * 0.7, 12), 1.1, 0.5);
        sign.position.set(bx, h * 0.72, faceZ);
        scene.add(sign);
        const sign2 = sign.clone();
        sign2.position.set(bx, h * 0.72, bz - d / 2 - 0.4);
        scene.add(sign2);
      }
    }
  }

  // ---- Vic's garage (south-west block): big low building + door + sign ----
  const garage = new T.Group();
  garage.position.set(-70, 0, -70);
  const gBody = new T.Mesh(boxGeo, mats.garage);
  gBody.scale.set(34, 10, 24); gBody.position.y = 5; gBody.castShadow = true; gBody.receiveShadow = true;
  garage.add(gBody);
  const gDoor = new T.Mesh(boxGeo, mats.garageDoor);
  gDoor.scale.set(16, 7, 0.6); gDoor.position.set(0, 3.5, 12.2);
  garage.add(gDoor);
  const gSign = new T.Mesh(boxGeo, new T.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb020, emissiveIntensity: 1.2 }));
  gSign.scale.set(20, 1.6, 0.6); gSign.position.set(0, 11, 12.2);
  garage.add(gSign);
  scene.add(garage);
  colliders.push({ x0: -70 - 17, z0: -70 - 12, x1: -70 + 17, z1: -70 + 12 });

  // ---- docks: containers + cranes on the east pier ----
  const containerMats = [mats.containerA, mats.containerB, mats.containerC];
  for (let i = 0; i < 14; i += 1) {
    const cx = range(rng, 288, 318);
    const cz = -240 + i * 36 + range(rng, -8, 8);
    const stacked = rng() < 0.4;
    addBox(cx, 1.4, cz, 12, 2.8, 3, pick(rng, containerMats));
    if (stacked) addBox(cx, 4.2, cz, 12, 2.8, 3, pick(rng, containerMats));
    colliders.push({ x0: cx - 6.5, z0: cz - 2, x1: cx + 6.5, z1: cz + 2 });
  }
  for (const cz of [-180, 0, 180]) {
    addBox(310, 12, cz, 3, 24, 3, mats.crane);
    const arm = addBox(300, 24, cz, 22, 2, 2, mats.crane);
    arm.rotation.z = 0.12;
    colliders.push({ x0: 308, z0: cz - 2, x1: 312, z1: cz + 2 });
  }

  // ---- palms along the beach + scattered in the city ----
  function palm(x, z) {
    const g = new T.Group();
    const trunk = new T.Mesh(cylGeo, mats.trunk);
    trunk.position.y = 3; trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 6; i += 1) {
      const frond = new T.Mesh(coneGeo, mats.frond);
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.6, 6.4, Math.sin(a) * 1.6);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      frond.scale.set(1, 0.7, 1);
      g.add(frond);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    colliders.push({ x0: x - 0.8, z0: z - 0.8, x1: x + 0.8, z1: z + 0.8 });
  }
  for (let x = -260; x <= 260; x += 40) { palm(x + range(rng, -6, 6), 288); palm(x + range(rng, -6, 6), 318); }
  for (let i = 0; i < 18; i += 1) palm(range(rng, -260, 260), range(rng, -260, 260));

  // ---- streetlights at intersections ----
  for (const r of WORLD.roads) {
    for (const c of WORLD.roads) {
      if (rng() < 0.5) continue;
      const lx = r + 8, lz = c + 8;
      const pole = new T.Mesh(new T.CylinderGeometry(0.18, 0.22, 7, 6), mats.pole);
      pole.position.set(lx, 3.5, lz); pole.castShadow = true;
      scene.add(pole);
      const lamp = new T.Mesh(sphereGeo, mats.lamp);
      lamp.scale.setScalar(0.9); lamp.position.set(lx, 7.2, lz);
      scene.add(lamp);
    }
  }

  // ---- stunt ramps: two wedges that launch cars ----
  const ramps = [];
  function ramp(x, z, heading) {
    const g = new T.Group();
    const wedge = new T.Mesh(boxGeo, mats.ramp);
    wedge.scale.set(10, 1.2, 8);
    wedge.position.y = 1.2;
    wedge.rotation.z = -0.35;
    wedge.castShadow = true;
    g.add(wedge);
    const stripe = new T.Mesh(boxGeo, new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 }));
    stripe.scale.set(10, 0.3, 1); stripe.position.set(0, 2.6, 0); stripe.rotation.z = -0.35;
    g.add(stripe);
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    scene.add(g);
    ramps.push({ x, z, heading, w: 10, d: 8 });
  }
  ramp(175, -105, 0);
  ramp(-175, 175, Math.PI / 2);

  // ---- mission beacon: glowing cylinder reused by missions ----
  const beacon = new T.Group();
  const beam = new T.Mesh(
    new T.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new T.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.25, side: T.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  beacon.add(beam);
  const ring = new T.Mesh(
    new T.TorusGeometry(3, 0.35, 8, 32),
    new T.MeshBasicMaterial({ color: 0xffd76a }),
  );
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.4;
  beacon.add(ring);
  beacon.visible = false;
  scene.add(beacon);
  animated.beacon = beacon;

  return {
    colliders,
    ramps,
    animated,
    garagePos: { x: -35, z: -35 },
    playerSpawn: { x: -35, z: -20, heading: Math.PI },
    districtAt: (x, z) => districtAt(x, z),
  };
}

// Circle (radius r) vs AABB colliders: push the point out, return corrected x/z.
export function collideCircle(colliders, x, z, r) {
  for (const c of colliders) {
    if (x + r <= c.x0 || x - r >= c.x1 || z + r <= c.z0 || z - r >= c.z1) continue;
    const dxl = x + r - c.x0, dxr = c.x1 - (x - r);
    const dzl = z + r - c.z0, dzr = c.z1 - (z - r);
    const m = Math.min(dxl, dxr, dzl, dzr);
    if (m === dxl) x = c.x0 - r;
    else if (m === dxr) x = c.x1 + r;
    else if (m === dzl) z = c.z0 - r;
    else z = c.z1 + r;
  }
  return { x, z };
}

export function pointInCollider(colliders, x, z) {
  for (const c of colliders) if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return true;
  return false;
}

// Line of sight on the ground plane: true if the segment between the two
// points is not blocked by any building. Used by the police "search" logic.
export function hasLineOfSight(colliders, x1, z1, x2, z2) {
  const steps = 24;
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (pointInCollider(colliders, x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) return false;
  }
  return true;
}
