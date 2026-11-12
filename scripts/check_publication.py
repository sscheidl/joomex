"""Publication guard for this public repository (see RULES.md). Standard library only.

Checks every file that a commit would contain (tracked files plus untracked files that are not ignored),
and optionally release archives given with --zip:

* binary files only under */media/vendor/ and only when the file's SHA-256 matches that project's dependencies.json
* no file above 1 MiB unless it is such a verified vendor file
* no local absolute paths (user profiles, home directories), no e-mail addresses except example/noreply domains
* no credential-like strings (tokens, private keys)
* no legacy-analysis raw data (case files, original source or target trees)
* optional private deny-list (--denylist FILE or env JOOMEX_DENYLIST): one term per line, case-insensitive substring;
  lines starting with "re:" are regular expressions. The deny-list must live OUTSIDE the repository, because
  it names the very terms that must not be published.

Exit code 0 = clean, 1 = findings, 2 = usage error.
"""
from __future__ import annotations

import argparse, hashlib, json, os, re, subprocess, sys, zipfile
from pathlib import Path

MAX_BYTES = 1024 * 1024
TEXT_SUFFIXES = {'.md', '.txt', '.php', '.xml', '.mjs', '.js', '.css', '.html', '.py', '.json', '.svg', '.yml', '.yaml', '.ini', '.gitignore', ''}
GENERIC = [
    ('local path', re.compile(r'[A-Za-z]:[\\/]+(?:Users|Documents and Settings)[\\/]|\\Users\\[^\\\s]+\\|/Users/[A-Za-z]|/home/[a-z]|AppData[\\/]', re.I)),
    ('e-mail', re.compile(r'\b[A-Za-z0-9._%+-]+@(?![A-Za-z0-9.-]*\b(?:example(?:\.com|\.org|\.net)?|test|invalid|localhost)\b)(?!users\.noreply\.github\.com\b|anthropic\.com\b)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b')),
    ('credential', re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})|-----BEGIN [A-Z ]*PRIVATE KEY-----')),
]
FORBIDDEN_NAMES = {'case.md', 'l2a-imports.json', 'provenance.md', 'inventory.json'}
FORBIDDEN_DIRS = {'target', 'l2a-cases', '.tools'}


def repo_files(root: Path) -> list[str]:
    out = subprocess.run(['git', 'ls-files', '-z', '-c', '-o', '--exclude-standard'], cwd=root, check=True, capture_output=True).stdout
    return sorted({p.decode('utf-8', 'surrogateescape') for p in out.split(b'\0') if p})


def vendor_hashes(root: Path) -> dict[str, str]:
    allowed = {}
    for lock in root.glob('*/dependencies.json'):
        for name, spec in json.loads(lock.read_text(encoding='utf-8')).items():
            for entry in spec.get('files', []):
                allowed[f'{lock.parent.name}/media/vendor/{name}/{entry.get("shipped_as", entry["path"])}'] = entry['sha256']
    return allowed


def load_denylist(path: str | None, root: Path) -> list[tuple[str, re.Pattern]]:
    path = path or os.environ.get('JOOMEX_DENYLIST')
    if not path:
        return []
    p = Path(path).resolve()
    if root.resolve() in p.parents:
        sys.exit('deny-list must live outside the repository')
    terms = []
    for line in p.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        rx = re.compile(line[3:], re.I) if line.startswith('re:') else re.compile(re.escape(line), re.I)
        terms.append((f'deny-list #{len(terms) + 1}', rx))   # never print the term itself
    return terms


def scan_bytes(name: str, data: bytes, rules, findings: list[str]) -> None:
    text = data.decode('utf-8', 'replace')
    for label, rx in rules:
        for m in rx.finditer(text):
            line = text.count('\n', 0, m.start()) + 1
            findings.append(f'{name}:{line}: {label}')
            break


def is_binary(data: bytes) -> bool:
    return b'\0' in data[:8192]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--denylist')
    ap.add_argument('--zip', action='append', default=[], help='also scan a release archive')
    args = ap.parse_args()
    root = Path(subprocess.run(['git', 'rev-parse', '--show-toplevel'], check=True, capture_output=True, text=True).stdout.strip())
    rules = GENERIC + load_denylist(args.denylist, root)
    vendor = vendor_hashes(root)
    findings: list[str] = []
    files = repo_files(root)
    files = [name for name in files if (root / name).is_file()]   # tracked files deleted in the working tree are not published
    for name in files:
        parts = name.split('/')
        if parts[-1] in FORBIDDEN_NAMES or FORBIDDEN_DIRS & set(parts[:-1]):
            findings.append(f'{name}: analysis raw data or local tooling must stay local')
        data = (root / name).read_bytes()
        verified = vendor.get(name) == hashlib.sha256(data).hexdigest()
        if name in vendor and not verified:
            findings.append(f'{name}: vendor file does not match dependencies.json')
        if is_binary(data) and not verified:
            findings.append(f'{name}: binary file outside verified vendor files')
        if len(data) > MAX_BYTES and not verified:
            findings.append(f'{name}: larger than {MAX_BYTES} bytes')
        if not (verified and is_binary(data)):   # hash-pinned third-party binaries are not text-scanned
            scan_bytes(name, data, rules if not verified else rules[len(GENERIC):], findings)
    for z in args.zip:
        with zipfile.ZipFile(z) as archive:
            for info in archive.infolist():
                n = info.filename
                if n.startswith('/') or '..' in n.split('/') or '\\' in n or ':' in n:
                    findings.append(f'{z}!{n}: unsafe path')
                data = archive.read(info)
                if 'media/vendor/' in n and is_binary(data):
                    continue
                scan_bytes(f'{Path(z).name}!{n}', data, rules if 'media/vendor/' not in n else rules[len(GENERIC):], findings)
    for f in findings:
        print('FAIL', f)
    print(f'checked {len(files)} files' + (f' and {len(args.zip)} archive(s)' if args.zip else '') +
          f'; deny-list terms: {len(rules) - len(GENERIC)}; findings: {len(findings)}')
    return 1 if findings else 0


if __name__ == '__main__':
    sys.exit(main())
