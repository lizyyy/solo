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
exports.ReportService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ReportService {
    exportToJson(report, filePath) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
    }
    exportToMarkdown(report, filePath) {
        const content = this.generateMarkdownReport(report);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content, 'utf-8');
    }
    generateMarkdownReport(report) {
        const lines = [];
        const date = new Date(report.generatedAt);
        const dateStr = date.toLocaleString('zh-CN');
        lines.push(`# 生鲜店损耗盘点报告`);
        lines.push(`生成时间: ${dateStr}`);
        lines.push(``);
        lines.push(`## 总体概要`);
        lines.push(``);
        lines.push(`| 指标 | 数值 |`);
        lines.push(`|------|------|`);
        lines.push(`| 商品种类 | ${report.summary.totalProducts} 种 |`);
        lines.push(`| 批次数量 | ${report.summary.totalBatches} 批 |`);
        lines.push(`| 总采购量 | ${report.summary.totalPurchased.toFixed(2)} |`);
        lines.push(`| 总销售量 | ${report.summary.totalSold.toFixed(2)} |`);
        lines.push(`| 总报损量 | ${report.summary.totalLoss.toFixed(2)} |`);
        lines.push(`| 理论库存 | ${report.summary.expectedInventory.toFixed(2)} |`);
        lines.push(`| 实际库存 | ${report.summary.actualInventory.toFixed(2)} |`);
        lines.push(`| 库存差异 | ${report.summary.totalDiscrepancy > 0 ? '+' : ''}${report.summary.totalDiscrepancy.toFixed(2)} |`);
        lines.push(`| 总成本 | ¥${report.summary.totalCost.toFixed(2)} |`);
        lines.push(`| 总营收 | ¥${report.summary.totalRevenue.toFixed(2)} |`);
        lines.push(`| 总毛利 | ¥${report.summary.totalGrossProfit.toFixed(2)} |`);
        lines.push(`| 综合损耗率 | ${report.summary.overallLossRate.toFixed(2)}% |`);
        lines.push(``);
        if (report.exceptions.length > 0) {
            lines.push(`## 异常情况`);
            lines.push(``);
            const discrepancies = report.exceptions.filter(e => e.code === 'INVENTORY_DISCREPANCY');
            const highLosses = report.exceptions.filter(e => e.code === 'HIGH_LOSS_RATE');
            const negativeProfits = report.exceptions.filter(e => e.code === 'NEGATIVE_PROFIT');
            if (discrepancies.length > 0) {
                lines.push(`### 盘点不一致 (${discrepancies.length} 项)`);
                lines.push(``);
                for (const e of discrepancies) {
                    lines.push(`- **${e.message}**: ${e.details}`);
                }
                lines.push(``);
            }
            if (highLosses.length > 0) {
                lines.push(`### 损耗率过高 (${highLosses.length} 项)`);
                lines.push(``);
                for (const e of highLosses) {
                    lines.push(`- **${e.message}**: ${e.details}`);
                }
                lines.push(``);
            }
            if (negativeProfits.length > 0) {
                lines.push(`### 负毛利 (${negativeProfits.length} 项)`);
                lines.push(``);
                for (const e of negativeProfits) {
                    lines.push(`- **${e.message}**: ${e.details}`);
                }
                lines.push(``);
            }
        }
        if (report.needsReview.batches.length > 0) {
            lines.push(`## 需要店长复核`);
            lines.push(``);
            lines.push(`以下批次存在异常，请店长重点复核：`);
            lines.push(``);
            for (const batchId of report.needsReview.batches) {
                const batch = report.batchCalculations.find(b => b.batchId === batchId);
                if (batch) {
                    const issues = [];
                    if (batch.inventoryDiscrepancy !== 0)
                        issues.push('盘点不一致');
                    if (batch.lossRate > 10)
                        issues.push('损耗率过高');
                    if (batch.grossProfitMargin < 0)
                        issues.push('负毛利');
                    lines.push(`- **批次 ${batchId}** (${batch.productName}): ${issues.join('、')}`);
                }
            }
            lines.push(``);
        }
        lines.push(`## 按商品汇总`);
        lines.push(``);
        lines.push(`| 商品编码 | 商品名称 | 采购量 | 销售量 | 报损量 | 理论库存 | 实际库存 | 差异 | 总成本 | 总营收 | 毛利 | 损耗率 |`);
        lines.push(`|----------|----------|--------|--------|--------|----------|----------|------|--------|--------|------|--------|`);
        for (const p of report.productSummaries) {
            const diff = p.totalDiscrepancy;
            const diffStr = diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
            lines.push(`| ${p.productCode} | ${p.productName} | ${p.totalPurchased.toFixed(2)} | ${p.totalSold.toFixed(2)} | ${p.totalLoss.toFixed(2)} | ${p.expectedInventory.toFixed(2)} | ${p.actualInventory.toFixed(2)} | ${diffStr} | ¥${p.totalCost.toFixed(2)} | ¥${p.totalRevenue.toFixed(2)} | ¥${p.totalGrossProfit.toFixed(2)} | ${p.overallLossRate.toFixed(2)}% |`);
        }
        lines.push(``);
        lines.push(`## 按批次明细`);
        lines.push(``);
        lines.push(`| 商品编码 | 商品名称 | 批次 | 总成本 | 总营收 | 毛利 | 毛利率 | 报损量 | 损耗率 | 理论库存 | 实际库存 | 差异 |`);
        lines.push(`|----------|----------|------|--------|--------|------|--------|--------|--------|----------|----------|------|`);
        for (const b of report.batchCalculations) {
            const diff = b.inventoryDiscrepancy;
            const diffStr = diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
            lines.push(`| ${b.productCode} | ${b.productName} | ${b.batchId} | ¥${b.totalCost.toFixed(2)} | ¥${b.totalRevenue.toFixed(2)} | ¥${b.grossProfit.toFixed(2)} | ${b.grossProfitMargin.toFixed(2)}% | ${b.lossQuantity.toFixed(2)} | ${b.lossRate.toFixed(2)}% | ${b.expectedInventory.toFixed(2)} | ${b.actualInventory.toFixed(2)} | ${diffStr} |`);
        }
        lines.push(``);
        lines.push(`## 损耗分析`);
        lines.push(``);
        lines.push(`损耗主要来源于以下几个方面：`);
        lines.push(``);
        lines.push(`1. **正常损耗**: 生鲜商品在运输、存储过程中的自然损耗。`);
        lines.push(`2. **临期打折**: 为减少过期损失而进行的折扣销售，这部分属于毛利损失。`);
        lines.push(`3. **报损处理**: 因变质、损坏等原因无法销售的商品。`);
        lines.push(`4. **盘点差异**: 理论库存与实际盘点不一致的部分，可能存在录入错误或偷盗情况。`);
        lines.push(``);
        const lossBatches = report.batchCalculations.filter(b => b.lossQuantity > 0);
        if (lossBatches.length > 0) {
            lines.push(`### 报损明细`);
            lines.push(``);
            for (const b of lossBatches) {
                lines.push(`- **${b.productName} (批次 ${b.batchId})**: 报损 ${b.lossQuantity.toFixed(2)}，占该批次采购量的 ${b.lossRate.toFixed(2)}%，损失金额 ¥${b.lossCost.toFixed(2)}`);
            }
            lines.push(``);
        }
        return lines.join('\n');
    }
}
exports.ReportService = ReportService;
