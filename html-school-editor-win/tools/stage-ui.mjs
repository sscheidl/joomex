// Copies the files of the user interface, as listed in ui/resources.json, into a folder with the layout
// the program serves (for tests). Usage: node tools/stage-ui.mjs <target folder>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function uiFiles() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'ui', 'resources.json'), 'utf8')).files;
}

export function stageUi(target) {
  fs.rmSync(target, { recursive: true, force: true });
  for (const [served, source] of Object.entries(uiFiles())) {
    const to = path.join(target, served);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(ROOT, source), to);
  }
  return target;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(stageUi(path.resolve(process.argv[2] || path.join(ROOT, 'tests', '.stage', 'ui'))));
}
