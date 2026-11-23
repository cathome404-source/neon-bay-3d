// Builds the static city for Neon Bay 3D: road grid, blocks, district buildings,
// streetlights, palms, containers and cranes. No game logic here, just geometry.
// Exports: buildWorld.

import { TUNING, DISTRICTS } from './config.js';
import { range, int, pick, chance } from './random.js';
import { makeBuildingMesh, makePalm, makeContainer, makeCrane } from './models.js';

const ROAD_HALF = 6;
const GRID_LINES = [-300, -240, -180, -120, -60, 0, 60, 120, 180, 240, 300];

const matCache = new Map();
function mat(color, emissive, intensity) {
  const key = `${color}|${emissive || 0}|${intensity || 0}`;
  if (!matCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color });
    if (emissive) {
      m.emissive = new THREE.Color(emissive);
      m.emissiveIntensity = intensity || 1;
    }
    matCache.set(key, m);
  }
  return matCache.get(key);
}

function flat(w, d, color, y) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

function pole(x, z, height, color) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, height, 6), mat(color));
  mesh.position.set(x, height / 2, z);
  return mesh;
}

function lampHead(x, z, height, color) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat(color, color, 1.6));
  mesh.position.set(x, height + 0.1, z);
  return mesh;
}

// Gentle rise used only inside The Hills so houses sit on low slopes.
function hillLift(x, z) {
  const hills = DISTRICTS[3];
  const dx = x - hills.centre.x;
  const dz = z - hills.centre.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > hills.radius) return 0;
  const falloff = 1 - dist / hills.radius;
  return falloff * 1.6 * (0.5 + 0.5 * Math.sin(x * 0.03) * Math.cos(z * 0.025));
}

function wallColors() {
  return [0x3a3f5e, 0x4a4a6a, 0x5e4a3a, 0x2e4a4a, 0x55405e, 0x6a5a3a, 0x3a5a4a, 0x4a3a5a];
}

function districtAt(x, z) {
  for (const d of DISTRICTS) {
    const dx = x - d.centre.x;
    const dz = z - d.centre.z;
    if (Math.sqrt(dx * dx + dz * dz) <= d.radius) return d;
  }
  return null;
}

function isOnRoad(x, z) {
  const nearLine = (v) => {
    const u = ((v % 60) + 60) % 60;
    return Math.min(u, 60 - u) < ROAD_HALF;
  };
  return nearLine(x) || nearLine(z);
}

function randomRoadPoint(rng) {
  const line = pick(rng, GRID_LINES);
  const along = range(rng, -290, 290);
  if (chance(rng, 0.5)) return { x: line, z: along };
  return { x: along, z: line };
}

