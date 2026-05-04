<?php

declare(strict_types=1);

namespace PhpSecurityScanner\Scanner;

use PhpSecurityScanner\Config;
use PhpSecurityScanner\Finding;

class TemplateScanner extends AbstractScanner
{
    private Config $config;

    public function __construct(Config $config)
    {
        $this->config = $config;
    }

    public function getCategory(): string
    {
        return 'template_security';
    }

    public function scan(string $path): array
    {
        $this->findings = [];

        if (is_dir($path)) {
            $files = $this->scanDirectory(
                $path,
                ['twig', 'html.twig', 'blade.php', 'php', 'phtml'],
                $this->config->getExcludes()
            );
            foreach ($files as $file) {
                $this->scanFile($file);
            }
        } elseif (is_file($path)) {
            $this->scanFile($path);
        }

        return $this->findings;
    }

    private function scanFile(string $filePath): void
    {
        $content = file_get_contents($filePath);
        if ($content === false) {
            return;
        }

        $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        
        if (str_ends_with($filePath, '.twig') || str_ends_with($filePath, '.html.twig')) {
            $this->scanTwigTemplate($content, $filePath);
        } elseif (str_ends_with($filePath, '.blade.php')) {
            $this->scanBladeTemplate($content, $filePath);
        } elseif (in_array($extension, ['php', 'phtml', 'html'])) {
            $this->scanPhpTemplate($content, $filePath);
        }
    }

    private function scanTwigTemplate(string $content, string $filePath): void
    {
        $lines = explode("\n", $content);

        foreach ($lines as $lineNumber => $line) {
            if (preg_match('/\{\{.*\|raw\s*\}\}/i', $line, $matches)) {
                $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                
                $this->addFinding(
                    'twig_raw_filter',
                    Finding::SEVERITY_HIGH,
                    $filePath,
                    $lineNumber + 1,
                    'Twig raw 过滤器: ' . trim($matches[0]),
                    Finding::CONFIDENCE_HIGH,
                    'Twig 的 |raw 过滤器禁用了 HTML 转义，可能导致 XSS',
                    '仅在完全信任输出内容时使用 raw，否则考虑白名单标签或使用 escape 策略',
                    $snippet
                );
            }

            if (preg_match('/\{\{\s*app\.request\.get\s*\(/i', $line, $matches)) {
                $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                
                $this->addFinding(
                    'twig_direct_request_access',
                    Finding::SEVERITY_MEDIUM,
                    $filePath,
                    $lineNumber + 1,
                    '直接访问请求参数: ' . trim($matches[0]),
                    Finding::CONFIDENCE_MEDIUM,
                    '在模板中直接访问请求参数可能导致反射型 XSS',
                    '在控制器中处理输入并验证，再传递给模板',
                    $snippet
                );
            }

            if (preg_match('/\{\{.*\$_(GET|POST|REQUEST|COOKIE)/i', $line, $matches)) {
                $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                
                $this->addFinding(
                    'twig_superglobal_access',
                    Finding::SEVERITY_HIGH,
                    $filePath,
                    $lineNumber + 1,
                    '直接访问超全局变量: ' . trim($matches[0]),
                    Finding::CONFIDENCE_HIGH,
                    '在模板中直接访问超全局变量存在 XSS 风险',
                    '在控制器中处理并转义所有用户输入',
                    $snippet
                );
            }
        }
    }

