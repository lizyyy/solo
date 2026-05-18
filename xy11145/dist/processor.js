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
exports.ReportProcessor = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const parser_1 = require("./parser");
const reporter_1 = require("./reporter");
const idempotency_1 = require("./idempotency");
class ReportProcessor {
    constructor(outputDir) {
        this.outputDir = outputDir;
        this.allRecords = [];
        this.allErrors = [];
        this.processedFilesCount = 0;
        this.failedFilesCount = 0;
        this.parser = new parser_1.FileParser();
        this.reporter = new reporter_1.Reporter(outputDir);
        this.idempotency = new idempotency_1.IdempotencyManager(outputDir);
    }
    async processFile(filePath) {
        const fileName = path.basename(filePath);
        console.log(`\n📄 处理文件: ${fileName}`);
        if (this.idempotency.isFileProcessed(filePath)) {
            console.log(`   ⏭️  文件已处理过，跳过`);
            return true;
        }
        try {
            const { records, errors } = await this.parser.parseFile(filePath);
            const newRecords = this.idempotency.filterNewRecords(records);
            const skippedCount = records.length - newRecords.length;
            newRecords.forEach(record => {
                this.allRecords.push(record);
                this.idempotency.markRecordProcessed(record);
            });
            this.allErrors.push(...errors);
            if (errors.length > 0) {
                console.log(`   ✅ 有效记录: ${newRecords.length}`);
                if (skippedCount > 0) {
                    console.log(`   ⏭️  重复记录: ${skippedCount}`);
                }
                console.log(`   ⚠️ 发现错误: ${errors.length}`);
            }
            else {
                console.log(`   ✅ 成功处理 ${newRecords.length} 条记录`);
                if (skippedCount > 0) {
                    console.log(`   ⏭️  跳过 ${skippedCount} 条重复记录`);
                }
            }
            this.idempotency.markFileProcessed(filePath);
            this.processedFilesCount++;
            return true;
        }
        catch (err) {
            console.error(`   ❌ 处理失败: ${err.message}`);
            this.allErrors.push({
                file: fileName,
                errorType: 'parse_failed',
                message: err.message
            });
            this.failedFilesCount++;
            return false;
        }
    }
    async processDirectory(inputDir) {
        console.log(`\n🔍 扫描目录: ${inputDir}`);
        if (!fs.existsSync(inputDir)) {
            throw new Error(`输入目录不存在: ${inputDir}`);
        }
        const files = fs.readdirSync(inputDir)
            .filter(f => f.endsWith('.csv') || f.endsWith('.json'))
            .map(f => path.join(inputDir, f));
        console.log(`   发现 ${files.length} 个待处理文件`);
        for (const file of files) {
            await this.processFile(file);
        }
        this.idempotency.commit();
        return this.finalize(files.length);
    }
    async finalize(totalFiles) {
        console.log('\n' + '='.repeat(50));
        console.log('✅ 所有文件处理完成，生成报告...');
        const statistics = this.reporter.analyzeRecords(this.allRecords, this.allErrors);
        statistics.totalFiles = totalFiles;
        statistics.processedFiles = this.processedFilesCount;
        statistics.failedFiles = this.failedFilesCount;
        statistics.skippedRecords = statistics.totalRecords - statistics.validRecords;
        this.allRecords.forEach(record => {
            if (record.reportStatus !== 'withdrawn') {
                record.distributionStatus = 'distributed';
            }
        });
        const result = await this.reporter.writeOutput(this.allRecords, statistics);
        this.reporter.printConsoleSummary(statistics);
        return result;
    }
    reset() {
        this.idempotency.reset();
        this.allRecords = [];
        this.allErrors = [];
        this.processedFilesCount = 0;
        this.failedFilesCount = 0;
        console.log('🔄 已重置处理状态');
    }
    getStatistics() {
        return this.reporter.analyzeRecords(this.allRecords, this.allErrors);
    }
}
exports.ReportProcessor = ReportProcessor;
