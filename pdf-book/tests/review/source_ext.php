<?php
declare(strict_types=1);
define('_JEXEC', 1);
require $argv[1] . '/module/src/Helper/Source.php';
use Joomex\Module\Pdfbook\Site\Helper\Source;
$root = $argv[2];
$cases = [
 'images/ok.pdf','images//ok.pdf','images/./ok.pdf','images/sub/Broschüre.pdf','images/sub/Brosch%C3%BCre.pdf','images/UPPER.PDF','Images/ok.pdf','IMAGES/ok.pdf',
 'images/a b.pdf','images/a%20b.pdf',"images/a+b&c'.pdf",'images/a%2Bb%26c%27.pdf',
 'images/late.pdf','images/big.pdf','images/jx/secret.pdf','images/sub/../ok.pdf','images/sub/%2e%2e/ok.pdf','images/sub/%2E%2E/ok.pdf',
 'images/%2e%2e%2fsecret-root.pdf','images/..%2fsecret-root.pdf','images/%252e%252e%252fsecret-root.pdf','images/sub%2f..%2f..%2fsecret-root.pdf',
 '/images/ok.pdf','images\ok.pdf','images/%5cok.pdf','images/ok.pdf%00.txt','images/ok.pdf%23x','images/ok.pdf%3Fx=1',
 'images/ok.pdf.','images/ok.pdf::$DATA','images/ok.pdf%3A%3A$DATA','\\server\share\x.pdf','images/OK~1.PDF',
 'images/ok.pdf/','images/', 'images/sub', str_repeat('a',2049),'images/…/ok.pdf','images/%C0%AE%C0%AE/secret-root.pdf',
 "images/ok\u{202E}fdp.pdf",'images/ok.Pdf',
];
foreach ($cases as $c) {
  try { $r = Source::resolve($c, $root); echo "ACCEPT  ", json_encode($c, JSON_UNESCAPED_UNICODE), " -> ", $r, "\n"; }
  catch (InvalidArgumentException $e) { echo "reject  ", json_encode($c, JSON_UNESCAPED_UNICODE), " : ", $e->getMessage(), "\n"; }
}
