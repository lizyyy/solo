<?php

declare(strict_types=1);

namespace DeployFlow\Tests\Exception;

use DeployFlow\Exception\DeployFlowException;
use PHPUnit\Framework\TestCase;

class DeployFlowExceptionTest extends TestCase
{
    public function testValidationErrorFactory(): void
    {
        $message = 'Validation failed';
        $details = ['field' => 'value'];

        $e = DeployFlowException::validationError($message, $details);

        $this->assertInstanceOf(DeployFlowException::class, $e);
        $this->assertEquals(DeployFlowException::CODE_VALIDATION_ERROR, $e->getCode());
        $this->assertEquals($message, $e->getMessage());
        $this->assertEquals($details, $e->getDetails());
    }

    public function testParsingErrorFactory(): void
    {
        $file = 'composer.json';
        $message = 'Invalid JSON';
        $line = 10;

        $e = DeployFlowException::parsingError($file, $message, $line);

        $this->assertEquals(DeployFlowException::CODE_PARSING_ERROR, $e->getCode());
        $this->assertStringContainsString($file, $e->getMessage());
        $this->assertStringContainsString($message, $e->getMessage());
        $this->assertEquals(['file' => $file, 'line' => $line], $e->getDetails());
    }

    public function testBuildErrorFactory(): void
    {
        $message = 'Build failed';
        $context = 'tar creation';

        $e = DeployFlowException::buildError($message, $context);

        $this->assertEquals(DeployFlowException::CODE_BUILD_ERROR, $e->getCode());
        $this->assertStringContainsString($message, $e->getMessage());
    }

    public function testReleaseErrorFactory(): void
    {
        $stepId = 'deploy_files';
        $message = 'Step failed';

        $e = DeployFlowException::releaseError($stepId, $message);

        $this->assertEquals(DeployFlowException::CODE_RELEASE_ERROR, $e->getCode());
        $this->assertStringContainsString($stepId, $e->getMessage());
        $this->assertStringContainsString($message, $e->getMessage());
    }

    public function testRollbackErrorFactory(): void
    {
        $message = 'Rollback failed';
        $version = 'v1.0.0';

        $e = DeployFlowException::rollbackError($message, $version);

        $this->assertEquals(DeployFlowException::CODE_ROLLBACK_ERROR, $e->getCode());
        $this->assertStringContainsString($message, $e->getMessage());
    }

    public function testReportErrorFactory(): void
    {
        $message = 'Report generation failed';

        $e = DeployFlowException::reportError($message);

        $this->assertEquals(DeployFlowException::CODE_REPORT_ERROR, $e->getCode());
        $this->assertEquals($message, $e->getMessage());
    }

    public function testConfigErrorFactory(): void
    {
        $message = 'Missing config file';
        $file = 'release.yaml';

        $e = DeployFlowException::configError($message, $file);

        $this->assertEquals(DeployFlowException::CODE_CONFIG_ERROR, $e->getCode());
        $this->assertStringContainsString($message, $e->getMessage());
    }

    public function testDependencyErrorFactory(): void
    {
        $missing = ['ext-pdo', 'ext-redis'];

        $e = DeployFlowException::dependencyError($missing);

        $this->assertEquals(DeployFlowException::CODE_DEPENDENCY_ERROR, $e->getCode());
        $this->assertStringContainsString('ext-pdo', $e->getMessage());
    }

    public function testIsDetailsSet(): void
    {
        $e = DeployFlowException::validationError('test', ['key' => 'value']);
        $this->assertTrue($e->hasDetails());
    }

    public function testGetDetailReturnsValue(): void
    {
        $e = DeployFlowException::validationError('test', ['key' => 'value']);
        $this->assertEquals('value', $e->getDetail('key'));
        $this->assertNull($e->getDetail('nonexistent'));
    }

    public function testGetDetailReturnsDefault(): void
    {
        $e = DeployFlowException::validationError('test', []);
        $this->assertEquals('default', $e->getDetail('key', 'default'));
    }
}
