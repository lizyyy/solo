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
const yargs = __importStar(require("yargs"));
const path = __importStar(require("path"));
const processor_1 = require("./processor");
const fileHandler_1 = require("./fileHandler");
async function main() {
    const argv = await yargs
        .usage('用法: package-splitter [选项] <输入文件或目录>')
        .option('output', {
        alias: 'o',
        type: 'string',
        description: '输出目录',
        default: './output'
    })
        .option('rerun', {
        alias: 'r',
        type: 'boolean',
        description: '可复跑模式（清空已处理记录）',
        default: false
    })
        .demandCommand(1, '请指定输入文件或目录')
        .help()
        .argv;
    const inputPath = argv._[0];
    const outputDir = path.resolve(argv.output);
    const isRerun = argv.rerun;
    const processor = new processor_1.PackageProcessor();
    const fileHandler = new fileHandler_1.FileHandler();
    const inputFiles = fileHandler.getInputFiles(inputPath);
    if (inputFiles.length === 0) {
        console.log('⚠️  未找到任何 CSV 文件');
        return;
    }
    const summary = {
        totalFiles: inputFiles.length,
        totalRows: 0,
        successCount: 0,
        skippedCount: 0,
        failedCount: 0,
        fileResults: []
    };
    console.log(`\n📦 社区团购仓团购包裹拆分 CLI`);
    console.log(`═══════════════════════════════════════`);
    console.log(`输入路径: ${inputPath}`);
    console.log(`输出目录: ${outputDir}`);
    console.log(`可复跑模式: ${isRerun ? '开启' : '关闭'}`);
    console.log(`发现文件: ${inputFiles.length} 个`);
    console.log(`═══════════════════════════════════════\n`);
    for (const filePath of inputFiles) {
        const fileName = path.basename(filePath);
        console.log(`📄 处理文件: ${fileName}`);
        if (isRerun) {
            processor.resetProcessedKeys();
        }
        try {
            const rows = fileHandler.readCsv(filePath);
            const result = processor.processRows(rows);
            fileHandler.writeResult(outputDir, fileName, result);
            const fileSuccess = result.success.length;
            const fileSkipped = result.skipped.length;
            const fileFailed = result.failed.length;
            const fileErrors = result.failed.map(r => `行${r.行号}: ${r.错误信息}`);
            summary.totalRows += rows.length;
            summary.successCount += fileSuccess;
            summary.skippedCount += fileSkipped;
            summary.failedCount += fileFailed;
            summary.fileResults.push({
                fileName,
                success: fileSuccess,
                skipped: fileSkipped,
                failed: fileFailed,
                errors: fileErrors
            });
            console.log(`   ✓ 成功: ${fileSuccess}, 跳过: ${fileSkipped}, 失败: ${fileFailed}\n`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.log(`   ✗ 错误: ${errorMsg}\n`);
            summary.fileResults.push({
                fileName,
                success: 0,
                skipped: 0,
                failed: 0,
                errors: [errorMsg]
            });
        }
    }
    printSummary(summary);
}
function printSummary(summary) {
    console.log(`═══════════════════════════════════════`);
    console.log(`📊 处理摘要`);
    console.log(`═══════════════════════════════════════`);
    console.log(`总文件数: ${summary.totalFiles}`);
    console.log(`总记录数: ${summary.totalRows}`);
    console.log(`✅ 成功: ${summary.successCount}`);
    console.log(`⏭️  跳过: ${summary.skippedCount}`);
    console.log(`❌ 失败: ${summary.failedCount}`);
    if (summary.failedCount > 0) {
        console.log(`\n⚠️  错误详情:`);
        for (const fr of summary.fileResults) {
            if (fr.errors.length > 0) {
                console.log(`  ${fr.fileName}:`);
                fr.errors.forEach(err => console.log(`    - ${err}`));
            }
        }
    }
    console.log(`\n═══════════════════════════════════════`);
    console.log(`处理完成！输出文件已保存至指定目录。`);
}
main().catch(err => {
    console.error('❌ 程序异常:', err);
    process.exit(1);
});
