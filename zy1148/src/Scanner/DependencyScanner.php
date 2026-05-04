<?php

declare(strict_types=1);

namespace PhpSecurityScanner\Scanner;

use Composer\Semver\VersionParser;
use Composer\Semver\Constraint\Constraint;
use PhpSecurityScanner\Finding;
use PhpSecurityScanner\Config;

class DependencyScanner extends AbstractScanner
{
    private Config $config;
    private VersionParser $versionParser;

    private const HIGH_RISK_PACKAGES = [
        'guzzlehttp/guzzle' => [
            'versions' => '<6.5.8 || >=7.0.0,<7.4.5',
            'cve' => 'CVE-2022-31090',
            'severity' => Finding::SEVERITY_HIGH,
            'reason' => 'Guzzle HTTP 存在 cookie 域验证绕过漏洞',
            'remediation' => '升级到 6.5.8、7.4.5 或更高版本',
        ],
        'symfony/http-kernel' => [
            'versions' => '<4.4.50 || >=5.0.0,<5.4.20 || >=6.0.0,<6.0.20 || >=6.1.0,<6.1.12',
            'cve' => 'CVE-2022-24894',
            'severity' => Finding::SEVERITY_CRITICAL,
            'reason' => 'Symfony HTTP Kernel 存在存储型 XSS 漏洞',
            'remediation' => '升级到 4.4.50、5.4.20、6.0.20、6.1.12 或更高版本',
        ],
        'laravel/framework' => [
            'versions' => '<6.20.42 || >=7.0.0,<8.83.27 || >=9.0.0,<9.51.0',
            'cve' => 'CVE-2023-22602',
            'severity' => Finding::SEVERITY_HIGH,
            'reason' => 'Laravel 存在验证绕过漏洞',
            'remediation' => '升级到 6.20.42、8.83.27、9.51.0 或更高版本',
        ],
        'doctrine/dbal' => [
            'versions' => '<3.7.3',
            'cve' => 'CVE-2024-21647',
            'severity' => Finding::SEVERITY_HIGH,
            'reason' => 'Doctrine DBAL 存在 SQL 注入漏洞',
            'remediation' => '升级到 3.7.3 或更高版本',
        ],
        'phpmailer/phpmailer' => [
            'versions' => '<6.5.0',
            'cve' => 'CVE-2020-36326',
            'severity' => Finding::SEVERITY_CRITICAL,
            'reason' => 'PHPMailer 存在远程代码执行漏洞',
            'remediation' => '升级到 6.5.0 或更高版本',
        ],
        'tecnickcom/tcpdf' => [
            'versions' => '<6.2.22',
            'cve' => 'CVE-2019-14417',
            'severity' => Finding::SEVERITY_HIGH,
            'reason' => 'TCPDF 存在 XSS 和代码注入漏洞',
            'remediation' => '升级到 6.2.22 或更高版本',
        ],
        'mpdf/mpdf' => [
            'versions' => '<8.0.17',
            'cve' => 'CVE-2021-46078',
            'severity' => Finding::SEVERITY_HIGH,
            'reason' => 'mPDF 存在 SSRF 和任意文件读取漏洞',
            'remediation' => '升级到 8.0.17 或更高版本',
        ],
        'dompdf/dompdf' => [
            'versions' => '<2.0.3',
            'cve' => 'CVE-2023-28104',
            'severity' => Finding::SEVERITY_HIGH,
            'reason' => 'Dompdf 存在 XSS 和信息泄露漏洞',
            'remediation' => '升级到 2.0.3 或更高版本',
        ],
        'erusev/parsedown' => [
            'versions' => '<1.8.0-beta-7',
            'cve' => 'CVE-2019-10916',
            'severity' => Finding::SEVERITY_MEDIUM,
            'reason' => 'Parsedown 存在 XSS 漏洞',
            'remediation' => '升级到 1.8.0-beta-7 或更高版本',
        ],
        'league/flysystem' => [
            'versions' => '<1.1.10 || >=2.0.0,<2.1.1',
            'cve' => 'CVE-2021-32708',
            'severity' => Finding::SEVERITY_HIGH,
            'reason' => 'Flysystem 存在路径遍历漏洞',
            'remediation' => '升级到 1.1.10、2.1.1 或更高版本',
        ],
        'symfony/security-bundle' => [
            'versions' => '<4.4.50 || >=5.0.0,<5.4.20 || >=6.0.0,<6.0.20',
            'cve' => 'CVE-2022-24895',
            'severity' => Finding::SEVERITY_HIGH,
            'reason' => 'Symfony Security 存在认证绕过漏洞',
            'remediation' => '升级到安全版本',
        ],
        'twig/twig' => [
            'versions' => '<2.15.3 || >=3.0.0,<3.4.3',
            'cve' => 'CVE-2022-24894',
            'severity' => Finding::SEVERITY_HIGH,
            'reason' => 'Twig 存在沙箱绕过漏洞',
            'remediation' => '升级到 2.15.3、3.4.3 或更高版本',
        ],
    ];

