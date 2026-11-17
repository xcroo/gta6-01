// SOLMARA — main.ts
// The entrypoint: copies game/ and screenshots/ into the output
// directory and writes dossier.json with buildDossier from the kit's
// vendor library. Standard library only; plain `node main.ts` runs it
// (type stripping, erasable syntax only).
//
// The output directory is MAKEFUN_OUTPUT_DIR, or /output. It is only
// ever created with mkdirSync — never removed — so the program also
// runs as uid 65534 against a fresh directory the grader prepared.

import { buildDossier } from './vendor/makefun-game.ts';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const REPO_DIR = new URL('.', import.meta.url).pathname;

function copyTree(srcDir: string, dstDir: string): void {
  mkdirSync(dstDir, { recursive: true });
  const entries = readdirSync(srcDir, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const src = join(srcDir, entry.name);
    const dst = join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(src, dst);
    } else if (entry.isFile()) {
      copyFileSync(src, dst);
    }
    // anything else (symlink, socket, ...) is skipped: game/ holds plain files only
  }
}

function main(): void {
  // Create the output directory if needed; never delete it.
  mkdirSync(OUT_DIR, { recursive: true });

  const gameSrc = join(REPO_DIR, 'game');
  const shotsSrc = join(REPO_DIR, 'screenshots');
  if (!existsSync(gameSrc) || !statSync(gameSrc).isDirectory()) {
    throw new Error('main.ts: no game/ directory in the repository');
  }
  copyTree(gameSrc, join(OUT_DIR, 'game'));
  if (existsSync(shotsSrc) && statSync(shotsSrc).isDirectory()) {
    copyTree(shotsSrc, join(OUT_DIR, 'screenshots'));
  }

  const dossier = buildDossier(OUT_DIR, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 256 * 1024 },
    game_max_files: 993,
    game_max_bytes: 48 * 1024 * 1024,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(OUT_DIR, 'dossier.json'), dossier);
  // The two grader runs must write the same bytes: the copy is a plain
  // sorted tree walk and buildDossier is deterministic over it.
  const written = statSync(join(OUT_DIR, 'dossier.json')).size;
  if (written !== dossier.length) throw new Error('main.ts: dossier.json size mismatch after write');
  console.log(`wrote ${OUT_DIR}/dossier.json (${dossier.length} bytes)`);
}

main();
