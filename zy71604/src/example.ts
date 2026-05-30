import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import {
  AnnouncementParser,
  ShareCalculator,
  ChoiceManager,
  SettlementReconciler,
  LocalStorage,
  IdempotencyManager,
  ReportGenerator,
  SourceTracer,
  Fund,
  ClientAccount,
  DividendAnnouncement,
  ShareRecord,
  DividendChoice,
  SettlementRecord,
  ProcessingTask,
} from './index';

async function runExample() {
  console.log('=== 公募分红再投资核算系统 - 完整示例 ===\n');

  const storage = new LocalStorage({ dataDir: './data/example' });
  const parser = new AnnouncementParser();
  const calculator = new ShareCalculator();
  const choiceManager = new ChoiceManager();
  const reconciler = new SettlementReconciler();
  const idempotency = new IdempotencyManager();
  const reporter = new ReportGenerator();
  const tracer = new SourceTracer();

  storage.clear();
  choiceManager.clear();
  idempotency.clearAll();

  console.log('1. 创建基金基础信息');
  const fund: Fund = {
    id: uuidv4(),
    fundCode: '000001',
    fundName: '示例混合型证券投资基金',
    fundType: '混合型',
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
  };
  storage.saveFund(fund);
  console.log(`   基金: ${fund.fundName} (${fund.fundCode})`);

  console.log('\n2. 创建客户账户');
  const accounts: ClientAccount[] = [
    {
      id: uuidv4(),
      accountNo: 'ACC001',
      clientName: '张三',
      idType: '身份证',
      idNumber: '110101199001011234',
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    },
    {
      id: uuidv4(),
      accountNo: 'ACC002',
      clientName: '李四',
      idType: '身份证',
      idNumber: '110101199002025678',
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    },
    {
      id: uuidv4(),
      accountNo: 'ACC003',
      clientName: '王五',
      idType: '身份证',
      idNumber: '110101199003039012',
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    },
  ];
  accounts.forEach(a => storage.saveAccount(a));
  console.log(`   创建 ${accounts.length} 个客户账户`);

  console.log('\n3. 解析分红公告');
  const announcementText = `
    示例混合型证券投资基金分红公告
    基金代码：000001
    公告编号：ANN-2024-001
    公告日期：2024年12月15日
    
    权益登记日：2024年12月20日
    除息日：2024年12月23日
    红利发放日：2024年12月24日
    
    每10份派发红利：2.50元
    红利再投资净值：1.2500元
    
    分红方式：四舍五入，保留2位小数
  `;

  const parseResult = parser.parse(announcementText, '分红公告20241215.pdf');
  console.log(`   解析结果: ${parseResult.success ? '成功' : '失败'}`);
  if (parseResult.data) {
    console.log(`   权益登记日: ${parseResult.data.registrationDate}`);
    console.log(`   除息日: ${parseResult.data.exDividendDate}`);
    console.log(`   红利发放日: ${parseResult.data.paymentDate}`);
    console.log(`   每份分红: ${parseResult.data.dividendPerUnit?.toString()}`);
    console.log(`   再投资净值: ${parseResult.data.reinvestmentNav?.toString()}`);
  }

  const announcementSource = tracer.createSourceReference(
    'announcement',
    'ANN-2024-001',
    { fileName: '分红公告20241215.pdf' }
  );

  const announcement: DividendAnnouncement = parser.createAnnouncement(
    fund.id,
    parseResult.data!,
    announcementSource
  );
  storage.saveAnnouncement(announcement, '导入分红公告');

  console.log('\n4. 导入客户分红方式选择');
  const choices: { accountId: string; type: 'cash' | 'reinvestment'; date: string }[] = [
    { accountId: accounts[0].id, type: 'reinvestment', date: '2024-01-01' },
    { accountId: accounts[1].id, type: 'cash', date: '2024-06-15' },
    { accountId: accounts[2].id, type: 'reinvestment', date: '2024-03-20' },
  ];

  choices.forEach((c, index) => {
    const choiceSource = tracer.createSourceReference(
      'client_choice',
      `CHOICE-${index + 1}`,
      { fileName: '客户分红方式表.xlsx', row: index + 2 }
    );
    choiceManager.addChoice({
      accountId: c.accountId,
      fundId: fund.id,
      dividendType: c.type,
      effectiveDate: c.date,
      source: choiceSource,
    });
  });
  console.log(`   导入 ${choices.length} 条分红方式选择`);

  console.log('\n5. 导入权益登记日份额');
  const shareData = [
    { accountId: accounts[0].id, shares: new Decimal('10000.50') },
    { accountId: accounts[1].id, shares: new Decimal('5000.25') },
    { accountId: accounts[2].id, shares: new Decimal('25000.75') },
  ];

  const shareRecords: ShareRecord[] = shareData.map((d, index) => ({
    id: uuidv4(),
    accountId: d.accountId,
    fundId: fund.id,
    referenceDate: announcement.registrationDate,
    totalShares: d.shares,
    availableShares: d.shares,
    source: tracer.createSourceReference(
      'share_file',
      `SHARE-${index + 1}`,
      { fileName: '登记日份额表.xlsx', row: index + 2 }
    ),
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
    version: 1,
  }));
  shareRecords.forEach(s => storage.saveShareRecord(s));
  console.log(`   导入 ${shareRecords.length} 条份额记录`);

  console.log('\n6. 批量计算分红再投资');
  const calcKey = idempotency.generateCalculationKey(fund.id, announcement.id);
  
  const calcInputs = shareRecords.map(record => {
    const choice = choiceManager.getChoice({
      accountId: record.accountId,
      fundId: fund.id,
      effectiveDate: announcement.registrationDate,
    })!;
    
    return {
      accountId: record.accountId,
      fundId: fund.id,
      announcement,
      shareRecord: record,
      dividendChoice: choice,
    };
  });

  const batchResult = calculator.batchCalculate(calcInputs);
  batchResult.results.forEach(r => storage.saveCalculationResult(r));
  console.log(`   计算完成: ${batchResult.summary.total} 条`);
  console.log(`   - 匹配: ${batchResult.summary.matched}`);
  console.log(`   - 待核对: ${batchResult.summary.pending}`);
  console.log(`   - 问题数: ${batchResult.summary.issues.length}`);

  batchResult.summary.issues.forEach(issue => {
    console.log(`   问题: ${issue.message}`);
  });

  console.log('\n7. 导入到账记录并核对');
  const settlementData = [
    { accountId: accounts[0].id, shares: new Decimal('20001.00'), cash: new Decimal('0') },
    { accountId: accounts[1].id, shares: new Decimal('0'), cash: new Decimal('1250.06') },
    { accountId: accounts[2].id, shares: new Decimal('50001.52'), cash: new Decimal('0') },
  ];

  const settlements: SettlementRecord[] = settlementData.map((d, index) => ({
    id: uuidv4(),
    accountId: d.accountId,
    fundId: fund.id,
    announcementId: announcement.id,
    settlementDate: announcement.paymentDate,
    reinvestedShares: d.shares,
    cashDividend: d.cash,
    source: tracer.createSourceReference(
      'settlement_record',
      `SETTLE-${index + 1}`,
      { fileName: '到账记录表.xlsx', row: index + 2 }
    ),
    createdAt: dayjs().toISOString(),
  }));
  settlements.forEach(s => storage.saveSettlement(s));

  const reconcileInputs = batchResult.results.map((result, index) => ({
    calculationResult: result,
    settlementRecord: settlements[index],
    announcement,
  }));

  const reconcileResult = reconciler.batchReconcile(reconcileInputs);
  reconcileResult.results.forEach(r => storage.saveCalculationResult(r, '核对完成'));
  
  console.log(`   核对完成:`);
  console.log(`   - 匹配: ${reconcileResult.summary.matched}`);
  console.log(`   - 不匹配: ${reconcileResult.summary.mismatched}`);
  console.log(`   - 严重问题: ${reconcileResult.summary.criticalIssues}`);
  console.log(`   - 总差异: ${reconcileResult.summary.totalDifference.toString()} 份`);

  console.log('\n8. 创建处理任务');
  const task: ProcessingTask = {
    id: uuidv4(),
    fundId: fund.id,
    announcementId: announcement.id,
    status: 'processed',
    totalAccounts: reconcileResult.summary.totalRecords,
    processedAccounts: reconcileResult.summary.totalRecords,
    matchedCount: reconcileResult.summary.matched,
    mismatchCount: reconcileResult.summary.mismatched,
    pendingCount: 0,
    rejectedCount: 0,
    issues: reconcileResult.results.flatMap(r => r.issues),
    createdAt: dayjs().toISOString(),
    startedAt: dayjs().subtract(5, 'minute').toISOString(),
    completedAt: dayjs().toISOString(),
    operator: 'system',
  };
  storage.saveTask(task);

  console.log('\n9. 生成核算报告');
  const report = reporter.generateReport(
    task,
    fund,
    announcement,
    reconcileResult.results,
    accounts
  );

  console.log(reporter.getStatusSummary(report));

  const excelPath = './data/example/核算报告.xlsx';
  reporter.exportToExcel(report, accounts, excelPath);
  console.log(`\n   Excel报告已导出: ${excelPath}`);

  const jsonPath = './data/example/核算报告.json';
  const fs = require('fs');
  fs.writeFileSync(jsonPath, reporter.exportToJSON(report), 'utf-8');
  console.log(`   JSON报告已导出: ${jsonPath}`);

  console.log('\n10. 数据溯源演示');
  const mismatched = reconcileResult.results.filter(r => r.status === 'mismatch');
  if (mismatched.length > 0) {
    const result = mismatched[0];
    const trace = tracer.traceCalculationResult(result);
    
    console.log(`   核算结果ID: ${trace.resultId}`);
    console.log(`   数据来源:`);
    trace.sources.forEach(s => {
      console.log(`     - ${s.typeName}: ${s.fileName} (${s.location || 'N/A'})`);
    });
    
    if (trace.issues.length > 0) {
      console.log(`   问题溯源:`);
      trace.issues.forEach(issue => {
        console.log(`\n   ${tracer.printTrace(issue)}`);
      });
    }
  }

  console.log('\n11. 版本历史演示');
  const firstResult = reconcileResult.results[0];
  const versions = storage.getVersions('calculation', firstResult.id);
  console.log(`   核算结果版本数: ${versions.length}`);
  versions.forEach((v, i) => {
    console.log(`     版本 ${v.version}: ${v.createdAt}`);
  });

  console.log('\n12. 幂等性演示');
  const stats = idempotency.getStatistics();
  console.log(`   请求统计: 共 ${stats.total} 个, 已完成 ${stats.completed} 个`);

  console.log('\n=== 示例执行完成 ===');
  console.log('数据已保存到 ./data/example/ 目录');
}

runExample().catch(console.error);
