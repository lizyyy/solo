<?php

declare(strict_types=1);

namespace DeployFlow\Command;

use DeployFlow\Config\ProjectConfig;
use DeployFlow\Parser\ComposerParser;
use DeployFlow\Parser\EnvMatrixParser;
use DeployFlow\Parser\MigrationParser;
use DeployFlow\Parser\ReleaseConfigParser;
use DeployFlow\Parser\DeployTargetsParser;
use DeployFlow\Validator\ProjectValidator;
use DeployFlow\Validator\ValidatorResult;
use DeployFlow\Exception\DeployFlowException;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

class ValidateCommand extends Command
{
    protected static $defaultName = 'validate';

    protected function configure(): void
    {
        $this
            ->setDescription('Validate the project configuration and structure')
            ->setHelp('This command validates composer.json, env matrix, migrations, directory permissions, and sensitive configs')
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
                'Target environment to validate against',
                'production'
            )
            ->addOption(
                'json',
                'j',
                InputOption::VALUE_NONE,
                'Output results as JSON'
            )
            ->addOption(
                'only',
                null,
                InputOption::VALUE_REQUIRED | InputOption::VALUE_IS_ARRAY,
                'Run only specific validation categories'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $projectDir = rtrim($input->getOption('project-dir'), '/');
        $target = $input->getOption('target');
        $asJson = $input->getOption('json');
        $onlyCategories = $input->getOption('only');

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
                    'error' => $e->getMessage(),
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

        $result = $validator->validate();

        if ($asJson) {
            $output->writeln(json_encode($result->toArray(), JSON_PRETTY_PRINT));
            return $result->isPassed() ? Command::SUCCESS : Command::FAILURE;
        }

        $io->title('Validation Results');

        $counts = $result->getCounts();
        
        $io->definitionList(
            ['Status' => $result->isPassed() ? '<fg=green>✓ PASSED</>' : '<fg=red>✗ FAILED</>'],
            ['Has Blockers' => $result->hasBlockers() ? '<fg=red>✗ Yes</>' : '<fg=green>✓ No</>'],
            ['Total Issues' => $counts['total']],
            ['  Blockers' => $counts['blockers']],
            ['  Errors' => $counts['errors']],
            ['  Warnings' => $counts['warnings']],
            ['  Infos' => $counts['infos']],
        );

        $issues = $result->getIssues();
        if (!empty($issues)) {
            $io->section('Issues Details');

            $rows = [];
            foreach ($issues as $issue) {
                $severityIcon = $this->getSeverityIcon($issue['severity']);
                $file = $issue['file'] ?? '-';
                if ($issue['line'] ?? null) {
                    $file .= ':' . $issue['line'];
                }

                $rows[] = [
                    $severityIcon,
                    ucfirst($issue['severity']),
                    $issue['category'] ?? 'N/A',
                    $issue['message'] ?? 'N/A',
                    $file,
                ];
            }

            $io->table(
                ['', 'Severity', 'Category', 'Message', 'File'],
                $rows
            );
        }

        if ($result->hasBlockers()) {
            $io->error('Validation FAILED - blockers detected that must be resolved before release');
            return Command::FAILURE;
        }

        if (!$result->isPassed()) {
            $io->warning('Validation completed with errors - review and fix before release');
            return Command::FAILURE;
        }

        $io->success('All validations passed!');
        return Command::SUCCESS;
    }

    private function getSeverityIcon(string $severity): string
    {
        $icons = [
            ValidatorResult::SEVERITY_BLOCKER => '🚫',
            ValidatorResult::SEVERITY_ERROR => '❌',
            ValidatorResult::SEVERITY_WARNING => '⚠️',
            ValidatorResult::SEVERITY_INFO => 'ℹ️',
        ];
        return $icons[$severity] ?? '•';
    }
}
