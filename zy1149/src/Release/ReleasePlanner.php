<?php

declare(strict_types=1);

namespace DeployFlow\Release;

use DeployFlow\Config\ProjectConfig;
use DeployFlow\Parser\ReleaseConfigParser;
use DeployFlow\Parser\MigrationParser;
use DeployFlow\Parser\DeployTargetsParser;
use DeployFlow\Validator\ValidatorResult;
use DeployFlow\Builder\BuildResult;
use DeployFlow\Exception\DeployFlowException;
use Symfony\Component\Filesystem\Filesystem;

class ReleasePlanner
{
    private ProjectConfig $config;
    private ReleaseConfigParser $releaseConfig;
    private MigrationParser $migrationParser;
    private DeployTargetsParser $deployTargets;
    private Filesystem $filesystem;
    private ?string $targetEnvironment = null;
    private ?BuildResult $buildResult = null;
    private ?ValidatorResult $validationResult = null;

    public function __construct(
        ProjectConfig $config,
        ReleaseConfigParser $releaseConfig,
        MigrationParser $migrationParser,
        DeployTargetsParser $deployTargets
    ) {
        $this->config = $config;
        $this->releaseConfig = $releaseConfig;
        $this->migrationParser = $migrationParser;
        $this->deployTargets = $deployTargets;
        $this->filesystem = new Filesystem();
    }

    public function setTargetEnvironment(?string $environment): void
    {
        $this->targetEnvironment = $environment;
    }

    public function setBuildResult(?BuildResult $buildResult): void
    {
        $this->buildResult = $buildResult;
    }

    public function setValidationResult(?ValidatorResult $validationResult): void
    {
        $this->validationResult = $validationResult;
    }

    public function plan(): ReleasePlan
    {
        $targetEnv = $this->targetEnvironment ?? $this->releaseConfig->getDefaultTarget();

        $plan = new ReleasePlan();
        $plan->setVersion($this->buildResult ? $this->buildResult->getVersion() : 'planned');
        $plan->setTargetEnvironment($targetEnv);
        $plan->setCreatedAt(date('c'));

        if ($this->validationResult) {
            $this->addValidationSteps($plan);
        }

        $this->addPreDeploySteps($plan, $targetEnv);
        $this->addMigrationSteps($plan);
        $this->addDeploySteps($plan, $targetEnv);
        $this->addPostDeploySteps($plan, $targetEnv);
        $this->addRollbackSteps($plan);

        if ($this->validationResult && !$this->validationResult->isPassed()) {
            $plan->setStatus(ReleasePlan::STATUS_BLOCKED);
            $plan->addBlocker('Validation failed - see validation steps for details');
        }

        $this->checkDependencies($plan);
        $this->generateAuditLog($plan);

        return $plan;
    }

    private function addValidationSteps(ReleasePlan $plan): void
    {
        $result = $this->validationResult;

        $step = new ReleaseStep('validation', 'Validate release readiness');
        $step->setDescription('Run all validation checks before proceeding with release');
        $step->setCategory(ReleaseStep::CATEGORY_VALIDATION);
        $step->setPriority(ReleaseStep::PRIORITY_CRITICAL);

        if ($result->isPassed()) {
            $step->setStatus(ReleaseStep::STATUS_READY);
            $step->setSummary('All validations passed');
        } else {
            $step->setStatus(ReleaseStep::STATUS_BLOCKED);
            
            $blockers = $result->getBlockers();
            $errors = $result->getErrors();
            $warnings = $result->getWarnings();

            $issues = [];
            foreach ($blockers as $b) {
                $issues[] = "[BLOCKER] {$b['message']}" . ($b['file'] ? " ({$b['file']}:{$b['line']})" : '');
            }
            foreach ($errors as $e) {
                $issues[] = "[ERROR] {$e['message']}" . ($e['file'] ? " ({$e['file']}:{$e['line']})" : '');
            }
            foreach ($warnings as $w) {
                $issues[] = "[WARNING] {$w['message']}" . ($w['file'] ? " ({$w['file']}:{$w['line']})" : '');
            }

            $step->setDetails($issues);
            $step->setSummary(sprintf(
                'Validation: %d blocker(s), %d error(s), %d warning(s)',
                count($blockers),
                count($errors),
                count($warnings)
            ));
            $step->setRequiresConfirmation(true);
        }

        $plan->addStep($step);
    }

