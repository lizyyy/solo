<?php

declare(strict_types=1);

namespace PhpSecurityScanner\Scanner;

use PhpSecurityScanner\Config;
use PhpSecurityScanner\Finding;

class PhpCodeScanner extends AbstractScanner
{
    private Config $config;

    private const DANGEROUS_FUNCTIONS = [
        'eval' => [
            'severity' => Finding::SEVERITY_CRITICAL,
            'reason' => 'eval() 执行任意 PHP 代码，可能导致远程代码执行 (RCE)',
            'remediation' => '使用数据处理替代 eval，或使用白名单严格限制输入',
        ],
        'assert' => [
            'severity' => Finding::SEVERITY_CRITICAL,
            'reason' => 'assert() 在 PHP 7 中可执行字符串，可能导致 RCE',
            'remediation' => '避免使用 assert，改用 if 条件判断',
        ],
        'system' => [
            'severity' => Finding::SEVERITY_CRITICAL,
            'reason' => 'system() 执行系统命令并输出结果，可能导致命令注入',
            'remediation' => '使用 escapeshellcmd/escapeshellarg 转义，或避免执行动态命令',
        ],
        'exec' => [
            'severity' => Finding::SEVERITY_CRITICAL,
            'reason' => 'exec() 执行系统命令，可能导致命令注入',
            'remediation' => '使用 escapeshellcmd/escapeshellarg 转义，或避免执行动态命令',
        ],
        'shell_exec' => [
            'severity' => Finding::SEVERITY_CRITICAL,
            'reason' => 'shell_exec() 通过 shell 执行命令，可能导致命令注入',
            'remediation' => '使用 escapeshellcmd/escapeshellarg 转义，或避免执行动态命令',
        ],
        'passthru' => [
            'severity' => Finding::SEVERITY_CRITICAL,
            'reason' => 'passthru() 执行命令并输出原始结果，可能导致命令注入',
            'remediation' => '使用 escapeshellcmd/escapeshellarg 转义，或避免执行动态命令',
        ],
        'proc_open' => [
            'severity' => Finding::SEVERITY_HIGH,
            'reason' => 'proc_open() 打开进程管道，可能导致命令注入',
            'remediation' => '避免使用用户可控数据构建命令参数',
        ],
        'popen' => [
            'severity' => Finding::SEVERITY_HIGH,
            'reason' => 'popen() 打开进程文件指针，可能导致命令注入',
            'remediation' => '避免使用用户可控数据构建命令参数',
        ],
        'create_function' => [
            'severity' => Finding::SEVERITY_CRITICAL,
            'reason' => 'create_function() 已废弃，存在代码注入风险',
            'remediation' => '使用匿名函数替代',
        ],
        'unserialize' => [
            'severity' => Finding::SEVERITY_HIGH,
            'reason' => 'unserialize() 处理不可信数据可能导致对象注入',
            'remediation' => '使用 JSON 替代 PHP 序列化，或限制可反序列化的类',
        ],
        'extract' => [
            'severity' => Finding::SEVERITY_MEDIUM,
            'reason' => 'extract() 可能覆盖已有变量，导致变量覆盖漏洞',
            'remediation' => '使用 EXTR_SKIP 或 EXTR_PREFIX_SAME 标志，或避免使用',
        ],
        'parse_str' => [
            'severity' => Finding::SEVERITY_MEDIUM,
            'reason' => 'parse_str() 不带第二个参数时会注册变量到当前作用域',
            'remediation' => '始终使用第二个参数将结果存入数组',
        ],
        'mb_parse_str' => [
            'severity' => Finding::SEVERITY_MEDIUM,
            'reason' => 'mb_parse_str() 不带第二个参数时会注册变量到当前作用域',
            'remediation' => '始终使用第二个参数将结果存入数组',
        ],
    ];

    public function __construct(Config $config)
    {
        $this->config = $config;
    }

    public function getCategory(): string
    {
        return 'code_security';
    }

