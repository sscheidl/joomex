<?php
namespace Joomex\Module\Pdfbook\Site\Dispatcher;

defined('_JEXEC') or die;

use Joomex\Module\Pdfbook\Site\Helper\Source;
use Joomla\CMS\Dispatcher\AbstractModuleDispatcher;
use Joomla\CMS\Uri\Uri;

final class Dispatcher extends AbstractModuleDispatcher
{
    protected function getLayoutData(): array
    {
        $data = parent::getLayoutData();
        $params = $data['params'];
        $data['bookError'] = '';
        $data['bookConfig'] = [];
        try {
            $source = Source::resolve((string) $params->get('pdf', ''), JPATH_ROOT);
            $data['bookConfig'] = [
                'src' => $source,
                'base' => Uri::root(),
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
            $prefix = Uri::root(true) . '/media/mod_pdfbook/';
            $wa->registerAndUseStyle('mod_pdfbook.viewer', $prefix . 'css/viewer.css', ['version' => '0.1.0-alpha.2']);
            $wa->registerAndUseScript('mod_pdfbook.viewer', $prefix . 'js/viewer.mjs', ['version' => '0.1.0-alpha.2'], ['type' => 'module']);
        } catch (\InvalidArgumentException $exception) {
            $data['bookError'] = $exception->getMessage();
        }
        $data['bookLayout'] = $params->get('display', 'inline') === 'cover' ? 'cover' : 'inline';
        return $data;
    }
}
