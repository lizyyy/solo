"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconciliationEngine = exports.ReconciliationEngine = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const dataStore_1 = require("../store/dataStore");
class ReconciliationEngine {
    constructor() {
        this.defaultDepositRule = {
            id: 'default',
            ruleName: '默认规则',
            equipmentType: '通用',
            depositRate: 0.3,
            minDeposit: 500,
            maxDeposit: 10000,
            isActive: true,
            overduePenaltyRate: 0.005,
            overdueGraceDays: 3,
        };
    }
    reconcileOrder(orderNo) {
        const order = dataStore_1.dataStore.getRentalOrderByNo(orderNo);
        if (!order) {
            throw new Error(`订单不存在: ${orderNo}`);
        }
        const repairRecords = dataStore_1.dataStore.getRepairRecordsBySerialNo(order.equipmentSerialNo);
        const boundRepairRecords = repairRecords.filter((r) => r.boundOrderNo === orderNo || this.isRepairWithinRentalPeriod(r, order));
        const rentDetails = this.calculateRentDetails(order);
        const { totalRent, overdueRent } = rentDetails.reduce((acc, detail) => ({
            totalRent: acc.totalRent + detail.amount,
            overdueRent: acc.overdueRent + (detail.isOverdue ? detail.amount : 0),
        }), { totalRent: 0, overdueRent: 0 });
        const repairDetails = this.processRepairDetails(boundRepairRecords, order);
        const { totalRepairCost, tenantLiabilityRepairCost } = repairDetails.reduce((acc, detail) => ({
            totalRepairCost: acc.totalRepairCost + detail.cost,
            tenantLiabilityRepairCost: acc.tenantLiabilityRepairCost +
                (detail.liability === 'tenant' ? detail.cost : 0),
        }), { totalRepairCost: 0, tenantLiabilityRepairCost: 0 });
        const discrepancies = this.detectDiscrepancies(order, boundRepairRecords, rentDetails, repairDetails);
        const deductionDetails = this.calculateDeductionDetails(order, rentDetails, repairDetails);
        const totalDeductions = deductionDetails.reduce((acc, d) => acc + d.amount, 0);
        const depositRefund = order.actualDepositPaid - totalDeductions;
        const result = {
            orderNo: order.orderNo,
            equipmentSerialNo: order.equipmentSerialNo,
            tenantName: order.tenantName,
            summary: {
                totalRent,
                overdueRent,
                totalRepairCost,
                tenantLiabilityRepairCost,
                totalDeductions,
                depositRefund,
            },
            discrepancies,
            breakdown: {
                rentDetails,
                repairDetails,
                deductionDetails,
            },
            status: order.status,
            reviewRecords: dataStore_1.dataStore.getReviewRecordsByOrderNo(orderNo),
            lastUpdated: (0, dayjs_1.default)().toISOString(),
        };
        dataStore_1.dataStore.setReconciliationResult(result);
        return result;
    }
    isRepairWithinRentalPeriod(repair, order) {
        const repairDate = (0, dayjs_1.default)(repair.repairDate);
        const startDate = (0, dayjs_1.default)(order.startDate);
        const endDate = (0, dayjs_1.default)(order.actualReturnDate || order.endDate);
        return repairDate.isAfter(startDate) && repairDate.isBefore(endDate.add(7, 'day'));
    }
    calculateRentDetails(order) {
        const details = [];
        const rule = this.getApplicableRule(order);
        const startDate = (0, dayjs_1.default)(order.startDate);
        const scheduledEndDate = (0, dayjs_1.default)(order.endDate);
        const actualEndDate = (0, dayjs_1.default)(order.actualReturnDate || order.endDate);
        const rentalMonths = this.calculateRentalMonths(startDate, scheduledEndDate);
        let accumulatedDays = 0;
        for (let i = 0; i < rentalMonths; i++) {
            const periodStart = startDate.add(i, 'month');
            const periodEnd = startDate.add(i + 1, 'month').subtract(1, 'day');
            const daysInPeriod = periodEnd.diff(periodStart, 'day') + 1;
            accumulatedDays += daysInPeriod;
            details.push({
                period: `第${i + 1}期租金`,
                startDate: periodStart.format('YYYY-MM-DD'),
                endDate: periodEnd.format('YYYY-MM-DD'),
                days: daysInPeriod,
                amount: order.monthlyRent,
                isOverdue: false,
                explanation: `正常租期租金，按月标准 ${order.monthlyRent} 元计算`,
            });
        }
        if (actualEndDate.isAfter(scheduledEndDate)) {
            const overdueDays = actualEndDate.diff(scheduledEndDate, 'day');
            const chargeableDays = Math.max(0, overdueDays - rule.overdueGraceDays);
            if (chargeableDays > 0) {
                const dailyRent = order.monthlyRent / 30;
                const penaltyAmount = chargeableDays * dailyRent * (1 + rule.overduePenaltyRate);
                details.push({
                    period: '逾期租金',
                    startDate: scheduledEndDate.add(1, 'day').format('YYYY-MM-DD'),
                    endDate: actualEndDate.format('YYYY-MM-DD'),
                    days: overdueDays,
                    amount: Math.round(penaltyAmount * 100) / 100,
                    isOverdue: true,
                    explanation: `逾期 ${overdueDays} 天，宽限 ${rule.overdueGraceDays} 天后计费 ${chargeableDays} 天。` +
                        `日租金 ${dailyRent.toFixed(2)} 元，罚息比例 ${(rule.overduePenaltyRate * 100).toFixed(2)}%/日`,
                });
            }
        }
        return details;
    }
    calculateRentalMonths(start, end) {
        const months = end.diff(start, 'month');
        const remainder = end.diff(start.add(months, 'month'), 'day');
        return remainder > 0 ? months + 1 : months;
    }
    processRepairDetails(repairs, order) {
        return repairs.map((repair) => ({
            repairNo: repair.repairNo,
            repairDate: repair.repairDate,
            content: repair.repairContent,
            cost: repair.repairCost,
            liability: repair.liability,
            boundToSerialNo: repair.equipmentSerialNo,
            explanation: this.getRepairLiabilityExplanation(repair),
        }));
    }
    getRepairLiabilityExplanation(repair) {
        const liabilityMap = {
            tenant: '租客责任 - 因使用不当或人为损坏产生',
            owner: '业主责任 - 设备自然故障或质量问题',
            natural_wear: '自然损耗 - 正常使用产生的磨损，不扣款',
            pending: '待确认 - 需进一步核实责任归属',
        };
        return (liabilityMap[repair.liability] ||
            `责任归属: ${repair.liability}` + (repair.notes ? `。备注: ${repair.notes}` : ''));
    }
    detectDiscrepancies(order, repairs, rentDetails, repairDetails) {
        const discrepancies = [];
        const rule = this.getApplicableRule(order);
        const overdueRent = rentDetails.find((d) => d.isOverdue);
        if (overdueRent) {
            discrepancies.push({
                id: '',
                type: 'overdue_rent',
                orderNo: order.orderNo,
                equipmentSerialNo: order.equipmentSerialNo,
                description: '存在逾期租金',
                detail: overdueRent.explanation,
                expectedAmount: 0,
                actualAmount: overdueRent.amount,
                difference: overdueRent.amount,
                sourceRecords: [order.orderNo, '租期记录'],
                status: 'open',
                createdAt: (0, dayjs_1.default)().toISOString(),
            });
        }
        const expectedDeposit = this.calculateExpectedDeposit(order, rule);
        if (Math.abs(order.actualDepositPaid - expectedDeposit) > 0.01) {
            discrepancies.push({
                id: '',
                type: 'deposit_mismatch',
                orderNo: order.orderNo,
                equipmentSerialNo: order.equipmentSerialNo,
                description: '押金金额不符',
                detail: `按规则应收取押金 ${expectedDeposit} 元，实际收取 ${order.actualDepositPaid} 元`,
                expectedAmount: expectedDeposit,
                actualAmount: order.actualDepositPaid,
                difference: order.actualDepositPaid - expectedDeposit,
                sourceRecords: [order.orderNo, rule.ruleName],
                status: 'open',
                createdAt: (0, dayjs_1.default)().toISOString(),
            });
        }
        const pendingLiabilityRepairs = repairs.filter((r) => r.liability === 'pending');
        if (pendingLiabilityRepairs.length > 0) {
            discrepancies.push({
                id: '',
                type: 'repair_responsibility',
                orderNo: order.orderNo,
                equipmentSerialNo: order.equipmentSerialNo,
                description: '维修责任待确认',
                detail: `${pendingLiabilityRepairs.length} 条维修记录责任归属待确认：${pendingLiabilityRepairs.map((r) => r.repairNo).join(', ')}`,
                expectedAmount: 0,
                actualAmount: pendingLiabilityRepairs.reduce((acc, r) => acc + r.repairCost, 0),
                difference: 0,
                sourceRecords: pendingLiabilityRepairs.map((r) => r.repairNo),
                status: 'pending_review',
                createdAt: (0, dayjs_1.default)().toISOString(),
            });
        }
        const duplicateRepairs = this.detectDuplicateRepairs(repairs);
        duplicateRepairs.forEach((dup) => {
            discrepancies.push({
                id: '',
                type: 'duplicate_deduction',
                orderNo: order.orderNo,
                equipmentSerialNo: order.equipmentSerialNo,
                description: '疑似重复扣款',
                detail: `维修记录 ${dup.map((r) => r.repairNo).join('、')} 内容相似，可能存在重复记账`,
                expectedAmount: dup[0].repairCost,
                actualAmount: dup.reduce((acc, r) => acc + r.repairCost, 0),
                difference: dup.reduce((acc, r) => acc + r.repairCost, 0) - dup[0].repairCost,
                sourceRecords: dup.map((r) => r.repairNo),
                status: 'pending_review',
                createdAt: (0, dayjs_1.default)().toISOString(),
            });
        });
        return discrepancies.map((d) => dataStore_1.dataStore.addDiscrepancy(d));
    }
    detectDuplicateRepairs(repairs) {
        const duplicates = [];
        const processed = new Set();
        for (let i = 0; i < repairs.length; i++) {
            if (processed.has(repairs[i].id))
                continue;
            const group = [repairs[i]];
            processed.add(repairs[i].id);
            for (let j = i + 1; j < repairs.length; j++) {
                if (processed.has(repairs[j].id))
                    continue;
                const similarity = this.calculateRepairSimilarity(repairs[i], repairs[j]);
                if (similarity > 0.7) {
                    group.push(repairs[j]);
                    processed.add(repairs[j].id);
                }
            }
            if (group.length > 1) {
                duplicates.push(group);
            }
        }
        return duplicates;
    }
    calculateRepairSimilarity(a, b) {
        let score = 0;
        if (a.equipmentSerialNo === b.equipmentSerialNo)
            score += 0.3;
        if (Math.abs(a.repairCost - b.repairCost) < 10)
            score += 0.2;
        if ((0, dayjs_1.default)(a.repairDate).diff((0, dayjs_1.default)(b.repairDate), 'day') <= 3)
            score += 0.2;
        if (a.repairContent === b.repairContent)
            score += 0.3;
        return score;
    }
    calculateDeductionDetails(order, rentDetails, repairDetails) {
        const deductions = [];
        const overdueDeduction = rentDetails.find((d) => d.isOverdue);
        if (overdueDeduction) {
            deductions.push({
                type: 'overdue',
                amount: overdueDeduction.amount,
                source: '逾期租金',
                basis: overdueDeduction.explanation,
                evidence: [
                    `订单租期: ${order.startDate} 至 ${order.endDate}`,
                    `实际归还: ${order.actualReturnDate || order.endDate}`,
                ],
            });
        }
        repairDetails
            .filter((d) => d.liability === 'tenant')
            .forEach((repair) => {
            deductions.push({
                type: 'repair',
                amount: repair.cost,
                source: `维修: ${repair.repairNo}`,
                basis: repair.explanation,
                evidence: [
                    `设备序列号: ${repair.boundToSerialNo}`,
                    `维修日期: ${repair.repairDate}`,
                    `维修内容: ${repair.content}`,
                ],
            });
        });
        return deductions;
    }
    calculateExpectedDeposit(order, rule) {
        const calculated = order.monthlyRent * rule.depositRate;
        return Math.min(Math.max(calculated, rule.minDeposit), rule.maxDeposit);
    }
    getApplicableRule(order) {
        const activeRules = dataStore_1.dataStore.getActiveDepositRules();
        return (activeRules.find((r) => order.equipmentName.includes(r.equipmentType)) ||
            activeRules[0] ||
            this.defaultDepositRule);
    }
    reconcileAllOrders() {
        const orders = dataStore_1.dataStore.getAllRentalOrders();
        return orders.map((order) => this.reconcileOrder(order.orderNo));
    }
    getDiscrepancyExplanation(type) {
        const explanations = {
            overdue_rent: '租客未在约定时间内归还设备，根据租赁协议需支付逾期期间的租金及罚息',
            repair_responsibility: '维修责任归属待确认，需核实损坏原因后确定是否从押金中扣除',
            duplicate_deduction: '系统检测到相似的维修记录，可能存在重复扣款，请人工核实',
            deposit_mismatch: '实际收取的押金与规则计算的预期金额不符',
            other: '其他差异，请查看详情',
        };
        return explanations[type] || '未知差异类型';
    }
}
exports.ReconciliationEngine = ReconciliationEngine;
exports.reconciliationEngine = new ReconciliationEngine();
