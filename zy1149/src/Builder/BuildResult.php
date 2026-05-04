<?php

declare(strict_types=1);

namespace DeployFlow\Builder;

class BuildResult
{
    private string $version;
    private string $buildDir;
    private bool $success = false;
    private ?string $errorMessage = null;
    private int $fileCount = 0;
    private ?string $tarPath = null;
    private ?int $tarSize = null;
    private ?string $zipPath = null;
    private ?int $zipSize = null;
    private ?string $manifestPath = null;
    private ?string $checksumsPath = null;

    public function __construct(string $version, string $buildDir)
    {
        $this->version = $version;
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

    public function isSuccess(): bool
    {
        return $this->success;
    }

    public function setSuccess(bool $success): void
    {
        $this->success = $success;
    }

    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    public function setErrorMessage(?string $errorMessage): void
    {
        $this->errorMessage = $errorMessage;
    }

    public function getFileCount(): int
    {
        return $this->fileCount;
    }

    public function setFileCount(int $fileCount): void
    {
        $this->fileCount = $fileCount;
    }

    public function getTarPath(): ?string
    {
        return $this->tarPath;
    }

    public function setTarPath(?string $tarPath): void
    {
        $this->tarPath = $tarPath;
    }

    public function getTarSize(): ?int
    {
        return $this->tarSize;
    }

    public function setTarSize(?int $tarSize): void
    {
        $this->tarSize = $tarSize;
    }

    public function getZipPath(): ?string
    {
        return $this->zipPath;
    }

    public function setZipPath(?string $zipPath): void
    {
        $this->zipPath = $zipPath;
    }

    public function getZipSize(): ?int
    {
        return $this->zipSize;
    }

    public function setZipSize(?int $zipSize): void
    {
        $this->zipSize = $zipSize;
    }

    public function getManifestPath(): ?string
    {
        return $this->manifestPath;
    }

    public function setManifestPath(?string $manifestPath): void
    {
        $this->manifestPath = $manifestPath;
    }

    public function getChecksumsPath(): ?string
    {
        return $this->checksumsPath;
    }

    public function setChecksumsPath(?string $checksumsPath): void
    {
        $this->checksumsPath = $checksumsPath;
    }

    public function toArray(): array
    {
        return [
            'version' => $this->version,
            'build_dir' => $this->buildDir,
            'success' => $this->success,
            'error_message' => $this->errorMessage,
            'file_count' => $this->fileCount,
            'tar_path' => $this->tarPath,
            'tar_size' => $this->tarSize,
            'zip_path' => $this->zipPath,
            'zip_size' => $this->zipSize,
            'manifest_path' => $this->manifestPath,
            'checksums_path' => $this->checksumsPath,
        ];
    }

    public function getFormattedSize(?int $bytes): string
    {
        if ($bytes === null) {
            return 'N/A';
        }

        $units = ['B', 'KB', 'MB', 'GB'];
        $i = 0;

        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }

        return sprintf('%.2f %s', $bytes, $units[$i]);
    }

    public function getSummary(): string
    {
        if (!$this->success) {
            return "Build failed: " . ($this->errorMessage ?? 'Unknown error');
        }

        $parts = [
            "Version: {$this->version}",
            "Files: {$this->fileCount}",
        ];

        if ($this->tarPath) {
            $parts[] = "Tar: " . $this->getFormattedSize($this->tarSize);
        }

        if ($this->zipPath) {
            $parts[] = "Zip: " . $this->getFormattedSize($this->zipSize);
        }

        return implode(' | ', $parts);
    }
}
