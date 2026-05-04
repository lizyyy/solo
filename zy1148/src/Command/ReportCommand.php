<?php

declare(strict_types=1);

namespace PhpSecurityScanner\Command;

use PhpSecurityScanner\Config;
use PhpSecurityScanner\ScannerEngine;
use PhpSecurityScanner\BaselineManager;
use PhpSecurityScanner\ReportGenerator;
use PhpSecurityScanner\Finding;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

class ReportCommand extends Command
{
    protected static $defaultName = 'report';

    protected function configure(): void
    {
        $this
            ->setDescription('生成安全扫描报告')
            ->setHelp('导出 Markdown、JSON 或 SARIF 格式的报告')
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
                '配置文件路径'
            )
            ->addOption(
                'format',
                'f',
                InputOption::VALUE_REQUIRED,
                '报告格式: markdown, json, sarif, all',
                'markdown'
            )
            ->addOption(
                'output',
                'o',
                InputOption::VALUE_REQUIRED,
                '输出目录或文件路径',
                './security-report'
            )
            ->addOption(
                'no-scan',
                null,
                InputOption::VALUE_NONE,
                '不执行扫描，使用上次的结果（如果有）'
            )
            ->addOption(
                'no-baseline',
                null,
                InputOption::VALUE_NONE,
                '不应用基线抑制'
            )
            ->addOption(
                'severity',
                's',
                InputOption::VALUE_REQUIRED,
                '仅包含指定严重级别 (critical, high, medium, low, info)'
            )
            ->addOption(
                'project-name',
                null,
                InputOption::VALUE_REQUIRED,
                '项目名称（用于报告标题）',
                'PHP Project'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $projectPath = rtrim($input->getOption('path'), '/');
        $configPath = $input->getOption('config');
        $format = strtolower($input->getOption('format'));
        $outputPath = rtrim($input->getOption('output'), '/');
        $noScan = $input->getOption('no-scan');
        $useBaseline = !$input->getOption('no-baseline');
        $severityFilter = $input->getOption('severity');
        $projectName = $input->getOption('project-name');

        $io->title('生成安全报告');
        $io->text("项目: <info>{$projectName}</info>");
        $io->text("路径: <info>{$projectPath}</info>");
        $io->text("格式: <info>{$format}</info>");
        $io->text("输出: <info>{$outputPath}</info>");
        $io->newLine();

        $findings = [];
        $suppressedCount = 0;

        if (!$noScan) {
            $io->text("执行扫描...");

            try {
                $config = $configPath ? new Config($configPath) : new Config();
                $engine = new ScannerEngine($config);
                $allFindings = $engine->scanAll($projectPath);

                if ($useBaseline) {
                    $baselineManager = new BaselineManager($projectPath);
                    if ($baselineManager->exists()) {
                        $result = $baselineManager->apply($allFindings);
                        $findings = $result['active'];
                        $suppressedCount = count($result['suppressed']);
                        $io->text("应用基线: 抑制 <info>{$suppressedCount}</info> 个历史问题");
                    } else {
                        $findings = $allFindings;
                    }
                } else {
                    $findings = $allFindings;
                    $io->text("跳过基线应用");
                }

                $io->text("发现 <info>" . count($findings) . "</info> 个活跃问题");
                $io->newLine();

            } catch (\Exception $e) {
                $io->error("扫描失败: " . $e->getMessage());
                return Command::FAILURE;
            }
        } else {
            $io->error("--no-scan 选项需要预先保存的结果文件，此版本暂不支持");
            $io->note("请运行不带 --no-scan 的命令进行扫描");
            return Command::FAILURE;
        }

        if ($severityFilter) {
            $findings = array_filter($findings, function (Finding $f) use ($severityFilter) {
                return $f->getSeverity() === $severityFilter;
            });
            $io->text("应用严重级别过滤器: <info>{$severityFilter}</info>");
            $io->newLine();
        }

        $reportGenerator = new ReportGenerator($projectPath, $projectName);

        $meta = [
            'scanned_at' => date('c'),
            'project_path' => $projectPath,
            'project_name' => $projectName,
            'suppressed_count' => $suppressedCount,
        ];

        $formats = [];
        if ($format === 'all') {
            $formats = ['markdown', 'json', 'sarif'];
        } else {
            $formats = [$format];
        }

        foreach ($formats as $fmt) {
            try {
                $filePath = $this->getOutputPath($outputPath, $fmt);
                $reportGenerator->writeReport($fmt, $filePath, $findings, $meta);
                $io->success("已生成: <info>{$filePath}</info>");
            } catch (\Exception $e) {
                $io->error("生成 {$fmt} 报告失败: " . $e->getMessage());
            }
        }

        $io->newLine();
        $io->text("报告摘要:");
        $io->text("  - 总问题数: <info>" . count($findings) . "</info>");
        $io->text("  - 抑制问题数: <info>{$suppressedCount}</info>");

        $severityCounts = [
            Finding::SEVERITY_CRITICAL => 0,
            Finding::SEVERITY_HIGH => 0,
            Finding::SEVERITY_MEDIUM => 0,
            Finding::SEVERITY_LOW => 0,
            Finding::SEVERITY_INFO => 0,
        ];

        foreach ($findings as $finding) {
            $severity = $finding->getSeverity();
            if (isset($severityCounts[$severity])) {
                $severityCounts[$severity]++;
            }
        }

        $io->newLine();
        $io->text("按严重级别分布:");
        $io->text("  - Critical: <fg=red>{$severityCounts[Finding::SEVERITY_CRITICAL]}</>");
        $io->text("  - High: <fg=yellow>{$severityCounts[Finding::SEVERITY_HIGH]}</>");
        $io->text("  - Medium: <fg=blue>{$severityCounts[Finding::SEVERITY_MEDIUM]}</>");
        $io->text("  - Low: <fg=green>{$severityCounts[Finding::SEVERITY_LOW]}</>");
        $io->text("  - Info: <fg=cyan>{$severityCounts[Finding::SEVERITY_INFO]}</>");

        return Command::SUCCESS;
    }

    private function getOutputPath(string $basePath, string $format): string
    {
        $extensions = [
            'markdown' => '.md',
            'md' => '.md',
            'json' => '.json',
            'sarif' => '.sarif.json',
        ];

        $ext = $extensions[$format] ?? '.txt';

        if (is_dir($basePath) || (!file_exists($basePath)) {
            return rtrim($basePath, '/') . '/security-report' . $ext;
        }

        $currentExt = pathinfo($basePath, PATHINFO_EXTENSION);
        if (empty($currentExt)) {
            return $basePath . $ext;
        }

        return $basePath;
    }
}
