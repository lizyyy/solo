const fs = require('fs');
const path = require('path');

const RULES = {
  PARTIAL_REFUND: 'partial_refund',
  MISSING_ATTACHMENT: 'missing_attachment',
  TAX_RATE_MISMATCH: 'tax_rate_mismatch',
  INVOICE_AMOUNT_EXCEEDED: 'invoice_amount_exceeded',
  EXPIRED_INVOICE: 'expired_invoice',
  INVALID_INVOICE_NUMBER: 'invalid_invoice_number'
};

const RULE_DESCRIPTIONS = {
  [RULES.PARTIAL_REFUND]: '部分退款金额超过原发票金额的80%',
  [RULES.MISSING_ATTACHMENT]: '缺少必要的红冲证明材料',
  [RULES.TAX_RATE_MISMATCH]: '红冲税率与原发票税率不符',
  [RULES.INVOICE_AMOUNT_EXCEEDED]: '红冲金额超过原发票剩余可冲金额',
  [RULES.EXPIRED_INVOICE]: '发票已超过红冲有效期（360天）',
  [RULES.INVALID_INVOICE_NUMBER]: '发票号码格式无效'
};

class PreauditEngine {
  constructor(options = {}) {
    this.rules = options.rules || Object.values(RULES);
    this.partialRefundThreshold = options.partialRefundThreshold || 0.8;
    this.validTaxRates = options.validTaxRates || [0.00, 0.03, 0.06, 0.09, 0.13];
    this.redFlushValidityDays = options.redFlushValidityDays || 360;
  }

  audit(invoices) {
    const results = {
      summary: {
        total: invoices.length,
        approved: 0,
        rejected: 0,
        auditDate: new Date().toISOString(),
        generatedBy: '发票红冲材料红票申请预审 CLI'
      },
      approved: [],
      rejected: [],
      ruleBreakdown: {}
    };

    Object.values(RULES).forEach(rule => {
      results.ruleBreakdown[rule] = {
        count: 0,
        description: RULE_DESCRIPTIONS[rule],
        invoices: []
      };
    });

    invoices.forEach(invoice => {
      const auditResult = this.auditSingle(invoice);
      
      if (auditResult.isApproved) {
        results.approved.push(auditResult);
        results.summary.approved++;
      } else {
        results.rejected.push(auditResult);
        results.summary.rejected++;
        
        auditResult.rejectionReasons.forEach(reason => {
          if (results.ruleBreakdown[reason.rule]) {
            results.ruleBreakdown[reason.rule].count++;
            results.ruleBreakdown[reason.rule].invoices.push({
              invoiceNumber: invoice.invoiceNumber,
              invoiceDate: invoice.invoiceDate,
              amount: invoice.amount,
              reason: reason.details
            });
          }
        });
      }
    });

    return results;
  }

