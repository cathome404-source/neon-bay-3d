// Neon Bay 3D — shared constants: city layout, tuning, missions, names.
// All original: the city "Neon Bay", the player "Rex Marlowe", the crew "Vic & Lena".
export const WORLD = {
  roadSpacing: 70,      // distance between road centerlines
  roadHalf: 6,           // half width of a road
  roads: [-245, -175, -105, -35, 35, 105, 175, 245], // road centerlines, x and z
  cityHalf: 280,         // city edge; beach/docks beyond
  beachZ: 330,           // sand ends, water begins (south)
  dockX: 330,            // docks pier / water begins (east)
  waterNorthZ: -330,     // causeway water (north)
  blockHalf: 29,         // half size of a city block (roadSpacing - road width) / 2
};

// Four districts, each with its own standing (0-100) that rises when you work there.
export const DISTRICTS = [
  { name: 'Downtown', x0: -140, z0: -140, x1: 140, z1: 140, color: '#ffd76a' },
  { name: 'Beachfront', x0: -280, z0: 140, x1: 280, z1: 330, color: '#ff9a5c' },
  { name: 'Docks', x0: 140, z0: -280, x1: 330, z1: 280, color: '#7ac2ff' },
  { name: 'The Hills', x0: -280, z0: -280, x1: -140, z1: -140, color: '#b48cff' },
];
export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d;
  return DISTRICTS[0];
}

export const COLORS = {
  sky: 0xffd9a0,          // golden-hour sky
  skyTop: 0x7fb2e8,
  sun: 0xffe0b3,
  asphalt: 0x2e3138,
  asphaltLine: 0xd8d3c0,
  sidewalk: 0x8a7f72,
  sand: 0xe8cf9a,
  water: 0x2e7f9e,
  grass: 0x5d9450,
  buildingPalette: [0xa08a72, 0x8a9aa8, 0xc0a080, 0x9a8aa8, 0xb8a890, 0x7a9a80, 0xc0b0a0, 0x96887a],
  downtownPalette: [0x6a7a92, 0x7a8a9a, 0x8a7a8a, 0x5a6a7a, 0x9a8a72],
  carColors: [0xc23b2e, 0x2e6fc2, 0xe8b820, 0x2ea86a, 0xe8e8e8, 0x222222, 0x7a4ac2, 0xe86a20],
  taxi: 0xf2c200,
  police: 0x1a1a22,
  policeLight: 0xff2222,
};

export const TUNING = {
  walkSpeed: 9,
  runSpeed: 15,
  carAccel: 26,
  carBrake: 42,
  carMaxSpeed: 46,        // ~165 km/h
  carReverseMax: 14,
  carTurn: 1.9,           // rad/s at full lock, scaled by speed
  carGrip: 6.5,
  trafficSpeed: 11,
  trafficCount: 14,
  pedCount: 22,
  punchRange: 2.2,
  punchDamage: 34,
  pistolDamage: 34,
  pistolAmmoStart: 24,
  playerHp: 100,
  carHp: 100,
  wantedDecayTime: 22,    // seconds unseen before a star drops
  policeRamDamage: 3,
  heliMinWanted: 3,
  roadblockMinWanted: 4,
  swatMinWanted: 5,
};

// Four weapon tiers. 1/2/3/4 (or Q) switches; the wheel shows on Tab hold.
export const WEAPONS = [
  { name: 'Fists', key: '1', damage: 34, rate: 0.45, range: 2.4, ammo: Infinity, auto: false, spread: 0 },
  { name: 'Pistol', key: '2', damage: 34, rate: 0.28, range: 60, ammo: 24, auto: false, spread: 0.01 },
  { name: 'Shotgun', key: '3', damage: 22, rate: 0.85, range: 26, ammo: 12, auto: false, spread: 0.09, pellets: 6 },
  { name: 'SMG', key: '4', damage: 16, rate: 0.09, range: 45, ammo: 60, auto: true, spread: 0.05 },
];

