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
const parser_1 = require("./parser");
const checker_1 = require("./checker");
const reporter_1 = require("./reporter");
const program = new commander_1.Command();
program
    .name('openapi-error-check')
    .description('检查 REST API 错误响应体的一致性')
    .version('1.0.0');
program
    .argument('<input>', 'OpenAPI 规范文件路径 (JSON/YAML)')
    .option('-o, --output-dir <dir>', '输出目录', './reports')
    .option('--json <path>', 'JSON 报告输出路径')
    .option('--markdown <path>', 'Markdown 报告输出路径')
    .option('--fail-on-error', '发现错误时以非零状态码退出')
    .action(async (input, options) => {
    try {
        const inputPath = path.resolve(input);
        console.log(`📖 解析 OpenAPI 规范: ${inputPath}`);
        const parser = new parser_1.OpenAPIParser(inputPath);
        console.log(`🔍 提取错误响应...`);
        const errorResponses = parser.extractErrorResponses();
        console.log(`   发现 ${errorResponses.length} 个错误响应`);
        console.log(`✅ 进行一致性检查...`);
        const checker = new checker_1.ConsistencyChecker(errorResponses, input, parser.getTotalEndpoints());
        const result = checker.check();
        console.log(`📝 生成报告...`);
        const reporter = new reporter_1.Reporter(result, options.outputDir);
        const jsonPath = options.json ? path.resolve(options.json) : undefined;
        const markdownPath = options.markdown ? path.resolve(options.markdown) : undefined;
        reporter.generateAllReports(jsonPath, markdownPath);
        if (options.failOnError && result.summary.errors > 0) {
            process.exit(1);
        }
    }
    catch (error) {
        console.error('❌ 错误:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
});
program.parse();