  auditSingle(invoice) {
    const rejectionReasons = [];

    if (this.rules.includes(RULES.PARTIAL_REFUND)) {
      const refundCheck = this.checkPartialRefund(invoice);
      if (refundCheck) rejectionReasons.push(refundCheck);
    }

    if (this.rules.includes(RULES.MISSING_ATTACHMENT)) {
      const attachmentCheck = this.checkAttachments(invoice);
      if (attachmentCheck) rejectionReasons.push(attachmentCheck);
    }

    if (this.rules.includes(RULES.TAX_RATE_MISMATCH)) {
      const taxRateCheck = this.checkTaxRate(invoice);
      if (taxRateCheck) rejectionReasons.push(taxRateCheck);
    }

    if (this.rules.includes(RULES.INVOICE_AMOUNT_EXCEEDED)) {
      const amountCheck = this.checkInvoiceAmount(invoice);
      if (amountCheck) rejectionReasons.push(amountCheck);
    }

    if (this.rules.includes(RULES.EXPIRED_INVOICE)) {
      const expiredCheck = this.checkExpiredInvoice(invoice);
      if (expiredCheck) rejectionReasons.push(expiredCheck);
    }

    if (this.rules.includes(RULES.INVALID_INVOICE_NUMBER)) {
      const numberCheck = this.checkInvoiceNumber(invoice);
      if (numberCheck) rejectionReasons.push(numberCheck);
    }

    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      originalInvoiceNumber: invoice.originalInvoiceNumber,
      buyerName: invoice.buyerName,
      sellerName: invoice.sellerName,
      amount: invoice.amount,
      taxAmount: invoice.taxAmount,
      taxRate: invoice.taxRate,
      isApproved: rejectionReasons.length === 0,
      rejectionReasons: rejectionReasons,
      redFlushType: invoice.redFlushType,
      refundType: invoice.refundType
    };
  }

  checkPartialRefund(invoice) {
    if (invoice.refundType === 'partial' && invoice.originalInvoiceAmount) {
      const refundRatio = invoice.amount / invoice.originalInvoiceAmount;
      if (refundRatio > this.partialRefundThreshold) {
        return {
          rule: RULES.PARTIAL_REFUND,
          details: `部分退款金额(${invoice.amount})占原发票金额(${invoice.originalInvoiceAmount})的${(refundRatio * 100).toFixed(2)}%，超过阈值${(this.partialRefundThreshold * 100)}%`
        };
      }
    }
    return null;
  }

  checkAttachments(invoice) {
    const requiredAttachments = ['red_flush_agreement', 'proof_of_return'];
    if (invoice.refundType === 'partial') {
      requiredAttachments.push('partial_refund_agreement');
    }
    
    const missing = requiredAttachments.filter(att => 
      !invoice.attachments || !invoice.attachments.includes(att)
    );
    
    if (missing.length > 0) {
      return {
        rule: RULES.MISSING_ATTACHMENT,
        details: `缺少必要附件: ${missing.join(', ')}`
      };
    }
    return null;
  }

  checkTaxRate(invoice) {
    if (invoice.originalTaxRate !== undefined && invoice.taxRate !== invoice.originalTaxRate) {
      return {
        rule: RULES.TAX_RATE_MISMATCH,
        details: `红冲税率(${invoice.taxRate})与原发票税率(${invoice.originalTaxRate})不符`
      };
    }
    return null;
  }

  checkInvoiceAmount(invoice) {
    if (invoice.remainingAmount !== undefined && invoice.amount > invoice.remainingAmount) {
      return {
        rule: RULES.INVOICE_AMOUNT_EXCEEDED,
        details: `红冲金额(${invoice.amount})超过剩余可冲金额(${invoice.remainingAmount})`
      };
    }
    return null;
  }

  checkExpiredInvoice(invoice) {
    const invoiceDate = new Date(invoice.invoiceDate);
    const today = new Date();
    const diffDays = Math.floor((today - invoiceDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays > this.redFlushValidityDays) {
      return {
        rule: RULES.EXPIRED_INVOICE,
        details: `发票开具日期距今${diffDays}天，超过红冲有效期${this.redFlushValidityDays}天`
      };
    }
    return null;
  }

  checkInvoiceNumber(invoice) {
    const invoiceNumberRegex = /^[0-9]{12,20}$/;
    if (!invoiceNumberRegex.test(invoice.invoiceNumber)) {
      return {
        rule: RULES.INVALID_INVOICE_NUMBER,
        details: `发票号码(${invoice.invoiceNumber})格式无效，应为12-20位数字`
      };
    }
    return null;
  }

  generateOutputFiles(results, outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const files = [];

    const summaryPath = path.join(outputDir, '00-预审汇总报告.json');
    fs.writeFileSync(summaryPath, JSON.stringify({
      toolName: '发票红冲材料红票申请预审 CLI',
      version: '1.0.0',
      auditDate: results.summary.auditDate,
      statistics: {
        totalInvoices: results.summary.total,
        approvedCount: results.summary.approved,
        rejectedCount: results.summary.rejected,
        approvalRate: `${((results.summary.approved / results.summary.total) * 100).toFixed(2)}%`
      },
      ruleStatistics: Object.entries(results.ruleBreakdown).map(([rule, data]) => ({
        ruleCode: rule,
        ruleDescription: data.description,
        violationCount: data.count
      })),
      generatedFiles: []
    }, null, 2));
    files.push({
      fileName: '00-预审汇总报告.json',
      description: '预审总体汇总报告，包含统计数据、规则违规统计和生成文件清单',
      path: summaryPath
    });

    const approvedPath = path.join(outputDir, '01-可红冲发票清单.json');
    fs.writeFileSync(approvedPath, JSON.stringify({
      listName: '可红冲发票清单',
      description: '通过预审、可以进行红冲操作的发票列表',
      count: results.approved.length,
      invoices: results.approved.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        originalInvoiceNumber: inv.originalInvoiceNumber,
        buyerName: inv.buyerName,
        sellerName: inv.sellerName,
        amount: inv.amount,
        taxAmount: inv.taxAmount,
        taxRate: inv.taxRate,
        redFlushType: inv.redFlushType,
        refundType: inv.refundType,
        status: 'approved',
        statusDescription: '预审通过，可红冲'
      }))
    }, null, 2));
    files.push({
      fileName: '01-可红冲发票清单.json',
      description: '通过预审的发票清单，包含详细发票信息和红冲类型',
      path: approvedPath
    });

    const rejectedPath = path.join(outputDir, '02-驳回发票清单.json');
    fs.writeFileSync(rejectedPath, JSON.stringify({
      listName: '驳回发票清单',
      description: '预审未通过、需要修改或补充材料的发票列表',
      count: results.rejected.length,
      invoices: results.rejected.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        originalInvoiceNumber: inv.originalInvoiceNumber,
        buyerName: inv.buyerName,
        sellerName: inv.sellerName,
        amount: inv.amount,
        redFlushType: inv.redFlushType,
        refundType: inv.refundType,
        status: 'rejected',
        statusDescription: '预审驳回，不可红冲',
        rejectionReasons: inv.rejectionReasons.map(r => ({
          rule: r.rule,
          ruleDescription: RULE_DESCRIPTIONS[r.rule],
          details: r.details
        }))
      }))
    }, null, 2));
    files.push({
      fileName: '02-驳回发票清单.json',
      description: '预审驳回的发票清单，包含详细的驳回原因和违规规则说明',
      path: rejectedPath
    });

    Object.entries(results.ruleBreakdown).forEach(([rule, data], index) => {
      if (data.count > 0) {
        const rulePath = path.join(outputDir, `03-${index + 1}-${rule}-违规明细.json`);
        fs.writeFileSync(rulePath, JSON.stringify({
          ruleCode: rule,
          ruleDescription: data.description,
          violationCount: data.count,
          description: `触发"${data.description}"规则的发票明细`,
          invoices: data.invoices
        }, null, 2));
        files.push({
          fileName: `03-${index + 1}-${rule}-违规明细.json`,
          description: `触发"${data.description}"规则的发票详细清单`,
          path: rulePath
        });
      }
    });

    const summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    summaryData.generatedFiles = files;
    fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));

    return { files, summaryPath };
  }
}

module.exports = {
  PreauditEngine,
  RULES,
  RULE_DESCRIPTIONS
};
