<?php

declare(strict_types=1);

namespace DeployFlow\Validator;

class ValidatorResult
{
    public const SEVERITY_ERROR = 'error';
    public const SEVERITY_WARNING = 'warning';
    public const SEVERITY_INFO = 'info';
    public const SEVERITY_BLOCKER = 'blocker';

    private array $issues = [];
    private bool $passed = true;
    private bool $hasBlockers = false;

    public function addError(string $category, string $message, array $context = [], ?string $file = null, ?int $line = null): self
    {
        return $this->addIssue(self::SEVERITY_ERROR, $category, $message, $context, $file, $line);
    }

    public function addWarning(string $category, string $message, array $context = [], ?string $file = null, ?int $line = null): self
    {
        return $this->addIssue(self::SEVERITY_WARNING, $category, $message, $context, $file, $line);
    }

    public function addInfo(string $category, string $message, array $context = [], ?string $file = null, ?int $line = null): self
    {
        return $this->addIssue(self::SEVERITY_INFO, $category, $message, $context, $file, $line);
    }

    public function addBlocker(string $category, string $message, array $context = [], ?string $file = null, ?int $line = null): self
    {
        $this->hasBlockers = true;
        return $this->addIssue(self::SEVERITY_BLOCKER, $category, $message, $context, $file, $line);
    }

    private function addIssue(
        string $severity,
        string $category,
        string $message,
        array $context = [],
        ?string $file = null,
        ?int $line = null
    ): self {
        if (in_array($severity, [self::SEVERITY_ERROR, self::SEVERITY_BLOCKER])) {
            $this->passed = false;
        }

        $this->issues[] = [
            'severity' => $severity,
            'category' => $category,
            'message' => $message,
            'context' => $context,
            'file' => $file,
            'line' => $line,
            'timestamp' => date('c'),
        ];

        return $this;
    }

    public function merge(self $other): self
    {
        $this->issues = array_merge($this->issues, $other->getIssues());
        
        if (!$other->passed) {
            $this->passed = false;
        }
        
        if ($other->hasBlockers) {
            $this->hasBlockers = true;
        }

        return $this;
    }

    public function isPassed(): bool
    {
        return $this->passed;
    }

    public function hasBlockers(): bool
    {
        return $this->hasBlockers;
    }

    public function getIssues(): array
    {
        return $this->issues;
    }

    public function getErrors(): array
    {
        return array_filter($this->issues, fn($i) => $i['severity'] === self::SEVERITY_ERROR);
    }

    public function getWarnings(): array
    {
        return array_filter($this->issues, fn($i) => $i['severity'] === self::SEVERITY_WARNING);
    }

    public function getBlockers(): array
    {
        return array_filter($this->issues, fn($i) => $i['severity'] === self::SEVERITY_BLOCKER);
    }

    public function getInfos(): array
    {
        return array_filter($this->issues, fn($i) => $i['severity'] === self::SEVERITY_INFO);
    }

    public function getByCategory(string $category): array
    {
        return array_filter($this->issues, fn($i) => $i['category'] === $category);
    }

    public function getCounts(): array
    {
        return [
            'total' => count($this->issues),
            'blockers' => count($this->getBlockers()),
            'errors' => count($this->getErrors()),
            'warnings' => count($this->getWarnings()),
            'infos' => count($this->getInfos()),
            'passed' => $this->passed,
        ];
    }

    public function toArray(): array
    {
        return [
            'passed' => $this->passed,
            'has_blockers' => $this->hasBlockers,
            'counts' => $this->getCounts(),
            'issues' => $this->issues,
        ];
    }

    public function getSummary(): string
    {
        $counts = $this->getCounts();
        $parts = [];

        if ($counts['blockers'] > 0) {
            $parts[] = "{$counts['blockers']} blocker(s)";
        }
        if ($counts['errors'] > 0) {
            $parts[] = "{$counts['errors']} error(s)";
        }
        if ($counts['warnings'] > 0) {
            $parts[] = "{$counts['warnings']} warning(s)";
        }
        if ($counts['infos'] > 0) {
            $parts[] = "{$counts['infos']} info(s)";
        }

        if (empty($parts)) {
            return 'No issues found. Validation passed.';
        }

        return implode(', ', $parts) . ($this->passed ? ' (passed with warnings)' : ' (failed)');
    }
}
