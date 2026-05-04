<?php

declare(strict_types=1);

namespace DeployFlow\Command;

use DeployFlow\Config\ProjectConfig;
use DeployFlow\Parser\ComposerParser;
use DeployFlow\Parser\MigrationParser;
use DeployFlow\Parser\ReleaseConfigParser;
use DeployFlow\Builder\ProjectBuilder;
use DeployFlow\Builder\BuildResult;
use DeployFlow\Exception\DeployFlowException;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

class BuildCommand extends Command
{
    protected static $defaultName = 'build';

    protected function configure(): void
    {
        $this
            ->setDescription('Build the project into a release package')
            ->setHelp('This command creates a tar or zip archive, manifest.json, and checksums.txt for release')
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
                InputOption::VALUE_REQUIRED,
                'Output format: tar, zip, or both',
                'tar'
            )
            ->addOption(
                'release-version',
                null,
                InputOption::VALUE_REQUIRED,
                'Custom version string (auto-generated if not provided)'
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
        $format = $input->getOption('format');
        $customVersion = $input->getOption('release-version');
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
                    'error' => $e->getMessage(),
                ]));
            } else {
                $io->error('Failed to parse composer files: ' . $e->getMessage());
            }
            return Command::FAILURE;
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

        $builder = new ProjectBuilder(
            $config,
            $releaseConfig,
            $composerParser,
            $migrationParser
        );

        if ($customVersion) {
            $builder->setVersion($customVersion);
        }

        if (!$asJson) {
            $io->title('Building Release Package');
            $io->text('Project: ' . $projectDir);
            $io->text('Format: ' . $format);
            $io->text('Version: ' . $builder->getVersion());
            $io->newLine();
        }

        try {
            $result = $builder->build();
        } catch (DeployFlowException $e) {
            if ($asJson) {
                $output->writeln(json_encode([
                    'success' => false,
                    'error' => $e->getMessage(),
                ]));
            } else {
                $io->error('Build failed: ' . $e->getMessage());
            }
            return Command::FAILURE;
        }

        if ($asJson) {
            $output->writeln(json_encode($result->toArray(), JSON_PRETTY_PRINT));
            return $result->isSuccess() ? Command::SUCCESS : Command::FAILURE;
        }

        $io->section('Build Results');

        $io->definitionList(
            ['Status' => $result->isSuccess() ? '<fg=green>✓ SUCCESS</>' : '<fg=red>✗ FAILED</>'],
            ['Version' => $result->getVersion()],
            ['Files Included' => $result->getFileCount()],
            ['Build Directory' => $result->getBuildDir()],
        );

        if ($result->isSuccess()) {
            $io->section('Generated Artifacts');

            $rows = [];
            if ($result->getTarPath()) {
                $rows[] = [
                    '📦',
                    'Tar Archive',
                    basename($result->getTarPath()),
                    $result->getFormattedSize($result->getTarSize()),
                ];
            }
            if ($result->getZipPath()) {
                $rows[] = [
                    '📦',
                    'Zip Archive',
                    basename($result->getZipPath()),
                    $result->getFormattedSize($result->getZipSize()),
                ];
            }
            if ($result->getManifestPath()) {
                $rows[] = [
                    '📄',
                    'Manifest',
                    basename($result->getManifestPath()),
                    '-',
                ];
            }
            if ($result->getChecksumsPath()) {
                $rows[] = [
                    '🔐',
                    'Checksums',
                    basename($result->getChecksumsPath()),
                    '-',
                ];
            }

            $io->table(['', 'Type', 'Filename', 'Size'], $rows);

            $io->success('Build completed successfully!');
            $io->text('');
            $io->text('Next steps:');
            $io->listing([
                'Verify checksums: `shasum -c checksums.txt`',
                'Review manifest.json for package contents',
                'Run `deployflow plan` to generate release plan',
            ]);

            return Command::SUCCESS;
        }

        if ($result->getErrorMessage()) {
            $io->error('Build error: ' . $result->getErrorMessage());
        }

        return Command::FAILURE;
    }
}
