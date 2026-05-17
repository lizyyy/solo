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
const commander_1 = require("commander");
const config_1 = require("./config");
const headerParser_1 = require("./headerParser");
const checker_1 = require("./checker");
const reporter_1 = require("./reporter");
const program = new commander_1.Command();
program
    .name('proxy-header-check')
    .description('反向代理头检查CLI工具 - 检查X-Forwarded-*等代理头的正确性')
    .version('1.0.0');
program
    .argument('[input-file]', '输入文件路径，每行一个JSON格式的请求样本，默认为stdin')
    .option('-c, --config <path>', '配置文件路径')
    .option('-j, --json <path>', '输出JSON报告到指定文件')
    .option('-h, --html <path>', '输出HTML报告到指定文件')
    .option('--no-terminal', '不输出终端报告')
    .action(async (inputFile, options) => {
    try {
        let input;
        if (inputFile) {
            input = fs.readFileSync(inputFile, 'utf-8');
        }
        else {
            input = await readStdin();
        }
        const config = (0, config_1.loadConfig)(options.config);
        const configErrors = (0, config_1.validateConfig)(config);
        if (configErrors.length > 0) {
            console.error('配置文件错误:');
            configErrors.forEach(err => console.error(`  - ${err}`));
            process.exit(1);
        }
        const { samples, badLines } = (0, headerParser_1.parseRequestSamples)(input);
        const results = (0, checker_1.checkAllSamples)(samples, config);
        const reportData = (0, reporter_1.generateReportData)(results, badLines, config);
        if (options.terminal) {
            (0, reporter_1.outputTerminal)(reportData, badLines);
        }
        if (options.json) {
            (0, reporter_1.outputJson)(reportData, badLines, options.json);
        }
        if (options.html) {
            (0, reporter_1.outputHtml)(reportData, badLines, options.html);
        }
        const hasErrors = reportData.summary.abnormal > 0;
        process.exit(hasErrors ? 1 : 0);
    }
    catch (error) {
        console.error('错误:', error.message);
        process.exit(1);
    }
});
function readStdin() {
    return new Promise((resolve, reject) => {
        let data = '';
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', chunk => {
            data += chunk;
        });
        process.stdin.on('end', () => {
            resolve(data);
        });
        process.stdin.on('error', reject);
    });
}
program.parse();
