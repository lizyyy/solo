<?php

declare(strict_types=1);

namespace DeployFlow\Tests\Config;

use DeployFlow\Config\ProjectConfig;
use PHPUnit\Framework\TestCase;

class ProjectConfigTest extends TestCase
{
    private string $testDir;

    protected function setUp(): void
    {
        $this->testDir = sys_get_temp_dir() . '/deployflow-test-' . uniqid();
        mkdir($this->testDir, 0755, true);
    }

    protected function tearDown(): void
    {
        $this->removeDirectory($this->testDir);
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            is_dir($path) ? $this->removeDirectory($path) : unlink($path);
        }
        rmdir($dir);
    }

    public function testConstructorSetsProjectRoot(): void
    {
        $config = new ProjectConfig($this->testDir);
        $this->assertEquals($this->testDir, $config->projectRoot);
    }

    public function testConstructorNormalizesPath(): void
    {
        $config = new ProjectConfig($this->testDir . '/');
        $this->assertEquals($this->testDir, $config->projectRoot);
    }

    public function testInitPathsSetsAllPaths(): void
    {
        $config = new ProjectConfig($this->testDir);

        $this->assertEquals($this->testDir . '/release.yaml', $config->releaseYamlPath);
        $this->assertEquals($this->testDir . '/composer.json', $config->composerJsonPath);
        $this->assertEquals($this->testDir . '/composer.lock', $config->composerLockPath);
        $this->assertEquals($this->testDir . '/env-matrix.csv', $config->envMatrixPath);
        $this->assertEquals($this->testDir . '/deploy-targets.json', $config->deployTargetsPath);
    }

    public function testGetPublicPath(): void
    {
        $config = new ProjectConfig($this->testDir);
        $this->assertEquals($this->testDir . '/public', $config->getPublicPath());
    }

    public function testGetConfigPath(): void
    {
        $config = new ProjectConfig($this->testDir);
        $this->assertEquals($this->testDir . '/config', $config->getConfigPath());
    }

    public function testGetMigrationsPath(): void
    {
        $config = new ProjectConfig($this->testDir);
        $this->assertEquals($this->testDir . '/migrations', $config->getMigrationsPath());
    }

    public function testGetVendorPath(): void
    {
        $config = new ProjectConfig($this->testDir);
        $this->assertEquals($this->testDir . '/vendor', $config->getVendorPath());
    }

    public function testGenerateBuildVersionReturnsUniqueVersions(): void
    {
        $config = new ProjectConfig($this->testDir);
        $version1 = $config->generateBuildVersion();
        usleep(10000);
        $version2 = $config->generateBuildVersion();

        $this->assertMatchesRegularExpression('/^v\d{8}\.\d{6}-[a-f0-9]{8}$/', $version1);
        $this->assertNotEquals($version1, $version2);
    }

    public function testOutputPathsAreInitialized(): void
    {
        $config = new ProjectConfig($this->testDir);

        $this->assertEquals($this->testDir . '/output', $config->outputDir);
        $this->assertEquals($this->testDir . '/output/reports', $config->reportsDir);
        $this->assertEquals($this->testDir . '/output/builds', $config->buildsDir);
        $this->assertEquals($this->testDir . '/output/rollback', $config->rollbackDir);
    }
}
