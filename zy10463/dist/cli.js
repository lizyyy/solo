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
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const generators_1 = require("./generators");
const reporters_1 = require("./reporters");
const selfcheck_1 = require("./selfcheck");
const program = new commander_1.Command();
program
    .name('jsonschema-sample')
    .description('JSON Schema 样本生成工具 - 生成正常、边界和非法样本用于联调测试')
    .version('1.0.0');
program
    .command('generate')
    .description('生成测试样本')
    .requiredOption('-s, --schema <path>', 'JSON Schema 文件路径')
    .option('-o, --output <dir>', '输出目录', './samples')
    .option('-t, --types <types>', '样本类型，逗号分隔: valid,boundary,invalid', 'valid,boundary,invalid')
    .option('-c, --count <number>', '每种类型的样本数量', '3')
    .option('--seed <number>', '随机种子，用于重复生成', Date.now().toString())
    .option('--fields <fields>', '针对特定字段生成，逗号分隔')
    .option('--no-html', '不生成 HTML 报告')
    .option('--no-json-report', '不生成 JSON 报告')
    .action(async (options) => {
    try {
        const sampleTypes = options.types.split(',').map((t) => t.trim());
        const validTypes = ['valid', 'boundary', 'invalid'];
        for (const type of sampleTypes) {
            if (!validTypes.includes(type)) {
                throw new Error(`无效的样本类型: ${type}，可选值: ${validTypes.join(', ')}`);
            }
        }
        const count = parseInt(options.count, 10);
        if (isNaN(count) || count < 1) {
            throw new Error('样本数量必须是大于0的整数');
        }
        const seed = parseInt(options.seed, 10);
        if (isNaN(seed)) {
            throw new Error('随机种子必须是整数');
        }
        const generator = new generators_1.SampleGenerator({
            schemaPath: path.resolve(options.schema),
            outputDir: path.resolve(options.output),
            sampleTypes,
            countPerType: count,
            seed,
            fields: options.fields ? options.fields.split(',').map((f) => f.trim()) : undefined
        });
        const summary = await generator.generate();
        const reporter = new reporters_1.Reporter(summary, generator.getSamples(), generator.getSchema(), generator['options']);
        reporter.printConsoleSummary();
        if (options.jsonReport) {
            const jsonReportPath = reporter.exportJsonReport();
            console.log(chalk_1.default.green(`JSON 报告已生成: ${jsonReportPath}`));
        }
        if (options.html) {
            const htmlReportPath = reporter.exportHtmlReport();
            console.log(chalk_1.default.green(`HTML 报告已生成: ${htmlReportPath}`));
        }
        process.exit(0);
    }
    catch (error) {
        console.error(chalk_1.default.red('\n❌ 错误:'), error.message);
        console.error(chalk_1.default.gray('\n使用 --help 查看帮助信息'));
        process.exit(1);
    }
});
program
    .command('selfcheck')
    .description('运行自检，验证工具在不同场景下的兼容性')
    .option('-o, --output <dir>', '输出目录', './selfcheck-results')
    .option('--quick', '快速模式，只运行基础测试')
    .action(async (options) => {
    try {
        console.log(chalk_1.default.cyan.bold('\n═══════════════════════════════════════════════════'));
        console.log(chalk_1.default.cyan.bold('           JSON Schema 样本生成工具自检'));
        console.log(chalk_1.default.cyan.bold('═══════════════════════════════════════════════════\n'));
        const checker = new selfcheck_1.SelfChecker(path.resolve(options.output), options.quick);
        const results = await checker.run();
        checker.printResults(results);
        const allPassed = results.every(r => r.passed);
        process.exit(allPassed ? 0 : 1);
    }
    catch (error) {
        console.error(chalk_1.default.red('\n❌ 自检失败:'), error.message);
        process.exit(1);
    }
});
program
    .command('validate')
    .description('验证 JSON Schema 是否有效')
    .argument('<schema-path>', 'Schema 文件路径')
    .action((schemaPath) => {
    try {
        const { validator } = require('./utils/validator');
        const { readJsonFile } = require('./utils/helpers');
        const schema = readJsonFile(path.resolve(schemaPath));
        if (validator.isValidSchema(schema)) {
            console.log(chalk_1.default.green('✅ Schema 有效'));
            process.exit(0);
        }
        else {
            console.log(chalk_1.default.red('❌ Schema 无效'));
            process.exit(1);
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ 错误:'), error.message);
        process.exit(1);
    }
});
program.parseAsync(process.argv);
//# sourceMappingURL=cli.js.map