<?php

declare(strict_types=1);

namespace PhpSecurityScanner\Scanner;

use PhpSecurityScanner\Finding;

abstract class AbstractScanner
{
    protected array $findings = [];

    abstract public function scan(string $path): array;

    abstract public function getCategory(): string;

    protected function addFinding(
        string $ruleId,
        string $severity,
        string $filePath,
        int $lineNumber,
        string $evidence,
        string $confidence,
        string $reason,
        string $remediation,
        ?string $snippet = null
    ): void {
        $this->findings[] = new Finding(
            $ruleId,
            $severity,
            $filePath,
            $lineNumber,
            $evidence,
            $confidence,
            $reason,
            $remediation,
            $this->getCategory(),
            $snippet
        );
    }

    protected function getFileLines(string $filePath, int $lineNumber, int $context = 2): string
    {
        if (!file_exists($filePath)) {
            return '';
        }

        $lines = file($filePath, FILE_IGNORE_NEW_LINES);
        if ($lines === false) {
            return '';
        }

        $start = max(0, $lineNumber - $context - 1);
        $end = min(count($lines) - 1, $lineNumber + $context - 1);

        $snippet = '';
        for ($i = $start; $i <= $end; $i++) {
            $marker = ($i === $lineNumber - 1) ? '>> ' : '   ';
            $snippet .= sprintf("%s%4d: %s\n", $marker, $i + 1, $lines[$i]);
        }

        return rtrim($snippet);
    }

    protected function scanDirectory(string $directory, array $extensions = ['php'], array $excludes = []): array
    {
        $files = [];
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if (!$file->isFile()) {
                continue;
            }

            $path = $file->getPathname();
            $relativePath = str_replace(getcwd() . DIRECTORY_SEPARATOR, '', $path);

            $shouldExclude = false;
            foreach ($excludes as $exclude) {
                if (str_contains($relativePath, $exclude)) {
                    $shouldExclude = true;
                    break;
                }
            }

            if ($shouldExclude) {
                continue;
            }

            $ext = strtolower($file->getExtension());
            if (in_array($ext, $extensions)) {
                $files[] = $path;
            }
        }

        return $files;
    }
}
