export class BillValidator {
  constructor(options = {}) {
    this.options = {
      minAttachmentPages: 1,
      ...options
    };
    this.errors = [];
    this.warnings = [];
  }

  validate(bills) {
    this.errors = [];
    this.warnings = [];
    const results = [];

    const billMap = new Map();
    bills.forEach(bill => {
      billMap.set(bill.billNumber, bill);
    });

    for (const bill of bills) {
      const billResult = this.validateSingleBill(bill, billMap);
      results.push(billResult);
    }

    return {
      results,
      summary: this.generateSummary(results),
      errors: this.errors,
      warnings: this.warnings
    };
  }

  validateSingleBill(bill, billMap) {
    const issues = [];
    
    issues.push(...this.validateRed冲Bill(bill, billMap));
    issues.push(...this.validateAttachmentPages(bill));
    issues.push(...this.validateBasicInfo(bill));
    issues.push(...this.validateAmount(bill));

    const hasErrors = issues.some(i => i.level === 'error');
    const hasWarnings = issues.some(i => i.level === 'warning');

    return {
      bill,
      issues,
      isValid: !hasErrors,
      status: hasErrors ? '不通过' : hasWarnings ? '有警告' : '通过'
    };
  }

  validateRed冲Bill(bill, billMap) {
    const issues = [];

    if (bill.isRed冲) {
      if (!bill.relatedBillId) {
        issues.push({
          type: '红冲校验',
          level: 'error',
          message: '红冲票据必须关联原票据号',
          field: 'relatedBillId'
        });
        this.errors.push({ billNumber: bill.billNumber, message: '红冲票据必须关联原票据号' });
      } else {
        const relatedBill = billMap.get(bill.relatedBillId);
        if (!relatedBill) {
          issues.push({
            type: '红冲校验',
            level: 'warning',
            message: `关联票据 ${bill.relatedBillId} 未在当前批次中找到`,
            field: 'relatedBillId'
          });
          this.warnings.push({ billNumber: bill.billNumber, message: `关联票据 ${bill.relatedBillId} 未在当前批次中找到` });
        } else if (relatedBill.isRed冲) {
          issues.push({
            type: '红冲校验',
            level: 'error',
            message: '不能对已红冲的票据再次红冲',
            field: 'relatedBillId'
          });
          this.errors.push({ billNumber: bill.billNumber, message: '不能对已红冲的票据再次红冲' });
        }
      }

      if (bill.amount >= 0) {
        issues.push({
          type: '红冲校验',
          level: 'error',
          message: '红冲票据金额应为负数',
          field: 'amount'
        });
        this.errors.push({ billNumber: bill.billNumber, message: '红冲票据金额应为负数' });
      }
    }

    return issues;
  }

  validateAttachmentPages(bill) {
    const issues = [];

    if (bill.attachmentCount > 0 && bill.attachmentPages < this.options.minAttachmentPages) {
      issues.push({
        type: '附件缺页校验',
        level: 'error',
        message: `附件数量为 ${bill.attachmentCount} 但页数不足 ${this.options.minAttachmentPages} 页`,
        field: 'attachmentPages'
      });
      this.errors.push({ billNumber: bill.billNumber, message: `附件页数不足，应为至少 ${this.options.minAttachmentPages} 页` });
    }

    if (bill.attachmentPages > 0 && bill.attachmentCount === 0) {
      issues.push({
        type: '附件缺页校验',
        level: 'warning',
        message: '有附件页数但附件数量为0',
        field: 'attachmentCount'
      });
      this.warnings.push({ billNumber: bill.billNumber, message: '有附件页数但附件数量为0' });
    }

    return issues;
  }

  validateBasicInfo(bill) {
    const issues = [];
    const requiredFields = ['billNumber', 'billDate', 'payer', 'payee', 'projectName', 'communityName'];

    for (const field of requiredFields) {
      if (!bill[field]) {
        issues.push({
          type: '基础信息校验',
          level: 'error',
          message: `缺少必填字段: ${field}`,
          field
        });
        this.errors.push({ billNumber: bill.billNumber || bill.billId, message: `缺少必填字段: ${field}` });
      }
    }

    return issues;
  }

  validateAmount(bill) {
    const issues = [];

    if (bill.amount === 0 && !bill.isRed冲) {
      issues.push({
        type: '金额校验',
        level: 'warning',
        message: '票据金额为0',
        field: 'amount'
      });
      this.warnings.push({ billNumber: bill.billNumber, message: '票据金额为0' });
    }

    if (bill.amount < 0 && !bill.isRed冲) {
      issues.push({
        type: '金额校验',
        level: 'error',
        message: '非红冲票据金额不能为负数',
        field: 'amount'
      });
      this.errors.push({ billNumber: bill.billNumber, message: '非红冲票据金额不能为负数' });
    }

    return issues;
  }

  generateSummary(results) {
    const total = results.length;
    const passed = results.filter(r => r.status === '通过').length;
    const warning = results.filter(r => r.status === '有警告').length;
    const failed = results.filter(r => r.status === '不通过').length;
    const red冲Count = results.filter(r => r.bill.isRed冲).length;
    const totalAmount = results.reduce((sum, r) => sum + r.bill.amount, 0);

    return {
      total,
      passed,
      warning,
      failed,
      red冲Count,
      totalAmount,
      passRate: total > 0 ? ((passed / total) * 100).toFixed(2) : 0
    };
  }
}

export default BillValidator;