// Garage upgrades (Vic's garage): engine speed, armor hp, paint. Bought with $.
export const UPGRADES = {
  engine: [
    { name: 'Stock Engine', cost: 0, maxSpeed: 46, accel: 26 },
    { name: 'Tuned Engine', cost: 600, maxSpeed: 54, accel: 32 },
    { name: 'Race Engine', cost: 1400, maxSpeed: 64, accel: 40 },
  ],
  armor: [
    { name: 'Stock Body', cost: 0, hp: 100 },
    { name: 'Reinforced Body', cost: 500, hp: 160 },
    { name: 'Armored Body', cost: 1200, hp: 240 },
  ],
  paint: [
    { name: 'Sunset Orange', cost: 0, color: 0xe86a20 },
    { name: 'Midnight Black', cost: 200, color: 0x181820 },
    { name: 'Bay Blue', cost: 200, color: 0x2e6fc2 },
    { name: 'Neon Pink', cost: 350, color: 0xff4fa3 },
    { name: 'Lime Rush', cost: 350, color: 0x9dff2e },
  ],
};

// Crew abilities, unlocked by respect. Lena spots cash drops on the minimap;
// Vic repairs your car free at the garage.
export const CREW = [
  { name: 'Vic — Free Repairs', respect: 15, desc: 'Vic fixes your car free at the garage.' },
  { name: 'Lena — Spotter', respect: 40, desc: 'Lena marks every cash drop on your minimap.' },
];

