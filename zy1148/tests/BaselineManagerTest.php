<?php

declare(strict_types=1);

namespace PhpSecurityScanner\Tests;

use PHPUnit\Framework\TestCase;
use PhpSecurityScanner\BaselineManager;
use PhpSecurityScanner\Finding;

class BaselineManagerTest extends TestCase
{
    private string $tempProjectPath;

    protected function setUp(): void
    {
        $this->tempProjectPath = sys_get_temp_dir() . '/test-baseline-project';
        if (!is_dir($this->tempProjectPath)) {
            mkdir($this->tempProjectPath, 0755, true);
        }
    }

    protected function tearDown(): void
    {
        $baselinePath = $this->tempProjectPath . '/.scansec-baseline.json';
        if (file_exists($baselinePath)) {
            unlink($baselinePath);
        }
        if (is_dir($this->tempProjectPath)) {
            rmdir($this->tempProjectPath);
        }
    }

    public function testConstruct(): void
    {
        $manager = new BaselineManager($this->tempProjectPath);

        $this->assertInstanceOf(BaselineManager::class, $manager);
    }

    public function testExistsReturnsFalseWhenNoBaseline(): void
    {
        $manager = new BaselineManager($this->tempProjectPath);

        $this->assertFalse($manager->exists());
    }

    public function testCreateBaseline(): void
    {
        $manager = new BaselineManager($this->tempProjectPath);

        $findings = [
            new Finding(
                'test_rule_1',
                Finding::SEVERITY_HIGH,
                '/path/to/file.php',
                10,
                'test evidence 1',
                Finding::CONFIDENCE_HIGH,
                'Test reason',
                'Test remediation',
                'code_security'
            ),
            new Finding(
                'test_rule_2',
                Finding::SEVERITY_MEDIUM,
                '/path/to/file2.php',
                20,
                'test evidence 2',
                Finding::CONFIDENCE_MEDIUM,
                'Test reason 2',
                'Test remediation 2',
                'template_security'
            ),
        ];

        $manager->create($findings);

        $this->assertTrue($manager->exists());
        $this->assertSame(2, $manager->getSuppressedCount());
    }

    public function testLoadBaseline(): void
    {
        $manager = new BaselineManager($this->tempProjectPath);

        $findings = [
            new Finding(
                'test_rule',
                Finding::SEVERITY_HIGH,
                '/path/to/file.php',
                10,
                'test evidence',
                Finding::CONFIDENCE_HIGH,
                'Test reason',
                'Test remediation',
                'code_security'
            ),
        ];

        $manager->create($findings);

        $baseline = $manager->load();

        $this->assertIsArray($baseline);
        $this->assertArrayHasKey('suppressed_findings', $baseline);
        $this->assertCount(1, $baseline['suppressed_findings']);
    }

    public function testApplyBaseline(): void
    {
        $manager = new BaselineManager($this->tempProjectPath);

        $baselineFinding = new Finding(
            'existing_rule',
            Finding::SEVERITY_HIGH,
            '/path/to/file.php',
            10,
            'existing evidence',
            Finding::CONFIDENCE_HIGH,
            'Test reason',
            'Test remediation',
            'code_security'
        );

        $manager->create([$baselineFinding]);

        $newFinding = new Finding(
            'new_rule',
            Finding::SEVERITY_CRITICAL,
            '/path/to/new.php',
            5,
            'new evidence',
            Finding::CONFIDENCE_HIGH,
            'New reason',
            'New remediation',
            'code_security'
        );

        $allFindings = [$baselineFinding, $newFinding];

        $result = $manager->apply($allFindings);

        $this->assertCount(1, $result['active']);
        $this->assertCount(1, $result['suppressed']);
        $this->assertSame('new_rule', $result['active'][0]->getRuleId());
        $this->assertSame('existing_rule', $result['suppressed'][0]->getRuleId());
    }

    public function testClearBaseline(): void
    {
        $manager = new BaselineManager($this->tempProjectPath);

        $findings = [
            new Finding(
                'test_rule',
                Finding::SEVERITY_HIGH,
                '/path/to/file.php',
                10,
                'test evidence',
                Finding::CONFIDENCE_HIGH,
                'Test reason',
                'Test remediation',
                'code_security'
            ),
        ];

        $manager->create($findings);
        $this->assertTrue($manager->exists());

        $path = $manager->getPath();
        $this->assertFileExists($path);

        if (file_exists($path)) {
            unlink($path);
        }

        $this->assertFalse($manager->exists());
    }

    public function testGetPath(): void
    {
        $manager = new BaselineManager($this->tempProjectPath);

        $expected = $this->tempProjectPath . '/.scansec-baseline.json';
        $this->assertSame($expected, $manager->getPath());
    }

    public function testGetSuppressedCountWhenNoBaseline(): void
    {
        $manager = new BaselineManager($this->tempProjectPath);

        $this->assertSame(0, $manager->getSuppressedCount());
    }

    public function testAddFinding(): void
    {
        $manager = new BaselineManager($this->tempProjectPath);

        $finding1 = new Finding(
            'test_rule_1',
            Finding::SEVERITY_HIGH,
            '/path/to/file.php',
            10,
            'test evidence 1',
            Finding::CONFIDENCE_HIGH,
            'Test reason',
            'Test remediation',
            'code_security'
        );

        $finding2 = new Finding(
            'test_rule_2',
            Finding::SEVERITY_MEDIUM,
            '/path/to/file2.php',
            20,
            'test evidence 2',
            Finding::CONFIDENCE_MEDIUM,
            'Test reason 2',
            'Test remediation 2',
            'template_security'
        );

        $manager->create([$finding1]);
        $this->assertSame(1, $manager->getSuppressedCount());

        $manager->addFinding($finding2, 'Manual suppression');
        $this->assertSame(2, $manager->getSuppressedCount());
    }

    public function testRemoveFinding(): void
    {
        $manager = new BaselineManager($this->tempProjectPath);

        $finding1 = new Finding(
            'test_rule_1',
            Finding::SEVERITY_HIGH,
            '/path/to/file.php',
            10,
            'test evidence 1',
            Finding::CONFIDENCE_HIGH,
            'Test reason',
            'Test remediation',
            'code_security'
        );

        $finding2 = new Finding(
            'test_rule_2',
            Finding::SEVERITY_MEDIUM,
            '/path/to/file2.php',
            20,
            'test evidence 2',
            Finding::CONFIDENCE_MEDIUM,
            'Test reason 2',
            'Test remediation 2',
            'template_security'
        );

        $manager->create([$finding1, $finding2]);
        $this->assertSame(2, $manager->getSuppressedCount());

        $manager->removeFinding($finding1);
        $this->assertSame(1, $manager->getSuppressedCount());

        $baseline = $manager->load();
        $this->assertSame('test_rule_2', $baseline['suppressed_findings'][0]['rule_id']);
    }
}
