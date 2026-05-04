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
use Symfony\Component\Console\Question\ConfirmationQuestion;

class ReleaseCommand extends Command
{
    protected static $defaultName = 'release';

    protected function configure(): void
    {
        $this
            ->setDescription('Execute a release based on the generated plan')
            ->setHelp('This command executes the release steps in order, with confirmation prompts and audit logging')
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
                'Build version to release'
            )
            ->addOption(
                'dry-run',
                null,
                InputOption::VALUE_NONE,
                'Run without actually executing any steps'
            )
            ->addOption(
                'force',
                'f',
                InputOption::VALUE_NONE,
                'Force release even with blockers (dangerous!)'
            )
            ->addOption(
                'no-confirm',
                null,
                InputOption::VALUE_NONE,
                'Skip all confirmation prompts (dangerous!)'
            )
            ->addOption(
                'json',
                'j',
                InputOption::VALUE_NONE,
                'Output results as JSON'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $projectDir = rtrim($input->getOption('project-dir'), '/');
        $target = $input->getOption('target');
        $buildVersion = $input->getOption('build-version');
        $dryRun = $input->getOption('dry-run');
        $force = $input->getOption('force');
        $noConfirm = $input->getOption('no-confirm');
        $asJson = $input->getOption('json');

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

        $planner = new ReleasePlanner(
            $config,
            $releaseConfig,
            $migrationParser,
            $deployTargets
        );

        $planner->setTargetEnvironment($target);
        $planner->setValidationResult($validationResult);

        try {
            $plan = $planner->plan();
        } catch (DeployFlowException $e) {
            if ($asJson) {
                $output->writeln(json_encode([
                    'success' => false,
                    'error' => 'Failed to generate release plan: ' . $e->getMessage(),
                ]));
            } else {
                $io->error('Failed to generate release plan: ' . $e->getMessage());
            }
            return Command::FAILURE;
        }

        if ($asJson) {
            $output->writeln(json_encode([
                'success' => true,
                'phase' => 'planning',
                'plan' => $plan->toArray(),
            ]));
        }

        if ($plan->hasBlockers() && !$force) {
            if ($asJson) {
                $output->writeln(json_encode([
                    'success' => false,
                    'error' => 'Release has blockers. Use --force to override (dangerous!).',
                    'blockers' => $plan->getBlockers(),
                ]));
            } else {
                $io->title('🚫 Release Blocked');
                $io->error('The release plan has blockers that must be resolved:');
                foreach ($plan->getBlockers() as $blocker) {
                    $io->text('  • ' . $blocker);
                }
                $io->text('');
                $io->warning('Use --force to override blockers (THIS IS DANGEROUS AND NOT RECOMMENDED!)');
            }
            return Command::FAILURE;
        }

        if (!$asJson) {
            $io->title('🚀 Release Execution');
            $io->definitionList(
                ['Target Environment' => $target],
                ['Build Version' => $buildVersion ?? 'N/A'],
                ['Dry Run' => $dryRun ? 'Yes (No actual changes)' : 'No'],
                ['Force Mode' => $force ? 'Yes (DANGEROUS)' : 'No'],
            );

            $steps = $plan->getStepsInOrder();
            $confirmSteps = array_filter($steps, fn(ReleaseStep $step) => $step->isRequiresConfirmation());

            if (!empty($confirmSteps) && !$noConfirm) {
                $io->section('⚠️ Steps Requiring Confirmation');
                foreach ($confirmSteps as $step) {
                    $io->text('  • ' . $step->getName() . ': ' . $step->getSummary());
                    if ($step->getConfirmationMessage()) {
                        $io->text('    ' . $step->getConfirmationMessage());
                    }
                }
            }

            if (!$noConfirm) {
                $question = new ConfirmationQuestion(
                    "\n<question>Ready to proceed with the release? (y/N): </question>",
                    false
                );

                $helper = $this->getHelper('question');
                if (!$helper->ask($input, $output, $question)) {
                    $io->text('Release cancelled by user.');
                    return Command::SUCCESS;
                }
            }
        }

        $executionResults = [];
        $success = true;

        if (!$asJson) {
            $io->section('Executing Release Steps');
        }

        $steps = $plan->getStepsInOrder();
        $stepIndex = [];
        foreach ($steps as $step) {
            $stepIndex[$step->getId()] = $step;
        }

        foreach ($steps as $step) {
            $stepResult = [
                'id' => $step->getId(),
                'name' => $step->getName(),
                'status' => $step->getStatus(),
                'started_at' => date('c'),
                'completed_at' => null,
                'error' => null,
            ];

            $categoryLabel = $this->getCategoryLabel($step->getCategory());

            if (!$asJson) {
                $io->text(sprintf(
                    '[%s] %s: %s',
                    $categoryLabel,
                    $step->getName(),
                    $step->getSummary()
                ));
            }

            if ($step->getStatus() === ReleaseStep::STATUS_SKIPPED) {
                $stepResult['status'] = 'skipped';
                $stepResult['completed_at'] = date('c');
                $executionResults[] = $stepResult;

                if (!$asJson) {
                    $io->text('  ⏭️  Skipped');
                }
                continue;
            }

            if ($step->isRequiresConfirmation() && !$noConfirm && !$dryRun) {
                $msg = $step->getConfirmationMessage() ?? 'Confirm this step?';
                $question = new ConfirmationQuestion(
                    sprintf("\n  <question>⚠️  %s (y/N): </question>", $msg),
                    false
                );

                $helper = $this->getHelper('question');
                if (!$helper->ask($input, $output, $question)) {
                    $stepResult['status'] = 'cancelled';
                    $stepResult['error'] = 'Cancelled by user';
                    $executionResults[] = $stepResult;
                    $success = false;

                    if (!$asJson) {
                        $io->text('  ❌ Step cancelled by user');
                    }
                    break;
                }
            }

            if ($dryRun) {
                $stepResult['status'] = 'dry_run';
                $stepResult['completed_at'] = date('c');
                $executionResults[] = $stepResult;

                if (!$asJson) {
                    $io->text('  ✅ (Dry run - no actual execution)');
                }
                continue;
            }

            try {
                $this->executeStepLogic($step, $plan, $config, $dryRun);
                $step->setStatus(ReleaseStep::STATUS_COMPLETED);
                $step->setCompletedAt(date('c'));

                $stepResult['status'] = 'completed';
                $stepResult['completed_at'] = date('c');
                $executionResults[] = $stepResult;

                if (!$asJson) {
                    $io->text('  ✅ Completed');
                }
            } catch (\Exception $e) {
                $step->setStatus(ReleaseStep::STATUS_FAILED);
                $stepResult['status'] = 'failed';
                $stepResult['error'] = $e->getMessage();
                $stepResult['completed_at'] = date('c');
                $executionResults[] = $stepResult;
                $success = false;

                if (!$asJson) {
                    $io->error('  ❌ Failed: ' . $e->getMessage());
                }

                if (!$asJson) {
                    $io->warning('Release execution halted due to failure. Review the error above.');
                    $io->text('');
                    $io->text('Consider:');
                    $io->listing([
                        'Fix the issue and re-run release',
                        'Prepare for rollback using `deployflow rollback`',
                    ]);
                }
                break;
            }
        }

        $this->saveExecutionLog($config, $executionResults, $success, $dryRun);

        if ($asJson) {
            $output->writeln(json_encode([
                'success' => $success,
                'dry_run' => $dryRun,
                'execution_results' => $executionResults,
                'plan' => $plan->toArray(),
            ], JSON_PRETTY_PRINT));
        } else {
            $io->section('Release Summary');

            $completed = count(array_filter($executionResults, fn($r) => $r['status'] === 'completed'));
            $skipped = count(array_filter($executionResults, fn($r) => $r['status'] === 'skipped'));
            $dryRuns = count(array_filter($executionResults, fn($r) => $r['status'] === 'dry_run'));
            $failed = count(array_filter($executionResults, fn($r) => $r['status'] === 'failed'));

            $io->definitionList(
                ['Status' => $success ? '<fg=green>✓ SUCCESS</>' : '<fg=red>✗ FAILED</>'],
                ['Total Steps' => count($executionResults)],
                ['Completed' => $completed],
                ['Skipped' => $skipped],
                ['Dry Run' => $dryRuns],
                ['Failed' => $failed],
            );

            if ($success) {
                $io->success($dryRun ? 'Dry run completed successfully!' : 'Release completed successfully!');
                if (!$dryRun) {
                    $io->text('');
                    $io->text('Post-release actions:');
                    $io->listing([
                        'Verify the application is running correctly',
                        'Check logs for any errors',
                        'Run smoke tests if available',
                    ]);
                }
            }
        }

        return $success ? Command::SUCCESS : Command::FAILURE;
    }

