<?php
declare(strict_types=1);
define('_JEXEC', 1);
require __DIR__ . '/../module/src/Helper/Source.php';
use Joomex\Module\Pdfbook\Site\Helper\Source;
$root = dirname(__DIR__);
$checks = 0;
function mustReject(string $path, string $root): void {
    global $checks;
    try { Source::resolve($path, $root); }
    catch (InvalidArgumentException) { $checks++; return; }
    throw new RuntimeException('Accepted forbidden path: ' . $path);
}
function mustResolve(string $path, string $root, string $expected): void {
    global $checks;
    $actual = Source::resolve($path, $root);
    if ($actual !== $expected) {
        throw new RuntimeException("Resolved $path to $actual, expected $expected");
    }
    $checks++;
}
mustResolve('images/test-book.pdf', $root, 'images/test-book.pdf');
// F9: legacy root-relative paths, spaces and Joomla media-field values
mustResolve('/images/test-book.pdf', $root, 'images/test-book.pdf');
mustResolve('  images/test-book.pdf ', $root, 'images/test-book.pdf');
mustResolve('images/mit leerzeichen.pdf', $root, 'images/mit%20leerzeichen.pdf');
mustResolve('images/mit%20leerzeichen.pdf', $root, 'images/mit%20leerzeichen.pdf');
mustResolve('images/test-book.pdf#joomlaImage://local-images/test-book.pdf?width=0&height=0', $root, 'images/test-book.pdf');
foreach (['../images/test-book.pdf','images/../LICENSE.txt','images/%2e%2e/LICENSE.txt','images/%252e%252e/a.pdf','images/broken.pdf','images/missing.pdf',
          'https://evil.example/a.pdf','//host/a.pdf','//images/test-book.pdf','C:\\file.pdf','images/test-book.pdf#x','images/test-book.pdf?x=1','images/a%00.pdf',
          'images/test-book.pdf/..','images/a%09b.pdf',"images/a\tb.pdf",'images/ mit leerzeichen.pdf','images/sub ./x.pdf','images/sub./x.pdf',
          '/images/../LICENSE.txt','#joomlaImage://local-images/test-book.pdf','images/test-book.pdf#joomlaImage','/LICENSE.txt'] as $input) {
    mustReject($input, $root);
}
$bookError = '';
$bookErrorVisible = false;
$bookLayout = 'inline';
$bookConfig = ['src'=>'images/test-book.pdf','base'=>'/sub/','title'=>'"><script>globalThis.injected=1</script>'];
ob_start(); require __DIR__ . '/../module/tmpl/default.php'; $html = ob_get_clean();
if (str_contains($html, '<script>') || !str_contains($html, 'data-pdfbook=') || !str_contains($html, 'href="/sub/images/test-book.pdf"')) {
    throw new RuntimeException('Unsafe or wrong HTML output');
}
$checks++;
// F15: configuration errors are hidden from guests and shown to editors
$bookError = 'PDF ist nicht verfügbar.';
foreach ([[false, ''], [true, '<p role="status">PDF ist nicht verfügbar.</p>']] as [$visible, $expected]) {
    $bookErrorVisible = $visible;
    ob_start(); require __DIR__ . '/../module/tmpl/default.php'; $html = ob_get_clean();
    if (trim($html) !== $expected) {
        throw new RuntimeException('Error visibility wrong for visible=' . var_export($visible, true) . ': ' . $html);
    }
    $checks++;
}
echo "PASS: $checks PHP path/header/output checks\n";
