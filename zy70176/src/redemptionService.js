const store = require('./dataStore');
const invoiceService = require('./invoiceService');
const taxService = require('./taxService');

class RedemptionService {
    createRedemptionRequest(data) {
        const { originalInvoiceId, reason, operator } = data;

        const originalInvoice = invoiceService.getInvoice(originalInvoiceId);
        if (!originalInvoice) {
            return { success: false, message: '发票不存在，请检查发票编号' };
        }

        if (originalInvoice.status !== '正常') {
            return { success: false, message: '发票状态异常，无法红冲' };
        }

        const existingRedemptions = store.getRedemptionByOriginalInvoice(originalInvoiceId);
        const pendingOrProcessing = existingRedemptions.find(r => 
            ['待审批', '审批中', '待处理', '处理中', '待排队', '排队中', '重试中'].includes(r.status)
        );

        if (pendingOrProcessing) {
            return { 
                success: false, 
                message: '该发票已有红冲申请在处理中，请不要重复提交',
                detail: `已有申请状态：${pendingOrProcessing.status}`
            };
        }

        const alreadyRedeemed = existingRedemptions.find(r => r.status === '已完成');
        if (alreadyRedeemed) {
            return { 
                success: false, 
                message: '该发票已完成红冲，不能重复红冲',
                detail: '如需再次处理，请先撤销之前的红冲或联系管理员'
            };
        }

        const redemption = {
            id: this.generateId('RED'),
            originalInvoiceId,
            originalInvoiceNumber: originalInvoice.invoiceNumber,
            reason,
            operator,
            status: '待审批',
            createdAt: new Date().toISOString(),
            approvedAt: null,
            rejectedAt: null,
            completedAt: null,
            cancelledAt: null,
            redInvoiceId: null,
            retryCount: 0,
            maxRetries: 3,
            nextRetryAt: null
        };

        store.addRedemption(redemption);

        return {
            success: true,
            message: '红冲申请已提交，等待审批',
            data: {
                redemptionId: redemption.id,
                originalInvoiceNumber: originalInvoice.invoiceNumber,
                status: '待审批',
                estimatedTime: '预计1-2个工作日完成审批'
            }
        };
    }

    approveRedemption(redemptionId, approver) {
        const redemption = store.getRedemptionById(redemptionId);
        if (!redemption) {
            return { success: false, message: '红冲申请不存在' };
        }

        if (redemption.status !== '待审批') {
            return { success: false, message: `当前状态为${redemption.status}，无法审批` };
        }

        redemption.status = '待排队';
        redemption.approvedAt = new Date().toISOString();
        redemption.approver = approver;
        store.updateRedemption(redemption);

        const queueItem = {
            id: this.generateId('QUE'),
            redemptionId: redemptionId,
            originalInvoiceId: redemption.originalInvoiceId,
            status: '等待中',
            queuePosition: this.getNextQueuePosition(),
            createdAt: new Date().toISOString(),
            startedAt: null,
            completedAt: null
        };
        store.addQueueItem(queueItem);

        return {
            success: true,
            message: '红冲申请已审批通过，已加入处理队列',
            data: {
                redemptionId: redemption.id,
                status: '待排队',
                queuePosition: queueItem.queuePosition,
                estimatedTime: '根据队列情况，预计30分钟内开始处理'
            }
        };
    }

    rejectRedemption(redemptionId, reason, approver) {
        const redemption = store.getRedemptionById(redemptionId);
        if (!redemption) {
            return { success: false, message: '红冲申请不存在' };
        }

        if (redemption.status !== '待审批') {
            return { success: false, message: `当前状态为${redemption.status}，无法拒绝` };
        }

        redemption.status = '已拒绝';
        redemption.rejectedAt = new Date().toISOString();
        redemption.rejectReason = reason;
        redemption.approver = approver;
        store.updateRedemption(redemption);

        return {
            success: true,
            message: '红冲申请已拒绝',
            data: {
                redemptionId: redemption.id,
                status: '已拒绝',
                rejectReason: reason
            }
        };
    }

    cancelRedemption(redemptionId, operator, reason) {
        const redemption = store.getRedemptionById(redemptionId);
        if (!redemption) {
            return { success: false, message: '红冲申请不存在' };
        }

        const cancelableStatuses = ['待审批', '待排队', '排队中'];
        if (!cancelableStatuses.includes(redemption.status)) {
            return { 
                success: false, 
                message: `当前状态为${redemption.status}，无法撤销`,
                detail: '只有待审批、待排队和排队中的申请可以撤销'
            };
        }

        redemption.status = '已撤销';
        redemption.cancelledAt = new Date().toISOString();
        redemption.cancelReason = reason;
        redemption.cancelledBy = operator;
        store.updateRedemption(redemption);

        const queue = store.getQueue();
        queue.forEach(item => {
            if (item.redemptionId === redemptionId && ['等待中', '排队中'].includes(item.status)) {
                item.status = '已取消';
                item.cancelledAt = new Date().toISOString();
                store.updateQueueItem(item);
            }
        });

        return {
            success: true,
            message: '红冲申请已撤销',
            data: {
                redemptionId: redemption.id,
                status: '已撤销',
                cancelledAt: redemption.cancelledAt
            }
        };
    }

