<?php
defined('_JEXEC') or die;

$escape = static fn (string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
if ($bookError !== '') {
    echo '<p role="status">' . $escape($bookError) . '</p>';
    return;
}
$json = $escape(json_encode($bookConfig, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR));
$title = $escape($bookConfig['title']);
$source = $escape($bookConfig['base'] . $bookConfig['src']);
?>
<?php if ($bookLayout === 'cover') : ?>
    <button type="button" class="pdfbook-button" data-pdfbook-open="<?= $json ?>"><?= $title ?> öffnen</button>
<?php else : ?>
    <div data-pdfbook="<?= $json ?>"><p><?= $title ?> wird geladen …</p></div>
<?php endif; ?>
<noscript><p><a href="<?= $source ?>" target="_blank" rel="noopener noreferrer"><?= $title ?> als PDF öffnen</a></p></noscript>