// 10 story missions. Steps: goto (reach marker), pickup (stand in marker),
// deliver (reach marker with cargo), collect (grab N drops), race (checkpoints
// in time), takedown (shoot N rivals), loseheat (get wanted to 0), claim
// (stand in a district marker to take turf), steal (steal a car), heat.
export const MISSIONS = [
  {
    title: 'First Pickup', giver: 'Vic',
    intro: 'Rex, welcome back to Neon Bay. A package waits at the east docks. Bring it to my garage. No questions.',
    steps: [
      { type: 'goto', label: 'Drive to the east docks', x: 300, z: 0 },
      { type: 'pickup', label: 'Pick up the package', x: 300, z: 0 },
      { type: 'deliver', label: 'Deliver the package to Vic\u2019s garage', x: -35, z: -35 },
    ],
    reward: 300, respect: 10,
    done: 'Clean run. The bay remembers a good driver, Rex.',
  },
  {
    title: 'Hot Wheels', giver: 'Vic',
    intro: 'A client wants a Comet GT, sunset orange, no questions asked. Steal one and bring it to the garage.',
    steps: [
      { type: 'steal', label: 'Steal a sports car (press E near one)', x: 105, z: 105 },
      { type: 'deliver', label: 'Deliver the Comet GT to the garage', x: -35, z: -35 },
    ],
    reward: 450, respect: 10,
    done: 'She purrs. You\u2019ve got the touch, kid.',
  },
  {
    title: 'Cash Run', giver: 'Lena',
    intro: 'Five cash drops stashed around downtown. The Tide crew is watching, so move fast and don\u2019t get caught.',
    steps: [
      { type: 'collect', label: 'Collect the cash drops', count: 5, spots: [[35, 35], [105, -35], [-105, 105], [175, 35], [-35, 175]] },
    ],
    reward: 500, respect: 15,
    done: 'Five for five. Lena owes you a drink.',
  },
  {
    title: 'Shake the Tail', giver: 'Vic',
    intro: 'The Bay PD is on you, Rex. Three stars. Lose them — hide, break line of sight, and stay quiet.',
    steps: [
      { type: 'heat', label: 'Get the heat on you', wanted: 3 },
      { type: 'loseheat', label: 'Lose the cops — stay out of sight', x: 0, z: 0 },
    ],
    reward: 550, respect: 15,
    done: 'Ghost. They never even saw your plates.',
  },
  {
    title: 'Bridge Sprint', giver: 'Lena',
    intro: 'North causeway, four gates, ninety seconds. Beat the clock and the Tide\u2019s best driver eats your dust.',
    steps: [
      { type: 'race', label: 'Race the causeway gates', time: 90, gates: [[-35, -245], [-35, -290], [35, -290], [105, -245]] },
    ],
    reward: 600, respect: 15,
    done: 'Ninety seconds of pure noise. The bridge is yours.',
  },
  {
    title: 'Rival Crew', giver: 'Vic',
    intro: 'The Tide crew set up at the east docks. Four of them. Take them out — fists or pistol, your call.',
    steps: [
      { type: 'takedown', label: 'Take out the Tide crew', count: 4, x: 300, z: 60 },
    ],
    reward: 700, respect: 20,
    done: 'The docks are quiet again. Nice shooting.',
  },
  {
    title: 'Rescue Lena', giver: 'Lena',
    intro: 'They grabbed me at the beach, Rex. Get me out and get me to the garage — and try not to die.',
    steps: [
      { type: 'goto', label: 'Reach Lena at the south beach', x: 0, z: 300 },
      { type: 'pickup', label: 'Pick up Lena', x: 0, z: 300 },
      { type: 'deliver', label: 'Drive Lena to the garage (2 stars on you)', x: -35, z: -35 },
    ],
    reward: 800, respect: 20,
    done: 'You came. I knew you would, Rex.',
  },
  {
    title: 'Bank Job', giver: 'Vic',
    intro: 'Downtown bank, lunch rush. Four guards, one vault, and a very loud alarm. Take the cash and run.',
    steps: [
      { type: 'goto', label: 'Reach the downtown bank', x: 35, z: 35 },
      { type: 'takedown', label: 'Take out the bank guards', count: 4, x: 35, z: 35 },
      { type: 'collect', label: 'Grab the vault cash', count: 3, spots: [[35, 35], [35, 45], [45, 35]] },
      { type: 'loseheat', label: 'Lose the 3-star heat', x: 0, z: 0 },
    ],
    reward: 1000, respect: 25,
    done: 'A million in small bills. The bank will never know what hit it.',
  },
  {
    title: 'Turf War', giver: 'Lena',
    intro: 'Three districts, three Tide flags. Plant ours in each one — and deal with anyone who objects.',
    steps: [
      { type: 'claim', label: 'Claim the Beachfront turf', x: 0, z: 210, district: 'Beachfront' },
      { type: 'claim', label: 'Claim the Docks turf', x: 210, z: 0, district: 'Docks' },
      { type: 'claim', label: 'Claim the Hills turf', x: -210, z: -210, district: 'The Hills' },
      { type: 'takedown', label: 'Take out the Tide enforcers', count: 3, x: -210, z: -210 },
    ],
    reward: 900, respect: 25,
    done: 'Three flags down. The bay flies our colors now.',
  },
  {
    title: 'The Big Score', giver: 'Vic',
    intro: 'One last job. Haul the truck to the docks, then vanish. Four stars, Rex. Make them count.',
    steps: [
      { type: 'goto', label: 'Get to the truck at the docks', x: 300, z: -60 },
      { type: 'deliver', label: 'Deliver the truck to the north pier', x: -105, z: -290 },
      { type: 'loseheat', label: 'Lose the 4-star heat', x: 0, z: 0 },
    ],
    reward: 1500, respect: 30,
    done: 'The Big Score is done. Neon Bay is yours now, Kingpin.',
  },
];

export const RANKS = ['Rookie', 'Hustler', 'Wheelman', 'Street King', 'Kingpin'];
export function rankFor(respect) {
  if (respect >= 100) return 'Kingpin';
  if (respect >= 70) return 'Street King';
  if (respect >= 40) return 'Wheelman';
  if (respect >= 15) return 'Hustler';
  return 'Rookie';
}
