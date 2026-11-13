<?php
// Runs the real Dispatcher against minimal Joomla stubs. This is NOT a Joomla integration test:
// it checks what the module asks Joomla for (asset URIs, versions, data), not how Joomla renders it.
declare(strict_types=1);
namespace Joomla\CMS\Dispatcher { abstract class AbstractModuleDispatcher {
    public function __construct(protected \stdClass $module, protected $app) {}
    protected function getLayoutData() { return ['module' => $this->module, 'app' => $this->app, 'params' => $this->module->params]; }
    public function getApplication() { return $this->app; } } }
namespace Joomla\CMS\Uri { final class Uri {
    public static string $root = 'https://site.example/sub/';
    public static function root(bool $pathonly = false): string { return $pathonly ? rtrim((string) parse_url(self::$root, PHP_URL_PATH), '/') : self::$root; } } }
namespace DispatcherTest {
final class Params { public function __construct(private array $v) {} public function get(string $k, $d = null) { return $this->v[$k] ?? $d; } }
final class Wam { public array $calls = [];
    public function registerAndUseStyle(...$a) { $this->calls[] = ['style', ...$a]; return $this; }
    public function registerAndUseScript(...$a) { $this->calls[] = ['script', ...$a]; return $this; } }
final class Doc { public Wam $wam; public function __construct() { $this->wam = new Wam(); } public function getWebAssetManager() { return $this->wam; } }
final class User { public array $asked = []; public function __construct(private bool $editor) {}
    public function authorise(string $action, string $asset): bool { $this->asked[] = "$action@$asset"; return $this->editor; } }
final class App { public Doc $doc; public function __construct(public ?User $user) { $this->doc = new Doc(); }
    public function getDocument() { return $this->doc; } public function getIdentity() { return $this->user; } }
}
namespace {
define('_JEXEC', 1);
define('JPATH_ROOT', dirname(__DIR__));
require __DIR__ . '/../module/src/Helper/Source.php';
require __DIR__ . '/../module/src/Dispatcher/Dispatcher.php';
use Joomex\Module\Pdfbook\Site\Dispatcher\Dispatcher;
$checks = 0;
function check(bool $ok, string $what): void { global $checks; if (!$ok) { throw new RuntimeException('FAIL: ' . $what); } $checks++; }
function run(array $params, ?DispatcherTest\User $user): array {
    $m = new stdClass(); $m->id = 42; $m->title = 'Test'; $m->module = 'mod_pdfbook'; $m->params = new DispatcherTest\Params($params);
    $app = new DispatcherTest\App($user);
    $d = new Dispatcher($m, $app);
    $data = (new ReflectionMethod($d, 'getLayoutData'))->invoke($d);
    return [$data, $app->doc->wam->calls];
}
$version = (string) simplexml_load_file(__DIR__ . '/../module/mod_pdfbook.xml')->version;
check(Dispatcher::VERSION === $version, 'Dispatcher::VERSION equals manifest version');

[$data, $calls] = run(['pdf' => 'images/test-book.pdf'], null);
// F1: the stylesheet is registered relative to /media so Joomla resolves it (no leading slash, no root prefix)
check($calls[0] === ['style', 'mod_pdfbook.viewer', 'mod_pdfbook/viewer.css', ['version' => $version]], 'F1 stylesheet asset URI ' . json_encode($calls[0]));
check($calls[1][0] === 'script' && $calls[1][2] === 'mod_pdfbook/viewer.js' && $calls[1][3] === ['version' => $version] && $calls[1][4] === ['type' => 'module'], 'module script asset ' . json_encode($calls[1]));
// F8: root-relative base, independent of scheme and Host header
check($data['bookConfig']['base'] === '/sub/', 'F8 root-relative base ' . $data['bookConfig']['base']);
check($data['bookError'] === '' && $data['bookConfig']['src'] === 'images/test-book.pdf', 'valid source');
// Animation settings: defaults and clamping
$c = $data['bookConfig'];
check([$c['renderer'], $c['duration'], $c['curvature'], $c['shadowDensity'], $c['shadowSoftness'], $c['shadowWidth']] === ['webgl', 800, 50, 22, 50, 50], 'animation defaults ' . json_encode($c));
[$data] = run(['pdf' => 'images/test-book.pdf', 'renderer' => 'slide', 'duration' => 99999, 'curvature' => -3, 'shadow_density' => 100, 'shadow_softness' => 0, 'shadow_width' => 250], null);
$c = $data['bookConfig'];
check([$c['renderer'], $c['duration'], $c['curvature'], $c['shadowDensity'], $c['shadowSoftness'], $c['shadowWidth']] === ['slide', 1800, 0, 60, 0, 100], 'animation clamping ' . json_encode($c));
// Shared numeric vectors with the JavaScript test (N18-5).
$vectors = json_decode(file_get_contents(__DIR__ . '/numeric-vectors.json'), true);
foreach ($vectors['cases'] as $case) {
    [$data] = run(['pdf' => 'images/test-book.pdf', 'height' => $case['in']], null);
    check($data['bookConfig']['height'] === $case['out'], 'numeric vector ' . json_encode($case['in']) . ' -> ' . json_encode($data['bookConfig']['height']));
}
// Empty, non-numeric and unknown values fall back to the defaults, as in normalizeConfig() (review section 7, alpha.15).
[$data] = run(['pdf' => 'images/test-book.pdf', 'height' => '', 'duration' => 'abc', 'autoplay_interval' => '', 'renderer' => 'evil',
    'page_mode' => 'triple', 'direction' => 'up', 'flip_axis' => 'diagonal', 'background' => 'red;x:y', 'curvature' => ' '], null);
$c = $data['bookConfig'];
check([$c['height'], $c['duration'], $c['autoplayInterval'], $c['renderer'], $c['mode'], $c['direction'], $c['flipAxis'], $c['background'], $c['curvature']]
    === [500, 800, 3, 'webgl', 'auto', 'ltr', 'auto', '#f2f2f2', 50], 'empty and unknown values use defaults ' . json_encode($c));
[$data] = run(['pdf' => 'images/test-book.pdf', 'renderer' => 'fade', 'flip_axis' => 'vertical', 'page_mode' => 'double', 'background' => '#A0b1C2'], null);
$c = $data['bookConfig'];
check([$c['renderer'], $c['flipAxis'], $c['mode'], $c['background']] === ['fade', 'vertical', 'double', '#A0b1C2'], 'valid choices kept ' . json_encode($c));
Joomla\CMS\Uri\Uri::$root = 'http://proxy.internal/';
[$data] = run(['pdf' => 'images/test-book.pdf'], null);
check($data['bookConfig']['base'] === '/', 'F8 root install base');

// F15: errors visible only to users who may edit the module
[$data, $calls] = run(['pdf' => 'images/missing.pdf'], null);
check($data['bookError'] !== '' && $data['bookErrorVisible'] === false && $calls === [], 'F15 no identity: hidden, no assets');
$guest = new DispatcherTest\User(false);
[$data] = run(['pdf' => 'images/missing.pdf'], $guest);
check($data['bookErrorVisible'] === false && in_array('core.edit@com_modules.module.42', $guest->asked, true), 'F15 guest hidden');
[$data] = run(['pdf' => 'images/missing.pdf'], new DispatcherTest\User(true));
check($data['bookErrorVisible'] === true, 'F15 editor sees error');
echo "PASS: $checks dispatcher checks (stubs, not Joomla)\n";
}