    private function addPreDeploySteps(ReleasePlan $plan, string $targetEnv): void
    {
        $target = $this->deployTargets->getTarget($targetEnv);

        $backupStep = new ReleaseStep('pre_backup', 'Backup current deployment');
        $backupStep->setDescription('Create backup of current deployed files before deployment');
        $backupStep->setCategory(ReleaseStep::CATEGORY_PRE_DEPLOY);
        $backupStep->setPriority(ReleaseStep::PRIORITY_HIGH);

        if ($this->releaseConfig->shouldBackupBeforeDeploy() && 
            ($target['backup_enabled'] ?? true)) {
            $backupStep->setStatus(ReleaseStep::STATUS_READY);
            $backupStep->setSummary('Backup will be created before deployment');
            $backupStep->addDependency('validation');
        } else {
            $backupStep->setStatus(ReleaseStep::STATUS_SKIPPED);
            $backupStep->setSummary('Backup disabled in configuration');
        }
        $plan->addStep($backupStep);

        $maintenanceStep = new ReleaseStep('enable_maintenance', 'Enable maintenance mode');
        $maintenanceStep->setDescription('Put the application into maintenance mode');
        $maintenanceStep->setCategory(ReleaseStep::CATEGORY_PRE_DEPLOY);
        $maintenanceStep->setPriority(ReleaseStep::PRIORITY_HIGH);

        if ($this->releaseConfig->get('deploy.maintenance_mode', true) &&
            ($target['maintenance_enabled'] ?? true)) {
            $maintenanceStep->setStatus(ReleaseStep::STATUS_READY);
            $maintenanceStep->setSummary('Maintenance mode will be enabled');
            $maintenanceStep->addDependency('pre_backup');
        } else {
            $maintenanceStep->setStatus(ReleaseStep::STATUS_SKIPPED);
            $maintenanceStep->setSummary('Maintenance mode disabled');
        }
        $plan->addStep($maintenanceStep);
    }

    private function addMigrationSteps(ReleasePlan $plan): void
    {
        $migrations = $this->migrationParser->getMigrations();

        if (empty($migrations)) {
            $step = new ReleaseStep('migrations', 'Run database migrations');
            $step->setDescription('No migrations to run');
            $step->setCategory(ReleaseStep::CATEGORY_MIGRATION);
            $step->setStatus(ReleaseStep::STATUS_SKIPPED);
            $step->setSummary('No migration files found');
            $step->addDependency('enable_maintenance');
            $plan->addStep($step);
            return;
        }

        $irreversible = $this->migrationParser->getIrreversibleMigrations();
        $nonRollbackable = $this->migrationParser->getNonRollbackableMigrations();

        $batchStep = new ReleaseStep('migrations_batch', 'Run database migrations');
        $batchStep->setDescription(sprintf(
            'Execute %d migration(s) in sequence',
            count($migrations)
        ));
        $batchStep->setCategory(ReleaseStep::CATEGORY_MIGRATION);
        $batchStep->setPriority(ReleaseStep::PRIORITY_CRITICAL);
        $batchStep->setStatus(ReleaseStep::STATUS_READY);
        $batchStep->addDependency('enable_maintenance');

        $details = [];
        foreach ($migrations as $m) {
            $status = 'OK';
            if ($m['is_irreversible'] ?? false) {
                $status = 'IRREVERSIBLE';
            } elseif (!($m['is_rollbackable'] ?? true)) {
                $status = 'NON-ROLLBACKABLE';
            }

            $details[] = sprintf(
                '[%s] %s: %s%s',
                $status,
                $m['version'],
                $m['name'],
                $m['description'] ? " ({$m['description']})" : ''
            );
        }
        $batchStep->setDetails($details);

        $summaryParts = [
            count($migrations) . ' migration(s)',
        ];

        if (!empty($irreversible)) {
            $summaryParts[] = count($irreversible) . ' irreversible';
            $batchStep->setRequiresConfirmation(true);
            $batchStep->setConfirmationMessage(
                sprintf(
                    'WARNING: %d irreversible migration(s) will be executed. This action cannot be undone. Continue?',
                    count($irreversible)
                )
            );
        }

        if (!empty($nonRollbackable)) {
            $summaryParts[] = count($nonRollbackable) . ' non-rollbackable';
        }

        $batchStep->setSummary(implode(', ', $summaryParts));
        $plan->addStep($batchStep);
    }

