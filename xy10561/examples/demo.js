const { initDB } = require('../src/models/database');
const { createTables } = require('../src/models/schema');
const donationService = require('../src/services/donationService');
const invoiceService = require('../src/services/invoiceService');
const mergeService = require('../src/services/mergeService');
const reportService = require('../src/services/reportService');
const { getHistory } = require('../src/utils/history');
const { DonationStatus, InvoiceStatus, MergeRequestStatus, InvoiceType } = require('../src/utils/states');

function printSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60) + '\n');
}

function printStep(step, description) {
  console.log(`【步骤 ${step}】${description}`);
  console.log('-'.repeat(40));
}

function printStatusChange(entity, oldStatus, newStatus) {
  console.log(`  状态变更: ${oldStatus} → ${newStatus}`);
}

function printResult(data, label = '结果') {
  console.log(`\n  [${label}]`);
  if (typeof data === 'object') {
    console.log('  ' + JSON.stringify(data, null, 2).split('\n').join('\n  '));
  } else {
    console.log(`  ${data}`);
  }
  console.log();
}

async function demoPersonalInvoice() {
  printSection('演示场景一：个人捐赠开票流程');
  
  const projects = donationService.getAllProjects();
  const project = projects[0];
  
  printStep('1', '创建个人捐赠（待支付状态）');
  const donation = donationService.createDonation({
    projectId: project.id,
    amount: 500,
    donorType: 'PERSONAL',
    donorName: '张三',
    donorPhone: '13800138001',
    donorEmail: 'zhangsan@example.com',
    operator: 'USER_001'
  });
  printResult({
    订单号: donation.order_no,
    捐赠人: donation.donor_name,
    金额: `¥${donation.amount}`,
    当前状态: donation.status
  }, '捐赠创建成功');
  printStatusChange('捐赠', '无', donation.status);
  
  printStep('2', '确认捐赠（支付完成）');
  const confirmedDonation = donationService.confirmDonation(donation.id, {
    operator: 'FINANCE_001',
    reason: '用户在线支付完成'
  });
  printResult({
    订单号: confirmedDonation.order_no,
    当前状态: confirmedDonation.status,
    历史记录数: confirmedDonation.history.length
  }, '捐赠已确认');
  printStatusChange('捐赠', DonationStatus.PENDING, confirmedDonation.status);
  
  printStep('3', '申请个人发票');
  const invoice = invoiceService.applyForInvoice({
    donationId: donation.id,
    invoiceType: InvoiceType.PERSONAL,
    title: '张三',
    operator: 'USER_001'
  });
  printResult({
    发票号: invoice.invoice_no,
    开票抬头: invoice.title,
    金额: `¥${invoice.amount}`,
    当前状态: invoice.status
  }, '发票申请成功');
  printStatusChange('发票', '无', invoice.status);
  
  printStep('4', '财务审核并开具发票');
  const issuedInvoice = invoiceService.issueInvoice(invoice.id, {
    operator: 'FINANCE_001',
    reason: '审核通过，正式开票'
  });
  printResult({
    发票号: issuedInvoice.invoice_no,
    当前状态: issuedInvoice.status,
    下载链接: issuedInvoice.download_url,
    历史记录数: issuedInvoice.history.length
  }, '发票已开具');
  printStatusChange('发票', InvoiceStatus.DRAFT, issuedInvoice.status);
  
  printStep('5', '下载发票');
  const downloaded = invoiceService.downloadInvoice(invoice.id);
  printResult({
    发票号: downloaded.invoice_no,
    下载状态: '成功',
    内容预览: downloaded.downloadContent.substring(0, 80) + '...'
  }, '发票下载成功');
  
  return { donation, invoice: issuedInvoice };
}

