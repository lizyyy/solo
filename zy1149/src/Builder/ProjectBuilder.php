<?php

declare(strict_types=1);

namespace DeployFlow\Builder;

use DeployFlow\Config\ProjectConfig;
use DeployFlow\Parser\ReleaseConfigParser;
use DeployFlow\Parser\ComposerParser;
use DeployFlow\Parser\MigrationParser;
use DeployFlow\Exception\DeployFlowException;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\Finder\Finder;
use Phar;
use PharData;
use ZipArchive;

class ProjectBuilder
{
    private ProjectConfig $config;
    private ReleaseConfigParser $releaseConfig;
    private ComposerParser $composerParser;
    private MigrationParser $migrationParser;
    private Filesystem $filesystem;
    private string $version;
    private array $buildManifest = [];
    private array $checksums = [];

    public function __construct(
        ProjectConfig $config,
        ReleaseConfigParser $releaseConfig,
        ComposerParser $composerParser,
        MigrationParser $migrationParser
    ) {
        $this->config = $config;
        $this->releaseConfig = $releaseConfig;
        $this->composerParser = $composerParser;
        $this->migrationParser = $migrationParser;
        $this->filesystem = new Filesystem();
        $this->version = $config->generateBuildVersion();
    }

    public function setVersion(string $version): void
    {
        $this->version = $version;
    }

    public function getVersion(): string
    {
        return $this->version;
    }

    public function build(): BuildResult
    {
        $buildDir = $this->config->buildsDir . '/' . $this->version;
        
        $this->ensureOutputDirectories();
        $this->filesystem->mkdir($buildDir);

        $buildResult = new BuildResult($this->version, $buildDir);

        try {
            $filesToInclude = $this->collectFiles();
            $buildResult->setFileCount(count($filesToInclude));

            $format = $this->releaseConfig->getOutputFormat();
            
            if ($format === 'tar' || $format === 'both') {
                $tarPath = $this->buildTarArchive($filesToInclude, $buildDir);
                $buildResult->setTarPath($tarPath);
                $buildResult->setTarSize(filesize($tarPath));
            }

            if ($format === 'zip' || $format === 'both') {
                $zipPath = $this->buildZipArchive($filesToInclude, $buildDir);
                $buildResult->setZipPath($zipPath);
                $buildResult->setZipSize(filesize($zipPath));
            }

            $this->generateManifest($buildDir, $filesToInclude);
            $this->generateChecksums($buildDir, $buildResult);

            $buildResult->setManifestPath($buildDir . '/manifest.json');
            $buildResult->setChecksumsPath($buildDir . '/checksums.txt');
            $buildResult->setSuccess(true);

        } catch (\Exception $e) {
            $buildResult->setSuccess(false);
            $buildResult->setErrorMessage($e->getMessage());
            throw DeployFlowException::buildError(
                'Build failed: ' . $e->getMessage(),
                "Version: {$this->version}"
            );
        }

        return $buildResult;
    }

    private function ensureOutputDirectories(): void
    {
        $dirs = [
            $this->config->outputDir,
            $this->config->buildsDir,
            $this->config->reportsDir,
            $this->config->rollbackDir,
        ];

        foreach ($dirs as $dir) {
            if (!$this->filesystem->exists($dir)) {
                $this->filesystem->mkdir($dir);
            }
        }
    }

    private function collectFiles(): array
    {
        $includePatterns = $this->releaseConfig->getIncludePaths();
        $excludePatterns = $this->releaseConfig->getExcludePaths();

        $files = [];
        $projectRoot = $this->config->projectRoot;

        foreach ($includePatterns as $pattern) {
            $fullPath = $projectRoot . '/' . $pattern;
            $pattern = rtrim($pattern, '/');

            if (is_file($fullPath)) {
                if (!$this->shouldExclude($pattern, $excludePatterns)) {
                    $files[] = [
                        'relative' => $pattern,
                        'absolute' => $fullPath,
                        'type' => 'file',
                    ];
                }
            } elseif (is_dir($fullPath)) {
                $finder = new Finder();
                $finder->files()->in($fullPath)->ignoreDotFiles(false);

                foreach ($finder as $file) {
                    $relativePath = $pattern . '/' . $file->getRelativePathname();
                    if (!$this->shouldExclude($relativePath, $excludePatterns)) {
                        $files[] = [
                            'relative' => $relativePath,
                            'absolute' => $file->getRealPath(),
                            'type' => 'file',
                        ];
                    }
                }
            }
        }

        $uniqueFiles = [];
        foreach ($files as $file) {
            $uniqueFiles[$file['relative']] = $file;
        }

        return array_values($uniqueFiles);
    }

    private function shouldExclude(string $path, array $excludePatterns): bool
    {
        foreach ($excludePatterns as $pattern) {
            $pattern = rtrim($pattern, '/');
            
            if ($path === $pattern) {
                return true;
            }
            
            if (str_starts_with($path, $pattern . '/')) {
                return true;
            }

            if (str_contains($pattern, '*')) {
                $regex = $this->globToRegex($pattern);
                if (preg_match($regex, $path)) {
                    return true;
                }
            }
        }

        return false;
    }

