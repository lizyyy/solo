<?php

declare(strict_types=1);

namespace DeployFlow\Command;

use DeployFlow\Config\ProjectConfig;
use DeployFlow\Parser\MigrationParser;
use DeployFlow\Parser\ReleaseConfigParser;
use DeployFlow\Parser\DeployTargetsParser;
use DeployFlow\Rollback\RollbackManager;
use DeployFlow\Rollback\RollbackPlan;
use DeployFlow\Exception\DeployFlowException;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\Console\Question\ConfirmationQuestion;

class RollbackCommand extends Command
{
    protected static $defaultName = 'rollback';

    protected function configure(): void
    {
        $this
            ->setDescription('Prepare or execute a rollback plan')
            ->setHelp('This command generates a rollback plan, detects irreversible migrations, and creates rollback materials')
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
                'Target environment',
                'production'
            )
            ->addOption(
                'release-version',
                null,
                InputOption::VALUE_REQUIRED,
                'Version to rollback to (build version)'
            )
            ->addOption(
                'list-builds',
                'l',
                InputOption::VALUE_NONE,
                'List available builds for rollback'
            )
            ->addOption(
                'create-package',
                'p',
                InputOption::VALUE_REQUIRED,
                'Create a rollback package from an existing build (specify build version)'
            )
            ->addOption(
                'package-format',
                'f',
                InputOption::VALUE_REQUIRED,
                'Rollback package format: tar or zip',
                'tar'
            )
            ->addOption(
                'json',
                'j',
                InputOption::VALUE_NONE,
                'Output results as JSON'
            )
            ->addOption(
                'force',
                null,
                InputOption::VALUE_NONE,
                'Force rollback preparation even with irreversible migrations'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $projectDir = rtrim($input->getOption('project-dir'), '/');
        $target = $input->getOption('target');
        $version = $input->getOption('release-version');
        $listBuilds = $input->getOption('list-builds');
        $createPackage = $input->getOption('create-package');
        $packageFormat = $input->getOption('package-format');
        $asJson = $input->getOption('json');
        $force = $input->getOption('force');

        $config = new ProjectConfig($projectDir);

        try {
            $migrationParser = new MigrationParser($config->getMigrationsPath());
            $migrationParser->parse();
        } catch (DeployFlowException $e) {
            if (!$asJson) {
                $io->warning('Migrations directory not found or empty: ' . $e->getMessage());
            }
        }

        $releaseConfig = new ReleaseConfigParser($config->releaseYamlPath);
        $releaseConfig->parse();

        $deployTargets = new DeployTargetsParser($config->deployTargetsPath);
        $deployTargets->parse();

        $rollbackManager = new RollbackManager(
            $config,
            $releaseConfig,
            $migrationParser ?? null,
            $deployTargets
        );

        $rollbackManager->setTargetEnvironment($target);

        if ($listBuilds) {
            return $this->listBuilds($rollbackManager, $io, $asJson);
        }

        if ($createPackage) {
            return $this->createRollbackPackage(
                $rollbackManager,
                $config,
                $createPackage,
                $packageFormat,
                $io,
                $asJson
            );
        }

        if (!$version) {
            if ($asJson) {
                $output->writeln(json_encode([
                    'success' => false,
                    'error' => 'Version is required. Use --version to specify the version to rollback to.',
                ]));
            } else {
                $io->error('Version is required. Use --version to specify the version to rollback to.');
                $io->text('');
                $io->text('Available options:');
                $io->listing([
                    'Use --list-builds to see available builds',
                    'Use --version <version> to prepare a rollback plan',
                    'Use --create-package <version> to create a rollback package',
                ]);
            }
            return Command::FAILURE;
        }

        return $this->prepareRollbackPlan(
            $rollbackManager,
            $version,
            $force,
            $io,
            $asJson,
            $input,
            $output
        );
    }

