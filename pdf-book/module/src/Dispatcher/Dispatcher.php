<?php
namespace Joomex\Module\Pdfbook\Site\Dispatcher;

defined('_JEXEC') or die;

use Joomex\Module\Pdfbook\Site\Helper\Source;
use Joomla\CMS\Dispatcher\AbstractModuleDispatcher;
use Joomla\CMS\Uri\Uri;

final class Dispatcher extends AbstractModuleDispatcher
{
    /** Must equal <version> in mod_pdfbook.xml and the ?v= import suffixes in media/js (checked by scripts/build.py). */
    public const VERSION = '0.1.0-alpha.5';

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
