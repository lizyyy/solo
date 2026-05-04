<?php

declare(strict_types=1);

namespace PhpSecurityScanner\Scanner;

use PhpSecurityScanner\Config;
use PhpSecurityScanner\Finding;

class UploadScanner extends AbstractScanner
{
    private Config $config;

    private const DANGEROUS_EXTENSIONS = [
        'php', 'php5', 'php7', 'php8', 'phtml', 'phar', 'php3', 'php4',
        'asp', 'aspx', 'ashx', 'asa',
        'jsp', 'jspx', 'jhtml',
        'pl', 'cgi', 'fcgi',
        'sh', 'bash', 'py', 'rb',
        'htaccess', 'ini',
    ];

    private const SUSPICIOUS_PATTERNS = [
        '/<\?php/i',
        '/<\?=/i',
        '/eval\s*\(/i',
        '/system\s*\(/i',
        '/exec\s*\(/i',
        '/shell_exec\s*\(/i',
        '/passthru\s*\(/i',
        '/base64_decode\s*\(/i',
        '/gzinflate\s*\(/i',
        '/str_rot13\s*\(/i',
    ];

    public function __construct(Config $config)
    {
        $this->config = $config;
    }

    public function getCategory(): string
    {
        return 'upload_security';
    }

    public function scan(string $path): array
    {
        $this->findings = [];

        if (!is_dir($path)) {
            return $this->findings;
        }

        $this->scanDirectoryContent($path);
        $this->checkUploadMechanism($path);

        return $this->findings;
    }

    private function scanDirectoryContent(string $uploadPath): void
    {
        $files = $this->scanDirectory(
            $uploadPath,
            ['php', 'php5', 'php7', 'php8', 'phtml', 'phar', 'php3', 'php4',
             'asp', 'aspx', 'jsp', 'jspx', 'pl', 'cgi', 'sh', 'htaccess', 'ini'],
            []
        );

        foreach ($files as $file) {
            $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            
            if (in_array($extension, self::DANGEROUS_EXTENSIONS)) {
                $snippet = $this->getFileLines($file, 1);
                
                $this->addFinding(
                    'upload_dangerous_file_extension',
                    Finding::SEVERITY_CRITICAL,
                    $file,
                    1,
                    "上传目录中存在危险扩展名文件: .{$extension}",
                    Finding::CONFIDENCE_HIGH,
                    "上传目录中存在 {$extension} 文件，如果上传机制允许该扩展名，可能导致任意代码执行",
                    '检查上传处理代码是否有白名单验证，删除或隔离可疑文件',
                    $snippet
                );
            }

            $this->scanFileContent($file);
        }

        $this->checkHtaccess($uploadPath);
    }

    private function scanFileContent(string $filePath): void
    {
        $content = @file_get_contents($filePath);
        if ($content === false) {
            return;
        }

        $lines = explode("\n", $content);

        foreach ($lines as $lineNumber => $line) {
            foreach (self::SUSPICIOUS_PATTERNS as $pattern) {
                if (preg_match($pattern, $line, $matches)) {
                    $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                    
                    $this->addFinding(
                        'upload_suspicious_content',
                        Finding::SEVERITY_HIGH,
                        $filePath,
                        $lineNumber + 1,
                        '文件中包含可疑代码模式: ' . trim($matches[0]),
                        Finding::CONFIDENCE_MEDIUM,
                        '上传的文件中包含可能是 webshell 或恶意代码的模式',
                        '审查该文件是否为恶意代码，检查上传机制的验证逻辑',
                        $snippet
                    );
                }
            }
        }

        if (preg_match('/\$_FILES\s*\[/', $content)) {
            $snippet = $this->getFileLines($filePath, 1);
            
            $this->addFinding(
                'upload_file_in_upload_dir',
                Finding::SEVERITY_MEDIUM,
                $filePath,
                1,
                '上传目录中的文件引用了 $_FILES',
                Finding::CONFIDENCE_LOW,
                '上传目录中存在可能处理文件上传的代码',
                '确认这是否是预期的文件，上传目录不应包含可执行代码',
                $snippet
            );
        }
    }

