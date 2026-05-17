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
const drift_detector_1 = require("./drift-detector");
const report_generator_1 = require("./report-generator");
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const program = new commander_1.Command();
program
    .name('scaffold-drift')
    .description('检测仓库与脚手架模板的漂移')
    .version('1.0.0');
program
    .command('check', { isDefault: true })
    .description('检测仓库脚手架漂移')
    .requiredOption('-r, --repo <path>', '仓库目录路径')
    .requiredOption('-t, --template <path>', '模板目录路径')
    .option('-o, --output <path>', '报告输出目录', './drift-reports')
    .option('-f, --format <format>', '输出格式: json|markdown|both', 'both')
    .option('-d, --detail', '显示详细差异', false)
    .option('-p, --preview', '生成修复预览', true)
    .action(async (options) => {
    try {
        const cliOptions = {
            repo: path_1.default.resolve(options.repo),
            template: path_1.default.resolve(options.template),
            output: path_1.default.resolve(options.output),
            format: options.format,
            detail: options.detail,
            preview: options.preview
        };
        console.log(chalk_1.default.cyan('🔍 开始检测脚手架漂移...\n'));
        console.log(`  仓库: ${cliOptions.repo}`);
        console.log(`  模板: ${cliOptions.template}\n`);
        const detector = new drift_detector_1.DriftDetector();
        const report = await detector.detect(cliOptions);
        const reportGenerator = new report_generator_1.ReportGenerator();
        reportGenerator.printConsoleSummary(report);
        if (cliOptions.format === 'json' || cliOptions.format === 'both') {
            await reportGenerator.generateJsonReport(report, cliOptions.output);
        }
        if (cliOptions.format === 'markdown' || cliOptions.format === 'both') {
            await reportGenerator.generateMarkdownReport(report, cliOptions.output);
        }
        if (report.summary.totalDrifts > 0) {
            process.exit(1);
        }
        else {
            process.exit(0);
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('\n❌ 检测失败:'), error.message);
        console.error(chalk_1.default.gray(error.stack));
        process.exit(2);
    }
});
program
    .command('init')
    .description('在当前目录初始化模板清单')
    .option('-n, --name <name>', '模板名称', 'custom-scaffold')
    .option('-V, --template-version <version>', '模板版本', '1.0.0')
    .action(async (options) => {
    try {
        const fs = await Promise.resolve().then(() => __importStar(require('fs-extra')));
        const manifestPath = path_1.default.resolve('./scaffold-manifest.json');
        if (await fs.pathExists(manifestPath)) {
            console.log(chalk_1.default.yellow('⚠️  模板清单已存在:'), manifestPath);
            return;
        }
        const manifest = {
            name: options.name,
            version: options.templateVersion,
            files: [
                {
                    path: 'package.json',
                    required: true,
                    checkContent: false
                },
                {
                    path: '.gitignore',
                    required: true,
                    checkContent: true
                },
                {
                    path: 'README.md',
                    required: false,
                    checkContent: false
                }
            ],
            configs: [
                {
                    path: 'tsconfig.json',
                    type: 'json',
                    required: true,
                    keys: ['compilerOptions.target', 'compilerOptions.module']
                },
                {
                    path: '.env.example',
                    type: 'env',
                    required: false
                }
            ]
        };
        await fs.writeJson(manifestPath, manifest, { spaces: 2 });
        console.log(chalk_1.default.green('✓ 模板清单已创建:'), manifestPath);
        console.log(chalk_1.default.gray('\n请编辑 scaffold-manifest.json 配置需要检查的文件和配置项。'));
    }
    catch (error) {
        console.error(chalk_1.default.red('\n❌ 初始化失败:'), error.message);
        process.exit(2);
    }
});
program.parse(process.argv);
