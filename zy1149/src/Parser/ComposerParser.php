<?php

declare(strict_types=1);

namespace DeployFlow\Parser;

use DeployFlow\Exception\DeployFlowException;

class ComposerParser
{
    private ?array $composerJson = null;
    private ?array $composerLock = null;
    private string $jsonPath;
    private string $lockPath;

    public function __construct(string $jsonPath, string $lockPath)
    {
        $this->jsonPath = $jsonPath;
        $this->lockPath = $lockPath;
    }

    public function parse(): void
    {
        $this->parseJson();
        $this->parseLock();
    }

    private function parseJson(): void
    {
        if (!file_exists($this->jsonPath)) {
            throw DeployFlowException::ioError('read', $this->jsonPath, 'File not found');
        }

        $content = file_get_contents($this->jsonPath);
        if ($content === false) {
            throw DeployFlowException::ioError('read', $this->jsonPath, 'Cannot read file');
        }

        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw DeployFlowException::parsingError(
                $this->jsonPath,
                'JSON decode error: ' . json_last_error_msg()
            );
        }

        $this->composerJson = $data;
    }

    private function parseLock(): void
    {
        if (!file_exists($this->lockPath)) {
            throw DeployFlowException::ioError('read', $this->lockPath, 'File not found');
        }

        $content = file_get_contents($this->lockPath);
        if ($content === false) {
            throw DeployFlowException::ioError('read', $this->lockPath, 'Cannot read file');
        }

        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw DeployFlowException::parsingError(
                $this->lockPath,
                'JSON decode error: ' . json_last_error_msg()
            );
        }

        $this->composerLock = $data;
    }

    public function getPhpVersion(): ?string
    {
        return $this->composerJson['config']['platform']['php'] 
            ?? $this->composerJson['require']['php'] 
            ?? null;
    }

    public function getRequiredExtensions(): array
    {
        $extensions = [];
        
        if (isset($this->composerJson['require'])) {
            foreach ($this->composerJson['require'] as $package => $version) {
                if (str_starts_with($package, 'ext-')) {
                    $extensions[] = substr($package, 4);
                }
            }
        }

        if (isset($this->composerJson['require-dev'])) {
            foreach ($this->composerJson['require-dev'] as $package => $version) {
                if (str_starts_with($package, 'ext-')) {
                    $extensions[] = substr($package, 4);
                }
            }
        }

        return array_unique($extensions);
    }

    public function getPlatformRequirements(): array
    {
        return $this->composerJson['config']['platform'] ?? [];
    }

    public function getLockPackages(): array
    {
        return $this->composerLock['packages'] ?? [];
    }

    public function getLockPackagesDev(): array
    {
        return $this->composerLock['packages-dev'] ?? [];
    }

    public function getLockHash(): string
    {
        return $this->composerLock['content-hash'] ?? '';
    }

    public function getComposerJson(): ?array
    {
        return $this->composerJson;
    }

    public function getComposerLock(): ?array
    {
        return $this->composerLock;
    }

    public function getPackageVersion(string $packageName): ?string
    {
        $packages = array_merge(
            $this->getLockPackages(),
            $this->getLockPackagesDev()
        );

        foreach ($packages as $pkg) {
            if ($pkg['name'] === $packageName) {
                return $pkg['version'];
            }
        }

        return null;
    }
}
