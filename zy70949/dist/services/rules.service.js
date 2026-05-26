"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RulesEngine = void 0;
class RulesEngine {
    constructor() {
        this.unitUsedAmount = new Map();
        this.couponUsageCount = new Map();
        this.processedRecordIds = new Set();
    }
    reset() {
        this.unitUsedAmount.clear();
        this.couponUsageCount.clear();
        this.processedRecordIds.clear();
    }
    checkRecord(record, context) {
        const appliedRules = [];
        const suggestions = [];
        const readableParts = [];
        let overallStatus = 'normal';
        this.processedRecordIds.add(record.id);
        const packageCheck = this.checkPackageCompliance(record, context);
        this.mergeResult(packageCheck, appliedRules, suggestions, readableParts);
        if (packageCheck.status === 'failed')
            overallStatus = 'failed';
        else if (packageCheck.status === 'pending')
            overallStatus = 'pending';
        if (record.isRefund) {
            const refundCheck = this.checkRefundReversal(record, context);
            this.mergeResult(refundCheck, appliedRules, suggestions, readableParts);
            if (refundCheck.status === 'failed')
                overallStatus = 'failed';
            else if (refundCheck.status === 'pending')
                overallStatus = 'pending';
        }
        if (record.couponCode) {
            const couponCheck = this.checkCouponStacking(record, context);
            this.mergeResult(couponCheck, appliedRules, suggestions, readableParts);
            if (couponCheck.status === 'failed')
                overallStatus = 'failed';
            else if (couponCheck.status === 'pending')
                overallStatus = 'pending';
        }
        if (record.unitCode) {
            const unitCheck = this.checkUnitQuota(record, context);
            this.mergeResult(unitCheck, appliedRules, suggestions, readableParts);
            if (unitCheck.status === 'failed')
                overallStatus = 'failed';
            else if (unitCheck.status === 'pending')
                overallStatus = 'pending';
        }
        if (overallStatus === 'normal') {
            this.applyRecordEffects(record);
        }
        return {
            passed: overallStatus !== 'failed',
            status: overallStatus,
            appliedRules,
            suggestions,
            readableExplanation: readableParts.join(' | '),
        };
    }
    mergeResult(result, appliedRules, suggestions, readableParts) {
        appliedRules.push(...result.appliedRules);
        suggestions.push(...result.suggestions);
        if (result.readableExplanation) {
            readableParts.push(result.readableExplanation);
        }
    }
    checkPackageCompliance(record, context) {
        const appliedRules = [];
        const suggestions = [];
        const readableParts = [];
        const pkg = context.packages.find(p => p.packageCode === record.packageCode);
        if (!pkg) {
            return {
                passed: false,
                status: 'pending',
                appliedRules: ['PACKAGE_NOT_FOUND'],
                suggestions: [
                    `套餐编码 ${record.packageCode} 在套餐配置中未找到`,
                    '请确认套餐编码是否正确，或在套餐配置中添加该套餐',
                ],
                readableExplanation: `套餐验证：套餐编码 ${record.packageCode} 不存在，需人工确认`,
            };
        }
        appliedRules.push('PACKAGE_FOUND');
        if (pkg.includedItems.includes(record.itemCode)) {
            return {
                passed: false,
                status: 'failed',
                appliedRules: ['ITEM_ALREADY_INCLUDED'],
                suggestions: [
                    `项目 ${record.itemName}(${record.itemCode}) 已包含在套餐 ${pkg.packageName} 中`,
                    '不应作为加项收费，请核实是否误录',
                ],
                readableExplanation: `套餐验证：项目 ${record.itemName} 已包含在套餐 ${pkg.packageName} 中，加项无效`,
            };
        }
        if (!pkg.addableItems.includes(record.itemCode)) {
            return {
                passed: false,
                status: 'pending',
                appliedRules: ['ITEM_NOT_ADDABLE'],
                suggestions: [
                    `项目 ${record.itemName}(${record.itemCode}) 不在套餐 ${pkg.packageName} 的允许加项列表中`,
                    '请确认该项目是否允许加项，或更新套餐的可加项配置',
                ],
                readableExplanation: `套餐验证：项目 ${record.itemName} 不在套餐 ${pkg.packageName} 可加项范围内，需人工确认`,
            };
        }
        appliedRules.push('ITEM_ADDABLE');
        readableParts.push(`套餐验证：项目 ${record.itemName} 可在套餐 ${pkg.packageName} 中加项`);
        return {
            passed: true,
            status: 'normal',
            appliedRules,
            suggestions,
            readableExplanation: readableParts.join('；'),
        };
    }
    checkRefundReversal(record, context) {
        const appliedRules = [];
        const suggestions = [];
        if (!record.originalRecordId) {
            return {
                passed: false,
                status: 'failed',
                appliedRules: ['REFUND_WITHOUT_ORIGINAL'],
                suggestions: [
                    '退项记录未关联原始加项记录ID',
                    '请在 originalRecordId 字段填写原始加项记录的ID',
                ],
                readableExplanation: '退项冲正：退项记录缺少原始记录ID，无法冲正',
            };
        }
        const originalRecord = context.allRecords.find(r => r.id === record.originalRecordId);
        if (!originalRecord) {
            return {
                passed: false,
                status: 'pending',
                appliedRules: ['REFUND_ORIGINAL_NOT_FOUND'],
                suggestions: [
                    `原始记录 ${record.originalRecordId} 未在本批次中找到`,
                    '请确认原始记录是否已导入，或稍后核对',
                ],
                readableExplanation: `退项冲正：原始记录 ${record.originalRecordId} 未在本批次找到，需跨批次核对`,
            };
        }
        if (originalRecord.isRefund) {
            return {
                passed: false,
                status: 'failed',
                appliedRules: ['REFUND_OF_REFUND'],
                suggestions: [
                    '原始记录本身就是退项记录，不能再次冲正',
                    '请核实退项逻辑是否正确',
                ],
                readableExplanation: '退项冲正：原始记录本身是退项记录，禁止二次冲正',
            };
        }
        if (originalRecord.itemCode !== record.itemCode) {
            return {
                passed: false,
                status: 'pending',
                appliedRules: ['REFUND_ITEM_MISMATCH'],
                suggestions: [
                    `退项项目 ${record.itemName} 与原始记录项目 ${originalRecord.itemName} 不一致`,
                    '请确认是否为同一项目的退项，或更正项目编码',
                ],
                readableExplanation: `退项冲正：退项项目 ${record.itemName} 与原始项目 ${originalRecord.itemName} 不一致，需人工确认`,
            };
        }
        const refundAmount = Math.abs(record.itemPrice * record.quantity);
        const originalAmount = originalRecord.itemPrice * originalRecord.quantity;
        if (refundAmount > originalAmount) {
            return {
                passed: false,
                status: 'failed',
                appliedRules: ['REFUND_EXCEEDS_ORIGINAL'],
                suggestions: [
                    `退项金额 ¥${refundAmount} 超过原始记录金额 ¥${originalAmount}`,
                    `退项金额不能超过原始加项金额，最多可退 ¥${originalAmount}`,
                ],
                readableExplanation: `退项冲正：退项金额 ¥${refundAmount} 超过原始金额 ¥${originalAmount}，超出部分无效`,
            };
        }
        const alreadyRefunded = context.allRecords
            .filter(r => r.isRefund && r.originalRecordId === record.originalRecordId)
            .reduce((sum, r) => sum + Math.abs(r.itemPrice * r.quantity), 0);
        if (alreadyRefunded + refundAmount > originalAmount) {
            const remaining = originalAmount - alreadyRefunded;
            return {
                passed: false,
                status: 'failed',
                appliedRules: ['REFUND_CUMULATIVE_EXCEEDED'],
                suggestions: [
                    `原始记录已冲正 ¥${alreadyRefunded}，本次退项 ¥${refundAmount}，累计超出原始金额`,
                    `剩余可冲正金额为 ¥${remaining}`,
                ],
                readableExplanation: `退项冲正：原始记录已冲正 ¥${alreadyRefunded}，累计退项将超出原始金额，本次退项无效`,
            };
        }
        return {
            passed: true,
            status: 'normal',
            appliedRules: ['REFUND_VALID'],
            suggestions: [],
            readableExplanation: `退项冲正：原始记录核对通过，退项 ¥${refundAmount} 有效`,
        };
    }
    checkCouponStacking(record, context) {
        const appliedRules = [];
        const suggestions = [];
        const coupon = context.coupons.find(c => c.couponCode === record.couponCode);
        if (!coupon) {
            return {
                passed: false,
                status: 'pending',
                appliedRules: ['COUPON_NOT_FOUND'],
                suggestions: [
                    `优惠券 ${record.couponCode} 在优惠券配置中未找到`,
                    '请确认优惠券编码是否正确，或在优惠券配置中添加该券',
                ],
                readableExplanation: `优惠券验证：券 ${record.couponCode} 不存在，需人工确认`,
            };
        }
        appliedRules.push('COUPON_FOUND');
        const now = new Date(record.operationTime);
        const validFrom = new Date(coupon.validFrom);
        const validTo = new Date(coupon.validTo);
        if (now < validFrom) {
            return {
                passed: false,
                status: 'failed',
                appliedRules: ['COUPON_NOT_YET_VALID'],
                suggestions: [
                    `优惠券 ${coupon.couponCode} 生效日期为 ${coupon.validFrom}，当前操作时间 ${record.operationTime} 尚未生效`,
                    '请确认操作时间是否正确，或等待优惠券生效后使用',
                ],
                readableExplanation: `优惠券验证：券 ${coupon.couponCode} 尚未生效（生效日期 ${coupon.validFrom}），不可使用`,
            };
        }
        if (now > validTo) {
            return {
                passed: false,
                status: 'failed',
                appliedRules: ['COUPON_EXPIRED'],
                suggestions: [
                    `优惠券 ${coupon.couponCode} 已于 ${coupon.validTo} 过期`,
                    '过期优惠券不可使用，请核实或联系相关部门',
                ],
                readableExplanation: `优惠券验证：券 ${coupon.couponCode} 已于 ${coupon.validTo} 过期，不可使用`,
            };
        }
        appliedRules.push('COUPON_VALID_DATE');
        if (coupon.applicableItems.length > 0 && !coupon.applicableItems.includes(record.itemCode)) {
            return {
                passed: false,
                status: 'failed',
                appliedRules: ['COUPON_NOT_APPLICABLE'],
                suggestions: [
                    `优惠券 ${coupon.couponCode} 不适用于项目 ${record.itemName}(${record.itemCode})`,
                    `该优惠券适用项目：${coupon.applicableItems.join('、')}`,
                ],
                readableExplanation: `优惠券验证：券 ${coupon.couponCode} 不适用于项目 ${record.itemName}，不可使用`,
            };
        }
        appliedRules.push('COUPON_APPLICABLE');
        if (coupon.minConsumption !== undefined) {
            const totalAmount = record.itemPrice * record.quantity;
            if (totalAmount < coupon.minConsumption) {
                return {
                    passed: false,
                    status: 'failed',
                    appliedRules: ['COUPON_MIN_NOT_MET'],
                    suggestions: [
                        `消费金额 ¥${totalAmount} 未达到优惠券最低消费要求 ¥${coupon.minConsumption}`,
                        `需达到 ¥${coupon.minConsumption} 才可使用该优惠券，差额 ¥${coupon.minConsumption - totalAmount}`,
                    ],
                    readableExplanation: `优惠券验证：消费 ¥${totalAmount} 未达最低消费 ¥${coupon.minConsumption}，不可使用`,
                };
            }
        }
        appliedRules.push('COUPON_MIN_MET');
        const customerKey = record.idCard || record.phone || record.customerName;
        if (!this.couponUsageCount.has(customerKey)) {
            this.couponUsageCount.set(customerKey, new Map());
        }
        const customerCoupons = this.couponUsageCount.get(customerKey);
        const currentUsage = customerCoupons.get(coupon.couponCode) || 0;
        if (currentUsage >= coupon.maxStackCount) {
            return {
                passed: false,
                status: 'failed',
                appliedRules: ['COUPON_STACK_LIMIT'],
                suggestions: [
                    `同一客户已使用 ${currentUsage} 张同类型优惠券，已达上限 ${coupon.maxStackCount}`,
                    `优惠券 ${coupon.couponCode} 每人最多可叠加 ${coupon.maxStackCount} 张`,
                ],
                readableExplanation: `优惠券验证：该客户已使用 ${currentUsage} 张 ${coupon.couponCode}，已达叠加上限 ${coupon.maxStackCount}，不可再用`,
            };
        }
        if (coupon.couponType === 'discount' && coupon.value <= 0) {
            return {
                passed: false,
                status: 'failed',
                appliedRules: ['COUPON_INVALID_VALUE'],
                suggestions: [
                    '折扣券折扣值无效',
                    '请检查优惠券配置的折扣值',
                ],
                readableExplanation: '优惠券验证：折扣券配置值无效',
            };
        }
        if (coupon.couponType === 'cash' && record.couponAmount !== undefined) {
            if (record.couponAmount > coupon.value) {
                return {
                    passed: false,
                    status: 'failed',
                    appliedRules: ['COUPON_CASH_EXCEEDED'],
                    suggestions: [
                        `现金券抵扣金额 ¥${record.couponAmount} 超过券面金额 ¥${coupon.value}`,
                        `该优惠券最多可抵扣 ¥${coupon.value}`,
                    ],
                    readableExplanation: `优惠券验证：现金券抵扣 ¥${record.couponAmount} 超过面额 ¥${coupon.value}，超出部分无效`,
                };
            }
        }
        appliedRules.push('COUPON_STACK_VALID');
        customerCoupons.set(coupon.couponCode, currentUsage + 1);
        const readable = `优惠券验证：券 ${coupon.couponCode} 使用有效（已用 ${currentUsage + 1}/${coupon.maxStackCount} 张）`;
        return {
            passed: true,
            status: 'normal',
            appliedRules,
            suggestions,
            readableExplanation: readable,
        };
    }
    checkUnitQuota(record, context) {
        const appliedRules = [];
        const suggestions = [];
        const unit = context.unitAgreements.find(u => u.unitCode === record.unitCode);
        if (!unit) {
            return {
                passed: false,
                status: 'pending',
                appliedRules: ['UNIT_NOT_FOUND'],
                suggestions: [
                    `单位编码 ${record.unitCode} 在单位协议中未找到`,
                    '请确认单位编码是否正确，或在单位协议中添加该单位',
                ],
                readableExplanation: `单位结算：单位 ${record.unitCode} 无协议记录，需人工确认`,
            };
        }
        appliedRules.push('UNIT_FOUND');
        const now = new Date(record.operationTime);
        const validFrom = new Date(unit.validFrom);
        const validTo = new Date(unit.validTo);
        if (now < validFrom || now > validTo) {
            return {
                passed: false,
                status: 'failed',
                appliedRules: ['UNIT_AGREEMENT_EXPIRED'],
                suggestions: [
                    `单位协议有效期为 ${unit.validFrom} 至 ${unit.validTo}，当前操作时间 ${record.operationTime} 不在有效期内`,
                    '请确认操作时间是否正确，或续签单位协议',
                ],
                readableExplanation: `单位结算：单位协议不在有效期内（${unit.validFrom} 至 ${unit.validTo}），不可结算`,
            };
        }
        appliedRules.push('UNIT_AGREEMENT_VALID');
        if (unit.eligibleEmployees.length > 0 && !unit.eligibleEmployees.includes(record.idCard)) {
            return {
                passed: false,
                status: 'pending',
                appliedRules: ['EMPLOYEE_NOT_ELIGIBLE'],
                suggestions: [
                    `客户 ${record.customerName}(${record.idCard}) 不在单位 ${unit.unitName} 的员工名单中`,
                    '请确认是否为该单位员工，或更新员工名单',
                ],
                readableExplanation: `单位结算：客户 ${record.customerName} 不在单位 ${unit.unitName} 员工名单中，需人工确认`,
            };
        }
        appliedRules.push('EMPLOYEE_ELIGIBLE');
        if (unit.allowedPackages.length > 0 && !unit.allowedPackages.includes(record.packageCode)) {
            return {
                passed: false,
                status: 'failed',
                appliedRules: ['PACKAGE_NOT_ALLOWED'],
                suggestions: [
                    `套餐 ${record.packageCode} 不在单位 ${unit.unitName} 协议允许的套餐范围内`,
                    `单位协议允许的套餐：${unit.allowedPackages.join('、')}`,
                ],
                readableExplanation: `单位结算：套餐 ${record.packageCode} 不在单位 ${unit.unitName} 协议范围内，不可结算`,
            };
        }
        appliedRules.push('PACKAGE_ALLOWED');
        const amount = record.itemPrice * record.quantity;
        const currentUsed = this.unitUsedAmount.get(unit.unitCode) || unit.usedQuota;
        const remainingQuota = unit.totalQuota - currentUsed;
        if (amount > remainingQuota) {
            return {
                passed: false,
                status: 'failed',
                appliedRules: ['UNIT_QUOTA_EXCEEDED'],
                suggestions: [
                    `本笔金额 ¥${amount} 将超出单位 ${unit.unitName} 剩余额度 ¥${remainingQuota}`,
                    `单位总额度 ¥${unit.totalQuota}，已使用 ¥${currentUsed}，剩余 ¥${remainingQuota}`,
                    `如需继续结算，请联系单位续签协议或追加额度`,
                ],
                readableExplanation: `单位结算：本笔 ¥${amount} 将超出剩余额度 ¥${remainingQuota}（总额 ¥${unit.totalQuota}，已用 ¥${currentUsed}），不可结算`,
            };
        }
        appliedRules.push('UNIT_QUOTA_SUFFICIENT');
        const readable = `单位结算：单位 ${unit.unitName} 额度充足（总额 ¥${unit.totalQuota}，已用 ¥${currentUsed}，本笔 ¥${amount}，剩余 ¥${remainingQuota - amount}）`;
        return {
            passed: true,
            status: 'normal',
            appliedRules,
            suggestions,
            readableExplanation: readable,
        };
    }
    applyRecordEffects(record) {
        if (record.unitCode) {
            const amount = record.itemPrice * record.quantity;
            const current = this.unitUsedAmount.get(record.unitCode) || 0;
            this.unitUsedAmount.set(record.unitCode, current + amount);
        }
    }
    generateRuleViolations(results) {
        const violations = new Map();
        results.forEach(result => {
            const violationRules = result.appliedRules.filter(rule => !RulesEngine.SUCCESS_RULES.has(rule));
            violationRules.forEach(rule => {
                if (result.status === 'failed') {
                    if (!violations.has(rule)) {
                        violations.set(rule, {
                            ruleName: rule,
                            severity: 'error',
                            description: this.getRuleDescription(rule),
                            affectedRecords: 0,
                        });
                    }
                    violations.get(rule).affectedRecords++;
                }
                else if (result.status === 'pending') {
                    if (!violations.has(rule)) {
                        violations.set(rule, {
                            ruleName: rule,
                            severity: 'warning',
                            description: this.getRuleDescription(rule),
                            affectedRecords: 0,
                        });
                    }
                    violations.get(rule).affectedRecords++;
                }
            });
        });
        return Array.from(violations.values());
    }
    getRuleDescription(rule) {
        const descriptions = {
            PACKAGE_NOT_FOUND: '套餐编码不存在，需确认套餐配置是否完整',
            ITEM_ALREADY_INCLUDED: '项目已包含在套餐中，不应作为加项收费',
            ITEM_NOT_ADDABLE: '项目不在套餐允许加项范围内',
            REFUND_WITHOUT_ORIGINAL: '退项记录缺少原始记录ID',
            REFUND_ORIGINAL_NOT_FOUND: '退项原始记录未在本批次中找到',
            REFUND_OF_REFUND: '禁止对退项记录进行二次冲正',
            REFUND_ITEM_MISMATCH: '退项项目与原始记录项目不一致',
            REFUND_EXCEEDS_ORIGINAL: '退项金额超过原始加项金额',
            REFUND_CUMULATIVE_EXCEEDED: '累计退项金额超过原始金额',
            COUPON_NOT_FOUND: '优惠券编码不存在',
            COUPON_NOT_YET_VALID: '优惠券尚未生效',
            COUPON_EXPIRED: '优惠券已过期',
            COUPON_NOT_APPLICABLE: '优惠券不适用于该项目',
            COUPON_MIN_NOT_MET: '未达到优惠券最低消费要求',
            COUPON_STACK_LIMIT: '优惠券叠加次数已达上限',
            COUPON_CASH_EXCEEDED: '现金券抵扣金额超过券面金额',
            UNIT_NOT_FOUND: '单位协议不存在',
            UNIT_AGREEMENT_EXPIRED: '单位协议不在有效期内',
            EMPLOYEE_NOT_ELIGIBLE: '客户不在单位员工名单中',
            PACKAGE_NOT_ALLOWED: '套餐不在单位协议允许范围内',
            UNIT_QUOTA_EXCEEDED: '单位结算额度不足',
        };
        return descriptions[rule] || rule;
    }
}
exports.RulesEngine = RulesEngine;
RulesEngine.SUCCESS_RULES = new Set([
    'PACKAGE_FOUND',
    'ITEM_ADDABLE',
    'COUPON_FOUND',
    'COUPON_VALID_DATE',
    'COUPON_APPLICABLE',
    'COUPON_MIN_MET',
    'COUPON_STACK_VALID',
    'COUPON_INVALID_VALUE',
    'UNIT_FOUND',
    'UNIT_AGREEMENT_VALID',
    'EMPLOYEE_ELIGIBLE',
    'PACKAGE_ALLOWED',
    'UNIT_QUOTA_SUFFICIENT',
    'REFUND_VALID',
]);
