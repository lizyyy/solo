<?php

declare(strict_types=1);

namespace PhpSecurityScanner\Tests;

use PHPUnit\Framework\TestCase;
use PhpSecurityScanner\ReportGenerator;
use PhpSecurityScanner\Finding;

class ReportGeneratorTest extends TestCase
{
    private string $tempOutputDir;

    protected function setUp(): void
    {
        $this->tempOutputDir = sys_get_temp_dir() . '/test-report-output';
        if (!is_dir($this->tempOutputDir)) {
            mkdir($this->tempOutputDir, 0755, true);
        }
    }

    protected function tearDown(): void
    {
        $files = glob($this->tempOutputDir . '/*');
        foreach ($files as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }
        if (is_dir($this->tempOutputDir)) {
            rmdir($this->tempOutputDir);
        }
    }

    public function testConstruct(): void
    {
        $generator = new ReportGenerator('/path/to/project', 'Test Project');

        $this->assertInstanceOf(ReportGenerator::class, $generator);
    }

    public function testGenerateJsonWithFindings(): void
    {
        $generator = new ReportGenerator('/path/to/project', 'Test Project');

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

        $json = $generator->generateJson($findings, ['test' => 'meta']);

        $this->assertJson($json);

        $data = json_decode($json, true);

        $this->assertIsArray($data);
        $this->assertArrayHasKey('schema_version', $data);
        $this->assertArrayHasKey('generated_at', $data);
        $this->assertArrayHasKey('project', $data);
        $this->assertArrayHasKey('summary', $data);
        $this->assertArrayHasKey('findings', $data);
        $this->assertArrayHasKey('meta', $data);

        $this->assertCount(1, $data['findings']);
        $this->assertSame('test_rule', $data['findings'][0]['rule_id']);
    }

    public function testGenerateJsonWithEmptyFindings(): void
    {
        $generator = new ReportGenerator('/path/to/project', 'Test Project');

        $json = $generator->generateJson([]);

        $this->assertJson($json);

        $data = json_decode($json, true);
        $this->assertCount(0, $data['findings']);
        $this->assertSame(0, $data['summary']['total']);
    }

    public function testGenerateMarkdown(): void
    {
        $generator = new ReportGenerator('/path/to/project', 'Test Project');

        $findings = [
            new Finding(
                'test_rule',
                Finding::SEVERITY_CRITICAL,
                '/path/to/file.php',
                10,
                'test evidence',
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

        $markdown = $generator->generateMarkdown($findings);

        $this->assertIsString($markdown);
        $this->assertStringContainsString('# 安全扫描报告', $markdown);
        $this->assertStringContainsString('Test Project', $markdown);
        $this->assertStringContainsString('Critical', $markdown);
        $this->assertStringContainsString('Medium', $markdown);
        $this->assertStringContainsString('test_rule', $markdown);
        $this->assertStringContainsString('test_rule_2', $markdown);
    }

    public function testGenerateMarkdownWithEmptyFindings(): void
    {
        $generator = new ReportGenerator('/path/to/project', 'Test Project');

        $markdown = $generator->generateMarkdown([]);

        $this->assertIsString($markdown);
        $this->assertStringContainsString('# 安全扫描报告', $markdown);
        $this->assertStringContainsString('未发现安全问题', $markdown);
    }

    public function testGenerateSarif(): void
    {
        $generator = new ReportGenerator('/path/to/project', 'Test Project');

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

        $sarif = $generator->generateSarif($findings);

        $this->assertJson($sarif);

        $data = json_decode($sarif, true);

        $this->assertIsArray($data);
        $this->assertSame('2.1.0', $data['version']);
        $this->assertArrayHasKey('$schema', $data);
        $this->assertArrayHasKey('runs', $data);
        $this->assertCount(1, $data['runs']);

        $run = $data['runs'][0];
        $this->assertArrayHasKey('tool', $run);
        $this->assertArrayHasKey('results', $run);
        $this->assertArrayHasKey('artifacts', $run);
    }

    public function testWriteReportJson(): void
    {
        $generator = new ReportGenerator('/path/to/project', 'Test Project');

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

        $outputPath = $this->tempOutputDir . '/report.json';

        $generator->writeReport('json', $outputPath, $findings);

        $this->assertFileExists($outputPath);

        $content = file_get_contents($outputPath);
        $this->assertJson($content);
    }

    public function testWriteReportMarkdown(): void
    {
        $generator = new ReportGenerator('/path/to/project', 'Test Project');

        $outputPath = $this->tempOutputDir . '/report.md';

        $generator->writeReport('markdown', $outputPath, []);

        $this->assertFileExists($outputPath);

        $content = file_get_contents($outputPath);
        $this->assertStringContainsString('# 安全扫描报告', $content);
    }

    public function testWriteReportSarif(): void
    {
        $generator = new ReportGenerator('/path/to/project', 'Test Project');

        $outputPath = $this->tempOutputDir . '/report.sarif.json';

        $generator->writeReport('sarif', $outputPath, []);

        $this->assertFileExists($outputPath);

        $content = file_get_contents($outputPath);
        $data = json_decode($content, true);
        $this->assertSame('2.1.0', $data['version']);
    }

    public function testWriteReportWithInvalidTypeThrowsException(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $generator = new ReportGenerator('/path/to/project', 'Test Project');
        $generator->writeReport('invalid', '/tmp/report.txt', []);
    }

    public function testGenerateJsonIncludesSuppressedCountInMeta(): void
    {
        $generator = new ReportGenerator('/path/to/project', 'Test Project');

        $json = $generator->generateJson([], ['suppressed_count' => 5]);

        $data = json_decode($json, true);
        $this->assertSame(5, $data['meta']['suppressed_count']);
    }
}
