<?php

declare(strict_types=1);

namespace DeployFlow\Command;

use DeployFlow\Config\ProjectConfig;
use DeployFlow\Parser\ComposerParser;
use DeployFlow\Parser\EnvMatrixParser;
use DeployFlow\Parser\MigrationParser;
use DeployFlow\Parser\ReleaseConfigParser;
use DeployFlow\Parser\DeployTargetsParser;
use DeployFlow\Release\ReleasePlanner;
use DeployFlow\Release\ReleasePlan;
use DeployFlow\Release\ReleaseStep;
use DeployFlow\Validator\ProjectValidator;
use DeployFlow\Validator\ValidatorResult;
use DeployFlow\Exception\DeployFlowException;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

class PlanCommand extends Command
{
    protected static $defaultName = 'plan';

    protected function configure(): void
    {
        $this
            ->setDescription('Generate a release plan with steps, dependencies, and blockers')
            ->setHelp('This command generates a detailed release plan including validation steps, migrations, deployment steps, and rollback preparations')
            ->addOption(
                'project-dir',
                'd',
                InputOption::VALUE_REQUIRED,
                'Project directory path',
                getcwd()
            )
            ->addOption(
                'target',
                't',
                InputOption::VALUE_REQUIRED,
                'Target environment (production, staging, development)',
                'production'
            )
            ->addOption(
                'build-version',
                'b',
                InputOption::VALUE_REQUIRED,
                'Use existing build version for the plan'
            )
            ->addOption(
                'no-validate',
                null,
                InputOption::VALUE_NONE,
                'Skip validation steps in the plan'
            )
            ->addOption(
                'json',
                'j',
                InputOption::VALUE_NONE,
                'Output results as JSON'
            )
            ->addOption(
                'save',
                's',
                InputOption::VALUE_NONE,
                'Save the plan to JSON file in output directory'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $projectDir = rtrim($input->getOption('project-dir'), '/');
        $target = $input->getOption('target');
        $buildVersion = $input->getOption('build-version');
        $noValidate = $input->getOption('no-validate');
        $asJson = $input->getOption('json');
        $save = $input->getOption('save');

        $config = new ProjectConfig($projectDir);

        try {
            $composerParser = new ComposerParser(
                $config->composerJsonPath,
                $config->composerLockPath
            );
            $composerParser->parse();
        } catch (DeployFlowException $e) {
            if ($asJson) {
                $output->writeln(json_encode([
                    'success' => false,
                    'error' => 'Failed to parse composer files: ' . $e->getMessage(),
                ]));
            } else {
                $io->error('Failed to parse composer files: ' . $e->getMessage());
            }
            return Command::FAILURE;
        }

        try {
            $envMatrixParser = new EnvMatrixParser($config->envMatrixPath);
            $envMatrixParser->parse();
        } catch (DeployFlowException $e) {
            if (!$asJson) {
                $io->warning('env-matrix.csv not found or invalid: ' . $e->getMessage());
            }
        }

        try {
            $migrationParser = new MigrationParser($config->getMigrationsPath());
            $migrationParser->parse();
        } catch (DeployFlowException $e) {
            if (!$asJson) {
                $io->warning('Failed to parse migrations: ' . $e->getMessage());
            }
        }

        $releaseConfig = new ReleaseConfigParser($config->releaseYamlPath);
        $releaseConfig->parse();

        $deployTargets = new DeployTargetsParser($config->deployTargetsPath);
        $deployTargets->parse();

        $validationResult = null;
        if (!$noValidate) {
            if (!$asJson) {
                $io->section('Running validation...');
            }
            $validator = new ProjectValidator(
                $config,
                $composerParser,
                $envMatrixParser,
                $migrationParser,
                $releaseConfig,
                $deployTargets
            );
            $validator->setTargetEnvironment($target);
            $validationResult = $validator->validate();
        }

        $planner = new ReleasePlanner(
            $config,
            $releaseConfig,
            $migrationParser,
            $deployTargets
        );

        $planner->setTargetEnvironment($target);
        if ($validationResult) {
            $planner->setValidationResult($validationResult);
        }

        $buildResult = $this->loadExistingBuildResult($config, $buildVersion);
        if ($buildResult) {
            $planner->setBuildResult($buildResult);
        }

        try {
            $plan = $planner->plan();
        } catch (DeployFlowException $e) {
            if ($asJson) {
                $output->writeln(json_encode([
                    'success' => false,
                    'error' => 'Failed to generate plan: ' . $e->getMessage(),
                ]));
            } else {
                $io->error('Failed to generate plan: ' . $e->getMessage());
            }
            return Command::FAILURE;
        }

        if ($save) {
            $this->savePlan($config, $plan);
        }

        if ($asJson) {
            $output->writeln(json_encode($plan->toArray(), JSON_PRETTY_PRINT));
            return $plan->isReady() ? Command::SUCCESS : Command::FAILURE;
        }

        $this->displayPlan($io, $plan, $validationResult);

        if ($plan->hasBlockers()) {
            $io->warning('Release plan has BLOCKERS that must be resolved before proceeding.');
            return Command::FAILURE;
        }

        if (!$plan->isReady()) {
            $io->warning('Release plan is not ready. Review the issues above.');
            return Command::FAILURE;
        }

        $io->success('Release plan is ready!');
        return Command::SUCCESS;
    }

    private function displayPlan(SymfonyStyle $io, ReleasePlan $plan, ?ValidatorResult $validationResult): void
    {
        $io->title('Release Plan');

        $io->definitionList(
            ['Version' => $plan->getVersion()],
            ['Target Environment' => $plan->getTargetEnvironment() ?? 'N/A'],
            ['Status' => $this->getStatusLabel($plan->getStatus())],
            ['Created At' => $plan->getCreatedAt()],
        );

        if ($plan->hasBlockers()) {
            $io->section('⚠️ Blockers');
            foreach ($plan->getBlockers() as $blocker) {
                $io->error($blocker);
            }
        }

        $progress = $plan->getProgress();
        $io->section('Progress Overview');
        $io->text(sprintf(
            'Total: %d | Completed: %d | Ready: %d | Blocked: %d | Progress: %s%%',
            $progress['total'],
            $progress['completed'],
            $progress['ready'],
            $progress['blocked'],
            $progress['percentage']
        ));

        $io->section('Release Steps');

        $steps = $plan->getStepsInOrder();
        $rows = [];

        foreach ($steps as $step) {
            $icon = $this->getStepStatusIcon($step->getStatus());
            $category = $this->getCategoryLabel($step->getCategory());
            $deps = implode(', ', $step->getDependencies()) ?: '-';
            $confirm = $step->isRequiresConfirmation() ? '⚠️' : '';

            $rows[] = [
                $icon,
                $category,
                $step->getName(),
                $step->getSummary(),
                $deps,
                $confirm,
            ];
        }

        $io->table(
            ['', 'Category', 'Step', 'Summary', 'Depends On', 'Confirm'],
            $rows
        );

        $confirmationSteps = array_filter(
            $steps,
            fn(ReleaseStep $step) => $step->isRequiresConfirmation()
        );

        if (!empty($confirmationSteps)) {
            $io->section('⚠️ Steps Requiring Manual Confirmation');
            foreach ($confirmationSteps as $step) {
                $io->text('  - ' . $step->getName() . ': ' . $step->getSummary());
                if ($step->getConfirmationMessage()) {
                    $io->text('    Message: ' . $step->getConfirmationMessage());
                }
            }
        }

        $blockedSteps = $plan->getBlockedSteps();
        if (!empty($blockedSteps)) {
            $io->section('🚫 Blocked Steps');
            foreach ($blockedSteps as $step) {
                $io->text('  - ' . $step->getName() . ': ' . implode('; ', $step->getBlockers()));
            }
        }

        if ($plan->getAuditLogPath()) {
            $io->section('📝 Audit Log');
            $io->text('Audit log saved to: ' . $plan->getAuditLogPath());
        }
    }

    private function getStatusLabel(string $status): string
    {
        $labels = [
            ReleasePlan::STATUS_READY => '<fg=green>✓ Ready</>',
            ReleasePlan::STATUS_BLOCKED => '<fg=red>✗ Blocked</>',
            ReleasePlan::STATUS_IN_PROGRESS => '<fg=yellow>🔄 In Progress</>',
            ReleasePlan::STATUS_COMPLETED => '<fg=green>✓ Completed</>',
            ReleasePlan::STATUS_FAILED => '<fg=red>✗ Failed</>',
        ];
        return $labels[$status] ?? $status;
    }

    private function getCategoryLabel(string $category): string
    {
        $labels = [
            ReleaseStep::CATEGORY_VALIDATION => 'Validation',
            ReleaseStep::CATEGORY_PRE_DEPLOY => 'Pre-Deploy',
            ReleaseStep::CATEGORY_MIGRATION => 'Migration',
            ReleaseStep::CATEGORY_DEPLOY => 'Deploy',
            ReleaseStep::CATEGORY_POST_DEPLOY => 'Post-Deploy',
            ReleaseStep::CATEGORY_ROLLBACK => 'Rollback',
        ];
        return $labels[$category] ?? $category;
    }

    private function getStepStatusIcon(string $status): string
    {
        $icons = [
            ReleaseStep::STATUS_READY => '⏳',
            ReleaseStep::STATUS_IN_PROGRESS => '🔄',
            ReleaseStep::STATUS_COMPLETED => '✅',
            ReleaseStep::STATUS_BLOCKED => '🚫',
            ReleaseStep::STATUS_SKIPPED => '⏭️',
            ReleaseStep::STATUS_PENDING_CONFIRMATION => '❓',
            ReleaseStep::STATUS_FAILED => '❌',
        ];
        return $icons[$status] ?? '•';
    }

    private function loadExistingBuildResult(ProjectConfig $config, ?string $version): ?object
    {
        if (!$version) {
            return null;
        }

        $buildDir = $config->buildsDir . '/' . $version;
        $manifestPath = $buildDir . '/manifest.json';

        if (!file_exists($manifestPath)) {
            return null;
        }

        $manifest = json_decode(file_get_contents($manifestPath), true);
        if (!$manifest) {
            return null;
        }

        return new class ($version, $manifest, $buildDir) {
            private string $version;
            private array $manifest;
            private string $buildDir;

            public function __construct(string $version, array $manifest, string $buildDir)
            {
                $this->version = $version;
                $this->manifest = $manifest;
                $this->buildDir = $buildDir;
            }

            public function getVersion(): string
            {
                return $this->version;
            }

            public function getBuildDir(): string
            {
                return $this->buildDir;
            }

            public function getFileCount(): int
            {
                return $this->manifest['total_files'] ?? 0;
            }

            public function getTarPath(): ?string
            {
                $path = $this->buildDir . '/release.tar.gz';
                return file_exists($path) ? $path : null;
            }

            public function getZipPath(): ?string
            {
                $path = $this->buildDir . '/release.zip';
                return file_exists($path) ? $path : null;
            }
        };
    }

    private function savePlan(ProjectConfig $config, ReleasePlan $plan): void
    {
        $outputDir = $config->reportsDir;
        if (!is_dir($outputDir)) {
            mkdir($outputDir, 0755, true);
        }

        $timestamp = date('YmdHis');
        $version = $plan->getVersion() === 'planned' ? 'unversioned' : $plan->getVersion();
        $target = $plan->getTargetEnvironment() ?? 'default';

        $filename = sprintf('plan-%s-%s-%s.json', $target, $version, $timestamp);
        $filepath = $outputDir . '/' . $filename;

        file_put_contents(
            $filepath,
            json_encode($plan->toArray(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }
}
