<?php

declare(strict_types=1);

namespace DeployFlow\Report;

use DeployFlow\Config\ProjectConfig;
use DeployFlow\Validator\ValidatorResult;
use DeployFlow\Builder\BuildResult;
use DeployFlow\Release\ReleasePlan;
use DeployFlow\Rollback\RollbackPlan;
use DeployFlow\Exception\DeployFlowException;
use Symfony\Component\Filesystem\Filesystem;

class ReportGenerator
{
    private ProjectConfig $config;
    private Filesystem $filesystem;
    private ?ValidatorResult $validatorResult = null;
    private ?BuildResult $buildResult = null;
    private ?ReleasePlan $releasePlan = null;
    private ?RollbackPlan $rollbackPlan = null;
    private array $extraData = [];

    public function __construct(ProjectConfig $config)
    {
        $this->config = $config;
        $this->filesystem = new Filesystem();
    }

    public function setValidatorResult(?ValidatorResult $result): void
    {
        $this->validatorResult = $result;
    }

    public function setBuildResult(?BuildResult $result): void
    {
        $this->buildResult = $result;
    }

    public function setReleasePlan(?ReleasePlan $plan): void
    {
        $this->releasePlan = $plan;
    }

    public function setRollbackPlan(?RollbackPlan $plan): void
    {
        $this->rollbackPlan = $plan;
    }

    public function setExtraData(array $data): void
    {
        $this->extraData = $data;
    }

    public function generate(string $format, string $outputPath): void
    {
        $content = '';

        switch (strtolower($format)) {
            case 'json':
                $content = $this->generateJson();
                break;
            case 'csv':
                $content = $this->generateCsv();
                break;
            case 'markdown':
            case 'md':
                $content = $this->generateMarkdown();
                break;
            default:
                throw DeployFlowException::reportError(
                    "Unsupported report format: {$format}"
                );
        }

        $this->filesystem->dumpFile($outputPath, $content);
    }