    processQueue() {
        const waitingItems = store.getQueueItemsByStatus('等待中');
        const processingItems = store.getQueueItemsByStatus('处理中');

        if (processingItems.length >= 1) {
            return { 
                success: true, 
                message: '已有任务在处理中，请稍后',
                processingCount: processingItems.length,
                waitingCount: waitingItems.length
            };
        }

        if (waitingItems.length === 0) {
            return { success: true, message: '队列为空，无需处理' };
        }

        const nextItem = waitingItems.sort((a, b) => a.queuePosition - b.queuePosition)[0];
        const redemption = store.getRedemptionById(nextItem.redemptionId);

        if (!redemption) {
            nextItem.status = '失败';
            nextItem.error = '红冲申请不存在';
            store.updateQueueItem(nextItem);
            return { success: false, message: '红冲申请不存在' };
        }

        nextItem.status = '处理中';
        nextItem.startedAt = new Date().toISOString();
        store.updateQueueItem(nextItem);

        redemption.status = '处理中';
        store.updateRedemption(redemption);

        const taxResult = taxService.processRedemption(redemption);

        if (taxResult.success) {
            nextItem.status = '已完成';
            nextItem.completedAt = new Date().toISOString();
            store.updateQueueItem(nextItem);

            redemption.status = '已完成';
            redemption.completedAt = new Date().toISOString();
            redemption.redInvoiceId = taxResult.data.redInvoiceId;
            store.updateRedemption(redemption);

            const originalInvoice = invoiceService.getInvoice(redemption.originalInvoiceId);
            if (originalInvoice) {
                originalInvoice.redemptionStatus = '已红冲';
                originalInvoice.relatedInvoices.push(taxResult.data.redInvoiceId);
                invoiceService.updateInvoice(originalInvoice);
            }

            return {
                success: true,
                message: '红冲处理完成',
                data: {
                    redemptionId: redemption.id,
                    status: '已完成',
                    redInvoiceNumber: taxResult.data.redInvoiceNumber,
                    taxReceiptNumber: taxResult.data.taxReceiptNumber
                }
            };
        } else {
            nextItem.status = '失败';
            nextItem.error = taxResult.message;
            store.updateQueueItem(nextItem);

            if (redemption.retryCount < redemption.maxRetries) {
                redemption.status = '重试中';
                redemption.retryCount += 1;
                redemption.nextRetryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
                store.updateRedemption(redemption);

                return {
                    success: false,
                    message: '红冲处理失败，已加入重试队列',
                    data: {
                        redemptionId: redemption.id,
                        status: '重试中',
                        retryCount: redemption.retryCount,
                        maxRetries: redemption.maxRetries,
                        nextRetryAt: redemption.nextRetryAt,
                        error: taxResult.message
                    }
                };
            } else {
                redemption.status = '失败';
                redemption.finalError = taxResult.message;
                store.updateRedemption(redemption);

                return {
                    success: false,
                    message: '红冲处理失败，已达到最大重试次数',
                    data: {
                        redemptionId: redemption.id,
                        status: '失败',
                        retryCount: redemption.retryCount,
                        error: taxResult.message
                    }
                };
            }
        }
    }

    retryRedemption(redemptionId, operator) {
        const redemption = store.getRedemptionById(redemptionId);
        if (!redemption) {
            return { success: false, message: '红冲申请不存在' };
        }

        if (redemption.status !== '失败') {
            return { success: false, message: `当前状态为${redemption.status}，无法手动重试` };
        }

        redemption.status = '待排队';
        redemption.retryCount = 0;
        redemption.nextRetryAt = null;
        redemption.finalError = null;
        store.updateRedemption(redemption);

        const queueItem = {
            id: this.generateId('QUE'),
            redemptionId: redemptionId,
            originalInvoiceId: redemption.originalInvoiceId,
            status: '等待中',
            queuePosition: this.getNextQueuePosition(),
            createdAt: new Date().toISOString(),
            startedAt: null,
            completedAt: null,
            isRetry: true,
            retryInitiatedBy: operator
        };
        store.addQueueItem(queueItem);

        return {
            success: true,
            message: '已重新加入处理队列',
            data: {
                redemptionId: redemption.id,
                status: '待排队',
                queuePosition: queueItem.queuePosition
            }
        };
    }

    getRedemption(redemptionId) {
        const redemption = store.getRedemptionById(redemptionId);
        if (!redemption) {
            return { success: false, message: '红冲申请不存在' };
        }
        return { success: true, data: redemption };
    }

    getAllRedemptions() {
        return { success: true, data: store.getRedemptions() };
    }

    getQueueStatus() {
        const queue = store.getQueue();
        const waiting = queue.filter(q => q.status === '等待中').sort((a, b) => a.queuePosition - b.queuePosition);
        const processing = queue.filter(q => q.status === '处理中');
        const completed = queue.filter(q => q.status === '已完成');
        const failed = queue.filter(q => q.status === '失败');
        const cancelled = queue.filter(q => q.status === '已取消');

        return {
            success: true,
            data: {
                waiting: waiting.length,
                processing: processing.length,
                completed: completed.length,
                failed: failed.length,
                cancelled: cancelled.length,
                waitingList: waiting.map(q => ({
                    queueId: q.id,
                    redemptionId: q.redemptionId,
                    queuePosition: q.queuePosition,
                    createdAt: q.createdAt
                }))
            }
        };
    }

    getNextQueuePosition() {
        const queue = store.getQueue();
        const maxPosition = queue.reduce((max, item) => Math.max(max, item.queuePosition || 0), 0);
        return maxPosition + 1;
    }

    generateId(prefix) {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    }
}

module.exports = new RedemptionService();