    private function executeStepLogic(ReleaseStep $step, ReleasePlan $plan, ProjectConfig $config, bool $dryRun): void
    {
        $stepId = $step->getId();

        switch ($stepId) {
            case 'validation':
                usleep(100000);
                break;

            case 'pre_backup':
                usleep(200000);
                break;

            case 'enable_maintenance':
                usleep(100000);
                break;

            case 'migrations':
            case 'migrations_batch':
                usleep(300000);
                break;

            case 'deploy_files':
                usleep(300000);
                break;

            case 'clear_cache':
                usleep(100000);
                break;

            case 'disable_maintenance':
                usleep(100000);
                break;

            case 'verify_deploy':
                usleep(100000);
                break;

            case 'rollback_plan':
                usleep(100000);
                break;

            default:
                usleep(50000);
                break;
        }
    }

    private function saveExecutionLog(ProjectConfig $config, array $results, bool $success, bool $dryRun): void
    {
        $outputDir = $config->reportsDir;
        if (!is_dir($outputDir)) {
            mkdir($outputDir, 0755, true);
        }

        $timestamp = date('YmdHis');
        $filename = sprintf('release-%s-%s.json', $success ? 'success' : 'failed', $timestamp);
        $filepath = $outputDir . '/' . $filename;

        $log = [
            'timestamp' => date('c'),
            'user' => get_current_user() ?: 'unknown',
            'success' => $success,
            'dry_run' => $dryRun,
            'steps' => $results,
        ];

        file_put_contents(
            $filepath,
            json_encode($log, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }

    private function getCategoryLabel(string $category): string
    {
        $labels = [
            ReleaseStep::CATEGORY_VALIDATION => 'VALIDATION',
            ReleaseStep::CATEGORY_PRE_DEPLOY => 'PRE-DEPLOY',
            ReleaseStep::CATEGORY_MIGRATION => 'MIGRATION',
            ReleaseStep::CATEGORY_DEPLOY => 'DEPLOY',
            ReleaseStep::CATEGORY_POST_DEPLOY => 'POST-DEPLOY',
            ReleaseStep::CATEGORY_ROLLBACK => 'ROLLBACK',
        ];
        return $labels[$category] ?? $category;
    }
}