    public function __construct(Config $config)
    {
        $this->config = $config;
        $this->versionParser = new VersionParser();
    }

    public function getCategory(): string
    {
        return 'dependency_security';
    }

    public function scan(string $path): array
    {
        $this->findings = [];

        $lockFile = $this->findLockFile($path);
        if ($lockFile) {
            $this->scanLockFile($lockFile);
        }

        $composerJson = $this->findComposerJson($path);
        if ($composerJson) {
            $this->scanComposerJson($composerJson);
        }

        return $this->findings;
    }

    private function findLockFile(string $path): ?string
    {
        $lockPath = rtrim($path, '/') . '/composer.lock';
        return file_exists($lockPath) ? $lockPath : null;
    }

    private function findComposerJson(string $path): ?string
    {
        $jsonPath = rtrim($path, '/') . '/composer.json';
        return file_exists($jsonPath) ? $jsonPath : null;
    }

    private function scanLockFile(string $lockFile): void
    {
        $content = file_get_contents($lockFile);
        if ($content === false) {
            return;
        }

        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->addFinding(
                'dep_invalid_lock_file',
                Finding::SEVERITY_MEDIUM,
                $lockFile,
                1,
                'composer.lock 文件格式无效',
                Finding::CONFIDENCE_HIGH,
                '无法解析 composer.lock 文件，可能存在损坏或版本不兼容',
                '运行 composer install 或 composer update 修复 lock 文件',
                null
            );
            return;
        }

        $packages = $data['packages'] ?? [];
        $packagesDev = $data['packages-dev'] ?? [];

        foreach ($packages as $package) {
            $this->checkPackage($package, $lockFile, false);
        }

        foreach ($packagesDev as $package) {
            $this->checkPackage($package, $lockFile, true);
        }

