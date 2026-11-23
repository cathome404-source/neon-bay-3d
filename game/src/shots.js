// Screenshot staging for Neon Bay 3D: fixed, reproducible scenes behind the
// four dossier images — the city cover, a fast drive, the helicopter chase,
// and a mission moment. Exports: createShots, SHOT_NAMES.

export const SHOT_NAMES = ['cover', 'drive', 'chase', 'mission'];

function putPlayerInCar(actors, vehicle, x, z, heading) {
  const player = actors.player;
  vehicle.mesh.position.set(x, 0, z);
  vehicle.heading = heading;
  vehicle.mesh.rotation.y = heading;
  vehicle.speed = 0;
  player.car = vehicle;
  player.onFoot = false;
  player.mesh.visible = false;
  player.heading = heading;
  player.pos.set(x, 0, z);
}

function putPlayerOnFoot(actors, x, z, heading) {
  const player = actors.player;
  player.pos.set(x, 0, z);
  player.heading = heading;
  player.mesh.rotation.y = heading;
  player.mesh.visible = true;
  player.onFoot = true;
  player.car = null;
}

export function createShots(renderer, actors, missions, world) {
  function applyShot(name) {
    const downtown = { x: -120, z: -120 };
    if (name === 'cover') {
      // Wide dusk view over Downtown: the player stands on a road at the
      // district edge while the towers and neon fill the frame.
      putPlayerOnFoot(actors, -60, -60, Math.PI * 0.75);
      renderer.setShot('cover');
      return true;
    }
    if (name === 'drive') {
      // The player drives a parked car along a Downtown road at speed.
      const car = actors.parkedCars[0];
      putPlayerInCar(actors, car, -120, -60, 0);
      car.speed = 24;
      renderer.setShot('drive');
      return true;
    }
    if (name === 'chase') {
      // Three stars: the helicopter rises and hovers ahead of the player,
      // and the camera aims high enough to keep it in frame.
      const car = actors.parkedCars[0];
      putPlayerInCar(actors, car, -120, 0, 0);
      car.speed = 20;
      actors.setWanted(3);
      renderer.setShot('chase');
      return true;
    }
    if (name === 'mission') {
      // Mission one is live and the player stands near its first target.
      if (missions.index < 0) missions.startNext();
      const marker = missions.currentMarker();
      if (marker) {
        putPlayerOnFoot(actors, marker.x + 10, marker.z + 8, Math.atan2(
          marker.x - (marker.x + 10), marker.z - (marker.z + 8),
        ));
      } else {
        putPlayerOnFoot(actors, downtown.x, downtown.z, 0);
      }
      renderer.setShot('mission');
      return true;
    }
    return false;
  }

  return { applyShot };
}