    private function addDeploySteps(ReleasePlan $plan, string $targetEnv): void
    {
        $deployStep = new ReleaseStep('deploy_files', 'Deploy application files');
        $deployStep->setDescription('Deploy built package to target environment');
        $deployStep->setCategory(ReleaseStep::CATEGORY_DEPLOY);
        $deployStep->setPriority(ReleaseStep::PRIORITY_CRITICAL);
        $deployStep->setStatus(ReleaseStep::STATUS_READY);
        $deployStep->addDependency('migrations_batch');

        $details = [];
        $target = $this->deployTargets->getTarget($targetEnv);

        if ($target) {
            $details[] = "Target environment: {$targetEnv}";
            $details[] = "Deploy path: " . ($target['deploy_path'] ?? 'N/A');
            $details[] = "PHP version required: " . ($target['php_version'] ?? 'N/A');
        }

        if ($this->buildResult) {
            $details[] = "Build version: " . $this->buildResult->getVersion();
            $details[] = "Files to deploy: " . $this->buildResult->getFileCount();

            if ($this->buildResult->getTarPath()) {
                $details[] = "Package: " . basename($this->buildResult->getTarPath());
            }
            if ($this->buildResult->getZipPath()) {
                $details[] = "Package: " . basename($this->buildResult->getZipPath());
            }
        }

        $deployStep->setDetails($details);
        $deployStep->setSummary(
            $this->buildResult 
                ? "Deploy version " . $this->buildResult->getVersion() . " to {$targetEnv}"
                : "Deploy to {$targetEnv}"
        );
        $plan->addStep($deployStep);
    }

    private function addPostDeploySteps(ReleasePlan $plan, string $targetEnv): void
    {
        $clearCacheStep = new ReleaseStep('clear_cache', 'Clear application cache');
        $clearCacheStep->setDescription('Clear all application caches after deployment');
        $clearCacheStep->setCategory(ReleaseStep::CATEGORY_POST_DEPLOY);
        $clearCacheStep->setPriority(ReleaseStep::PRIORITY_HIGH);

        if ($this->releaseConfig->shouldClearCache()) {
            $clearCacheStep->setStatus(ReleaseStep::STATUS_READY);
            $clearCacheStep->setSummary('Cache will be cleared');
            $clearCacheStep->addDependency('deploy_files');
        } else {
            $clearCacheStep->setStatus(ReleaseStep::STATUS_SKIPPED);
            $clearCacheStep->setSummary('Cache clearing disabled');
        }
        $plan->addStep($clearCacheStep);

        $disableMaintenanceStep = new ReleaseStep('disable_maintenance', 'Disable maintenance mode');
        $disableMaintenanceStep->setDescription('Take the application out of maintenance mode');
        $disableMaintenanceStep->setCategory(ReleaseStep::CATEGORY_POST_DEPLOY);
        $disableMaintenanceStep->setPriority(ReleaseStep::PRIORITY_HIGH);
        $disableMaintenanceStep->addDependency('clear_cache');

        $target = $this->deployTargets->getTarget($targetEnv);
        if ($this->releaseConfig->get('deploy.maintenance_mode', true) &&
            ($target['maintenance_enabled'] ?? true)) {
            $disableMaintenanceStep->setStatus(ReleaseStep::STATUS_READY);
            $disableMaintenanceStep->setSummary('Maintenance mode will be disabled');
        } else {
            $disableMaintenanceStep->setStatus(ReleaseStep::STATUS_SKIPPED);
            $disableMaintenanceStep->setSummary('Maintenance mode was not enabled');
        }
        $plan->addStep($disableMaintenanceStep);

        $verifyStep = new ReleaseStep('verify_deploy', 'Verify deployment');
        $verifyStep->setDescription('Verify the application is running correctly after deployment');
        $verifyStep->setCategory(ReleaseStep::CATEGORY_POST_DEPLOY);
        $verifyStep->setPriority(ReleaseStep::PRIORITY_MEDIUM);
        $verifyStep->setStatus(ReleaseStep::STATUS_READY);
        $verifyStep->setSummary('Run post-deployment verification checks');
        $verifyStep->addDependency('disable_maintenance');
        $plan->addStep($verifyStep);
    }

