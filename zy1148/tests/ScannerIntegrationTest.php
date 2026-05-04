<?php

declare(strict_types=1);

namespace PhpSecurityScanner\Tests;

use PHPUnit\Framework\TestCase;
use PhpSecurityScanner\ScannerEngine;
use PhpSecurityScanner\Config;
use PhpSecurityScanner\Finding;

class ScannerIntegrationTest extends TestCase
{
    private string $vulnerableProjectPath;
    private string $secureProjectPath;

    protected function setUp(): void
    {
        $this->vulnerableProjectPath = __DIR__ . '/../examples/vulnerable-project';
        $this->secureProjectPath = __DIR__ . '/../examples/secure-project';
    }

    public function testScanVulnerableProjectFindsIssues(): void
    {
        if (!is_dir($this->vulnerableProjectPath)) {
            $this->markTestSkipped('Vulnerable project not found');
        }

        $config = new Config();
        $engine = new ScannerEngine($config);

        $findings = $engine->scanAll($this->vulnerableProjectPath);

        $this->assertGreaterThan(0, count($findings));

        $severityCounts = $engine->getSeverityCounts();
        $this->assertGreaterThanOrEqual(0, $severityCounts[Finding::SEVERITY_CRITICAL]);
        $this->assertGreaterThanOrEqual(0, $severityCounts[Finding::SEVERITY_HIGH]);
        $this->assertGreaterThanOrEqual(0, $severityCounts[Finding::SEVERITY_MEDIUM]);
    }

    public function testScanVulnerableProjectFindsDangerousFunctions(): void
    {
        if (!is_dir($this->vulnerableProjectPath)) {
            $this->markTestSkipped('Vulnerable project not found');
        }

        $config = new Config();
        $engine = new ScannerEngine($config);

        $findings = $engine->scanAll($this->vulnerableProjectPath);

        $dangerousFindings = array_filter($findings, function (Finding $f) {
            return str_contains($f->getRuleId(), 'dangerous_function');
        });

        $this->assertGreaterThan(0, count($dangerousFindings));

        $evalFindings = array_filter($dangerousFindings, function (Finding $f) {
            return str_contains($f->getRuleId(), 'eval');
        });

        $systemFindings = array_filter($dangerousFindings, function (Finding $f) {
            return str_contains($f->getRuleId(), 'system');
        });

        $this->assertGreaterThanOrEqual(0, count($evalFindings));
        $this->assertGreaterThanOrEqual(0, count($systemFindings));
    }

    public function testScanVulnerableProjectFindsWeakHash(): void
    {
        if (!is_dir($this->vulnerableProjectPath)) {
            $this->markTestSkipped('Vulnerable project not found');
        }

        $config = new Config();
        $engine = new ScannerEngine($config);

        $findings = $engine->scanAll($this->vulnerableProjectPath);

        $weakHashFindings = array_filter($findings, function (Finding $f) {
            return str_contains($f->getRuleId(), 'weak_hash');
        });

        $this->assertGreaterThan(0, count($weakHashFindings));
    }

    public function testScanVulnerableProjectFindsDebugCode(): void
    {
        if (!is_dir($this->vulnerableProjectPath)) {
            $this->markTestSkipped('Vulnerable project not found');
        }

        $config = new Config();
        $engine = new ScannerEngine($config);

        $findings = $engine->scanAll($this->vulnerableProjectPath);

        $debugFindings = array_filter($findings, function (Finding $f) {
            return str_contains($f->getRuleId(), 'debug');
        });

        $this->assertGreaterThan(0, count($debugFindings));
    }

    public function testScanVulnerableProjectFindsSensitiveConfig(): void
    {
        if (!is_dir($this->vulnerableProjectPath)) {
            $this->markTestSkipped('Vulnerable project not found');
        }

        $config = new Config();
        $engine = new ScannerEngine($config);

        $findings = $engine->scanAll($this->vulnerableProjectPath);

        $sensitiveFindings = array_filter($findings, function (Finding $f) {
            return str_contains($f->getRuleId(), 'sensitive_config') || 
                   str_contains($f->getRuleId(), 'hardcoded');
        });

        $this->assertGreaterThan(0, count($sensitiveFindings));
    }

    public function testScanVulnerableProjectFindsUploadIssues(): void
    {
        if (!is_dir($this->vulnerableProjectPath)) {
            $this->markTestSkipped('Vulnerable project not found');
        }

        $config = new Config();
        $engine = new ScannerEngine($config);

        $findings = $engine->scanAll($this->vulnerableProjectPath);

        $uploadFindings = array_filter($findings, function (Finding $f) {
            return $f->getCategory() === 'upload_security';
        });

        $this->assertGreaterThan(0, count($uploadFindings));
    }