    private function checkHtaccess(string $uploadPath): void
    {
        $htaccessPath = rtrim($uploadPath, '/') . '/.htaccess';
        
        if (!file_exists($htaccessPath)) {
            return;
        }

        $content = @file_get_contents($htaccessPath);
        if ($content === false) {
            return;
        }

        $lines = explode("\n", $content);

        foreach ($lines as $lineNumber => $line) {
            $line = trim($line);
            
            if (empty($line) || str_starts_with($line, '#')) {
                continue;
            }

            if (preg_match('/AddHandler|AddType.*php/i', $line)) {
                $snippet = $this->getFileLines($htaccessPath, $lineNumber + 1);
                
                $this->addFinding(
                    'upload_htaccess_php_handler',
                    Finding::SEVERITY_CRITICAL,
                    $htaccessPath,
                    $lineNumber + 1,
                    '.htaccess 中设置了 PHP 处理器: ' . $line,
                    Finding::CONFIDENCE_HIGH,
                    '.htaccess 中的 PHP 处理器配置可能允许攻击者执行上传的 PHP 文件',
                    '移除 .htaccess 中的 PHP 处理器配置，或确保服务器配置禁用上传目录的 PHP 执行',
                    $snippet
                );
            }

            if (preg_match('/SetHandler.*php/i', $line)) {
                $snippet = $this->getFileLines($htaccessPath, $lineNumber + 1);
                
                $this->addFinding(
                    'upload_htaccess_set_handler',
                    Finding::SEVERITY_CRITICAL,
                    $htaccessPath,
                    $lineNumber + 1,
                    '.htaccess 中设置了处理器: ' . $line,
                    Finding::CONFIDENCE_HIGH,
                    '.htaccess 中的 SetHandler 可能用于执行任意代码',
                    '审查并移除可疑的 .htaccess 配置',
                    $snippet
                );
            }

            if (preg_match('/php_flag|php_value/i', $line)) {
                $snippet = $this->getFileLines($htaccessPath, $lineNumber + 1);
                
                $this->addFinding(
                    'upload_htaccess_php_flag',
                    Finding::SEVERITY_MEDIUM,
                    $htaccessPath,
                    $lineNumber + 1,
                    '.htaccess 中包含 PHP 配置: ' . $line,
                    Finding::CONFIDENCE_MEDIUM,
                    '.htaccess 修改 PHP 配置可能用于绕过安全限制',
                    '审查 PHP 配置修改是否安全必要',
                    $snippet
                );
            }
        }
    }

    private function checkUploadMechanism(string $uploadPath): void
    {
        $projectRoot = dirname($uploadPath);
        
        $phpFiles = $this->scanDirectory($projectRoot, ['php'], $this->config->getExcludes());

        foreach ($phpFiles as $file) {
            $content = @file_get_contents($file);
            if ($content === false) {
                continue;
            }

            $lines = explode("\n", $content);

            foreach ($lines as $lineNumber => $line) {
                if (preg_match('/move_uploaded_file\s*\(/i', $line, $matches)) {
                    $context = $this->getFileLines($file, $lineNumber + 1);
                    
                    $hasValidation = $this->checkUploadValidation($content, $lineNumber);
                    
                    if (!$hasValidation) {
                        $this->addFinding(
                            'upload_no_whitelist_validation',
                            Finding::SEVERITY_HIGH,
                            $file,
                            $lineNumber + 1,
                            '文件上传但未检测到白名单验证: ' . trim($matches[0]),
                            Finding::CONFIDENCE_MEDIUM,
                            '文件上传处理没有明显的白名单扩展名或 MIME 类型验证',
                            '添加严格的扩展名白名单验证，使用 finfo 检查文件真实类型，检查文件内容',
                            $context
                        );
                    }
                }

                if (preg_match('/\$_(FILES)\s*\[/i', $line, $matches)) {
                    $context = $this->getFileLines($file, $lineNumber + 1);
                    
                    $hasProtection = $this->checkUploadProtection($content, $lineNumber);
                    
                    if (!$hasProtection) {
                        $this->addFinding(
                            'upload_accessing_files',
                            Finding::SEVERITY_LOW,
                            $file,
                            $lineNumber + 1,
                            '访问 $_FILES 超全局变量: ' . trim($matches[0]),
                            Finding::CONFIDENCE_LOW,
                            '代码访问 $_FILES，可能存在文件上传处理逻辑',
                            '确保上传处理包含完整的安全验证',
                            $context
                        );
                    }
                }
            }
        }
    }

    private function checkUploadValidation(string $content, int $currentLine): bool
    {
        $lines = explode("\n", $content);
        
        $start = max(0, $currentLine - 50);
        $end = min(count($lines) - 1, $currentLine + 10);

        $validationPatterns = [
            '/in_array.*extension/i',
            '/\.(jpg|jpeg|png|gif|bmp|webp|pdf|doc|docx|xls|xlsx)\s*$/i',
            '/mime_content_type|finfo_|mime_?type/i',
            '/exif_imagetype/i',
            '/getimagesize/i',
            '/pathinfo.*extension/i',
        ];

        for ($i = $start; $i <= $end; $i++) {
            foreach ($validationPatterns as $pattern) {
                if (preg_match($pattern, $lines[$i])) {
                    return true;
                }
            }
        }

        return false;
    }

    private function checkUploadProtection(string $content, int $currentLine): bool
    {
        $lines = explode("\n", $content);
        
        $start = max(0, $currentLine - 30);
        $end = min(count($lines) - 1, $currentLine + 30);

        $protectionPatterns = [
            '/move_uploaded_file/i',
            '/is_uploaded_file/i',
            '/filter_var.*FILTER_VALIDATE/i',
            '/ctype_/i',
            '/preg_match.*\./i',
        ];

        for ($i = $start; $i <= $end; $i++) {
            foreach ($protectionPatterns as $pattern) {
                if (preg_match($pattern, $lines[$i])) {
                    return true;
                }
            }
        }

        return false;
    }
}
