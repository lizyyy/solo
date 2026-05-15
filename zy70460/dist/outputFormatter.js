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
exports.OutputFormatter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const json2csv_1 = require("json2csv");
class OutputFormatter {
    constructor(outputDir = './output') {
        this.outputDir = outputDir;
        this.ensureOutputDir();
    }
    ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }
    formatToJSON(groups, corrections, config) {
        return {
            generatedAt: new Date().toISOString(),
            totalDuplicateGroups: groups.length,
            duplicateGroups: groups.map(group => this.formatGroup(group, config)),
            manualCorrections: config.includeCorrections ? corrections : [],
            systemJudgmentIncluded: config.includeSystemJudgment
        };
    }
    formatGroup(group, config) {
        const base = {
            groupId: group.groupId,
            key: group.key,
            keyType: group.keyType,
            riskLevel: group.riskLevel,
            detectedAt: group.detectedAt,
            itemCount: group.items.length,
            items: group.items.map(item => ({
                id: item.sample.id,
                batchId: item.sample.batchId,
                productId: item.sample.productId,
                productName: item.sample.productName,
                sku: item.sample.sku,
                liveDate: item.sample.liveDate,
                anchorName: item.sample.anchorName,
                platform: item.sample.platform,
                price: item.sample.price,
                stock: item.sample.stock,
                category: item.sample.category,
                brand: item.sample.brand
            }))
        };
        if (config.includeSystemJudgment) {
            base.systemJudgment = {
                hasTruncation: group.items.some(i => i.isTruncated),
                truncationDetails: group.items
                    .filter(i => i.isTruncated)
                    .map(i => ({
                    itemId: i.sample.id,
                    truncatedFields: i.truncationFields,
                    confidence: i.confidence
                }))
            };
        }
        return base;
    }
    formatToMarkdown(groups, corrections, config) {
        let md = `# 重复检测报告\n\n`;
        md += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
        md += `**重复组总数**: ${groups.length}\n\n`;
        md += `---\n\n`;
        for (const group of groups) {
            md += `## 重复组 ${group.groupId}\n\n`;
            md += `- **匹配键**: ${group.key} (${group.keyType})\n`;
            md += `- **风险等级**: ${this.getRiskBadge(group.riskLevel)}\n`;
            md += `- **检测时间**: ${group.detectedAt}\n\n`;
            md += `### 重复项列表\n\n`;
            md += `| ID | 批次 | 商品ID | 商品名称 | SKU | 直播日期 | 主播 | 平台 | 价格 | 库存 |\n`;
            md += `|----|------|--------|----------|-----|----------|------|------|------|------|\n`;
            for (const item of group.items) {
                const s = item.sample;
                const truncMark = item.isTruncated ? ' ⚠️' : '';
                md += `| ${s.id}${truncMark} | ${s.batchId} | ${s.productId} | ${s.productName} | ${s.sku} | ${s.liveDate} | ${s.anchorName} | ${s.platform} | ${s.price} | ${s.stock} |\n`;
            }
            md += `\n`;
            if (config.includeSystemJudgment) {
                const truncatedItems = group.items.filter(i => i.isTruncated);
                if (truncatedItems.length > 0) {
                    md += `### 系统检测 - 字段截断问题\n\n`;
                    for (const item of truncatedItems) {
                        md += `- **${item.sample.id}**: 截断字段 [${item.truncationFields.join(', ')}], 置信度 ${(item.confidence * 100).toFixed(1)}%\n`;
                    }
                    md += `\n`;
                }
            }
            const groupCorrections = corrections.filter(c => group.items.some(i => i.sample.id === c.itemId));
            if (config.includeCorrections && groupCorrections.length > 0) {
                md += `### 人工修正记录\n\n`;
                for (const corr of groupCorrections) {
                    md += `#### 修正 ${corr.correctionId} (批次: ${corr.batchId})\n\n`;
                    md += `- **操作人**: ${corr.operator}\n`;
                    md += `- **处理方式**: ${corr.action}\n`;
                    md += `- **处理依据**: ${corr.basis}\n`;
                    md += `- **来源**: ${corr.source}\n`;
                    md += `- **备注**: ${corr.remark}\n`;
                    md += `- **修正时间**: ${corr.correctedAt}\n\n`;
                }
            }
            md += `---\n\n`;
        }
        return md;
    }
    getRiskBadge(level) {
        const badges = {
            high: '🔴 高风险',
            medium: '🟡 中风险',
            low: '🟢 低风险'
        };
        return badges[level] || level;
    }
    exportAnomalies(groups) {
        const anomalies = groups.flatMap(group => group.items
            .filter(item => item.isTruncated)
            .map(item => ({
            groupId: group.groupId,
            itemId: item.sample.id,
            batchId: item.sample.batchId,
            productId: item.sample.productId,
            truncatedName: item.sample.productName,
            truncatedFields: item.truncationFields.join(', '),
            confidence: item.confidence,
            riskLevel: group.riskLevel,
            suggestedAction: '需要人工复核确认完整信息'
        })));
        if (anomalies.length === 0) {
            console.log('没有发现异常样本');
            return;
        }
        const jsonPath = path.join(this.outputDir, `anomalies_${Date.now()}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(anomalies, null, 2));
        try {
            const parser = new json2csv_1.Parser();
            const csv = parser.parse(anomalies);
            const csvPath = path.join(this.outputDir, `anomalies_${Date.now()}.csv`);
            fs.writeFileSync(csvPath, csv);
            console.log(`异常样本已导出到 ${jsonPath} 和 ${csvPath}`);
        }
        catch (e) {
            console.log(`异常样本已导出到 ${jsonPath}`);
        }
    }
    saveJSON(data, filename) {
        const filePath = path.join(this.outputDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return filePath;
    }
    saveMarkdown(content, filename) {
        const filePath = path.join(this.outputDir, filename);
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
}
exports.OutputFormatter = OutputFormatter;