    private function generateJson(): string
    {
        $report = [
            'generated_at' => date('c'),
            'project' => $this->config->projectRoot,
        ];

        if ($this->validatorResult) {
            $report['validation'] = $this->validatorResult->toArray();
        }

        if ($this->buildResult) {
            $report['build'] = $this->buildResult->toArray();
        }

        if ($this->releasePlan) {
            $report['release_plan'] = $this->releasePlan->toArray();
        }

        if ($this->rollbackPlan) {
            $report['rollback_plan'] = $this->rollbackPlan->toArray();
        }

        if (!empty($this->extraData)) {
            $report['extra'] = $this->extraData;
        }

        return json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    private function generateCsv(): string
    {
        $rows = [];

        $rows[] = ['Type', 'Category', 'Severity', 'Message', 'File', 'Line', 'Context'];

        if ($this->validatorResult) {
            foreach ($this->validatorResult->getIssues() as $issue) {
                $rows[] = [
                    'Validation',
                    $issue['category'] ?? 'N/A',
                    $issue['severity'] ?? 'N/A',
                    $issue['message'] ?? 'N/A',
                    $issue['file'] ?? '',
                    $issue['line'] ?? '',
                    json_encode($issue['context'] ?? [], JSON_UNESCAPED_UNICODE),
                ];
            }
        }

        if ($this->buildResult) {
            $rows[] = [
                'Build',
                'Summary',
                $this->buildResult->isSuccess() ? 'success' : 'error',
                $this->buildResult->getSummary(),
                '',
                '',
                '',
            ];

            if ($this->buildResult->getTarPath()) {
                $rows[] = [
                    'Build',
                    'Artifact',
                    'info',
                    'Tar: ' . basename($this->buildResult->getTarPath()),
                    $this->buildResult->getTarPath(),
                    '',
                    'Size: ' . $this->buildResult->getFormattedSize($this->buildResult->getTarSize()),
                ];
            }

            if ($this->buildResult->getZipPath()) {
                $rows[] = [
                    'Build',
                    'Artifact',
                    'info',
                    'Zip: ' . basename($this->buildResult->getZipPath()),
                    $this->buildResult->getZipPath(),
                    '',
                    'Size: ' . $this->buildResult->getFormattedSize($this->buildResult->getZipSize()),
                ];
            }
        }

        if ($this->releasePlan) {
            foreach ($this->releasePlan->getStepsInOrder() as $step) {
                $rows[] = [
                    'Release Plan',
                    $step->getCategory(),
                    $step->getStatus(),
                    $step->getName() . ': ' . $step->getSummary(),
                    '',
                    '',
                    implode(', ', $step->getDependencies()),
                ];
            }
        }

        $output = fopen('php://temp', 'r+');
        foreach ($rows as $row) {
            fputcsv($output, $row);
        }
        rewind($output);
        $content = stream_get_contents($output);
        fclose($output);

        return $content;
    }

    private function generateMarkdown(): string
    {
        $lines = [];

        $lines[] = '# DeployFlow Release Report';
        $lines[] = '';
        $lines[] = '> Generated at: ' . date('Y-m-d H:i:s');
        $lines[] = '';
        $lines[] = '---';
        $lines[] = '';

        if ($this->validatorResult) {
            $lines[] = '## 1. Validation Results';
            $lines[] = '';

            $counts = $this->validatorResult->getCounts();
            $lines[] = '### Summary';
            $lines[] = '';
            $lines[] = '- **Status**: ' . ($this->validatorResult->isPassed() ? '✅ Passed' : '❌ Failed');
            $lines[] = '- **Has Blockers**: ' . ($this->validatorResult->hasBlockers() ? '🚫 Yes' : '✅ No');
            $lines[] = '- **Total Issues**: ' . $counts['total'];
            $lines[] = '  - Blockers: ' . $counts['blockers'];
            $lines[] = '  - Errors: ' . $counts['errors'];
            $lines[] = '  - Warnings: ' . $counts['warnings'];
            $lines[] = '  - Infos: ' . $counts['infos'];
            $lines[] = '';

            $issues = $this->validatorResult->getIssues();
            if (!empty($issues)) {
                $lines[] = '### Issues Details';
                $lines[] = '';
                $lines[] = '| Severity | Category | Message | File |';
                $lines[] = '|----------|----------|---------|------|';

                foreach ($issues as $issue) {
                    $severityIcon = $this->getSeverityIcon($issue['severity']);
                    $file = $issue['file'] ?? 'N/A';
                    if ($issue['line'] ?? null) {
                        $file .= ':' . $issue['line'];
                    }

                    $lines[] = sprintf(
                        '| %s %s | %s | %s | %s |',
                        $severityIcon,
                        ucfirst($issue['severity']),
                        $issue['category'] ?? 'N/A',
                        $this->escapeMarkdown($issue['message'] ?? 'N/A'),
                        $file
                    );
                }
                $lines[] = '';
            }
        }

        if ($this->buildResult) {
            $lines[] = '---';
            $lines[] = '';
            $lines[] = '## 2. Build Results';
            $lines[] = '';

            $lines[] = '### Summary';
            $lines[] = '';
            $lines[] = '- **Version**: ' . $this->buildResult->getVersion();
            $lines[] = '- **Status**: ' . ($this->buildResult->isSuccess() ? '✅ Success' : '❌ Failed');
            $lines[] = '- **Files Included**: ' . $this->buildResult->getFileCount();
            $lines[] = '';

            if (!$this->buildResult->isSuccess()) {
                $lines[] = '### Error';
                $lines[] = '';
                $lines[] = '```';
                $lines[] = $this->buildResult->getErrorMessage() ?? 'Unknown error';
                $lines[] = '```';
                $lines[] = '';
            } else {
                $lines[] = '### Artifacts';
                $lines[] = '';

                if ($this->buildResult->getTarPath()) {
                    $lines[] = '- **Tar Archive**: `' . basename($this->buildResult->getTarPath()) . '`';
                    $lines[] = '  - Size: ' . $this->buildResult->getFormattedSize($this->buildResult->getTarSize());
                }

                if ($this->buildResult->getZipPath()) {
                    $lines[] = '- **Zip Archive**: `' . basename($this->buildResult->getZipPath()) . '`';
                    $lines[] = '  - Size: ' . $this->buildResult->getFormattedSize($this->buildResult->getZipSize());
                }

                if ($this->buildResult->getManifestPath()) {
                    $lines[] = '- **Manifest**: `' . basename($this->buildResult->getManifestPath()) . '`';
                }

                if ($this->buildResult->getChecksumsPath()) {
                    $lines[] = '- **Checksums**: `' . basename($this->buildResult->getChecksumsPath()) . '`';
                }

                $lines[] = '';
            }
        }

        if ($this->releasePlan) {
            $lines[] = '---';
            $lines[] = '';
            $lines[] = '## 3. Release Plan';
            $lines[] = '';

            $lines[] = '### Summary';
            $lines[] = '';
            $lines[] = '- **Version**: ' . $this->releasePlan->getVersion();
            $lines[] = '- **Target**: ' . ($this->releasePlan->getTargetEnvironment() ?? 'N/A');
            $lines[] = '- **Status**: ' . $this->releasePlan->getStatus();
            $lines[] = '';

            if ($this->releasePlan->hasBlockers()) {
                $lines[] = '### ⚠️ Blockers';
                $lines[] = '';
                foreach ($this->releasePlan->getBlockers() as $blocker) {
                    $lines[] = '- ' . $this->escapeMarkdown($blocker);
                }
                $lines[] = '';
            }

            $progress = $this->releasePlan->getProgress();
            $lines[] = '### Progress';
            $lines[] = '';
            $lines[] = '- **Total Steps**: ' . $progress['total'];
            $lines[] = '- **Completed**: ' . $progress['completed'];
            $lines[] = '- **Ready**: ' . $progress['ready'];
            $lines[] = '- **Blocked**: ' . $progress['blocked'];
            $lines[] = '- **Failed**: ' . $progress['failed'];
            $lines[] = '- **Progress**: ' . $progress['percentage'] . '%';
            $lines[] = '';

            $lines[] = '### Steps';
            $lines[] = '';

            $steps = $this->releasePlan->getStepsInOrder();
            $stepNum = 1;

            foreach ($steps as $step) {
                $icon = $this->getStepStatusIcon($step->getStatus());
                $lines[] = sprintf(
                    '%d. %s **%s** - %s',
                    $stepNum,
                    $icon,
                    $step->getName(),
                    $step->getSummary()
                );

                if ($step->isRequiresConfirmation()) {
                    $lines[] = '   - ⚠️ Requires manual confirmation';
                }

                if (!empty($step->getDependencies())) {
                    $lines[] = '   - Depends on: ' . implode(', ', $step->getDependencies());
                }

                if (!empty($step->getBlockers())) {
                    $lines[] = '   - Blockers: ' . implode('; ', $step->getBlockers());
                }

                $lines[] = '';
                $stepNum++;
            }
        }

        if ($this->rollbackPlan) {
            $lines[] = '---';
            $lines[] = '';
            $lines[] = '## 4. Rollback Plan';
            $lines[] = '';

            $lines[] = '### Summary';
            $lines[] = '';
            $lines[] = '- **Version**: ' . $this->rollbackPlan->getVersion();
            $lines[] = '- **Can Auto-Rollback**: ' . ($this->rollbackPlan->canAutoRollback() ? '✅ Yes' : '⚠️ No');
            $lines[] = '';

            if ($this->rollbackPlan->hasBlockers()) {
                $lines[] = '### 🚫 Blockers';
                $lines[] = '';
                foreach ($this->rollbackPlan->getBlockers() as $blocker) {
                    $lines[] = '- ' . $this->escapeMarkdown($blocker);
                }
                $lines[] = '';
            }

            if ($this->rollbackPlan->hasWarnings()) {
                $lines[] = '### ⚠️ Warnings';
                $lines[] = '';
                foreach ($this->rollbackPlan->getWarnings() as $warning) {
                    $lines[] = '- ' . $this->escapeMarkdown($warning);
                }
                $lines[] = '';
            }

            $irreversible = $this->rollbackPlan->getIrreversibleMigrations();
            if (!empty($irreversible)) {
                $lines[] = '### ❌ Irreversible Migrations';
                $lines[] = '';
                $lines[] = '| Filename | Name |';
                $lines[] = '|----------|------|';
                foreach ($irreversible as $m) {
                    $lines[] = sprintf(
                        '| %s | %s |',
                        $m['filename'] ?? 'N/A',
                        $m['name'] ?? 'N/A'
                    );
                }
                $lines[] = '';
            }

            $nonRollbackable = $this->rollbackPlan->getNonRollbackableMigrations();
            if (!empty($nonRollbackable)) {
                $lines[] = '### ⚠️ Non-Rollbackable Migrations';
                $lines[] = '';
                $lines[] = '| Filename | Name |';
                $lines[] = '|----------|------|';
                foreach ($nonRollbackable as $m) {
                    $lines[] = sprintf(
                        '| %s | %s |',
                        $m['filename'] ?? 'N/A',
                        $m['name'] ?? 'N/A'
                    );
                }
                $lines[] = '';
            }

            $lines[] = '### Rollback Steps';
            $lines[] = '';

            $steps = $this->rollbackPlan->getSteps();
            if (empty($steps)) {
                $lines[] = 'No steps defined.';
            } else {
                $stepNum = 1;
                foreach ($steps as $step) {
                    $name = $step['name'] ?? 'Unknown';
                    $desc = $step['description'] ?? '';
                    $priority = $step['priority'] ?? 'medium';
                    $needsConfirm = $step['requires_confirmation'] ?? false;

                    $lines[] = sprintf(
                        '%d. [%s] **%s**',
                        $stepNum,
                        strtoupper($priority),
                        $name
                    );
                    if ($desc) {
                        $lines[] = '   - ' . $this->escapeMarkdown($desc);
                    }
                    if ($needsConfirm) {
                        $lines[] = '   - ⚠️ Requires confirmation';
                    }
                    $lines[] = '';
                    $stepNum++;
                }
            }

            $lines[] = '### Output Files';
            $lines[] = '';
            if ($this->rollbackPlan->getManifestPath()) {
                $lines[] = '- **Manifest**: `' . $this->rollbackPlan->getManifestPath() . '`';
            }
            if ($this->rollbackPlan->getScriptPath()) {
                $lines[] = '- **Script**: `' . $this->rollbackPlan->getScriptPath() . '`';
            }
            $lines[] = '';
        }

        $lines[] = '---';
        $lines[] = '';
        $lines[] = '*Report generated by DeployFlow*';
        $lines[] = '';

        return implode("\n", $lines);
    }

    private function getSeverityIcon(string $severity): string
    {
        $icons = [
            'blocker' => '🚫',
            'error' => '❌',
            'warning' => '⚠️',
            'info' => 'ℹ️',
        ];
        return $icons[$severity] ?? '•';
    }

    private function getStepStatusIcon(string $status): string
    {
        $icons = [
            'ready' => '⏳',
            'in_progress' => '🔄',
            'completed' => '✅',
            'blocked' => '🚫',
            'skipped' => '⏭️',
            'pending_confirmation' => '❓',
            'failed' => '❌',
        ];
        return $icons[$status] ?? '•';
    }

    private function escapeMarkdown(string $text): string
    {
        $replacements = [
            '\\' => '\\\\',
            '`' => '\\`',
            '*' => '\\*',
            '_' => '\\_',
            '{' => '\\{',
            '}' => '\\}',
            '[' => '\\[',
            ']' => '\\]',
            '(' => '\\(',
            ')' => '\\)',
            '#' => '\\#',
            '+' => '\\+',
            '-' => '\\-',
            '.' => '\\.',
            '!' => '\\!',
        ];

        return strtr($text, $replacements);
    }
}
