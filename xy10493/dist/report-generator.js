"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportGenerator = exports.ReportGenerator = void 0;
const data_store_1 = require("./data-store");
class ReportGenerator {
    generateReport(auditId) {
        const session = data_store_1.dataStore.getAuditSession(auditId);
        const differences = data_store_1.dataStore.getDifferences(auditId);
        const bookInventory = data_store_1.dataStore.getBookInventory(auditId);
        if (!session) {
            throw new Error(`盘点会话不存在: ${auditId}`);
        }
        const totalItems = differences.length;
        const countByType = (type) => differences.filter(d => d.differenceType === type).length;
        const countByApproval = (status) => differences.filter(d => d.approvalStatus === status).length;
        const approvedItems = differences.filter(d => d.approvalStatus === 'approved' && d.adjustmentQuantity !== undefined);
        const beforeAdjustments = approvedItems.map(d => ({
            sku: d.sku,
            location: d.location,
            quantity: d.bookQuantity
        }));
        const afterAdjustments = approvedItems.map(d => ({
            sku: d.sku,
            location: d.location,
            quantity: d.bookQuantity + (d.adjustmentQuantity || 0)
        }));
        const pendingApprovalItems = differences.filter(d => d.approvalStatus === 'pending' && d.adjustmentQuantity !== undefined);
        const completedItems = differences.filter(d => d.approvalStatus === 'approved' || d.approvalStatus === 'rejected');
        const report = {
            auditId,
            auditName: session.name,
            generatedAt: new Date().toISOString(),
            summary: {
                totalItems,
                matchedItems: countByType('matched'),
                profitItems: countByType('profit'),
                lossItems: countByType('loss'),
                notCountedItems: countByType('not_counted'),
                overCountedItems: countByType('over_counted'),
                pendingApproval: countByApproval('pending'),
                approved: countByApproval('approved'),
                rejected: countByApproval('rejected')
            },
            adjustments: {
                before: beforeAdjustments,
                after: afterAdjustments
            },
            pendingApprovalItems,
            completedItems
        };
        data_store_1.dataStore.saveReport(auditId, report);
        session.status = 'completed';
        session.updatedAt = new Date().toISOString();
        data_store_1.dataStore.saveAuditSession(session);
        return report;
    }
    formatReportForDisplay(report) {
        const lines = [];
        lines.push('='.repeat(80));
        lines.push(`仓库盘点报告 - ${report.auditName}`);
        lines.push(`盘点 ID: ${report.auditId}`);
        lines.push(`生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`);
        lines.push('='.repeat(80));
        lines.push('');
        lines.push('【汇总统计】');
        lines.push('-'.repeat(40));
        lines.push(`总记录数: ${report.summary.totalItems}`);
        lines.push(`一致: ${report.summary.matchedItems}`);
        lines.push(`盘盈: ${report.summary.profitItems}`);
        lines.push(`盘亏: ${report.summary.lossItems}`);
        lines.push(`未盘: ${report.summary.notCountedItems}`);
        lines.push(`多盘: ${report.summary.overCountedItems}`);
        lines.push('');
        lines.push(`待审批: ${report.summary.pendingApproval}`);
        lines.push(`已审批: ${report.summary.approved}`);
        lines.push(`已驳回: ${report.summary.rejected}`);
        lines.push('');
        if (report.adjustments.before.length > 0) {
            lines.push('【库存调整明细】');
            lines.push('-'.repeat(80));
            lines.push(`${'SKU'.padEnd(15)} ${'库位'.padEnd(10)} ${'调整前'.padEnd(10)} ${'调整后'.padEnd(10)} ${'调整量'.padEnd(10)}`);
            lines.push('-'.repeat(80));
            for (let i = 0; i < report.adjustments.before.length; i++) {
                const before = report.adjustments.before[i];
                const after = report.adjustments.after[i];
                const adjustment = after.quantity - before.quantity;
                lines.push(`${before.sku.padEnd(15)} ${before.location.padEnd(10)} ` +
                    `${String(before.quantity).padEnd(10)} ${String(after.quantity).padEnd(10)} ` +
                    `${String(adjustment).padEnd(10)}`);
            }
            lines.push('');
        }
        if (report.pendingApprovalItems.length > 0) {
            lines.push('【仍需审批的记录】');
            lines.push('-'.repeat(80));
            lines.push(`${'差异ID'.padEnd(36)} ${'库位'.padEnd(10)} ${'SKU'.padEnd(15)} ` +
                `${'类型'.padEnd(10)} ${'差异量'.padEnd(10)} ${'调整量'.padEnd(10)} ${'负责人'.padEnd(10)}`);
            lines.push('-'.repeat(80));
            for (const item of report.pendingApprovalItems) {
                lines.push(`${item.id.padEnd(36)} ${item.location.padEnd(10)} ${item.sku.padEnd(15)} ` +
                    `${this.formatType(item.differenceType).padEnd(10)} ` +
                    `${String(item.differenceQuantity).padEnd(10)} ` +
                    `${String(item.adjustmentQuantity || 0).padEnd(10)} ` +
                    `${item.owner.padEnd(10)}`);
            }
            lines.push('');
        }
        if (report.completedItems.length > 0) {
            lines.push('【已完成处理的记录】');
            lines.push('-'.repeat(80));
            lines.push(`${'库位'.padEnd(10)} ${'SKU'.padEnd(15)} ${'类型'.padEnd(10)} ` +
                `${'状态'.padEnd(10)} ${'审批人'.padEnd(10)} ${'审批时间'.padEnd(20)}`);
            lines.push('-'.repeat(80));
            for (const item of report.completedItems) {
                lines.push(`${item.location.padEnd(10)} ${item.sku.padEnd(15)} ` +
                    `${this.formatType(item.differenceType).padEnd(10)} ` +
                    `${this.formatStatus(item.approvalStatus).padEnd(10)} ` +
                    `${(item.approvedBy || '-').padEnd(10)} ` +
                    `${(item.approvedAt ? new Date(item.approvedAt).toLocaleDateString('zh-CN') : '-').padEnd(20)}`);
            }
        }
        lines.push('');
        lines.push('='.repeat(80));
        return lines.join('\n');
    }
    formatType(type) {
        const map = {
            matched: '一致',
            profit: '盘盈',
            loss: '盘亏',
            not_counted: '未盘',
            over_counted: '多盘'
        };
        return map[type] || type;
    }
    formatStatus(status) {
        const map = {
            pending: '待审批',
            approved: '已通过',
            rejected: '已驳回'
        };
        return map[status] || status;
    }
}
exports.ReportGenerator = ReportGenerator;
exports.reportGenerator = new ReportGenerator();
