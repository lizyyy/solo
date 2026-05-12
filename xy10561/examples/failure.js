const { initDB } = require('../src/models/database');
const { createTables } = require('../src/models/schema');
const donationService = require('../src/services/donationService');
const invoiceService = require('../src/services/invoiceService');
const mergeService = require('../src/services/mergeService');
const { ERROR_CODES, InvoiceType } = require('../src/utils/states');

function printSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60) + '\n');
}

function printStep(step, description) {
  console.log(`【失败场景 ${step}】${description}`);
  console.log('-'.repeat(40));
}

function expectError(fn, expectedCode, description) {
  try {
    fn();
    console.log(`\n  [失败] 应该抛出异常: ${description}`);
    console.log('  实际: 未抛出任何异常');
    return false;
  } catch (error) {
    if (error.code === expectedCode) {
      console.log(`\n  [成功] 正确捕获到预期错误`);
      console.log(`  错误码: ${error.code}`);
      console.log(`  错误信息: ${error.message}`);
      return true;
    } else {
      console.log(`\n  [失败] 捕获到错误但不是预期的`);
      console.log(`  预期错误码: ${expectedCode}`);
      console.log(`  实际错误码: ${error.code}`);
      console.log(`  实际错误信息: ${error.message}`);
      return false;
    }
  }
}

