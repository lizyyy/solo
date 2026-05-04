<?php

declare(strict_types=1);

namespace PhpSecurityScanner;

class BaselineManager
{
    private string $baselinePath;

    public function __construct(string $projectPath)
    {
        $this->baselinePath = rtrim($projectPath, '/') . '/.scansec-baseline.json';
    }

    public function create(array $findings): void
    {
        $baselineData = [
            'created_at' => date('Y-m-d H:i:s'),
            'version' => '1.0.0',
            'suppressed_findings' => [],
        ];

        foreach ($findings as $finding) {
            if (!$finding instanceof Finding) {
                continue;
            }

            $baselineData['suppressed_findings'][] = [
                'fingerprint' => $finding->getFingerprint(),
                'rule_id' => $finding->getRuleId(),
                'file_path' => $finding->getFilePath(),
                'line_number' => $finding->getLineNumber(),
                'evidence' => $finding->getEvidence(),
                'suppressed_at' => date('Y-m-d H:i:s'),
                'reason' => 'Baseline suppression',
            ];
        }

        $json = json_encode($baselineData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        
        if (file_put_contents($this->baselinePath, $json) === false) {
            throw new \RuntimeException("Failed to write baseline file: {$this->baselinePath}");
        }
    }

    public function update(array $findings, bool $addNew = false, bool $removeMissing = true): void
    {
        $existing = $this->load();
        
        $fingerprints = [];
        foreach ($findings as $finding) {
            if (!$finding instanceof Finding) {
                continue;
            }
            $fingerprints[$finding->getFingerprint()] = $finding;
        }

        $existingFingerprints = [];
        foreach ($existing['suppressed_findings'] as $item) {
            $existingFingerprints[$item['fingerprint']] = $item;
        }

        if ($addNew) {
            foreach ($fingerprints as $fp => $finding) {
                if (!isset($existingFingerprints[$fp])) {
                    $existing['suppressed_findings'][] = [
                        'fingerprint' => $fp,
                        'rule_id' => $finding->getRuleId(),
                        'file_path' => $finding->getFilePath(),
                        'line_number' => $finding->getLineNumber(),
                        'evidence' => $finding->getEvidence(),
                        'suppressed_at' => date('Y-m-d H:i:s'),
                        'reason' => 'Added during baseline update',
                    ];
                }
            }
        }

        if ($removeMissing) {
            $existing['suppressed_findings'] = array_filter(
                $existing['suppressed_findings'],
                function ($item) use ($fingerprints) {
                    return isset($fingerprints[$item['fingerprint']]);
                }
            );
        }

        $existing['updated_at'] = date('Y-m-d H:i:s');

        $json = json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        
        if (file_put_contents($this->baselinePath, $json) === false) {
            throw new \RuntimeException("Failed to update baseline file: {$this->baselinePath}");
        }
    }

    public function load(): array
    {
        if (!file_exists($this->baselinePath)) {
            return [
                'created_at' => null,
                'version' => '1.0.0',
                'suppressed_findings' => [],
            ];
        }

        $content = file_get_contents($this->baselinePath);
        if ($content === false) {
            throw new \RuntimeException("Failed to read baseline file: {$this->baselinePath}");
        }

        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \RuntimeException("Invalid JSON in baseline file: " . json_last_error_msg());
        }

        return $data;
    }

    public function apply(array $findings): array
    {
        $baseline = $this->load();
        
        $suppressedFingerprints = [];
        foreach ($baseline['suppressed_findings'] as $item) {
            $suppressedFingerprints[$item['fingerprint']] = true;
        }

        $newFindings = [];
        $suppressedFindings = [];

        foreach ($findings as $finding) {
            if (!$finding instanceof Finding) {
                continue;
            }

            $fp = $finding->getFingerprint();
            
            if (isset($suppressedFingerprints[$fp])) {
                $suppressedFindings[] = $finding;
            } else {
                $newFindings[] = $finding;
            }
        }

        return [
            'active' => $newFindings,
            'suppressed' => $suppressedFindings,
        ];
    }

    public function exists(): bool
    {
        return file_exists($this->baselinePath);
    }

    public function getPath(): string
    {
        return $this->baselinePath;
    }

    public function getSuppressedCount(): int
    {
        $baseline = $this->load();
        return count($baseline['suppressed_findings']);
    }

    public function addFinding(Finding $finding, string $reason = 'Manual suppression'): void
    {
        $baseline = $this->load();
        
        $fingerprint = $finding->getFingerprint();
        
        foreach ($baseline['suppressed_findings'] as $item) {
            if ($item['fingerprint'] === $fingerprint) {
                return;
            }
        }

        $baseline['suppressed_findings'][] = [
            'fingerprint' => $fingerprint,
            'rule_id' => $finding->getRuleId(),
            'file_path' => $finding->getFilePath(),
            'line_number' => $finding->getLineNumber(),
            'evidence' => $finding->getEvidence(),
            'suppressed_at' => date('Y-m-d H:i:s'),
            'reason' => $reason,
        ];

        $json = json_encode($baseline, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        file_put_contents($this->baselinePath, $json);
    }

    public function removeFinding(Finding $finding): void
    {
        $baseline = $this->load();
        
        $fingerprint = $finding->getFingerprint();
        
        $baseline['suppressed_findings'] = array_filter(
            $baseline['suppressed_findings'],
            function ($item) use ($fingerprint) {
                return $item['fingerprint'] !== $fingerprint;
            }
        );

        $json = json_encode($baseline, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        file_put_contents($this->baselinePath, $json);
    }
}
