<?php

declare(strict_types=1);

namespace DeployFlow\Release;

class ReleasePlan
{
    public const STATUS_READY = 'ready';
    public const STATUS_BLOCKED = 'blocked';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';

    private string $version = 'unknown';
    private ?string $targetEnvironment = null;
    private string $status = self::STATUS_READY;
    private string $createdAt = '';
    private array $steps = [];
    private array $blockers = [];
    private array $auditLog = [];
    private ?string $auditLogPath = null;

    public function getVersion(): string
    {
        return $this->version;
    }

    public function setVersion(string $version): void
    {
        $this->version = $version;
    }

    public function getTargetEnvironment(): ?string
    {
        return $this->targetEnvironment;
    }

    public function setTargetEnvironment(?string $targetEnvironment): void
    {
        $this->targetEnvironment = $targetEnvironment;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): void
    {
        $this->status = $status;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getSteps(): array
    {
        return $this->steps;
    }

    public function addStep(ReleaseStep $step): void
    {
        $this->steps[] = $step;
    }

    public function getStep(string $id): ?ReleaseStep
    {
        foreach ($this->steps as $step) {
            if ($step->getId() === $id) {
                return $step;
            }
        }
        return null;
    }

    public function getBlockers(): array
    {
        return $this->blockers;
    }

    public function addBlocker(string $message): void
    {
        $this->blockers[] = $message;
        $this->status = self::STATUS_BLOCKED;
    }

    public function clearBlockers(): void
    {
        $this->blockers = [];
        if ($this->status === self::STATUS_BLOCKED) {
            $hasStepBlockers = false;
            foreach ($this->steps as $step) {
                if ($step->isBlocked()) {
                    $hasStepBlockers = true;
                    break;
                }
            }
            $this->status = $hasStepBlockers ? self::STATUS_BLOCKED : self::STATUS_READY;
        }
    }

    public function getAuditLog(): array
    {
        return $this->auditLog;
    }

    public function setAuditLog(array $auditLog): void
    {
        $this->auditLog = $auditLog;
    }

    public function getAuditLogPath(): ?string
    {
        return $this->auditLogPath;
    }

    public function setAuditLogPath(?string $auditLogPath): void
    {
        $this->auditLogPath = $auditLogPath;
    }

    public function getStepsByCategory(string $category): array
    {
        return array_filter(
            $this->steps,
            fn(ReleaseStep $step) => $step->getCategory() === $category
        );
    }

    public function getBlockedSteps(): array
    {
        return array_filter(
            $this->steps,
            fn(ReleaseStep $step) => $step->isBlocked()
        );
    }

    public function getReadySteps(): array
    {
        return array_filter(
            $this->steps,
            fn(ReleaseStep $step) => $step->isReady()
        );
    }

    public function getCompletedSteps(): array
    {
        return array_filter(
            $this->steps,
            fn(ReleaseStep $step) => $step->isCompleted()
        );
    }

    public function getFailedSteps(): array
    {
        return array_filter(
            $this->steps,
            fn(ReleaseStep $step) => $step->isFailed()
        );
    }

    public function hasBlockers(): bool
    {
        if (!empty($this->blockers)) {
            return true;
        }

        foreach ($this->steps as $step) {
            if ($step->isBlocked()) {
                return true;
            }
        }

        return false;
    }

    public function isReady(): bool
    {
        return !$this->hasBlockers() && $this->status === self::STATUS_READY;
    }

    public function isBlocked(): bool
    {
        return $this->status === self::STATUS_BLOCKED;
    }

    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    public function getProgress(): array
    {
        $total = count($this->steps);
        $completed = count($this->getCompletedSteps());
        $blocked = count($this->getBlockedSteps());
        $failed = count($this->getFailedSteps());
        $ready = count($this->getReadySteps());

        return [
            'total' => $total,
            'completed' => $completed,
            'blocked' => $blocked,
            'failed' => $failed,
            'ready' => $ready,
            'in_progress' => $total - $completed - $blocked - $failed - $ready,
            'percentage' => $total > 0 ? round(($completed / $total) * 100, 1) : 0,
        ];
    }

    public function getStepsInOrder(): array
    {
        $ordered = [];
        $visited = [];
        $stepMap = [];

        foreach ($this->steps as $step) {
            $stepMap[$step->getId()] = $step;
        }

        $visit = function (ReleaseStep $step) use (&$visit, &$ordered, &$visited, $stepMap) {
            $id = $step->getId();
            if (isset($visited[$id])) {
                return;
            }

            foreach ($step->getDependencies() as $depId) {
                if (isset($stepMap[$depId])) {
                    $visit($stepMap[$depId]);
                }
            }

            $visited[$id] = true;
            $ordered[] = $step;
        };

        foreach ($this->steps as $step) {
            $visit($step);
        }

        return $ordered;
    }

    public function toArray(): array
    {
        return [
            'version' => $this->version,
            'target_environment' => $this->targetEnvironment,
            'status' => $this->status,
            'created_at' => $this->createdAt,
            'blockers' => $this->blockers,
            'progress' => $this->getProgress(),
            'steps' => array_map(
                fn(ReleaseStep $step) => $step->toArray(),
                $this->getStepsInOrder()
            ),
            'audit_log_path' => $this->auditLogPath,
        ];
    }
}
