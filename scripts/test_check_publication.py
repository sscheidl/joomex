"""Tests of the publication check's one exception for first-party graphics (issue #34). Standard library only.

Run from the repository root: python -m unittest scripts/test_check_publication.py
The end-to-end cases build a disposable Git repository in a temporary folder and run the real script there.
"""
from __future__ import annotations

import hashlib, importlib.util, json, subprocess, sys, tempfile, unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / 'check_publication.py'
spec = importlib.util.spec_from_file_location('check_publication', SCRIPT)
cp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cp)

PNG = b'\x89PNG\r\n\x1a\n' + b'\x00\x00\x00\rIHDR' + bytes(40)
WEBP = b'RIFF' + (40).to_bytes(4, 'little') + b'WEBPVP8 ' + bytes(32)
JPEG = b'\xff\xd8\xff\xe0' + bytes(40)
ICO = b'\x00\x00\x01\x00\x01\x00' + bytes(40)
EXE = b'MZ\x90\x00' + bytes(60)
sha = lambda data: hashlib.sha256(data).hexdigest()


class Units(unittest.TestCase):
    def test_paths(self):
        ok = ['html-school-editor-win/ui/assets/ninja-hero.webp', 'html-school-editor-win/ui/assets/a-1.png',
              'html-school-editor-win/ui/assets/x.jpg', 'html-school-editor-win/src/win/markup-ninja.ico']
        bad = ['html-school-editor-win/ui/assets/sub/x.png', 'html-school-editor-win/ui/assets/../x.png',
               'html-school-editor-win/ui/assets/Hero.png', 'html-school-editor-win/ui/assets/x.svg',
               'html-school-editor-win/ui/assets/x.exe', 'html-school-editor-win/ui/x.png', 'html-school-editor-win/src/win/other.ico',
               'html-school-editor/assets/x.png', 'pdf-book/ui/assets/x.png', 'html-school-editor-win/ui/assets/.png',
               'html-school-editor-win/ui/assets/x.png.exe', '/html-school-editor-win/ui/assets/x.png']
        for name in ok:
            self.assertTrue(cp.branding_path_ok(name), name)
        for name in bad:
            self.assertFalse(cp.branding_path_ok(name), name)

    def test_signatures(self):
        self.assertEqual(cp.signature_type(PNG), 'png')
        self.assertEqual(cp.signature_type(WEBP), 'webp')
        self.assertEqual(cp.signature_type(JPEG), 'jpeg')
        self.assertEqual(cp.signature_type(ICO), 'ico')
        self.assertIsNone(cp.signature_type(EXE))
        self.assertIsNone(cp.signature_type(b'\x00\x00\x01\x00\x00\x00'))   # an icon directory without images
        self.assertIsNone(cp.signature_type(b'RIFF\x00\x00\x00\x00WAVE'))

    def test_problems(self):
        entry = {'sha256': sha(PNG), 'max_bytes': 1000}
        self.assertEqual(cp.branding_problem('html-school-editor-win/ui/assets/a.png', PNG, entry), '')
        self.assertIn('not a png', cp.branding_problem('html-school-editor-win/ui/assets/a.png', EXE, {'sha256': sha(EXE), 'max_bytes': 1000}))
        self.assertIn('not a png', cp.branding_problem('html-school-editor-win/ui/assets/a.png', WEBP, {'sha256': sha(WEBP), 'max_bytes': 1000}))
        self.assertIn('SHA-256', cp.branding_problem('html-school-editor-win/ui/assets/a.png', PNG + b'x', entry))
        self.assertIn('cap', cp.branding_problem('html-school-editor-win/ui/assets/a.png', PNG, {'sha256': sha(PNG), 'max_bytes': 10}))