    private function scanBladeTemplate(string $content, string $filePath): void
    {
        $lines = explode("\n", $content);

        foreach ($lines as $lineNumber => $line) {
            if (preg_match('/\{!!.*!!\}/', $line, $matches)) {
                $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                
                $this->addFinding(
                    'blade_unescaped_echo',
                    Finding::SEVERITY_HIGH,
                    $filePath,
                    $lineNumber + 1,
                    'Blade 未转义输出: ' . trim($matches[0]),
                    Finding::CONFIDENCE_HIGH,
                    'Blade 的 {!! !!} 语法不进行 HTML 转义，可能导致 XSS',
                    '使用 {{ }} 进行转义输出，仅在完全信任内容时使用 {!! !!}',
                    $snippet
                );
            }

            if (preg_match('/@php.*\$_(GET|POST|REQUEST|COOKIE)/i', $line, $matches)) {
                $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                
                $this->addFinding(
                    'blade_php_superglobal',
                    Finding::SEVERITY_HIGH,
                    $filePath,
                    $lineNumber + 1,
                    '模板中 PHP 代码访问超全局变量',
                    Finding::CONFIDENCE_HIGH,
                    '在 Blade 模板中使用 @php 并访问超全局变量，可能导致 XSS',
                    '避免在模板中直接操作超全局变量，在控制器中预处理数据',
                    $snippet
                );
            }

            if (preg_match('/\{\{\s*request\s*\(/i', $line, $matches)) {
                $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                
                $this->addFinding(
                    'blade_request_helper',
                    Finding::SEVERITY_MEDIUM,
                    $filePath,
                    $lineNumber + 1,
                    '模板中使用 request() 助手',
                    Finding::CONFIDENCE_MEDIUM,
                    '在模板中直接使用 request() 可能导致反射型 XSS',
                    '在控制器中验证和处理输入后再传递给模板',
                    $snippet
                );
            }
        }
    }

    private function scanPhpTemplate(string $content, string $filePath): void
    {
        $lines = explode("\n", $content);

        foreach ($lines as $lineNumber => $line) {
            if (preg_match('/echo\s+\$_(GET|POST|REQUEST|COOKIE)/i', $line, $matches)) {
                $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                
                $this->addFinding(
                    'php_echo_superglobal',
                    Finding::SEVERITY_CRITICAL,
                    $filePath,
                    $lineNumber + 1,
                    '直接 echo 超全局变量: ' . trim($matches[0]),
                    Finding::CONFIDENCE_HIGH,
                    '直接输出用户输入到 HTML 上下文，存在 XSS 风险',
                    '使用 htmlspecialchars() 或 htmlentities() 转义输出',
                    $snippet
                );
            }

            if (preg_match('/print\s+\$_(GET|POST|REQUEST|COOKIE)/i', $line, $matches)) {
                $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                
                $this->addFinding(
                    'php_print_superglobal',
                    Finding::SEVERITY_CRITICAL,
                    $filePath,
                    $lineNumber + 1,
                    '直接 print 超全局变量: ' . trim($matches[0]),
                    Finding::CONFIDENCE_HIGH,
                    '直接输出用户输入到 HTML 上下文，存在 XSS 风险',
                    '使用 htmlspecialchars() 或 htmlentities() 转义输出',
                    $snippet
                );
            }

            if (preg_match('/<\?=\s*\$_(GET|POST|REQUEST|COOKIE)/i', $line, $matches)) {
                $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                
                $this->addFinding(
                    'php_short_echo_superglobal',
                    Finding::SEVERITY_CRITICAL,
                    $filePath,
                    $lineNumber + 1,
                    '短标签直接输出超全局变量: ' . trim($matches[0]),
                    Finding::CONFIDENCE_HIGH,
                    '使用短标签直接输出用户输入，存在 XSS 风险',
                    '使用 htmlspecialchars() 或 htmlentities() 转义输出',
                    $snippet
                );
            }

            if (preg_match('/(echo|print).*htmlspecialchars_decode/i', $line, $matches)) {
                $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                
                $this->addFinding(
                    'php_htmlspecialchars_decode',
                    Finding::SEVERITY_HIGH,
                    $filePath,
                    $lineNumber + 1,
                    '使用 htmlspecialchars_decode 还原转义: ' . trim($matches[0]),
                    Finding::CONFIDENCE_HIGH,
                    '还原 HTML 转义可能重新引入 XSS 风险',
                    '确保持久化存储的内容已安全处理，避免在输出时还原转义',
                    $snippet
                );
            }
        }
    }
}
