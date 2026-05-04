<?php

declare(strict_types=1);

namespace PhpSecurityScanner\Tests;

use PHPUnit\Framework\TestCase;
use PhpSecurityScanner\Finding;

class FindingTest extends TestCase
{
    public function testConstructor(): void
    {
        $finding = new Finding(
            'test_rule',
            Finding::SEVERITY_HIGH,
            '/path/to/file.php',
            10,
            'test evidence',
            Finding::CONFIDENCE_HIGH,
            'Test reason',
            'Test remediation',
            'code_security',
            'test snippet'
        );

        $this->assertSame('test_rule', $finding->getRuleId());
        $this->assertSame(Finding::SEVERITY_HIGH, $finding->getSeverity());
        $this->assertSame('/path/to/file.php', $finding->getFilePath());
        $this->assertSame(10, $finding->getLineNumber());
        $this->assertSame('test evidence', $finding->getEvidence());
        $this->assertSame(Finding::CONFIDENCE_HIGH, $finding->getConfidence());
        $this->assertSame('Test reason', $finding->getReason());
        $this->assertSame('Test remediation', $finding->getRemediation());
        $this->assertSame('code_security', $finding->getCategory());
        $this->assertSame('test snippet', $finding->getSnippet());
    }

    public function testToArray(): void
    {
        $finding = new Finding(
            'test_rule',
            Finding::SEVERITY_CRITICAL,
            '/path/to/file.php',
            10,
            'test evidence',
            Finding::CONFIDENCE_HIGH,
            'Test reason',
            'Test remediation',
            'code_security'
        );

        $array = $finding->toArray();

        $this->assertIsArray($array);
        $this->assertSame('test_rule', $array['rule_id']);
        $this->assertSame(Finding::SEVERITY_CRITICAL, $array['severity']);
        $this->assertSame('/path/to/file.php', $array['file_path']);
        $this->assertSame(10, $array['line_number']);
    }

    public function testFromArray(): void
    {
        $data = [
            'rule_id' => 'test_rule',
            'severity' => Finding::SEVERITY_MEDIUM,
            'file_path' => '/path/to/file.php',
            'line_number' => 10,
            'evidence' => 'test evidence',
            'confidence' => Finding::CONFIDENCE_MEDIUM,
            'reason' => 'Test reason',
            'remediation' => 'Test remediation',
            'category' => 'code_security',
            'snippet' => 'test snippet',
        ];

        $finding = Finding::fromArray($data);

        $this->assertSame('test_rule', $finding->getRuleId());
        $this->assertSame(Finding::SEVERITY_MEDIUM, $finding->getSeverity());
        $this->assertSame('test snippet', $finding->getSnippet());
    }

    public function testGetFingerprint(): void
    {
        $finding1 = new Finding(
            'test_rule',
            Finding::SEVERITY_HIGH,
            '/path/to/file.php',
            10,
            'test evidence',
            Finding::CONFIDENCE_HIGH,
            'Test reason',
            'Test remediation',
            'code_security'
        );

        $finding2 = new Finding(
            'test_rule',
            Finding::SEVERITY_HIGH,
            '/path/to/file.php',
            10,
            'test evidence',
            Finding::CONFIDENCE_MEDIUM,
            'Different reason',
            'Different remediation',
            'code_security'
        );

        $finding3 = new Finding(
            'different_rule',
            Finding::SEVERITY_HIGH,
            '/path/to/file.php',
            10,
            'test evidence',
            Finding::CONFIDENCE_HIGH,
            'Test reason',
            'Test remediation',
            'code_security'
        );

        $this->assertSame($finding1->getFingerprint(), $finding2->getFingerprint());
        $this->assertNotSame($finding1->getFingerprint(), $finding3->getFingerprint());
    }

    public function testSeverityToNumeric(): void
    {
        $this->assertSame(5, Finding::severityToNumeric(Finding::SEVERITY_CRITICAL));
        $this->assertSame(4, Finding::severityToNumeric(Finding::SEVERITY_HIGH));
        $this->assertSame(3, Finding::severityToNumeric(Finding::SEVERITY_MEDIUM));
        $this->assertSame(2, Finding::severityToNumeric(Finding::SEVERITY_LOW));
        $this->assertSame(1, Finding::severityToNumeric(Finding::SEVERITY_INFO));
        $this->assertSame(0, Finding::severityToNumeric('unknown'));
    }

    public function testIsValidSeverity(): void
    {
        $this->assertTrue(Finding::isValidSeverity(Finding::SEVERITY_CRITICAL));
        $this->assertTrue(Finding::isValidSeverity(Finding::SEVERITY_HIGH));
        $this->assertTrue(Finding::isValidSeverity(Finding::SEVERITY_MEDIUM));
        $this->assertTrue(Finding::isValidSeverity(Finding::SEVERITY_LOW));
        $this->assertTrue(Finding::isValidSeverity(Finding::SEVERITY_INFO));
        $this->assertFalse(Finding::isValidSeverity('unknown'));
    }
}
