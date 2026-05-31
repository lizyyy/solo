function generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function getPeriodFromDate(dateStr) {
    return dateStr.slice(0, 7);
}
export class JudgmentEngine {
    store;
    config;
    constructor(store, config) {
        this.store = store;
        this.config = config;
    }
    processBatch(receipts) {
        const batchRunId = generateBatchId();
        const results = [];
        const historyEntries = [];
        for (const receipt of receipts) {
            this.store.saveReceipt(receipt);
            const existingJudgments = this.store.getJudgmentsByReceipt(receipt.id);
            const alreadyConfirmed = existingJudgments.find(j => j.judgment === 'auto_confirmed' || j.judgment === 'duplicate');
            if (alreadyConfirmed) {
                const historyEntry = {
                    receiptId: receipt.id,
                    batchRunId,
                    judgment: 'duplicate',
                    processedAt: new Date().toISOString(),
                    skipped: true,
                    skipReason: `该流水已在批次 ${alreadyConfirmed.batchRunId} 中处理过（判断结果：${alreadyConfirmed.judgment}），不重复生成新记录`,
                };
                this.store.saveHistoryEntry(historyEntry);
                historyEntries.push(historyEntry);
                continue;
            }
            const result = this.judge(receipt, batchRunId);
            results.push(result);
            this.store.saveJudgment(result);
            const historyEntry = {
                receiptId: receipt.id,
                batchRunId,
                judgment: result.judgment,
                processedAt: new Date().toISOString(),
                skipped: false,
            };
            this.store.saveHistoryEntry(historyEntry);
            historyEntries.push(historyEntry);
            if (result.judgment === 'cross_period_fee') {
                const alerts = this.detectCrossPeriodFee(receipt);
                for (const alert of alerts) {
                    this.store.saveCrossPeriodAlert(alert);
                }
            }
        }
        const batch = {
            id: batchRunId,
            runAt: new Date().toISOString(),
            receiptIds: receipts.map(r => r.id),
            results,
            status: results.some(r => r.judgment === 'needs_review' || r.judgment === 'cross_period_fee')
                ? 'partial'
                : 'completed',
        };
        this.store.saveBatch(batch);
        return batch;
    }
    judge(receipt, batchRunId) {
        const reasons = [];
        let judgment = 'auto_confirmed';
        const nextSteps = [];
        const existingByOrder = this.store.findReceiptByOrder(receipt.platform, receipt.orderId);
        if (existingByOrder && existingByOrder.id !== receipt.id) {
            judgment = 'duplicate';
            reasons.push({
                code: 'DUPLICATE_ORDER',
                message: '存在相同平台和订单号的收款记录',
                detail: `平台 ${receipt.platform} 的订单 ${receipt.orderId} 已存在于流水 ${existingByOrder.id}`,
                source: 'receipt_line',
            });
            nextSteps.push('核实是否为重复导入，如确认重复可忽略');
            return { receiptId: receipt.id, judgment, reasons, nextSteps, decidedAt: new Date().toISOString(), decidedBy: 'system', batchRunId };
        }
        const receiptPeriod = getPeriodFromDate(receipt.receivedAt);
        const feePeriod = receipt.feePeriod;
        if (feePeriod && feePeriod !== receiptPeriod) {
            judgment = 'cross_period_fee';
            reasons.push({
                code: 'CROSS_PERIOD_FEE',
                message: '手续费归属期间与收款期间不一致',
                detail: `收款期间=${receiptPeriod}，手续费期间=${feePeriod}，差额=${receipt.feeAmount} ${receipt.currency}`,
                source: 'receipt_line',
            });
            nextSteps.push(`联系 ${this.getContactForPlatform(receipt.platform)} 确认手续费归属期间`);
            nextSteps.push('确认后在收款流水中补录手续费归属说明');
        }
        if (receipt.status === 'disputed') {
            judgment = 'needs_review';
            reasons.push({
                code: 'DISPUTED_STATUS',
                message: '该收款流水状态为争议中',
                detail: `流水 ${receipt.id} 当前状态为 disputed，需人工核实`,
                source: 'receipt_line',
            });
            nextSteps.push('查看争议详情并确认是否可确认收款');
        }
        if (receipt.amount <= 0) {
            judgment = 'needs_review';
            reasons.push({
                code: 'INVALID_AMOUNT',
                message: '收款金额异常',
                detail: `流水 ${receipt.id} 金额为 ${receipt.amount}，不满足正常收款条件`,
                source: 'receipt_line',
            });
            nextSteps.push('核实原始订单金额，确认是否录入错误');
        }
        if (judgment === 'auto_confirmed') {
            reasons.push({
                code: 'ALL_CHECKS_PASSED',
                message: '所有自动校验通过',
                detail: `金额正常、期间一致、无争议、无重复订单`,
                source: 'rule_engine',
            });
            nextSteps.push('可进入下一步对账流程');
        }
        return {
            receiptId: receipt.id,
            judgment,
            reasons,
            nextSteps,
            decidedAt: new Date().toISOString(),
            decidedBy: 'system',
            batchRunId,
        };
    }
    detectCrossPeriodFee(receipt) {
        const alerts = [];
        const receiptPeriod = getPeriodFromDate(receipt.receivedAt);
        if (receipt.feePeriod && receipt.feePeriod !== receiptPeriod) {
            const feeSource = receipt.feeAmount > 0 ? 'receipt_line' : 'rate_table';
            const sourceDetail = feeSource === 'receipt_line'
                ? `手续费 ${receipt.feeAmount} ${receipt.currency} 来自收款流水 ${receipt.id} 的 feeAmount 字段`
                : `手续费来自平台 ${receipt.platform} 的费率表，流水 ${receipt.id} 中 feeAmount 为 0`;
            alerts.push({
                receiptId: receipt.id,
                feeAmount: receipt.feeAmount,
                currency: receipt.currency,
                feePeriod: receipt.feePeriod,
                receiptPeriod,
                feeSource,
                sourceDetail,
                contactPerson: this.getContactForPlatform(receipt.platform),
                explanation: `收款流水 ${receipt.id} 的手续费 ${receipt.feeAmount} ${receipt.currency} 归属 ${receipt.feePeriod}，但收款发生在 ${receiptPeriod}，属于跨期手续费`,
                nextAction: `请联系 ${this.getContactForPlatform(receipt.platform)} 补录跨期手续费归属说明，并在对账系统中将手续费调整至正确期间`,
            });
        }
        return alerts;
    }
    getContactForPlatform(platform) {
        return this.config.platformContactMap?.[platform] ?? this.config.crossPeriodContactPerson;
    }
    getProcessingHistory(receiptId) {
        return this.store.getHistory(receiptId);
    }
}
//# sourceMappingURL=judgment-engine.js.map