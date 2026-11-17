// main.ts — Porto Verde entrypoint: copies game/ and screenshots/ to the
// output directory and writes /output/dossier.json with buildDossier.
// Node 22 standard library only; deterministic: the same input writes the
// same bytes on every run. It only creates the output directory, never
// deletes it (the grader runs as uid 65534 and cannot delete /output).
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const rootDir = new URL('.', import.meta.url).pathname;

mkdirSync(outDir, { recursive: true });
cpSync(join(rootDir, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(rootDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log('Porto Verde: wrote dossier.json (' + dossier.length + ' bytes) to ' + outDir);