        $this->checkComposerPluginIssues($lockFile);
    }

    private function scanComposerJson(string $jsonFile): void
    {
        $content = file_get_contents($jsonFile);
        if ($content === false) {
            return;
        }

        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return;
        }

        $require = $data['require'] ?? [];
        $requireDev = $data['require-dev'] ?? [];

        $this->checkDeprecatedConstraints(array_merge($require, $requireDev), $jsonFile);
        $this->checkSecurityConfig($data, $jsonFile);
    }

    private function checkPackage(array $package, string $filePath, bool $isDev): void
    {
        $name = $package['name'] ?? 'unknown';
        $version = $package['version'] ?? 'unknown';

        $normalizedVersion = $this->normalizeVersion($version);

        if (isset(self::HIGH_RISK_PACKAGES[$name])) {
            $risk = self::HIGH_RISK_PACKAGES[$name];
            
            if ($this->versionMatches($normalizedVersion, $risk['versions'])) {
                $severity = $risk['severity'];
                
                if ($isDev) {
                    $severity = $this->lowerSeverity($severity);
                }

                $this->addFinding(
                    'dep_vulnerable_' . str_replace('/', '_', $name),
                    $severity,
                    $filePath,
                    1,
                    sprintf('存在漏洞的依赖: %s %s', $name, $version),
                    Finding::CONFIDENCE_HIGH,
                    sprintf(
                        '%s (%s) - %s%s',
                        $name,
                        $risk['cve'] ?? 'Known vulnerability',
                        $risk['reason'],
                        $isDev ? ' (仅开发依赖)' : ''
                    ),
                    $risk['remediation'],
                    null
                );
            }
        }

        $this->checkOutdatedVersion($name, $normalizedVersion, $filePath, $isDev);
        $this->checkAbandonedPackage($package, $filePath, $isDev);
    }

    private function versionMatches(string $version, string $constraintString): bool
    {
        try {
            $versionConstraint = new Constraint('==', $this->versionParser->normalize($version));
            $constraint = $this->versionParser->parseConstraints($constraintString);
            
            return $constraint->matches($versionConstraint);
        } catch (\Exception $e) {
            return false;
        }
    }

    private function normalizeVersion(string $version): string
    {
        return ltrim($version, 'vV');
    }

    private function checkOutdatedVersion(string $name, string $version, string $filePath, bool $isDev): void
    {
        if (preg_match('/^(\d+)\.(\d+)\.(\d+)/', $version, $matches)) {
            $major = (int)$matches[1];
            $minor = (int)$matches[2];
            $patch = (int)$matches[3];

            if ($major === 0) {
                $severity = $isDev ? Finding::SEVERITY_INFO : Finding::SEVERITY_LOW;
                $this->addFinding(
                    'dep_zero_version_' . str_replace('/', '_', $name),
                    $severity,
                    $filePath,
                    1,
                    sprintf('零版本依赖: %s %s', $name, $version),
                    Finding::CONFIDENCE_HIGH,
                    '依赖包版本为 0.x.x，API 可能不稳定或存在未报告的漏洞',
                    '考虑升级到稳定版本 (>=1.0.0)',
                    null
                );
            }
        }

        if (str_contains($version, '-alpha') || str_contains($version, '-beta') || 
            str_contains($version, '-rc') || str_contains($version, '-dev')) {
            $severity = $isDev ? Finding::SEVERITY_INFO : Finding::SEVERITY_LOW;
            $this->addFinding(
                'dep_pre_release_' . str_replace('/', '_', $name),
                $severity,
                $filePath,
                1,
                sprintf('预发布/开发版本依赖: %s %s', $name, $version),
                Finding::CONFIDENCE_HIGH,
                '使用预发布或开发版本的依赖，可能存在未发现的问题',
                '生产环境建议使用稳定版本',
                null
            );
        }
    }

    private function checkAbandonedPackage(array $package, string $filePath, bool $isDev): void
    {
        if (isset($package['abandoned']) && $package['abandoned'] !== false) {
            $severity = $isDev ? Finding::SEVERITY_INFO : Finding::SEVERITY_MEDIUM;
            $name = $package['name'] ?? 'unknown';
            $replacement = is_string($package['abandoned']) ? $package['abandoned'] : null;

            $this->addFinding(
                'dep_abandoned_' . str_replace('/', '_', $name),
                $severity,
                $filePath,
                1,
                sprintf('已废弃的依赖: %s', $name),
                Finding::CONFIDENCE_HIGH,
                '该依赖包已被标记为废弃，将不再收到安全更新',
                $replacement ? sprintf('迁移到替代包: %s', $replacement) : '寻找替代包',
                null
            );
        }
    }

    private function checkDeprecatedConstraints(array $requirements, string $filePath): void
    {
        foreach ($requirements as $package => $constraint) {
            if (str_starts_with((string)$constraint, '@dev')) {
                $this->addFinding(
                    'dep_dev_constraint_' . str_replace('/', '_', $package),
                    Finding::SEVERITY_LOW,
                    $filePath,
                    1,
                    sprintf('开发版本约束: %s %s', $package, $constraint),
                    Finding::CONFIDENCE_HIGH,
                    '使用 @dev 稳定性标志，可能引入不稳定代码',
                    '生产环境建议使用稳定版本约束',
                    null
                );
            }

            if ($constraint === '*' || $constraint === 'dev-master') {
                $this->addFinding(
                    'dep_wildcard_constraint_' . str_replace('/', '_', $package),
                    Finding::SEVERITY_MEDIUM,
                    $filePath,
                    1,
                    sprintf('不安全的版本约束: %s %s', $package, $constraint),
                    Finding::CONFIDENCE_HIGH,
                    '使用通配符或分支约束，版本不可控',
                    '使用具体的版本约束，如 ^1.0 或 ~1.0',
                    null
                );
            }
        }
    }

    private function checkSecurityConfig(array $data, string $filePath): void
    {
        $config = $data['config'] ?? [];
        
        if (isset($config['preferred-install']) && $config['preferred-install'] === 'dist') {
        }

        if (isset($config['secure-http']) && $config['secure-http'] === false) {
            $this->addFinding(
                'dep_insecure_http',
                Finding::SEVERITY_HIGH,
                $filePath,
                1,
                '禁用了 HTTPS 安全检查: secure-http = false',
                Finding::CONFIDENCE_HIGH,
                '禁用 secure-http 允许通过 HTTP 下载依赖，存在中间人攻击风险',
                '移除 config.secure-http = false 配置，确保使用 HTTPS',
                null
            );
        }

        if (isset($data['minimum-stability'])) {
            $stability = $data['minimum-stability'];
            if (in_array($stability, ['dev', 'alpha', 'beta', 'RC'])) {
                $this->addFinding(
                    'dep_low_stability',
                    Finding::SEVERITY_LOW,
                    $filePath,
                    1,
                    sprintf('较低的稳定性设置: minimum-stability = %s', $stability),
                    Finding::CONFIDENCE_HIGH,
                    '允许安装不稳定版本的依赖',
                    '生产环境建议设置 minimum-stability = stable',
                    null
                );
            }
        }
    }

    private function checkComposerPluginIssues(string $filePath): void
    {
        $content = file_get_contents($filePath);
        if ($content === false) {
            return;
        }

        $data = json_decode($content, true);
        if (!isset($data['packages'])) {
            return;
        }

        foreach ($data['packages'] as $package) {
            $type = $package['type'] ?? '';
            if ($type === 'composer-plugin') {
                $name = $package['name'] ?? 'unknown';
                
                $safePlugins = [
                    'composer/installers',
                    'composer/package-versions-deprecated',
                    'dealerdirect/phpcodesniffer-composer-installer',
                ];

                if (!in_array($name, $safePlugins)) {
                    $this->addFinding(
                        'dep_composer_plugin_' . str_replace('/', '_', $name),
                        Finding::SEVERITY_MEDIUM,
                        $filePath,
                        1,
                        sprintf('Composer 插件: %s', $name),
                        Finding::CONFIDENCE_MEDIUM,
                        'Composer 插件在安装时执行代码，请确保信任该插件来源',
                        '仅使用已知安全的 Composer 插件',
                        null
                    );
                }
            }
        }
    }

    private function lowerSeverity(string $severity): string
    {
        return match ($severity) {
            Finding::SEVERITY_CRITICAL => Finding::SEVERITY_HIGH,
            Finding::SEVERITY_HIGH => Finding::SEVERITY_MEDIUM,
            Finding::SEVERITY_MEDIUM => Finding::SEVERITY_LOW,
            Finding::SEVERITY_LOW => Finding::SEVERITY_INFO,
            default => $severity,
        };
    }
}
