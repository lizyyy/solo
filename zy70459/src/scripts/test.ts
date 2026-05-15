import ValidationService from '../services/validationService';
import QueryService from '../services/queryService';
import SummaryService from '../services/summaryService';
import { initDatabase, closeDb } from '../database';

const runTests = async () => {
  console.log('=== 开始测试冻结窗口校验服务 ===\n');

  console.log('1. 初始化数据库...');
  initDatabase();
  console.log('   ✓ 数据库初始化成功\n');

  console.log('2. 测试冻结窗口检查...');
  const now = new Date();
  const { inWindow, windowType } = ValidationService.isInFreezeWindow(now);
  console.log(`   当前时间: ${now.toLocaleString()}`);
  console.log(`   窗口类型: ${windowType}`);
  console.log(`   是否在窗口内: ${inWindow ? '是' : '否'}`);
  console.log('   ✓ 冻结窗口检查完成\n');

  console.log('3. 测试样本查询...');
  const queryResult = await QueryService.queryByBusinessNo('LAB20240515001');
  console.log(`   业务单号: ${queryResult.businessNo}`);
  console.log(`   状态: ${queryResult.status}`);
  console.log('   ✓ 样本查询完成\n');

  console.log('4. 测试失败记录查询...');
  const failures = await QueryService.getFailureRecords({ pageSize: 5 });
  console.log(`   总失败数: ${failures.total}`);
  failures.items.forEach((f, i) => {
    console.log(`   ${i + 1}. ${f.businessNo} - ${f.failureType}`);
  });
  console.log('   ✓ 失败记录查询完成\n');

  console.log('5. 测试异常样本查询...');
  const anomalies = await QueryService.getAnomalySamples({ pageSize: 5 });
  console.log(`   总异常样本数: ${anomalies.total}`);
  anomalies.items.forEach((a, i) => {
    console.log(`   ${i + 1}. ${a.businessNo} - ${(a as any).anomalyType}`);
  });
  console.log('   ✓ 异常样本查询完成\n');

  console.log('6. 测试摘要生成...');
  const summary = await SummaryService.generateSummary();
  console.log(`   总样本数: ${summary.statistics.total}`);
  console.log(`   成功数: ${summary.statistics.successCount}`);
  console.log(`   失败数: ${summary.statistics.failedCount}`);
  console.log(`   含网关错误数: ${summary.statistics.hasGatewayError}`);
  console.log(`   异常样本数: ${summary.statistics.anomalyCount}`);
  console.log('   ✓ 摘要生成完成\n');

  console.log('7. 测试错误统计...');
  const errorStats = await SummaryService.getErrorStatistics();
  console.log('   按错误类型统计:');
  Object.entries(errorStats.byErrorType).forEach(([type, count]) => {
    console.log(`     ${type}: ${count}`);
  });
  console.log('   按科室统计:');
  Object.entries(errorStats.byDepartment).forEach(([dept, stats]) => {
    console.log(`     ${dept}: 总数 ${stats.total}, 失败数 ${stats.failed}`);
  });
  console.log('   ✓ 错误统计完成\n');

  console.log('8. 测试 LAB20240515005 摘要正确性...');
  const { summary: specificSummary } = await SummaryService.generateSummary(['LAB20240515005']);
  const anomalySample = specificSummary.find(s => s.businessNo === 'LAB20240515005');
  if (anomalySample) {
    console.log(`   业务单号: ${anomalySample.businessNo}`);
    console.log(`   状态: ${anomalySample.status}`);
    console.log(`   结论: ${anomalySample.conclusion?.substring(0, 50)}...`);
    console.log(`   含网关错误: ${!!anomalySample.gatewayError}`);
    console.log(`   含修正建议: ${!!anomalySample.correction}`);
    
    if (anomalySample.status === 'success') {
      console.error('   ✗ 错误: 异常样本状态不应为 success!');
      throw new Error('异常样本状态错误');
    }
    if (anomalySample.conclusion === '校验通过') {
      console.error('   ✗ 错误: 异常样本结论不应为"校验通过"!');
      throw new Error('异常样本结论错误');
    }
  }
  console.log('   ✓ LAB20240515005 摘要正确性验证完成\n');

  console.log('9. 测试摘要报告生成...');
  const report = await SummaryService.generateSummaryReport(['LAB20240515001', 'LAB20240515005']);
  console.log(`   报告长度: ${report.length} 字符`);
  console.log('   ✓ 摘要报告生成完成\n');

  closeDb();
  console.log('=== 所有测试通过! ===');
};

runTests().catch(console.error);
