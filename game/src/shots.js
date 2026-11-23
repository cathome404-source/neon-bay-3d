// Neon Bay 3D — screenshot scenes behind ?shot=cover|drive|chase|mission.
// Each one stages a real game state (cars, police, heli, mission) and then lets
// the simulation run a few seconds with a scripted driver, so the frame is what
// a short game really looks like. Same seed, same frame.
import { MISSIONS } from './config.js';
import { Car } from './vehicles.js';

// Drive forward, steering toward a waypoint. Returns {throttle, steer, handbrake}.
// Stops (handbrake) once close to the waypoint, so the car never overshoots it.
// laneX: if given, the car first steers back to that road/bridge centerline when
// it has been shoved off it (police rams), so bridge shots stay on the bridge.
// maxSpeed (m/s): cap so the scripted steering can hold a lane at low fps.
function driveAutopilot(G, tx, tz, laneX, maxSpeed) {
  const car = G.player.inCar;
  if (!car) return { throttle: 0, steer: 0, handbrake: false };
  let ax = tx, az = tz;
  if (laneX !== undefined && Math.abs(car.x - laneX) > 4) {
    ax = laneX;
    az = car.z + 25 * Math.sign(tz - car.z);
  }
  const dx = ax - car.x, dz = az - car.z;
  if (dx * dx + dz * dz < 144) return { throttle: 0, steer: 0, handbrake: true };
  const desired = Math.atan2(dz, dx);
  let d = desired - car.heading;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  // Cap the speed so the slow scripted steering can hold a lane (at high
  // speed a police ram shoves the car off the bridge deck).
  const cap = maxSpeed !== undefined ? maxSpeed : 28;
  const throttle = car.speed > cap ? 0 : 1;
  return { throttle, steer: Math.max(-1, Math.min(1, d * 1.8)), handbrake: false };
}

// Put the player in a car, keeping Player.inCar and Game.playerCar in sync.
function putPlayerInCar(G, car) {
  const li = G.looseCars.indexOf(car);
  if (li >= 0) G.looseCars.splice(li, 1);
  G.player.inCar = car;
  G.playerCar = car;
  G.ctx.playerCar = car;
  G.player.x = car.x;
  G.player.z = car.z;
}

export function setupShot(name, G) {
  const P = G.player;
  const M = G.missions;
  G.renderer.setDusk(0);
  if (name === 'drive') {
    // On foot at the south beach, city behind, mission 3 active.
    P.x = 0; P.z = 300; P.heading = -Math.PI / 2; // facing north, toward the city
    P.inCar = null;
    G.playerCar = null;
    M.start(2, G.ctx);
    G.renderer.setDusk(0.15);
    G.camYaw = -Math.PI / 2; // camera behind the player, looking north at the city
    return { autopilot: null, settle: 2.0 };
  }
  if (name === 'chase') {
    // Speeding north across the causeway bridge, 3 stars, heli + police + roadblock, dusk.
    // Starts just before the bridge and drives slowly (60 km/h) so the
    // scripted steering holds the 16m-wide deck against police rams.
    G.renderer.setDusk(0.7);
    const car = G.spawnPlayerCar('sports', 0xe86a20, -35, -230, -Math.PI / 2);
    putPlayerInCar(G, car);
    G.police.setWanted(3, 'shot setup');
    G.police.spawnHeli(P);
    // Lower the heli for this shot (the bridge has no buildings above it),
    // so it sits inside the camera frame instead of above it.
    if (G.police.heli) G.police.heli.hoverY = 30;
    for (let i = 0; i < 2; i += 1) G.police.spawnPursuit(P, i === 1);
    G.police.spawnRoadblock({ x: -35, z: -295 }, -Math.PI / 2);
    // The roadblock sits 10m PAST the autopilot stop point, so the car
    // halts on the bridge with the roadblock visible ahead instead of
    // swerving around it and off the deck.
    M.start(4, G.ctx);
    return { autopilot: () => driveAutopilot(G, -35, -285, -35, 17), settle: 3.0 };
  }
  if (name === 'mission') {
    // Bank Job in progress downtown: rivals at the bank, cash drops, 2 stars.
    const car = G.spawnPlayerCar('sedan', 0x2e6fc2, 60, 60, -Math.PI / 2);
    putPlayerInCar(G, car);
    M.start(7, G.ctx);
    // Advance to the takedown step: complete goto by teleporting close.
    G.police.setWanted(2, 'bank alarm');
    G.police.spawnPursuit(P, false);
    G.police.spawnPursuit(P, false);
    return { autopilot: () => driveAutopilot(G, 35, 35), settle: 3.0 };
  }
  // cover (default): downtown, sports car, 2 stars, 3 police, mission 1 active.
  const car = G.spawnPlayerCar('sports', 0xe86a20, 35, 80, -Math.PI / 2);
  putPlayerInCar(G, car);
  G.police.setWanted(2, 'shot setup');
  // Two parked units angled across the road ahead (roadblock look, player drives
  // between them) + one normal pursuer closing from behind.
  G.police.spawnAt(41, -270, P, false, { heading: -Math.PI / 2 + 0.5, speed: 0, hold: true });
  G.police.spawnAt(29, -285, P, false, { heading: -Math.PI / 2 - 0.5, speed: 0, hold: true });
  G.police.spawnAt(105, -180, P, false); // flanking pursuer from the east
  M.start(0, G.ctx);
  return { autopilot: () => driveAutopilot(G, 35, -245, 35), settle: 3.0 };
}
