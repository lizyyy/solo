"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const path = __importStar(require("path"));
const database_1 = require("../database");
const importService = __importStar(require("../services/importService"));
const recordService = __importStar(require("../services/recordService"));
const privacyService = __importStar(require("../services/privacyService"));
const testDbPath = path.join(process.cwd(), 'test.db');
const dataDir = path.join(process.cwd(), 'data');
(0, node_test_1.test)('完整流程测试', async (t) => {
    (0, database_1.initDatabase)(testDbPath);
    const db = (0, database_1.getDb)();
    await t.test('1. 导入数据', async () => {
        const customerResult = await importService.importCustomersFromJson(path.join(dataDir, 'customers.json'), 'test_operator');
        node_assert_1.default.equal(customerResult.success, 4);
        node_assert_1.default.equal(customerResult.failed, 0);
        const medicineResult = await importService.importMedicinesFromJson(path.join(dataDir, 'medicines.json'), 'test_operator');
        node_assert_1.default.equal(medicineResult.success, 5);
        node_assert_1.default.equal(medicineResult.failed, 0);
        const ruleResult = await importService.importFollowUpRulesFromJson(path.join(dataDir, 'followUpRules.json'), 'test_operator');
        node_assert_1.default.equal(ruleResult.success, 3);
        node_assert_1.default.equal(ruleResult.failed, 0);
        const purchaseResult = await importService.importPurchaseRecordsFromCsv(path.join(dataDir, 'purchases.csv'), 'test_operator');
        node_assert_1.default.equal(purchaseResult.success, 8);
        node_assert_1.default.equal(purchaseResult.failed, 0);
    });
    await t.test('2. 隐私脱敏测试', () => {
        const maskedPhone = privacyService.maskPhone('13800138001');
        node_assert_1.default.equal(maskedPhone, '138****8001');
        const maskedIdCard = privacyService.maskIdCard('110101199001011234');
        node_assert_1.default.equal(maskedIdCard, '110101********1234');
    });
    await t.test('3. 获取待处理记录', () => {
        const pendingRecords = recordService.getPendingRecords();
        node_assert_1.default.equal(pendingRecords.length, 8);
    });
    await t.test('4. 审核通过记录（带间隔提醒）', () => {
        const pendingRecords = recordService.getPendingRecords();
        const intervalTestRecord = pendingRecords.find(r => r.notes?.includes('间隔提醒'));
        node_assert_1.default.ok(intervalTestRecord);
        const processed = recordService.processRecord(intervalTestRecord.id, 'approve', '已核实患者确实需要提前购药，医生已确认', 'pharmacist_001', '间隔提醒：5天前刚购买过同类药品');
        node_assert_1.default.equal(processed?.status, 'approved');
        node_assert_1.default.equal(processed?.processedBy, 'pharmacist_001');
        node_assert_1.default.ok(processed?.followUpDate);
    });
    await t.test('5. 退回修改记录（含禁忌药）', () => {
        const pendingRecords = recordService.getPendingRecords();
        const contraindicationRecord = pendingRecords.find(r => r.notes?.includes('禁忌'));
        node_assert_1.default.ok(contraindicationRecord);
        const processed = recordService.processRecord(contraindicationRecord.id, 'return', '患者为过敏体质，氯雷他定为禁忌症，需医生确认是否可以使用替代药物', 'pharmacist_001', '请联系医生确认用药方案');
        node_assert_1.default.equal(processed?.status, 'returned');
    });
    await t.test('6. 审核拒绝记录', () => {
        const pendingRecords = recordService.getPendingRecords();
        const recordToReject = pendingRecords[0];
        const processed = recordService.processRecord(recordToReject.id, 'reject', '处方信息不完整，缺少医生签名', 'pharmacist_001');
        node_assert_1.default.equal(processed?.status, 'rejected');
    });
    await t.test('7. 按标签查询历史记录', () => {
        const records = recordService.queryRecords({
            customerTags: ['高血压']
        });
        node_assert_1.default.ok(records.length > 0);
        records.forEach(r => {
            const customer = db.prepare('SELECT tags FROM customers WHERE id = ?').get(r.customerId);
            const tags = JSON.parse(customer.tags || '[]');
            node_assert_1.default.ok(tags.includes('高血压'));
        });
    });
    await t.test('8. 按药品分类查询', () => {
        const records = recordService.queryRecords({
            medicineCategories: ['心血管']
        });
        node_assert_1.default.ok(records.length > 0);
        records.forEach(r => {
            const medicine = db.prepare('SELECT category FROM medicines WHERE id = ?').get(r.medicineId);
            node_assert_1.default.equal(medicine.category, '心血管');
        });
    });
    await t.test('9. 导出明细数量一致性', () => {
        const filter = { status: 'approved' };
        const queryResult = recordService.queryRecords(filter);
        const exportResult = recordService.exportRecords(filter);
        node_assert_1.default.equal(queryResult.length, exportResult.length);
        node_assert_1.default.ok(exportResult.length > 0);
        exportResult.forEach(record => {
            node_assert_1.default.ok(record.id);
            node_assert_1.default.ok(record.customerName);
            node_assert_1.default.ok(record.medicineName);
            node_assert_1.default.ok(record.purchaseDate);
        });
    });
    await t.test('10. 审计追踪验证', () => {
        const approvedRecords = recordService.queryRecords({ status: 'approved' });
        node_assert_1.default.ok(approvedRecords.length > 0);
        const auditTrail = recordService.getRecordWithAuditTrail(approvedRecords[0].id);
        node_assert_1.default.ok(auditTrail);
        node_assert_1.default.ok(auditTrail.processingHistory.length > 0);
        const history = auditTrail.processingHistory[0];
        node_assert_1.default.equal(history.action, '审核通过');
        node_assert_1.default.equal(history.operator, 'pharmacist_001');
        node_assert_1.default.ok(history.reason);
        node_assert_1.default.ok(history.time);
        node_assert_1.default.ok(history.details);
    });
    await t.test('11. 按状态查询', () => {
        const approvedRecords = recordService.queryRecords({ status: 'approved' });
        const rejectedRecords = recordService.queryRecords({ status: 'rejected' });
        const returnedRecords = recordService.queryRecords({ status: 'returned' });
        node_assert_1.default.ok(approvedRecords.length > 0);
        node_assert_1.default.ok(rejectedRecords.length > 0);
        node_assert_1.default.ok(returnedRecords.length > 0);
    });
    console.log('\n✅ 所有测试通过！');
});
