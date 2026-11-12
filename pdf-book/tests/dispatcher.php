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
