<?php

declare(strict_types=1);

namespace DeployFlow\Release;

class ReleaseStep
{
    public const CATEGORY_VALIDATION = 'validation';
    public const CATEGORY_PRE_DEPLOY = 'pre_deploy';
    public const CATEGORY_MIGRATION = 'migration';
    public const CATEGORY_DEPLOY = 'deploy';
    public const CATEGORY_POST_DEPLOY = 'post_deploy';
    public const CATEGORY_ROLLBACK = 'rollback';

    public const STATUS_READY = 'ready';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_BLOCKED = 'blocked';
    public const STATUS_SKIPPED = 'skipped';
    public const STATUS_PENDING_CONFIRMATION = 'pending_confirmation';
    public const STATUS_FAILED = 'failed';

    public const PRIORITY_LOW = 'low';
    public const PRIORITY_MEDIUM = 'medium';
    public const PRIORITY_HIGH = 'high';
    public const PRIORITY_CRITICAL = 'critical';

    private string $id;
    private string $name;
    private string $description = '';
    private string $category = self::CATEGORY_DEPLOY;
    private string $status = self::STATUS_READY;
    private string $priority = self::PRIORITY_MEDIUM;
    private string $summary = '';
    private array $details = [];
    private array $dependencies = [];
    private array $blockers = [];
    private bool $requiresConfirmation = false;
    private ?string $confirmationMessage = null;
    private ?string $startedAt = null;
    private ?string $completedAt = null;
    private ?string $errorMessage = null;

    public function __construct(string $id, string $name)
    {
        $this->id = $id;
        $this->name = $name;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function getCategory(): string
    {
        return $this->category;
    }

    public function setCategory(string $category): void
    {
        $this->category = $category;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): void
    {
        $this->status = $status;
    }

    public function getPriority(): string
    {
        return $this->priority;
    }

    public function setPriority(string $priority): void
    {
        $this->priority = $priority;
    }

    public function getSummary(): string
    {
        return $this->summary;
    }

    public function setSummary(string $summary): void
    {
        $this->summary = $summary;
    }

    public function getDetails(): array
    {
        return $this->details;
    }

    public function setDetails(array $details): void
    {
        $this->details = $details;
    }

    public function addDetail(string $detail): void
    {
        $this->details[] = $detail;
    }

    public function getDependencies(): array
    {
        return $this->dependencies;
    }

    public function addDependency(string $stepId): void
    {
        if (!in_array($stepId, $this->dependencies, true)) {
            $this->dependencies[] = $stepId;
        }
    }

    public function removeDependency(string $stepId): void
    {
        $this->dependencies = array_filter(
            $this->dependencies,
            fn($id) => $id !== $stepId
        );
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
            $this->status = self::STATUS_READY;
        }
    }

    public function isRequiresConfirmation(): bool
    {
        return $this->requiresConfirmation;
    }

    public function setRequiresConfirmation(bool $requiresConfirmation): void
    {
        $this->requiresConfirmation = $requiresConfirmation;
    }

    public function getConfirmationMessage(): ?string
    {
        return $this->confirmationMessage;
    }

    public function setConfirmationMessage(?string $confirmationMessage): void
    {
        $this->confirmationMessage = $confirmationMessage;
    }

    public function getStartedAt(): ?string
    {
        return $this->startedAt;
    }

    public function setStartedAt(?string $startedAt): void
    {
        $this->startedAt = $startedAt;
    }

    public function getCompletedAt(): ?string
    {
        return $this->completedAt;
    }

    public function setCompletedAt(?string $completedAt): void
    {
        $this->completedAt = $completedAt;
    }

    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    public function setErrorMessage(?string $errorMessage): void
    {
        $this->errorMessage = $errorMessage;
        $this->status = self::STATUS_FAILED;
    }

    public function getDuration(): ?int
    {
        if ($this->startedAt && $this->completedAt) {
            return strtotime($this->completedAt) - strtotime($this->startedAt);
        }
        return null;
    }

    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    public function isBlocked(): bool
    {
        return $this->status === self::STATUS_BLOCKED;
    }

    public function isFailed(): bool
    {
        return $this->status === self::STATUS_FAILED;
    }

    public function isSkipped(): bool
    {
        return $this->status === self::STATUS_SKIPPED;
    }

    public function isReady(): bool
    {
        return $this->status === self::STATUS_READY;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'category' => $this->category,
            'status' => $this->status,
            'priority' => $this->priority,
            'summary' => $this->summary,
            'details' => $this->details,
            'dependencies' => $this->dependencies,
            'blockers' => $this->blockers,
            'requires_confirmation' => $this->requiresConfirmation,
            'confirmation_message' => $this->confirmationMessage,
            'started_at' => $this->startedAt,
            'completed_at' => $this->completedAt,
            'error_message' => $this->errorMessage,
            'duration' => $this->getDuration(),
        ];
    }

    public static function getCategoryLabel(string $category): string
    {
        $labels = [
            self::CATEGORY_VALIDATION => 'Validation',
            self::CATEGORY_PRE_DEPLOY => 'Pre-Deploy',
            self::CATEGORY_MIGRATION => 'Migration',
            self::CATEGORY_DEPLOY => 'Deploy',
            self::CATEGORY_POST_DEPLOY => 'Post-Deploy',
            self::CATEGORY_ROLLBACK => 'Rollback',
        ];
        return $labels[$category] ?? ucfirst($category);
    }

    public static function getStatusLabel(string $status): string
    {
        $labels = [
            self::STATUS_READY => 'Ready',
            self::STATUS_IN_PROGRESS => 'In Progress',
            self::STATUS_COMPLETED => 'Completed',
            self::STATUS_BLOCKED => 'Blocked',
            self::STATUS_SKIPPED => 'Skipped',
            self::STATUS_PENDING_CONFIRMATION => 'Pending Confirmation',
            self::STATUS_FAILED => 'Failed',
        ];
        return $labels[$status] ?? ucfirst($status);
    }

    public static function getStatusIcon(string $status): string
    {
        $icons = [
            self::STATUS_READY => '✅',
            self::STATUS_IN_PROGRESS => '🔄',
            self::STATUS_COMPLETED => '✓',
            self::STATUS_BLOCKED => '🚫',
            self::STATUS_SKIPPED => '⏭️',
            self::STATUS_PENDING_CONFIRMATION => '❓',
            self::STATUS_FAILED => '❌',
        ];
        return $icons[$status] ?? '?';
    }
}