    private function addRollbackSteps(ReleasePlan $plan): void
    {
        if (!$this->releaseConfig->isRollbackEnabled()) {
            $step = new ReleaseStep('rollback_plan', 'Rollback planning');
            $step->setDescription('Rollback is disabled in configuration');
            $step->setCategory(ReleaseStep::CATEGORY_ROLLBACK);
            $step->setStatus(ReleaseStep::STATUS_SKIPPED);
            $step->setSummary('Rollback disabled');
            $plan->addStep($step);
            return;
        }

        $nonRollbackable = $this->migrationParser->getNonRollbackableMigrations();
        $irreversible = $this->migrationParser->getIrreversibleMigrations();

        $rollbackStep = new ReleaseStep('rollback_plan', 'Prepare rollback materials');
        $rollbackStep->setDescription('Generate rollback package and instructions');
        $rollbackStep->setCategory(ReleaseStep::CATEGORY_ROLLBACK);
        $rollbackStep->setPriority(ReleaseStep::PRIORITY_MEDIUM);
        $rollbackStep->setStatus(ReleaseStep::STATUS_READY);

        $details = [
            "Rollback enabled: Yes",
            "Keep releases: " . $this->releaseConfig->getKeepReleases(),
        ];

        if (!empty($nonRollbackable)) {
            $details[] = "WARNING: " . count($nonRollbackable) . " non-rollbackable migration(s)";
        }

        if (!empty($irreversible)) {
            $details[] = "CRITICAL: " . count($irreversible) . " irreversible migration(s)";
            $rollbackStep->setRequiresConfirmation(true);
            $rollbackStep->setConfirmationMessage(
                'This release contains irreversible migrations. Full rollback may not be possible. Continue?'
            );
        }

        $rollbackStep->setDetails($details);
        $rollbackStep->setSummary(
            empty($irreversible) 
                ? 'Rollback package will be generated'
                : 'Rollback prepared with limitations (irreversible migrations)'
        );
        $plan->addStep($rollbackStep);
    }

    private function checkDependencies(ReleasePlan $plan): void
    {
        $steps = $plan->getSteps();
        $stepIndex = [];

        foreach ($steps as $step) {
            $stepIndex[$step->getId()] = $step;
        }

        foreach ($steps as $step) {
            foreach ($step->getDependencies() as $depId) {
                if (!isset($stepIndex[$depId])) {
                    $step->setStatus(ReleaseStep::STATUS_BLOCKED);
                    $step->addBlocker("Dependency '{$depId}' not found");
                }
            }
        }
    }

    private function generateAuditLog(ReleasePlan $plan): void
    {
        $log = [
            'planned_at' => date('c'),
            'user' => get_current_user() ?: 'unknown',
            'version' => $plan->getVersion(),
            'target' => $plan->getTargetEnvironment(),
            'steps' => array_map(function ($step) {
                return [
                    'id' => $step->getId(),
                    'name' => $step->getName(),
                    'category' => $step->getCategory(),
                    'status' => $step->getStatus(),
                    'priority' => $step->getPriority(),
                    'requires_confirmation' => $step->isRequiresConfirmation(),
                    'dependencies' => $step->getDependencies(),
                ];
            }, $plan->getSteps()),
            'status' => $plan->getStatus(),
            'blockers' => $plan->getBlockers(),
        ];

        $plan->setAuditLog($log);

        $outputDir = $this->config->reportsDir;
        if ($this->filesystem->exists($outputDir)) {
            $logPath = $outputDir . '/plan-audit-' . date('YmdHis') . '.json';
            $this->filesystem->dumpFile(
                $logPath,
                json_encode($log, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
            );
            $plan->setAuditLogPath($logPath);
        }
    }

    public function executeStep(ReleasePlan $plan, string $stepId): ReleaseStep
    {
        $steps = $plan->getSteps();
        $targetStep = null;

        foreach ($steps as $step) {
            if ($step->getId() === $stepId) {
                $targetStep = $step;
                break;
            }
        }

        if (!$targetStep) {
            throw DeployFlowException::releaseError($stepId, 'Step not found');
        }

        if ($targetStep->getStatus() === ReleaseStep::STATUS_COMPLETED) {
            return $targetStep;
        }

        if ($targetStep->getStatus() === ReleaseStep::STATUS_BLOCKED) {
            throw DeployFlowException::releaseError(
                $stepId,
                'Step is blocked: ' . implode(', ', $targetStep->getBlockers())
            );
        }

        if ($targetStep->isRequiresConfirmation()) {
            $targetStep->setStatus(ReleaseStep::STATUS_PENDING_CONFIRMATION);
            return $targetStep;
        }

        $targetStep->setStatus(ReleaseStep::STATUS_IN_PROGRESS);
        $targetStep->setStartedAt(date('c'));

        usleep(100000);

        $targetStep->setStatus(ReleaseStep::STATUS_COMPLETED);
        $targetStep->setCompletedAt(date('c'));

        $elapsed = (strtotime($targetStep->getCompletedAt()) - strtotime($targetStep->getStartedAt()));
        $targetStep->setSummary(
            $targetStep->getSummary() . " (completed in {$elapsed}s)"
        );

        return $targetStep;
    }
}
