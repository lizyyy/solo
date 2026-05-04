<?php

declare(strict_types=1);

namespace DeployFlow\Tests\Rollback;

use DeployFlow\Rollback\RollbackPlan;
use PHPUnit\Framework\TestCase;

class RollbackPlanTest extends TestCase
{
    public function testConstructorSetsVersion(): void
    {
        $plan = new RollbackPlan('v1.0.0');

        $this->assertEquals('v1.0.0', $plan->getVersion());
    }

    public function testSetAndGetCreatedAt(): void
    {
        $plan = new RollbackPlan('v1.0.0');
        $now = date('c');
        $plan->setCreatedAt($now);

        $this->assertEquals($now, $plan->getCreatedAt());
    }

    public function testSetAndGetRollbackDir(): void
    {
        $plan = new RollbackPlan('v1.0.0');
        $dir = '/tmp/rollback-v1.0.0';
        $plan->setRollbackDir($dir);

        $this->assertEquals($dir, $plan->getRollbackDir());
    }

    public function testSetAndGetManifestPath(): void
    {
        $plan = new RollbackPlan('v1.0.0');
        $path = '/tmp/rollback-v1.0.0/rollback-manifest.json';
        $plan->setManifestPath($path);

        $this->assertEquals($path, $plan->getManifestPath());
    }

    public function testSetAndGetScriptPath(): void
    {
        $plan = new RollbackPlan('v1.0.0');
        $path = '/tmp/rollback-v1.0.0/rollback.sh';
        $plan->setScriptPath($path);

        $this->assertEquals($path, $plan->getScriptPath());
    }

    public function testAddWarning(): void
    {
        $plan = new RollbackPlan('v1.0.0');
        $plan->addWarning('Test warning message');

        $this->assertTrue($plan->hasWarnings());
        $this->assertCount(1, $plan->getWarnings());
    }

    public function testAddBlocker(): void
    {
        $plan = new RollbackPlan('v1.0.0');
        $plan->addBlocker('Test blocker message');

        $this->assertTrue($plan->hasBlockers());
        $this->assertCount(1, $plan->getBlockers());
    }

    public function testCanAutoRollbackReturnsTrueWhenNoBlockers(): void
    {
        $plan = new RollbackPlan('v1.0.0');

        $this->assertTrue($plan->canAutoRollback());
    }

    public function testCanAutoRollbackReturnsFalseWhenBlockers(): void
    {
        $plan = new RollbackPlan('v1.0.0');
        $plan->addBlocker('Irreversible migration');

        $this->assertFalse($plan->canAutoRollback());
    }

    public function testSetAndGetSteps(): void
    {
        $plan = new RollbackPlan('v1.0.0');
        $steps = [
            ['step' => 'backup', 'name' => 'Backup data', 'priority' => 'critical'],
            ['step' => 'rollback', 'name' => 'Rollback code', 'priority' => 'critical'],
        ];

        $plan->setSteps($steps);

        $this->assertEquals($steps, $plan->getSteps());
    }

    public function testAddAndGetIrreversibleMigration(): void
    {
        $plan = new RollbackPlan('v1.0.0');
        $migration = [
            'filename' => '001_DropTable.php',
            'version' => '001',
            'name' => 'DropTable',
            'is_irreversible' => true,
        ];

        $plan->addIrreversibleMigration($migration);

        $this->assertCount(1, $plan->getIrreversibleMigrations());
        $this->assertEquals('001_DropTable.php', $plan->getIrreversibleMigrations()[0]['filename']);
    }

    public function testAddAndGetNonRollbackableMigration(): void
    {
        $plan = new RollbackPlan('v1.0.0');
        $migration = [
            'filename' => '001_AddColumn.php',
            'version' => '001',
            'name' => 'AddColumn',
            'is_rollbackable' => false,
        ];

        $plan->addNonRollbackableMigration($migration);

        $this->assertCount(1, $plan->getNonRollbackableMigrations());
        $this->assertEquals('001_AddColumn.php', $plan->getNonRollbackableMigrations()[0]['filename']);
    }

    public function testToArray(): void
    {
        $plan = new RollbackPlan('v1.0.0');
        $plan->setCreatedAt(date('c'));
        $plan->addWarning('Test warning');
        $plan->addBlocker('Test blocker');
        $plan->setSteps([['step' => 'test', 'name' => 'Test']]);
        $plan->addIrreversibleMigration(['filename' => 'test.php']);
        $plan->addNonRollbackableMigration(['filename' => 'test2.php']);

        $array = $plan->toArray();

        $this->assertArrayHasKey('version', $array);
        $this->assertArrayHasKey('created_at', $array);
        $this->assertArrayHasKey('can_auto_rollback', $array);
        $this->assertArrayHasKey('warnings', $array);
        $this->assertArrayHasKey('blockers', $array);
        $this->assertArrayHasKey('steps', $array);
        $this->assertArrayHasKey('irreversible_migrations', $array);
        $this->assertArrayHasKey('non_rollbackable_migrations', $array);

        $this->assertEquals('v1.0.0', $array['version']);
        $this->assertFalse($array['can_auto_rollback']);
    }
}
