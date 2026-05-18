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
exports.ReportGenerator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ReportGenerator {
    generateRunId() {
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        return `run_${timestamp}`;
    }
    generateTextReport(inspections, validationResult) {
        const lines = [];
        lines.push('='.repeat(60));
        lines.push('茶饮加盟巡店组 - 门店扣分检查报告');
        lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
        lines.push(`巡检门店数: ${inspections.length}`);
        lines.push('='.repeat(60));
        lines.push('');
        lines.push('【异常摘要统计】');
        lines.push(`  总异常数: ${validationResult.summary.totalErrors}`);
        lines.push(`  照片复用: ${validationResult.summary.photoReuseCount} 处`);
        lines.push(`  逾期整改: ${validationResult.summary.overdueCount} 项`);
        lines.push(`  数据异常: ${validationResult.summary.invalidDataCount} 项`);
        lines.push('');
        if (validationResult.errors.length > 0) {
            lines.push('【详细异常列表】');
            lines.push('');
            const photoReuseErrors = validationResult.errors.filter(e => e.type === 'photo_reuse');
            if (photoReuseErrors.length > 0) {
                lines.push('>>> 照片复用问题 (严重程度: HIGH)');
                lines.push('');
                photoReuseErrors.forEach((error, index) => {
                    lines.push(`${index + 1}. [${error.storeId}] ${error.storeName}`);
                    lines.push(`   问题: ${error.message}`);
                    lines.push(`   建议: ${error.suggestion}`);
                    lines.push('');
                });
            }
            const overdueErrors = validationResult.errors.filter(e => e.type === 'overdue_rectification');
            if (overdueErrors.length > 0) {
                lines.push('>>> 逾期整改问题 (严重程度: HIGH/MEDIUM)');
                lines.push('');
                overdueErrors.forEach((error, index) => {
                    lines.push(`${index + 1}. [${error.storeId}] ${error.storeName} - 检查项: ${error.itemId}`);
                    lines.push(`   问题: ${error.message}`);
                    lines.push(`   建议: ${error.suggestion}`);
                    lines.push('');
                });
            }
            const invalidErrors = validationResult.errors.filter(e => e.type === 'invalid_data');
            if (invalidErrors.length > 0) {
                lines.push('>>> 数据异常问题 (严重程度: MEDIUM/LOW)');
                lines.push('');
                invalidErrors.forEach((error, index) => {
                    lines.push(`${index + 1}. [${error.storeId}] ${error.storeName} - 检查项: ${error.itemId || 'N/A'}`);
                    lines.push(`   问题: ${error.message}`);
                    lines.push(`   建议: ${error.suggestion}`);
                    lines.push('');
                });
            }
        }
        else {
            lines.push('【检查结果】');
            lines.push('  ✅ 所有数据检查通过，无异常发现');
            lines.push('');
        }
        lines.push('【门店扣分统计】');
        lines.push('');
        inspections.forEach(inspection => {
            const totalScore = inspection.items.reduce((sum, item) => sum + item.score, 0);
            const maxTotalScore = inspection.items.reduce((sum, item) => sum + item.maxScore, 0);
            const deductionRate = ((1 - totalScore / maxTotalScore) * 100).toFixed(1);
            lines.push(`[${inspection.storeId}] ${inspection.storeName}`);
            lines.push(`  巡检日期: ${inspection.inspectionDate}`);
            lines.push(`  巡检员: ${inspection.inspector}`);
            lines.push(`  得分: ${totalScore} / ${maxTotalScore} (扣费率: ${deductionRate}%)`);
            lines.push(`  需整改项: ${inspection.items.filter(i => i.rectificationRequired).length} 项`);
            lines.push('');
        });
        lines.push('='.repeat(60));
        lines.push('报告结束');
        lines.push('='.repeat(60));
        return lines.join('\n');
    }
    generateJsonReport(inspections, validationResult, sortedInspections) {
        return {
            generatedAt: new Date().toISOString(),
            inspectionCount: inspections.length,
            validationResult,
            sortedInspections,
            runId: this.generateRunId()
        };
    }
    saveReport(report, outputPath) {
        const absolutePath = path.resolve(outputPath);
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const jsonContent = JSON.stringify(report, null, 2);
        fs.writeFileSync(absolutePath, jsonContent, 'utf-8');
    }
    saveTextReport(textContent, outputPath) {
        const absolutePath = path.resolve(outputPath);
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(absolutePath, textContent, 'utf-8');
    }
}
exports.ReportGenerator = ReportGenerator;
