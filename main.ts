// Neon Bay 3D (a working gta6-01 entry, Node 22, standard library only): the game is
// this directory's game/ folder, plain static files a desktop browser loads offline
// (game/index.html and its ES modules, three.js vendored under game/vendor/, no network
// request), and the program hands it in. It copies game/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library. The game itself: an original 3D open-world crime
// game — a sun-soaked coastal city (downtown, beachfront, docks, the Hills, a causeway
// bridge), third-person on-foot and driving, car stealing, a 5-star wanted system with
// pursuit cars, RAM/PIT interceptors, a police helicopter, roadblocks and SWAT, ten story
// missions, four weapon tiers with a weapon wheel, a garage with upgrades, crew abilities,
// respect ranks, a synth radio, cash drops, burning/exploding cars, and save/load — all
// rendered with three.js and synthesised WebAudio sound.
//
// Polish pass (recorded build 2): body roll + brake lights on every car, a speed
// FOV kick in the chase camera, neon signs on the downtown towers, lead-targeting
// police pursuit, mission barks and rival taunts, a low-health vignette, district
// labels on the minimap, skid/door sounds, a bus in traffic, and a staged chase
// shot where the NEON-1 helicopter is actually in frame.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
