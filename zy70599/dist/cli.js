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
const parser_1 = require("./parser");
const comparator_1 = require("./comparator");
const reporter_1 = require("./reporter");
const program = new commander_1.Command();
program
    .name('dict-diff')
    .description('数据字典差异比较工具 - 发现多系统间数据字典的口径冲突')
    .version('1.0.0');
program
    .command('compare')
    .description('比较多个系统的数据字典')
    .requiredOption('-f, --files <files...>', '数据字典文件路径，格式：系统名@文件路径')
    .option('-o, --output <dir>', '输出目录', './output')
    .option('--no-console', '不输出终端摘要')
    .option('--no-json', '不生成JSON报告')
    .option('--no-markdown', '不生成Markdown报告')
    .action(async (options) => {
    try {
        const parser = new parser_1.DictionaryParser();
        const comparator = new comparator_1.DictionaryComparator();
        const reporter = new reporter_1.Reporter();
        const sources = options.files.map((item) => {
            const parts = item.split('@');
            if (parts.length !== 2) {
                throw new Error(`格式错误: ${item}，正确格式：系统名@文件路径`);
            }
            const [systemName, filePath] = parts;
            const resolvedPath = path.resolve(filePath);
            if (!fs.existsSync(resolvedPath)) {
                throw new Error(`文件不存在: ${resolvedPath}`);
            }
            return parser.parse(resolvedPath, systemName);
        });
        const result = comparator.compare(sources);
        const outputDir = path.resolve(options.output);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        if (options.console) {
            reporter.generateConsoleSummary(result);
        }
        if (options.json) {
            const jsonPath = path.join(outputDir, `dict-diff-${timestamp}.json`);
            reporter.generateJsonReport(result, jsonPath);
            console.log(`📄 JSON报告已生成: ${jsonPath}`);
        }
        if (options.markdown) {
            const mdPath = path.join(outputDir, `dict-diff-${timestamp}.md`);
            reporter.generateMarkdownReport(result, mdPath);
            console.log(`📝 Markdown报告已生成: ${mdPath}`);
        }
        process.exit(result.summary.criticalConflicts > 0 ? 1 : 0);
    }
    catch (e) {
        console.error('❌ 执行失败:', e instanceof Error ? e.message : String(e));
        process.exit(1);
    }
});
program
    .command('help')
    .description('显示使用帮助')
    .action(() => {
    console.log(`
📚 数据字典差异比较工具 - 使用帮助

命令格式:
  dict-diff compare -f 系统名@文件路径 系统名@文件路径 [选项]

使用示例:
  dict-diff compare -f 订单系统@./order.csv 用户系统@./user.json
  dict-diff compare -f 系统A@a.csv 系统B@b.csv -o ./reports

支持的文件格式:
  • CSV: 列名支持 字段名/fieldName, 类型/type, 枚举值/enum, 业务说明/description
  • JSON: 数组格式，字段名支持 fieldName/name/字段名, type, enumValues, description

冲突分级:
  🔴 critical (严重) - 类型不匹配、多系统字段缺失
  🟡 warning  (警告) - 枚举值不一致、单系统字段缺失
  🔵 info     (说明) - 业务描述不一致

输出文件:
  • 终端摘要 - 重点信息快速预览
  • JSON报告 - 机器可读，用于自动化处理
  • Markdown报告 - 适合发送给同事查看

注意事项:
  • 坏行和异常样本会保留原始位置和原因
  • 可追溯到原文件的具体行号
    `);
});
program.parse(process.argv);
