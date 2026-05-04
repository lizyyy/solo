<?php

declare(strict_types=1);

namespace DeployFlow\Rollback;

use DeployFlow\Config\ProjectConfig;
use DeployFlow\Parser\ReleaseConfigParser;
use DeployFlow\Parser\MigrationParser;
use DeployFlow\Parser\DeployTargetsParser;
use DeployFlow\Exception\DeployFlowException;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\Finder\Finder;
use PharData;
use ZipArchive;

class RollbackManager
{
    private ProjectConfig $config;
    private ReleaseConfigParser $releaseConfig;
    private MigrationParser $migrationParser;
    private DeployTargetsParser $deployTargets;
    private Filesystem $filesystem;
    private ?string $targetEnvironment = null;

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

    public function prepareRollback(string $version): RollbackPlan
    {
        $rollbackDir = $this->config->rollbackDir . '/' . $version;
        $this->filesystem->mkdir($rollbackDir);

        $plan = new RollbackPlan($version);
        $plan->setCreatedAt(date('c'));
        $plan->setRollbackDir($rollbackDir);

        $nonRollbackable = $this->migrationParser->getNonRollbackableMigrations();
        $irreversible = $this->migrationParser->getIrreversibleMigrations();

        if (!empty($nonRollbackable)) {
            $plan->addWarning(
                sprintf(
                    '%d migration(s) cannot be automatically rolled back',
                    count($nonRollbackable)
                )
            );
            foreach ($nonRollbackable as $m) {
                $plan->addNonRollbackableMigration($m);
            }
        }

        if (!empty($irreversible)) {
            $plan->addBlocker(
                sprintf(
                    '%d migration(s) are irreversible - full rollback not possible',
                    count($irreversible)
                )
            );
            foreach ($irreversible as $m) {
                $plan->addIrreversibleMigration($m);
            }
        }

        $this->generateRollbackInstructions($plan);
        $this->generateRollbackManifest($plan, $rollbackDir);
        $this->generateRollbackScript($plan, $rollbackDir);

        return $plan;
    }

    private function generateRollbackInstructions(RollbackPlan $plan): void
    {
        $steps = [];

        $steps[] = [
            'step' => 'verify_backup',
            'name' => 'Verify backup exists',
            'description' => 'Confirm that a complete backup of the current state exists before rolling back',
            'priority' => 'critical',
            'requires_confirmation' => true,
        ];

        $steps[] = [
            'step' => 'enable_maintenance',
            'name' => 'Enable maintenance mode',
            'description' => 'Put the application into maintenance mode before making changes',
            'priority' => 'high',
        ];

        $migrations = $this->migrationParser->getMigrations();
        if (!empty($migrations)) {
            $rollbackableMigrations = array_filter(
                $migrations,
                fn($m) => ($m['is_rollbackable'] ?? true) && !($m['is_irreversible'] ?? false)
            );

            if (!empty($rollbackableMigrations)) {
                $steps[] = [
                    'step' => 'rollback_migrations',
                    'name' => 'Rollback database migrations',
                    'description' => sprintf(
                        'Execute rollback for %d migration(s) in reverse order',
                        count($rollbackableMigrations)
                    ),
                    'priority' => 'critical',
                    'migrations' => array_values($rollbackableMigrations),
                    'requires_confirmation' => true,
                ];
            }
        }

        $steps[] = [
            'step' => 'restore_files',
            'name' => 'Restore previous release files',
            'description' => 'Restore files from the backup or previous release package',
            'priority' => 'critical',
        ];

        $steps[] = [
            'step' => 'clear_cache',
            'name' => 'Clear application cache',
            'description' => 'Clear all caches after restoring files',
            'priority' => 'high',
        ];

        $steps[] = [
            'step' => 'verify_rollback',
            'name' => 'Verify rollback',
            'description' => 'Verify the application is running correctly after rollback',
            'priority' => 'high',
        ];

        $steps[] = [
            'step' => 'disable_maintenance',
            'name' => 'Disable maintenance mode',
            'description' => 'Take the application out of maintenance mode',
            'priority' => 'high',
        ];

        $plan->setSteps($steps);
    }