    private function listBuilds(RollbackManager $manager, SymfonyStyle $io, bool $asJson): int
    {
        $builds = $manager->listAvailableBuilds();

        if ($asJson) {
            $output->writeln(json_encode([
                'success' => true,
                'builds' => $builds,
            ], JSON_PRETTY_PRINT));
            return Command::SUCCESS;
        }

        $io->title('Available Builds for Rollback');

        if (empty($builds)) {
            $io->text('No builds found. Run `deployflow build` to create a build first.');
            return Command::SUCCESS;
        }

        $rows = [];
        foreach ($builds as $build) {
            $rows[] = [
                $build['version'],
                $build['project'] ?? 'N/A',
                $build['built_at'] ?? 'N/A',
                $build['total_files'] ?? 'N/A',
                $build['has_manifest'] ? '✓' : '✗',
                $build['has_checksums'] ? '✓' : '✗',
            ];
        }

        $io->table(
            ['Version', 'Project', 'Built At', 'Files', 'Manifest', 'Checksums'],
            $rows
        );

        return Command::SUCCESS;
    }

    private function createRollbackPackage(
        RollbackManager $manager,
        ProjectConfig $config,
        string $version,
        string $format,
        SymfonyStyle $io,
        bool $asJson
    ): int {
        if (!is_dir($config->rollbackDir)) {
            mkdir($config->rollbackDir, 0755, true);
        }

        $filename = sprintf('rollback-%s.%s', $version, $format === 'zip' ? 'zip' : 'tar.gz');
        $outputPath = $config->rollbackDir . '/' . $filename;

        if ($asJson) {
            $output->writeln(json_encode([
                'success' => true,
                'phase' => 'creating',
                'version' => $version,
                'format' => $format,
                'output_path' => $outputPath,
            ]));
        } else {
            $io->title('Creating Rollback Package');
            $io->definitionList(
                ['Version' => $version],
                ['Format' => $format],
                ['Output Path' => $outputPath],
            );
        }

        try {
            $success = $manager->createRollbackPackage($version, $outputPath);
        } catch (DeployFlowException $e) {
            if ($asJson) {
                $output->writeln(json_encode([
                    'success' => false,
                    'error' => $e->getMessage(),
                ]));
            } else {
                $io->error('Failed to create rollback package: ' . $e->getMessage());
            }
            return Command::FAILURE;
        }

        if ($success && file_exists($outputPath)) {
            $size = filesize($outputPath);

            if ($asJson) {
                $output->writeln(json_encode([
                    'success' => true,
                    'version' => $version,
                    'format' => $format,
                    'output_path' => $outputPath,
                    'size' => $size,
                    'size_formatted' => $this->formatBytes($size),
                ], JSON_PRETTY_PRINT));
            } else {
                $io->success('Rollback package created successfully!');
                $io->definitionList(
                    ['File' => basename($outputPath)],
                    ['Path' => $outputPath],
                    ['Size' => $this->formatBytes($size)],
                );
            }
            return Command::SUCCESS;
        }

        if ($asJson) {
            $output->writeln(json_encode([
                'success' => false,
                'error' => 'Failed to create rollback package - output file not found',
            ]));
        } else {
            $io->error('Failed to create rollback package - output file not found');
        }
        return Command::FAILURE;
    }

