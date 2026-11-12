"""Loopback-only review server emulating a Joomla subdirectory layout (/sub/), with network edge cases."""
import json, sys, time, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, unquote

PROJECT, REVIEW = Path(sys.argv[1]), Path(sys.argv[2])
MOUNTS = {'/sub/media/mod_pdfbook/': PROJECT / 'media', '/sub/images/': REVIEW / 'site/images', '/sub/page/': REVIEW / 'pages'}
CSP = {
    'default': "default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' blob:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'strictstyle': "default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' blob:; style-src 'self'; object-src 'none'; base-uri 'none'",
    'nonce': "default-src 'self'; script-src 'nonce-r3v13w' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'",
}
LOG = REVIEW / 'requests.jsonl'
lock = threading.Lock()
EIGHT = (REVIEW / 'site/images/eight.pdf').read_bytes()

class H(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.pdf': 'application/pdf'}
    def log(self, status):
        with lock, LOG.open('a', encoding='utf-8') as f:
            f.write(json.dumps({'t': time.time(), 'path': self.path, 'status': status, 'cookie': bool(self.headers.get('Cookie')), 'ref': self.headers.get('Referer'), 'origin': self.headers.get('Origin')}) + '\n')
    def end_headers(self):
        q = urlsplit(self.path).query
        self.send_header('Content-Security-Policy', CSP.get(q.split('csp=')[-1] if 'csp=' in q else 'default', CSP['default']))
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()
    def send_response(self, code, message=None):
        self.log(code); super().send_response(code, message)
    def log_message(self, *a): pass
    def translate_path(self, path):
        p = unquote(urlsplit(path).path)
        for prefix, root in MOUNTS.items():
            if p.startswith(prefix):
                target = (root / p[len(prefix):]).resolve()
                if root.resolve() in target.parents or target == root.resolve():
                    return str(target)
        return str(REVIEW / '__nonexistent__')
    def do_GET(self):
        p = urlsplit(self.path).path
        if p.startswith('/sub/images/special/'):
            return self.special(p.rsplit('/', 1)[-1])
        if p == '/sub/set-cookie':
            self.send_response(200); self.send_header('Set-Cookie', 'joomla_session=secret; Path=/; SameSite=Lax'); self.send_header('Content-Length', '2'); self.end_headers(); self.wfile.write(b'ok'); return
        return super().do_GET()
    def special(self, name):
        try:
            if name == 'redirect.pdf':
                self.send_response(302); self.send_header('Location', '/sub/images/eight.pdf'); self.send_header('Content-Length', '0'); self.end_headers(); return
            if name == 'e500.pdf':
                self.send_response(500); self.send_header('Content-Type', 'text/html'); self.send_header('Content-Length', '5'); self.end_headers(); self.wfile.write(b'error'); return
            if name == 'html-mime.pdf':
                self.send_response(200); self.send_header('Content-Type', 'text/html'); self.send_header('Content-Length', str(len(EIGHT))); self.end_headers(); self.wfile.write(EIGHT); return
            if name == 'slow.pdf':   # ~45 s for the full file
                self.send_response(200); self.send_header('Content-Type', 'application/pdf'); self.send_header('Content-Length', str(len(EIGHT))); self.end_headers()
                step = max(1, len(EIGHT) // 45)
                for i in range(0, len(EIGHT), step): self.wfile.write(EIGHT[i:i + step]); self.wfile.flush(); time.sleep(1)
                return
            if name == 'hang.pdf':
                self.send_response(200); self.send_header('Content-Type', 'application/pdf'); self.send_header('Content-Length', '100000'); self.end_headers(); self.wfile.write(b'%PDF-1.7\n'); self.wfile.flush(); time.sleep(60); return
            if name in ('big-nolen.pdf', 'big-len.pdf'):
                size = 33 * 1024 * 1024
                self.send_response(200); self.send_header('Content-Type', 'application/pdf')
                if name == 'big-len.pdf': self.send_header('Content-Length', str(size))
                else: self.send_header('Connection', 'close')
                self.end_headers(); self.wfile.write(b'%PDF-1.7\n'); chunk = b'0' * 65536
                for _ in range(size // 65536): self.wfile.write(chunk)
                return
            self.send_response(404); self.send_header('Content-Length', '0'); self.end_headers()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            self.log('client-aborted')

if __name__ == '__main__':
    LOG.write_text('')
    print('review server http://127.0.0.1:8766/sub/page/two.html', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8766), H).serve_forever()
