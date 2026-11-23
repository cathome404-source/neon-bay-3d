# Neon Bay 3D

An original 3D open-world crime game in the browser, built with three.js for the make.fun GTA 6 bounty. No Rockstar material — every street, character and line is original.

You are **Rex Marlowe**, a driver-for-hire in the coastal city of **Neon Bay**. Take jobs from Vic at the garage and Lena the fixer, earn cash and respect, and stay ahead of the police as the day fades from golden afternoon into neon night.

## The city

Four districts across a 600×600-unit road grid:

- **Downtown** — tall glass towers, neon signs, rooftop beacons.
- **Beachfront** — low hotels, palm rows and a sandy shore.
- **Docks** — warehouses, stacked shipping containers and cranes.
- **The Hills** — houses on gentle slopes with winding streets.

## What is in the game

- **10 story missions** — pickups, chases, races, rescues and one big score, with dialogue from Vic and Lena.
- **Police wanted system, 0–5 stars** — patrol cars chase you, interceptors ram from 3 stars, a searchlight helicopter circles from 3 stars, roadblocks appear at 4 stars, SWAT at 5. Break line of sight and the heat cools off.
- **4 weapon tiers** — Fists, Pistol, Shotgun and SMG, switched with a weapon wheel (keys 1–4 or Tab).
- **Garage** — engine and armor upgrades, fresh paint and repairs.
- **Respect rank** — Vic repairs your car for free at respect 15; Lena spots for you at respect 40.
- **Radio** — three WebAudio stations (Neon FM, Bay Chill, Night Drive), switched with M.
- **Ambient cash drops**, traffic, pedestrians, save/load via localStorage.

## Controls

WASD move / drive · Shift sprint / boost · Space brake / handbrake · E enter or exit a car · F punch · mouse aim, click shoot · 1–4 / Tab weapon wheel · P pause · M radio station.

## Run it locally

```sh
node serve.ts
```

Then open http://localhost:8080 in a browser.

## Build

`main.ts` (Node, standard library only) copies `game/` and `screenshots/` into the output directory and writes `dossier.json` through the kit's `buildDossier`.

## Structure

- `game/index.html` — page shell and HUD
- `game/vendor/three.min.js` — three.js r149, vendored locally (no CDN)
- `game/src/config.js` — every tuning number and district
- `game/src/random.js` — seeded random helpers
- `game/src/input.js` — keyboard and mouse input
- `game/src/world.js` — city generation
- `game/src/models.js` — car, person and building meshes
- `game/src/vehicles.js` — driving and traffic
- `game/src/actors.js` — player, police, helicopter, pedestrians
- `game/src/missions.js` — the ten story missions
- `game/src/audio.js` — radio and sound effects
- `game/src/hud.js` — HUD, minimap and dialogue
- `game/src/render.js` — camera, lighting and the chase shot
- `game/src/shots.js` — screenshot scenes
- `game/src/main.js` — boot and the game loop
