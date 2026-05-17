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
const expander_1 = require("./expander");
const output_1 = require("./output");
const path = __importStar(require("path"));
const program = new commander_1.Command();
program
    .name('yaml-expand')
    .description('YAML锚点展开工具 - 解析并展开YAML中的锚点和合并键')
    .version('1.0.0');
program
    .requiredOption('-i, --input <file>', '输入YAML文件路径')
    .option('-o, --output-dir <dir>', '输出目录 (默认: 当前目录)')
    .option('-b, --base-name <name>', '输出文件基础名称 (默认: 自动生成带时间戳)')
    .option('--no-json', '不生成JSON输出')
    .option('--no-markdown', '不生成Markdown报告')
    .option('--no-terminal', '不输出终端摘要')
    .option('--no-yaml', '不生成展开后的YAML')
    .action(async (options) => {
    try {
        const expandOptions = {
            inputFile: path.resolve(options.input),
            outputDir: options.outputDir ? path.resolve(options.outputDir) : undefined,
            outputBase: options.baseName,
        };
        const result = (0, expander_1.expandYaml)(expandOptions);
        const output = new output_1.OutputGenerator(result, expandOptions.outputDir || process.cwd());
        const outputs = [];
        if (options.yaml) {
            outputs.push(output.writeExpandedYaml());
        }
        if (options.json) {
            outputs.push(output.writeJson());
        }
        if (options.markdown) {
            outputs.push(output.writeMarkdown());
        }
        if (options.terminal) {
            output.printTerminalSummary();
        }
        process.exit(result.exitCode);
    }
    catch (error) {
        console.error('执行失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
});
program.parseAsync(process.argv).catch((error) => {
    console.error('解析命令行参数失败:', error);
    process.exit(1);
});
