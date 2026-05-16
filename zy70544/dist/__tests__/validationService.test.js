"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validationService_1 = require("../services/validationService");
const types_1 = require("../types");
describe('ValidationService', () => {
    let validationService;
    beforeEach(() => {
        validationService = new validationService_1.ValidationService();
    });
    describe('validateCreateApplication', () => {
        it('应该验证有效的申请数据', () => {
            const validData = {
                idempotencyKey: 'test-key-001',
                billingMonth: '2024-05',
                customerAccount: 'CUST001',
                customerName: '测试客户',
                reasonCategory: types_1.ReasonCategory.PRICE_ADJUSTMENT,
                reasonDetail: '由于系统价格配置错误，需要重新计算2024年5月账单',
                triggerSource: '财务系统核对异常',
                impactDetails: [
                    {
                        itemCode: 'ITEM001',
                        itemName: '基础服务费',
                        originalAmount: 1000,
                        newAmount: 1200,
                        remarks: '价格从1000调整为1200'
                    }
                ],
                createdBy: '财务张三'
            };
            const result = validationService.validateCreateApplication(validData);
            expect(result.error).toBeUndefined();
            expect(result.value).toBeDefined();
        });
        it('应该拒绝缺少必填字段的数据', () => {
            const invalidData = {
                idempotencyKey: 'test-key-001'
            };
            const result = validationService.validateCreateApplication(invalidData);
            expect(result.error).toBeDefined();
        });
    });
    describe('validateStatusTransition', () => {
        it('应该允许从DRAFT到PENDING_APPROVAL的转换', () => {
            const result = validationService.validateStatusTransition(types_1.RecalculationStatus.DRAFT, types_1.RecalculationStatus.PENDING_APPROVAL);
            expect(result).toBe(true);
        });
        it('应该拒绝从DRAFT直接到COMPLETED的转换', () => {
            const result = validationService.validateStatusTransition(types_1.RecalculationStatus.DRAFT, types_1.RecalculationStatus.COMPLETED);
            expect(result).toBe(false);
        });
        it('应该拒绝从COMPLETED状态的任何转换', () => {
            const result = validationService.validateStatusTransition(types_1.RecalculationStatus.COMPLETED, types_1.RecalculationStatus.PENDING_APPROVAL);
            expect(result).toBe(false);
        });
    });
});
