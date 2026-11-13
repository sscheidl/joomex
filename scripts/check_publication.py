"""Publication guard for this public repository (see RULES.md). Standard library only.

Checks every file that a commit would contain (tracked files plus untracked files that are not ignored),
and optionally release archives given with --zip. An archive must contain exactly the package files of one project
(as listed by that project's scripts/build.py package_files()), each a regular file byte-identical to its committed
source file; any other, missing, duplicate or changed entry, any directory, symlink or special-file entry, and package
sources that differ from HEAD are findings. Entry count and declared sizes are bounded before anything is read. This does
not depend on the archive's compression. The check imports each project's build.py: run it only on a trusted checkout.

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
from collections import Counter
from pathlib import Path

MAX_BYTES = 1024 * 1024
TEXT_SUFFIXES = {'.md', '.txt', '.php', '.xml', '.mjs', '.js', '.css', '.html', '.py', '.json', '.svg', '.yml', '.yaml', '.ini', '.gitignore', ''}
GENERIC = [
    ('local path', re.compile(r'[A-Za-z]:[\\/]+(?:Users|Documents and Settings)[\\/]|\\Users\\[^\\\s]+\\|/Users/[A-Za-z]|/home/[a-z]|AppData[\\/]', re.I)),
    ('e-mail', re.compile(r'\b[A-Za-z0-9._%+-]+@(?![A-Za-z0-9.-]*\b(?:example(?:\.com|\.org|\.net)?|test|invalid|localhost)\b)(?!users\.noreply\.github\.com\b|anthropic\.com\b)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b')),
    ('credential', re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})|-----BEGIN [A-Z ]*PRIVATE KEY-----')),
]
MAX_ARCHIVE_ENTRIES = 5000
MAX_ARCHIVE_ENTRY = 64 * 1024 * 1024
MAX_ARCHIVE_BYTES = 256 * 1024 * 1024
FORBIDDEN_NAMES = {'case.md', 'l2a-imports.json', 'provenance.md', 'inventory.json'}
FORBIDDEN_DIRS = {'target', 'l2a-cases', '.tools'}


def tracked_files(root: Path) -> set[str]:
    """Only files committed to the index; archive membership must not come from untracked files (N18-3)."""
    out = subprocess.run(['git', 'ls-files', '-z', '-c'], cwd=root, check=True, capture_output=True).stdout
    return {p.decode('utf-8', 'surrogateescape') for p in out.split(b'\0') if p}


def modified_files(root: Path) -> set[str]:
    """Tracked files whose working-tree content differs from HEAD (staged or not)."""
    out = subprocess.run(['git', 'diff', '--name-only', '-z', 'HEAD'], cwd=root, check=True, capture_output=True).stdout
    return {p.decode('utf-8', 'surrogateescape') for p in out.split(b'\0') if p}


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


def expected_packages(root: Path, tracked: set[str]) -> dict[str, dict[str, Path]]:
    """Per project with scripts/build.py: archive name -> tracked source file, from the build's own package_files()."""
    import importlib.util
    projects = {}
    for build in sorted(root.glob('*/scripts/build.py')):
        spec = importlib.util.spec_from_file_location(f'_build_{build.parent.parent.name}', build)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        project = build.parent.parent
        projects[project.name] = {name: path for name, path in module.package_files(project).items()
                                  if path.resolve().relative_to(root.resolve()).as_posix() in tracked}
    return projects


def check_archive(root: Path, z: Path, tracked: set[str], rules, findings: list[str], changed: set[str] = frozenset()) -> None:
    """A release archive must contain exactly the tracked package files of one project, byte for byte (R3).

    This covers vendor files (their source files are hash-pinned in dependencies.json and checked above), rejects
    binaries and any other file that is not in the source, missing files, duplicate names and unsafe paths, and
    does not depend on how the archive was compressed (R4)."""
    label = z.name
    try:
        archive = zipfile.ZipFile(z)
    except (zipfile.BadZipFile, OSError) as error:
        findings.append(f'{label}: not a readable ZIP archive ({error})')
        return
    with archive:
        infos = archive.infolist()
        # Bounds before anything is read (N18-1): entry count and declared sizes.
        if len(infos) > MAX_ARCHIVE_ENTRIES:
            findings.append(f'{label}: {len(infos)} entries, more than {MAX_ARCHIVE_ENTRIES}')
            return
        if sum(i.file_size for i in infos) > MAX_ARCHIVE_BYTES or any(i.file_size > MAX_ARCHIVE_ENTRY for i in infos):
            findings.append(f'{label}: declared uncompressed size above the limits ({MAX_ARCHIVE_ENTRY} per entry, {MAX_ARCHIVE_BYTES} in total)')
            return
        names = [i.filename for i in infos]
        for n, count in sorted(Counter(names).items()):
            if count > 1:
                findings.append(f'{label}!{n}: duplicate entry')
        for n in names:
            if n.startswith('/') or '..' in n.split('/') or '\\' in n or ':' in n:
                findings.append(f'{label}!{n}: unsafe path')
        for info in infos:
            # The builder writes regular files only: no directory records (also not "./"), symlinks or special files (N18-1, N18-2).
            mode = info.external_attr >> 16
            if info.is_dir() or info.external_attr & 0x10:
                findings.append(f'{label}!{info.filename}: directory entry' + (f' with {info.file_size} bytes of content' if info.file_size else ''))
            elif mode & 0o170000 not in (0, 0o100000):
                findings.append(f'{label}!{info.filename}: not a regular file (mode {oct(mode)})')
        projects = expected_packages(root, tracked)
        best = max(projects, key=lambda p: len(set(names) & set(projects[p])), default=None)
        expected = projects.get(best, {})
        if not expected or len(set(names) & set(expected)) < len(expected) / 2:
            findings.append(f'{label}: does not correspond to the package files of any project')
            expected = {}
        for n in sorted(set(expected) - set(names)):
            findings.append(f'{label}!{n}: missing (expected from {best})')
        for n, path in sorted(expected.items()):
            if path.resolve().relative_to(root.resolve()).as_posix() in changed:
                findings.append(f'{label}!{n}: its source file differs from HEAD; commit or restore it before checking an archive')
        for info in infos:
            n = info.filename
            if info.is_dir() or info.external_attr & 0x10:
                continue   # already a finding above
            try:
                data = archive.read(info)
            except (zipfile.BadZipFile, OSError, RuntimeError) as error:
                findings.append(f'{label}!{n}: unreadable entry ({error})')
                continue
            if expected and n in expected and data == expected[n].read_bytes():
                continue   # identical to a tracked source file, which the repository pass above has already checked
            if expected and n not in expected:
                findings.append(f'{label}!{n}: not a package file of {best}' + (' (binary)' if is_binary(data) else ''))
            elif expected:
                findings.append(f'{label}!{n}: differs from the source file')
            if not is_binary(data):
                scan_bytes(f'{label}!{n}', data, rules, findings)


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
    if args.zip:
        # Archive membership comes from committed files only, and a package source that differs from HEAD cannot
        # vouch for an archive's identity (N18-3).
        tracked = tracked_files(root)
        changed = modified_files(root)
        for z in args.zip:
            check_archive(root, Path(z), tracked, rules, findings, changed)
    for f in findings:
        print('FAIL', f)
    print(f'checked {len(files)} files' + (f' and {len(args.zip)} archive(s)' if args.zip else '') +
          f'; deny-list terms: {len(rules) - len(GENERIC)}; findings: {len(findings)}')
    return 1 if findings else 0


if __name__ == '__main__':
    sys.exit(main())
