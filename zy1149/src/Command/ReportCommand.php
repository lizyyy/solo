<?php

declare(strict_types=1);

namespace DeployFlow\Command;

use DeployFlow\Config\ProjectConfig;
use DeployFlow\Parser\ComposerParser;
use DeployFlow\Parser\EnvMatrixParser;
use DeployFlow\Parser\MigrationParser;
use DeployFlow\Parser\ReleaseConfigParser;
use DeployFlow\Parser\DeployTargetsParser;
use DeployFlow\Report\ReportGenerator;
use DeployFlow\Validator\ProjectValidator;
use DeployFlow\Validator\ValidatorResult;
use DeployFlow\Builder\BuildResult;
use DeployFlow\Release\ReleasePlanner;
use DeployFlow\Release\ReleasePlan;
use DeployFlow\Rollback\RollbackManager;
use DeployFlow\Rollback\RollbackPlan;
use DeployFlow\Exception\DeployFlowException;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

class ReportCommand extends Command
{
    protected static $defaultName = 'report';

    protected function configure(): void
    {
        $this
            ->setDescription('Generate release reports in multiple formats')
            ->setHelp('This command generates release reports in Markdown, JSON, and CSV formats')
            ->addOption(
                'project-dir',
                'd',
                InputOption::VALUE_REQUIRED,
                'Project directory path',
                getcwd()
            )
            ->addOption(
                'format',
                'f',
                InputOption::VALUE_REQUIRED | InputOption::VALUE_IS_ARRAY,
                'Output format(s): markdown, json, csv (can specify multiple)',
                ['markdown']
            )
            ->addOption(
                'output',
                'o',
                InputOption::VALUE_REQUIRED,
                'Output directory or specific filename',
            )
            ->addOption(
                'include',
                'i',
                InputOption::VALUE_REQUIRED | InputOption::VALUE_IS_ARRAY,
                'Include specific sections: validation, build, plan, rollback, all',
                ['all']
            )
            ->addOption(
                'target',
                't',
                InputOption::VALUE_REQUIRED,
                'Target environment for report context',
                'production'
            )
            ->addOption(
                'build-version',
                'b',
                InputOption::VALUE_REQUIRED,
                'Build version to include in report'
            )
            ->addOption(
                'json',
                'j',
                InputOption::VALUE_NONE,
                'Output report metadata as JSON to stdout'
            )
            ->addOption(
                'stdout',
                null,
                InputOption::VALUE_NONE,
                'Output report content directly to stdout instead of file'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $projectDir = rtrim($input->getOption('project-dir'), '/');
        $formats = $input->getOption('format');
        $outputPath = $input->getOption('output');
        $includes = $input->getOption('include');
        $target = $input->getOption('target');
        $buildVersion = $input->getOption('build-version');
        $asJson = $input->getOption('json');
        $toStdout = $input->getOption('stdout');

        $config = new ProjectConfig($projectDir);

        $includeValidation = in_array('all', $includes) || in_array('validation', $includes);
        $includeBuild = in_array('all', $includes) || in_array('build', $includes);
        $includePlan = in_array('all', $includes) || in_array('plan', $includes);
        $includeRollback = in_array('all', $includes) || in_array('rollback', $includes);

        $validatorResult = null;
        $buildResult = null;
        $releasePlan = null;
        $rollbackPlan = null;

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
                $io->warning('Migrations not found: ' . $e->getMessage());
            }
        }

        $releaseConfig = new ReleaseConfigParser($config->releaseYamlPath);
        $releaseConfig->parse();

        $deployTargets = new DeployTargetsParser($config->deployTargetsPath);
        $deployTargets->parse();