async function demoEnterpriseMergeInvoice() {
  printSection('演示场景二：企业多笔捐赠合并开票');
  
  const projects = donationService.getAllProjects();
  const project = projects[1];
  
  printStep('1', '创建第一笔企业捐赠');
  const donation1 = donationService.createDonation({
    projectId: project.id,
    amount: 10000,
    donorType: 'ENTERPRISE',
    donorName: '阳光科技有限公司',
    donorTaxId: '91110000MA00ABCD12',
    donorPhone: '010-88888888',
    donorEmail: 'finance@sunnytech.com',
    operator: 'CORP_USER_001'
  });
  donationService.confirmDonation(donation1.id, { operator: 'FINANCE_001' });
  printResult({
    订单号: donation1.order_no,
    企业名称: donation1.donor_name,
    金额: `¥${donation1.amount}`,
    状态: DonationStatus.CONFIRMED
  }, '第一笔捐赠已确认');
  
  printStep('2', '创建第二笔企业捐赠');
  const donation2 = donationService.createDonation({
    projectId: project.id,
    amount: 25000,
    donorType: 'ENTERPRISE',
    donorName: '阳光科技有限公司',
    donorTaxId: '91110000MA00ABCD12',
    donorPhone: '010-88888888',
    donorEmail: 'finance@sunnytech.com',
    operator: 'CORP_USER_001'
  });
  donationService.confirmDonation(donation2.id, { operator: 'FINANCE_001' });
  printResult({
    订单号: donation2.order_no,
    企业名称: donation2.donor_name,
    金额: `¥${donation2.amount}`,
    状态: DonationStatus.CONFIRMED
  }, '第二笔捐赠已确认');
  
  printStep('3', '申请合并开票');
  const mergeRequest = mergeService.createMergeRequest({
    donationIds: [donation1.id, donation2.id],
    title: '阳光科技有限公司',
    taxId: '91110000MA00ABCD12',
    operator: 'CORP_USER_001'
  });
  printResult({
    合并请求号: mergeRequest.request_no,
    开票抬头: mergeRequest.title,
    合并笔数: mergeRequest.items.length,
    总金额: `¥${mergeRequest.total_amount}`,
    当前状态: mergeRequest.status
  }, '合并请求创建成功');
  printStatusChange('合并请求', '无', mergeRequest.status);
  
  printStep('4', '处理合并开票请求');
  const processedMerge = mergeService.processMergeRequest(mergeRequest.id, {
    operator: 'FINANCE_001'
  });
  printResult({
    合并请求号: processedMerge.request_no,
    当前状态: processedMerge.status,
    合并发票ID: processedMerge.merged_invoice_id
  }, '合并开票处理完成');
  printStatusChange('合并请求', MergeRequestStatus.PENDING, processedMerge.status);
  
  printStep('5', '查看合并后的发票');
  const mergedInvoice = invoiceService.getInvoice(processedMerge.merged_invoice_id);
  printResult({
    发票号: mergedInvoice.invoice_no,
    开票抬头: mergedInvoice.title,
    税号: mergedInvoice.tax_id,
    金额: `¥${mergedInvoice.amount}`,
    状态: mergedInvoice.status
  }, '合并发票信息');
  
  return { donation1, donation2, mergeRequest: processedMerge, mergedInvoice };
}

