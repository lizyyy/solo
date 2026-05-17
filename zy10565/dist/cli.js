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
const fs = __importStar(require("fs"));
const parser_1 = require("./parser");
const variable_extractor_1 = require("./variable-extractor");
const report_generator_1 = require("./report-generator");
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];
        switch (arg) {
            case '-h':
            case '--help':
                printHelp();
                process.exit(0);
            case '-v':
            case '--version':
                console.log('http-record-variable-cli 1.0.0');
                process.exit(0);
            case '-i':
            case '--input':
                options.input = nextArg;
                i++;
                break;
            case '-o':
            case '--output':
                options.output = nextArg;
                i++;
                break;
            case '-f':
            case '--format':
                options.formats = nextArg.split(',');
                i++;
                break;
            case '-m':
            case '--mappings':
                options.mappings = nextArg;
                i++;
                break;
            case '--fail-fast':
                options.failFast = true;
                break;
            case '--no-bad-lines':
                options.noBadLines = true;
                break;
            default:
                if (!options.input && arg && !arg.startsWith('-')) {
                    options.input = arg;
                }
        }
    }
    return options;
}
function printHelp() {
    console.log(`
HTTP 录制变量化 CLI 工具

用法:
  httpv [选项] <输入文件>
  cat 录制文件.txt | httpv [选项]

选项:
  -h, --help              显示帮助信息
  -v, --version           显示版本号
  -i, --input <文件>      指定输入文件
  -o, --output <目录>    指定输出目录
  -f, --format <格式>    报告格式，逗号分隔 (terminal,json,markdown)
                          默认: terminal,json,markdown
  -m, --mappings <文件>   变量映射文件 (JSON 格式)
  --fail-fast             遇到错误立即终止
  --no-bad-lines          不保留坏行

示例:
  httpv recordings.txt
  httpv -i recordings.txt -o ./reports
  httpv -f markdown,json
  cat requests.txt | httpv

  支持的输入格式:
  - JSON 格式 (每行一个 JSON 对象)
  - curl 命令
  - 原始 HTTP 请求 (GET/POST 等)
  - 纯 URL
`);
}
async function readInput(inputPath) {
    if (inputPath) {
        if (!fs.existsSync(inputPath)) {
            console.error(`❌ 输入文件不存在: ${inputPath}`);
            process.exit(1);
        }
        return fs.readFileSync(inputPath, 'utf-8');
    }
    if (!process.stdin.isTTY) {
        return new Promise((resolve) => {
            let data = '';
            process.stdin.on('data', (chunk) => {
                data += chunk;
            });
            process.stdin.on('end', () => {
                resolve(data);
            });
        });
    }
    console.error('❌ 请提供输入文件或通过管道输入');
    printHelp();
    process.exit(1);
}
function loadMappings(mappingsPath) {
    if (!mappingsPath)
        return {};
    try {
        const content = fs.readFileSync(mappingsPath, 'utf-8');
        return JSON.parse(content);
    }
    catch (error) {
        console.error(`❌ 无法加载映射文件: ${mappingsPath}`);
        process.exit(1);
    }
}
async function main() {
    try {
        const options = parseArgs();
        const content = await readInput(options.input);
        const mappings = loadMappings(options.mappings);
        const parseOptions = {
            variableMappings: mappings,
            preserveBadLines: !options.noBadLines,
            failFast: options.failFast,
        };
        const parser = new parser_1.HttpRecordParser(parseOptions);
        const extractor = new variable_extractor_1.VariableExtractor([], [], mappings);
        const reportGenerator = new report_generator_1.ReportGenerator();
        const parseResult = parser.parse(content);
        const recordsWithVariables = parseResult.records.map(r => extractor.extractVariables(r));
        const allVariables = recordsWithVariables
            .filter(r => !r.isBadLine)
            .reduce((acc, r) => {
            for (const [name, info] of Object.entries(r.variables)) {
                if (acc[name]) {
                    acc[name].occurrences += info.occurrences;
                }
                else {
                    acc[name] = { ...info };
                }
            }
            return acc;
        }, {});
        const reportData = reportGenerator.buildReportData(recordsWithVariables, allVariables, parseResult.totalLines, parseResult.validLines, parseResult.badLines);
        const reportOptions = {
            outputDir: options.output,
            formats: options.formats,
        };
        const writtenFiles = await reportGenerator.writeReports(reportData, reportOptions);
        if (writtenFiles.length > 0) {
            console.log('📄 生成的报告文件:');
            writtenFiles.forEach(f => console.log(`   - ${f}`));
        }
        const hasBadLines = parseResult.badLines > 0;
        process.exit(hasBadLines ? 2 : 0);
    }
    catch (error) {
        console.error('❌ 处理失败:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}
main();
