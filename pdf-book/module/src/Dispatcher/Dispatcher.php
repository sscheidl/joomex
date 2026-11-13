<?php
namespace Joomex\Module\Pdfbook\Site\Dispatcher;

defined('_JEXEC') or die;

use Joomex\Module\Pdfbook\Site\Helper\Source;
use Joomla\CMS\Dispatcher\AbstractModuleDispatcher;
use Joomla\CMS\Uri\Uri;

final class Dispatcher extends AbstractModuleDispatcher
{
    /** Must equal <version> in mod_pdfbook.xml and the ?v= import suffixes in media/js (checked by scripts/build.py). */
    public const VERSION = '0.1.0-alpha.19';

    protected function getLayoutData(): array
    {
        $data = parent::getLayoutData();
        $params = $data['params'];
        $data['bookError'] = '';
        $data['bookErrorVisible'] = false;
        $data['bookConfig'] = [];
        try {
            $source = Source::resolve((string) $params->get('pdf', ''), JPATH_ROOT);
            // Same rules as setting() and normalizeConfig() in media/js/model.js, checked against the shared vectors in
            // tests/numeric-vectors.json (N18-5): a number, or a string of decimal digits with optional sign, fraction and
            // surrounding whitespace, is rounded half away from zero and clamped; anything else gives the default. A choice
            // outside its list falls back to the first (default) entry.
            $int = static function ($value, int $default, int $min, int $max): int {
                $numeric = is_int($value) || (is_float($value) && is_finite($value))
                    || (is_string($value) && preg_match('/^\s*[+-]?\d+(\.\d+)?\s*$/D', $value) === 1);
                if (!$numeric) {
                    return $default;
                }
                $number = (float) $value;
                return $number > $max ? $max : ($number < $min ? $min : (int) round($number, 0, PHP_ROUND_HALF_UP));
            };
            $enum = static function ($value, array $allowed): string {
                return in_array((string) $value, $allowed, true) ? (string) $value : $allowed[0];
            };
            $color = (string) $params->get('background', '#f2f2f2');
            $data['bookConfig'] = [
                'src' => $source,
                // Root-relative on purpose: the viewer resolves it against the page origin (no Host-header/proxy scheme dependency).
                'base' => Uri::root(true) . '/',
                'title' => (string) $params->get('book_title', $this->module->title),
                'mode' => $enum($params->get('page_mode', 'auto'), ['auto', 'single', 'double']),
                'direction' => $enum($params->get('direction', 'ltr'), ['ltr', 'rtl']),
                'height' => $int($params->get('height', 500), 500, 320, 1000),
                'duration' => $int($params->get('duration', 800), 800, 150, 1800),
                'background' => preg_match('/^#[0-9a-f]{6}$/i', $color) ? $color : '#f2f2f2',
                'download' => (bool) $params->get('download', 1),
                'renderer' => $enum($params->get('renderer', 'webgl'), ['webgl', 'flip', 'slide', 'fade', 'flat']),
                // Look of the 3D turn; the viewer clamps these again.
                'curvature' => $int($params->get('curvature', 50), 50, 0, 100),
                'shadowDensity' => $int($params->get('shadow_density', 22), 22, 0, 60),
                'shadowSoftness' => $int($params->get('shadow_softness', 50), 50, 0, 100),
                'shadowWidth' => $int($params->get('shadow_width', 50), 50, 0, 100),
                'flipAxis' => $enum($params->get('flip_axis', 'auto'), ['auto', 'horizontal', 'vertical']),
                'autoHeight' => (int) $params->get('auto_height', 0) === 1,
                'showHeading' => (int) $params->get('show_heading', 1) === 1,
                'showToolbar' => (int) $params->get('show_toolbar', 1) === 1,
                'showFrame' => (int) $params->get('show_frame', 1) === 1,
                'sound' => (int) $params->get('sound', 0) === 1,
                'autoplay' => (int) $params->get('autoplay', 0) === 1,
                'autoplayInterval' => $int($params->get('autoplay_interval', 3), 3, 1, 60),
                'autoplayLoop' => (int) $params->get('autoplay_loop', 0) === 1,
            ];
            $wa = $this->getApplication()->getDocument()->getWebAssetManager();
            // Relative to /media: Joomla resolves this to {root}/media/mod_pdfbook/css/viewer.css and allows template overrides.
            $wa->registerAndUseStyle('mod_pdfbook.viewer', 'mod_pdfbook/viewer.css', ['version' => self::VERSION]);
            // Also relative to /media: resolves to {root}/media/mod_pdfbook/js/viewer.js. A root-relative .js path would be
            // turned into "//media/…" by Joomla (same resolution path as review finding F1).
            $wa->registerAndUseScript('mod_pdfbook.viewer', 'mod_pdfbook/viewer.js', ['version' => self::VERSION], ['type' => 'module']);
        } catch (\InvalidArgumentException $exception) {
            $data['bookError'] = $exception->getMessage();
            // Configuration problems are shown only to users who can fix the module, never to guests.
            $user = $this->getApplication()->getIdentity();
            $data['bookErrorVisible'] = $user !== null
                && ($user->authorise('core.edit', 'com_modules.module.' . (int) ($this->module->id ?? 0))
                    || $user->authorise('core.edit', 'com_modules'));
        }
        $data['bookLayout'] = $params->get('display', 'inline') === 'cover' ? 'cover' : 'inline';
        return $data;
    }
}