async function runFailureScenarios() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         公益捐赠票据 API 系统 - 失败路径演示                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  printSection('初始化系统');
  await initDB();
  createTables();
  
  const { seed } = require('./seed');
  const projects = await seed();
  
  printSection('失败场景演示开始');
  
  let successCount = 0;
  let totalCount = 0;
  
  printStep('1', '企业捐赠缺少税号');
  console.log('  操作: 创建企业类型捐赠但不提供税号');
  console.log('  预期错误: TAX_ID_MISSING');
  totalCount++;
  if (expectError(
    () => donationService.createDonation({
      projectId: projects[0].id,
      amount: 1000,
      donorType: 'ENTERPRISE',
      donorName: '测试企业'
    }),
    ERROR_CODES.TAX_ID_MISSING,
    '企业捐赠缺少税号'
  )) successCount++;
  
  printStep('2', '未确认的捐赠申请开票');
  console.log('  操作: 对PENDING状态的捐赠申请发票');
  console.log('  预期错误: INVALID_STATUS_TRANSITION');
  const pendingDonation = donationService.createDonation({
    projectId: projects[0].id,
    amount: 500,
    donorType: 'PERSONAL',
    donorName: '测试用户'
  });
  totalCount++;
  if (expectError(
    () => invoiceService.applyForInvoice({
      donationId: pendingDonation.id,
      invoiceType: InvoiceType.PERSONAL,
      title: '测试用户'
    }),
    ERROR_CODES.INVALID_STATUS_TRANSITION,
    '未确认捐赠申请开票'
  )) successCount++;
  
  printStep('3', '重复开票（已有有效发票）');
  console.log('  操作: 对已有有效发票的捐赠再次申请开票');
  console.log('  预期错误: DUPLICATE_INVOICE');
  const confirmedDonation = donationService.createDonation({
    projectId: projects[1].id,
    amount: 800,
    donorType: 'PERSONAL',
    donorName: '重复测试'
  });
  donationService.confirmDonation(confirmedDonation.id);
  invoiceService.applyForInvoice({
    donationId: confirmedDonation.id,
    invoiceType: InvoiceType.PERSONAL,
    title: '重复测试'
  });
  totalCount++;
  if (expectError(
    () => invoiceService.applyForInvoice({
      donationId: confirmedDonation.id,
      invoiceType: InvoiceType.PERSONAL,
      title: '重复测试'
    }),
    ERROR_CODES.DUPLICATE_INVOICE,
    '重复开票'
  )) successCount++;
  
  printStep('4', '跨项目合并开票');
  console.log('  操作: 尝试合并不同项目的捐赠');
  console.log('  预期错误: CROSS_PROJECT_MERGE');
  const donationProject1 = donationService.createDonation({
    projectId: projects[0].id,
    amount: 1000,
    donorType: 'ENTERPRISE',
    donorName: '跨项目测试',
    donorTaxId: '91110000TEST001'
  });
  const donationProject2 = donationService.createDonation({
    projectId: projects[1].id,
    amount: 2000,
    donorType: 'ENTERPRISE',
    donorName: '跨项目测试',
    donorTaxId: '91110000TEST001'
  });
  donationService.confirmDonation(donationProject1.id);
  donationService.confirmDonation(donationProject2.id);
  totalCount++;
  if (expectError(
    () => mergeService.createMergeRequest({
      donationIds: [donationProject1.id, donationProject2.id],
      title: '跨项目测试',
      taxId: '91110000TEST001'
    }),
    ERROR_CODES.CROSS_PROJECT_MERGE,
    '跨项目合并'
  )) successCount++;
  
  printStep('5', '企业合并开票缺少税号');
  console.log('  操作: 创建合并请求但不提供税号');
  console.log('  预期错误: TAX_ID_MISSING');
  const mergeDonation1 = donationService.createDonation({
    projectId: projects[2].id,
    amount: 5000,
    donorType: 'ENTERPRISE',
    donorName: '合并税号测试',
    donorTaxId: '91110000TEST002'
  });
  const mergeDonation2 = donationService.createDonation({
    projectId: projects[2].id,
    amount: 3000,
    donorType: 'ENTERPRISE',
    donorName: '合并税号测试',
    donorTaxId: '91110000TEST002'
  });
  donationService.confirmDonation(mergeDonation1.id);
  donationService.confirmDonation(mergeDonation2.id);
  totalCount++;
  if (expectError(
    () => mergeService.createMergeRequest({
      donationIds: [mergeDonation1.id, mergeDonation2.id],
      title: '合并税号测试'
    }),
    ERROR_CODES.TAX_ID_MISSING,
    '企业合并缺少税号'
  )) successCount++;
  
  printStep('6', '下载已作废的发票');
  console.log('  操作: 尝试下载状态为CANCELLED的发票');
  console.log('  预期错误: CANCELLED_INVOICE_DOWNLOAD');
  const downloadTestDonation = donationService.createDonation({
    projectId: projects[0].id,
    amount: 200,
    donorType: 'PERSONAL',
    donorName: '下载测试'
  });
  donationService.confirmDonation(downloadTestDonation.id);
  const downloadTestInvoice = invoiceService.applyForInvoice({
    donationId: downloadTestDonation.id,
    invoiceType: InvoiceType.PERSONAL,
    title: '下载测试'
  });
  invoiceService.issueInvoice(downloadTestInvoice.id);
  invoiceService.cancelInvoice(downloadTestInvoice.id);
  totalCount++;
  if (expectError(
    () => invoiceService.downloadInvoice(downloadTestInvoice.id),
    ERROR_CODES.CANCELLED_INVOICE_DOWNLOAD,
    '下载作废发票'
  )) successCount++;
  
  printStep('7', '有有效发票的捐赠直接退款');
  console.log('  操作: 尝试退款但未先作废发票');
  console.log('  预期错误: INVALID_STATUS_TRANSITION');
  const refundTestDonation = donationService.createDonation({
    projectId: projects[1].id,
    amount: 1500,
    donorType: 'PERSONAL',
    donorName: '退款测试'
  });
  donationService.confirmDonation(refundTestDonation.id);
  const refundTestInvoice = invoiceService.applyForInvoice({
    donationId: refundTestDonation.id,
    invoiceType: InvoiceType.PERSONAL,
    title: '退款测试'
  });
  invoiceService.issueInvoice(refundTestInvoice.id);
  totalCount++;
  if (expectError(
    () => donationService.refundDonation(refundTestDonation.id),
    ERROR_CODES.INVALID_STATUS_TRANSITION,
    '有发票时直接退款'
  )) successCount++;
  
  printStep('8', '资金使用超出可用余额');
  console.log('  操作: 记录超出可用余额的资金使用');
  console.log('  预期错误: VALIDATION_ERROR');
  totalCount++;
  if (expectError(
    () => donationService.addFundUsage(
      projects[0].id,
      999999999,
      'OVERUSE',
      '测试超出余额',
      'TEST_OPERATOR'
    ),
    ERROR_CODES.VALIDATION_ERROR,
    '资金使用超出余额'
  )) successCount++;
  
  printSection('失败场景演示结果');
  console.log(`  总测试场景数: ${totalCount}`);
  console.log(`  成功捕获的场景: ${successCount}`);
  console.log(`  通过率: ${((successCount / totalCount) * 100).toFixed(1)}%`);
  
  if (successCount === totalCount) {
    console.log('\n  ✓ 所有失败场景都正确捕获！');
  } else {
    console.log(`\n  ✗ 有 ${totalCount - successCount} 个场景未正确处理`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('  失败路径演示完成！');
  console.log('='.repeat(60));
  console.log('\n');
}

if (require.main === module) {
  runFailureScenarios().catch(console.error);
}

module.exports = { runFailureScenarios };
