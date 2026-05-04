<?php

declare(strict_types=1);

namespace PhpSecurityScanner\Command;

use PhpSecurityScanner\Config;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

class InitCommand extends Command
{
    protected static $defaultName = 'init';

    protected function configure(): void
    {
        $this
            ->setDescription('在项目中初始化安全扫描配置')
            ->setHelp('创建默认的 security-rules.yaml 配置文件')
            ->addOption(
                'path',
                'p',
                InputOption::VALUE_REQUIRED,
                '项目路径',
                getcwd()
            )
            ->addOption(
                'force',
                'f',
                InputOption::VALUE_NONE,
                '覆盖已存在的配置文件'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $projectPath = rtrim($input->getOption('path'), '/');
        $force = $input->getOption('force');

        $configFile = $projectPath . '/security-rules.yaml';

        if (file_exists($configFile) && !$force) {
            $io->error("配置文件已存在: {$configFile}");
            $io->note("使用 --force (-f) 选项覆盖现有配置");
            return Command::FAILURE;
        }

        $config = new Config();
        $defaultRules = $config->getDefaultSecurityRules();

        $dir = dirname($configFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        if (file_put_contents($configFile, $defaultRules) === false) {
            $io->error("无法写入配置文件: {$configFile}");
            return Command::FAILURE;
        }

        $io->success("配置文件已创建: {$configFile}");

        $io->section('创建的默认配置');
        $io->text($defaultRules);

        $io->section('下一步');
        $io->listing([
            '编辑 security-rules.yaml 调整扫描规则',
            '运行 scansec scan 开始扫描',
            '运行 scansec audit-deps 审计依赖',
        ]);

        return Command::SUCCESS;
    }
}
