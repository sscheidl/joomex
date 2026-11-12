<?php
namespace Joomex\Module\Pdfbook\Site\Helper;

defined('_JEXEC') or die;

/** Resolves public PDFs inside Joomla's images directory; never fetches a remote URL. */
final class Source
{
    public static function resolve(string $input, string $sitePath): string
    {
        if ($input === '' || strlen($input) > 2048 || preg_match('/[\\x00-\\x20\\x7f\\\\:?#]/', $input)) {
            throw new \InvalidArgumentException('Ungültiger PDF-Pfad.');
        }
        $decoded = rawurldecode($input);
        if (preg_match('/[%\\x00-\\x20\\x7f\\\\:?#]/', $decoded)
            || preg_match('~(?:^|/)\.{1,2}(?:/|$)~', $decoded)
            || !str_starts_with($decoded, 'images/')
            || !preg_match('/\.pdf$/i', $decoded)) {
            throw new \InvalidArgumentException('PDF muss im Medienverzeichnis images liegen.');
        }
        $root = realpath($sitePath . '/images');
        $file = realpath($sitePath . '/' . $decoded);
        if ($root === false || $file === false || !is_file($file) || !is_readable($file)
            || !str_starts_with($file, $root . DIRECTORY_SEPARATOR)) {
            throw new \InvalidArgumentException('PDF ist nicht verfügbar oder liegt außerhalb des Medienverzeichnisses.');
        }
        $size = filesize($file);
        if ($size === false || $size > 32 * 1024 * 1024) {
            throw new \InvalidArgumentException('PDF darf höchstens 32 MB groß sein.');
        }
        $handle = fopen($file, 'rb');
        if ($handle === false) {
            throw new \InvalidArgumentException('PDF ist nicht lesbar.');
        }
        try {
            $header = fread($handle, 1024);
        } finally {
            fclose($handle);
        }
        if ($header === false || !str_contains($header, '%PDF-')) {
            throw new \InvalidArgumentException('Die Datei ist kein PDF.');
        }
        return implode('/', array_map('rawurlencode', explode('/', $decoded)));
    }
}