    private function generateRollbackManifest(RollbackPlan $plan, string $rollbackDir): void
    {
        $migrations = $this->migrationParser->getMigrations();
        $nonRollbackable = $this->migrationParser->getNonRollbackableMigrations();
        $irreversible = $this->migrationParser->getIrreversibleMigrations();

        $manifest = [
            'rollback_version' => $plan->getVersion(),
            'created_at' => $plan->getCreatedAt(),
            'rollback_enabled' => $this->releaseConfig->isRollbackEnabled(),
            'keep_releases' => $this->releaseConfig->getKeepReleases(),
            'target_environment' => $this->targetEnvironment,
            'migrations' => [
                'total' => count($migrations),
                'rollbackable' => count($migrations) - count($nonRollbackable),
                'non_rollbackable' => count($nonRollbackable),
                'irreversible' => count($irreversible),
                'list' => array_map(function ($m) {
                    return [
                        'filename' => $m['filename'],
                        'version' => $m['version'],
                        'name' => $m['name'],
                        'is_rollbackable' => $m['is_rollbackable'],
                        'is_irreversible' => $m['is_irreversible'],
                        'description' => $m['description'] ?? '',
                    ];
                }, $migrations),
            ],
            'steps' => $plan->getSteps(),
            'warnings' => $plan->getWarnings(),
            'blockers' => $plan->getBlockers(),
        ];

        $manifestPath = $rollbackDir . '/rollback-manifest.json';
        $this->filesystem->dumpFile(
            $manifestPath,
            json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        $plan->setManifestPath($manifestPath);
    }

    private function generateRollbackScript(RollbackPlan $plan, string $rollbackDir): void
    {
        $scriptPath = $rollbackDir . '/rollback.sh';

        $script = <<<'SCRIPT'
#!/bin/bash
# Rollback Script
# Generated by DeployFlow

set -e

echo "========================================"
echo "DeployFlow Rollback Script"
echo "========================================"
echo ""

SCRIPT;

        $script .= "ROLLBACK_VERSION=\"{$plan->getVersion()}\"\n";
        $script .= "CREATED_AT=\"{$plan->getCreatedAt()}\"\n\n";

        $script .= <<<'SCRIPT'
echo "Rollback Version: $ROLLBACK_VERSION"
echo "Created At: $CREATED_AT"
echo ""

# Check for rollback manifest
if [ ! -f "rollback-manifest.json" ]; then
    echo "ERROR: rollback-manifest.json not found!"
    exit 1
fi

echo "Rollback Steps:"
echo ""

SCRIPT;

        $stepNum = 1;
        foreach ($plan->getSteps() as $step) {
            $name = $step['name'] ?? 'Unknown step';
            $desc = $step['description'] ?? '';
            $priority = $step['priority'] ?? 'medium';
            $needsConfirm = $step['requires_confirmation'] ?? false;

            $script .= "echo \"$stepNum. [$priority] $name\"\n";
            if ($desc) {
                $script .= "echo \"   $desc\"\n";
            }
            if ($needsConfirm) {
                $script .= "echo \"   [REQUIRES CONFIRMATION]\"\n";
            }
            $script .= "echo \"\"\n";
            $stepNum++;
        }

        $warnings = $plan->getWarnings();
        if (!empty($warnings)) {
            $script .= "echo \"========================================\"\n";
            $script .= "echo \"WARNINGS:\"\n";
            $script .= "echo \"========================================\"\n";
            foreach ($warnings as $warning) {
                $script .= "echo \"⚠️  $warning\"\n";
            }
            $script .= "echo \"\"\n";
        }

        $blockers = $plan->getBlockers();
        if (!empty($blockers)) {
            $script .= "echo \"========================================\"\n";
            $script .= "echo \"BLOCKERS - Automatic rollback NOT possible:\"\n";
            $script .= "echo \"========================================\"\n";
            foreach ($blockers as $blocker) {
                $script .= "echo \"🚫 $blocker\"\n";
            }
            $script .= "echo \"\"\n";
            $script .= "echo \"Manual intervention required. Exiting.\"\n";
            $script .= "exit 1\n";
        } else {
            $script .= <<<'SCRIPT'
echo "========================================"
echo "Ready to proceed with rollback?"
echo "========================================"
echo ""
read -p "Type 'ROLLBACK' to confirm: " confirmation

if [ "$confirmation" != "ROLLBACK" ]; then
    echo "Rollback cancelled."
    exit 0
fi

echo ""
echo "Starting rollback process..."
echo ""

# Placeholder - actual rollback logic would be implemented here
echo "Note: This is a placeholder script."
echo "Actual rollback operations need to be implemented based on your deployment setup."
echo ""

echo "Rollback preparation complete."
echo "Please review rollback-manifest.json for details."
SCRIPT;
        }

        $script .= "\n";

        $this->filesystem->dumpFile($scriptPath, $script);
        chmod($scriptPath, 0755);

        $plan->setScriptPath($scriptPath);
    }

    public function listAvailableBuilds(): array
    {
        $buildsDir = $this->config->buildsDir;
        $builds = [];

        if (!is_dir($buildsDir)) {
            return $builds;
        }

        $finder = new Finder();
        $finder->directories()->in($buildsDir)->depth('== 0')->sortByModifiedTime();

        foreach ($finder as $dir) {
            $version = $dir->getFilename();
            $manifestPath = $dir->getRealPath() . '/manifest.json';
            $checksumsPath = $dir->getRealPath() . '/checksums.txt';

            $buildInfo = [
                'version' => $version,
                'path' => $dir->getRealPath(),
                'modified_at' => date('c', $dir->getMTime()),
                'has_manifest' => file_exists($manifestPath),
                'has_checksums' => file_exists($checksumsPath),
            ];

            if (file_exists($manifestPath)) {
                $manifest = json_decode(file_get_contents($manifestPath), true);
                if ($manifest) {
                    $buildInfo['project'] = $manifest['project'] ?? 'unknown';
                    $buildInfo['built_at'] = $manifest['built_at'] ?? null;
                    $buildInfo['total_files'] = $manifest['total_files'] ?? 0;
                }
            }

            $builds[] = $buildInfo;
        }

        return array_reverse($builds);
    }

    public function createRollbackPackage(string $buildVersion, string $outputPath): bool
    {
        $buildDir = $this->config->buildsDir . '/' . $buildVersion;

        if (!is_dir($buildDir)) {
            throw DeployFlowException::rollbackError(
                "Build directory not found: {$buildDir}",
                $buildVersion
            );
        }

        $manifestPath = $buildDir . '/manifest.json';
        if (!file_exists($manifestPath)) {
            throw DeployFlowException::rollbackError(
                "manifest.json not found in build: {$buildVersion}",
                $buildVersion
            );
        }

        $extension = pathinfo($outputPath, PATHINFO_EXTENSION);

        if ($extension === 'zip' || $extension === 'phar') {
            return $this->createZipRollbackPackage($buildDir, $outputPath);
        } else {
            return $this->createTarRollbackPackage($buildDir, $outputPath);
        }
    }

    private function createTarRollbackPackage(string $buildDir, string $outputPath): bool
    {
        $tarPath = sys_get_temp_dir() . '/rollback-' . uniqid() . '.tar';
        $phar = new PharData($tarPath);

        $finder = new Finder();
        $finder->files()->in($buildDir);

        foreach ($finder as $file) {
            $relativePath = $file->getRelativePathname();
            $phar->addFile($file->getRealPath(), 'rollback-package/' . $relativePath);
        }

        $phar->compress(PharData::GZ);
        unlink($tarPath);

        $gzipPath = $tarPath . '.gz';
        if (file_exists($gzipPath)) {
            $this->filesystem->rename($gzipPath, $outputPath, true);
            return true;
        }

        return false;
    }

    private function createZipRollbackPackage(string $buildDir, string $outputPath): bool
    {
        $zip = new ZipArchive();

        if ($zip->open($outputPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return false;
        }

        $finder = new Finder();
        $finder->files()->in($buildDir);

        foreach ($finder as $file) {
            $relativePath = $file->getRelativePathname();
            $zip->addFile($file->getRealPath(), 'rollback-package/' . $relativePath);
        }

        $zip->close();

        return file_exists($outputPath);
    }
}
