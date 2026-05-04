<?php

declare(strict_types=1);

namespace DeployFlow\Tests\Validator;

use DeployFlow\Validator\ValidatorResult;
use PHPUnit\Framework\TestCase;

class ValidatorResultTest extends TestCase
{
    public function testConstructorInitializesEmpty(): void
    {
        $result = new ValidatorResult();

        $this->assertTrue($result->isPassed());
        $this->assertFalse($result->hasBlockers());
        $this->assertEmpty($result->getIssues());
    }

    public function testAddBlocker(): void
    {
        $result = new ValidatorResult();
        $result->addBlocker('test', 'Test blocker', ['extra' => 'data'], 'composer.json', 10);

        $this->assertFalse($result->isPassed());
        $this->assertTrue($result->hasBlockers());
        $this->assertCount(1, $result->getBlockers());
    }

    public function testAddError(): void
    {
        $result = new ValidatorResult();
        $result->addError('test', 'Test error', [], 'config.php', 5);

        $this->assertFalse($result->isPassed());
        $this->assertCount(1, $result->getErrors());
    }

    public function testAddWarning(): void
    {
        $result = new ValidatorResult();
        $result->addWarning('test', 'Test warning', [], 'config.php');

        $this->assertTrue($result->isPassed());
        $this->assertCount(1, $result->getWarnings());
    }

    public function testAddInfo(): void
    {
        $result = new ValidatorResult();
        $result->addInfo('test', 'Test info', [], 'config.php');

        $this->assertTrue($result->isPassed());
        $this->assertCount(1, $result->getInfos());
    }

    public function testGetCounts(): void
    {
        $result = new ValidatorResult();
        $result->addBlocker('test', 'Blocker 1');
        $result->addBlocker('test', 'Blocker 2');
        $result->addError('test', 'Error');
        $result->addWarning('test', 'Warning');
        $result->addInfo('test', 'Info');

        $counts = $result->getCounts();

        $this->assertEquals(2, $counts['blockers']);
        $this->assertEquals(1, $counts['errors']);
        $this->assertEquals(1, $counts['warnings']);
        $this->assertEquals(1, $counts['infos']);
        $this->assertEquals(5, $counts['total']);
    }

    public function testMerge(): void
    {
        $result1 = new ValidatorResult();
        $result1->addBlocker('test', 'Blocker 1');

        $result2 = new ValidatorResult();
        $result2->addError('test', 'Error 1');
        $result2->addWarning('test', 'Warning 1');

        $result1->merge($result2);

        $this->assertCount(1, $result1->getBlockers());
        $this->assertCount(1, $result1->getErrors());
        $this->assertCount(1, $result1->getWarnings());
        $this->assertFalse($result1->isPassed());
    }

    public function testToArray(): void
    {
        $result = new ValidatorResult();
        $result->addBlocker('test', 'Test blocker', [], 'composer.json', 10);

        $array = $result->toArray();

        $this->assertIsArray($array);
        $this->assertArrayHasKey('passed', $array);
        $this->assertArrayHasKey('has_blockers', $array);
        $this->assertArrayHasKey('counts', $array);
        $this->assertArrayHasKey('issues', $array);
        $this->assertFalse($array['passed']);
    }

    public function testGetBlockersReturnsOnlyBlockers(): void
    {
        $result = new ValidatorResult();
        $result->addBlocker('test', 'Blocker');
        $result->addError('test', 'Error');
        $result->addWarning('test', 'Warning');

        $blockers = $result->getBlockers();
        $this->assertCount(1, $blockers);
        $blocker = array_shift($blockers);
        $this->assertEquals(ValidatorResult::SEVERITY_BLOCKER, $blocker['severity']);
    }

    public function testPassedWithOnlyWarnings(): void
    {
        $result = new ValidatorResult();
        $result->addWarning('test', 'Warning 1');
        $result->addWarning('test', 'Warning 2');
        $result->addInfo('test', 'Info');

        $this->assertTrue($result->isPassed());
        $this->assertFalse($result->hasBlockers());
    }

    public function testGetByCategory(): void
    {
        $result = new ValidatorResult();
        $result->addError('composer', 'Composer error');
        $result->addWarning('env', 'Env warning');
        $result->addError('composer', 'Another composer error');

        $composerIssues = $result->getByCategory('composer');
        $this->assertCount(2, $composerIssues);

        $envIssues = $result->getByCategory('env');
        $this->assertCount(1, $envIssues);
    }

    public function testGetSummary(): void
    {
        $result = new ValidatorResult();
        $this->assertEquals('No issues found. Validation passed.', $result->getSummary());

        $result->addWarning('test', 'Warning');
        $this->assertStringContainsString('1 warning(s)', $result->getSummary());

        $result->addError('test', 'Error');
        $this->assertStringContainsString('1 error(s)', $result->getSummary());
    }
}
