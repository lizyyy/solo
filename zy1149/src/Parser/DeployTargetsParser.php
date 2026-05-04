<?php

declare(strict_types=1);

namespace DeployFlow\Parser;

use DeployFlow\Exception\DeployFlowException;

class DeployTargetsParser
{
    private array $targets = [];
    private string $jsonPath;

    public function __construct(string $jsonPath)
    {
        $this->jsonPath = $jsonPath;
    }

    public function parse(): void
    {
        if (!file_exists($this->jsonPath)) {
            $this->targets = $this->getDefaultTargets();
            return;
        }

        $content = file_get_contents($this->jsonPath);
        if ($content === false) {
            throw DeployFlowException::ioError('read', $this->jsonPath, 'Cannot read file');
        }

        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw DeployFlowException::parsingError(
                $this->jsonPath,
                'JSON decode error: ' . json_last_error_msg()
            );
        }

        if (!isset($data['targets']) || !is_array($data['targets'])) {
            throw DeployFlowException::parsingError(
                $this->jsonPath,
                'Missing or invalid "targets" array in deploy-targets.json'
            );
        }

        foreach ($data['targets'] as $name => $target) {
            $this->targets[$name] = $this->parseTarget($name, $target);
        }
    }

    private function getDefaultTargets(): array
    {
        return [
            'development' => [
                'name' => 'development',
                'type' => 'server',
                'environment' => 'dev',
                'php_version' => '8.0',
                'php_extensions' => ['json', 'pdo', 'pdo_mysql', 'mbstring'],
                'deploy_path' => '/var/www/html',
                'webserver_user' => 'www-data',
                'maintenance_enabled' => false,
                'backup_enabled' => false,
                'description' => 'Development environment',
            ],
            'staging' => [
                'name' => 'staging',
                'type' => 'server',
                'environment' => 'staging',
                'php_version' => '8.0',
                'php_extensions' => ['json', 'pdo', 'pdo_mysql', 'mbstring', 'opcache'],
                'deploy_path' => '/var/www/app',
                'webserver_user' => 'www-data',
                'maintenance_enabled' => true,
                'backup_enabled' => true,
                'description' => 'Staging environment',
            ],
            'production' => [
                'name' => 'production',
                'type' => 'server',
                'environment' => 'production',
                'php_version' => '8.0',
                'php_extensions' => ['json', 'pdo', 'pdo_mysql', 'mbstring', 'opcache', 'redis'],
                'deploy_path' => '/var/www/prod',
                'webserver_user' => 'www-data',
                'maintenance_enabled' => true,
                'backup_enabled' => true,
                'description' => 'Production environment',
            ],
        ];
    }

    private function parseTarget(string $name, array $target): array
    {
        $parsed = [
            'name' => $name,
            'type' => $target['type'] ?? 'server',
            'environment' => $target['environment'] ?? $name,
            'php_version' => $target['php_version'] ?? '8.0',
            'php_extensions' => $target['php_extensions'] ?? [],
            'deploy_path' => $target['deploy_path'] ?? '/var/www/html',
            'webserver_user' => $target['webserver_user'] ?? 'www-data',
            'maintenance_enabled' => $target['maintenance_enabled'] ?? true,
            'backup_enabled' => $target['backup_enabled'] ?? true,
            'description' => $target['description'] ?? '',
        ];

        if (isset($target['servers']) && is_array($target['servers'])) {
            $parsed['servers'] = $target['servers'];
        }

        if (isset($target['variables']) && is_array($target['variables'])) {
            $parsed['variables'] = $target['variables'];
        }

        return $parsed;
    }

    public function getTargets(): array
    {
        return $this->targets;
    }

    public function getTargetNames(): array
    {
        return array_keys($this->targets);
    }

    public function hasTarget(string $name): bool
    {
        return isset($this->targets[$name]);
    }

    public function getTarget(string $name): ?array
    {
        return $this->targets[$name] ?? null;
    }

    public function getTargetsByEnvironment(string $environment): array
    {
        $result = [];
        foreach ($this->targets as $name => $target) {
            if (($target['environment'] ?? '') === $environment) {
                $result[$name] = $target;
            }
        }
        return $result;
    }

    public function getTargetPhpVersion(string $name): ?string
    {
        return $this->targets[$name]['php_version'] ?? null;
    }

    public function getTargetPhpExtensions(string $name): array
    {
        return $this->targets[$name]['php_extensions'] ?? [];
    }

    public function getTargetDeployPath(string $name): ?string
    {
        return $this->targets[$name]['deploy_path'] ?? null;
    }

    public function isMaintenanceEnabled(string $name): bool
    {
        return $this->targets[$name]['maintenance_enabled'] ?? true;
    }

    public function isBackupEnabled(string $name): bool
    {
        return $this->targets[$name]['backup_enabled'] ?? true;
    }
}
