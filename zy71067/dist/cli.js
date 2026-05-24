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
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const checker_1 = require("./checker");
const reportGenerator_1 = require("./reportGenerator");
const program = new commander_1.Command();
program
    .name('i18n-length')
    .description('多语言长度溢出检测 CLI 工具')
    .version('1.0.0');
program
    .argument('[files...]', 'i18n 文件路径（JSON/YAML）')
    .option('-i, --input <files...>', '输入文件，逗号分隔')
    .option('-o, --output <dir>', '输出目录', './reports')
    .option('-c, --config <path>', '配置文件路径')
    .option('-l, --locale <code>', '目标语言代码')
    .option('-p, --position <name>', '界面位置名称')
    .option('-w, --max-width <number>', '最大宽度单位', (v) => parseInt(v, 10))
    .option('--max-chars <number>', '最大字符数', (v) => parseInt(v, 10))
    .option('--placeholders <list>', '预期占位符，逗号分隔')
    .option('-f, --format <formats...>', '输出格式: console,json,md', ['console', 'json', 'md'])
    .option('--overwrite', '覆盖已存在的报告文件')
    .option('--append', '追加到已存在的报告文件')
    .option('-v, --verbose', '显示详细信息')
    .option('-q, --quiet', '静默模式，仅输出错误')
    .addHelpText('after', `
退出码说明:
  0 - 无问题
  1 - 存在警告
  2 - 存在严重问题
  3 - 命令行参数错误
  4 - 文件读取错误

示例:
  # 使用配置文件
  i18n-length -c ./checks.json ./locales/*.json

  # 命令行直接指定
  i18n-length ./locales/en.json -l en -p "登录按钮" -w 20

  # 多格式输出
  i18n-length ./locales/*.json -f json md
  `);
async function main() {
    program.parse(process.argv);
    const opts = program.opts();
    const args = program.args;
    const inputFiles = [
        ...args,
        ...(opts.input || []),
    ].map(f => f.split(',')).flat().filter(Boolean);
    if (inputFiles.length === 0) {
        console.error('错误: 请指定输入文件');
        program.help();
        process.exit(3);
    }
    const resolvedFiles = resolveInputFiles(inputFiles);
    if (resolvedFiles.length === 0) {
        console.error('错误: 未找到有效的输入文件');
        process.exit(4);
    }
    let checkConfigs = [];
    let outputDir = opts.output;
    let formats = opts.format;
    if (opts.config) {
        try {
            const config = (0, checker_1.loadConfigFile)(opts.config);
            checkConfigs = config.checks;
            if (config.outputDir)
                outputDir = config.outputDir;
            if (config.formats?.length)
                formats = config.formats;
        }
        catch (error) {
            console.error(`错误: 无法加载配置文件 - ${error.message}`);
            process.exit(4);
        }
    }
    if (checkConfigs.length === 0) {
        if (!opts.locale || !opts.position || !opts.maxWidth) {
            console.error('错误: 未使用配置文件时，必须指定 --locale, --position, --max-width');
            process.exit(3);
        }
        checkConfigs = [{
                locale: opts.locale,
                interfacePosition: opts.position,
                maxWidth: opts.maxWidth,
                maxChars: opts.maxChars,
                placeholders: opts.placeholders?.split(',').map(p => p.trim()).filter(Boolean),
            }];
    }
    const validationErrors = validateCheckConfigs(checkConfigs);
    if (validationErrors.length > 0) {
        console.error('配置错误:');
        for (const error of validationErrors) {
            console.error(`  - ${error}`);
        }
        process.exit(3);
    }
    if (opts.overwrite && opts.append) {
        console.error('错误: --overwrite 和 --append 不能同时使用');
        process.exit(3);
    }
    const resolvedOutputDir = path.resolve(outputDir);
    if (!opts.quiet) {
        console.log(`检测 ${resolvedFiles.length} 个文件...`);
        console.log(`输出目录: ${resolvedOutputDir}`);
        console.log(`输出格式: ${formats.join(', ')}`);
        console.log('');
    }
    try {
        const { results, parseErrors } = (0, checker_1.runChecks)(resolvedFiles, checkConfigs, {
            verbose: opts.verbose,
        });
        if (parseErrors.length > 0) {
            console.error('');
            console.error(`错误: 有 ${parseErrors.length} 个文件解析失败`);
            for (const err of parseErrors) {
                console.error(`  - ${err.file}: ${err.error}`);
            }
        }
        if (results.length === 0) {
            console.error('错误: 没有可检测的文案条目，请检查输入文件和语言配置');
            process.exit(4);
        }
        const { summary, files } = (0, reportGenerator_1.generateReports)(results, {
            outputDir: resolvedOutputDir,
            formats,
            overwrite: opts.overwrite,
            append: opts.append,
            inputFiles: resolvedFiles,
            checkConfigs,
        });
        if (!opts.quiet && files.length > 0) {
            console.log('');
            console.log('生成的报告文件:');
            for (const file of files) {
                console.log(`  - ${file}`);
            }
        }
        if (parseErrors.length > 0) {
            process.exit(4);
        }
        process.exit((0, reportGenerator_1.getExitCode)(summary));
    }
    catch (error) {
        console.error(`执行错误: ${error.message}`);
        if (opts.verbose) {
            console.error(error.stack);
        }
        process.exit(4);
    }
}
function resolveInputFiles(files) {
    const resolved = [];
    const glob = require('glob');
    for (const file of files) {
        if (file.includes('*') || file.includes('?')) {
            const matches = glob.sync(file, { nodir: true });
            resolved.push(...matches);
        }
        else {
            const absolutePath = path.resolve(file);
            if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
                resolved.push(absolutePath);
            }
            else if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
                const dirFiles = fs.readdirSync(absolutePath)
                    .filter(f => /\.(json|yaml|yml)$/i.test(f))
                    .map(f => path.join(absolutePath, f));
                resolved.push(...dirFiles);
            }
        }
    }
    return [...new Set(resolved)];
}
function validateCheckConfigs(configs) {
    const errors = [];
    for (let i = 0; i < configs.length; i++) {
        const config = configs[i];
        const prefix = configs.length > 1 ? `配置[${i}]: ` : '';
        if (!config.locale) {
            errors.push(`${prefix}缺少 locale`);
        }
        if (!config.interfacePosition) {
            errors.push(`${prefix}缺少 interfacePosition`);
        }
        if (config.maxWidth === undefined || config.maxWidth === null) {
            errors.push(`${prefix}缺少 maxWidth`);
        }
        else if (config.maxWidth <= 0) {
            errors.push(`${prefix}maxWidth 必须大于 0`);
        }
        if (config.maxChars !== undefined && config.maxChars <= 0) {
            errors.push(`${prefix}maxChars 必须大于 0`);
        }
    }
    return errors;
}
main().catch((error) => {
    console.error('未处理的错误:', error);
    process.exit(4);
});
//# sourceMappingURL=cli.js.map