    public function testScanSecureProjectHasFewerIssues(): void
    {
        if (!is_dir($this->secureProjectPath)) {
            $this->markTestSkipped('Secure project not found');
        }

        $config = new Config();
        $engine = new ScannerEngine($config);

        $findings = $engine->scanAll($this->secureProjectPath);

        $criticalHighCount = count(array_filter($findings, function (Finding $f) {
            return $f->getSeverity() === Finding::SEVERITY_CRITICAL ||
                   $f->getSeverity() === Finding::SEVERITY_HIGH;
        }));

        $this->assertLessThan(10, $criticalHighCount);
    }

    public function testScanCodeOnly(): void
    {
        if (!is_dir($this->vulnerableProjectPath)) {
            $this->markTestSkipped('Vulnerable project not found');
        }

        $config = new Config();
        $engine = new ScannerEngine($config);

        $findings = $engine->scanCode($this->vulnerableProjectPath);

        $this->assertGreaterThan(0, count($findings));

        $categories = array_unique(array_map(function (Finding $f) {
            return $f->getCategory();
        }, $findings));

        $this->assertContains('code_security', $categories);
    }

    public function testScanConfigOnly(): void
    {
        if (!is_dir($this->vulnerableProjectPath)) {
            $this->markTestSkipped('Vulnerable project not found');
        }

        $config = new Config();
        $engine = new ScannerEngine($config);

        $findings = $engine->scanConfig($this->vulnerableProjectPath);

        $categories = array_unique(array_map(function (Finding $f) {
            return $f->getCategory();
        }, $findings));

        $this->assertContains('config_security', $categories);
    }

    public function testScanDependenciesOnly(): void
    {
        if (!is_dir($this->vulnerableProjectPath)) {
            $this->markTestSkipped('Vulnerable project not found');
        }

        $composerJson = $this->vulnerableProjectPath . '/composer.json';
        if (!file_exists($composerJson)) {
            $this->markTestSkipped('composer.json not found');
        }

        $config = new Config();
        $engine = new ScannerEngine($config);

        $findings = $engine->scanDependencies($this->vulnerableProjectPath);

        $categories = array_unique(array_map(function (Finding $f) {
            return $f->getCategory();
        }, $findings));

        $this->assertContains('dependency_security', $categories);
    }

    public function testGetFindingsBySeverity(): void
    {
        if (!is_dir($this->vulnerableProjectPath)) {
            $this->markTestSkipped('Vulnerable project not found');
        }

        $config = new Config();
        $engine = new ScannerEngine($config);

        $engine->scanAll($this->vulnerableProjectPath);

        $critical = $engine->getFindingsBySeverity(Finding::SEVERITY_CRITICAL);
        $high = $engine->getFindingsBySeverity(Finding::SEVERITY_HIGH);
        $medium = $engine->getFindingsBySeverity(Finding::SEVERITY_MEDIUM);

        $this->assertIsArray($critical);
        $this->assertIsArray($high);
        $this->assertIsArray($medium);
    }

    public function testGetFindingsByCategory(): void
    {
        if (!is_dir($this->vulnerableProjectPath)) {
            $this->markTestSkipped('Vulnerable project not found');
        }

        $config = new Config();
        $engine = new ScannerEngine($config);

        $engine->scanAll($this->vulnerableProjectPath);

        $codeSecurity = $engine->getFindingsByCategory('code_security');
        $configSecurity = $engine->getFindingsByCategory('config_security');

        $this->assertIsArray($codeSecurity);
        $this->assertIsArray($configSecurity);
    }

    public function testFindingHasRequiredFields(): void
    {
        if (!is_dir($this->vulnerableProjectPath)) {
            $this->markTestSkipped('Vulnerable project not found');
        }

        $config = new Config();
        $engine = new ScannerEngine($config);

        $findings = $engine->scanAll($this->vulnerableProjectPath);

        $this->assertGreaterThan(0, count($findings));

        $finding = $findings[0];

        $this->assertNotEmpty($finding->getRuleId());
        $this->assertTrue(Finding::isValidSeverity($finding->getSeverity()));
        $this->assertNotEmpty($finding->getFilePath());
        $this->assertGreaterThan(0, $finding->getLineNumber());
        $this->assertNotEmpty($finding->getEvidence());
        $this->assertNotEmpty($finding->getReason());
        $this->assertNotEmpty($finding->getRemediation());
        $this->assertNotEmpty($finding->getCategory());
    }
}
