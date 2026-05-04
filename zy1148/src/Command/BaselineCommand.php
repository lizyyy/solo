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
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

class BaselineCommand extends Command
{
    protected static $defaultName = 'baseline';

    protected function configure(): void
    {
        $this
            ->setDescription('管理扫描基线 (baseline)')
            ->setHelp('创建、更新或查看基线，用于抑制已知的历史问题')
            ->addArgument(
                'action',
                InputArgument::OPTIONAL,
                '操作类型: create, update, list, status, clear',
                'status'
            )
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
                'add-new',
                null,
                InputOption::VALUE_NONE,
                '更新时添加新发现的问题到基线'
            )
            ->addOption(
                'keep-missing',
                null,
                InputOption::VALUE_NONE,
                '更新时保留已不存在的问题'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $action = $input->getArgument('action');
        $projectPath = rtrim($input->getOption('path'), '/');
        $configPath = $input->getOption('config');
        $addNew = $input->getOption('add-new');
        $keepMissing = $input->getOption('keep-missing');

        $io->title('基线管理');
        $io->text("项目路径: <info>{$projectPath}</info>");
        $io->text("操作: <info>{$action}</info>");
        $io->newLine();

        $baselineManager = new BaselineManager($projectPath);

        switch ($action) {
            case 'create':
                return $this->createBaseline($io, $baselineManager, $projectPath, $configPath);

            case 'update':
                return $this->updateBaseline($io, $baselineManager, $projectPath, $configPath, $addNew, $keepMissing);

            case 'list':
                return $this->listBaseline($io, $baselineManager);

            case 'status':
                return $this->showStatus($io, $baselineManager);

            case 'clear':
                return $this->clearBaseline($io, $baselineManager);

            default:
                $io->error("未知操作: {$action}");
                $io->note("可用操作: create, update, list, status, clear");
                return Command::FAILURE;
        }
    }

    private function createBaseline(
        SymfonyStyle $io,
        BaselineManager $baselineManager,
        string $projectPath,
        ?string $configPath
    ): int {
        if ($baselineManager->exists()) {
            $confirmed = $io->confirm('基线文件已存在，是否覆盖?', false);
            if (!$confirmed) {
                $io->text("已取消");
                return Command::SUCCESS;
            }
        }

        $io->text("执行扫描以创建基线...");
        $io->newLine();

        try {
            $config = $configPath ? new Config($configPath) : new Config();
            $engine = new ScannerEngine($config);
            $findings = $engine->scanAll($projectPath);

            $count = count($findings);
            $io->text("发现 <info>{$count}</info> 个问题");

            if ($count === 0) {
                $io->note("没有发现任何问题，创建空基线");
            }

            $baselineManager->create($findings);

            $io->success("基线已创建: {$baselineManager->getPath()}");
            $io->text("后续扫描将使用此基线抑制已知问题");

            return Command::SUCCESS;

        } catch (\Exception $e) {
            $io->error("创建基线失败: " . $e->getMessage());
            return Command::FAILURE;
        }
    }

    private function updateBaseline(
        SymfonyStyle $io,
        BaselineManager $baselineManager,
        string $projectPath,
        ?string $configPath,
        bool $addNew,
        bool $keepMissing
    ): int {
        if (!$baselineManager->exists()) {
            $io->error("基线文件不存在，请先运行 scansec baseline create");
            return Command::FAILURE;
        }

        $io->text("执行扫描以更新基线...");
        $io->newLine();

        try {
            $config = $configPath ? new Config($configPath) : new Config();
            $engine = new ScannerEngine($config);
            $findings = $engine->scanAll($projectPath);

            $existingCount = $baselineManager->getSuppressedCount();
            $currentCount = count($findings);

            $io->text("现有基线: <info>{$existingCount}</info> 个抑制项");
            $io->text("当前扫描: <info>{$currentCount}</info> 个问题");

            $removeMissing = !$keepMissing;
            $baselineManager->update($findings, $addNew, $removeMissing);

            $newCount = $baselineManager->getSuppressedCount();
            $io->success("基线已更新");
            $io->text("更新后: <info>{$newCount}</info> 个抑制项");

            if ($addNew) {
                $io->note("已添加新发现的问题到基线");
            }
            if ($removeMissing) {
                $io->note("已移除不再存在的问题");
            }

            return Command::SUCCESS;

        } catch (\Exception $e) {
            $io->error("更新基线失败: " . $e->getMessage());
            return Command::FAILURE;
        }
    }

    private function listBaseline(SymfonyStyle $io, BaselineManager $baselineManager): int
    {
        if (!$baselineManager->exists()) {
            $io->text("基线文件不存在");
            return Command::SUCCESS;
        }

        $baseline = $baselineManager->load();
        $suppressed = $baseline['suppressed_findings'] ?? [];

        if (empty($suppressed)) {
            $io->text("基线文件存在但没有抑制项");
            return Command::SUCCESS;
        }

        $io->section("基线抑制项列表 (" . count($suppressed) . ")");

        $io->text("创建时间: " . ($baseline['created_at'] ?? '未知'));
        if (isset($baseline['updated_at'])) {
            $io->text("更新时间: " . $baseline['updated_at']);
        }
        $io->newLine();

        $tableRows = [];
        foreach ($suppressed as $index => $item) {
            $tableRows[] = [
                $index + 1,
                $item['rule_id'] ?? 'N/A',
                basename($item['file_path'] ?? 'N/A'),
                $item['line_number'] ?? 'N/A',
                $item['suppressed_at'] ?? 'N/A',
            ];
        }

        $io->table(
            ['#', '规则 ID', '文件', '行', '抑制时间'],
            $tableRows
        );

        return Command::SUCCESS;
    }

    private function showStatus(SymfonyStyle $io, BaselineManager $baselineManager): int
    {
        if (!$baselineManager->exists()) {
            $io->text("基线状态: <fg=yellow>不存在</>");
            $io->newLine();
            $io->text("运行 <info>scansec baseline create</info> 创建基线");
            return Command::SUCCESS;
        }

        $baseline = $baselineManager->load();
        $count = $baselineManager->getSuppressedCount();

        $io->text("基线状态: <fg=green>存在</>");
        $io->text("基线文件: <info>{$baselineManager->getPath()}</info>");
        $io->text("创建时间: <info>" . ($baseline['created_at'] ?? '未知') . "</info>");
        if (isset($baseline['updated_at'])) {
            $io->text("更新时间: <info>" . $baseline['updated_at'] . "</info>");
        }
        $io->text("抑制项数量: <info>{$count}</info>");
        $io->newLine();

        $io->text("运行 <info>scansec baseline list</info> 查看详情");
        $io->text("运行 <info>scansec baseline update</info> 更新基线");

        return Command::SUCCESS;
    }

    private function clearBaseline(SymfonyStyle $io, BaselineManager $baselineManager): int
    {
        if (!$baselineManager->exists()) {
            $io->text("基线文件不存在");
            return Command::SUCCESS;
        }

        $confirmed = $io->confirm('确定要删除基线文件吗?', false);
        if (!$confirmed) {
            $io->text("已取消");
            return Command::SUCCESS;
        }

        $path = $baselineManager->getPath();
        if (unlink($path)) {
            $io->success("基线文件已删除: {$path}");
            return Command::SUCCESS;
        }

        $io->error("删除失败: {$path}");
        return Command::FAILURE;
    }
}