async function demoCancelAndRefund() {
  printSection('演示场景三：捐赠撤销与发票作废（退款同步）');
  
  const projects = donationService.getAllProjects();
  const project = projects[2];
  
  printStep('1', '创建并确认捐赠');
  const donation = donationService.createDonation({
    projectId: project.id,
    amount: 3000,
    donorType: 'PERSONAL',
    donorName: '李四',
    donorPhone: '13900139002',
    operator: 'USER_002'
  });
  donationService.confirmDonation(donation.id, { operator: 'FINANCE_001' });
  printResult({
    订单号: donation.order_no,
    金额: `¥${donation.amount}`,
    状态: DonationStatus.CONFIRMED
  }, '捐赠已确认');
  
  printStep('2', '申请并开具发票');
  const invoice = invoiceService.applyForInvoice({
    donationId: donation.id,
    invoiceType: InvoiceType.PERSONAL,
    title: '李四',
    operator: 'USER_002'
  });
  const issuedInvoice = invoiceService.issueInvoice(invoice.id, { operator: 'FINANCE_001' });
  printResult({
    发票号: issuedInvoice.invoice_no,
    状态: issuedInvoice.status
  }, '发票已开具');
  
  printStep('3', '用户申请退款 - 先作废发票');
  printResult('系统规则：退款前必须先作废关联发票', '检查规则');
  
  const cancelledInvoice = invoiceService.cancelInvoice(issuedInvoice.id, {
    operator: 'FINANCE_001',
    reason: '用户申请退款，同步作废发票'
  });
  printResult({
    发票号: cancelledInvoice.invoice_no,
    新状态: cancelledInvoice.status,
    下载链接: cancelledInvoice.download_url
  }, '发票已作废');
  printStatusChange('发票', InvoiceStatus.ISSUED, cancelledInvoice.status);
  
  printStep('4', '执行捐赠退款');
  const refundedDonation = donationService.refundDonation(donation.id, {
    operator: 'FINANCE_001',
    reason: '用户自愿申请退款，款项原路退回'
  });
  printResult({
    订单号: refundedDonation.order_no,
    新状态: refundedDonation.status,
    历史记录数: refundedDonation.history.length
  }, '捐赠已退款');
  printStatusChange('捐赠', DonationStatus.CONFIRMED, refundedDonation.status);
  
  printStep('5', '验证作废发票不能下载');
  try {
    invoiceService.downloadInvoice(issuedInvoice.id);
    printResult('ERROR: 应该抛出异常', '验证失败');
  } catch (error) {
    printResult({
      错误码: error.code,
      错误信息: error.message
    }, '验证成功：作废发票无法下载');
  }
  
  return { donation: refundedDonation, invoice: cancelledInvoice };
}

async function demoDuplicateProtection() {
  printSection('演示场景四：重复开票保护机制');
  
  const projects = donationService.getAllProjects();
  const project = projects[0];
  
  printStep('1', '创建并确认捐赠');
  const donation = donationService.createDonation({
    projectId: project.id,
    amount: 800,
    donorType: 'PERSONAL',
    donorName: '王五',
    operator: 'USER_003'
  });
  donationService.confirmDonation(donation.id, { operator: 'FINANCE_001' });
  printResult({
    订单号: donation.order_no,
    状态: DonationStatus.CONFIRMED
  }, '捐赠已确认');
  
  printStep('2', '第一次申请发票（成功）');
  const invoice1 = invoiceService.applyForInvoice({
    donationId: donation.id,
    invoiceType: InvoiceType.PERSONAL,
    title: '王五',
    operator: 'USER_003'
  });
  printResult({
    发票号: invoice1.invoice_no,
    状态: invoice1.status
  }, '第一次开票成功');
  
  printStep('3', '第二次申请发票（应该被拒绝）');
  try {
    invoiceService.applyForInvoice({
      donationId: donation.id,
      invoiceType: InvoiceType.PERSONAL,
      title: '王五',
      operator: 'USER_003'
    });
    printResult('ERROR: 应该抛出异常', '验证失败');
  } catch (error) {
    printResult({
      错误码: error.code,
      错误信息: error.message
    }, '验证成功：系统拒绝重复开票');
  }
  
  return { donation, invoice: invoice1 };
}

async function demoFundUsageTracking() {
  printSection('演示场景五：项目资金用途追踪');
  
  const projects = donationService.getAllProjects();
  const project = projects[0];
  
  printStep('1', '查看项目资金汇总（开票前）');
  const summaryBefore = donationService.getProjectFundSummary(project.id);
  printResult({
    项目名称: project.name,
    总捐赠: `¥${summaryBefore.totalDonated}`,
    已使用: `¥${summaryBefore.totalUsed}`,
    可用余额: `¥${summaryBefore.availableBalance}`
  }, '开票前资金状况');
  
  printStep('2', '记录资金使用 - 购买教学物资');
  const usage1 = donationService.addFundUsage(
    project.id,
    500,
    'PURCHASE',
    '购买课桌椅、书包等教学物资',
    'PROJECT_MANAGER_001'
  );
  printResult({
    用途类型: usage1.purpose,
    金额: `¥${usage1.amount}`,
    描述: usage1.description,
    操作人: usage1.operator
  }, '资金使用记录1');
  
  printStep('3', '记录资金使用 - 志愿者补贴');
  const usage2 = donationService.addFundUsage(
    project.id,
    300,
    'VOLUNTEER',
    '发放支教志愿者月度补贴',
    'PROJECT_MANAGER_001'
  );
  printResult({
    用途类型: usage2.purpose,
    金额: `¥${usage2.amount}`,
    描述: usage2.description,
    操作人: usage2.operator
  }, '资金使用记录2');
  
  printStep('4', '查看项目资金汇总（使用后）');
  const summaryAfter = donationService.getProjectFundSummary(project.id);
  printResult({
    项目名称: project.name,
    总捐赠: `¥${summaryAfter.totalDonated}`,
    已使用: `¥${summaryAfter.totalUsed}`,
    可用余额: `¥${summaryAfter.availableBalance}`,
    使用笔数: summaryAfter.usageCount
  }, '使用后资金状况');
  
  return { summaryBefore, usages: [usage1, usage2], summaryAfter };
}