    public function scan(string $path): array
    {
        $this->findings = [];

        if (is_dir($path)) {
            $files = $this->scanDirectory($path, ['php', 'php5', 'phtml'], $this->config->getExcludes());
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

        $tokens = @token_get_all($content);
        if ($tokens === []) {
            return;
        }

        $this->scanDangerousFunctions($tokens, $filePath);
        $this->scanSqlInjection($content, $filePath);
        $this->scanWeakHash($content, $filePath);
        $this->scanDebugExposure($content, $filePath);
    }

    private function scanDangerousFunctions(array $tokens, string $filePath): void
    {
        $inString = false;
        $inComment = false;
        $braceLevel = 0;

        foreach ($tokens as $index => $token) {
            if (!is_array($token)) {
                if ($token === '{') {
                    $braceLevel++;
                } elseif ($token === '}') {
                    $braceLevel--;
                }
                continue;
            }

            [$tokenId, $tokenValue, $lineNumber] = $token;

            if ($tokenId === T_CONSTANT_ENCAPSED_STRING || $tokenId === T_ENCAPSED_AND_WHITESPACE) {
                $inString = true;
                continue;
            }

            if ($tokenId === T_COMMENT || $tokenId === T_DOC_COMMENT) {
                $inComment = true;
                continue;
            }

            $inString = false;
            $inComment = false;

            if ($tokenId === T_STRING) {
                $funcName = strtolower($tokenValue);
                if (isset(self::DANGEROUS_FUNCTIONS[$funcName])) {
                    $nextToken = $tokens[$index + 1] ?? null;
                    if ($nextToken && (is_string($nextToken) && $nextToken === '(' || $nextToken[0] === T_WHITESPACE)) {
                        $info = self::DANGEROUS_FUNCTIONS[$funcName];
                        
                        $snippet = $this->getFileLines($filePath, $lineNumber);
                        $evidence = "调用了危险函数: {$funcName}()";

                        $this->addFinding(
                            'dangerous_function_' . $funcName,
                            $info['severity'],
                            $filePath,
                            $lineNumber,
                            $evidence,
                            Finding::CONFIDENCE_HIGH,
                            $info['reason'],
                            $info['remediation'],
                            $snippet
                        );
                    }
                }
            }
        }
    }

    private function scanSqlInjection(string $content, string $filePath): void
    {
        $lines = explode("\n", $content);

        $sqlPatterns = [
            [
                'pattern' => '/(\$_(GET|POST|REQUEST|COOKIE|FILES)\[[^\]]+\])\s*(\.|\.)?\s*(mysql|mysqli|pdo)->(query|exec)/i',
                'rule_id' => 'sql_injection_direct_input',
                'severity' => Finding::SEVERITY_CRITICAL,
                'confidence' => Finding::CONFIDENCE_HIGH,
                'reason' => '直接将用户输入传入数据库查询方法，存在 SQL 注入风险',
                'remediation' => '使用预处理语句 (PDO prepare/execute 或 mysqli_stmt)，或至少使用正确的转义函数',
            ],
            [
                'pattern' => '/mysql_query\s*\(\s*[\'"]?(SELECT|INSERT|UPDATE|DELETE).*?[\'"]?\s*\.\s*\$/',
                'rule_id' => 'sql_injection_string_concat',
                'severity' => Finding::SEVERITY_HIGH,
                'confidence' => Finding::CONFIDENCE_MEDIUM,
                'reason' => '字符串拼接 SQL 语句，可能存在 SQL 注入风险',
                'remediation' => '使用预处理语句，避免字符串拼接 SQL',
            ],
            [
                'pattern' => '/\$_(GET|POST|REQUEST|COOKIE|FILES)\[[^\]]+\].*mysql_real_escape_string/i',
                'rule_id' => 'sql_misuse_escape',
                'severity' => Finding::SEVERITY_MEDIUM,
                'confidence' => Finding::CONFIDENCE_MEDIUM,
                'reason' => '虽然使用了转义函数，但仍建议使用预处理语句',
                'remediation' => '迁移到 PDO 预处理语句，比手动转义更安全',
            ],
        ];

        foreach ($lines as $lineNumber => $line) {
            foreach ($sqlPatterns as $patternInfo) {
                if (preg_match($patternInfo['pattern'], $line, $matches)) {
                    $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                    
                    $this->addFinding(
                        $patternInfo['rule_id'],
                        $patternInfo['severity'],
                        $filePath,
                        $lineNumber + 1,
                        '可能的 SQL 注入: ' . trim($matches[0] ?? $line),
                        $patternInfo['confidence'],
                        $patternInfo['reason'],
                        $patternInfo['remediation'],
                        $snippet
                    );
                }
            }
        }
    }

    private function scanWeakHash(string $content, string $filePath): void
    {
        $lines = explode("\n", $content);

        $hashPatterns = [
            [
                'pattern' => '/\bmd5\s*\(/i',
                'rule_id' => 'weak_hash_md5',
                'severity' => Finding::SEVERITY_HIGH,
                'confidence' => Finding::CONFIDENCE_HIGH,
                'reason' => 'MD5 已被破解，不应用于密码哈希或安全校验',
                'remediation' => '使用 password_hash() 配合 PASSWORD_DEFAULT 或 PASSWORD_BCRYPT',
            ],
            [
                'pattern' => '/\bsha1\s*\(/i',
                'rule_id' => 'weak_hash_sha1',
                'severity' => Finding::SEVERITY_HIGH,
                'confidence' => Finding::CONFIDENCE_HIGH,
                'reason' => 'SHA-1 已被破解，不应用于密码哈希',
                'remediation' => '使用 password_hash() 配合 PASSWORD_DEFAULT 或 PASSWORD_BCRYPT',
            ],
            [
                'pattern' => '/crypt\s*\([^,]+,\s*[\'"]md5/i',
                'rule_id' => 'weak_hash_crypt_md5',
                'severity' => Finding::SEVERITY_HIGH,
                'confidence' => Finding::CONFIDENCE_HIGH,
                'reason' => '使用 crypt() 配合 MD5 盐值，强度不足',
                'remediation' => '使用 password_hash() 替代',
            ],
            [
                'pattern' => '/\$2[axy]\$/',
                'rule_id' => 'weak_hash_blowfish_old',
                'severity' => Finding::SEVERITY_MEDIUM,
                'confidence' => Finding::CONFIDENCE_LOW,
                'reason' => '旧版 Blowfish 哈希格式 (2a/2x/2y)，建议使用 password_hash()',
                'remediation' => '使用 password_hash() 配合 PASSWORD_BCRYPT 并设置足够的 cost',
            ],
        ];

        foreach ($lines as $lineNumber => $line) {
            foreach ($hashPatterns as $patternInfo) {
                if (preg_match($patternInfo['pattern'], $line, $matches)) {
                    if (str_contains($line, 'password_hash') || str_contains($line, 'password_verify')) {
                        continue;
                    }

                    $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                    
                    $this->addFinding(
                        $patternInfo['rule_id'],
                        $patternInfo['severity'],
                        $filePath,
                        $lineNumber + 1,
                        '弱密码哈希函数: ' . trim($matches[0] ?? $line),
                        $patternInfo['confidence'],
                        $patternInfo['reason'],
                        $patternInfo['remediation'],
                        $snippet
                    );
                }
            }
        }
    }

    private function scanDebugExposure(string $content, string $filePath): void
    {
        $lines = explode("\n", $content);

        $debugPatterns = [
            [
                'pattern' => '/\bvar_dump\s*\(/i',
                'rule_id' => 'debug_var_dump',
                'severity' => Finding::SEVERITY_LOW,
                'confidence' => Finding::CONFIDENCE_HIGH,
                'reason' => 'var_dump() 用于调试，生产环境应移除',
                'remediation' => '移除调试代码，或使用环境判断包裹',
            ],
            [
                'pattern' => '/\bprint_r\s*\(/i',
                'rule_id' => 'debug_print_r',
                'severity' => Finding::SEVERITY_LOW,
                'confidence' => Finding::CONFIDENCE_HIGH,
                'reason' => 'print_r() 用于调试，生产环境应移除',
                'remediation' => '移除调试代码，或使用环境判断包裹',
            ],
            [
                'pattern' => '/\bdebug_print_backtrace\s*\(/i',
                'rule_id' => 'debug_backtrace',
                'severity' => Finding::SEVERITY_MEDIUM,
                'confidence' => Finding::CONFIDENCE_HIGH,
                'reason' => 'debug_print_backtrace() 暴露调用栈信息',
                'remediation' => '移除调试代码，使用日志库替代',
            ],
            [
                'pattern' => '/error_reporting\s*\(\s*E_ALL/i',
                'rule_id' => 'debug_error_reporting_all',
                'severity' => Finding::SEVERITY_MEDIUM,
                'confidence' => Finding::CONFIDENCE_MEDIUM,
                'reason' => 'error_reporting(E_ALL) 可能暴露敏感信息',
                'remediation' => '生产环境设置 error_reporting(0) 或仅记录到日志',
            ],
        ];

        foreach ($lines as $lineNumber => $line) {
            if (str_contains($line, '//') || str_contains($line, '#') || str_contains($line, '/*')) {
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
                        '调试代码暴露: ' . trim($matches[0] ?? $line),
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
