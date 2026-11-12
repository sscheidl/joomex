<?php
// Runs the candidate's real Dispatcher.php + tmpl/default.php against minimal Joomla stubs.
// This is NOT Joomla: it only exercises our own code paths and produces HTML pages for browser tests.
declare(strict_types=1);
namespace Joomla\CMS\Dispatcher { abstract class AbstractModuleDispatcher {
    public function __construct(protected \stdClass $module, protected $app) {}
    protected function getLayoutData(): array { return ['module' => $this->module, 'app' => $this->app, 'params' => $this->module->params]; }
    public function getApplication() { return $this->app; } } }
namespace Joomla\CMS\Uri { final class Uri {
    public static string $root = 'http://127.0.0.1:8766/sub/';
    public static function root(bool $pathonly = false): string { return $pathonly ? rtrim(parse_url(self::$root, PHP_URL_PATH), '/') : self::$root; } } }
namespace ReviewStub {
final class Params { public function __construct(private array $v) {} public function get(string $k, $d = null) { return $this->v[$k] ?? $d; } }
final class Wam { public array $calls = [];
    public function registerAndUseStyle($n, $u, $o = []) { $this->calls[] = ['style', $n, $u, $o]; return $this; }
    public function registerAndUseScript($n, $u, $o = [], $a = []) { $this->calls[] = ['script', $n, $u, $o, $a]; return $this; } }
final class Doc { public Wam $wam; public function __construct() { $this->wam = new Wam(); } public function getWebAssetManager() { return $this->wam; } }
final class User { public function __construct(private bool $editor) {} public function authorise(string $a, string $b): bool { return $this->editor; } }
final class App { public Doc $doc; public function __construct(public ?User $user = null) { $this->doc = new Doc(); }
    public function getDocument() { return $this->doc; } public function getIdentity() { return $this->user; } }
}
namespace {
define('_JEXEC', 1);
[$_, $project, $site, $out] = $argv; define("REVIEW_PROJECT", $project);
define('JPATH_ROOT', $site);
require $project . '/module/src/Helper/Source.php';
require $project . '/module/src/Dispatcher/Dispatcher.php';
use Joomex\Module\Pdfbook\Site\Dispatcher\Dispatcher;
function module(ReviewStub\App $app, string $title, array $params): string {
    $m = new stdClass(); $m->title = $title; $m->module = 'mod_pdfbook'; $m->params = new ReviewStub\Params($params);
    $d = new Dispatcher($m, $app);
    $r = new ReflectionMethod($d, 'getLayoutData'); $data = $r->invoke($d);
    ob_start();
    (static function (array $displayData) { extract($displayData); include REVIEW_PROJECT . '/module/tmpl/default.php'; })($data);
    return ob_get_clean();
}
function page(string $file, array $modules, string $nonce = '', bool $editor = false): void {
    global $out; $app = new ReviewStub\App($editor ? new ReviewStub\User(true) : null); $html = '';
    foreach ($modules as [$title, $params]) { $html .= "<section class=\"mod\">\n" . module($app, $title, $params) . "\n</section>\n"; }
    $seen = []; $head = '';
    foreach ($app->doc->wam->calls as $c) {   // Joomla renders each named asset once; emulate that
        if (isset($seen[$c[0] . $c[1]])) continue; $seen[$c[0] . $c[1]] = 1;
        $n = $nonce ? " nonce=\"$nonce\"" : '';
        // Emulates the traced Joomla 6.2 relative media lookup (review F1): "ext/file.css" -> {root}/media/ext/css/file.css
        if (preg_match('~^([a-z0-9_]+)/([^/]+)\.(css|js)$~', $c[2], $m)) { $c[2] = Joomla\CMS\Uri\Uri::root(true) . "/media/{$m[1]}/{$m[3]}/{$m[2]}.{$m[3]}"; }
        $head .= $c[0] === 'style' ? "<link rel=\"stylesheet\" href=\"{$c[2]}?{$c[3]['version']}\">\n" : "<script type=\"module\" src=\"{$c[2]}?{$c[3]['version']}\"$n></script>\n";
    }
    file_put_contents("$out/$file", "<!doctype html><html lang=\"de\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>review</title>\n$head</head><body>\n$html<p id=\"after\">Ende</p></body></html>");
    file_put_contents("$out/$file.wam.json", json_encode($app->doc->wam->calls, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}
$xss = '"><img src=x onerror=globalThis.__TITLE__=1></script><script>globalThis.__T2__=1</script>';
page('two.html', [['Flyer', ['pdf' => 'images/eight.pdf', 'book_title' => $xss, 'height' => 500, 'background' => '#ffeedd']],
                  ['Beratung', ['pdf' => 'images/odd-book.pdf', 'book_title' => 'Zweites Buch mit sehr langem Titel, der auf schmalen Bildschirmen umbrechen muss – Ärger, Öl, Übung', 'page_mode' => 'double', 'direction' => 'rtl', 'renderer' => 'flat', 'height' => 400, 'download' => 0]],
                  ['Cover', ['pdf' => 'images/test-book.pdf', 'display' => 'cover', 'book_title' => 'Broschüre <b>fett</b>']],
                  ['Fehlt', ['pdf' => 'images/missing.pdf']],
                  ['Traversal', ['pdf' => 'images/../configuration.php']]]);
page('two-editor.html', [['Fehlt', ['pdf' => 'images/missing.pdf']], ['Traversal', ['pdf' => 'images/../configuration.php']]], '', true);
page('spaces.html', [['Leerzeichen', ['pdf' => '/images/mit leerzeichen.pdf', 'book_title' => 'Leerzeichen']]]);
foreach (['jpx', 'actions-ext', 'outline', 'too-many', 'thousand', 'geometry', 'many-links', 'image-15mp', 'image-25mp', 'cjk', 'password', 'owner-only', 'truncated', 'fake-header', 'two-page', 'four-page', 'eight', 'one-page', 'test-book'] as $f) {
    page("$f.html", [[$f, ['pdf' => "images/$f.pdf", 'book_title' => $f, 'height' => 560]]]);
}
foreach (['redirect', 'e500', 'slow', 'hang', 'big-nolen', 'big-len', 'html-mime'] as $f) {   // runtime HTTP behaviour; PHP check bypassed deliberately
    file_put_contents("$out/net-$f.html", str_replace('images\/eight.pdf', "images\/special\/$f.pdf", file_get_contents("$out/eight.html")));
}
$plain = file_get_contents("$out/eight.html");
file_put_contents("$out/eight-nonce.html", str_replace('<script type="module"', '<script nonce="r3v13w" type="module"', $plain));
echo "pages written\n";
}