async function demoReports() {
  printSection('演示场景六：财务对账报告导出');
  
  printStep('1', '获取财务对账报告（JSON格式）');
  const report = reportService.getFullReconciliationReport();
  printResult({
    报告时间: report.reportDate,
    项目数量: report.summary.projects,
    捐赠记录: report.summary.totalDonations,
    票据记录: report.summary.totalInvoices,
    财务概览: {
      总确认捐赠: `¥${report.financial.totalConfirmed}`,
      总退款: `¥${report.financial.totalRefunded}`,
      净捐赠: `¥${report.financial.netDonations}`,
      已开票: `¥${report.financial.totalInvoiced}`,
      已使用: `¥${report.financial.totalUsed}`,
      可用余额: `¥${report.financial.availableBalance}`
    }
  }, '对账报告摘要');
  
  printStep('2', '对账检查结果');
  report.reconciliationChecks.forEach((check, i) => {
    console.log(`\n  检查 ${i + 1}: ${check.name}`);
    console.log(`    状态: [${check.status}]`);
    console.log(`    预期: ¥${check.expected.toFixed(2)}`);
    console.log(`    实际: ¥${check.actual.toFixed(2)}`);
    console.log(`    差异: ¥${check.difference.toFixed(2)}`);
  });
  
  printStep('3', '导出行式文本报告（模拟下载）');
  const exported = reportService.exportReport('text');
  console.log('\n  --- 文本报告预览（前30行）---');
  console.log(exported.content.split('\n').slice(0, 30).join('\n'));
  
  return { report, exported };
}

async function runAllDemos() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           公益捐赠票据 API 系统 - 完整演示流程                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  printSection('初始化系统');
  console.log('正在初始化数据库...');
  await initDB();
  createTables();
  console.log('✓ 数据库初始化完成');
  
  console.log('正在创建样例项目...');
  const { seed } = require('./seed');
  await seed();
  
  const results = {};
  
  results.personal = await demoPersonalInvoice();
  results.enterprise = await demoEnterpriseMergeInvoice();
  results.cancel = await demoCancelAndRefund();
  results.duplicate = await demoDuplicateProtection();
  results.fundUsage = await demoFundUsageTracking();
  results.reports = await demoReports();
  
  printSection('演示完成总结');
  console.log('✓ 场景一：个人捐赠开票流程 - 完成');
  console.log('✓ 场景二：企业多笔捐赠合并开票 - 完成');
  console.log('✓ 场景三：捐赠撤销与发票作废 - 完成');
  console.log('✓ 场景四：重复开票保护机制 - 完成');
  console.log('✓ 场景五：项目资金用途追踪 - 完成');
  console.log('✓ 场景六：财务对账报告导出 - 完成');
  
  console.log('\n' + '='.repeat(60));
  console.log('  所有演示场景已完成！');
  console.log('='.repeat(60));
  console.log('\n您可以通过以下方式查看详细数据：');
  console.log('  1. 启动服务器: npm start');
  console.log('  2. 访问状态汇总: GET /api/reports/summary');
  console.log('  3. 查看完整历史: GET /api/history');
  console.log('  4. 导出对账报告: GET /api/reports/export?format=text');
  console.log('\n');
  
  return results;
}

if (require.main === module) {
  runAllDemos().catch(console.error);
}

module.exports = { runAllDemos };