class EndToEnd(unittest.TestCase):
    """The real script in a disposable repository."""

    def run_check(self, files: dict[str, bytes], manifest: dict | None) -> tuple[int, str]:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            subprocess.run(['git', 'init', '-q'], cwd=root, check=True)
            for name, data in files.items():
                (root / name).parent.mkdir(parents=True, exist_ok=True)
                (root / name).write_bytes(data)
            if manifest is not None:
                path = root / cp.BRANDING_MANIFEST
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps({'files': manifest}), encoding='utf-8')
            r = subprocess.run([sys.executable, str(SCRIPT)], cwd=root, capture_output=True, text=True)
            return r.returncode, r.stdout

    def test_approved_assets_pass(self):
        files = {'html-school-editor-win/ui/assets/ninja-hero.webp': WEBP, 'html-school-editor-win/src/win/markup-ninja.ico': ICO,
                 'html-school-editor-win/ui/assets/logo.png': PNG, 'html-school-editor-win/ui/assets/photo.jpg': JPEG}
        manifest = {n: {'sha256': sha(d), 'max_bytes': 1000} for n, d in files.items()}
        code, out = self.run_check(files, manifest)
        self.assertEqual(code, 0, out)
        self.assertIn('findings: 0', out)

    def test_without_manifest_every_binary_is_refused(self):
        code, out = self.run_check({'html-school-editor-win/ui/assets/logo.png': PNG}, None)
        self.assertEqual(code, 1)
        self.assertIn('binary file outside verified vendor files', out)

    def test_negative_cases(self):
        cases = {
            'modified': ({'html-school-editor-win/ui/assets/a.png': PNG + b'x'}, {'html-school-editor-win/ui/assets/a.png': {'sha256': sha(PNG), 'max_bytes': 1000}}, 'SHA-256'),
            'renamed exe': ({'html-school-editor-win/ui/assets/a.png': EXE}, {'html-school-editor-win/ui/assets/a.png': {'sha256': sha(EXE), 'max_bytes': 1000}}, 'not a png'),
            'unlisted': ({'html-school-editor-win/ui/assets/b.png': PNG}, {}, 'binary file outside verified vendor files'),
            'other project': ({'pdf-book/ui/assets/a.png': PNG}, {'pdf-book/ui/assets/a.png': {'sha256': sha(PNG), 'max_bytes': 1000}}, 'outside the approved branding scope'),
            'nested': ({'html-school-editor-win/ui/assets/sub/a.png': PNG}, {'html-school-editor-win/ui/assets/sub/a.png': {'sha256': sha(PNG), 'max_bytes': 1000}}, 'outside the approved branding scope'),
            'dot dot': ({}, {'html-school-editor-win/ui/assets/../../x.png': {'sha256': sha(PNG), 'max_bytes': 1000}}, 'outside the approved branding scope'),
            'cap above 1 MiB': ({'html-school-editor-win/ui/assets/a.png': PNG}, {'html-school-editor-win/ui/assets/a.png': {'sha256': sha(PNG), 'max_bytes': 2 * 1024 * 1024}}, 'max_bytes'),
            'too large': ({'html-school-editor-win/ui/assets/a.png': PNG}, {'html-school-editor-win/ui/assets/a.png': {'sha256': sha(PNG), 'max_bytes': 8}}, 'cap'),
            'no hash': ({'html-school-editor-win/ui/assets/a.png': PNG}, {'html-school-editor-win/ui/assets/a.png': {'max_bytes': 1000}}, 'no valid sha256'),
            'missing': ({}, {'html-school-editor-win/ui/assets/a.png': {'sha256': sha(PNG), 'max_bytes': 1000}}, 'but missing'),
            'exe next to the icon': ({'html-school-editor-win/src/win/markup-ninja.exe': EXE}, {}, 'binary file outside verified vendor files'),
        }
        for label, (files, manifest, expected) in cases.items():
            with self.subTest(label):
                code, out = self.run_check(files, manifest)
                self.assertEqual(code, 1, out)
                self.assertIn(expected, out)

    def test_text_checks_still_apply(self):
        # an SVG in the asset folder stays a text file with every text check, e.g. no local paths
        local = ('C' + ':/' + 'Users/someone/x').encode()   # built here, so this file holds no local path itself
        code, out = self.run_check({'html-school-editor-win/ui/assets/logo.svg': b'<svg><!-- ' + local + b' --></svg>'}, {})
        self.assertEqual(code, 1, out)
        self.assertIn('local path', out)


if __name__ == '__main__':
    unittest.main()
