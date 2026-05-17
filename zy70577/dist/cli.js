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
const yargs = __importStar(require("yargs"));
const chalk_1 = __importDefault(require("chalk"));
const parser_1 = require("./parser");
const analyzer_1 = require("./analyzer");
const output_1 = require("./output");
const constants_1 = require("./constants");
async function main() {
    const argv = await yargs
        .scriptName('ci-cache-analyzer')
        .usage('$0 <input> [options]')
        .example('$0 build.log', '分析构建日志并在终端显示结果')
        .example('$0 build.log --json --markdown', '生成JSON和Markdown报告')
        .example('$0 build.log --output-dir ./reports', '指定输出目录')
        .positional('input', {
        describe: 'CI 构建日志文件路径',
        type: 'string',
        demandOption: true,
    })
        .option('json', {
        alias: 'j',
        describe: '生成 JSON 格式报告',
        type: 'boolean',
        default: false,
    })
        .option('markdown', {
        alias: 'm',
        describe: '生成 Markdown 格式报告',
        type: 'boolean',
        default: false,
    })
        .option('output-json', {
        describe: '指定 JSON 输出文件路径',
        type: 'string',
    })
        .option('output-markdown', {
        describe: '指定 Markdown 输出文件路径',
        type: 'string',
    })
        .option('output-dir', {
        alias: 'o',
        describe: '指定输出目录',
        type: 'string',
    })
        .option('format', {
        alias: 'f',
        describe: '日志格式 (github-actions, gitlab-ci, circleci, auto)',
        type: 'string',
        choices: ['github-actions', 'gitlab-ci', 'circleci', 'auto'],
        default: 'auto',
    })
        .option('quiet', {
        alias: 'q',
        describe: '静默模式，不输出终端摘要',
        type: 'boolean',
        default: false,
    })
        .option('verbose', {
        alias: 'v',
        describe: '详细输出模式',
        type: 'boolean',
        default: false,
    })
        .help('help')
        .alias('help', 'h')
        .version()
        .alias('version', 'V')
        .argv;
    const options = {
        input: argv._[0],
        outputJson: argv['output-json'],
        outputMarkdown: argv['output-markdown'],
        outputDir: argv['output-dir'],
        logFormat: argv.format,
        verbose: argv.verbose,
        quiet: argv.quiet,
    };
    try {
        if (options.verbose) {
            console.log(chalk_1.default.blue(`开始分析: ${options.input}`));
        }
        const parseResult = await (0, parser_1.parseLogFile)(options);
        if (options.verbose) {
            console.log(chalk_1.default.blue(`解析完成: ${parseResult.entries.length} 条有效记录`));
        }
        const analysisResult = (0, analyzer_1.analyzeCacheData)({
            entries: parseResult.entries,
            badLines: parseResult.badLines,
            totalLines: parseResult.totalLines,
            options,
        });
        if (!options.quiet) {
            (0, output_1.printTerminalSummary)(analysisResult);
        }
        const outputFiles = [];
        if (argv.json || options.outputJson) {
            const jsonPath = (0, output_1.writeJsonOutput)(analysisResult, options);
            outputFiles.push(jsonPath);
            if (!options.quiet) {
                console.log(chalk_1.default.green(`✓ JSON 报告已保存: ${jsonPath}`));
            }
        }
        if (argv.markdown || options.outputMarkdown) {
            const mdPath = (0, output_1.writeMarkdownOutput)(analysisResult, options);
            outputFiles.push(mdPath);
            if (!options.quiet) {
                console.log(chalk_1.default.green(`✓ Markdown 报告已保存: ${mdPath}`));
            }
        }
        if (options.verbose && outputFiles.length > 0) {
            console.log(chalk_1.default.blue(`共生成 ${outputFiles.length} 个输出文件`));
        }
        const hasBadLines = analysisResult.badLines.length > 0;
        const hasCacheMiss = analysisResult.summary.totalCacheMisses > 0;
        const hitRateLow = analysisResult.summary.hitRate < 0.5;
        if (hasBadLines) {
            return constants_1.EXIT_CODES.PARSE_ERROR;
        }
        if (hitRateLow) {
            return 2;
        }
        return constants_1.EXIT_CODES.SUCCESS;
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        if (options.verbose) {
            console.error(error.stack);
        }
        return constants_1.EXIT_CODES.ANALYSIS_ERROR;
    }
}
main().then(exitCode => {
    process.exit(exitCode);
}).catch(error => {
    console.error(chalk_1.default.red(`致命错误: ${error.message}`));
    process.exit(constants_1.EXIT_CODES.ANALYSIS_ERROR);
});
