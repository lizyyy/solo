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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const chalk_1 = __importDefault(require("chalk"));
const core_1 = require("./core");
const reporter_1 = require("./reporter");
function validateOptions(options) {
    const errors = [];
    if (!options.packageDir) {
        errors.push('必须指定 package 目录 (--package-dir 或 -d)');
    }
    else {
        const packageDir = path.resolve(options.packageDir);
        if (!fs.existsSync(packageDir)) {
            errors.push(`package 目录不存在: ${packageDir}`);
        }
        else {
            const pkgPath = path.join(packageDir, 'package.json');
            if (!fs.existsSync(pkgPath)) {
                errors.push(`package.json 不存在于目录: ${packageDir}`);
            }
        }
    }
    if (!options.outputDir) {
        errors.push('必须指定输出目录 (--output-dir 或 -o)');
    }
    if (options.format) {
        const validFormats = ['json', 'markdown', 'terminal', 'all'];
        const formats = Array.isArray(options.format) ? options.format : [options.format];
        for (const fmt of formats) {
            if (!validFormats.includes(fmt)) {
                errors.push(`无效的格式 "${fmt}"，有效值为: ${validFormats.join(', ')}`);
            }
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
async function main() {
    const argv = await (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .scriptName('exports-check')
        .usage('$0 [options]')
        .example('$0 -d ./my-package -o ./reports -f all', '检查 my-package 并输出所有格式报告到 reports 目录')
        .example('$0 --package-dir . --output-dir . --strict', '严格模式检查当前目录')
        .option('package-dir', {
        alias: 'd',
        type: 'string',
        description: '要检查的 package 目录路径',
        demandOption: false,
    })
        .option('output-dir', {
        alias: 'o',
        type: 'string',
        description: '报告输出目录',
        default: './exports-reports',
    })
        .option('format', {
        alias: 'f',
        type: 'array',
        string: true,
        description: '输出格式: json, markdown, terminal, all',
        default: ['terminal', 'markdown', 'json'],
    })
        .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: '显示详细信息',
        default: false,
    })
        .option('strict', {
        alias: 's',
        type: 'boolean',
        description: '严格模式：警告也会导致非零退出码',
        default: false,
    })
        .option('include-imports', {
        alias: 'i',
        type: 'boolean',
        description: '包含导入样例生成',
        default: true,
    })
        .help('help')
        .alias('help', 'h')
        .version()
        .alias('version', 'V')
        .epilog('Package Exports 体检CLI - 检查 Node.js 包 exports 字段配置')
        .argv;
    const validation = validateOptions(argv);
    if (!validation.valid) {
        console.error('\n');
        console.error(chalk_1.default.bold.red('❌ 参数错误:'));
        validation.errors.forEach((err, i) => {
            console.error(`   ${i + 1}. ${chalk_1.default.red(err)}`);
        });
        console.error('\n');
        console.error(chalk_1.default.yellow('使用 --help 查看帮助信息'));
        console.error('');
        process.exit(1);
    }
    const options = {
        packageDir: argv.packageDir,
        outputDir: argv.outputDir,
        format: argv.format,
        verbose: argv.verbose,
        strict: argv.strict,
        includeImports: argv.includeImports,
    };
    try {
        console.log(chalk_1.default.bold.blue('🔍 正在检查 package exports...'));
        console.log(chalk_1.default.gray(`   目录: ${path.resolve(options.packageDir)}`));
        const result = (0, core_1.runCheck)(options.packageDir, {
            includeImports: options.includeImports,
        });
        const outputs = (0, reporter_1.generateReports)(result, options);
        console.log(chalk_1.default.bold.green('\n📄 报告已生成:'));
        if (outputs.json) {
            console.log(`   - JSON: ${chalk_1.default.cyan(outputs.json)}`);
        }
        if (outputs.markdown) {
            console.log(`   - Markdown: ${chalk_1.default.cyan(outputs.markdown)}`);
        }
        const hasErrors = result.errors.length > 0;
        const hasWarnings = result.warnings.length > 0;
        if (hasErrors || (options.strict && hasWarnings)) {
            process.exit(1);
        }
        else {
            process.exit(0);
        }
    }
    catch (error) {
        console.error('\n');
        console.error(chalk_1.default.bold.red('❌ 执行错误:'));
        console.error(`   ${chalk_1.default.red(error.message)}`);
        if (options.verbose && error.stack) {
            console.error('\n');
            console.error(chalk_1.default.gray('   堆栈跟踪:'));
            console.error(chalk_1.default.gray(error.stack.split('\n').map((l) => '   ' + l).join('\n')));
        }
        console.error('');
        process.exit(2);
    }
}
main().catch((err) => {
    console.error(chalk_1.default.bold.red('未捕获的异常:'), err);
    process.exit(3);
});
//# sourceMappingURL=cli.js.map