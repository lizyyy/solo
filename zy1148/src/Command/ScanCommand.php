<?php

declare(strict_types=1);

namespace PhpSecurityScanner\Command;

use PhpSecurityScanner\Config;
use PhpSecurityScanner\ScannerEngine;
use PhpSecurityScanner\BaselineManager;
use PhpSecurityScanner\Finding;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

class ScanCommand extends Command
{
    protected static $defaultName = 'scan';

    protected function configure(): void
    {
        $this
            ->setDescription('扫描项目中的安全问题')
            ->setHelp('执行完整的安全扫描，包括代码、模板、配置、路由等')
            ->addOption(
                'path',
                'p',
                InputOption::VALUE_REQUIRED,
                '项目路径',
                getcwd()
            )
            ->addOption(
                'config',
                'c',
                InputOption::VALUE_REQUIRED,
                '配置文件路径 (security-rules.yaml)'
            )
            ->addOption(
                'no-baseline',
                null,
                InputOption::VALUE_NONE,
                '不使用 baseline 抑制历史问题'
            )
            ->addOption(
                'severity',
                's',
                InputOption::VALUE_REQUIRED,
                '仅显示指定严重级别的问题 (critical, high, medium, low, info)'
            )
            ->addOption(
                'output',
                'o',
                InputOption::VALUE_REQUIRED,
                '输出格式 (table, json, compact)',
                'table'
            )
            ->addOption(
                'scanners',
                null,
                InputOption::VALUE_REQUIRED,
                '指定使用的扫描器 (php, template, config, upload, route)，用逗号分隔'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $projectPath = rtrim($input->getOption('path'), '/');
        $configPath = $input->getOption('config');
        $useBaseline = !$input->getOption('no-baseline');
        $severityFilter = $input->getOption('severity');
        $outputFormat = $input->getOption('output');
        $scannersOption = $input->getOption('scanners');

        $io->title('PHP 安全扫描');
        $io->text("扫描路径: <info>{$projectPath}</info>");

        if (!$configPath) {
            $configPath = $projectPath . '/security-rules.yaml';
            if (!file_exists($configPath)) {
                $configPath = null;
            }
        }

        try {
            $config = new Config($configPath);
        } catch (\Exception $e) {
            $io->error("配置加载失败: " . $e->getMessage());
            return Command::FAILURE;
        }

        $scanners = [];
        if ($scannersOption) {
            $scanners = array_map('trim', explode(',', $scannersOption));
            $io->text("指定扫描器: <info>" . implode(', ', $scanners) . "</info>");
        }

        $engine = new ScannerEngine($config);
        
        $io->text("正在扫描...");
        $io->newLine();

        $allFindings = empty($scanners) 
            ? $engine->scanAll($projectPath)
            : $engine->scan($projectPath, $scanners);

        $suppressedCount = 0;
        $activeFindings = $allFindings;

        if ($useBaseline) {
            $baselineManager = new BaselineManager($projectPath);
            if ($baselineManager->exists()) {
                $result = $baselineManager->apply($allFindings);
                $activeFindings = $result['active'];
                $suppressedCount = count($result['suppressed']);
                $io->text("已应用 baseline: 抑制 <info>{$suppressedCount}</info> 个历史问题");
            }
        }

        if ($severityFilter) {
            $activeFindings = array_filter($activeFindings, function (Finding $f) use ($severityFilter) {
                return $f->getSeverity() === $severityFilter;
            });
        }

        $counts = [
            Finding::SEVERITY_CRITICAL => 0,
            Finding::SEVERITY_HIGH => 0,
            Finding::SEVERITY_MEDIUM => 0,
            Finding::SEVERITY_LOW => 0,
            Finding::SEVERITY_INFO => 0,
        ];

        foreach ($activeFindings as $finding) {
            $severity = $finding->getSeverity();
            if (isset($counts[$severity])) {
                $counts[$severity]++;
            }
        }

        $total = count($activeFindings);

        $io->section('扫描结果摘要');
        
        $io->table(
            ['严重级别', '数量'],
            [
                ['<fg=red;options=bold>Critical</>', $counts[Finding::SEVERITY_CRITICAL]],
                ['<fg=yellow;options=bold>High</>', $counts[Finding::SEVERITY_HIGH]],
                ['<fg=blue;options=bold>Medium</>', $counts[Finding::SEVERITY_MEDIUM]],
                ['<fg=green;options=bold>Low</>', $counts[Finding::SEVERITY_LOW]],
                ['<fg=cyan;options=bold>Info</>', $counts[Finding::SEVERITY_INFO]],
                ['<options=bold>总计</>', "<options=bold>{$total}</>"],
            ]
        );

        if ($suppressedCount > 0) {
            $io->text("已抑制的历史问题: <info>{$suppressedCount}</info> 个");
        }

        if ($total === 0) {
            $io->success("未发现安全问题");
            return Command::SUCCESS;
        }

        if ($outputFormat === 'json') {
            $jsonData = [
                'summary' => $counts,
                'total' => $total,
                'suppressed' => $suppressedCount,
                'findings' => array_map(function (Finding $f) {
                    return $f->toArray();
                }, $activeFindings),
            ];
            $io->write(json_encode($jsonData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            return Command::SUCCESS;
        }

        if ($outputFormat === 'compact') {
            foreach ($activeFindings as $finding) {
                $severity = strtoupper($finding->getSeverity());
                $file = basename($finding->getFilePath());
                $line = $finding->getLineNumber();
                $io->text("[{$severity}] {$file}:{$line} - {$finding->getRuleId()}");
            }
            return Command::SUCCESS;
        }

        $io->section('详细发现');

        $severityOrder = [
            Finding::SEVERITY_CRITICAL,
            Finding::SEVERITY_HIGH,
            Finding::SEVERITY_MEDIUM,
            Finding::SEVERITY_LOW,
            Finding::SEVERITY_INFO,
        ];

        $severityLabels = [
            Finding::SEVERITY_CRITICAL => '🔴 Critical (严重)',
            Finding::SEVERITY_HIGH => '🟠 High (高危)',
            Finding::SEVERITY_MEDIUM => '🟡 Medium (中危)',
            Finding::SEVERITY_LOW => '🟢 Low (低危)',
            Finding::SEVERITY_INFO => '🔵 Info (信息)',
        ];

        foreach ($severityOrder as $severity) {
            $findings = array_filter($activeFindings, function (Finding $f) use ($severity) {
                return $f->getSeverity() === $severity;
            });

            if (empty($findings)) {
                continue;
            }

            $io->section($severityLabels[$severity] . ' (' . count($findings) . ')');

            foreach ($findings as $index => $finding) {
                $num = $index + 1;
                $io->text("<options=bold>{$num}. {$finding->getRuleId()}</>");
                $io->text("   文件: <comment>{$finding->getFilePath()}</comment>:{$finding->getLineNumber()}");
                $io->text("   可信度: <info>{$finding->getConfidence()}</info>");
                $io->text("   类别: <info>{$finding->getCategory()}</info>");
                $io->text("   证据: <fg=yellow>{$finding->getEvidence()}</>");
                $io->newLine();
                $io->text("   问题: {$finding->getReason()}");
                $io->text("   修复: <fg=green>{$finding->getRemediation()}</>");
                
                if ($finding->getSnippet()) {
                    $io->newLine();
                    $io->text("   代码片段:");
                    foreach (explode("\n", $finding->getSnippet()) as $line) {
                        $io->text("   <comment>{$line}</comment>");
                    }
                }
                $io->newLine();
            }
        }

        $exitCode = ($counts[Finding::SEVERITY_CRITICAL] > 0 || $counts[Finding::SEVERITY_HIGH] > 0)
            ? Command::FAILURE
            : Command::SUCCESS;

        return $exitCode;
    }
}
