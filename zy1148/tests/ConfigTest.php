<?php

declare(strict_types=1);

namespace PhpSecurityScanner\Tests;

use PHPUnit\Framework\TestCase;
use PhpSecurityScanner\Config;

class ConfigTest extends TestCase
{
    private string $tempConfigFile;

    protected function setUp(): void
    {
        $this->tempConfigFile = sys_get_temp_dir() . '/test-security-rules.yaml';
    }

    protected function tearDown(): void
    {
        if (file_exists($this->tempConfigFile)) {
            unlink($this->tempConfigFile);
        }
    }

    public function testDefaultConfig(): void
    {
        $config = new Config();

        $this->assertTrue($config->isRuleEnabled('dangerous_functions'));
        $this->assertTrue($config->isRuleEnabled('sql_injection'));
        $this->assertTrue($config->isRuleEnabled('xss_template'));
        $this->assertTrue($config->isRuleEnabled('weak_hash'));
        $this->assertTrue($config->isRuleEnabled('debug_exposure'));
        $this->assertTrue($config->isRuleEnabled('sensitive_config'));
        $this->assertTrue($config->isRuleEnabled('upload_security'));
    }

    public function testGetRule(): void
    {
        $config = new Config();

        $rule = $config->getRule('dangerous_functions');
        $this->assertIsArray($rule);
        $this->assertArrayHasKey('enabled', $rule);
        $this->assertArrayHasKey('severity', $rule);
        $this->assertArrayHasKey('functions', $rule);

        $this->assertNull($config->getRule('non_existent_rule'));
    }

    public function testGetAllRules(): void
    {
        $config = new Config();
        $rules = $config->getAllRules();

        $this->assertIsArray($rules);
        $this->assertGreaterThan(0, count($rules));
    }

    public function testGetDirectories(): void
    {
        $config = new Config();
        $dirs = $config->getDirectories();

        $this->assertIsArray($dirs);
        $this->assertContains('src/', $dirs);
        $this->assertContains('controllers/', $dirs);
        $this->assertContains('templates/', $dirs);
    }

    public function testGetExcludes(): void
    {
        $config = new Config();
        $excludes = $config->getExcludes();

        $this->assertIsArray($excludes);
        $this->assertContains('vendor/', $excludes);
        $this->assertContains('node_modules/', $excludes);
        $this->assertContains('.git/', $excludes);
    }

    public function testGetDefaultSecurityRules(): void
    {
        $config = new Config();
        $rules = $config->getDefaultSecurityRules();

        $this->assertIsString($rules);
        $this->assertStringContainsString('rules:', $rules);
        $this->assertStringContainsString('dangerous_functions:', $rules);
    }

    public function testLoadFromYamlFile(): void
    {
        $yamlContent = <<<YAML
rules:
  custom_rule:
    enabled: true
    severity: critical
directories:
  - app/
excludes:
  - tests/
YAML;

        file_put_contents($this->tempConfigFile, $yamlContent);

        $config = new Config($this->tempConfigFile);

        $this->assertTrue($config->isRuleEnabled('custom_rule'));
        $this->assertContains('app/', $config->getDirectories());
        $this->assertContains('tests/', $config->getExcludes());
    }

    public function testLoadFromJsonFile(): void
    {
        $jsonContent = json_encode([
            'rules' => [
                'json_rule' => [
                    'enabled' => true,
                    'severity' => 'high',
                ],
            ],
            'directories' => ['src/'],
        ]);

        $jsonFile = sys_get_temp_dir() . '/test-config.json';
        file_put_contents($jsonFile, $jsonContent);

        try {
            $config = new Config($jsonFile);
            $this->assertTrue($config->isRuleEnabled('json_rule'));
        } finally {
            if (file_exists($jsonFile)) {
                unlink($jsonFile);
            }
        }
    }

    public function testNonExistentConfigFileThrowsException(): void
    {
        $this->expectException(\RuntimeException::class);
        
        new Config('/non/existent/path/config.yaml');
    }
}
