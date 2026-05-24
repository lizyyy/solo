#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const types_1 = require("../types");
const options_1 = require("./options");
const scanner_1 = require("../scanner");
const reporter_1 = require("../reporter");
const program = new commander_1.Command();
program
    .name('smcheck')
    .description('Sourcemap 泄漏检查 CLI 工具 - 扫描前端产物中的 sourcemap 安全问题')
    .version('1.0.0')
    .option('-d, --dist <path>', '构建产物目录 (如 dist/)')
    .option('-s, --sourcemap <path>', 'sourcemap 文件或目录')
    .option('-j, --js <path>', 'JS 文件或目录')
    .option('-p, --public-path <path>', '公开访问路径 (如 https://example.com/static/)', '/')
    .option('-e, --exceptions <path>', '例外规则 JSON 文件路径')
    .option('-o, --output <path>', '报告输出目录/前缀', './sourcemap-report')
    .option('--no-fail-on-leak', '发现泄漏时不返回非零退出码')
    .option('-v, --verbose', '显示详细输出')
    .option('-q, --quiet', '静默模式，只输出错误')
    .action(async (options) => {
    try {
        const validation = (0, options_1.validateOptions)(options);
        if (!validation.valid) {
            console.error(chalk_1.default.red('❌ 参数验证失败:'));
            for (const error of validation.errors) {
                console.error(chalk_1.default.red(`  - ${error}`));
            }
            process.exit(types_1.EXIT_CODES.INVALID_OPTIONS);
        }
        if (validation.warnings.length > 0 && !options.quiet) {
            console.warn(chalk_1.default.yellow('⚠️  警告:'));
            for (const warning of validation.warnings) {
                console.warn(chalk_1.default.yellow(`  - ${warning}`));
            }
            console.log('');
        }
        const normalizedOptions = (0, options_1.normalizeOptions)(options);
        if (!normalizedOptions.quiet) {
            console.log(chalk_1.default.blue('🔍 开始扫描 sourcemap 泄漏...'));
        }
        const scanner = await (0, scanner_1.createScanner)(normalizedOptions);
        const report = await scanner.scan();
        const reporter = (0, reporter_1.createReporter)(report, normalizedOptions);
        reporter.printSummary();
        await reporter.writeJsonReport();
        await reporter.writeMarkdownReport();
        const exitCode = reporter.getExitCode();
        process.exit(exitCode);
    }
    catch (error) {
        console.error(chalk_1.default.red(`\n❌ 扫描失败: ${error.message}`));
        if (options.verbose) {
            console.error(error.stack);
        }
        process.exit(types_1.EXIT_CODES.SCAN_ERROR);
    }
});
program
    .command('init')
    .description('初始化例外规则文件模板')
    .option('-o, --output <path>', '输出文件路径', './smcheck-exceptions.json')
    .action(async (cmdOptions) => {
    const fs = await Promise.resolve().then(() => __importStar(require('fs')));
    const template = {
        $schema: 'https://example.com/smcheck-schema.json',
        description: 'Sourcemap 检查例外规则',
        exceptions: [
            {
                path: '**/vendor*.js',
                reason: '第三方库文件允许 sourcemap',
                expiresAt: '2025-12-31',
                createdAt: new Date().toISOString().split('T')[0],
                createdBy: 'security-team',
            },
        ],
    };
    try {
        await fs.promises.writeFile(cmdOptions.output, JSON.stringify(template, null, 2), 'utf-8');
        console.log(chalk_1.default.green(`✅ 例外规则模板已创建: ${cmdOptions.output}`));
        process.exit(types_1.EXIT_CODES.SUCCESS);
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ 创建失败: ${error.message}`));
        process.exit(types_1.EXIT_CODES.SCAN_ERROR);
    }
});
program.parseAsync(process.argv).catch((error) => {
    console.error(chalk_1.default.red(`❌ 未处理的错误: ${error.message}`));
    process.exit(types_1.EXIT_CODES.SCAN_ERROR);
});
//# sourceMappingURL=index.js.map