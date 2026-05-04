<?php

declare(strict_types=1);

namespace DeployFlow\Tests\Release;

use DeployFlow\Release\ReleasePlan;
use DeployFlow\Release\ReleaseStep;
use PHPUnit\Framework\TestCase;

class ReleasePlanTest extends TestCase
{
    public function testConstructorInitializesWithDefaults(): void
    {
        $plan = new ReleasePlan();

        $this->assertEquals('unknown', $plan->getVersion());
        $this->assertEquals(ReleasePlan::STATUS_READY, $plan->getStatus());
        $this->assertNull($plan->getTargetEnvironment());
        $this->assertEmpty($plan->getSteps());
        $this->assertEmpty($plan->getBlockers());
    }

    public function testSetAndGetVersion(): void
    {
        $plan = new ReleasePlan();
        $plan->setVersion('v1.0.0');

        $this->assertEquals('v1.0.0', $plan->getVersion());
    }

    public function testSetAndGetTargetEnvironment(): void
    {
        $plan = new ReleasePlan();
        $plan->setTargetEnvironment('production');

        $this->assertEquals('production', $plan->getTargetEnvironment());
    }

    public function testSetAndGetStatus(): void
    {
        $plan = new ReleasePlan();
        $plan->setStatus(ReleasePlan::STATUS_BLOCKED);

        $this->assertEquals(ReleasePlan::STATUS_BLOCKED, $plan->getStatus());
    }

    public function testSetAndGetCreatedAt(): void
    {
        $plan = new ReleasePlan();
        $now = date('c');
        $plan->setCreatedAt($now);

        $this->assertEquals($now, $plan->getCreatedAt());
    }

    public function testAddStep(): void
    {
        $plan = new ReleasePlan();
        $step = new ReleaseStep('test_step', 'Test Step');

        $plan->addStep($step);

        $this->assertCount(1, $plan->getSteps());
    }

    public function testGetStepReturnsStep(): void
    {
        $plan = new ReleasePlan();
        $step = new ReleaseStep('test_step', 'Test Step');
        $plan->addStep($step);

        $found = $plan->getStep('test_step');

        $this->assertNotNull($found);
        $this->assertEquals('test_step', $found->getId());
    }

    public function testGetStepReturnsNullForNonExistent(): void
    {
        $plan = new ReleasePlan();

        $this->assertNull($plan->getStep('nonexistent'));
    }

    public function testAddBlockerSetsStatusToBlocked(): void
    {
        $plan = new ReleasePlan();

        $this->assertEquals(ReleasePlan::STATUS_READY, $plan->getStatus());

        $plan->addBlocker('Test blocker message');

        $this->assertEquals(ReleasePlan::STATUS_BLOCKED, $plan->getStatus());
        $this->assertCount(1, $plan->getBlockers());
        $this->assertTrue($plan->hasBlockers());
    }

    public function testClearBlockers(): void
    {
        $plan = new ReleasePlan();
        $plan->addBlocker('Blocker 1');
        $plan->addBlocker('Blocker 2');

        $plan->clearBlockers();

        $this->assertEmpty($plan->getBlockers());
        $this->assertEquals(ReleasePlan::STATUS_READY, $plan->getStatus());
    }

    public function testHasBlockersWithBlockedSteps(): void
    {
        $plan = new ReleasePlan();
        $step = new ReleaseStep('test', 'Test');
        $step->setStatus(ReleaseStep::STATUS_BLOCKED);
        $plan->addStep($step);

        $this->assertTrue($plan->hasBlockers());
    }

    public function testIsReady(): void
    {
        $plan = new ReleasePlan();

        $this->assertTrue($plan->isReady());

        $plan->addBlocker('Blocker');
        $this->assertFalse($plan->isReady());
    }

    public function testIsBlocked(): void
    {
        $plan = new ReleasePlan();

        $this->assertFalse($plan->isBlocked());

        $plan->setStatus(ReleasePlan::STATUS_BLOCKED);
        $this->assertTrue($plan->isBlocked());
    }

    public function testGetProgress(): void
    {
        $plan = new ReleasePlan();

        $step1 = new ReleaseStep('s1', 'Step 1');
        $step1->setStatus(ReleaseStep::STATUS_COMPLETED);
        $plan->addStep($step1);

        $step2 = new ReleaseStep('s2', 'Step 2');
        $step2->setStatus(ReleaseStep::STATUS_READY);
        $plan->addStep($step2);

        $progress = $plan->getProgress();

        $this->assertEquals(2, $progress['total']);
        $this->assertEquals(1, $progress['completed']);
        $this->assertEquals(1, $progress['ready']);
        $this->assertEquals(50.0, $progress['percentage']);
    }

    public function testGetStepsInOrderResolvesDependencies(): void
    {
        $plan = new ReleasePlan();

        $step1 = new ReleaseStep('s1', 'Step 1');
        $step2 = new ReleaseStep('s2', 'Step 2');
        $step2->addDependency('s1');
        $step3 = new ReleaseStep('s3', 'Step 3');
        $step3->addDependency('s2');

        $plan->addStep($step3);
        $plan->addStep($step1);
        $plan->addStep($step2);

        $ordered = $plan->getStepsInOrder();

        $this->assertEquals('s1', $ordered[0]->getId());
        $this->assertEquals('s2', $ordered[1]->getId());
        $this->assertEquals('s3', $ordered[2]->getId());
    }

    public function testGetStepsByCategory(): void
    {
        $plan = new ReleasePlan();

        $step1 = new ReleaseStep('s1', 'Step 1');
        $step1->setCategory(ReleaseStep::CATEGORY_VALIDATION);
        $plan->addStep($step1);

        $step2 = new ReleaseStep('s2', 'Step 2');
        $step2->setCategory(ReleaseStep::CATEGORY_DEPLOY);
        $plan->addStep($step2);

        $validationSteps = $plan->getStepsByCategory(ReleaseStep::CATEGORY_VALIDATION);
        $this->assertCount(1, $validationSteps);

        $deploySteps = $plan->getStepsByCategory(ReleaseStep::CATEGORY_DEPLOY);
        $this->assertCount(1, $deploySteps);
    }

    public function testToArray(): void
    {
        $plan = new ReleasePlan();
        $plan->setVersion('v1.0.0');
        $plan->setTargetEnvironment('production');
        $plan->setStatus(ReleasePlan::STATUS_READY);

        $step = new ReleaseStep('test', 'Test Step');
        $plan->addStep($step);

        $array = $plan->toArray();

        $this->assertArrayHasKey('version', $array);
        $this->assertArrayHasKey('target_environment', $array);
        $this->assertArrayHasKey('status', $array);
        $this->assertArrayHasKey('steps', $array);
        $this->assertArrayHasKey('progress', $array);
        $this->assertEquals('v1.0.0', $array['version']);
    }
}
