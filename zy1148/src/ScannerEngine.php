<?php

declare(strict_types=1);

namespace PhpSecurityScanner;

use PhpSecurityScanner\Scanner\AbstractScanner;
use PhpSecurityScanner\Scanner\PhpCodeScanner;
use PhpSecurityScanner\Scanner\TemplateScanner;
use PhpSecurityScanner\Scanner\ConfigScanner;
use PhpSecurityScanner\Scanner\UploadScanner;
use PhpSecurityScanner\Scanner\DependencyScanner;
use PhpSecurityScanner\Scanner\RouteScanner;

class ScannerEngine
{
    private Config $config;
    private array $findings = [];
    private array $scanners = [];

    public function __construct(Config $config)
    {
        $this->config = $config;
        $this->initializeScanners();
    }

    private function initializeScanners(): void
    {
        $this->scanners = [
            'php' => new PhpCodeScanner($this->config),
            'template' => new TemplateScanner($this->config),
            'config' => new ConfigScanner($this->config),
            'upload' => new UploadScanner($this->config),
            'dependency' => new DependencyScanner($this->config),
            'route' => new RouteScanner($this->config),
        ];
    }

    public function scan(string $projectPath, array $scanners = []): array
    {
        $this->findings = [];

        $scannersToUse = empty($scanners) ? array_keys($this->scanners) : $scanners;

        foreach ($scannersToUse as $scannerName) {
            if (!isset($this->scanners[$scannerName])) {
                continue;
            }

            $scanner = $this->scanners[$scannerName];
            
            $targetPath = $this->getTargetPath($projectPath, $scannerName);
            if (!$targetPath) {
                continue;
            }

            $results = $scanner->scan($targetPath);
            $this->findings = array_merge($this->findings, $results);
        }

        $this->sortFindings();

        return $this->findings;
    }

    public function scanAll(string $projectPath): array
    {
        return $this->scan($projectPath);
    }

    public function scanDependencies(string $projectPath): array
    {
        return $this->scan($projectPath, ['dependency']);
    }

    public function scanCode(string $projectPath): array
    {
        return $this->scan($projectPath, ['php', 'template']);
    }

    public function scanConfig(string $projectPath): array
    {
        return $this->scan($projectPath, ['config', 'route']);
    }

    private function getTargetPath(string $projectPath, string $scannerName): ?string
    {
        $map = [
            'php' => ['src', 'app', 'controllers', 'lib'],
            'template' => ['templates', 'views', 'resources/views'],
            'config' => ['config', '.'],
            'upload' => ['public/uploads', 'uploads', 'storage/app/public'],
            'dependency' => ['.'],
            'route' => ['routes', '.'],
        ];

        if (!isset($map[$scannerName])) {
            return $projectPath;
        }

        foreach ($map[$scannerName] as $subPath) {
            $fullPath = rtrim($projectPath, '/') . '/' . $subPath;
            if (file_exists($fullPath)) {
                return $fullPath;
            }
        }

        if ($scannerName === 'dependency') {
            $composerJson = rtrim($projectPath, '/') . '/composer.json';
            if (file_exists($composerJson)) {
                return $projectPath;
            }
        }

        if ($scannerName === 'php') {
            return $projectPath;
        }

        return null;
    }

    private function sortFindings(): void
    {
        usort($this->findings, function (Finding $a, Finding $b) {
            $severityOrder = [
                Finding::SEVERITY_CRITICAL => 5,
                Finding::SEVERITY_HIGH => 4,
                Finding::SEVERITY_MEDIUM => 3,
                Finding::SEVERITY_LOW => 2,
                Finding::SEVERITY_INFO => 1,
            ];

            $aScore = $severityOrder[$a->getSeverity()] ?? 0;
            $bScore = $severityOrder[$b->getSeverity()] ?? 0;

            if ($aScore !== $bScore) {
                return $bScore - $aScore;
            }

            $confidenceOrder = [
                Finding::CONFIDENCE_HIGH => 3,
                Finding::CONFIDENCE_MEDIUM => 2,
                Finding::CONFIDENCE_LOW => 1,
            ];

            $aConf = $confidenceOrder[$a->getConfidence()] ?? 0;
            $bConf = $confidenceOrder[$b->getConfidence()] ?? 0;

            return $bConf - $aConf;
        });
    }

    public function getFindings(): array
    {
        return $this->findings;
    }

    public function getFindingsBySeverity(string $severity): array
    {
        return array_filter($this->findings, function (Finding $finding) use ($severity) {
            return $finding->getSeverity() === $severity;
        });
    }

    public function getFindingsByCategory(string $category): array
    {
        return array_filter($this->findings, function (Finding $finding) use ($category) {
            return $finding->getCategory() === $category;
        });
    }

    public function getSeverityCounts(): array
    {
        $counts = [
            Finding::SEVERITY_CRITICAL => 0,
            Finding::SEVERITY_HIGH => 0,
            Finding::SEVERITY_MEDIUM => 0,
            Finding::SEVERITY_LOW => 0,
            Finding::SEVERITY_INFO => 0,
        ];

        foreach ($this->findings as $finding) {
            $severity = $finding->getSeverity();
            if (isset($counts[$severity])) {
                $counts[$severity]++;
            }
        }

        return $counts;
    }
}
