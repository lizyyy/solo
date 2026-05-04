<?php

declare(strict_types=1);

namespace DeployFlow\Parser;

use DeployFlow\Exception\DeployFlowException;
use Symfony\Component\Yaml\Yaml;
use Symfony\Component\Yaml\Exception\ParseException;

class ReleaseConfigParser
{
    private array $config = [];
    private string $yamlPath;

    public function __construct(string $yamlPath)
    {
        $this->yamlPath = $yamlPath;
    }

    public function parse(): void
    {
        if (!file_exists($this->yamlPath)) {
            $this->config = $this->getDefaultConfig();
            return;
        }

        $content = file_get_contents($this->yamlPath);
        if ($content === false) {
            throw DeployFlowException::ioError('read', $this->yamlPath, 'Cannot read file');
        }

        try {
            $parsed = Yaml::parse($content);
        } catch (ParseException $e) {
            throw DeployFlowException::parsingError(
                $this->yamlPath,
                'YAML parse error: ' . $e->getMessage(),
                $e->getParsedLine()
            );
        }

        $this->config = array_merge($this->getDefaultConfig(), $parsed ?: []);
    }

    private function getDefaultConfig(): array
    {
        return [
            'project' => [
                'name' => 'unnamed-project',
                'version' => '1.0.0',
                'description' => '',
            ],
            'build' => [
                'output_format' => 'tar',
                'include' => [
                    'public/',
                    'config/',
                    'src/',
                    'vendor/',
                    'composer.json',
                    'composer.lock',
                ],
                'exclude' => [
                    '.git/',
                    '.env',
                    '.env.local',
                    'node_modules/',
                    'tests/',
                    '.phpunit/',
                    'output/',
                ],
            ],
            'deploy' => [
                'default_target' => 'production',
                'backup_before_deploy' => true,
                'maintenance_mode' => true,
                'clear_cache' => true,
            ],
            'validation' => [
                'check_composer_platform' => true,
                'check_php_extensions' => true,
                'check_env_differences' => true,
                'check_directory_permissions' => true,
                'check_sensitive_configs' => true,
                'check_migration_order' => true,
            ],
            'migrations' => [
                'directory' => 'migrations',
                'run_before_deploy' => false,
                'require_manual_confirmation' => true,
            ],
            'rollback' => [
                'enabled' => true,
                'keep_releases' => 5,
                'auto_backup' => true,
            ],
            'reporting' => [
                'formats' => ['markdown', 'json'],
                'include_changes' => true,
                'include_validations' => true,
            ],
        ];
    }

    public function getConfig(): array
    {
        return $this->config;
    }

    public function get(string $key, $default = null)
    {
        $keys = explode('.', $key);
        $value = $this->config;

        foreach ($keys as $k) {
            if (!is_array($value) || !isset($value[$k])) {
                return $default;
            }
            $value = $value[$k];
        }

        return $value;
    }

    public function getProjectName(): string
    {
        return $this->config['project']['name'] ?? 'unnamed-project';
    }

    public function getProjectVersion(): string
    {
        return $this->config['project']['version'] ?? '1.0.0';
    }

    public function getOutputFormat(): string
    {
        return $this->config['build']['output_format'] ?? 'tar';
    }

    public function getIncludePaths(): array
    {
        return $this->config['build']['include'] ?? [];
    }

    public function getExcludePaths(): array
    {
        return $this->config['build']['exclude'] ?? [];
    }

    public function getDefaultTarget(): string
    {
        return $this->config['deploy']['default_target'] ?? 'production';
    }

    public function shouldBackupBeforeDeploy(): bool
    {
        return $this->config['deploy']['backup_before_deploy'] ?? true;
    }

    public function shouldClearCache(): bool
    {
        return $this->config['deploy']['clear_cache'] ?? true;
    }

    public function isValidationEnabled(string $validation): bool
    {
        return $this->config['validation'][$validation] ?? true;
    }

    public function getMigrationsDirectory(): string
    {
        return $this->config['migrations']['directory'] ?? 'migrations';
    }

    public function shouldRunMigrationsBeforeDeploy(): bool
    {
        return $this->config['migrations']['run_before_deploy'] ?? false;
    }

    public function requireMigrationConfirmation(): bool
    {
        return $this->config['migrations']['require_manual_confirmation'] ?? true;
    }

    public function isRollbackEnabled(): bool
    {
        return $this->config['rollback']['enabled'] ?? true;
    }

    public function getKeepReleases(): int
    {
        return $this->config['rollback']['keep_releases'] ?? 5;
    }

    public function getReportFormats(): array
    {
        return $this->config['reporting']['formats'] ?? ['markdown', 'json'];
    }
}
