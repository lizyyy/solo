"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataGenerator = void 0;
const dataStore_1 = require("../store/dataStore");
function generateId() {
    return Math.random().toString(36).substring(2, 15);
}
const suppliers = [
    { id: 'S001', name: '深圳市电子科技有限公司' },
    { id: 'S002', name: '东莞市五金制品厂' },
    { id: 'S003', name: '广州市化工原料公司' },
    { id: 'S004', name: '佛山市机械装备有限公司' },
    { id: 'S005', name: '惠州市包装材料厂' }
];
const departments = ['采购部', '生产部', '技术部', '行政部', '财务部'];
const applicants = [
    { id: 'U001', name: '张三' },
    { id: 'U002', name: '李四' },
    { id: 'U003', name: '王五' },
    { id: 'U004', name: '赵六' }
];
const itemTemplates = [
    { code: 'M001', name: '电阻器', spec: '100Ω 1/4W' },
    { code: 'M002', name: '电容器', spec: '10μF 50V' },
    { code: 'M003', name: '集成电路', spec: 'STM32F103C8T6' },
    { code: 'M004', name: '二极管', spec: '1N4007' },
    { code: 'M005', name: '三极管', spec: 'S9013' },
    { code: 'M006', name: 'PCB板', spec: 'FR-4 1.6mm' },
    { code: 'M007', name: '连接器', spec: '2.54mm 10P' },
    { code: 'M008', name: '晶振', spec: '8MHz 12PF' }
];
class DataGenerator {
    static generateRules() {
        const ruleV1 = {
            version: 'v1.0',
            effectiveDate: '2024-01-01',
            description: '初始版本：金额阈值5万元，无重复检查',
            conditions: [
                {
                    type: 'amount_threshold',
                    operator: '<=',
                    value: 50000
                },
                {
                    type: 'item_count',
                    operator: '<=',
                    value: 20
                }
            ],
            approvalFlow: [
                { level: 1, role: '采购主管' },
                { level: 2, role: '财务审核' }
            ],
            isActive: false
        };
        const ruleV2 = {
            version: 'v2.0',
            effectiveDate: '2024-06-01',
            description: '当前版本：金额阈值10万元，增加重复提交检查',
            conditions: [
                {
                    type: 'amount_threshold',
                    operator: '<=',
                    value: 100000
                },
                {
                    type: 'item_count',
                    operator: '<=',
                    value: 30
                },
                {
                    type: 'duplicate_check',
                    operator: '==',
                    value: 'false'
                }
            ],
            approvalFlow: [
                { level: 1, role: '采购主管' },
                { level: 2, role: '财务审核' },
                { level: 3, role: '总监审批', condition: 'amount > 50000' }
            ],
            isActive: true
        };
        dataStore_1.DataStore.saveRules([ruleV1, ruleV2]);
    }
    static generateInquiryItem(template, supplier, maxPrice = 1000) {
        const tpl = template || itemTemplates[Math.floor(Math.random() * itemTemplates.length)];
        const sup = supplier || suppliers[Math.floor(Math.random() * suppliers.length)];
        const quantity = Math.floor(Math.random() * 100) + 10;
        const unitPrice = Math.floor(Math.random() * maxPrice) + 1;
        return {
            id: generateId(),
            itemCode: tpl.code,
            itemName: tpl.name,
            specification: tpl.spec,
            quantity,
            unit: '个',
            unitPrice,
            totalPrice: quantity * unitPrice,
            supplierId: sup.id,
            supplierName: sup.name
        };
    }
    static generateInquiry(batchId, ruleVersion, isAmountWithinThreshold = false) {
        const applicant = applicants[Math.floor(Math.random() * applicants.length)];
        const department = departments[Math.floor(Math.random() * departments.length)];
        const itemCount = Math.floor(Math.random() * 5) + 2;
        const items = [];
        const maxPricePerItem = isAmountWithinThreshold ? 100 : 1000;
        for (let i = 0; i < itemCount; i++) {
            items.push(this.generateInquiryItem(undefined, undefined, maxPricePerItem));
        }
        if (isAmountWithinThreshold) {
            while (items.reduce((sum, item) => sum + item.totalPrice, 0) > 90000) {
                items.pop();
            }
        }
        const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
        const now = new Date();
        return {
            id: generateId(),
            batchId,
            inquiryNo: `XJ${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
            title: `${department}物资采购申请`,
            department,
            applicantId: applicant.id,
            applicantName: applicant.name,
            applyDate: now.toISOString().split('T')[0],
            items,
            totalAmount,
            status: 'submitted',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            submittedAt: now.toISOString(),
            ruleVersion
        };
    }
    static generateBatchData(batchId, count = 5) {
        const activeRule = dataStore_1.DataStore.getActiveRule();
        const ruleVersion = activeRule?.version || 'v2.0';
        for (let i = 0; i < count; i++) {
            const isWithinThreshold = i < 2;
            const inquiry = this.generateInquiry(batchId, ruleVersion, isWithinThreshold);
            dataStore_1.DataStore.addInquiry(inquiry);
        }
        const originalInquiry = dataStore_1.DataStore.getInquiriesByBatch(batchId)[0];
        if (originalInquiry) {
            const duplicateInquiry = {
                ...originalInquiry,
                id: generateId(),
                inquiryNo: `XJ${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
                items: originalInquiry.items.map(item => ({
                    ...item,
                    id: generateId()
                })),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            dataStore_1.DataStore.addInquiry(duplicateInquiry);
        }
    }
    static generatePermissionTicket(inquiry) {
        const actualAmount = inquiry.totalAmount;
        const newThreshold = Math.max(actualAmount + 10000, 150000);
        return {
            id: generateId(),
            batchId: inquiry.batchId,
            inquiryId: inquiry.id,
            type: 'temp_approval',
            status: 'approved',
            grantedBy: 'U005',
            grantedByName: '审批总监',
            grantedAt: new Date().toISOString(),
            reason: '紧急采购需求，临时豁免金额限制',
            originalValue: {
                amountThreshold: 100000,
                actualAmount: actualAmount
            },
            modifiedValue: {
                amountThreshold: newThreshold,
                actualAmount: actualAmount
            },
            conclusion: `同意临时提高审批阈值至${(newThreshold / 10000).toFixed(1)}万元，允许本次采购通过`,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };
    }
    static initDemoData() {
        this.generateRules();
        this.generateBatchData('BATCH-2024-001', 4);
        this.generateBatchData('BATCH-2024-002', 3);
        const allInquiries = dataStore_1.DataStore.getInquiries();
        const overThresholdInquiry = allInquiries.find(i => i.totalAmount > 100000);
        if (overThresholdInquiry) {
            const ticket = this.generatePermissionTicket(overThresholdInquiry);
            dataStore_1.DataStore.addPermissionTicket(ticket);
        }
    }
}
exports.DataGenerator = DataGenerator;