    private function prepareRollbackPlan(
        RollbackManager $manager,
        string $version,
        bool $force,
        SymfonyStyle $io,
        bool $asJson,
        InputInterface $input,
        OutputInterface $output
    ): int {
        if ($asJson) {
            $output->writeln(json_encode([
                'success' => true,
                'phase' => 'analyzing',
                'version' => $version,
            ]));
        } else {
            $io->title('Preparing Rollback Plan');
            $io->text('Analyzing migrations for rollback capability...');
        }

        try {
            $plan = $manager->prepareRollback($version);
        } catch (DeployFlowException $e) {
            if ($asJson) {
                $output->writeln(json_encode([
                    'success' => false,
                    'error' => 'Failed to prepare rollback plan: ' . $e->getMessage(),
                ]));
            } else {
                $io->error('Failed to prepare rollback plan: ' . $e->getMessage());
            }
            return Command::FAILURE;
        }

        if ($asJson) {
            $output->writeln(json_encode([
                'success' => true,
                'plan' => $plan->toArray(),
            ], JSON_PRETTY_PRINT));
            return $plan->canAutoRollback() ? Command::SUCCESS : Command::FAILURE;
        }

        $this->displayRollbackPlan($io, $plan);

        if ($plan->hasBlockers() && !$force) {
            $io->warning('🚫 Rollback blockers detected!');
            $io->text('');
            $io->text('The following issues prevent a clean rollback:');
            foreach ($plan->getBlockers() as $blocker) {
                $io->text('  • ' . $blocker);
            }
            $io->text('');
            $io->warning('Use --force to proceed anyway (MANUAL INTERVENTION WILL BE REQUIRED)');

            $question = new ConfirmationQuestion(
                "\n<question>Do you want to prepare the rollback materials anyway? (y/N): </question>",
                false
            );

            $helper = $this->getHelper('question');
            if (!$helper->ask($input, $output, $question)) {
                $io->text('Rollback preparation cancelled.');
                return Command::SUCCESS;
            }
        }

        $io->section('Generated Rollback Materials');

        $rows = [];
        if ($plan->getManifestPath()) {
            $rows[] = [
                '📄',
                'Rollback Manifest',
                basename($plan->getManifestPath()),
                $plan->getManifestPath(),
            ];
        }
        if ($plan->getScriptPath()) {
            $rows[] = [
                '📜',
                'Rollback Script',
                basename($plan->getScriptPath()),
                $plan->getScriptPath(),
            ];
        }

        if (!empty($rows)) {
            $io->table(['', 'Type', 'Filename', 'Path'], $rows);
        }

        if ($plan->canAutoRollback()) {
            $io->success('Rollback plan is ready for automatic execution!');
        } else {
            $io->warning('Rollback plan requires manual intervention. Review the rollback-manifest.json for details.');
        }

        $io->text('');
        $io->text('Next steps:');
        $io->listing([
            'Review the rollback-manifest.json for complete details',
            'Test the rollback in a staging environment first',
            'Ensure you have a valid backup before executing rollback',
        ]);

        return Command::SUCCESS;
    }

    private function displayRollbackPlan(SymfonyStyle $io, RollbackPlan $plan): void
    {
        $io->section('Rollback Summary');

        $io->definitionList(
            ['Version' => $plan->getVersion()],
            ['Created At' => $plan->getCreatedAt()],
            ['Can Auto-Rollback' => $plan->canAutoRollback() ? '<fg=green>✓ Yes</>' : '<fg=red>✗ No</>'],
        );

        if ($plan->hasBlockers()) {
            $io->section('🚫 Blockers');
            foreach ($plan->getBlockers() as $blocker) {
                $io->error($blocker);
            }
        }

        if ($plan->hasWarnings()) {
            $io->section('⚠️ Warnings');
            foreach ($plan->getWarnings() as $warning) {
                $io->warning($warning);
            }
        }

        $irreversible = $plan->getIrreversibleMigrations();
        if (!empty($irreversible)) {
            $io->section('❌ Irreversible Migrations');
            $io->text('These migrations CANNOT be undone:');

            $rows = [];
            foreach ($irreversible as $m) {
                $rows[] = [
                    $m['filename'] ?? 'N/A',
                    $m['version'] ?? 'N/A',
                    $m['name'] ?? 'N/A',
                    $m['description'] ?? '-',
                ];
            }
            $io->table(['Filename', 'Version', 'Name', 'Description'], $rows);
        }

        $nonRollbackable = $plan->getNonRollbackableMigrations();
        if (!empty($nonRollbackable)) {
            $io->section('⚠️ Non-Rollbackable Migrations');
            $io->text('These migrations have no automatic down() method:');

            $rows = [];
            foreach ($nonRollbackable as $m) {
                $rows[] = [
                    $m['filename'] ?? 'N/A',
                    $m['version'] ?? 'N/A',
                    $m['name'] ?? 'N/A',
                ];
            }
            $io->table(['Filename', 'Version', 'Name'], $rows);
        }

        $steps = $plan->getSteps();
        if (!empty($steps)) {
            $io->section('Rollback Steps');

            $rows = [];
            $stepNum = 1;
            foreach ($steps as $step) {
                $name = $step['name'] ?? 'Unknown';
                $priority = strtoupper($step['priority'] ?? 'medium');
                $needsConfirm = ($step['requires_confirmation'] ?? false) ? '⚠️' : '';
                $desc = $step['description'] ?? '';

                $rows[] = [
                    $stepNum,
                    $priority,
                    $name,
                    $desc,
                    $needsConfirm,
                ];
                $stepNum++;
            }

            $io->table(['#', 'Priority', 'Step', 'Description', 'Confirm'], $rows);
        }
    }

    private function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= (1 << (10 * $pow));

        return round($bytes, 2) . ' ' . $units[$pow];
    }
}
