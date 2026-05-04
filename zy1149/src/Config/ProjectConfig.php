<?php

declare(strict_types=1);

namespace DeployFlow\Config;

use DateTimeImmutable;

class ProjectConfig
{
    public string $projectRoot;
    public ?string $releaseYamlPath = null;
    public ?string $composerJsonPath = null;
    public ?string $composerLockPath = null;
    public ?string $envMatrixPath = null;
    public ?string $deployTargetsPath = null;
    public string $publicDir = 'public';
    public string $configDir = 'config';
    public string $migrationsDir = 'migrations';
    public string $vendorDir = 'vendor';
    public string $outputDir = 'output';
    public string $reportsDir = 'reports';
    public string $buildsDir = 'builds';
    public string $rollbackDir = 'rollback';

    public function __construct(string $projectRoot)
    {
        $this->projectRoot = rtrim($projectRoot, '/\\');
        $this->initPaths();
    }

    private function initPaths(): void
    {
        $this->releaseYamlPath = $this->projectRoot . '/release.yaml';
        $this->composerJsonPath = $this->projectRoot . '/composer.json';
        $this->composerLockPath = $this->projectRoot . '/composer.lock';
        $this->envMatrixPath = $this->projectRoot . '/env-matrix.csv';
        $this->deployTargetsPath = $this->projectRoot . '/deploy-targets.json';
        
        $this->outputDir = $this->projectRoot . '/output';
        $this->reportsDir = $this->outputDir . '/reports';
        $this->buildsDir = $this->outputDir . '/builds';
        $this->rollbackDir = $this->outputDir . '/rollback';
    }

    public function getPublicPath(): string
    {
        return $this->projectRoot . '/' . $this->publicDir;
    }

    public function getConfigPath(): string
    {
        return $this->projectRoot . '/' . $this->configDir;
    }

    public function getMigrationsPath(): string
    {
        return $this->projectRoot . '/' . $this->migrationsDir;
    }

    public function getVendorPath(): string
    {
        return $this->projectRoot . '/' . $this->vendorDir;
    }

    public function generateBuildVersion(): string
    {
        $now = new DateTimeImmutable();
        $hash = substr(md5($this->projectRoot . $now->format('YmdHisu')), 0, 8);
        return sprintf('v%s-%s', $now->format('Ymd.His'), $hash);
    }
}