export function buildWorld(rng) {
  const group = new THREE.Group();
  const buildings = [];
  const roads = [];
  const size = TUNING.world.citySize;

  // Ground and pavement.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({ color: 0x1c1a2e }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);
  group.add(flat(size, size, 0x2e2c42, 0.01));

  // Roads: dark strips on both axes, plus a pale centre line each.
  for (const line of GRID_LINES) {
    const vertical = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, size), mat(0x17161f));
    vertical.rotation.x = -Math.PI / 2;
    vertical.position.set(line, 0.02, 0);
    group.add(vertical);
    const horizontal = new THREE.Mesh(new THREE.PlaneGeometry(size, ROAD_HALF * 2), mat(0x17161f));
    horizontal.rotation.x = -Math.PI / 2;
    horizontal.position.set(0, 0.02, line);
    group.add(horizontal);
    const centreV = flat(0.3, size, 0x8a8a9a, 0.03);
    centreV.position.x = line;
    group.add(centreV);
    const centreH = flat(size, 0.3, 0x8a8a9a, 0.03);
    centreH.position.z = line;
    group.add(centreH);
    roads.push({ x1: line, z1: -size / 2, x2: line, z2: size / 2 });
    roads.push({ x1: -size / 2, z1: line, x2: size / 2, z2: line });
  }

  // Blocks between the roads: one or more buildings each, styled by district.
  const blockCentres = [];
  for (let i = 0; i < 10; i += 1) {
    for (let j = 0; j < 10; j += 1) {
      blockCentres.push({ x: -270 + i * 60, z: -270 + j * 60 });
    }
  }
  for (const block of blockCentres) {
    const district = districtAt(block.x, block.z);
    const name = district ? district.name : 'Midtown';
    const lift = district && district.name === 'The Hills' ? hillLift(block.x, block.z) : 0;
    const count = district && district.name === 'Downtown' ? int(rng, 1, 2) : int(rng, 1, 3);
    for (let n = 0; n < count; n += 1) {
      const w = range(rng, 14, 30);
      const d = range(rng, 14, 30);
      const bx = block.x + range(rng, -10, 10);
      const bz = block.z + range(rng, -10, 10);
      let h;
      let pitched = false;
      if (district) {
        h = range(rng, district.minHeight, district.maxHeight);
        if (district.name === 'The Hills') pitched = true;
      } else {
        h = range(rng, 10, 42);
      }
      const color = pick(rng, wallColors());
      const mesh = makeBuildingMesh(w, d, h, color, { pitched });
      mesh.position.set(bx, lift - 0.3, bz);
      mesh.rotation.y = chance(rng, 0.5) ? 0 : Math.PI / 2;
      group.add(mesh);
      buildings.push({ x: bx, z: bz, w, d, h, district: name });
      // Downtown towers get a glowing neon sign on one face.
      if (district && district.name === 'Downtown' && chance(rng, 0.55)) {
        const sign = new THREE.Mesh(
          new THREE.BoxGeometry(range(rng, 4, 9), range(rng, 1, 2.2), 0.4),
          mat(pick(rng, [0xff2e88, 0x2ec8ff, 0xffd23e]), pick(rng, [0xff2e88, 0x2ec8ff, 0xffd23e]), 1.8),
        );
        sign.position.set(bx + w / 2 + 0.3, h * range(rng, 0.45, 0.85), bz);
        group.add(sign);
      }
    }
  }

  // Streetlights at every second intersection.
  for (let i = 0; i < GRID_LINES.length; i += 2) {
    for (let j = 0; j < GRID_LINES.length; j += 2) {
      const x = GRID_LINES[i] + 7;
      const z = GRID_LINES[j] + 7;
      group.add(pole(x, z, 5.5, 0x555566));
      group.add(lampHead(x, z, 5.5, 0xffd9a0));
    }
  }

  // Beachfront: palm rows along the north shore.
  for (let i = 0; i < 16; i += 1) {
    const palm = makePalm();
    palm.position.set(-40 + i * 18 + range(rng, -4, 4), 0, -292 + range(rng, -3, 3));
    palm.rotation.y = rng() * Math.PI * 2;
    group.add(palm);
  }

  // Docks: stacked containers near the warehouses.
  for (let i = 0; i < 22; i += 1) {
    const container = makeContainer(pick(rng, [0xc23b2e, 0x2e7dc2, 0x3fae5a, 0xd9a03e, 0x8a8f96]));
    const cx = -260 + range(rng, 0, 130);
    const cz = 60 + range(rng, 0, 160);
    container.position.set(cx, 1.3 + (chance(rng, 0.3) ? 2.6 : 0), cz);
    container.rotation.y = chance(rng, 0.5) ? 0 : Math.PI / 2;
    group.add(container);
  }

  // Docks: three tall cranes.
  const craneSpots = [[-240, 90], [-190, 200], [-260, 220]];
  for (const [cx, cz] of craneSpots) {
    const crane = makeCrane();
    crane.position.set(cx, 0, cz);
    crane.rotation.y = range(rng, -0.6, 0.6);
    group.add(crane);
  }

  return { group, buildings, roads, districtAt, isOnRoad, randomRoadPoint, ground };
}
