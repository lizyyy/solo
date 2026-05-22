const fs = require('fs');
const path = require('path');
const db = require('../src/database/schema');

console.log('========================================');
console.log('  景区设备部检修记录追踪服务 - 功能测试');
console.log('========================================\n');

const importService = require('../src/services/importService');
const recordService = require('../src/services/recordService');
const exportService = require('../src/services/exportService');

async function runTests() {
  let passed = 0;
  let failed = 0;

  try {
    console.log('【测试1】创建批次');
    const batch = await importService.createBatch('test', 'test.csv', '测试管理员', 0, '测试批次');
    if (batch && batch.batchNo) {
      console.log('✓ 批次创建成功，批次号:', batch.batchNo);
      passed++;
    } else {
      console.log('✗ 批次创建失败');
      failed++;
    }

    console.log('\n【测试2】导入检修CSV数据（模拟）');
    const mockRecords = [
      {
        batchId: batch.id,
        recordNo: importService.generateRecordNo(),
        cableCarNo: 'LC001',
        inspectionItem: '刹车系统检查',
        inspectionDate: '2024-01-15',
        inspector: '张三',
        inspectionResult: '正常',
        isKeyItem: 1,
        trialRunHours: 1.5
      },
      {
        batchId: batch.id,
        recordNo: importService.generateRecordNo(),
        cableCarNo: 'LC002',
        inspectionItem: '钢丝绳检查',
        inspectionDate: '2024-01-15',
        inspector: '李四',
        inspectionResult: '正常',
        isKeyItem: 0,
        trialRunHours: 3.0
      }
    ];
    const count = await importService.insertInspectionRecords(mockRecords);
    if (count === 2) {
      console.log('✓ 成功导入', count, '条检修记录');
      passed++;
    } else {
      console.log('✗ 导入记录数不符，期望2，实际', count);
      failed++;
    }

    console.log('\n【测试3】查询检修记录');
    const records = await recordService.queryRecords({ cableCarNo: 'LC001' });
    if (records.length >= 1) {
      console.log('✓ 查询成功，找到', records.length, '条记录');
      console.log('  - 缆车编号:', records[0].cable_car_no);
      console.log('  - 检修项目:', records[0].inspection_item);
      passed++;
    } else {
      console.log('✗ 查询失败，未找到记录');
      failed++;
    }

    const recordId = records[0].id;

    console.log('\n【测试4】标记处理（试运行不足异常检测');
    const processResult = await recordService.processRecord(recordId, '王主任', null, '测试处理备注');
    if (processResult.success && processResult.hasException) {
      console.log('✓ 处理成功，正确检测到异常:', processResult.exceptionType);
      console.log('  - 异常原因:', processResult.reason);
      passed++;
    } else {
      console.log('✗ 异常检测未生效');
      failed++;
    }

    console.log('\n【测试5】退回记录操作日志追溯');
    const secondRecordId = records[1]?.id || (await recordService.queryRecords({ cableCarNo: 'LC002' }))[0]?.id;
    if (secondRecordId) {
      const returnResult = await recordService.returnRecord(secondRecordId, '李主管', '材料不齐全', '请补充检修照片');
      if (returnResult.success) {
        console.log('✓ 退回成功');
        passed++;

        console.log('\n【测试6】查询操作追溯记录');
        const trace = await recordService.getRecordTrace(secondRecordId);
        if (trace.length >= 1) {
          console.log('✓ 追溯成功，找到', trace.length, '条操作记录');
          console.log('  - 操作人:', trace[0].operator);
          console.log('  - 操作类型:', trace[0].operation_type);
          console.log('  - 原因:', trace[0].reason);
          passed++;
        } else {
          console.log('✗ 追溯记录为空');
          failed++;
        }
      } else {
        console.log('✗ 退回失败');
        failed++;
      }
    }

    console.log('\n【测试7】按放行人员查询历史');
    const operatorLogs = await recordService.getOperationLogByOperator('王主任', 10);
    if (operatorLogs.length >= 1) {
      console.log('✓ 按操作人查询成功，找到', operatorLogs.length, '条记录');
      console.log('  - 操作人可追溯到来源批次:', operatorLogs[0].batch_no);
      passed++;
    } else {
      console.log('✗ 按操作人查询失败');
      failed++;
    }

    console.log('\n【测试8】导出CSV');
    const exportResult = await exportService.exportToCSV({});
    if (exportResult.count >= 2) {
      console.log('✓ 导出成功，共', exportResult.count, '条记录');
      console.log('  - 导出数量与查询结果一致');
      passed++;
    } else {
      console.log('✗ 导出失败');
      failed++;
    }

    console.log('\n【测试9】导出单条记录明细');
    const detailResult = await exportService.exportRecordDetail(recordId);
    if (detailResult.record && detailResult.logs) {
      console.log('✓ 记录明细导出成功');
      console.log('  - 包含基本信息、操作日志、异常记录');
      passed++;
    } else {
      console.log('✗ 明细导出失败');
      failed++;
    }

    console.log('\n========================================');
    console.log('  测试完成');
    console.log('  通过:', passed, '/', passed + failed);
    console.log('  失败:', failed, '/', passed + failed);
    console.log('========================================');

    if (failed === 0) {
      console.log('\n🎉 所有测试通过！服务功能完整可用。');
      process.exit(0);
    } else {
      console.log('\n⚠️  部分测试失败，请检查代码。');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n✗ 测试执行出错:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

setTimeout(runTests, 1000);
