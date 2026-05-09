"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArrearsService = void 0;
const repositories_1 = require("./repositories");
const database_1 = require("./database");
const utils_1 = require("./utils");
class ArrearsService {
    constructor(dbConnection) {
        this.db = dbConnection || database_1.DatabaseConnection.getInstance();
        this.parkingRepo = new repositories_1.ParkingRecordRepository(this.db);
        this.arrearsRepo = new repositories_1.ArrearsGroupRepository(this.db);
        this.collectionRepo = new repositories_1.CollectionRecordRepository(this.db);
        this.paymentRepo = new repositories_1.PaymentCallbackRepository(this.db);
        this.blacklistRepo = new repositories_1.BlacklistRepository(this.db);
        this.reportRepo = new repositories_1.ReportRepository(this.db);
        this.batchRepo = new repositories_1.BatchRepository(this.db);
        this.historyRepo = new repositories_1.HistoryRepository(this.db);
    }
    importRecords(records, options = {}) {
        const batchId = options.batchId || (0, utils_1.generateId)();
        const warnings = [];
        let newRecords = 0;
        let skippedRecords = 0;
        let totalUnpaid = 0;
        const existingBatch = this.getBatchRecords(batchId);
        if (existingBatch.length > 0) {
            warnings.push(`检测到批次 ${batchId} 已存在，将跳过重复导入的记录`);
            const existingRecords = new Set(existingBatch.map(r => this.generateRecordFingerprint(r)));
            records = records.filter(r => {
                const fingerprint = this.generateInputFingerprint(r);
                if (existingRecords.has(fingerprint)) {
                    skippedRecords++;
                    return false;
                }
                return true;
            });
        }
        if (records.length === 0) {
            return {
                success: true,
                batchId,
                totalRecords: 0,
                newRecords: 0,
                skippedRecords: skippedRecords || 0,
                unpaidAmount: 0,
                message: skippedRecords > 0 ? `全部 ${skippedRecords} 条记录已存在，跳过重复导入` : '没有可导入的记录',
                warnings
            };
        }
        this.db.transaction(() => {
            for (const record of records) {
                const unpaidAmount = Math.max(0, record.totalAmount - record.paidAmount);
                const paymentStatus = unpaidAmount <= 0 ? 'paid' : (record.paidAmount > 0 ? 'partial' : 'unpaid');
                this.parkingRepo.create({
                    plateNumber: record.plateNumber,
                    parkingLotId: record.parkingLotId,
                    parkingLotName: record.parkingLotName,
                    berthId: record.berthId,
                    berthNumber: record.berthNumber,
                    entryTime: record.entryTime,
                    exitTime: record.exitTime,
                    durationMinutes: this.calculateDuration(record.entryTime, record.exitTime),
                    totalAmount: record.totalAmount,
                    paidAmount: record.paidAmount,
                    unpaidAmount,
                    paymentStatus,
                    isRecognizedPlate: record.isRecognizedPlate || false,
                    source: 'import',
                    importedAt: new Date()
                }, 'import', { batchId, operator: options.operator });
                newRecords++;
                if (unpaidAmount > 0) {
                    totalUnpaid += unpaidAmount;
                }
            }
            this.mergeArrearsForBatch(batchId);
        });
        return {
            success: true,
            batchId,
            totalRecords: records.length,
            newRecords,
            skippedRecords,
            unpaidAmount: totalUnpaid,
            message: `成功导入 ${newRecords} 条停车记录${skippedRecords > 0 ? `，跳过 ${skippedRecords} 条已存在记录` : ''}，新增欠费金额 ${(0, utils_1.formatCurrency)(totalUnpaid)}`,
            warnings
        };
    }
    generateRecordFingerprint(record) {
        return `${record.plateNumber}|${record.parkingLotId}|${record.berthId}|${record.entryTime.getTime()}|${record.exitTime.getTime()}`;
    }
    generateInputFingerprint(record) {
        return `${record.plateNumber}|${record.parkingLotId}|${record.berthId}|${record.entryTime.getTime()}|${record.exitTime.getTime()}`;
    }
    getBatchRecords(batchId) {
        return this.parkingRepo.findByBatch(batchId);
    }
    calculateDuration(entry, exit) {
        return Math.max(0, Math.round((exit.getTime() - entry.getTime()) / 60000));
    }
    mergeArrearsForBatch(batchId) {
        const records = this.parkingRepo.findByBatch(batchId);
        const unpaidRecords = records.filter(r => r.unpaidAmount > 0);
        const plateGroups = new Map();
        for (const record of unpaidRecords) {
            const normalized = (0, utils_1.normalizePlate)(record.plateNumber);
            if (!plateGroups.has(normalized)) {
                plateGroups.set(normalized, []);
            }
            plateGroups.get(normalized).push(record);
        }
        for (const [normalized, plateRecords] of plateGroups) {
            this.mergeOrUpdateArrearsGroup(normalized, plateRecords, batchId);
        }
    }
    mergeOrUpdateArrearsGroup(normalizedPlate, newRecords, batchId) {
        const existing = this.arrearsRepo.findByPlate(normalizedPlate);
        const allRecords = existing
            ? [...this.getMergedRecords(existing), ...newRecords]
            : newRecords;
        const uniqueRecords = this.deduplicateRecords(allRecords);
        const totalUnpaid = uniqueRecords.reduce((sum, r) => sum + r.unpaidAmount, 0);
        const sortedByTime = uniqueRecords.sort((a, b) => a.exitTime.getTime() - b.exitTime.getTime());
        const earliest = sortedByTime[0];
        const latest = sortedByTime[sortedByTime.length - 1];
        if (existing) {
            this.arrearsRepo.update(existing.id, {
                totalUnpaidAmount: totalUnpaid,
                recordCount: uniqueRecords.length,
                latestParkingTime: latest.exitTime,
                firstUnpaidTime: earliest.exitTime,
                mergedRecordIds: uniqueRecords.map(r => r.id),
                status: existing.status === 'paid' ? 'pending' : existing.status
            }, 'system', { reason: '新增欠费记录合并', batchId });
        }
        else {
            this.arrearsRepo.create({
                plateNumber: newRecords[0].plateNumber,
                normalizedPlate,
                totalUnpaidAmount: totalUnpaid,
                recordCount: uniqueRecords.length,
                status: 'pending',
                latestParkingTime: latest.exitTime,
                firstUnpaidTime: earliest.exitTime,
                mergedRecordIds: uniqueRecords.map(r => r.id),
                collectionCount: 0
            }, 'system', { batchId });
        }
    }
    getMergedRecords(group) {
        return group.mergedRecordIds
            .map(id => this.parkingRepo.findById(id))
            .filter((r) => r !== null);
    }
    deduplicateRecords(records) {
        const seen = new Set();
        const result = [];
        for (const record of records) {
            const key = `${record.plateNumber}|${record.entryTime.getTime()}|${record.exitTime.getTime()}|${record.berthId}`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push(record);
            }
        }
        return result;
    }
    getArrearsGroup(plateNumber) {
        return this.arrearsRepo.findByPlate(plateNumber);
    }
    getPendingArrears() {
        return this.arrearsRepo.findByStatus('pending');
    }
    performCollection(plateNumber, options = {}) {
        const group = this.arrearsRepo.findByPlate(plateNumber);
        if (!group) {
            return {
                plateNumber,
                totalUnpaid: 0,
                actions: [],
                status: '未找到该车牌的欠费记录'
            };
        }
        if (group.status === 'paid' || group.status === 'withdrawn') {
            return {
                plateNumber,
                totalUnpaid: group.totalUnpaidAmount,
                actions: [],
                status: `当前状态为${(0, utils_1.translateStatus)(group.status)}，无需追缴`
            };
        }
        const actions = [];
        const actionType = options.actionType || this.determineActionType(group);
        const result = this.executeCollectionAction(group, actionType, options.operator);
        actions.push(result);
        const newCollectionCount = group.collectionCount + 1;
        const newStatus = this.updateStatusAfterCollection(group, actionType, newCollectionCount);
        this.arrearsRepo.update(group.id, {
            collectionCount: newCollectionCount,
            lastCollectionTime: new Date(),
            status: newStatus
        }, 'system', { reason: `执行${(0, utils_1.translateActionType)(actionType)}` });
        return {
            plateNumber: group.plateNumber,
            totalUnpaid: group.totalUnpaidAmount,
            actions,
            status: (0, utils_1.translateStatus)(newStatus)
        };
    }
    determineActionType(group) {
        if (group.totalUnpaidAmount >= 500) {
            return 'blacklist';
        }
        if (group.collectionCount === 0) {
            return 'notify';
        }
        if (group.collectionCount >= 2) {
            return 'legal_notice';
        }
        return 'reminder';
    }
    executeCollectionAction(group, actionType, operator) {
        const now = new Date();
        const channel = this.getChannelForAction(actionType);
        const actionResult = 'success';
        const message = this.getMessageForAction(actionType, group);
        this.collectionRepo.create({
            arrearsGroupId: group.id,
            plateNumber: group.plateNumber,
            actionType,
            actionResult,
            channel,
            message,
            source: 'system',
            triggeredAt: now,
            completedAt: now
        }, { operator });
        if (actionType === 'blacklist') {
            const existing = this.blacklistRepo.findByArrearsGroup(group.id);
            if (!existing) {
                this.blacklistRepo.add({
                    plateNumber: group.plateNumber,
                    arrearsGroupId: group.id,
                    totalUnpaidAmount: group.totalUnpaidAmount,
                    recordCount: group.recordCount,
                    addedTime: now,
                    status: 'active',
                    source: 'system',
                    syncStatus: 'pending'
                }, 'system', { operator });
            }
        }
        return {
            type: actionType,
            channel,
            result: actionResult === 'success' ? '成功' : '失败',
            message
        };
    }
    getChannelForAction(actionType) {
        switch (actionType) {
            case 'notify': return '短信';
            case 'reminder': return '短信+电话';
            case 'legal_notice': return '律师函';
            case 'blacklist': return '征信系统';
            case 'withdraw': return '系统';
        }
    }
    getMessageForAction(actionType, group) {
        switch (actionType) {
            case 'notify':
                return `通知车主 ${group.plateNumber}，您有 ${group.recordCount} 笔路侧停车欠费，合计 ${(0, utils_1.formatCurrency)(group.totalUnpaidAmount)}，请尽快处理。`;
            case 'reminder':
                return `再次提醒 ${group.plateNumber}，您的路侧停车欠费 ${(0, utils_1.formatCurrency)(group.totalUnpaidAmount)} 仍未结清，逾期将产生更多费用。`;
            case 'legal_notice':
                return `已向 ${group.plateNumber} 发送律师函，欠费金额 ${(0, utils_1.formatCurrency)(group.totalUnpaidAmount)}，涉及 ${group.recordCount} 笔记录。`;
            case 'blacklist':
                return `${group.plateNumber} 已加入路侧停车失信名单，欠费 ${(0, utils_1.formatCurrency)(group.totalUnpaidAmount)}，影响车辆年检及通行。`;
            case 'withdraw':
                return `撤回 ${group.plateNumber} 的追缴操作。`;
        }
    }
    updateStatusAfterCollection(group, actionType, newCollectionCount) {
        if (actionType === 'blacklist') {
            return 'blacklisted';
        }
        return 'collecting';
    }
    processPaymentCallback(externalOrderId, plateNumber, amount, paymentChannel, paymentTime, options = {}) {
        const existingCallback = this.paymentRepo.findByExternalOrder(externalOrderId);
        if (existingCallback && existingCallback.processed) {
            return {
                success: true,
                message: `订单 ${externalOrderId} 已处理过，重复回调忽略`
            };
        }
        let callbackId = null;
        if (!existingCallback) {
            callbackId = this.paymentRepo.create({
                externalOrderId,
                plateNumber,
                amount,
                paymentChannel,
                paymentTime,
                callbackTime: new Date(),
                source: 'callback'
            }, 'callback', { operator: options.operator });
        }
        else {
            callbackId = existingCallback.id;
        }
        if (!callbackId) {
            return {
                success: false,
                message: '支付回调记录创建失败'
            };
        }
        const group = this.arrearsRepo.findByPlate(plateNumber);
        if (!group) {
            return {
                success: true,
                message: `收到 ${plateNumber} 支付 ${(0, utils_1.formatCurrency)(amount)}，但未找到对应欠费记录，已记录回调待后续匹配`
            };
        }
        return this.applyPaymentToGroup(group, callbackId, amount, options.operator);
    }
    applyPaymentToGroup(group, callbackId, amount, operator) {
        let remainingAmount = amount;
        const records = this.getMergedRecords(group);
        const paidRecords = [];
        const partiallyPaidRecords = [];
        for (const record of records.sort((a, b) => a.exitTime.getTime() - b.exitTime.getTime())) {
            if (remainingAmount <= 0)
                break;
            const toPay = Math.min(remainingAmount, record.unpaidAmount);
            if (toPay > 0) {
                this.parkingRepo.updatePayment(record.id, toPay, operator);
                remainingAmount -= toPay;
                const newUnpaid = record.unpaidAmount - toPay;
                if (newUnpaid <= 0) {
                    paidRecords.push(record.id);
                }
                else {
                    partiallyPaidRecords.push(record.id);
                }
            }
        }
        const updatedRecords = this.getMergedRecords(group);
        const newTotalUnpaid = updatedRecords.reduce((sum, r) => sum + r.unpaidAmount, 0);
        const newStatus = newTotalUnpaid <= 0 ? 'paid' : 'partially_paid';
        this.arrearsRepo.update(group.id, {
            totalUnpaidAmount: newTotalUnpaid,
            status: newStatus
        }, 'system', { reason: '支付回调处理' });
        this.paymentRepo.markProcessed(callbackId, group.id);
        if (newStatus === 'paid') {
            const blacklist = this.blacklistRepo.findByArrearsGroup(group.id);
            if (blacklist && blacklist.status === 'active') {
                this.blacklistRepo.remove(group.id, 'system', { reason: '已结清欠费' });
            }
        }
        const message = newTotalUnpaid <= 0
            ? `${group.plateNumber} 已全额结清，共 ${group.recordCount} 笔欠费，支付 ${(0, utils_1.formatCurrency)(amount)}`
            : `${group.plateNumber} 已部分结清，支付 ${(0, utils_1.formatCurrency)(amount)}，剩余欠费 ${(0, utils_1.formatCurrency)(newTotalUnpaid)}`;
        return {
            success: true,
            message,
            data: {
                plateNumber: group.plateNumber,
                totalPaid: amount,
                remainingAmount: newTotalUnpaid,
                status: (0, utils_1.translateStatus)(newStatus),
                fullyPaidCount: paidRecords.length,
                partiallyPaidCount: partiallyPaidRecords.length
            }
        };
    }
    withdrawArrears(plateNumber, reason, options = {}) {
        const group = this.arrearsRepo.findByPlate(plateNumber);
        if (!group) {
            return {
                success: false,
                plateNumber,
                reason,
                message: `未找到车牌 ${plateNumber} 的欠费记录`
            };
        }
        if (group.status === 'withdrawn') {
            return {
                success: true,
                plateNumber,
                reason,
                message: `${plateNumber} 的欠费记录已撤回过`
            };
        }
        this.db.transaction(() => {
            this.arrearsRepo.withdraw(group.id, reason, options.operator);
            const blacklist = this.blacklistRepo.findByArrearsGroup(group.id);
            if (blacklist && blacklist.status === 'active') {
                this.blacklistRepo.remove(group.id, 'system', { reason: `欠费撤回: ${reason}` });
            }
            this.collectionRepo.create({
                arrearsGroupId: group.id,
                plateNumber,
                actionType: 'withdraw',
                actionResult: 'success',
                channel: '系统',
                message: `撤回原因: ${reason}`,
                source: 'manual',
                triggeredAt: new Date(),
                completedAt: new Date()
            }, { operator: options.operator });
        });
        return {
            success: true,
            plateNumber,
            reason,
            message: `已撤回 ${plateNumber} 的 ${group.recordCount} 笔欠费记录，合计 ${(0, utils_1.formatCurrency)(group.totalUnpaidAmount)}`
        };
    }
    getOperationHistory(plateNumber) {
        const group = this.arrearsRepo.findByPlate(plateNumber);
        if (!group) {
            const parkingRecords = this.parkingRepo.findByPlate(plateNumber);
            const result = [];
            for (const record of parkingRecords) {
                const history = this.historyRepo.getHistory('parking_record', record.id);
                for (const h of history) {
                    result.push({
                        time: (0, utils_1.formatDateTime)(h.createdAt),
                        operation: this.translateOperation(h.operationType),
                        operator: h.operator,
                        reason: h.reason
                    });
                }
            }
            return result.sort((a, b) => b.time.localeCompare(a.time));
        }
        const result = [];
        const groupHistory = this.historyRepo.getHistory('arrears_group', group.id);
        for (const h of groupHistory) {
            result.push({
                time: (0, utils_1.formatDateTime)(h.createdAt),
                operation: this.translateOperation(h.operationType),
                operator: h.operator,
                reason: h.reason
            });
        }
        const collectionRecords = this.collectionRepo.findByArrearsGroup(group.id);
        for (const cr of collectionRecords) {
            result.push({
                time: (0, utils_1.formatDateTime)(cr.triggeredAt),
                operation: (0, utils_1.translateActionType)(cr.actionType),
                operator: cr.operator,
                reason: cr.message
            });
        }
        return result.sort((a, b) => b.time.localeCompare(a.time));
    }
    translateOperation(type) {
        const translations = {
            create: '创建',
            update: '更新',
            delete: '删除',
            withdraw: '撤回',
            reimport: '重新导入'
        };
        return translations[type] || type;
    }
    generateReport() {
        const now = new Date();
        const reportDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const unpaidRecords = this.parkingRepo.findUnpaid();
        const totalAmount = unpaidRecords.reduce((sum, r) => sum + r.totalAmount, 0);
        const pendingAmount = unpaidRecords.reduce((sum, r) => sum + r.unpaidAmount, 0);
        const collectedAmount = totalAmount - pendingAmount;
        const activeBlacklist = this.blacklistRepo.findActive();
        const paidGroups = this.arrearsRepo.findByStatus('paid');
        const newArrears = this.arrearsRepo.findByStatus('pending');
        const summary = `本期共 ${unpaidRecords.length} 笔欠费记录，总金额 ${(0, utils_1.formatCurrency)(totalAmount)}，已收 ${(0, utils_1.formatCurrency)(collectedAmount)}，待收 ${(0, utils_1.formatCurrency)(pendingAmount)}。黑名单 ${activeBlacklist.length} 辆，已结清 ${paidGroups.length} 辆。`;
        const report = {
            reportDate,
            generatedAt: now,
            totalRecords: unpaidRecords.length,
            totalAmount,
            collectedAmount,
            pendingAmount,
            blacklistCount: activeBlacklist.length,
            newArrearsCount: newArrears.length,
            paidCount: paidGroups.length,
            summary
        };
        const id = this.reportRepo.create(report);
        return { ...report, id };
    }
    formatArrearsDetail(plateNumber) {
        const group = this.arrearsRepo.findByPlate(plateNumber);
        if (!group) {
            return `未找到车牌 ${plateNumber} 的欠费记录`;
        }
        const records = this.getMergedRecords(group);
        const collections = this.collectionRepo.findByArrearsGroup(group.id);
        let output = `\n========== 欠费详情：${group.plateNumber} ==========\n`;
        output += `状态: ${(0, utils_1.translateStatus)(group.status)}\n`;
        output += `欠费金额: ${(0, utils_1.formatCurrency)(group.totalUnpaidAmount)}\n`;
        output += `欠费笔数: ${group.recordCount} 笔\n`;
        output += `首次欠费时间: ${(0, utils_1.formatDateTime)(group.firstUnpaidTime)}\n`;
        output += `最近停车时间: ${(0, utils_1.formatDateTime)(group.latestParkingTime)}\n`;
        output += `追缴次数: ${group.collectionCount} 次\n`;
        if (group.lastCollectionTime) {
            output += `最近追缴时间: ${(0, utils_1.formatDateTime)(group.lastCollectionTime)}\n`;
        }
        output += `\n--- 停车记录明细 ---\n`;
        for (const record of records) {
            output += `  泊位 ${record.berthNumber}（${record.parkingLotName}）\n`;
            output += `    入场: ${(0, utils_1.formatDateTime)(record.entryTime)}\n`;
            output += `    出场: ${(0, utils_1.formatDateTime)(record.exitTime)}\n`;
            output += `    时长: ${(0, utils_1.formatDuration)(record.durationMinutes)}\n`;
            output += `    金额: ${(0, utils_1.formatCurrency)(record.totalAmount)}`;
            if (record.paidAmount > 0) {
                output += `（已付 ${(0, utils_1.formatCurrency)(record.paidAmount)}）`;
            }
            if (record.unpaidAmount > 0) {
                output += `【欠费 ${(0, utils_1.formatCurrency)(record.unpaidAmount)}】`;
            }
            output += `\n`;
            if (record.isRecognizedPlate) {
                output += `    车牌类型: 识别车牌\n`;
            }
        }
        if (collections.length > 0) {
            output += `\n--- 追缴历史 ---\n`;
            for (const cr of collections) {
                output += `  [${(0, utils_1.formatDateTime)(cr.triggeredAt)}] ${(0, utils_1.translateActionType)(cr.actionType)} (${cr.channel})\n`;
                if (cr.message) {
                    output += `    内容: ${cr.message}\n`;
                }
            }
        }
        output += `\n========================================\n`;
        return output;
    }
}
exports.ArrearsService = ArrearsService;
//# sourceMappingURL=services.js.map