<?php
namespace Joomex\Module\Pdfbook\Site\Helper;

defined('_JEXEC') or die;

/** Resolves public PDFs inside Joomla's images directory; never fetches a remote URL. */
final class Source
{
    /**
     * Accepts "images/…pdf", optionally with one leading "/" (legacy root-relative paths) and
     * optionally with the Joomla media-field suffix "#joomlaImage://…". Spaces are allowed and
     * returned URL-encoded; every other control character, "\", ":", "?", "#" and "%" after decoding is rejected.
     */
    public static function resolve(string $input, string $sitePath): string
    {
        $input = self::normalize($input);
        if ($input === '' || strlen($input) > 2048 || preg_match('/[\\x00-\\x1f\\x7f\\\\:?#]/', $input)) {
            throw new \InvalidArgumentException('Ungültiger PDF-Pfad.');
        }
        $decoded = rawurldecode($input);
        if (preg_match('/[%\\x00-\\x1f\\x7f\\\\:?#]/', $decoded)
            || preg_match('~(?:^|/)\.{1,2}(?:/|$)~', $decoded)
            || preg_match('~(?:^|/) | (?:/|$)|\.(?:/|$)~', $decoded)
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

    private static function normalize(string $input): string
    {
        $input = trim($input);
        $suffix = strpos($input, '#joomlaImage://');
        if ($suffix !== false) {
            $input = substr($input, 0, $suffix);
        }
        if (str_starts_with($input, '/images/')) {
            $input = substr($input, 1);
        }
        return $input;
    }
}
