<?php

declare(strict_types=1);

namespace DeployFlow\Parser;

use DeployFlow\Exception\DeployFlowException;
use Symfony\Component\Finder\Finder;

class MigrationParser
{
    private array $migrations = [];
    private string $migrationsDir;

    public function __construct(string $migrationsDir)
    {
        $this->migrationsDir = $migrationsDir;
    }

    public function parse(): void
    {
        if (!is_dir($this->migrationsDir)) {
            return;
        }

        $finder = new Finder();
        $finder->files()
            ->in($this->migrationsDir)
            ->name(['*.php', '*.sql'])
            ->sortByName();

        foreach ($finder as $file) {
            $migration = $this->parseMigrationFile($file);
            if ($migration) {
                $this->migrations[] = $migration;
            }
        }

        $this->sortMigrations();
    }

    private function parseMigrationFile(\SplFileInfo $file): ?array
    {
        $filename = $file->getFilename();
        $path = $file->getRealPath();
        $extension = $file->getExtension();

        $version = $this->extractVersion($filename);
        $name = $this->extractName($filename);
        $dependsOn = [];
        $isRollbackable = true;
        $isIrreversible = false;
        $description = '';

        $content = $file->getContents();

        if ($extension === 'php') {
            $parsed = $this->parsePhpMigration($content, $filename);
            if ($parsed) {
                $dependsOn = $parsed['depends_on'] ?? [];
                $isRollbackable = $parsed['is_rollbackable'] ?? true;
                $isIrreversible = $parsed['is_irreversible'] ?? false;
                $description = $parsed['description'] ?? $description;
                $name = $parsed['name'] ?? $name;
            }
        } elseif ($extension === 'sql') {
            $parsed = $this->parseSqlMigration($content, $filename);
            if ($parsed) {
                $dependsOn = $parsed['depends_on'] ?? [];
                $isRollbackable = $parsed['is_rollbackable'] ?? true;
                $isIrreversible = $parsed['is_irreversible'] ?? false;
                $description = $parsed['description'] ?? $description;
            }
        }

        $checksum = hash_file('sha256', $path);

        return [
            'filename' => $filename,
            'path' => $path,
            'version' => $version,
            'name' => $name,
            'extension' => $extension,
            'depends_on' => $dependsOn,
            'is_rollbackable' => $isRollbackable && !$isIrreversible,
            'is_irreversible' => $isIrreversible,
            'description' => $description,
            'checksum' => $checksum,
            'size' => $file->getSize(),
            'modified_at' => date('c', $file->getMTime()),
        ];
    }

    private function extractVersion(string $filename): ?string
    {
        $patterns = [
            '/^(\d{14})_/',
            '/^Version(\d+)/',
            '/^(\d+)_/',
            '/^v(\d+(?:\.\d+)*)/',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $filename, $matches)) {
                return $matches[1];
            }
        }

        return $filename;
    }

    private function extractName(string $filename): string
    {
        $name = preg_replace('/\.(php|sql)$/', '', $filename);
        $name = preg_replace('/^\d{14}_/', '', $name);
        $name = preg_replace('/^Version\d+_?/', '', $name);
        $name = preg_replace('/^v?\d+_?/', '', $name);
        $name = str_replace('_', ' ', $name);
        $name = ucfirst(trim($name));

        return $name ?: 'Unnamed Migration';
    }

    private function parsePhpMigration(string $content, string $filename): ?array
    {
        $result = [
            'depends_on' => [],
            'is_rollbackable' => true,
            'is_irreversible' => false,
            'description' => '',
            'name' => null,
        ];

        if (preg_match_all('/@dependsOn\s+([^\s]+)/', $content, $matches)) {
            $deps = array_map('trim', $matches[1]);
            $result['depends_on'] = array_filter($deps, function ($dep) {
                $lowerDep = strtolower($dep);
                return !in_array($lowerDep, ['none', 'null', '0', '', 'n/a'], true);
            });
        }

        if (preg_match('/@(?:noRollback|irreversible|notReversible)/i', $content)) {
            $result['is_rollbackable'] = false;
            $result['is_irreversible'] = true;
        }

        if (preg_match('/@description\s+(.+)$/m', $content, $matches)) {
            $result['description'] = trim($matches[1]);
        }

        if (preg_match('/@name\s+(.+)$/m', $content, $matches)) {
            $result['name'] = trim($matches[1]);
        }

        if (!preg_match('/function\s+(?:down|revert)/i', $content) && 
            !preg_match('/(?:down|revert)\s*=/i', $content)) {
            $result['is_rollbackable'] = false;
        }

        return $result;
    }

    private function parseSqlMigration(string $content, string $filename): ?array
    {
        $result = [
            'depends_on' => [],
            'is_rollbackable' => true,
            'is_irreversible' => false,
            'description' => '',
        ];

        $lines = explode("\n", $content);
        $inComment = false;

        foreach ($lines as $line) {
            $trimmed = trim($line);

            if (str_starts_with($trimmed, '--')) {
                $comment = trim(substr($trimmed, 2));

                if (preg_match('/@dependsOn\s+([^\s]+)/i', $comment, $matches)) {
                    $dep = trim($matches[1]);
                    $lowerDep = strtolower($dep);
                    if (!in_array($lowerDep, ['none', 'null', '0', '', 'n/a'], true)) {
                        $result['depends_on'][] = $dep;
                    }
                }

                if (preg_match('/@(?:noRollback|irreversible|notReversible)/i', $comment)) {
                    $result['is_rollbackable'] = false;
                    $result['is_irreversible'] = true;
                }

                if (preg_match('/@description\s+(.+)$/i', $comment, $matches)) {
                    $result['description'] = trim($matches[1]);
                }
            }
        }

        $dangerousOps = [
            'DROP TABLE',
            'DROP DATABASE',
            'TRUNCATE TABLE',
            'DELETE FROM.*WHERE.*1=1',
        ];

        foreach ($dangerousOps as $op) {
            if (preg_match('/\b' . preg_quote($op, '/') . '\b/i', $content)) {
                $result['is_irreversible'] = true;
                break;
            }
        }

        $result['depends_on'] = array_unique($result['depends_on']);

        return $result;
    }

    private function sortMigrations(): void
    {
        usort($this->migrations, function ($a, $b) {
            $versionA = $a['version'] ?? '';
            $versionB = $b['version'] ?? '';

            if (is_numeric($versionA) && is_numeric($versionB)) {
                return (int)$versionA - (int)$versionB;
            }

            return strnatcmp($versionA, $versionB);
        });
    }

    public function getMigrations(): array
    {
        return $this->migrations;
    }

    public function getIrreversibleMigrations(): array
    {
        return array_filter($this->migrations, function ($m) {
            return $m['is_irreversible'] ?? false;
        });
    }

    public function getNonRollbackableMigrations(): array
    {
        return array_filter($this->migrations, function ($m) {
            return !($m['is_rollbackable'] ?? true);
        });
    }

    public function getMigrationsWithDependencies(): array
    {
        return array_filter($this->migrations, function ($m) {
            return !empty($m['depends_on']);
        });
    }

    public function hasMigration(string $filename): bool
    {
        foreach ($this->migrations as $m) {
            if ($m['filename'] === $filename) {
                return true;
            }
        }
        return false;
    }

    public function getMigration(string $filename): ?array
    {
        foreach ($this->migrations as $m) {
            if ($m['filename'] === $filename) {
                return $m;
            }
        }
        return null;
    }

    public function getTotalCount(): int
    {
        return count($this->migrations);
    }
}
