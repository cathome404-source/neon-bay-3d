// Build script for Neon Bay 3D: copies game/ and screenshots/ into the
// output directory and writes output/dossier.json via the kit's buildDossier.
// Imports: buildDossier from ./vendor/makefun-game.ts; fs, path, url from Node.

import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
mkdirSync(outDir, { recursive: true });

const gameDir = path.join(here, 'game');
const shotsDir = path.join(here, 'screenshots');

cpSync(gameDir, path.join(outDir, 'game'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, path.join(outDir, 'screenshots'), { recursive: true });
}

const dossierBytes = buildDossier(outDir, {
  text_max_bytes: 1048576,
  screenshots: { max: 4, max_bytes: 262144 },
});
writeFileSync(path.join(outDir, 'dossier.json'), dossierBytes);

console.log(`Neon Bay 3D built into ${outDir}`);
