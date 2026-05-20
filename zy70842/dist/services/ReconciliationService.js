"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconciliationService = void 0;
const uuid_1 = require("uuid");
const dayjs_1 = __importDefault(require("dayjs"));
const types_1 = require("../models/types");
const store_1 = require("../models/store");
class ReconciliationService {
    async createReconciliation(applicationId) {
        const application = store_1.dataStore.getBoothApplication(applicationId);
        if (!application) {
            return null;
        }
        const existingRecord = store_1.dataStore.getReconciliationByApplicationId(applicationId);
        if (existingRecord) {
            return existingRecord;
        }
        const record = {
            id: (0, uuid_1.v4)(),
            applicationId: application.id,
            applicationNo: application.applicationNo,
            merchantName: application.merchantName,
            boothLocation: application.boothLocation,
            startDate: application.startDate,
            endDate: application.endDate,
            boothFee: application.boothFee,
            depositAmount: application.depositAmount,
            actualBoothFee: application.boothFee,
            actualDepositAmount: application.depositAmount,
            deductions: [],
            totalAmount: application.boothFee + application.depositAmount,
            discrepancies: [],
            reviewActions: [],
            status: 'DRAFT',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        store_1.dataStore.addReconciliationRecord(record);
        await this.autoCheck(record.id);
        return store_1.dataStore.getReconciliationRecord(record.id) || null;
    }
    async autoCheck(reconciliationId) {
        const record = store_1.dataStore.getReconciliationRecord(reconciliationId);
        if (!record) {
            return [];
        }
        const discrepancies = [];
        discrepancies.push(...this.checkLicenseExpiry(record));
        discrepancies.push(...this.checkTimeConflict(record));
        discrepancies.push(...this.checkMissingDocuments(record));
        discrepancies.push(...this.checkFeeMismatch(record));
        discrepancies.push(...this.checkDepositDeduction(record));
        for (const disc of discrepancies) {
            record.discrepancies.push(disc);
        }
        const requiresManualReview = discrepancies.some(d => d.requiresManualReview);
        record.status = requiresManualReview ? 'REVIEWING' : 'APPROVED';
        this.recalculateAmount(record);
        store_1.dataStore.updateReconciliationRecord(reconciliationId, {
            discrepancies: record.discrepancies,
            status: record.status,
            actualBoothFee: record.actualBoothFee,
            actualDepositAmount: record.actualDepositAmount,
            deductions: record.deductions,
            totalAmount: record.totalAmount
        });
        return discrepancies;
    }
    checkLicenseExpiry(record) {
        const discrepancies = [];
        const licenses = store_1.dataStore.getLicenseAttachmentsByApplicationId(record.applicationId);
        const today = (0, dayjs_1.default)();
        for (const license of licenses) {
            if (license.expiryDate) {
                const expiryDate = (0, dayjs_1.default)(license.expiryDate);
                if (expiryDate.isBefore(today)) {
                    discrepancies.push({
                        id: (0, uuid_1.v4)(),
                        reconciliationId: record.id,
                        type: types_1.DiscrepancyType.LICENSE_EXPIRED,
                        description: `${this.getLicenseTypeName(license.licenseType)}已过期`,
                        sourceField: 'license.expiryDate',
                        expectedValue: `有效日期 > ${today.format('YYYY-MM-DD')}`,
                        actualValue: license.expiryDate,
                        severity: 'HIGH',
                        status: types_1.DiscrepancyStatus.PENDING,
                        requiresManualReview: true,
                        explanation: `证照将于活动开始前已过期，需要商户更新证照后才能继续审批通过。`,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
                else if (expiryDate.diff(today, 'day') <= 30) {
                    discrepancies.push({
                        id: (0, uuid_1.v4)(),
                        reconciliationId: record.id,
                        type: types_1.DiscrepancyType.LICENSE_EXPIRED,
                        description: `${this.getLicenseTypeName(license.licenseType)}即将过期（剩余${expiryDate.diff(today, 'day')}天）`,
                        sourceField: 'license.expiryDate',
                        expectedValue: `有效日期 > ${today.format('YYYY-MM-DD')}`,
                        actualValue: license.expiryDate,
                        severity: 'MEDIUM',
                        status: types_1.DiscrepancyStatus.PENDING,
                        requiresManualReview: false,
                        explanation: `证照将在30天内过期，建议提醒商户及时更新。`,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
            }
        }
        return discrepancies;
    }
    checkTimeConflict(record) {
        const discrepancies = [];
        const calendars = store_1.dataStore.getVenueCalendarByDateRange(record.boothLocation, record.startDate, record.endDate);
        const conflictDates = [];
        const bookedBy = [];
        for (const cal of calendars) {
            if (!cal.isAvailable && cal.bookedApplicationId && cal.bookedApplicationId !== record.applicationId) {
                conflictDates.push(cal.date);
                if (cal.bookedMerchantName && !bookedBy.includes(cal.bookedMerchantName)) {
                    bookedBy.push(cal.bookedMerchantName);
                }
            }
        }
        if (conflictDates.length > 0) {
            discrepancies.push({
                id: (0, uuid_1.v4)(),
                reconciliationId: record.id,
                type: types_1.DiscrepancyType.TIME_CONFLICT,
                description: `摊位时间冲突`,
                sourceField: 'booth.timerange',
                expectedValue: `${record.startDate} 至 ${record.endDate} 期间摊位空闲`,
                actualValue: `${conflictDates.join(', ')} 已被其他商户预订`,
                severity: 'HIGH',
                status: types_1.DiscrepancyStatus.PENDING,
                requiresManualReview: true,
                explanation: `申请的时间段内有 ${conflictDates.length} 天存在时间冲突，已被 ${bookedBy.join('、')} 预订。需要调整档期或与商户协商解决方案。`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            const deduction = {
                id: (0, uuid_1.v4)(),
                type: '时间冲突扣减',
                amount: 0,
                reason: '时间冲突导致的费用调整',
                createdAt: new Date().toISOString()
            };
            record.deductions.push(deduction);
        }
        return discrepancies;
    }
    checkMissingDocuments(record) {
        const discrepancies = [];
        const licenses = store_1.dataStore.getLicenseAttachmentsByApplicationId(record.applicationId);
        const application = store_1.dataStore.getBoothApplication(record.applicationId);
        if (!application)
            return [];
        const requiredLicenses = [];
        if (application.boothType === '餐饮类') {
            requiredLicenses.push('BUSINESS_LICENSE', 'FOOD_SAFETY', 'FIRE_SAFETY');
        }
        else {
            requiredLicenses.push('BUSINESS_LICENSE');
        }
        const existingLicenseTypes = licenses.map(l => l.licenseType);
        const missingTypes = requiredLicenses.filter(t => !existingLicenseTypes.includes(t));
        if (missingTypes.length > 0) {
            discrepancies.push({
                id: (0, uuid_1.v4)(),
                reconciliationId: record.id,
                type: types_1.DiscrepancyType.MISSING_DOCUMENT,
                description: '缺少必需证照',
                sourceField: 'license.documents',
                expectedValue: `需要提供: ${missingTypes.map(t => this.getLicenseTypeName(t)).join('、')}`,
                actualValue: '未提供',
                severity: 'HIGH',
                status: types_1.DiscrepancyStatus.PENDING,
                requiresManualReview: true,
                explanation: `根据摊位类型"${application.boothType}"，商户需要提供完整的证照材料。请通知商户补充提交。`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        return discrepancies;
    }
    checkFeeMismatch(record) {
        const discrepancies = [];
        const calendars = store_1.dataStore.getVenueCalendarByDateRange(record.boothLocation, record.startDate, record.endDate);
        const availableDays = calendars.filter(c => c.isAvailable || c.bookedApplicationId === record.applicationId).length;
        const totalDays = (0, dayjs_1.default)(record.endDate).diff((0, dayjs_1.default)(record.startDate), 'day') + 1;
        if (availableDays < totalDays && availableDays > 0) {
            const expectedFee = (record.boothFee / totalDays) * availableDays;
            const diffAmount = record.boothFee - expectedFee;
            if (Math.abs(diffAmount) > 0.01) {
                discrepancies.push({
                    id: (0, uuid_1.v4)(),
                    reconciliationId: record.id,
                    type: types_1.DiscrepancyType.FEE_MISMATCH,
                    description: '实际使用天数与费用不匹配',
                    sourceField: 'booth.fee',
                    expectedValue: `预计费用 ${expectedFee.toFixed(2)} 元（${availableDays}天）`,
                    actualValue: `申请费用 ${record.boothFee} 元（${totalDays}天）`,
                    severity: 'MEDIUM',
                    status: types_1.DiscrepancyStatus.PENDING,
                    requiresManualReview: true,
                    explanation: `由于时间冲突，实际可使用天数为 ${availableDays} 天，建议按照实际使用天数调整费用。`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
        }
        return discrepancies;
    }
    getLicenseTypeName(type) {
        const typeMap = {
            BUSINESS_LICENSE: '营业执照',
            FIRE_SAFETY: '消防合格证',
            FOOD_SAFETY: '食品经营许可证',
            OTHER: '其他证照'
        };
        return typeMap[type] || type;
    }
    checkDepositDeduction(record) {
        const discrepancies = [];
        const depositDeductions = store_1.dataStore.getDepositDeductionsByApplicationId(record.applicationId);
        if (depositDeductions.length === 0) {
            return discrepancies;
        }
        const totalDeductionAmount = depositDeductions.reduce((sum, d) => sum + d.amount, 0);
        const verifiedDeductions = depositDeductions.filter(d => d.isVerified);
        const unverifiedDeductions = depositDeductions.filter(d => !d.isVerified);
        if (totalDeductionAmount > 0) {
            discrepancies.push({
                id: (0, uuid_1.v4)(),
                reconciliationId: record.id,
                type: types_1.DiscrepancyType.DEPOSIT_DEDUCTION,
                description: `存在${depositDeductions.length}项押金扣减记录，合计¥${totalDeductionAmount}`,
                sourceField: 'deposit.deductions',
                expectedValue: `押金全额退还: ¥${record.depositAmount}`,
                actualValue: `扣减后实际退还: ¥${Math.max(0, record.depositAmount - totalDeductionAmount)}`,
                severity: totalDeductionAmount > record.depositAmount * 0.5 ? 'HIGH' : 'MEDIUM',
                status: types_1.DiscrepancyStatus.PENDING,
                requiresManualReview: true,
                explanation: this.generateDepositDeductionExplanation(depositDeductions, totalDeductionAmount, record.depositAmount),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            for (const deduction of depositDeductions) {
                const deductionItem = {
                    id: (0, uuid_1.v4)(),
                    type: `押金扣减-${this.getDepositDeductionTypeName(deduction.deductionType)}`,
                    amount: deduction.amount,
                    reason: deduction.description,
                    createdAt: new Date().toISOString()
                };
                record.deductions.push(deductionItem);
            }
        }
        if (unverifiedDeductions.length > 0) {
            discrepancies.push({
                id: (0, uuid_1.v4)(),
                reconciliationId: record.id,
                type: types_1.DiscrepancyType.DEPOSIT_DEDUCTION,
                description: `${unverifiedDeductions.length}项押金扣减记录待核实`,
                sourceField: 'deposit.deductions.unverified',
                expectedValue: '所有扣减记录需核实确认',
                actualValue: `${unverifiedDeductions.length}项未核实`,
                severity: 'MEDIUM',
                status: types_1.DiscrepancyStatus.PENDING,
                requiresManualReview: true,
                explanation: `以下${unverifiedDeductions.length}项扣减记录需要人工核实确认：${unverifiedDeductions.map(d => d.description).join('；')}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        return discrepancies;
    }
    generateDepositDeductionExplanation(deductions, totalAmount, depositAmount) {
        const explanation = [];
        explanation.push(`商户押金¥${depositAmount}，共有${deductions.length}项扣减记录，合计扣减¥${totalAmount}。`);
        for (const deduction of deductions) {
            const status = deduction.isVerified ? '已核实' : '待核实';
            explanation.push(`- ${this.getDepositDeductionTypeName(deduction.deductionType)}：¥${deduction.amount}（${status}）-${deduction.description}`);
        }
        const remaining = Math.max(0, depositAmount - totalAmount);
        explanation.push(`扣减后实际应退押金：¥${remaining}。请招商运营确认扣减项目的合理性和准确性。`);
        return explanation.join(' ');
    }
    getDepositDeductionTypeName(type) {
        const typeMap = {
            [types_1.DepositDeductionType.FACILITY_DAMAGE]: '设施损坏赔偿',
            [types_1.DepositDeductionType.CLEANING_FEE]: '清洁费用',
            [types_1.DepositDeductionType.OVERTIME_PENALTY]: '超时罚款',
            [types_1.DepositDeductionType.VIOLATION_FINE]: '违规罚款',
            [types_1.DepositDeductionType.OTHER]: '其他'
        };
        return typeMap[type] || type;
    }
    async reviewDiscrepancy(reconciliationId, discrepancyId, reviewer, result, notes, adjustmentAmount, adjustmentReason) {
        const record = store_1.dataStore.getReconciliationRecord(reconciliationId);
        if (!record) {
            return null;
        }
        const discrepancy = record.discrepancies.find(d => d.id === discrepancyId);
        if (!discrepancy) {
            return null;
        }
        const statusMap = {
            [types_1.ReviewResult.APPROVE]: types_1.DiscrepancyStatus.APPROVED,
            [types_1.ReviewResult.REJECT]: types_1.DiscrepancyStatus.REJECTED,
            [types_1.ReviewResult.REQUEST_DOCUMENTS]: types_1.DiscrepancyStatus.DOCUMENTS_REQUESTED,
            [types_1.ReviewResult.ADJUST_AND_APPROVE]: types_1.DiscrepancyStatus.APPROVED
        };
        discrepancy.status = statusMap[result];
        discrepancy.updatedAt = new Date().toISOString();
        const reviewAction = {
            id: (0, uuid_1.v4)(),
            reconciliationId,
            discrepancyId,
            reviewer,
            reviewResult: result,
            reviewNotes: notes,
            adjustmentAmount,
            adjustmentReason,
            reviewedAt: new Date().toISOString()
        };
        record.reviewActions.push(reviewAction);
        if (result === types_1.ReviewResult.ADJUST_AND_APPROVE && adjustmentAmount !== undefined) {
            const deduction = {
                id: (0, uuid_1.v4)(),
                type: adjustmentReason || '人工调整',
                amount: adjustmentAmount,
                reason: notes,
                createdAt: new Date().toISOString()
            };
            record.deductions.push(deduction);
        }
        this.recalculateAmount(record);
        const allResolved = record.discrepancies.every(d => d.status !== types_1.DiscrepancyStatus.PENDING);
        if (allResolved) {
            const hasRejected = record.discrepancies.some(d => d.status === types_1.DiscrepancyStatus.REJECTED);
            record.status = hasRejected ? 'REJECTED' : 'APPROVED';
            record.reviewedBy = reviewer;
            record.reviewedAt = new Date().toISOString();
        }
        store_1.dataStore.updateReconciliationRecord(reconciliationId, {
            discrepancies: record.discrepancies,
            reviewActions: record.reviewActions,
            deductions: record.deductions,
            actualBoothFee: record.actualBoothFee,
            actualDepositAmount: record.actualDepositAmount,
            totalAmount: record.totalAmount,
            status: record.status,
            reviewedBy: record.reviewedBy,
            reviewedAt: record.reviewedAt
        });
        return store_1.dataStore.getReconciliationRecord(reconciliationId) || null;
    }
    recalculateAmount(record) {
        let boothFeeDeductions = 0;
        let depositDeductions = 0;
        for (const deduction of record.deductions) {
            if (deduction.type.startsWith('押金扣减-')) {
                depositDeductions += deduction.amount;
            }
            else {
                boothFeeDeductions += deduction.amount;
            }
        }
        record.actualBoothFee = Math.max(0, record.boothFee - boothFeeDeductions);
        record.actualDepositAmount = Math.max(0, record.depositAmount - depositDeductions);
        record.totalAmount = record.actualBoothFee + record.actualDepositAmount;
    }
    async completeReconciliation(reconciliationId, reviewer) {
        const record = store_1.dataStore.getReconciliationRecord(reconciliationId);
        if (!record) {
            return null;
        }
        if (record.status !== 'APPROVED') {
            throw new Error('只有已批准的对账记录才能完成');
        }
        record.status = 'COMPLETED';
        record.completedAt = new Date().toISOString();
        record.reviewedBy = reviewer;
        record.reviewedAt = new Date().toISOString();
        store_1.dataStore.updateReconciliationRecord(reconciliationId, {
            status: record.status,
            completedAt: record.completedAt,
            reviewedBy: record.reviewedBy,
            reviewedAt: record.reviewedAt
        });
        return store_1.dataStore.getReconciliationRecord(reconciliationId) || null;
    }
    getSummary() {
        const records = store_1.dataStore.getAllReconciliationRecords();
        const discrepancyCount = {
            licenseExpired: 0,
            timeConflict: 0,
            depositDeduction: 0,
            missingDocument: 0,
            feeMismatch: 0,
            manualReview: 0
        };
        let totalBoothFee = 0;
        let totalDeposit = 0;
        let totalDeductions = 0;
        for (const record of records) {
            totalBoothFee += record.actualBoothFee;
            totalDeposit += record.actualDepositAmount;
            totalDeductions += record.deductions.reduce((sum, d) => sum + d.amount, 0);
            for (const disc of record.discrepancies) {
                switch (disc.type) {
                    case types_1.DiscrepancyType.LICENSE_EXPIRED:
                        discrepancyCount.licenseExpired++;
                        break;
                    case types_1.DiscrepancyType.TIME_CONFLICT:
                        discrepancyCount.timeConflict++;
                        break;
                    case types_1.DiscrepancyType.DEPOSIT_DEDUCTION:
                        discrepancyCount.depositDeduction++;
                        break;
                    case types_1.DiscrepancyType.MISSING_DOCUMENT:
                        discrepancyCount.missingDocument++;
                        break;
                    case types_1.DiscrepancyType.FEE_MISMATCH:
                        discrepancyCount.feeMismatch++;
                        break;
                    case types_1.DiscrepancyType.MANUAL_REVIEW:
                        discrepancyCount.manualReview++;
                        break;
                }
            }
        }
        return {
            totalRecords: records.length,
            approvedRecords: records.filter(r => r.status === 'APPROVED' || r.status === 'COMPLETED').length,
            rejectedRecords: records.filter(r => r.status === 'REJECTED').length,
            pendingRecords: records.filter(r => r.status === 'DRAFT' || r.status === 'REVIEWING').length,
            totalBoothFee,
            totalDeposit,
            totalDeductions,
            netAmount: totalBoothFee + totalDeposit,
            discrepancyCount
        };
    }
    async batchCreateAll() {
        const applications = store_1.dataStore.getAllBoothApplications();
        const results = [];
        for (const app of applications) {
            const record = await this.createReconciliation(app.id);
            if (record) {
                results.push(record);
            }
        }
        return results;
    }
}
exports.reconciliationService = new ReconciliationService();
