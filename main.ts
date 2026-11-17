// Dusthaven — main.ts (the entrypoint)
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-game.ts. Node standard library only, no network, no
// timestamps and no randomness: two runs write byte-identical output.
// The output directory itself is only created, never removed, because
// the grader runs as a user that cannot delete it.
import { buildDossier } from './vendor/makefun-game.ts';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const REPO_DIR = new URL('.', import.meta.url).pathname;

function copyTree(srcDir: string, dstDir: string): void {
  mkdirSync(dstDir, { recursive: true });
  const entries = readdirSync(srcDir).sort();
  for (const name of entries) {
    const src = join(srcDir, name);
    const dst = join(dstDir, name);
    const st = statSync(src);
    if (st.isDirectory()) {
      copyTree(src, dst);
    } else if (st.isFile()) {
      copyFileSync(src, dst);
    }
  }
}

function main(): void {
  const gameSrc = join(REPO_DIR, 'game');
  const shotsSrc = join(REPO_DIR, 'screenshots');
  mkdirSync(OUT_DIR, { recursive: true });
  copyTree(gameSrc, join(OUT_DIR, 'game'));
  if (existsSync(shotsSrc)) {
    copyTree(shotsSrc, join(OUT_DIR, 'screenshots'));
  } else {
    mkdirSync(join(OUT_DIR, 'screenshots'), { recursive: true });
  }
  const dossier = buildDossier(OUT_DIR, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(OUT_DIR, 'dossier.json'), dossier);
  console.log('Dusthaven dossier written: ' + join(OUT_DIR, 'dossier.json'));
}

main();
