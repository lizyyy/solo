<?php

declare(strict_types=1);

namespace PhpSecurityScanner;

use Symfony\Component\Yaml\Yaml;

class Config
{
    private const DEFAULT_RULES = [
        'dangerous_functions' => [
            'enabled' => true,
            'severity' => 'critical',
            'functions' => ['eval', 'assert', 'system', 'exec', 'shell_exec', 'passthru', 'proc_open', 'popen', 'create_function'],
        ],
        'sql_injection' => [
            'enabled' => true,
            'severity' => 'critical',
            'patterns' => [
                '/\$_(GET|POST|REQUEST|COOKIE|FILES)\[.*\].*\.(mysql|mysqli|pdo)->query/i',
                '/\$_(GET|POST|REQUEST|COOKIE|FILES)\[.*\].*mysql_(query|real_query)/i',
                '/SELECT.*FROM.*\$[a-zA-Z_]/i',
                '/INSERT.*INTO.*VALUES.*\$[a-zA-Z_]/i',
                '/UPDATE.*SET.*\$[a-zA-Z_]/i',
                '/DELETE.*FROM.*\$[a-zA-Z_]/i',
            ],
        ],
        'xss_template' => [
            'enabled' => true,
            'severity' => 'high',
            'twig_patterns' => [
                '/\{\{.*\|raw\s*\}\}/i',
                '/\{\{\s*\$.*\s*\}\}/i',
            ],
            'blade_patterns' => [
                '/\{!!.*!!\}/i',
            ],
        ],
        'weak_hash' => [
            'enabled' => true,
            'severity' => 'high',
            'patterns' => [
                '/md5\s*\(/i',
                '/sha1\s*\(/i',
                '/crypt\s*\([^,]+,\s*["\']md5/i',
            ],
        ],
        'debug_exposure' => [
            'enabled' => true,
            'severity' => 'medium',
            'patterns' => [
                '/display_errors\s*=\s*On/i',
                '/error_reporting\s*=\s*E_ALL/i',
                '/APP_DEBUG\s*=\s*true/i',
                '/WP_DEBUG\s*=\s*true/i',
                '/var_dump\s*\(/i',
                '/print_r\s*\(/i',
                '/debug_print_backtrace\s*\(/i',
            ],
        ],
        'sensitive_config' => [
            'enabled' => true,
            'severity' => 'critical',
            'patterns' => [
                '/password\s*=\s*["\'][^"\']+["\']/i',
                '/secret\s*=\s*["\'][^"\']+["\']/i',
                '/api_?key\s*=\s*["\'][^"\']+["\']/i',
                '/db_?password\s*=\s*["\'][^"\']+["\']/i',
                '/database_?password\s*=\s*["\'][^"\']+["\']/i',
            ],
        ],
        'upload_security' => [
            'enabled' => true,
            'severity' => 'high',
            'check_white_list' => true,
        ],
    ];

    private array $config = [];
    private array $rules = [];
    private array $directories = [];
    private array $excludes = [];

    public function __construct(?string $configFile = null)
    {
        $this->rules = self::DEFAULT_RULES;
        
        if ($configFile && file_exists($configFile)) {
            $this->loadFromFile($configFile);
        }
    }

    public function loadFromFile(string $path): void
    {
        if (!file_exists($path)) {
            throw new \RuntimeException("Config file not found: {$path}");
        }

        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        
        if ($extension === 'yaml' || $extension === 'yml') {
            $data = Yaml::parseFile($path);
        } elseif ($extension === 'json') {
            $data = json_decode(file_get_contents($path), true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new \RuntimeException("Invalid JSON in config file: " . json_last_error_msg());
            }
        } else {
            throw new \RuntimeException("Unsupported config file format: {$extension}");
        }

        if (isset($data['rules']) && is_array($data['rules'])) {
            $this->rules = array_merge($this->rules, $data['rules']);
        }

        if (isset($data['directories']) && is_array($data['directories'])) {
            $this->directories = $data['directories'];
        }

        if (isset($data['excludes']) && is_array($data['excludes'])) {
            $this->excludes = $data['excludes'];
        }

        if (isset($data['paths']) && is_array($data['paths'])) {
            $this->config['paths'] = $data['paths'];
        }
    }

    public function getRule(string $ruleId): ?array
    {
        return $this->rules[$ruleId] ?? null;
    }

    public function getAllRules(): array
    {
        return $this->rules;
    }

    public function isRuleEnabled(string $ruleId): bool
    {
        return isset($this->rules[$ruleId]['enabled']) && $this->rules[$ruleId]['enabled'] === true;
    }

    public function getDirectories(): array
    {
        return $this->directories ?: ['src/', 'controllers/', 'templates/'];
    }

    public function getExcludes(): array
    {
        return $this->excludes ?: ['vendor/', 'node_modules/', '.git/'];
    }

    public function getPath(string $key, ?string $default = null): ?string
    {
        return $this->config['paths'][$key] ?? $default;
    }

    public function getDefaultSecurityRules(): string
    {
        return Yaml::dump([
            'rules' => $this->rules,
            'directories' => $this->getDirectories(),
            'excludes' => $this->getExcludes(),
            'paths' => [
                'composer_json' => 'composer.json',
                'composer_lock' => 'composer.lock',
                'routes' => 'routes.php',
                'env_example' => '.env.example',
            ],
        ], 4);
    }
}
