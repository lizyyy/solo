<?php

declare(strict_types=1);

namespace PhpSecurityScanner;

class ReportGenerator
{
    private string $projectPath;
    private string $projectName;

    public function __construct(string $projectPath, string $projectName = 'PHP Project')
    {
        $this->projectPath = $projectPath;
        $this->projectName = $projectName;
    }

    public function generateJson(array $findings, array $meta = []): string
    {
        $report = [
            'schema_version' => '1.0.0',
            'generated_at' => date('c'),
            'project' => [
                'name' => $this->projectName,
                'path' => $this->projectPath,
            ],
            'summary' => $this->generateSummary($findings),
            'findings' => array_map(function (Finding $finding) {
                return $finding->toArray();
            }, $findings),
            'meta' => $meta,
        ];

        return json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    public function generateMarkdown(array $findings, array $meta = []): string
    {
        $summary = $this->generateSummary($findings);
        
        $markdown = "# 安全扫描报告\n\n";
        $markdown .= "**项目**: {$this->projectName}\n\n";
        $markdown .= "**扫描时间**: " . date('Y-m-d H:i:s') . "\n\n";
        $markdown .= "**扫描路径**: {$this->projectPath}\n\n";
        
        $markdown .= "## 摘要\n\n";
        
        $markdown .= "| 严重级别 | 数量 |\n";
        $markdown .= "|----------|------|\n";
        $markdown .= "| 🔴 Critical | {$summary['severities'][Finding::SEVERITY_CRITICAL]} |\n";
        $markdown .= "| 🟠 High | {$summary['severities'][Finding::SEVERITY_HIGH]} |\n";
        $markdown .= "| 🟡 Medium | {$summary['severities'][Finding::SEVERITY_MEDIUM]} |\n";
        $markdown .= "| 🟢 Low | {$summary['severities'][Finding::SEVERITY_LOW]} |\n";
        $markdown .= "| 🔵 Info | {$summary['severities'][Finding::SEVERITY_INFO]} |\n";
        $markdown .= "| **总计** | **{$summary['total']}** |\n\n";

        if (isset($meta['suppressed_count']) && $meta['suppressed_count'] > 0) {
            $markdown .= "⚠️ **已抑制的问题**: {$meta['suppressed_count']} 个 (在 baseline 中)\n\n";
        }

        $markdown .= "---\n\n";

        if (empty($findings)) {
            $markdown .= "✅ 未发现安全问题。\n\n";
            return $markdown;
        }

        $grouped = [];
        foreach ($findings as $finding) {
            $severity = $finding->getSeverity();
            if (!isset($grouped[$severity])) {
                $grouped[$severity] = [];
            }
            $grouped[$severity][] = $finding;
        }

        $severityOrder = [
            Finding::SEVERITY_CRITICAL,
            Finding::SEVERITY_HIGH,
            Finding::SEVERITY_MEDIUM,
            Finding::SEVERITY_LOW,
            Finding::SEVERITY_INFO,
        ];

        $severityEmoji = [
            Finding::SEVERITY_CRITICAL => '🔴',
            Finding::SEVERITY_HIGH => '🟠',
            Finding::SEVERITY_MEDIUM => '🟡',
            Finding::SEVERITY_LOW => '🟢',
            Finding::SEVERITY_INFO => '🔵',
        ];

        $severityLabel = [
            Finding::SEVERITY_CRITICAL => 'Critical (严重)',
            Finding::SEVERITY_HIGH => 'High (高危)',
            Finding::SEVERITY_MEDIUM => 'Medium (中危)',
            Finding::SEVERITY_LOW => 'Low (低危)',
            Finding::SEVERITY_INFO => 'Info (信息)',
        ];

        foreach ($severityOrder as $severity) {
            if (!isset($grouped[$severity]) || empty($grouped[$severity])) {
                continue;
            }

            $count = count($grouped[$severity]);
            $markdown .= "## {$severityEmoji[$severity]} {$severityLabel[$severity]} ({$count} 个)\n\n";

            foreach ($grouped[$severity] as $index => $finding) {
                $num = $index + 1;
                $markdown .= "### {$num}. {$finding->getRuleId()}\n\n";
                
                $markdown .= "| 属性 | 详情 |\n";
                $markdown .= "|------|------|\n";
                $markdown .= "| 文件 | `{$finding->getFilePath()}` |\n";
                $markdown .= "| 行号 | {$finding->getLineNumber()} |\n";
                $markdown .= "| 可信度 | {$this->confidenceLabel($finding->getConfidence())} |\n";
                $markdown .= "| 类别 | {$this->categoryLabel($finding->getCategory())} |\n\n";

                $markdown .= "**证据**:\n\n";
                $markdown .= "```\n{$finding->getEvidence()}\n```\n\n";

                if ($finding->getSnippet()) {
                    $markdown .= "**代码片段**:\n\n";
                    $markdown .= "```php\n{$finding->getSnippet()}\n```\n\n";
                }

                $markdown .= "**问题说明**:\n\n";
                $markdown .= "{$finding->getReason()}\n\n";

                $markdown .= "**修复建议**:\n\n";
                $markdown .= "{$finding->getRemediation()}\n\n";

                $markdown .= "---\n\n";
            }
        }

        $markdown .= "## 附录\n\n";
        $markdown .= "### 严重级别说明\n\n";
        $markdown .= "- **Critical (🔴)**: 立即需要修复的严重漏洞，可能导致系统被完全控制\n";
        $markdown .= "- **High (🟠)**: 需要尽快修复的高危漏洞，可能导致敏感数据泄露\n";
        $markdown .= "- **Medium (🟡)**: 中等风险漏洞，建议在合理时间内修复\n";
        $markdown .= "- **Low (🟢)**: 低风险问题，最佳实践建议\n";
        $markdown .= "- **Info (🔵)**: 信息性提示，需要关注但不紧急\n\n";

        $markdown .= "### 可信度说明\n\n";
        $markdown .= "- **High**: 高度可信，问题已确认存在\n";
        $markdown .= "- **Medium**: 中等可信，可能存在误报，需要人工确认\n";
        $markdown .= "- **Low**: 低可信度，建议审查但可能是误报\n\n";

        return $markdown;
    }

    public function generateSarif(array $findings, array $meta = []): string
    {
        $rules = $this->collectRules($findings);

        $sarif = [
            '$schema' => 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
            'version' => '2.1.0',
            'runs' => [
                [
                    'tool' => [
                        'driver' => [
                            'name' => 'PHP Security Scanner',
                            'version' => '1.0.0',
                            'informationUri' => 'https://github.com/php-security-scanner',
                            'rules' => $rules,
                        ],
                    ],
                    'invocations' => [
                        [
                            'executionSuccessful' => true,
                            'startTimeUtc' => date('c'),
                        ],
                    ],
                    'artifacts' => $this->collectArtifacts($findings),
                    'results' => $this->convertToSarifResults($findings),
                ],
            ],
        ];

        return json_encode($sarif, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    private function generateSummary(array $findings): array
    {
        $severities = [
            Finding::SEVERITY_CRITICAL => 0,
            Finding::SEVERITY_HIGH => 0,
            Finding::SEVERITY_MEDIUM => 0,
            Finding::SEVERITY_LOW => 0,
            Finding::SEVERITY_INFO => 0,
        ];

        $categories = [];

        foreach ($findings as $finding) {
            $severity = $finding->getSeverity();
            if (isset($severities[$severity])) {
                $severities[$severity]++;
            }

            $category = $finding->getCategory();
            if (!isset($categories[$category])) {
                $categories[$category] = 0;
            }
            $categories[$category]++;
        }

        return [
            'total' => count($findings),
            'severities' => $severities,
            'categories' => $categories,
        ];
    }

    private function confidenceLabel(string $confidence): string
    {
        $labels = [
            Finding::CONFIDENCE_HIGH => 'High (高)',
            Finding::CONFIDENCE_MEDIUM => 'Medium (中)',
            Finding::CONFIDENCE_LOW => 'Low (低)',
        ];
        return $labels[$confidence] ?? $confidence;
    }

    private function categoryLabel(string $category): string
    {
        $labels = [
            'code_security' => '代码安全',
            'template_security' => '模板安全',
            'config_security' => '配置安全',
            'upload_security' => '上传安全',
            'dependency_security' => '依赖安全',
            'route_security' => '路由安全',
        ];
        return $labels[$category] ?? $category;
    }

    private function collectRules(array $findings): array
    {
        $rules = [];
        $ruleIds = [];

        foreach ($findings as $finding) {
            $ruleId = $finding->getRuleId();
            if (isset($ruleIds[$ruleId])) {
                continue;
            }
            $ruleIds[$ruleId] = true;

            $rules[] = [
                'id' => $ruleId,
                'shortDescription' => [
                    'text' => $finding->getReason(),
                ],
                'fullDescription' => [
                    'text' => $finding->getReason(),
                ],
                'help' => [
                    'text' => $finding->getRemediation(),
                    'markdown' => "## 修复建议\n\n" . $finding->getRemediation(),
                ],
                'properties' => [
                    'category' => $finding->getCategory(),
                    'severity' => $finding->getSeverity(),
                ],
            ];
        }

        return $rules;
    }

    private function collectArtifacts(array $findings): array
    {
        $artifacts = [];
        $paths = [];

        foreach ($findings as $finding) {
            $path = $finding->getFilePath();
            if (isset($paths[$path])) {
                continue;
            }
            $paths[$path] = true;

            $artifacts[] = [
                'location' => [
                    'uri' => $path,
                    'uriBaseId' => '%SRCROOT%',
                ],
            ];
        }

        return $artifacts;
    }

    private function convertToSarifResults(array $findings): array
    {
        $results = [];

        $severityToLevel = [
            Finding::SEVERITY_CRITICAL => 'error',
            Finding::SEVERITY_HIGH => 'error',
            Finding::SEVERITY_MEDIUM => 'warning',
            Finding::SEVERITY_LOW => 'note',
            Finding::SEVERITY_INFO => 'note',
        ];

        foreach ($findings as $finding) {
            $level = $severityToLevel[$finding->getSeverity()] ?? 'note';

            $results[] = [
                'ruleId' => $finding->getRuleId(),
                'level' => $level,
                'message' => [
                    'text' => $finding->getReason(),
                ],
                'locations' => [
                    [
                        'physicalLocation' => [
                            'artifactLocation' => [
                                'uri' => $finding->getFilePath(),
                                'uriBaseId' => '%SRCROOT%',
                            ],
                            'region' => [
                                'startLine' => $finding->getLineNumber(),
                                'snippet' => [
                                    'text' => $finding->getEvidence(),
                                ],
                            ],
                        ],
                    ],
                ],
                'properties' => [
                    'confidence' => $finding->getConfidence(),
                    'category' => $finding->getCategory(),
                    'remediation' => $finding->getRemediation(),
                ],
            ];
        }

        return $results;
    }

    public function writeReport(string $type, string $outputPath, array $findings, array $meta = []): void
    {
        $content = '';

        switch (strtolower($type)) {
            case 'json':
                $content = $this->generateJson($findings, $meta);
                break;
            case 'markdown':
            case 'md':
                $content = $this->generateMarkdown($findings, $meta);
                break;
            case 'sarif':
                $content = $this->generateSarif($findings, $meta);
                break;
            default:
                throw new \InvalidArgumentException("Unsupported report type: {$type}");
        }

        $dir = dirname($outputPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        if (file_put_contents($outputPath, $content) === false) {
            throw new \RuntimeException("Failed to write report to: {$outputPath}");
        }
    }
}
