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
if (Source::resolve('images/test-book.pdf', $root) !== 'images/test-book.pdf') {
    throw new RuntimeException('Valid PDF rejected');
}
$checks++;
foreach (['../images/test-book.pdf','images/../LICENSE.txt','images/%2e%2e/LICENSE.txt','images/%252e%252e/a.pdf','images/broken.pdf','images/missing.pdf','https://evil.example/a.pdf','//host/a.pdf','C:\\file.pdf','images/test-book.pdf#x','images/test-book.pdf?x=1','images/a%00.pdf','images/test-book.pdf/..'] as $input) {
    mustReject($input, $root);
}
$bookError = '';
$bookLayout = 'inline';
$bookConfig = ['src'=>'images/test-book.pdf','base'=>'https://example.org/','title'=>'"><script>globalThis.injected=1</script>'];
ob_start(); require __DIR__ . '/../module/tmpl/default.php'; $html = ob_get_clean();
if (str_contains($html, '<script>') || !str_contains($html, 'data-pdfbook=')) {
    throw new RuntimeException('Unsafe HTML output');
}
$checks++;
echo "PASS: $checks PHP path/header/output checks\n";
