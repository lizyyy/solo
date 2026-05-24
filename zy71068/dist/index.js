#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import { AuditEngine, VERSION } from './core/audit-engine.js';
import { SelfTestRunner } from './core/self-test.js';
import { EXIT_CODES } from './types.js';
import { logger } from './utils/logger.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const program = new Command();
program
    .name('font-license')
    .description('字体资产授权审计 CLI 工具')
    .version(VERSION, '-v, --version', '显示版本号')
    .helpOption('-h, --help', '显示帮助信息');
program
    .command('audit')
    .description('执行字体资产授权审计')
    .requiredOption('-p, --project <dir>', '项目目录路径')
    .option('-l, --license <file>', '授权清单 JSON 文件路径')
    .option('-o, --output <dir>', '输出目录', './font-license-report')
    .option('--no-remote', '不检查远程字体引用')
    .option('--fail-on <level>', '指定风险级别使命令失败 (critical|high|medium|low|info)')
    .option('--ext <extensions>', '额外的字体扩展名，逗号分隔', '')
    .option('-v, --verbose', '显示详细日志')
    .action(async (options) => {
    try {
        const config = {
            projectDir: path.resolve(options.project),
            licenseFile: options.license ? path.resolve(options.license) : undefined,
            outputDir: path.resolve(options.output),
            includeRemote: options.remote !== false,
            failOnRisk: options.failOn || null,
            customExtensions: options.ext ? options.ext.split(',').map((e) => e.trim()) : [],
        };
        const engine = new AuditEngine(config);
        const validation = await engine.validateInputs();
        if (!validation.valid) {
            logger.error('输入参数验证失败:');
            for (const error of validation.errors) {
                logger.error(`  - ${error}`);
            }
            process.exit(EXIT_CODES.INPUT_ERROR);
        }
        const { exitCode } = await engine.run(options.verbose);
        process.exit(exitCode);
    }
    catch (error) {
        logger.error(`执行错误: ${error.message}`);
        process.exit(EXIT_CODES.SCAN_ERROR);
    }
});
program
    .command('self-test')
    .description('运行自检，验证工具功能正常')
    .option('-o, --output <dir>', '测试输出目录', './self-test-output')
    .option('-v, --verbose', '显示详细日志')
    .action(async (options) => {
    try {
        const runner = new SelfTestRunner(path.resolve(options.output), options.verbose);
        const passed = await runner.runAll();
        if (passed) {
            logger.success('所有自检通过！');
            process.exit(EXIT_CODES.SUCCESS);
        }
        else {
            logger.error('部分自检失败，请检查输出');
            process.exit(EXIT_CODES.TEST_FAILED);
        }
    }
    catch (error) {
        logger.error(`自检错误: ${error.message}`);
        process.exit(EXIT_CODES.TEST_FAILED);
    }
});
program
    .command('init-license')
    .description('创建授权清单模板')
    .option('-o, --output <file>', '输出文件路径', './licenses.json')
    .action(async (options) => {
    const template = {
        $schema: 'https://github.com/your-repo/font-license-audit/raw/main/schema.json',
        licenses: [
            {
                familyName: '字体名称',
                alternativeNames: ['别名1', '别名2'],
                licenseType: 'SIL OFL / Apache 2.0 / Commercial / ...',
                version: '1.0.0',
                validFrom: '2024-01-01',
                validUntil: '2025-01-01',
                permittedUses: ['web', 'print', 'app'],
                restrictions: ['不允许修改字体文件'],
                sourceUrl: 'https://fonts.example.com/font-name',
                attribution: '字体由 Example Foundry 设计',
            },
        ],
    };
    const fs = await import('fs/promises');
    const outputPath = path.resolve(options.output);
    await fs.writeFile(outputPath, JSON.stringify(template, null, 2), 'utf-8');
    logger.success(`授权清单模板已创建: ${outputPath}`);
});
program.parse();
//# sourceMappingURL=index.js.map