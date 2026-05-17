import { initDatabase, closeDatabase } from '../src/database';
import { appealService } from '../src/services/appealService';
import { AppealStatus, CreateAppealRequest } from '../src/types';

async function runTests() {
  console.log('========================================');
  console.log('  报表快照申诉API 测试脚本');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    console.log(`[测试] ${name}`);
    try {
      await fn();
      console.log(`  ✓ 通过\n`);
      passed++;
    } catch (error: any) {
      console.log(`  ✗ 失败: ${error.message}\n`);
      failed++;
    }
  }

  await initDatabase();

  console.log('--- 1. 重复申诉幂等性测试 ---\n');

  let appealId: string;

  await test('创建申诉 - 正常数据', async () => {
    const request: CreateAppealRequest = {
      reportName: '销售日报表',
      snapshotDate: '2024-05-15',
      metricValues: {
        totalSales: 125000,
        orderCount: 342,
        avgOrderValue: 365.5,
        conversionRate: 4.2,
        returnRate: 2.1
      },
      appellant: '张三',
      appellantContact: 'zhangsan@example.com',
      appealReason: '5月15日的销售总额与实际统计相差约5000元，可能是系统统计延迟导致，需要核实。',
      rawData: {
        source: 'CRM系统导出',
        exportTime: '2024-05-16T09:30:00Z',
        extraFields: { region: '华东', channel: '线上' }
      }
    };

    const result = await appealService.createAppeal(request);
    appealId = result.appeal.id;

    if (!result.appeal.id) throw new Error('申诉ID为空');
    if (result.isDuplicate) throw new Error('新申诉不应标记为重复');
    if (result.appeal.status !== AppealStatus.PENDING) throw new Error('初始状态应为pending');
  });

  await test('创建重复申诉 - 应返回已有申诉', async () => {
    const request: CreateAppealRequest = {
      reportName: '销售日报表',
      snapshotDate: '2024-05-15',
      metricValues: { totalSales: 125000 },
      appellant: '张三',
      appealReason: '再次申请核实数据'
    };

    const result = await appealService.createAppeal(request);
    if (!result.isDuplicate) throw new Error('重复申诉应标记为duplicate');
    if (result.appeal.id !== appealId) throw new Error('应返回已有申诉ID');
  });

  console.log('--- 2. 正常流程测试 ---\n');

  await test('查询申诉详情', async () => {
    const appeal = await appealService.getAppealById(appealId);
    if (!appeal) throw new Error('申诉不存在');
    if (appeal.reportName !== '销售日报表') throw new Error('报表名称不匹配');
  });

  await test('查询申诉列表', async () => {
    const result = await appealService.queryAppeals({ reportName: '销售日报表' });
    if (result.total < 1) throw new Error('列表查询结果为空');
  });

  await test('状态流转 - pending -> processing', async () => {
    const updated = await appealService.updateStatus(appealId, {
      status: AppealStatus.PROCESSING,
      operator: '李四',
      comment: '已接收申诉，正在核查数据',
      processingBasis: '根据《数据申诉处理规范》第3.2条进行核查'
    });
    if (updated.status !== AppealStatus.PROCESSING) throw new Error('状态未更新');
  });

  await test('状态流转 - processing -> under_review', async () => {
    const updated = await appealService.updateStatus(appealId, {
      status: AppealStatus.UNDER_REVIEW,
      operator: '李四',
      comment: '数据已提取，进入人工复核阶段'
    });
    if (updated.status !== AppealStatus.UNDER_REVIEW) throw new Error('状态未更新');
  });

  await test('人工修正数据', async () => {
    const correction = await appealService.manualCorrection(appealId, {
      correctedValues: {
        totalSales: 130000,
        orderCount: 355,
        avgOrderValue: 366.2,
        conversionRate: 4.3,
        returnRate: 2.0
      },
      correctedBy: '王五',
      correctionReason: '发现5月15日晚23:00-24:00的5000元销售额未计入统计，已补充计算。'
    });
    if (!correction.id) throw new Error('修正记录未创建');
  });

  await test('生成解释报告', async () => {
    const report = await appealService.generateExplanationReport(appealId, '王五');
    if (!report.content) throw new Error('报告内容为空');
    if (!report.content.includes('修正记录')) throw new Error('报告应包含修正记录');
  });

  await test('导出申诉数据', async () => {
    const exportData = await appealService.exportAppealData(appealId);
    if (!exportData.appeal || !exportData.snapshot || !exportData.corrections) throw new Error('导出数据不完整');
  });

  await test('状态流转 - corrected -> closed', async () => {
    const updated = await appealService.updateStatus(appealId, {
      status: AppealStatus.CLOSED,
      operator: '赵六',
      comment: '申诉已处理完成，数据修正已生效',
      processingBasis: '复核完成，差异原因确认'
    });
    if (updated.status !== AppealStatus.CLOSED) throw new Error('状态未更新');
  });

  console.log('--- 3. 已关闭申诉允许重新提交测试 ---\n');

  await test('已关闭的申诉 - 应允许重新创建新申诉', async () => {
    const request: CreateAppealRequest = {
      reportName: '销售日报表',
      snapshotDate: '2024-05-15',
      metricValues: { totalSales: 125000 },
      appellant: '张三',
      appealReason: '数据又出现异常，再次申诉'
    };

    const result = await appealService.createAppeal(request);
    if (result.isDuplicate) throw new Error('已关闭的申诉应允许重新提交');
    if (result.appeal.id === appealId) throw new Error('应为新的申诉ID');
  });

  console.log('--- 4. 脏数据/异常路径测试 ---\n');

  await test('查询不存在的申诉 - 应返回undefined', async () => {
    const appeal = await appealService.getAppealById('non-existent-id');
    if (appeal !== undefined) throw new Error('应返回undefined');
  });

  await test('无效状态流转 - 直接从pending到corrected应失败', async () => {
    const newRequest: CreateAppealRequest = {
      reportName: '库存报表',
      snapshotDate: '2024-05-16',
      metricValues: { stockLevel: 5000 },
      appellant: '测试用户',
      appealReason: '测试'
    };
    const newResult = await appealService.createAppeal(newRequest);

    try {
      await appealService.updateStatus(newResult.appeal.id, {
        status: AppealStatus.CORRECTED,
        operator: '测试'
      });
      throw new Error('应抛出状态流转异常');
    } catch (error: any) {
      if (!error.message.includes('Invalid status transition')) {
        throw new Error('错误信息不正确: ' + error.message);
      }
    }
  });

  await test('状态为非under_review时执行修正应失败', async () => {
    const newRequest: CreateAppealRequest = {
      reportName: '财务报表',
      snapshotDate: '2024-05-17',
      metricValues: { revenue: 100000 },
      appellant: '测试用户',
      appealReason: '测试修正时机'
    };
    const newResult = await appealService.createAppeal(newRequest);

    try {
      await appealService.manualCorrection(newResult.appeal.id, {
        correctedValues: { revenue: 110000 },
        correctedBy: '测试',
        correctionReason: '测试'
      });
      throw new Error('应抛出状态异常');
    } catch (error: any) {
      if (!error.message.includes('Correction can only be performed')) {
        throw new Error('错误信息不正确: ' + error.message);
      }
    }
  });

  await test('获取不存在申诉的快照 - 应抛出异常', async () => {
    try {
      await appealService.exportAppealData('non-existent-id');
      throw new Error('应抛出不存在异常');
    } catch (error: any) {
      if (!error.message.includes('Appeal not found')) {
        throw new Error('错误信息不正确: ' + error.message);
      }
    }
  });

  console.log('--- 5. 边界条件测试 ---\n');

  await test('创建申诉 - 指标值包含脏数据(特殊字符)', async () => {
    const request: CreateAppealRequest = {
      reportName: '特殊字符测试报表',
      snapshotDate: '2024-05-18',
      metricValues: {
        '测试-指标': 100,
        '指标@#$%': 200,
        '指标 with spaces': 300,
        '指标\n换行': 400
      },
      appellant: '测试用户',
      appealReason: '测试特殊字符指标名称'
    };

    const result = await appealService.createAppeal(request);
    if (result.isDuplicate) throw new Error('不应为重复申诉');
    if (Object.keys(result.appeal.metricValues).length !== 4) throw new Error('指标数量不匹配');
  });

  await test('创建申诉 - 超长申诉原因', async () => {
    const longReason = '数据异常问题说明：'.repeat(100);
    const request: CreateAppealRequest = {
      reportName: '长文本测试报表',
      snapshotDate: '2024-05-19',
      metricValues: { test: 100 },
      appellant: '测试用户',
      appealReason: longReason
    };

    const result = await appealService.createAppeal(request);
    if (!result.appeal.id) throw new Error('申诉创建失败');
  });

  await test('多条件组合查询', async () => {
    const result = await appealService.queryAppeals({
      status: AppealStatus.CLOSED,
      appellant: '张三',
      page: 1,
      pageSize: 10
    });
    if (result.total < 1) throw new Error('应能查询到已关闭的申诉');
  });

  await test('获取快照数据', async () => {
    const appeal = await appealService.getAppealById(appealId);
    if (!appeal) throw new Error('申诉不存在');

    const snapshot = await appealService.getSnapshotById(appeal.snapshotId);
    if (!snapshot) throw new Error('快照不存在');
    if (snapshot.reportName !== appeal.reportName) throw new Error('快照报表名称不匹配');
  });

  await test('获取修正记录列表', async () => {
    const corrections = await appealService.getCorrectionsByAppealId(appealId);
    if (corrections.length < 1) throw new Error('应至少有一条修正记录');
  });

  await test('获取解释报告', async () => {
    const report = await appealService.getReportByAppealId(appealId);
    if (!report) throw new Error('报告不存在');
  });

  console.log('========================================');
  console.log(`  测试结果: 通过 ${passed}, 失败 ${failed}`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(async (error) => {
  console.error('测试执行异常:', error);
  await closeDatabase();
  process.exit(1);
});
