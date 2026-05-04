<?php

declare(strict_types=1);

namespace DeployFlow\Rollback;

class RollbackPlan
{
    private string $version;
    private string $createdAt = '';
    private string $rollbackDir = '';
    private ?string $manifestPath = null;
    private ?string $scriptPath = null;
    private array $steps = [];
    private array $warnings = [];
    private array $blockers = [];
    private array $nonRollbackableMigrations = [];
    private array $irreversibleMigrations = [];

    public function __construct(string $version)
    {
        $this->version = $version;
    }

    public function getVersion(): string
    {
        return $this->version;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getRollbackDir(): string
    {
        return $this->rollbackDir;
    }

    public function setRollbackDir(string $rollbackDir): void
    {
        $this->rollbackDir = $rollbackDir;
    }

    public function getManifestPath(): ?string
    {
        return $this->manifestPath;
    }

    public function setManifestPath(?string $manifestPath): void
    {
        $this->manifestPath = $manifestPath;
    }

    public function getScriptPath(): ?string
    {
        return $this->scriptPath;
    }

    public function setScriptPath(?string $scriptPath): void
    {
        $this->scriptPath = $scriptPath;
    }

    public function getSteps(): array
    {
        return $this->steps;
    }

    public function setSteps(array $steps): void
    {
        $this->steps = $steps;
    }

    public function addStep(array $step): void
    {
        $this->steps[] = $step;
    }

    public function getWarnings(): array
    {
        return $this->warnings;
    }

    public function addWarning(string $warning): void
    {
        $this->warnings[] = $warning;
    }

    public function getBlockers(): array
    {
        return $this->blockers;
    }

    public function addBlocker(string $blocker): void
    {
        $this->blockers[] = $blocker;
    }

    public function hasBlockers(): bool
    {
        return !empty($this->blockers);
    }

    public function hasWarnings(): bool
    {
        return !empty($this->warnings);
    }

    public function getNonRollbackableMigrations(): array
    {
        return $this->nonRollbackableMigrations;
    }

    public function addNonRollbackableMigration(array $migration): void
    {
        $this->nonRollbackableMigrations[] = $migration;
    }

    public function getIrreversibleMigrations(): array
    {
        return $this->irreversibleMigrations;
    }

    public function addIrreversibleMigration(array $migration): void
    {
        $this->irreversibleMigrations[] = $migration;
    }

    public function canAutoRollback(): bool
    {
        return empty($this->blockers) && empty($this->irreversibleMigrations);
    }

    public function toArray(): array
    {
        return [
            'version' => $this->version,
            'created_at' => $this->createdAt,
            'rollback_dir' => $this->rollbackDir,
            'manifest_path' => $this->manifestPath,
            'script_path' => $this->scriptPath,
            'can_auto_rollback' => $this->canAutoRollback(),
            'steps' => $this->steps,
            'warnings' => $this->warnings,
            'blockers' => $this->blockers,
            'non_rollbackable_migrations' => $this->nonRollbackableMigrations,
            'irreversible_migrations' => $this->irreversibleMigrations,
        ];
    }
}
