// Publication hygiene for this repository. Node standard library only.
//   node tools/check_publication.mjs [--denylist <file outside the repository>]
// Checks every file a commit would contain (tracked and untracked-but-not-ignored):
//   * no local absolute paths, personal e-mail addresses or credential-like strings
//   * no analysis working files of the reference product (case files, inventories, original sources)
//   * no binary files and nothing above 1 MiB
//   * optional private deny-list: one case-insensitive term per line, "re:" prefix = regular expression.
//     The list names what must not be published, so it has to live outside the repository.
// Exit code 0 = clean, 1 = findings, 2 = usage error.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const listArg = args.indexOf('--denylist') >= 0 ? args[args.indexOf('--denylist') + 1] : process.env.PUBLICATION_DENYLIST;
const rules = [
  ['local path', /[A-Za-z]:[\\/]+(?:Users|Documents and Settings)[\\/]|\\Users\\[^\\\s]+\\|\/Users\/[A-Za-z]|\/home\/[a-z]|AppData[\\/]/i],
  ['e-mail', /\b[A-Za-z0-9._%+-]+@(?![A-Za-z0-9.-]*\b(?:example(?:\.com|\.org|\.net)?|test|invalid|localhost)\b)(?!users\.noreply\.github\.com\b|anthropic\.com\b)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/],
  ['credential', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})|-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];
const forbiddenNames = new Set(['case.md', 'local_handoff.md', 'inventory.json', 'provenance.md']);
const forbiddenDirs = new Set(['target', 'l2a-cases', 'local']);
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, (ch) => String.fromCharCode(92) + ch);

if (listArg) {
  const file = path.resolve(listArg);
  if (file.startsWith(root + path.sep)) { console.error('the deny-list must live outside the repository'); process.exit(2); }
  let n = 0;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    n++;
    rules.push(['deny-list #' + n, new RegExp(line.startsWith('re:') ? line.slice(3) : escapeRegExp(line), 'i')]);   // the term itself is never printed
  }
}

const files = execFileSync('git', ['ls-files', '-z', '-c', '-o', '--exclude-standard'], { cwd: root }).toString('utf8').split('\0').filter(Boolean).sort();
const findings = [];
for (const rel of files) {
  const parts = rel.split('/');
  if (forbiddenNames.has(parts[parts.length - 1].toLowerCase()) || parts.slice(0, -1).some((p) => forbiddenDirs.has(p.toLowerCase()))) findings.push(`${rel}: analysis working file or private folder`);
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;
  const bytes = fs.readFileSync(full);
  if (bytes.length > 1024 * 1024) findings.push(`${rel}: larger than 1 MiB`);
  if (bytes.includes(0)) { findings.push(`${rel}: binary file`); continue; }
  const lines = bytes.toString('utf8').split('\n');
  for (const [name, re] of rules) {
    if (re.test(rel)) findings.push(`${rel}: ${name} in file name`);
    for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) { findings.push(`${rel}:${i + 1}: ${name}`); break; }
  }
}
for (const f of findings) console.log(f);
console.log(`${files.length} files checked, ${rules.length} rules, ${findings.length} finding(s)`);
process.exit(findings.length ? 1 : 0);
