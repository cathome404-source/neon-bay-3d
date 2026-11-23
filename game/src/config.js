// The single source of balance for Neon Bay 3D: every tuning number and
// colour lives here. Exports: TUNING (player, car, police, helicopter,
// weapons, economy, world and mission groups), DISTRICTS (Downtown,
// Beachfront, Docks, The Hills), MISSION_TITLES and RADIO_STATIONS.

export const TUNING = {
  player: {
    walkSpeed: 6,
    runSpeed: 9,
    maxHp: 100,
    punchDamage: 12,
    punchRange: 2.2,
    punchCooldown: 0.45,
    enterCarRange: 3.5,
    money: 250,
  },
  car: {
    accel: 16,
    brakeForce: 26,
    reverseSpeed: 9,
    maxSpeed: 42,
    steerSpeed: 1.9,
    grip: 0.92,
    bodyRoll: 0.06,
    maxHp: 100,
    enterOffset: 2.4,
  },
  police: {
    ramDamage: 2,
    ramCooldown: 2.0,
    chaseSpeed: 34,
    patrolSpeed: 14,
    spawnDistance: 55,
    maxChasers: 6,
    starsToShoot: 3,
    decaySeconds: 22,
  },
  helicopter: {
    hoverHeight: 22,
    aheadDistance: 32,
    orbitSpeed: 0.6,
    searchlightRange: 45,
    riseSpeed: 8,
  },
  weapons: {
    fists: { damage: 12, range: 2.2, fireRate: 2.2, ammo: Infinity, name: 'Fists' },
    pistol: { damage: 22, range: 60, fireRate: 3.0, ammo: 24, name: 'Pistol' },
    shotgun: { damage: 15, range: 26, fireRate: 1.1, ammo: 12, pellets: 6, name: 'Shotgun' },
    smg: { damage: 11, range: 45, fireRate: 9.0, ammo: 60, name: 'SMG' },
  },
  economy: {
    missionRewardMin: 250,
    missionRewardMax: 900,
    repairCost: 120,
    engineUpgradeCost: 800,
    armorUpgradeCost: 650,
    paintCost: 200,
    cashDropValue: 50,
    respectPerMission: 10,
  },
  world: {
    citySize: 600,
    roadSpacing: 60,
    blockSize: 48,
    sidewalkWidth: 4,
    dayLength: 300,
    duskStart: 0.55,
  },
  missions: {
    count: 10,
    markerRadius: 6,
    pickupRadius: 4,
  },
};

export const DISTRICTS = [
  {
    name: 'Downtown',
    centre: { x: -120, z: -120 },
    radius: 130,
    accent: 0xff2e88,
    minHeight: 40,
    maxHeight: 110,
    style: 'tall glass towers with neon signs and rooftop beacons',
  },
  {
    name: 'Beachfront',
    centre: { x: 150, z: -140 },
    radius: 110,
    accent: 0x2ec8ff,
    minHeight: 8,
    maxHeight: 26,
    style: 'low hotels, palm rows and a sandy shore along the north edge',
  },
  {
    name: 'Docks',
    centre: { x: -150, z: 140 },
    radius: 120,
    accent: 0xffb02e,
    minHeight: 10,
    maxHeight: 32,
    style: 'warehouses, stacked shipping containers and tall cranes',
  },
  {
    name: 'The Hills',
    centre: { x: 150, z: 150 },
    radius: 120,
    accent: 0x7dff5e,
    minHeight: 12,
    maxHeight: 34,
    style: 'houses on gentle slopes with winding streets and garden walls',
  },
];

export const MISSION_TITLES = [
  'First Pickup',
  'Hot Wheels',
  'Cash Run',
  'Shake the Tail',
  'Bridge Sprint',
  'Rival Crew',
  'Rescue Lena',
  'Bank Job',
  'Turf War',
  'The Big Score',
];

export const RADIO_STATIONS = [
  { name: 'Neon FM', tempo: 116, wave: 'sawtooth' },
  { name: 'Bay Chill', tempo: 84, wave: 'triangle' },
  { name: 'Night Drive', tempo: 100, wave: 'square' },
];
