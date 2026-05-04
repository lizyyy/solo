<?php

declare(strict_types=1);

namespace PhpSecurityScanner;

class Finding
{
    public const SEVERITY_CRITICAL = 'critical';
    public const SEVERITY_HIGH = 'high';
    public const SEVERITY_MEDIUM = 'medium';
    public const SEVERITY_LOW = 'low';
    public const SEVERITY_INFO = 'info';

    public const CONFIDENCE_HIGH = 'high';
    public const CONFIDENCE_MEDIUM = 'medium';
    public const CONFIDENCE_LOW = 'low';

    public function __construct(
        private string $ruleId,
        private string $severity,
        private string $filePath,
        private int $lineNumber,
        private string $evidence,
        private string $confidence,
        private string $reason,
        private string $remediation,
        private string $category,
        private ?string $snippet = null
    ) {
    }

    public function getRuleId(): string
    {
        return $this->ruleId;
    }

    public function getSeverity(): string
    {
        return $this->severity;
    }

    public function getFilePath(): string
    {
        return $this->filePath;
    }

    public function getLineNumber(): int
    {
        return $this->lineNumber;
    }

    public function getEvidence(): string
    {
        return $this->evidence;
    }

    public function getConfidence(): string
    {
        return $this->confidence;
    }

    public function getReason(): string
    {
        return $this->reason;
    }

    public function getRemediation(): string
    {
        return $this->remediation;
    }

    public function getCategory(): string
    {
        return $this->category;
    }

    public function getSnippet(): ?string
    {
        return $this->snippet;
    }

    public function toArray(): array
    {
        return [
            'rule_id' => $this->ruleId,
            'severity' => $this->severity,
            'file_path' => $this->filePath,
            'line_number' => $this->lineNumber,
            'evidence' => $this->evidence,
            'confidence' => $this->confidence,
            'reason' => $this->reason,
            'remediation' => $this->remediation,
            'category' => $this->category,
            'snippet' => $this->snippet,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            $data['rule_id'],
            $data['severity'],
            $data['file_path'],
            $data['line_number'],
            $data['evidence'],
            $data['confidence'],
            $data['reason'],
            $data['remediation'],
            $data['category'],
            $data['snippet'] ?? null
        );
    }

    public function getFingerprint(): string
    {
        return md5(
            $this->ruleId .
            $this->filePath .
            $this->lineNumber .
            $this->evidence
        );
    }

    public static function severityToNumeric(string $severity): int
    {
        return match ($severity) {
            self::SEVERITY_CRITICAL => 5,
            self::SEVERITY_HIGH => 4,
            self::SEVERITY_MEDIUM => 3,
            self::SEVERITY_LOW => 2,
            self::SEVERITY_INFO => 1,
            default => 0,
        };
    }

    public static function isValidSeverity(string $severity): bool
    {
        return in_array($severity, [
            self::SEVERITY_CRITICAL,
            self::SEVERITY_HIGH,
            self::SEVERITY_MEDIUM,
            self::SEVERITY_LOW,
            self::SEVERITY_INFO,
        ]);
    }
}
