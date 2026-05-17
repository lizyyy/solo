#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { parseInputFile } from './parser.js';
import { calculateEstimation } from './calculator.js';
import { generateTerminalSummary } from './terminal.js';
import { generateMarkdownReport } from './markdown.js';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const program = new Command();
program
    .name('log-estimate')
    .description('日志保留估算CLI工具 - 估算存储增长和识别最占空间的日志主题')
    .version('1.0.0');
program
    .argument('<input-file>', 'CSV输入文件路径')
    .option('-o, --output <dir>', '输出目录', './output')
    .option('-c, --cost <number>', '每TB每月存储成本（元）', '100')
    .option('--no-terminal', '不输出终端摘要')
    .option('--no-json', '不输出JSON结果')
    .option('--no-markdown', '不输出Markdown报告')
    .action(async (inputFile, options) => {
    try {
        if (!fs.existsSync(inputFile)) {
            console.error(`错误: 输入文件不存在: ${inputFile}`);
            process.exit(1);
        }
        const costPerTBMonth = parseFloat(options.cost);
        if (isNaN(costPerTBMonth) || costPerTBMonth < 0) {
            console.error(`错误: 无效的存储成本: ${options.cost}`);
            process.exit(1);
        }
        const { validInputs, invalidInputs } = parseInputFile(inputFile);
        const result = calculateEstimation(validInputs, invalidInputs, inputFile, costPerTBMonth);
        const outputDir = options.output;
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        const baseName = path.basename(inputFile, path.extname(inputFile));
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        if (options.terminal) {
            const summary = generateTerminalSummary(result);
            console.log(summary);
        }
        if (options.json) {
            const jsonPath = path.join(outputDir, `${baseName}_${timestamp}.json`);
            fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
            console.log(`✅ JSON结果已保存: ${jsonPath}`);
        }
        if (options.markdown) {
            const markdownPath = path.join(outputDir, `${baseName}_${timestamp}.md`);
            const markdown = generateMarkdownReport(result);
            fs.writeFileSync(markdownPath, markdown, 'utf-8');
            console.log(`✅ Markdown报告已保存: ${markdownPath}`);
        }
    }
    catch (error) {
        console.error('执行出错:', error);
        process.exit(1);
    }
});
program.parse();
