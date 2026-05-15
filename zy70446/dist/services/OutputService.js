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
exports.OutputService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class OutputService {
    formatRecord(record, format) {
        if (format === 'json') {
            return JSON.stringify(record, null, 2);
        }
        return this.toMarkdown(record);
    }
    formatRecords(records, format) {
        if (format === 'json') {
            return JSON.stringify(records, null, 2);
        }
        return this.toMarkdownBatch(records);
    }
    toMarkdown(record) {
        const finalDecision = record.finalDecision || record.result.overallDecision;
        const result = record.result;
        let md = `# 审核报告 - ${result.itemId}\n\n`;
        md += `## 基本信息\n\n`;
        md += `- **内容类型**: ${result.item.contentType}\n`;
        md += `- **审核时间**: ${new Date(result.timestamp).toLocaleString('zh-CN')}\n`;
        md += `- **系统判定**: ${this.decisionEmoji(result.overallDecision)} ${result.overallDecision.toUpperCase()}\n`;
        md += `- **置信度**: ${(result.overallConfidence * 100).toFixed(1)}%\n`;
        md += `- **处理状态**: ${record.status.toUpperCase()}\n`;
        md += `- **最终判定**: ${this.decisionEmoji(finalDecision)} ${finalDecision.toUpperCase()}\n\n`;
        md += `## 待审核内容\n\n`;
        md += `\`\`\`\n${result.item.content}\n\`\`\`\n\n`;
        md += `## 多模型评测结果\n\n`;
        md += `| 模型名称 | 风险分数 | 标签 | 置信度 |\n`;
        md += `|----------|----------|------|--------|\n`;
        for (const model of result.modelResults) {
            md += `| ${model.modelName} | ${model.score} | ${model.label} | ${(model.confidence * 100).toFixed(1)}% |\n`;
        }
        md += '\n';
        md += `## 规则检测结果\n\n`;
        md += `| 规则ID | 规则名称 | 匹配状态 | 严重度 | 匹配内容 |\n`;
        md += `|--------|----------|----------|--------|----------|\n`;
        for (const rule of result.ruleResults) {
            const matched = rule.matched ? '✓ 匹配' : '✗ 未匹配';
            md += `| ${rule.ruleId} | ${rule.ruleName} | ${matched} | ${rule.severity} | ${rule.matchContent || '-'} |\n`;
        }
        md += '\n';
        if (record.corrections.length > 0) {
            md += `## 人工修正记录\n\n`;
            for (const corr of record.corrections) {
                md += `### 修正 #${corr.id.slice(0, 8)}\n\n`;
                md += `- **处理人**: ${corr.handler}\n`;
                md += `- **原判定**: ${this.decisionEmoji(corr.originalDecision)} ${corr.originalDecision.toUpperCase()}\n`;
                md += `- **新判定**: ${this.decisionEmoji(corr.newDecision)} ${corr.newDecision.toUpperCase()}\n`;
                md += `- **修正时间**: ${new Date(corr.timestamp).toLocaleString('zh-CN')}\n`;
                md += `- **备注**: ${corr.remark}\n\n`;
            }
        }
        md += `## 原始输入溯源\n\n`;
        md += `- **内容哈希**: \`${this.hashContent(result.item.content)}\`\n`;
        if (result.item.metadata) {
            md += `- **元数据**: \n\`\`\`json\n${JSON.stringify(result.item.metadata, null, 2)}\n\`\`\`\n`;
        }
        return md;
    }
    toMarkdownBatch(records) {
        let md = `# 批量审核报告\n\n`;
        md += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
        md += `**统计汇总**:\n\n`;
        md += `- 总记录数: ${records.length}\n`;
        md += `- 通过(PASS): ${records.filter(r => (r.finalDecision || r.result.overallDecision) === 'pass').length}\n`;
        md += `- 拒绝(REJECT): ${records.filter(r => (r.finalDecision || r.result.overallDecision) === 'reject').length}\n`;
        md += `- 待人工审核(REVIEW): ${records.filter(r => (r.finalDecision || r.result.overallDecision) === 'review').length}\n\n`;
        md += `## 审核结果列表\n\n`;
        md += `| 记录ID | 内容预览 | 系统判定 | 最终状态 | 处理人 |\n`;
        md += `|--------|----------|----------|----------|--------|\n`;
        for (const record of records) {
            const result = record.result;
            const contentPreview = result.item.content.slice(0, 30) + (result.item.content.length > 30 ? '...' : '');
            const handler = record.corrections.length > 0 ? record.corrections[record.corrections.length - 1].handler : '-';
            md += `| ${result.itemId.slice(0, 12)} | ${contentPreview} | ${this.decisionEmoji(result.overallDecision)} ${result.overallDecision} | ${record.status} | ${handler} |\n`;
        }
        md += '\n';
        for (const record of records) {
            md += '---\n\n';
            md += this.toMarkdown(record);
        }
        return md;
    }
    decisionEmoji(decision) {
        switch (decision) {
            case 'pass': return '✅';
            case 'reject': return '❌';
            case 'review': return '⚠️';
            default: return '❓';
        }
    }
    hashContent(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'hash_' + Math.abs(hash).toString(16);
    }
    saveToFile(content, filePath) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content, 'utf-8');
    }
    exportRecords(records, format, outputPath) {
        const content = this.formatRecords(records, format);
        const ext = format === 'json' ? '.json' : '.md';
        const fullPath = outputPath.endsWith(ext) ? outputPath : outputPath + ext;
        this.saveToFile(content, fullPath);
    }
}
exports.OutputService = OutputService;
