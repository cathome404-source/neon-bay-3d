# Neon Bay 3D

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/cathome404-source/neon-bay-3d/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/cathome404-source/neon-bay-3d/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Built for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on [make.fun](https://make.fun).

A browser game that drops you into a living 3D crime sandbox, rendered with three.js. Nothing here comes from Rockstar — the streets, the people, the dialogue and the story are all made up for this game. You are **Rex Marlowe**, a wheelman for hire in the seaside city of **Neon Bay**. Run jobs for Vic and Lena, stack cash and respect, and keep the law off your back while the sun sinks and the neon comes on.

## The city

Neon Bay sits on a 600×600-unit grid of roads, cut into four districts:

- **Downtown** — glass towers, glowing signs and rooftop beacons.
- **Beachfront** — low hotels, palm rows and a sandy shoreline.
- **Docks** — warehouses, cranes and towers of shipping containers.
- **The Hills** — houses climbing gentle slopes on twisty streets.

Cars flow along the roads, pedestrians use the sidewalks, and the sky shifts from golden afternoon to deep night as you play.

## What you can do

- **10 story missions** — First Pickup, Hot Wheels, Cash Run, Shake the Tail, Bridge Sprint, Rival Crew, Rescue Lena, Bank Job, Turf War and The Big Score. Vic at the garage and Lena the fixer talk you through each job, and finishing one pays cash and respect.
- **Wanted level, 0–5 stars** — patrol cars give chase, interceptors try to ram you off the road, and at 3 stars a helicopter with a searchlight joins the hunt. Slip out of sight and the heat fades.
- **4 weapon tiers** — Fists, Pistol, Shotgun and SMG, picked from the weapon wheel.
- **Vic's garage** — patch up your car, bolt on a stronger engine, add armor, or give it a new paint job. Once your respect hits 15 the repairs are on the house, and at respect 40 Lena starts watching your back.
- **Money and respect** — jobs pay $250–$900, and stray cash drops are hidden around town.
- **Radio** — three WebAudio stations (Neon FM, Bay Chill, Night Drive), flipped with M.
- **Save/load** — your progress lives in localStorage, so a session picks up where the last one ended.

## Controls

- **WASD** — walk / drive
- **Shift** — sprint / boost
- **Space** — brake / handbrake
- **E** — get in or out of a car
- **F** or **click** — punch / shoot (mouse aims)
- **1–4** or **Tab** — weapon wheel
- **M** — next radio station
- **G** — repair at Vic's garage when you are close to it
- **P** — pause

## How to run

Serve the folder and open `game/index.html`:

```sh
npx serve
# or
python3 -m http.server
```

`node main.ts` builds the dossier: it copies `game/` and `screenshots/` into the output folder and writes `dossier.json`.

## Screenshots

Four staged shots are in `screenshots/` — `1-cover.jpg` (the city at dusk), `2-drive.jpg` (a fast drive), `3-chase.jpg` (the helicopter on your tail) and `4-mission.jpg` (out on a job).

## Layout

- `game/index.html` — page shell and HUD
- `game/vendor/three.min.js` — three.js r149, vendored locally (no CDN)
- `game/src/config.js` — tuning numbers and districts
- `game/src/random.js` — seeded random helpers
- `game/src/input.js` — keyboard and mouse input
- `game/src/world.js` — city generation
- `game/src/models.js` — car, person and building meshes
- `game/src/vehicles.js` — driving and traffic
- `game/src/actors.js` — player, police, helicopter, pedestrians
- `game/src/missions.js` — the ten story missions
- `game/src/audio.js` — radio and sound effects
- `game/src/hud.js` — HUD, minimap and dialogue
- `game/src/render.js` — camera, lighting and chase framing
- `game/src/shots.js` — screenshot scenes
- `game/src/main.js` — boot and the game loop
