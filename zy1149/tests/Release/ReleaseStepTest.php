<?php

declare(strict_types=1);

namespace DeployFlow\Tests\Release;

use DeployFlow\Release\ReleaseStep;
use PHPUnit\Framework\TestCase;

class ReleaseStepTest extends TestCase
{
    public function testConstructorSetsIdAndName(): void
    {
        $step = new ReleaseStep('test_step', 'Test Step Name');

        $this->assertEquals('test_step', $step->getId());
        $this->assertEquals('Test Step Name', $step->getName());
    }

    public function testSetAndGetDescription(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $step->setDescription('This is a test step');

        $this->assertEquals('This is a test step', $step->getDescription());
    }

    public function testSetAndGetCategory(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $step->setCategory(ReleaseStep::CATEGORY_DEPLOY);

        $this->assertEquals(ReleaseStep::CATEGORY_DEPLOY, $step->getCategory());
    }

    public function testSetAndGetPriority(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $step->setPriority(ReleaseStep::PRIORITY_CRITICAL);

        $this->assertEquals(ReleaseStep::PRIORITY_CRITICAL, $step->getPriority());
    }

    public function testSetAndGetStatus(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $step->setStatus(ReleaseStep::STATUS_COMPLETED);

        $this->assertEquals(ReleaseStep::STATUS_COMPLETED, $step->getStatus());
    }

    public function testSetAndGetSummary(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $step->setSummary('Step completed successfully');

        $this->assertEquals('Step completed successfully', $step->getSummary());
    }

    public function testSetAndGetDetails(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $details = ['detail 1', 'detail 2', 'detail 3'];
        $step->setDetails($details);

        $this->assertEquals($details, $step->getDetails());
    }

    public function testAddDependency(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $step->addDependency('prev_step');

        $this->assertContains('prev_step', $step->getDependencies());
        $this->assertCount(1, $step->getDependencies());
    }

    public function testAddDuplicateDependencyDoesntAddTwice(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $step->addDependency('prev_step');
        $step->addDependency('prev_step');

        $this->assertCount(1, $step->getDependencies());
    }

    public function testRemoveDependency(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $step->addDependency('step1');
        $step->addDependency('step2');

        $step->removeDependency('step1');

        $this->assertNotContains('step1', $step->getDependencies());
        $this->assertContains('step2', $step->getDependencies());
        $this->assertCount(1, $step->getDependencies());
    }

    public function testSetAndGetRequiresConfirmation(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $this->assertFalse($step->isRequiresConfirmation());

        $step->setRequiresConfirmation(true);
        $this->assertTrue($step->isRequiresConfirmation());
    }

    public function testSetAndGetConfirmationMessage(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $message = 'Are you sure you want to proceed?';
        $step->setConfirmationMessage($message);

        $this->assertEquals($message, $step->getConfirmationMessage());
    }

    public function testSetAndGetBlockers(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $step->addBlocker('Missing dependency');

        $this->assertCount(1, $step->getBlockers());
        $this->assertTrue($step->isBlocked());
    }

    public function testClearBlockers(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $step->addBlocker('Blocker 1');
        $step->addBlocker('Blocker 2');

        $step->clearBlockers();

        $this->assertEmpty($step->getBlockers());
        $this->assertFalse($step->isBlocked());
    }

    public function testIsReady(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $step->setStatus(ReleaseStep::STATUS_READY);

        $this->assertTrue($step->isReady());
    }

    public function testIsCompleted(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $step->setStatus(ReleaseStep::STATUS_COMPLETED);

        $this->assertTrue($step->isCompleted());
    }

    public function testIsFailed(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $step->setStatus(ReleaseStep::STATUS_FAILED);

        $this->assertTrue($step->isFailed());
    }

    public function testIsSkipped(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $step->setStatus(ReleaseStep::STATUS_SKIPPED);

        $this->assertTrue($step->isSkipped());
    }

    public function testSetAndGetStartedAt(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $time = date('c');
        $step->setStartedAt($time);

        $this->assertEquals($time, $step->getStartedAt());
    }

    public function testSetAndGetCompletedAt(): void
    {
        $step = new ReleaseStep('test', 'Test');
        $time = date('c');
        $step->setCompletedAt($time);

        $this->assertEquals($time, $step->getCompletedAt());
    }

    public function testToArray(): void
    {
        $step = new ReleaseStep('test_step', 'Test Step');
        $step->setDescription('Test description');
        $step->setCategory(ReleaseStep::CATEGORY_DEPLOY);
        $step->setPriority(ReleaseStep::PRIORITY_HIGH);
        $step->setStatus(ReleaseStep::STATUS_READY);
        $step->addDependency('prev_step');
        $step->setRequiresConfirmation(true);

        $array = $step->toArray();

        $this->assertEquals('test_step', $array['id']);
        $this->assertEquals('Test Step', $array['name']);
        $this->assertEquals(ReleaseStep::CATEGORY_DEPLOY, $array['category']);
        $this->assertEquals(ReleaseStep::STATUS_READY, $array['status']);
        $this->assertContains('prev_step', $array['dependencies']);
        $this->assertTrue($array['requires_confirmation']);
    }
}
