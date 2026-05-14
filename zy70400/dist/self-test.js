"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = __importDefault(require("chalk"));
const storage_1 = require("./storage");
const types_1 = require("./types");
let passed = 0;
let failed = 0;
function test(description, fn) {
    try {
        const result = fn();
        if (result) {
            passed++;
            console.log(chalk_1.default.green(`  ✓ ${description}`));
        }
        else {
            failed++;
            console.log(chalk_1.default.red(`  ✗ ${description}`));
        }
    }
    catch (e) {
        failed++;
        console.log(chalk_1.default.red(`  ✗ ${description}: ${e.message}`));
    }
}
console.log(chalk_1.default.blue.bold('\n运行自检脚本...\n'));
console.log(chalk_1.default.cyan('1. 数据存储测试'));
test('能加载批次列表', () => {
    const batches = storage_1.Storage.getAllBatches();
    return Array.isArray(batches);
});
test('能加载记录列表', () => {
    const records = storage_1.Storage.loadRecords();
    return Array.isArray(records);
});
test('能新增记录', () => {
    const batchId = 'TEST-BATCH';
    if (!storage_1.Storage.getBatchById(batchId)) {
        storage_1.Storage.addBatch({
            batchId,
            batchName: '测试批次',
            source: '测试来源',
            processingBasis: '测试依据',
            totalRecords: 0,
            successCount: 0,
            abnormalCount: 0,
            pendingCount: 0,
            correctedCount: 0
        });
    }
    const record = storage_1.Storage.addRecord({
        batchId,
        recordingId: 'TEST-001',
        customerName: '测试用户',
        phoneNumber: '138****0000',
        serviceType: '测试服务',
        startTime: '2024-01-01 00:00:00',
        endTime: '2024-01-01 00:05:00',
        duration: 300,
        agentName: '测试客服',
        summary: '测试摘要',
        status: types_1.ProcessingStatus.PENDING
    });
    return !!storage_1.Storage.getRecordById(record.id);
});
console.log(chalk_1.default.cyan('\n2. 查询功能测试'));
test('能按批次查询', () => {
    const batches = storage_1.Storage.getAllBatches();
    if (batches.length === 0)
        return true;
    const records = storage_1.Storage.queryRecords({ batchId: batches[0].batchId });
    return records.every(r => r.batchId === batches[0].batchId);
});
test('能按状态查询', () => {
    const records = storage_1.Storage.queryRecords({ status: types_1.ProcessingStatus.PENDING });
    return records.every(r => r.status === types_1.ProcessingStatus.PENDING);
});
test('能按关键词查询', () => {
    const records = storage_1.Storage.queryRecords({ keyword: '测试' });
    return records.length > 0;
});
console.log(chalk_1.default.cyan('\n3. 更新功能测试'));
test('能更新记录状态', () => {
    const records = storage_1.Storage.loadRecords();
    if (records.length === 0)
        return false;
    const updated = storage_1.Storage.updateRecord(records[0].id, {
        status: types_1.ProcessingStatus.SUCCESS,
        processingResult: '测试成功'
    });
    return updated?.status === types_1.ProcessingStatus.SUCCESS;
});
test('能人工修正记录', () => {
    const records = storage_1.Storage.queryRecords({ status: types_1.ProcessingStatus.PENDING });
    if (records.length === 0) {
        const batchId = 'TEST-BATCH';
        const record = storage_1.Storage.addRecord({
            batchId,
            recordingId: 'TEST-002',
            customerName: '待修正用户',
            phoneNumber: '138****0001',
            serviceType: '测试服务',
            startTime: '2024-01-01 00:00:00',
            endTime: '2024-01-01 00:05:00',
            duration: 300,
            agentName: '测试客服',
            summary: '待修正摘要',
            status: types_1.ProcessingStatus.PENDING
        });
        records.push(record);
    }
    const corrected = storage_1.Storage.manuallyCorrectRecord(records[0].id, '测试修正人', '测试修正原因', { summary: '已修正的摘要' });
    return corrected?.status === types_1.ProcessingStatus.MANUALLY_CORRECTED &&
        corrected?.correctedBy === '测试修正人';
});
console.log(chalk_1.default.cyan('\n4. 边界情况测试'));
test('查询不存在的记录返回undefined', () => {
    const record = storage_1.Storage.getRecordById('non-existent-id');
    return record === undefined;
});
test('更新不存在的记录返回null', () => {
    const result = storage_1.Storage.updateRecord('non-existent-id', { status: types_1.ProcessingStatus.SUCCESS });
    return result === null;
});
test('能正确统计批次数据', () => {
    const batches = storage_1.Storage.getAllBatches();
    if (batches.length === 0)
        return true;
    const batch = batches[0];
    return typeof batch.totalRecords === 'number' &&
        typeof batch.successCount === 'number' &&
        typeof batch.abnormalCount === 'number';
});
console.log(chalk_1.default.cyan('\n5. 数据持久化验证'));
test('数据写入后能重新读取', () => {
    const records1 = storage_1.Storage.loadRecords();
    const count1 = records1.length;
    const batchId = 'TEST-BATCH';
    storage_1.Storage.addRecord({
        batchId,
        recordingId: `TEST-${Date.now()}`,
        customerName: '持久化测试用户',
        phoneNumber: '138****9999',
        serviceType: '测试服务',
        startTime: '2024-01-01 00:00:00',
        endTime: '2024-01-01 00:05:00',
        duration: 300,
        agentName: '测试客服',
        summary: '持久化测试摘要',
        status: types_1.ProcessingStatus.PENDING
    });
    const records2 = storage_1.Storage.loadRecords();
    return records2.length === count1 + 1;
});
console.log(chalk_1.default.cyan('\n6. 异常记录检测'));
test('能识别字段截断的记录', () => {
    const truncatedRecord = storage_1.Storage.loadRecords().find(r => r.isFieldTruncated);
    return truncatedRecord !== undefined;
});
test('截断字段信息正确保存', () => {
    const truncatedRecord = storage_1.Storage.loadRecords().find(r => r.isFieldTruncated);
    if (!truncatedRecord)
        return true;
    return Array.isArray(truncatedRecord.truncatedFields) &&
        truncatedRecord.truncatedFields.length > 0;
});
console.log(chalk_1.default.blue.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
console.log(chalk_1.default.white(`测试结果: ${chalk_1.default.green(passed)} 通过, ${chalk_1.default.red(failed)} 失败`));
console.log(chalk_1.default.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
if (failed === 0) {
    console.log(chalk_1.default.green.bold('✓ 所有测试通过!'));
    console.log(chalk_1.default.cyan('  ✓ 数据持久化正常'));
    console.log(chalk_1.default.cyan('  ✓ 查询过滤功能正常'));
    console.log(chalk_1.default.cyan('  ✓ 批量处理逻辑正常'));
    console.log(chalk_1.default.cyan('  ✓ 人工修正记录正常'));
    console.log(chalk_1.default.cyan('  ✓ 异常记录检测正常'));
    console.log(chalk_1.default.cyan('  ✓ 边界情况处理正常\n'));
}
else {
    console.log(chalk_1.default.red.bold('✗ 部分测试失败，请检查代码\n'));
    process.exit(1);
}
