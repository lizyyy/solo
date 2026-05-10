const store = require('./dataStore');
const invoiceService = require('./invoiceService');

class ReportService {
    generateDailyReport(date) {
        const targetDate = date || new Date().toISOString().slice(0, 10);
        const invoices = store.getInvoices();
        const redemptions = store.getRedemptions();
        const receipts = store.getTaxReceipts();
        const queue = store.getQueue();

        const dailyInvoices = invoices.filter(inv => 
            inv.createdAt.startsWith(targetDate)
        );

        const dailyRedemptions = redemptions.filter(red => 
            red.createdAt.startsWith(targetDate)
        );

        const dailyCompletedRedemptions = redemptions.filter(red => 
            red.status === '已完成' && red.completedAt && red.completedAt.startsWith(targetDate)
        );

        const dailyReceipts = receipts.filter(r => 
            r.processedAt.startsWith(targetDate)
        );

        const blueInvoices = dailyInvoices.filter(inv => inv.invoiceType === '蓝票');
        const redInvoices = dailyInvoices.filter(inv => inv.invoiceType === '红票');

        const totalBlueAmount = blueInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        const totalRedAmount = redInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

        const statusDistribution = {};
        dailyRedemptions.forEach(red => {
            statusDistribution[red.status] = (statusDistribution[red.status] || 0) + 1;
        });

        const queueToday = queue.filter(q => q.createdAt.startsWith(targetDate));
        const queueStats = {
            total: queueToday.length,
            waiting: queueToday.filter(q => q.status === '等待中').length,
            processing: queueToday.filter(q => q.status === '处理中').length,
            completed: queueToday.filter(q => q.status === '已完成').length,
            failed: queueToday.filter(q => q.status === '失败').length,
            cancelled: queueToday.filter(q => q.status === '已取消').length
        };

        return {
            success: true,
            data: {
                reportDate: targetDate,
                generatedAt: new Date().toISOString(),
                summary: {
                    totalInvoicesToday: dailyInvoices.length,
                    blueInvoices: {
                        count: blueInvoices.length,
                        totalAmount: totalBlueAmount
                    },
                    redInvoices: {
                        count: redInvoices.length,
                        totalAmount: totalRedAmount
                    },
                    redemptionRequests: dailyRedemptions.length,
                    completedRedemptions: dailyCompletedRedemptions.length,
                    taxReceipts: dailyReceipts.length,
                    netAmount: totalBlueAmount + totalRedAmount
                },
                redemptionStatus: statusDistribution,
                queueStatistics: queueStats,
                issues: this.identifyIssues(targetDate, invoices, redemptions, queue)
            }
        };
    }

    identifyIssues(targetDate, invoices, redemptions, queue) {
        const issues = [];

        const failedQueue = queue.filter(q => q.status === '失败' && q.createdAt.startsWith(targetDate));
        if (failedQueue.length > 0) {
            issues.push({
                type: '处理失败',
                severity: '高',
                description: `${failedQueue.length}个红冲任务处理失败`,
                detail: failedQueue.map(q => ({
                    queueId: q.id,
                    redemptionId: q.redemptionId,
                    error: q.error
                }))
            });
        }

        const retryingRedemptions = redemptions.filter(r => 
            r.status === '重试中' && r.nextRetryAt
        );
        if (retryingRedemptions.length > 0) {
            issues.push({
                type: '重试中',
                severity: '中',
                description: `${retryingRedemptions.length}个红冲任务正在重试`,
                detail: retryingRedemptions.map(r => ({
                    redemptionId: r.id,
                    retryCount: r.retryCount,
                    maxRetries: r.maxRetries,
                    nextRetryAt: r.nextRetryAt
                }))
            });
        }

        const orphanedRedInvoices = invoices.filter(inv => 
            inv.invoiceType === '红票' && 
            inv.originalInvoiceId && 
            !invoices.find(o => o.id === inv.originalInvoiceId)
        );
        if (orphanedRedInvoices.length > 0) {
            issues.push({
                type: '发票关系异常',
                severity: '高',
                description: `发现${orphanedRedInvoices.length}张红票未找到对应的原发票`,
                detail: orphanedRedInvoices.map(inv => ({
                    invoiceId: inv.id,
                    invoiceNumber: inv.invoiceNumber,
                    originalInvoiceId: inv.originalInvoiceId
                }))
            });
        }

        const duplicateRedemptions = this.findDuplicateRedemptions(redemptions);
        if (duplicateRedemptions.length > 0) {
            issues.push({
                type: '重复申请',
                severity: '中',
                description: `发现${duplicateRedemptions.length}组可能的重复红冲申请`,
                detail: duplicateRedemptions
            });
        }

        return issues;
    }

