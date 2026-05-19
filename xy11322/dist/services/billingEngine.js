"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingEngine = exports.BillingEngine = void 0;
const store_1 = require("../store");
class BillingEngine {
    constructor() {
        this.config = store_1.dataStore.getConfig();
    }
    calculateBilling(record) {
        const exceptions = [...record.exceptions];
        const adjustments = [];
        let calculatedAmount = 0;
        let finalAmount = 0;
        let status = record.status;
        const crossDayCheck = this.checkCrossDay(record);
        if (crossDayCheck) {
            exceptions.push(crossDayCheck);
            if (this.config.crossDaySplit) {
                adjustments.push({
                    type: 'cross_day_split',
                    reason: '跨天作业已按日期拆分计算',
                    amount: 0,
                    applied: true,
                });
            }
        }
        calculatedAmount = this.calculateBaseAmount(record);
        const duplicateCheck = this.checkDuplicate(record);
        if (duplicateCheck) {
            exceptions.push(duplicateCheck);
            status = 'invalid';
        }
        const alreadyBilledCheck = this.checkAlreadyBilled(record);
        if (alreadyBilledCheck) {
            exceptions.push(alreadyBilledCheck);
            status = 'invalid';
        }
        if (record.status !== 'invalid') {
            const minimumCheck = this.checkMinimumCharge(record, calculatedAmount);
            if (minimumCheck.adjustment) {
                adjustments.push(minimumCheck.adjustment);
                calculatedAmount = Math.max(calculatedAmount, record.minimumCharge);
            }
            if (minimumCheck.exception) {
                exceptions.push(minimumCheck.exception);
            }
        }
        finalAmount = calculatedAmount;
        const hasErrors = exceptions.some(e => e.severity === 'error');
        if (hasErrors && status !== 'invalid') {
            status = 'invalid';
        }
        else if (!hasErrors && status === 'pending') {
            status = 'valid';
        }
        return {
            success: !hasErrors,
            recordId: record.id,
            recordNo: record.recordNo,
            calculatedAmount,
            finalAmount,
            adjustments,
            exceptions,
            status,
        };
    }
    calculateBaseAmount(record) {
        let amount = 0;
        switch (record.billingType) {
            case 'hourly':
                amount = record.workHours * record.hourlyRate;
                break;
            case 'area':
                amount = record.workArea * record.areaRate;
                break;
            case 'fuel':
                amount = record.fuelConsumption * record.fuelRate;
                break;
            case 'mixed':
                amount =
                    record.workHours * record.hourlyRate +
                        record.workArea * record.areaRate +
                        record.fuelConsumption * record.fuelRate;
                break;
        }
        return Math.round(amount * 100) / 100;
    }
    checkCrossDay(record) {
        const startDate = new Date(record.startTime).toDateString();
        const endDate = new Date(record.endTime).toDateString();
        if (startDate !== endDate) {
            return {
                type: 'cross_day',
                message: `作业跨天: 从 ${startDate} 到 ${endDate}`,
                severity: 'warning',
                field: 'time',
                timestamp: new Date(),
            };
        }
        return null;
    }
    checkMinimumCharge(record, calculatedAmount) {
        const result = {};
        if (calculatedAmount < record.minimumCharge) {
            if (this.config.enforceMinimumCharge) {
                result.adjustment = {
                    type: 'minimum_charge',
                    reason: `计算金额 ${calculatedAmount} 低于最低收费 ${record.minimumCharge}`,
                    amount: record.minimumCharge - calculatedAmount,
                    applied: true,
                };
            }
            result.exception = {
                type: 'below_minimum',
                message: `计算金额 ${calculatedAmount} 低于最低收费 ${record.minimumCharge}`,
                severity: 'warning',
                field: 'amount',
                timestamp: new Date(),
            };
        }
        return result;
    }
    checkDuplicate(record) {
        const existing = store_1.dataStore.getRecordByRecordNo(record.recordNo);
        if (existing && existing.id !== record.id) {
            return {
                type: 'duplicate',
                message: `记录编号 ${record.recordNo} 已存在`,
                severity: 'error',
                field: 'recordNo',
                timestamp: new Date(),
            };
        }
        return null;
    }
    checkAlreadyBilled(record) {
        if (record.isBilled) {
            return {
                type: 'already_billed',
                message: `记录 ${record.recordNo} 已结算，无法重复计算`,
                severity: 'error',
                timestamp: new Date(),
            };
        }
        return null;
    }
    batchCalculate(records) {
        return records.map(record => this.calculateBilling(record));
    }
}
exports.BillingEngine = BillingEngine;
exports.billingEngine = new BillingEngine();
