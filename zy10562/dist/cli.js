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
const nginx_parser_1 = require("./nginx-parser");
const domain_merger_1 = require("./domain-merger");
const report_generator_1 = require("./report-generator");
const program = new commander_1.Command();
program
    .name('nginx-cert-refer')
    .description('Nginx 证书引用扫描工具')
    .version('1.0.0');
program
    .option('-i, --input <dir>', 'Nginx 配置目录路径', '/etc/nginx')
    .option('-o, --output <dir>', '报告输出目录', './nginx-cert-reports')
    .option('--no-console', '不输出控制台摘要')
    .option('--no-json', '不生成 JSON 报告')
    .option('--no-markdown', '不生成 Markdown 报告')
    .action(async (options) => {
    try {
        await runScan(options);
    }
    catch (error) {
        console.error('❌ 扫描失败:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
});
async function runScan(options) {
    const scanTime = new Date();
    const timestamp = scanTime.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const inputDir = path.resolve(options.input);
    const outputDir = path.resolve(options.output);
    const parser = new nginx_parser_1.NginxParser();
    const { serverBlocks, errors: parseErrors } = parser.parseDirectory(inputDir);
    const domainMerger = new domain_merger_1.DomainMerger();
    const { domainCertMaps, missingReferences, certInfos } = domainMerger.mergeDomains(serverBlocks);
    const domainSummary = domainMerger.calculateSummary(domainCertMaps);
    const scanResult = {
        scanTime,
        inputDir,
        outputDir,
        serverBlocks,
        parseErrors,
        certInfos,
        domainCertMaps,
        missingReferences,
        summary: {
            totalServers: serverBlocks.length,
            totalDomains: domainSummary.totalDomains,
            totalCerts: domainSummary.totalCerts,
            expiringIn30Days: domainSummary.expiringIn30Days,
            expiringIn7Days: domainSummary.expiringIn7Days,
            expired: domainSummary.expired,
            missingCerts: domainSummary.missingCerts,
            parseErrors: parseErrors.length
        }
    };
    const reportGenerator = new report_generator_1.ReportGenerator();
    const reportOptions = { outputDir, timestamp };
    if (options.json) {
        const jsonPath = reportGenerator.generateJsonReport(scanResult, reportOptions);
        console.log(`📄 JSON 报告已保存: ${jsonPath}`);
    }
    if (options.markdown) {
        const mdPath = reportGenerator.generateMarkdownReport(scanResult, reportOptions);
        console.log(`📄 Markdown 报告已保存: ${mdPath}`);
    }
    if (options.console) {
        reportGenerator.printConsoleSummary(scanResult);
    }
}
program.parseAsync();