    private function globToRegex(string $pattern): string
    {
        $regex = preg_quote($pattern, '#');
        $regex = str_replace('\*', '.*', $regex);
        return '#^' . $regex . '$#';
    }

    private function buildTarArchive(array $files, string $buildDir): string
    {
        $tarPath = $buildDir . '/release-' . $this->version . '.tar';
        $phar = new PharData($tarPath);

        $baseDir = 'release-' . $this->version;

        foreach ($files as $file) {
            $relative = $file['relative'];
            $absolute = $file['absolute'];
            
            $phar->addFile($absolute, $baseDir . '/' . $relative);
            
            $this->checksums[$relative] = hash_file('sha256', $absolute);
            $this->buildManifest['files'][] = [
                'path' => $relative,
                'size' => filesize($absolute),
                'checksum' => $this->checksums[$relative],
                'modified_at' => date('c', filemtime($absolute)),
            ];
        }

        $phar->compress(Phar::GZ);
        unlink($tarPath);
        
        $gzipPath = $tarPath . '.gz';
        if (!file_exists($gzipPath)) {
            throw new \RuntimeException('Failed to create gzipped tar archive');
        }

        return $gzipPath;
    }

    private function buildZipArchive(array $files, string $buildDir): string
    {
        $zipPath = $buildDir . '/release-' . $this->version . '.zip';
        $zip = new ZipArchive();

        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException("Cannot open ZIP file: {$zipPath}");
        }

        $baseDir = 'release-' . $this->version;

        foreach ($files as $file) {
            $relative = $file['relative'];
            $absolute = $file['absolute'];

            $zip->addFile($absolute, $baseDir . '/' . $relative);

            if (!isset($this->checksums[$relative])) {
                $this->checksums[$relative] = hash_file('sha256', $absolute);
            }
        }

        $zip->close();

        if (!file_exists($zipPath)) {
            throw new \RuntimeException('Failed to create ZIP archive');
        }

        return $zipPath;
    }

    private function generateManifest(string $buildDir, array $files): void
    {
        $composerInfo = [
            'json_hash' => hash_file('md5', $this->config->composerJsonPath),
            'lock_hash' => $this->composerParser->getLockHash(),
            'php_version' => $this->composerParser->getPhpVersion(),
            'package_count' => count($this->composerParser->getLockPackages()),
            'dev_package_count' => count($this->composerParser->getLockPackagesDev()),
        ];

        $migrationsInfo = [
            'count' => $this->migrationParser->getTotalCount(),
            'irreversible_count' => count($this->migrationParser->getIrreversibleMigrations()),
            'non_rollbackable_count' => count($this->migrationParser->getNonRollbackableMigrations()),
            'list' => array_map(function ($m) {
                return [
                    'filename' => $m['filename'],
                    'version' => $m['version'],
                    'name' => $m['name'],
                    'is_rollbackable' => $m['is_rollbackable'],
                    'is_irreversible' => $m['is_irreversible'],
                    'checksum' => $m['checksum'],
                ];
            }, $this->migrationParser->getMigrations()),
        ];

        $manifest = [
            'version' => $this->version,
            'project' => $this->releaseConfig->getProjectName(),
            'project_version' => $this->releaseConfig->getProjectVersion(),
            'built_at' => date('c'),
            'built_by' => get_current_user() ?: 'unknown',
            'php_version_built_with' => PHP_VERSION,
            'composer' => $composerInfo,
            'migrations' => $migrationsInfo,
            'files' => $this->buildManifest['files'] ?? [],
            'total_files' => count($files),
            'format' => $this->releaseConfig->getOutputFormat(),
        ];

        $manifestPath = $buildDir . '/manifest.json';
        $this->filesystem->dumpFile(
            $manifestPath,
            json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        $this->checksums['manifest.json'] = hash_file('sha256', $manifestPath);
    }

    private function generateChecksums(string $buildDir, BuildResult $buildResult): void
    {
        $checksumsPath = $buildDir . '/checksums.txt';
        $lines = [];

        foreach ($this->checksums as $file => $checksum) {
            $lines[] = "{$checksum}  {$file}";
        }

        if ($buildResult->getTarPath() && file_exists($buildResult->getTarPath())) {
            $tarName = basename($buildResult->getTarPath());
            $tarChecksum = hash_file('sha256', $buildResult->getTarPath());
            $lines[] = "{$tarChecksum}  {$tarName}";
        }

        if ($buildResult->getZipPath() && file_exists($buildResult->getZipPath())) {
            $zipName = basename($buildResult->getZipPath());
            $zipChecksum = hash_file('sha256', $buildResult->getZipPath());
            $lines[] = "{$zipChecksum}  {$zipName}";
        }

        sort($lines);

        $content = implode("\n", $lines) . "\n";
        $this->filesystem->dumpFile($checksumsPath, $content);
    }
}
