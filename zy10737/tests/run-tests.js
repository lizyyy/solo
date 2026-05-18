#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { PreauditEngine, RULES, RULE_DESCRIPTIONS } = require('../src/preaudit-engine');

const chalk = {
  green: (t) => `\x1b[32m${t}\x1b[0m`,
  red: (t) => `\x1b[31m${t}\x1b[0m`,
  yellow: (t) => `\x1b[33m${t}\x1b[0m`,
  cyan: (t) => `\x1b[36m${t}\x1b[0m`,
  bold: (t) => `\x1b[1m${t}\x1b[0m`
};

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(chalk.green(`  ✓ ${name}`));
    passed++;
  } catch (error) {
    console.log(chalk.red(`  ✗ ${name}`));
    console.log(chalk.red(`    ${error.message}`));
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function runTests() {
  console.log(chalk.cyan('═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('        发票红冲材料红票申请预审 - 自动化测试          '));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  const engine = new PreauditEngine();

  console.log(chalk.bold('📋 测试 1: 核心业务逻辑 - 规则引擎'));
  console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  test('正常发票应该通过预审', () => {
    const invoice = {
      invoiceNumber: '44032311301234567890',
      invoiceDate: '2026-03-01',
      originalInvoiceNumber: '44032311301111111111',
      buyerName: '深圳XX科技有限公司',
      sellerName: '广州YY贸易有限公司',
      amount: 10000.00,
      taxAmount: 1300.00,
      taxRate: 0.13,
      originalTaxRate: 0.13,
      redFlushType: 'full',
      refundType: 'full',
      originalInvoiceAmount: 10000.00,
      remainingAmount: 10000.00,
      attachments: ['red_flush_agreement', 'proof_of_return']
    };
    const result = engine.auditSingle(invoice);
    assert(result.isApproved === true, '正常发票应该通过预审');
    assert(result.rejectionReasons.length === 0, '不应该有驳回原因');
  });

  test('部分退款超过阈值应该被驳回', () => {
    const invoice = {
      invoiceNumber: '44032311301234567890',
      invoiceDate: '2026-03-01',
      originalInvoiceNumber: '44032311301111111111',
      buyerName: '深圳XX科技有限公司',
      sellerName: '广州YY贸易有限公司',
      amount: 9000.00,
      taxAmount: 1170.00,
      taxRate: 0.13,
      originalTaxRate: 0.13,
      redFlushType: 'partial',
      refundType: 'partial',
      originalInvoiceAmount: 10000.00,
      remainingAmount: 10000.00,
      attachments: ['red_flush_agreement', 'proof_of_return', 'partial_refund_agreement']
    };
    const result = engine.auditSingle(invoice);
    assert(result.isApproved === false, '超过阈值的部分退款应该被驳回');
    assert(result.rejectionReasons.some(r => r.rule === RULES.PARTIAL_REFUND), '应该包含 partial_refund 驳回原因');
  });

  test('缺少附件应该被驳回', () => {
    const invoice = {
      invoiceNumber: '44032311301234567890',
      invoiceDate: '2026-03-01',
      originalInvoiceNumber: '44032311301111111111',
      buyerName: '深圳XX科技有限公司',
      sellerName: '广州YY贸易有限公司',
      amount: 10000.00,
      taxAmount: 1300.00,
      taxRate: 0.13,
      originalTaxRate: 0.13,
      redFlushType: 'full',
      refundType: 'full',
      originalInvoiceAmount: 10000.00,
      remainingAmount: 10000.00,
      attachments: ['red_flush_agreement']
    };
    const result = engine.auditSingle(invoice);
    assert(result.isApproved === false, '缺少附件应该被驳回');
    assert(result.rejectionReasons.some(r => r.rule === RULES.MISSING_ATTACHMENT), '应该包含 missing_attachment 驳回原因');
  });

  test('税率不符应该被驳回', () => {
    const invoice = {
      invoiceNumber: '44032311301234567890',
      invoiceDate: '2026-03-01',
      originalInvoiceNumber: '44032311301111111111',
      buyerName: '深圳XX科技有限公司',
      sellerName: '广州YY贸易有限公司',
      amount: 10000.00,
      taxAmount: 1300.00,
      taxRate: 0.13,
      originalTaxRate: 0.09,
      redFlushType: 'full',
      refundType: 'full',
      originalInvoiceAmount: 10000.00,
      remainingAmount: 10000.00,
      attachments: ['red_flush_agreement', 'proof_of_return']
    };
    const result = engine.auditSingle(invoice);
    assert(result.isApproved === false, '税率不符应该被驳回');
    assert(result.rejectionReasons.some(r => r.rule === RULES.TAX_RATE_MISMATCH), '应该包含 tax_rate_mismatch 驳回原因');
  });

  test('红冲金额超过剩余金额应该被驳回', () => {
    const invoice = {
      invoiceNumber: '44032311301234567890',
      invoiceDate: '2026-03-01',
      originalInvoiceNumber: '44032311301111111111',
      buyerName: '深圳XX科技有限公司',
      sellerName: '广州YY贸易有限公司',
      amount: 15000.00,
      taxAmount: 1950.00,
      taxRate: 0.13,
      originalTaxRate: 0.13,
      redFlushType: 'full',
      refundType: 'full',
      originalInvoiceAmount: 15000.00,
      remainingAmount: 10000.00,
      attachments: ['red_flush_agreement', 'proof_of_return']
    };
    const result = engine.auditSingle(invoice);
    assert(result.isApproved === false, '红冲金额超过剩余金额应该被驳回');
    assert(result.rejectionReasons.some(r => r.rule === RULES.INVOICE_AMOUNT_EXCEEDED), '应该包含 invoice_amount_exceeded 驳回原因');
  });

  test('发票号码格式无效应该被驳回', () => {
    const invoice = {
      invoiceNumber: 'INV-12345',
      invoiceDate: '2026-03-01',
      originalInvoiceNumber: '44032311301111111111',
      buyerName: '深圳XX科技有限公司',
      sellerName: '广州YY贸易有限公司',
      amount: 10000.00,
      taxAmount: 1300.00,
      taxRate: 0.13,
      originalTaxRate: 0.13,
      redFlushType: 'full',
      refundType: 'full',
      originalInvoiceAmount: 10000.00,
      remainingAmount: 10000.00,
      attachments: ['red_flush_agreement', 'proof_of_return']
    };
    const result = engine.auditSingle(invoice);
    assert(result.isApproved === false, '发票号码格式无效应该被驳回');
    assert(result.rejectionReasons.some(r => r.rule === RULES.INVALID_INVOICE_NUMBER), '应该包含 invalid_invoice_number 驳回原因');
  });

  console.log('\n' + chalk.bold('📋 测试 2: 批量预审功能'));
  console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  test('批量预审应该返回正确的统计数据', () => {
    const invoices = [
      {
        invoiceNumber: '44032311301234567890',
        invoiceDate: '2026-03-01',
        originalInvoiceNumber: '44032311301111111111',
        buyerName: '深圳XX科技有限公司',
        sellerName: '广州YY贸易有限公司',
        amount: 10000.00,
        taxAmount: 1300.00,
        taxRate: 0.13,
        originalTaxRate: 0.13,
        redFlushType: 'full',
        refundType: 'full',
        originalInvoiceAmount: 10000.00,
        remainingAmount: 10000.00,
        attachments: ['red_flush_agreement', 'proof_of_return']
      },
      {
        invoiceNumber: 'INV-12345',
        invoiceDate: '2026-03-01',
        originalInvoiceNumber: '44032311301111111111',
        buyerName: '深圳XX科技有限公司',
        sellerName: '广州YY贸易有限公司',
        amount: 10000.00,
        taxAmount: 1300.00,
        taxRate: 0.13,
        originalTaxRate: 0.13,
        redFlushType: 'full',
        refundType: 'full',
        originalInvoiceAmount: 10000.00,
        remainingAmount: 10000.00,
        attachments: ['red_flush_agreement']
      }
    ];
    const result = engine.audit(invoices);
    assert(result.summary.total === 2, '总发票数应该是 2');
    assert(result.summary.approved === 1, '通过数应该是 1');
    assert(result.summary.rejected === 1, '驳回数应该是 1');
    assert(result.approved.length === 1, '可红冲列表应该有 1 张');
    assert(result.rejected.length === 1, '驳回列表应该有 1 张');
  });

  console.log('\n' + chalk.bold('📋 测试 3: 输出文件生成'));
  console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  test('应该生成所有必要的输出文件', () => {
    const invoices = [
      {
        invoiceNumber: '44032311301234567890',
        invoiceDate: '2026-03-01',
        originalInvoiceNumber: '44032311301111111111',
        buyerName: '深圳XX科技有限公司',
        sellerName: '广州YY贸易有限公司',
        amount: 10000.00,
        taxAmount: 1300.00,
        taxRate: 0.13,
        originalTaxRate: 0.13,
        redFlushType: 'full',
        refundType: 'full',
        originalInvoiceAmount: 10000.00,
        remainingAmount: 10000.00,
        attachments: ['red_flush_agreement', 'proof_of_return']
      },
      {
        invoiceNumber: 'INV-12345',
        invoiceDate: '2026-03-01',
        originalInvoiceNumber: '44032311301111111111',
        buyerName: '深圳XX科技有限公司',
        sellerName: '广州YY贸易有限公司',
        amount: 10000.00,
        taxAmount: 1300.00,
        taxRate: 0.13,
        originalTaxRate: 0.13,
        redFlushType: 'full',
        refundType: 'full',
        originalInvoiceAmount: 10000.00,
        remainingAmount: 10000.00,
        attachments: ['red_flush_agreement']
      }
    ];
    const result = engine.audit(invoices);
    const outputDir = path.join(__dirname, '../output/test-output');
    const { files } = engine.generateOutputFiles(result, outputDir);

    assert(files.length >= 3, '应该至少生成 3 个文件');
    
    const summaryFile = files.find(f => f.fileName === '00-预审汇总报告.json');
    assert(summaryFile, '应该生成汇总报告文件');

    const approvedFile = files.find(f => f.fileName === '01-可红冲发票清单.json');
    assert(approvedFile, '应该生成可红冲清单文件');

    const rejectedFile = files.find(f => f.fileName === '02-驳回发票清单.json');
    assert(rejectedFile, '应该生成驳回清单文件');

    const summaryContent = JSON.parse(fs.readFileSync(summaryFile.path, 'utf8'));
    assert(summaryContent.toolName === '发票红冲材料红票申请预审 CLI', '工具名称应该正确');
    assert(summaryContent.statistics.totalInvoices === 2, '汇总统计应该正确');
  });

  console.log('\n' + chalk.bold('📋 测试 4: CLI 命令'));
  console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  test('CLI 应该能正确处理正常路径样例', () => {
    const inputPath = path.join(__dirname, '../samples/normal-case/invoices.json');
    const outputDir = path.join(__dirname, '../output/cli-normal');
    
    const result = execSync(
      `node ${path.join(__dirname, '../src/cli.js')} run --input ${inputPath} --output ${outputDir} --format json`,
      { encoding: 'utf8' }
    );
    
    const jsonResult = JSON.parse(result);
    assert(jsonResult.toolName === '发票红冲材料红票申请预审 CLI', '工具名称应该正确');
    assert(jsonResult.summary.totalInvoices === 3, '总发票数应该是 3');
    assert(jsonResult.summary.approvedCount === 3, '正常路径应该全部通过');
    assert(jsonResult.summary.rejectedCount === 0, '正常路径不应该有驳回');
  });

  test('CLI 应该能正确处理异常路径样例', () => {
    const inputPath = path.join(__dirname, '../samples/error-case/invoices.json');
    const outputDir = path.join(__dirname, '../output/cli-error');
    
    const result = execSync(
      `node ${path.join(__dirname, '../src/cli.js')} run --input ${inputPath} --output ${outputDir} --format json`,
      { encoding: 'utf8' }
    );
    
    const jsonResult = JSON.parse(result);
    assert(jsonResult.toolName === '发票红冲材料红票申请预审 CLI', '工具名称应该正确');
    assert(jsonResult.summary.totalInvoices === 6, '总发票数应该是 6');
    assert(jsonResult.summary.rejectedCount > 0, '异常路径应该有驳回');
  });

  test('CLI list-rules 命令应该能列出所有规则', () => {
    const result = execSync(
      `node ${path.join(__dirname, '../src/cli.js')} list-rules`,
      { encoding: 'utf8' }
    );
    
    assert(result.includes('partial_refund'), '应该包含 partial_refund 规则');
    assert(result.includes('missing_attachment'), '应该包含 missing_attachment 规则');
    assert(result.includes('tax_rate_mismatch'), '应该包含 tax_rate_mismatch 规则');
  });

  console.log('\n' + chalk.cyan('═══════════════════════════════════════════════════'));
  console.log(chalk.bold('                    测试结果汇总                    '));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));
  console.log(chalk.green(`  通过: ${passed}`));
  console.log(chalk.red(`  失败: ${failed}`));
  console.log(chalk.cyan(`  总计: ${passed + failed}`));
  console.log(chalk.cyan(`  通过率: ${((passed / (passed + failed)) * 100).toFixed(2)}%\n`));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