    findDuplicateRedemptions(redemptions) {
        const grouped = {};
        redemptions.forEach(red => {
            const key = `${red.originalInvoiceId}-${red.reason}`;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(red);
        });

        const duplicates = [];
        Object.values(grouped).forEach(group => {
            if (group.length > 1) {
                duplicates.push({
                    originalInvoiceId: group[0].originalInvoiceId,
                    reason: group[0].reason,
                    count: group.length,
                    redemptions: group.map(g => ({
                        id: g.id,
                        status: g.status,
                        createdAt: g.createdAt
                    }))
                });
            }
        });

        return duplicates;
    }

    generateInvoiceRelationshipReport(invoiceId) {
        const result = invoiceService.getInvoiceRelationship(invoiceId);
        if (!result.success) {
            return result;
        }

        const relationship = result.data;
        const chain = this.buildRelationshipChain(relationship);

        return {
            success: true,
            data: {
                currentInvoice: {
                    id: relationship.currentInvoice.id,
                    number: relationship.currentInvoice.invoiceNumber,
                    type: relationship.currentInvoice.invoiceType,
                    status: relationship.currentInvoice.status,
                    redemptionStatus: relationship.currentInvoice.redemptionStatus
                },
                relationshipChain: chain,
                relatedInvoices: {
                    original: relationship.originalInvoice ? {
                        id: relationship.originalInvoice.id,
                        number: relationship.originalInvoice.invoiceNumber,
                        type: relationship.originalInvoice.invoiceType
                    } : null,
                    blueInvoices: relationship.relatedBlueInvoices.map(inv => ({
                        id: inv.id,
                        number: inv.invoiceNumber,
                        status: inv.status
                    })),
                    redInvoices: relationship.relatedRedInvoices.map(inv => ({
                        id: inv.id,
                        number: inv.invoiceNumber,
                        status: inv.status
                    }))
                },
                warnings: this.checkRelationshipWarnings(relationship)
            }
        };
    }

    buildRelationshipChain(relationship) {
        const chain = [];
        const visited = new Set();

        const traverse = (invoice, relation) => {
            if (!invoice || visited.has(invoice.id)) return;
            visited.add(invoice.id);

            chain.push({
                id: invoice.id,
                number: invoice.invoiceNumber,
                type: invoice.invoiceType,
                relation: relation,
                status: invoice.status
            });
        };

        if (relationship.originalInvoice) {
            traverse(relationship.originalInvoice, '原发票');
        }
        traverse(relationship.currentInvoice, '当前发票');
        relationship.relatedBlueInvoices.forEach(inv => traverse(inv, '关联蓝票'));
        relationship.relatedRedInvoices.forEach(inv => traverse(inv, '关联红票'));

        return chain;
    }

    checkRelationshipWarnings(relationship) {
        const warnings = [];

        if (relationship.currentInvoice.invoiceType === '红票' && !relationship.originalInvoice) {
            warnings.push({
                level: '高',
                message: '这是一张红票，但未找到对应的原发票',
                suggestion: '请检查发票关系是否正确建立'
            });
        }

        if (relationship.relatedRedInvoices.length > 1) {
            warnings.push({
                level: '中',
                message: `该发票对应${relationship.relatedRedInvoices.length}张红票，请确认是否正确`,
                suggestion: '通常一张发票对应一张红票，多张可能存在重复红冲'
            });
        }

        if (relationship.currentInvoice.redemptionStatus === '已红冲' && relationship.relatedRedInvoices.length === 0) {
            warnings.push({
                level: '高',
                message: '发票状态显示已红冲，但未找到对应的红票',
                suggestion: '请检查红票是否已正确生成并关联'
            });
        }

        return warnings;
    }
}

module.exports = new ReportService();
