<?php

declare(strict_types=1);

namespace PhpSecurityScanner\Command;

use PhpSecurityScanner\Config;
use PhpSecurityScanner\ScannerEngine;
use PhpSecurityScanner\Finding;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

class AuditDepsCommand extends Command
{
    protected static $defaultName = 'audit-deps';

    protected function configure(): void
    {
        $this
            ->setDescription('审计 Composer 依赖的安全漏洞')
            ->setHelp('检查 composer.lock 中已安装的依赖包是否存在已知安全漏洞')
            ->addOption(
                'path',
                'p',
                InputOption::VALUE_REQUIRED,
                '项目路径',
                getcwd()
            )
            ->addOption(
                'lock-file',
                'l',
                InputOption::VALUE_REQUIRED,
                'composer.lock 文件路径'
            )
            ->addOption(
                'include-dev',
                'd',
                InputOption::VALUE_NONE,
                '包含开发依赖 (require-dev)'
            )
            ->addOption(
                'format',
                'f',
                InputOption::VALUE_REQUIRED,
                '输出格式 (table, json, compact)',
                'table'
            )
            ->addOption(
                'severity',
                's',
                InputOption::VALUE_REQUIRED,
                '仅显示指定严重级别 (critical, high, medium, low, info)'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $projectPath = rtrim($input->getOption('path'), '/');
        $lockFilePath = $input->getOption('lock-file');
        $includeDev = $input->getOption('include-dev');
        $format = $input->getOption('format');
        $severityFilter = $input->getOption('severity');

        $io->title('Composer 依赖审计');

        if (!$lockFilePath) {
            $lockFilePath = $projectPath . '/composer.lock';
        }

        if (!file_exists($lockFilePath)) {
            $io->error("未找到 composer.lock 文件: {$lockFilePath}");
            $io->note("请确保在项目根目录运行 composer install 生成 lock 文件");
            return Command::FAILURE;
        }

        $io->text("Lock 文件: <info>{$lockFilePath}</info>");
        $io->text("包含开发依赖: " . ($includeDev ? '<info>是</info>' : '<comment>否</comment>'));
        $io->newLine();

        try {
            $config = new Config();
            $engine = new ScannerEngine($config);
            
            $findings = $engine->scanDependencies($projectPath);

            if (!$includeDev) {
                $findings = array_filter($findings, function (Finding $f) {
                    $evidence = $f->getEvidence();
                    return !str_contains($evidence, '仅开发依赖');
                });
            }

            if ($severityFilter) {
                $findings = array_filter($findings, function (Finding $f) use ($severityFilter) {
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

            foreach ($findings as $finding) {
                $severity = $finding->getSeverity();
                if (isset($counts[$severity])) {
                    $counts[$severity]++;
                }
            }

            $total = count($findings);

            $io->section('依赖审计摘要');

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

            if ($total === 0) {
                $io->success("未发现已知漏洞的依赖包");
                $io->note("扫描结果基于内置漏洞数据库。建议定期运行 composer audit 或使用外部服务如 SensioLabs Security Checker");
                return Command::SUCCESS;
            }

            if ($format === 'json') {
                $jsonData = [
                    'summary' => $counts,
                    'total' => $total,
                    'findings' => array_map(function (Finding $f) {
                        return $f->toArray();
                    }, $findings),
                ];
                $io->write(json_encode($jsonData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                return Command::SUCCESS;
            }

            if ($format === 'compact') {
                foreach ($findings as $finding) {
                    $severity = strtoupper($finding->getSeverity());
                    $io->text("[{$severity}] {$finding->getEvidence()}");
                }
                return Command::SUCCESS;
            }

            $io->section('详细漏洞列表');

            $severityOrder = [
                Finding::SEVERITY_CRITICAL,
                Finding::SEVERITY_HIGH,
                Finding::SEVERITY_MEDIUM,
                Finding::SEVERITY_LOW,
                Finding::SEVERITY_INFO,
            ];

            $severityLabels = [
                Finding::SEVERITY_CRITICAL => '🔴 Critical',
                Finding::SEVERITY_HIGH => '🟠 High',
                Finding::SEVERITY_MEDIUM => '🟡 Medium',
                Finding::SEVERITY_LOW => '🟢 Low',
                Finding::SEVERITY_INFO => '🔵 Info',
            ];

            foreach ($severityOrder as $severity) {
                $severityFindings = array_filter($findings, function (Finding $f) use ($severity) {
                    return $f->getSeverity() === $severity;
                });

                if (empty($severityFindings)) {
                    continue;
                }

                $io->writeln($severityLabels[$severity]);
                $io->newLine();

                foreach ($severityFindings as $finding) {
                    $io->text("<options=bold>⚠️  {$finding->getRuleId()}</>");
                    $io->text("   证据: <fg=yellow>{$finding->getEvidence()}</>");
                    $io->text("   问题: {$finding->getReason()}");
                    $io->text("   修复: <fg=green>{$finding->getRemediation()}</>");
                    $io->newLine();
                }
            }

            $io->section('建议');
            $io->listing([
                '运行 composer update <package> 更新存在漏洞的依赖',
                '检查是否有其他兼容的版本可用',
                '考虑使用 composer audit 进行官方漏洞检查',
                '查看 Packagist 或 GitHub Security Advisories 获取更多信息',
            ]);

            $exitCode = ($counts[Finding::SEVERITY_CRITICAL] > 0 || $counts[Finding::SEVERITY_HIGH] > 0)
                ? Command::FAILURE
                : Command::SUCCESS;

            return $exitCode;

        } catch (\Exception $e) {
            $io->error("依赖审计失败: " . $e->getMessage());
            $io->note("错误详情: " . $e->getTraceAsString());
            return Command::FAILURE;
        }
    }
}
