<?php

declare(strict_types=1);

namespace PhpSecurityScanner\Scanner;

use PhpSecurityScanner\Config;
use PhpSecurityScanner\Finding;

class ConfigScanner extends AbstractScanner
{
    private Config $config;

    public function __construct(Config $config)
    {
        $this->config = $config;
    }

    public function getCategory(): string
    {
        return 'config_security';
    }

    public function scan(string $path): array
    {
        $this->findings = [];

        if (is_dir($path)) {
            $files = $this->scanDirectory(
                $path,
                ['env', 'ini', 'php', 'yaml', 'yml', 'json', 'config', 'dist'],
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

        $filename = basename($filePath);

        if (str_starts_with($filename, '.env')) {
            $this->scanEnvFile($content, $filePath);
        }

        $this->scanSensitiveConfig($content, $filePath);
        $this->scanDebugConfig($content, $filePath);
    }

    private function scanEnvFile(string $content, string $filePath): void
    {
        $lines = explode("\n", $content);

        foreach ($lines as $lineNumber => $line) {
            $line = trim($line);
            
            if (empty($line) || str_starts_with($line, '#')) {
                continue;
            }

            if (preg_match('/^(DB_PASSWORD|DATABASE_PASSWORD|MYSQL_PASSWORD|PGPASSWORD)\s*=\s*(.+)$/i', $line, $matches)) {
                $value = trim($matches[2] ?? '');
                
                if (!empty($value) && $value !== '"${DB_PASSWORD}"' && $value !== '\'${DB_PASSWORD}\'') {
                    if (!str_starts_with($value, '${') && !str_starts_with($value, '%')) {
                        $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                        
                        $this->addFinding(
                            'env_hardcoded_db_password',
                            Finding::SEVERITY_CRITICAL,
                            $filePath,
                            $lineNumber + 1,
                            '硬编码数据库密码',
                            Finding::CONFIDENCE_HIGH,
                            '.env 文件中包含硬编码的数据库密码，存在凭证泄漏风险',
                            '使用环境变量注入或密钥管理服务，不要在 .env 文件中存储真实密码',
                            $snippet
                        );
                    }
                }
            }

            if (preg_match('/^(API_KEY|API_SECRET|APP_KEY|SECRET_KEY)\s*=\s*(.+)$/i', $line, $matches)) {
                $value = trim($matches[2] ?? '');
                
                if (!empty($value) && strlen($value) > 8) {
                    if (!str_starts_with($value, '${') && !str_starts_with($value, '%') && 
                        !str_starts_with($value, 'base64:') && !str_starts_with($value, 'def:')) {
                        $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                        
                        $this->addFinding(
                            'env_hardcoded_api_key',
                            Finding::SEVERITY_CRITICAL,
                            $filePath,
                            $lineNumber + 1,
                            '硬编码 API 密钥',
                            Finding::CONFIDENCE_HIGH,
                            '.env 文件中包含硬编码的 API 密钥，存在凭证泄漏风险',
                            '使用环境变量注入或密钥管理服务，不要在 .env 文件中存储真实密钥',
                            $snippet
                        );
                    }
                }
            }

            if (preg_match('/^(APP_DEBUG|WP_DEBUG|DEBUG)\s*=\s*(true|1|yes|on)$/i', $line, $matches)) {
                $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                
                $this->addFinding(
                    'env_debug_enabled',
                    Finding::SEVERITY_HIGH,
                    $filePath,
                    $lineNumber + 1,
                    '调试模式已启用: ' . trim($line),
                    Finding::CONFIDENCE_HIGH,
                    '调试模式在生产环境会暴露敏感信息和系统细节',
                    '生产环境设置 APP_DEBUG=false',
                    $snippet
                );
            }
        }
    }

    private function scanSensitiveConfig(string $content, string $filePath): void
    {
        $lines = explode("\n", $content);

        $sensitivePatterns = [
            [
                'pattern' => '/password\s*[:=]\s*["\']([^"\'<>]+)["\']/i',
                'rule_id' => 'config_hardcoded_password',
                'severity' => Finding::SEVERITY_CRITICAL,
                'confidence' => Finding::CONFIDENCE_MEDIUM,
                'reason' => '配置文件中包含硬编码的密码字符串',
                'remediation' => '使用环境变量或加密的配置存储',
            ],
            [
                'pattern' => '/secret\s*[:=]\s*["\']([^"\'<>]{8,})["\']/i',
                'rule_id' => 'config_hardcoded_secret',
                'severity' => Finding::SEVERITY_CRITICAL,
                'confidence' => Finding::CONFIDENCE_MEDIUM,
                'reason' => '配置文件中包含硬编码的密钥',
                'remediation' => '使用环境变量或密钥管理服务',
            ],
            [
                'pattern' => '/api_?key\s*[:=]\s*["\']([A-Za-z0-9_-]{16,})["\']/i',
                'rule_id' => 'config_hardcoded_api_key',
                'severity' => Finding::SEVERITY_CRITICAL,
                'confidence' => Finding::CONFIDENCE_MEDIUM,
                'reason' => '配置文件中包含硬编码的 API 密钥',
                'remediation' => '使用环境变量或密钥管理服务',
            ],
            [
                'pattern' => '/private_key|privateKey.*-----BEGIN.*PRIVATE KEY-----/s',
                'rule_id' => 'config_hardcoded_private_key',
                'severity' => Finding::SEVERITY_CRITICAL,
                'confidence' => Finding::CONFIDENCE_HIGH,
                'reason' => '配置文件中包含硬编码的私钥',
                'remediation' => '私钥应存储在安全的密钥管理服务中，永远不要硬编码',
            ],
        ];

        foreach ($lines as $lineNumber => $line) {
            if (str_starts_with(trim($line), '//') || str_starts_with(trim($line), '#') || str_starts_with(trim($line), '*')) {
                continue;
            }

            foreach ($sensitivePatterns as $patternInfo) {
                if (preg_match($patternInfo['pattern'], $line, $matches)) {
                    if (isset($matches[1]) && in_array(strtolower($matches[1]), ['', 'password', 'secret', 'null', 'true', 'false', 'env'])) {
                        continue;
                    }

                    $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                    
                    $this->addFinding(
                        $patternInfo['rule_id'],
                        $patternInfo['severity'],
                        $filePath,
                        $lineNumber + 1,
                        '敏感配置硬编码: ' . trim($line),
                        $patternInfo['confidence'],
                        $patternInfo['reason'],
                        $patternInfo['remediation'],
                        $snippet
                    );
                }
            }
        }
    }

    private function scanDebugConfig(string $content, string $filePath): void
    {
        $lines = explode("\n", $content);

        $debugPatterns = [
            [
                'pattern' => '/display_errors\s*=\s*(On|1|true|yes)/i',
                'rule_id' => 'php_display_errors_on',
                'severity' => Finding::SEVERITY_MEDIUM,
                'confidence' => Finding::CONFIDENCE_HIGH,
                'reason' => 'display_errors 启用会在浏览器显示错误信息',
                'remediation' => '生产环境设置 display_errors = Off，使用日志记录错误',
            ],
            [
                'pattern' => '/error_reporting\s*=\s*E_ALL/i',
                'rule_id' => 'php_error_reporting_all',
                'severity' => Finding::SEVERITY_LOW,
                'confidence' => Finding::CONFIDENCE_MEDIUM,
                'reason' => 'E_ALL 错误报告级别可能暴露过多信息',
                'remediation' => '生产环境考虑设置 error_reporting = E_ALL & ~E_DEPRECATED & ~E_STRICT',
            ],
            [
                'pattern' => '/log_errors\s*=\s*Off/i',
                'rule_id' => 'php_log_errors_off',
                'severity' => Finding::SEVERITY_LOW,
                'confidence' => Finding::CONFIDENCE_MEDIUM,
                'reason' => '日志错误关闭不利于问题追踪',
                'remediation' => '生产环境启用 log_errors 并配置 error_log',
            ],
        ];

        foreach ($lines as $lineNumber => $line) {
            if (str_starts_with(trim($line), ';') || str_starts_with(trim($line), '#')) {
                continue;
            }

            foreach ($debugPatterns as $patternInfo) {
                if (preg_match($patternInfo['pattern'], $line, $matches)) {
                    $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                    
                    $this->addFinding(
                        $patternInfo['rule_id'],
                        $patternInfo['severity'],
                        $filePath,
                        $lineNumber + 1,
                        '调试配置问题: ' . trim($line),
                        $patternInfo['confidence'],
                        $patternInfo['reason'],
                        $patternInfo['remediation'],
                        $snippet
                    );
                }
            }
        }
    }
}
