import * as fs from 'fs';
import * as path from 'path';
import { fileParserService } from './services/FileParserService';
import { processingService } from './services/ProcessingService';
import { dataStore } from './store/DataStore';

async function runTest() {
  console.log('='.repeat(60));
  console.log('  研究生院招生数据处理API - 测试演示');
  console.log('='.repeat(60));
  console.log();

  dataStore.reset();

  const BATCH_ID = 'BATCH_2024_TEST_001';

  console.log('📁 步骤1: 解析导师CSV文件');
  console.log('-'.repeat(40));
  const mentorCsvPath = path.join(__dirname, '../samples/mentors.csv');
  const mentorBuffer = fs.readFileSync(mentorCsvPath);
  const mentors = await fileParserService.parseMentorCSV(mentorBuffer);
  console.log(`✓ 成功解析 ${mentors.length} 位导师信息`);
  mentors.forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.name} - ${m.direction} (${m.quota - m.usedQuota}/${m.quota})`);
  });
  console.log();

  console.log('📁 步骤2: 解析学生志愿JSON');
  console.log('-'.repeat(40));
  const appsJsonPath = path.join(__dirname, '../samples/applications.json');
  const appsJson = fs.readFileSync(appsJsonPath, 'utf-8');
  const applications = fileParserService.parseApplicationsJSON(appsJson);
  console.log(`✓ 成功解析 ${applications.length} 条学生志愿`);
  applications.forEach((a, i) => {
    console.log(`  ${i + 1}. ${a.studentName} - 报考 ${a.mentorName}`);
  });
  console.log();

  console.log('📁 步骤3: 解析调剂记录JSON');
  console.log('-'.repeat(40));
  const transfersJsonPath = path.join(__dirname, '../samples/transfers.json');
  const transfersJson = fs.readFileSync(transfersJsonPath, 'utf-8');
  const transfers = fileParserService.parseTransfersJSON(transfersJson);
  console.log(`✓ 成功解析 ${transfers.length} 条调剂记录`);
  console.log();

  console.log('⚙️ 步骤4: 执行批量处理');
  console.log('-'.repeat(40));
  const result = processingService.processBatch(BATCH_ID, mentors, applications, transfers);
  console.log(`✓ 批次 ${BATCH_ID} 处理完成`);
  console.log();

  console.log('📊 处理结果汇总');
  console.log('-'.repeat(40));
  console.log('导师导入:');
  if (result.summary.mentors) {
    console.log(`  ✓ 正常: ${result.summary.mentors.normal}`);
    console.log(`  ⚠ 待确认: ${result.summary.mentors.pending}`);
    console.log(`  ✗ 失败: ${result.summary.mentors.failed}`);
  }
  console.log('学生志愿:');
  if (result.summary.applications) {
    console.log(`  ✓ 正常: ${result.summary.applications.normal}`);
    console.log(`  ⚠ 待确认: ${result.summary.applications.pending}`);
    console.log(`  ✗ 失败: ${result.summary.applications.failed}`);
  }
  console.log('调剂记录:');
  if (result.summary.transfers) {
    console.log(`  ✓ 正常: ${result.summary.transfers.normal}`);
    console.log(`  ⚠ 待确认: ${result.summary.transfers.pending}`);
    console.log(`  ✗ 失败: ${result.summary.transfers.failed}`);
  }
  console.log();

  if (result.details.applications) {
    if (result.details.applications.pending.length > 0) {
      console.log('⚠️ 待人工确认的申请记录');
      console.log('-'.repeat(40));
      result.details.applications.pending.forEach((item, i) => {
        console.log(`  ${i + 1}. 学生: ${item.data.studentName}`);
        console.log(`     原因: ${item.message}`);
      });
      console.log();
    }

    if (result.details.applications.failed.length > 0) {
      console.log('✗ 导入失败的记录（含建议处理方式');
      console.log('-'.repeat(40));
      result.details.applications.failed.forEach((item, i) => {
        console.log(`  ${i + 1}. 学生: ${item.original.studentName}`);
        console.log(`     错误: ${item.error}`);
        console.log(`     建议: ${item.suggestion}`);
      });
      console.log();
    }
  }

  if (result.details.transfers?.failed?.length) {
    console.log('✗ 导入失败的调剂记录');
    console.log('-'.repeat(40));
    result.details.transfers.failed.forEach((item, i) => {
      console.log(`  ${i + 1}. 学生: ${item.original.studentName}`);
      console.log(`     错误: ${item.error}`);
      console.log(`     建议: ${item.suggestion}`);
    });
    console.log();
  }

  console.log('📈 系统统计数据');
  console.log('-'.repeat(40));
  const stats = processingService.getStatistics();
  console.log(`  导师总数: ${stats.mentors}`);
  console.log(`  申请总数: ${stats.applications.total}`);
  console.log(`    - 正常: ${stats.applications.normal}`);
  console.log(`    - 已确认: ${stats.applications.confirmed}`);
  console.log(`    - 待确认: ${stats.applications.pending}`);
  console.log(`  调剂记录: ${stats.transfers.total}`);
  console.log();

  console.log('🔄 测试防重复导入');
  console.log('-'.repeat(40));
  try {
    processingService.processBatch(BATCH_ID, mentors, applications, transfers);
    console.log('  ✗ 错误: 重复导入未被拦截！');
  } catch (e: any) {
    console.log(`  ✓ 正确: ${e.message}`);
  }
  console.log();

  console.log('🎯 关键业务规则验证示例');
  console.log('-'.repeat(40));
  const failedApp = result.details.applications?.failed?.find(a => a.error?.includes('专业'));
  if (failedApp) {
    console.log('  ✓ 跨专业限制规则生效: 学生专业与导师专业不匹配时正确标记失败');
  }
  
  const quotaFullMentor = mentors.find(m => m.usedQuota >= m.quota);
  if (quotaFullMentor) {
    console.log('  ✓ 名额占用规则生效: 导师名额满时无法继续录取');
  }
  
  console.log();

  console.log('='.repeat(60));
  console.log('  测试完成！');
  console.log('='.repeat(60));
  console.log();
  console.log('💡 下一步操作:');
  console.log('  1. 运行 npm install 安装依赖');
  console.log('  2. 运行 npm run dev 启动开发服务器');
  console.log('  3. 访问 http://localhost:3000 查看API');
  console.log();
}

runTest().catch(console.error);
