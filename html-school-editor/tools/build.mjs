// Reproducible build: joins the source modules into one self-contained HTML file. Node standard library only.
//
//   node tools/build.mjs                          -> dist/school-editor.html (neutral public artefact)
//   node tools/build.mjs --check                  -> verifies that dist/school-editor.html matches the sources
//   node tools/build.mjs --brand local/brand.json -> additional locally branded copy (file is git-ignored)
//
// The modules are plain ES modules. The build removes their import lines and `export` keywords and wraps the
// concatenation in one function scope, so every top-level name must be unique across modules (checked below).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULES = ['util', 'tokenizer', 'tree', 'project', 'serialize', 'format', 'highlight', 'history', 'images', 'commands', 'app'];
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');

function bundle() {
  const seen = new Map();
  let js = '';
  for (const name of MODULES) {
    const lines = read(`src/js/${name}.js`).split('\n');
    const kept = [];
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (/^import\s/.test(line)) {
        if (!/;\s*$/.test(line)) throw new Error(`${name}.js:${i + 1}: an import must fit on one line`);
        continue;
      }
      line = line.replace(/^export\s+/, '');
      const m = /^(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/.exec(line);
      if (m) {
        if (seen.has(m[1])) throw new Error(`top-level name "${m[1]}" is defined in ${seen.get(m[1])}.js and ${name}.js`);
        seen.set(m[1], name);
      }
      kept.push(line);
    }
    js += `// ---- ${name}.js\n${kept.join('\n').trim()}\n\n`;
  }
  return `(function () {\n'use strict';\n${js.trim()}\n})();`;
}

function render(brand) {
  const js = bundle();
  if (/<\/script/i.test(js)) throw new Error('script source must not contain a closing script tag');
  const css = read('src/style.css').trim();
  if (/<\/style/i.test(css)) throw new Error('style source must not contain a closing style tag');
  let html = read('src/app.html');
  const fill = (key, value) => { html = html.split(key).join(value); };
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  fill('__APP_NAME__', esc(brand.name));
  fill('__APP_SUB__', esc(brand.sub));
  fill('__APP_ID__', 'html-school-editor');
  fill('__VERSION__', pkg.version);
  fill('__CSS__', css);
  // The script element's text is everything between the tags, including the line breaks of the template.
  const hash = crypto.createHash('sha256').update('\n' + js + '\n', 'utf8').digest('base64');
  fill('__CSP__', `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'`);
  fill('__JS__', js);
  if (/__[A-Z_]+__/.test(html.replace(js, ''))) throw new Error('unfilled placeholder in template');
  return html;
}

const args = process.argv.slice(2);
const neutral = { name: 'HTML-Schuleditor', sub: 'Webseiten schreiben und verstehen' };
const out = path.join(root, 'dist', 'school-editor.html');
const html = render(neutral);
const describe = (file, text) => `${path.relative(root, file).replace(/\\/g, '/')}  ${Buffer.byteLength(text, 'utf8')} bytes  sha256 ${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;

if (args.includes('--check')) {
  const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (current !== html) { console.error('dist/school-editor.html does not match the sources; run: node tools/build.mjs'); process.exit(1); }
  console.log('up to date: ' + describe(out, html));
} else {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log('built ' + describe(out, html));
  const at = args.indexOf('--brand');
  if (at >= 0) {
    const brand = JSON.parse(fs.readFileSync(path.resolve(args[at + 1]), 'utf8'));
    const target = path.resolve(path.dirname(path.resolve(args[at + 1])), brand.file);
    const branded = render({ name: String(brand.name), sub: String(brand.sub || '') });
    fs.writeFileSync(target, branded);
    console.log('built local edition: ' + path.basename(target) + '  ' + Buffer.byteLength(branded, 'utf8') + ' bytes');
  }
}