        if ($includeValidation) {
            if (!$asJson) {
                $io->text('Gathering validation data...');
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
            $validatorResult = $validator->validate();
        }

        if ($includeBuild && $buildVersion) {
            if (!$asJson) {
                $io->text('Loading build data...');
            }
            $buildResult = $this->loadBuildResult($config, $buildVersion);
        }

        if ($includePlan) {
            if (!$asJson) {
                $io->text('Generating release plan...');
            }
            $planner = new ReleasePlanner(
                $config,
                $releaseConfig,
                $migrationParser,
                $deployTargets
            );
            $planner->setTargetEnvironment($target);
            if ($validatorResult) {
                $planner->setValidationResult($validatorResult);
            }
            if ($buildResult) {
                $planner->setBuildResult($buildResult);
            }
            $releasePlan = $planner->plan();
        }

        if ($includeRollback) {
            if (!$asJson) {
                $io->text('Preparing rollback analysis...');
            }
            $rollbackManager = new RollbackManager(
                $config,
                $releaseConfig,
                $migrationParser,
                $deployTargets
            );
            $rollbackManager->setTargetEnvironment($target);
            try {
                $rollbackPlan = $rollbackManager->prepareRollback($buildVersion ?? 'analysis');
            } catch (DeployFlowException $e) {
                if (!$asJson) {
                    $io->warning('Could not prepare rollback plan: ' . $e->getMessage());
                }
            }
        }

        $generator = new ReportGenerator($config);

        if ($validatorResult) {
            $generator->setValidatorResult($validatorResult);
        }
        if ($buildResult) {
            $generator->setBuildResult($buildResult);
        }
        if ($releasePlan) {
            $generator->setReleasePlan($releasePlan);
        }
        if ($rollbackPlan) {
            $generator->setRollbackPlan($rollbackPlan);
        }

        $generator->setExtraData([
            'target_environment' => $target,
            'generated_by' => get_current_user() ?: 'unknown',
            'project_root' => $config->projectRoot,
        ]);

        if (!$asJson) {
            $io->section('Generating Reports');
        }

        $outputDir = $outputPath ?: $config->reportsDir;
        if (!is_dir($outputDir) && !$toStdout) {
            mkdir($outputDir, 0755, true);
        }

        $generatedFiles = [];
        $timestamp = date('YmdHis');

        foreach ($formats as $format) {
            $format = strtolower($format);
            $ext = ($format === 'markdown' || $format === 'md') ? 'md' : $format;
            $filename = sprintf('release-report-%s-%s.%s', $target, $timestamp, $ext);

            if ($toStdout) {
                $this->outputReportToStdout($generator, $format, $output);
            } else {
                $filepath = $outputDir . '/' . $filename;
                try {
                    $generator->generate($format, $filepath);
                    $generatedFiles[] = [
                        'format' => $format,
                        'path' => $filepath,
                        'size' => filesize($filepath),
                    ];
                    if (!$asJson) {
                        $io->text('  ✓ ' . $filename);
                    }
                } catch (DeployFlowException $e) {
                    if ($asJson) {
                        $output->writeln(json_encode([
                            'success' => false,
                            'error' => 'Failed to generate ' . $format . ' report: ' . $e->getMessage(),
                        ]));
                    } else {
                        $io->error('Failed to generate ' . $format . ' report: ' . $e->getMessage());
                    }
                    return Command::FAILURE;
                }
            }
        }

        if ($asJson) {
            $result = [
                'success' => true,
                'generated_at' => date('c'),
                'target' => $target,
                'formats' => $formats,
                'includes' => $includes,
            ];
            if ($toStdout) {
                $result['output'] = 'stdout';
            } else {
                $result['output_directory'] = $outputDir;
                $result['files'] = $generatedFiles;
            }
            $output->writeln(json_encode($result, JSON_PRETTY_PRINT));
            return Command::SUCCESS;
        }

        if ($toStdout) {
            return Command::SUCCESS;
        }

        $io->section('Report Summary');

        $rows = [];
        foreach ($generatedFiles as $file) {
            $rows[] = [
                strtoupper($file['format']),
                basename($file['path']),
                $this->formatBytes($file['size']),
            ];
        }

        $io->table(['Format', 'Filename', 'Size'], $rows);

        $io->success('Reports generated successfully!');
        $io->text('');
        $io->text('Reports saved to: ' . $outputDir);

        return Command::SUCCESS;
    }

    private function outputReportToStdout(ReportGenerator $generator, string $format, OutputInterface $output): void
    {
        $tempFile = sys_get_temp_dir() . '/deployflow-report-' . uniqid() . '.tmp';
        $generator->generate($format, $tempFile);

        if (file_exists($tempFile)) {
            $output->write(file_get_contents($tempFile));
            unlink($tempFile);
        }
    }

    private function loadBuildResult(ProjectConfig $config, string $version): ?object
    {
        $buildDir = $config->buildsDir . '/' . $version;
        $manifestPath = $buildDir . '/manifest.json';

        if (!file_exists($manifestPath)) {
            return null;
        }

        $manifest = json_decode(file_get_contents($manifestPath), true);
        if (!$manifest) {
            return null;
        }

        $tarPath = $buildDir . '/release.tar.gz';
        $zipPath = $buildDir . '/release.zip';
        $checksumsPath = $buildDir . '/checksums.txt';

        return new class ($version, $manifest, $buildDir, $tarPath, $zipPath, $checksumsPath) {
            private string $version;
            private array $manifest;
            private string $buildDir;
            private ?string $tarPath;
            private ?string $zipPath;
            private ?string $checksumsPath;

            public function __construct(
                string $version,
                array $manifest,
                string $buildDir,
                ?string $tarPath,
                ?string $zipPath,
                ?string $checksumsPath
            ) {
                $this->version = $version;
                $this->manifest = $manifest;
                $this->buildDir = $buildDir;
                $this->tarPath = file_exists($tarPath) ? $tarPath : null;
                $this->zipPath = file_exists($zipPath) ? $zipPath : null;
                $this->checksumsPath = file_exists($checksumsPath) ? $checksumsPath : null;
            }

            public function getVersion(): string
            {
                return $this->version;
            }

            public function getBuildDir(): string
            {
                return $this->buildDir;
            }

            public function isSuccess(): bool
            {
                return true;
            }

            public function getFileCount(): int
            {
                return $this->manifest['total_files'] ?? 0;
            }

            public function getSummary(): string
            {
                return 'Build ' . $this->version;
            }

            public function getErrorMessage(): ?string
            {
                return null;
            }

            public function getTarPath(): ?string
            {
                return $this->tarPath;
            }

            public function getTarSize(): int
            {
                return $this->tarPath ? filesize($this->tarPath) : 0;
            }

            public function getZipPath(): ?string
            {
                return $this->zipPath;
            }

            public function getZipSize(): int
            {
                return $this->zipPath ? filesize($this->zipPath) : 0;
            }

            public function getManifestPath(): ?string
            {
                return $this->buildDir . '/manifest.json';
            }

            public function getChecksumsPath(): ?string
            {
                return $this->checksumsPath;
            }

            public function getFormattedSize(int $size): string
            {
                $units = ['B', 'KB', 'MB', 'GB'];
                $bytes = max($size, 0);
                $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
                $pow = min($pow, count($units) - 1);
                $bytes /= (1 << (10 * $pow));
                return round($bytes, 2) . ' ' . $units[$pow];
            }

            public function toArray(): array
            {
                return [
                    'version' => $this->version,
                    'success' => true,
                    'file_count' => $this->getFileCount(),
                    'build_dir' => $this->buildDir,
                    'manifest' => $this->manifest,
                ];
            }
        };
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
