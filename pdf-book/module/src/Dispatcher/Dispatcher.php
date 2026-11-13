<?php
namespace Joomex\Module\Pdfbook\Site\Dispatcher;

defined('_JEXEC') or die;

use Joomex\Module\Pdfbook\Site\Helper\Source;
use Joomla\CMS\Dispatcher\AbstractModuleDispatcher;
use Joomla\CMS\Uri\Uri;

final class Dispatcher extends AbstractModuleDispatcher
{
    /** Must equal <version> in mod_pdfbook.xml and the ?v= import suffixes in media/js (checked by scripts/build.py). */
    public const VERSION = '0.1.0-alpha.11';

    protected function getLayoutData(): array
    {
        $data = parent::getLayoutData();
        $params = $data['params'];
        $data['bookError'] = '';
        $data['bookErrorVisible'] = false;
        $data['bookConfig'] = [];
        try {
            $source = Source::resolve((string) $params->get('pdf', ''), JPATH_ROOT);
            $data['bookConfig'] = [
                'src' => $source,
                // Root-relative on purpose: the viewer resolves it against the page origin (no Host-header/proxy scheme dependency).
                'base' => Uri::root(true) . '/',
                'title' => (string) $params->get('book_title', $this->module->title),
                'mode' => (string) $params->get('page_mode', 'auto'),
                'direction' => (string) $params->get('direction', 'ltr'),
                'height' => max(320, min(1000, (int) $params->get('height', 500))),
                'duration' => max(150, min(1800, (int) $params->get('duration', 800))),
                'background' => (string) $params->get('background', '#f2f2f2'),
                'download' => (bool) $params->get('download', 1),
                'renderer' => (string) $params->get('renderer', 'webgl'),
                // Look of the 3D turn; the viewer clamps these again.
                'curvature' => max(0, min(100, (int) $params->get('curvature', 50))),
                'shadowDensity' => max(0, min(60, (int) $params->get('shadow_density', 22))),
                'shadowSoftness' => max(0, min(100, (int) $params->get('shadow_softness', 50))),
                'shadowWidth' => max(0, min(100, (int) $params->get('shadow_width', 50))),
                'flipAxis' => (string) $params->get('flip_axis', 'auto'),
                'autoHeight' => (int) $params->get('auto_height', 0) === 1,
                'showHeading' => (int) $params->get('show_heading', 1) === 1,
                'showToolbar' => (int) $params->get('show_toolbar', 1) === 1,
                'sound' => (int) $params->get('sound', 0) === 1,
                'autoplay' => (int) $params->get('autoplay', 0) === 1,
                'autoplayInterval' => max(1, min(60, (int) $params->get('autoplay_interval', 3))),
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
