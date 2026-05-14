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
const date_fns_1 = require("date-fns");
const dataStore_1 = require("../store/dataStore");
class OutputFormatter {
    static toJSON(data, pretty = true) {
        return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    }
    static generateTableOfContents(items) {
        let toc = '# 目录\n\n';
        for (const item of items) {
            toc += `- [${item.title}](#${item.anchor})\n`;
        }
        return toc + '\n---\n\n';
    }
    static formatInquiryItem(item) {
        return `| ${item.itemCode} | ${item.itemName} | ${item.specification} | ${item.quantity} | ${item.unit} | ${item.unitPrice.toLocaleString()} | ${item.totalPrice.toLocaleString()} | ${item.supplierName} |`;
    }
    static formatInquiry(inquiry) {
        let md = `## 询价单详情 - ${inquiry.inquiryNo}\n\n`;
        md += `**标题**: ${inquiry.title}\n\n`;
        md += `**申请部门**: ${inquiry.department}\n\n`;
        md += `**申请人**: ${inquiry.applicantName} (${inquiry.applicantId})\n\n`;
        md += `**申请日期**: ${inquiry.applyDate}\n\n`;
        md += `**状态**: ${inquiry.status}\n\n`;
        md += `**规则版本**: ${inquiry.ruleVersion}\n\n`;
        md += `**总金额**: ¥${inquiry.totalAmount.toLocaleString()}\n\n`;
        md += `### 物料明细\n\n`;
        md += `| 物料编码 | 物料名称 | 规格 | 数量 | 单位 | 单价 | 总价 | 供应商 |\n`;
        md += `|----------|----------|------|------|------|------|------|--------|\n`;
        for (const item of inquiry.items) {
            md += this.formatInquiryItem(item) + '\n';
        }
        md += '\n';
        return md;
    }
    static formatReviewResult(result) {
        let md = `## 复核结果\n\n`;
        md += `**复核状态**: ${result.status === 'success' ? '✅ 通过' : result.status === 'warning' ? '⚠️ 有警告' : '❌ 有错误'}\n\n`;
        md += `**规则版本**: ${result.ruleVersion}\n\n`;
        md += `**复核时间**: ${(0, date_fns_1.format)(new Date(result.reviewedAt), 'yyyy-MM-dd HH:mm:ss')}\n\n`;
        md += `### 检查项\n\n`;
        for (const check of result.checks) {
            const status = check.passed ? '✅' : '❌';
            md += `${status} **${check.name}**: ${check.message}\n\n`;
            if (check.details) {
                md += '```json\n' + JSON.stringify(check.details, null, 2) + '\n```\n\n';
            }
        }
        if (result.issues.length > 0) {
            md += `### 发现的问题\n\n`;
            for (const issue of result.issues) {
                const severity = issue.severity === 'high' ? '🔴 严重' : issue.severity === 'medium' ? '🟡 中等' : '🟢 轻微';
                md += `${severity} **${issue.type}**: ${issue.message}\n\n`;
                if (issue.data) {
                    md += '```json\n' + JSON.stringify(issue.data, null, 2) + '\n```\n\n';
                }
            }
        }
        return md;
    }
    static formatPermissionTicket(ticket) {
        let md = `## 权限临时票\n\n`;
        md += `**类型**: ${ticket.type}\n\n`;
        md += `**状态**: ${ticket.status}\n\n`;
        md += `**授权人**: ${ticket.grantedByName} (${ticket.grantedBy})\n\n`;
        md += `**授权时间**: ${ticket.grantedAt ? (0, date_fns_1.format)(new Date(ticket.grantedAt), 'yyyy-MM-dd HH:mm:ss') : 'N/A'}\n\n`;
        md += `**原因**: ${ticket.reason}\n\n`;
        md += `### 变更前后对比\n\n`;
        md += `| 项目 | 变更前 | 变更后 |\n`;
        md += `|------|--------|--------|\n`;
        const allKeys = new Set([
            ...Object.keys(ticket.originalValue),
            ...Object.keys(ticket.modifiedValue)
        ]);
        for (const key of allKeys) {
            const original = ticket.originalValue[key];
            const modified = ticket.modifiedValue[key];
            const originalStr = typeof original === 'number' ? original.toLocaleString() : String(original || '-');
            const modifiedStr = typeof modified === 'number' ? modified.toLocaleString() : String(modified || '-');
            md += `| ${key} | ${originalStr} | ${modifiedStr} |\n`;
        }
        md += `\n**结论**: ${ticket.conclusion}\n\n`;
        return md;
    }
    static generateReport(inquiryId) {
        const inquiry = dataStore_1.DataStore.getInquiryById(inquiryId);
        if (!inquiry) {
            throw new Error(`Inquiry ${inquiryId} not found`);
        }
        const reviewResult = dataStore_1.DataStore.getReviewResultByInquiry(inquiryId);
        const permissionTickets = dataStore_1.DataStore.getPermissionTicketsByInquiry(inquiryId);
        const rule = dataStore_1.DataStore.getRuleByVersion(inquiry.ruleVersion);
        const tocItems = [
            { title: '询价单详情', anchor: '询价单详情---' + inquiry.inquiryNo.toLowerCase().replace(/\s+/g, '-') },
            { title: '复核结果', anchor: '复核结果' }
        ];
        if (permissionTickets.length > 0) {
            tocItems.push({ title: '权限临时票', anchor: '权限临时票' });
        }
        tocItems.push({ title: '规则说明', anchor: '规则说明' });
        let md = `# 采购询价单复核报告 - ${inquiry.inquiryNo}\n\n`;
        md += `生成时间: ${(0, date_fns_1.format)(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n\n`;
        md += this.generateTableOfContents(tocItems);
        md += this.formatInquiry(inquiry);
        if (reviewResult) {
            md += this.formatReviewResult(reviewResult);
        }
        for (const ticket of permissionTickets) {
            md += this.formatPermissionTicket(ticket);
        }
        if (rule) {
            md += `## 规则说明\n\n`;
            md += `**版本**: ${rule.version}\n\n`;
            md += `**生效日期**: ${rule.effectiveDate}\n\n`;
            md += `**描述**: ${rule.description}\n\n`;
            md += `### 规则条件\n\n`;
            for (const condition of rule.conditions) {
                md += `- ${condition.type}: ${condition.operator} ${condition.value}\n`;
            }
            md += '\n';
        }
        return md;
    }
    static generateBatchReport(batchId) {
        const inquiries = dataStore_1.DataStore.getInquiriesByBatch(batchId);
        if (inquiries.length === 0) {
            return `# 批次 ${batchId} 报告\n\n未找到该批次的数据\n`;
        }
        const rule = dataStore_1.DataStore.getRuleByVersion(inquiries[0].ruleVersion);
        let md = `# 采购询价单批次复核报告\n\n`;
        md += `## 批次信息\n\n`;
        md += `**批次号**: ${batchId}\n\n`;
        md += `**询价单数量**: ${inquiries.length}\n\n`;
        md += `**规则版本**: ${inquiries[0].ruleVersion}\n\n`;
        if (rule) {
            md += `**规则描述**: ${rule.description}\n\n`;
        }
        md += `## 询价单列表\n\n`;
        md += `| 询价单号 | 标题 | 部门 | 申请人 | 总金额 | 状态 |\n`;
        md += `|----------|------|------|--------|--------|------|\n`;
        for (const inquiry of inquiries) {
            md += `| ${inquiry.inquiryNo} | ${inquiry.title} | ${inquiry.department} | ${inquiry.applicantName} | ¥${inquiry.totalAmount.toLocaleString()} | ${inquiry.status} |\n`;
        }
        md += '\n---\n\n';
        const results = inquiries
            .map(i => dataStore_1.DataStore.getReviewResultByInquiry(i.id))
            .filter(Boolean);
        if (results.length > 0) {
            md += `## 复核统计\n\n`;
            const successCount = results.filter(r => r.status === 'success').length;
            const warningCount = results.filter(r => r.status === 'warning').length;
            const errorCount = results.filter(r => r.status === 'error').length;
            md += `- ✅ 通过: ${successCount}\n`;
            md += `- ⚠️ 警告: ${warningCount}\n`;
            md += `- ❌ 错误: ${errorCount}\n\n`;
            const allTickets = [];
            for (const inquiry of inquiries) {
                const tickets = dataStore_1.DataStore.getPermissionTicketsByInquiry(inquiry.id);
                allTickets.push(...tickets);
            }
            if (allTickets.length > 0) {
                md += `## 权限临时票摘要\n\n`;
                for (const ticket of allTickets) {
                    md += `### 临时票 ${ticket.id.substring(0, 8)}\n\n`;
                    md += `**询价单**: ${ticket.inquiryId}\n\n`;
                    md += `**原因**: ${ticket.reason}\n\n`;
                    md += `**变更前后**:\n`;
                    md += `- 金额阈值: ${ticket.originalValue.amountThreshold.toLocaleString()} → ${ticket.modifiedValue.amountThreshold.toLocaleString()}\n`;
                    md += `- 实际金额: ${ticket.originalValue.actualAmount.toLocaleString()} → ${ticket.modifiedValue.actualAmount.toLocaleString()}\n\n`;
                    md += `**结论**: ${ticket.conclusion}\n\n`;
                }
            }
        }
        return md;
    }
    static saveToFile(content, filePath) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content, 'utf-8');
    }
}
exports.OutputFormatter = OutputFormatter;
