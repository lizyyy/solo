const { v4: uuidv4 } = require('uuid');
const { getQuery, allQuery, runQuery } = require('../database');

function generateIdempotentKey(invoiceId, poId, supplierId, amount, tax) {
  const key = `${invoiceId}:${poId || 'none'}:${supplierId}:${amount.toFixed(2)}:${tax.toFixed(2)}`;
  return Buffer.from(key).toString('base64');
}

async function calculateDeductibleAmount(poId, supplierId) {
  const receipts = await allQuery(
    'SELECT SUM(total_amount) as total, SUM(tax_amount) as tax FROM receipts WHERE po_id = ? AND supplier_id = ? AND status = ?',
    [poId, supplierId, 'confirmed']
  );
  
  const returns = await allQuery(
    'SELECT SUM(total_amount) as total, SUM(tax_amount) as tax FROM returns WHERE po_id = ? AND supplier_id = ? AND status = ?',
    [poId, supplierId, 'confirmed']
  );

  const prepayments = await allQuery(
    'SELECT SUM(amount) as total FROM prepayments WHERE po_id = ? AND supplier_id = ? AND status = ?',
    [poId, supplierId, 'active']
  );

  const usedDeductions = await allQuery(
    'SELECT SUM(deduction_amount) as total, SUM(deduction_tax) as tax FROM deductions WHERE po_id = ? AND supplier_id = ? AND status = ?',
    [poId, supplierId, 'confirmed']
  );

  const receiptTotal = receipts[0]?.total || 0;
  const receiptTax = receipts[0]?.tax || 0;
  const returnTotal = returns[0]?.total || 0;
  const returnTax = returns[0]?.tax || 0;
  const prepaymentTotal = prepayments[0]?.total || 0;
  const usedTotal = usedDeductions[0]?.total || 0;
  const usedTax = usedDeductions[0]?.tax || 0;

  const netAmount = receiptTotal - returnTotal - prepaymentTotal - usedTotal;
  const netTax = receiptTax - returnTax - usedTax;

  return {
    receiptTotal,
    receiptTax,
    returnTotal,
    returnTax,
    prepaymentTotal,
    usedTotal,
    usedTax,
    deductibleAmount: Math.max(0, netAmount),
    deductibleTax: Math.max(0, netTax),
    totalDeductible: Math.max(0, netAmount + netTax)
  };
}

async function validateInvoiceDeduction(invoiceId, poId, supplierId) {
  const issues = [];
  const warnings = [];

  const invoice = await getQuery('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) {
    issues.push({ code: 'INVOICE_NOT_FOUND', message: '发票不存在' });
    return { valid: false, issues, warnings };
  }

  if (invoice.status === 'fully_deducted') {
    issues.push({ code: 'INVOICE_FULLY_DEDUCTED', message: '该发票已全额抵扣，不能重复核销' });
    return { valid: false, issues, warnings, invoice };
  }

  if (invoice.status === 'void') {
    issues.push({ code: 'INVOICE_VOID', message: '该发票已作废' });
    return { valid: false, issues, warnings, invoice };
  }

  const existingDeductions = await allQuery(
    'SELECT * FROM deductions WHERE invoice_id = ? AND status = ?',
    [invoiceId, 'confirmed']
  );
  
  const deductedAmount = existingDeductions.reduce((sum, d) => sum + d.deduction_amount, 0);
  const deductedTax = existingDeductions.reduce((sum, d) => sum + d.deduction_tax, 0);
  const remainingInvoiceAmount = invoice.total_amount - deductedAmount;
  const remainingInvoiceTax = invoice.tax_amount - deductedTax;

  if (poId) {
    const po = await getQuery('SELECT * FROM purchase_orders WHERE id = ?', [poId]);
    if (po) {
      if (Math.abs(po.tax_rate - invoice.tax_rate) > 0.001) {
        warnings.push({ 
          code: 'TAX_RATE_MISMATCH', 
          message: `税率不一致：采购单税率 ${(po.tax_rate * 100).toFixed(2)}%，发票税率 ${(invoice.tax_rate * 100).toFixed(2)}%` 
        });
      }
    }

    const deductible = await calculateDeductibleAmount(poId, supplierId);

    if (remainingInvoiceAmount > deductible.deductibleAmount) {
      warnings.push({ 
        code: 'EXCEEDS_DEDUCTIBLE_AMOUNT_WARNING', 
        message: `发票剩余金额超过可抵扣余额。可抵扣金额：${deductible.deductibleAmount.toFixed(2)}，发票剩余可抵扣金额：${remainingInvoiceAmount.toFixed(2)}` 
      });
    }

    if (deductible.returnTotal > 0) {
      warnings.push({ 
        code: 'RETURN_EXISTS', 
        message: `存在退货记录，退货金额 ${deductible.returnTotal.toFixed(2)}，已在可抵扣金额中扣除` 
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    invoice,
    remainingInvoiceAmount,
    remainingInvoiceTax,
    deductedAmount,
    deductedTax
  };
}

async function createDeduction(invoiceId, poId, supplierId, amount, tax, operator = 'system', idempotentKey = null) {
  const finalIdempotentKey = idempotentKey || generateIdempotentKey(invoiceId, poId, supplierId, amount, tax);

  const existingDeduction = await getQuery(
    'SELECT * FROM deductions WHERE idempotent_key = ?',
    [finalIdempotentKey]
  );
  
  if (existingDeduction) {
    await logDeductionAction(existingDeduction.id, invoiceId, 'duplicate_submit', amount, `检测到重复提交，已返回已有抵扣记录`, operator);
    return {
      success: true,
      isDuplicate: true,
      message: '检测到重复提交，返回已存在的抵扣记录',
      deduction: existingDeduction,
      warnings: []
    };
  }

  const validation = await validateInvoiceDeduction(invoiceId, poId, supplierId);
  const { invoice, remainingInvoiceAmount, remainingInvoiceTax, deductedAmount, deductedTax } = validation;

  if (!validation.valid) {
    await logDeductionAction(null, invoiceId, 'validation_failed', amount, JSON.stringify(validation.issues), operator);
    return { success: false, ...validation };
  }

  if (invoice.status === 'fully_deducted') {
    await logDeductionAction(null, invoiceId, 'validation_failed', amount, JSON.stringify([{code: 'INVOICE_FULLY_DEDUCTED', message:'该发票已全额抵扣，不能重复核销'}]), operator);
    return { success: false, ...validation, issues: [{code: 'INVOICE_FULLY_DEDUCTED', message:'该发票已全额抵扣，不能重复核销'}] };
  }

  const actualAmount = Math.min(amount, remainingInvoiceAmount);
  const actualTax = Math.min(tax, remainingInvoiceTax);

  if (actualAmount <= 0) {
    await logDeductionAction(null, invoiceId, 'validation_failed', amount, '抵扣金额必须大于0', operator);
    return { success: false, message: '抵扣金额必须大于0', ...validation };
  }

  if (poId) {
    const deductible = await calculateDeductibleAmount(poId, supplierId);
    if (actualAmount > deductible.deductibleAmount) {
      await logDeductionAction(null, invoiceId, 'validation_failed', actualAmount, JSON.stringify([{code: 'EXCEEDS_DEDUCTIBLE_AMOUNT', message:`抵扣金额超过可抵扣金额。可抵扣金额：${deductible.deductibleAmount.toFixed(2)}，本次抵扣：${actualAmount.toFixed(2)}`}]), operator);
      return { success: false, ...validation, issues: [{code: 'EXCEEDS_DEDUCTIBLE_AMOUNT', message:`抵扣金额超过可抵扣金额。可抵扣金额：${deductible.deductibleAmount.toFixed(2)}，本次抵扣：${actualAmount.toFixed(2)}`}] };
    }
  }

  const deductionId = uuidv4();
  const deductionNumber = `DED-${Date.now()}`;

  try {
    await runQuery(
      `INSERT INTO deductions (id, deduction_number, invoice_id, po_id, supplier_id, deduction_amount, deduction_tax, deduction_type, status, idempotent_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [deductionId, deductionNumber, invoiceId, poId, supplierId, actualAmount, actualTax, 'normal', 'confirmed', finalIdempotentKey]
    );
  } catch (err) {
    if (err.message.includes('UNIQUE') && err.message.includes('idempotent_key')) {
      const raceDeduction = await getQuery('SELECT * FROM deductions WHERE idempotent_key = ?', [finalIdempotentKey]);
      if (raceDeduction) {
        await logDeductionAction(raceDeduction.id, invoiceId, 'race_condition_detected', amount, `检测到并发重复提交`, operator);
        return {
          success: true,
          isDuplicate: true,
          message: '检测到并发重复提交，返回已存在的抵扣记录',
          deduction: raceDeduction,
          warnings: []
        };
      }
    }
    throw err;
  }

  const newDeductedAmount = deductedAmount + actualAmount;
  const newDeductedTax = deductedTax + actualTax;
  let newStatus = invoice.status;

  if (Math.abs(newDeductedAmount - invoice.total_amount) < 0.01 && 
      Math.abs(newDeductedTax - invoice.tax_amount) < 0.01) {
    newStatus = 'fully_deducted';
  } else if (newDeductedAmount > 0 && invoice.status === 'pending') {
    newStatus = 'partially_deducted';
  }

  await runQuery(
    'UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStatus, invoiceId]
  );

  await logDeductionAction(deductionId, invoiceId, 'create', actualAmount, `抵扣成功，金额：${actualAmount.toFixed(2)}，税额：${actualTax.toFixed(2)}，发票状态更新为：${newStatus}`, operator);

  const deduction = await getQuery('SELECT * FROM deductions WHERE id = ?', [deductionId]);
  
  return {
    success: true,
    isDuplicate: false,
    deduction,
    invoiceStatus: newStatus,
    warnings: validation.warnings
  };
}

async function logDeductionAction(deductionId, invoiceId, action, amount, message, operator) {
  const logId = uuidv4();
  try {
    await runQuery(
      `INSERT INTO deduction_logs (id, deduction_id, invoice_id, action, amount, message, operator)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [logId, deductionId, invoiceId, action, amount, message, operator]
    );
  } catch (err) {
    console.error('写入抵扣日志失败:', err);
  }
}

async function getInvoiceDeductionHistory(invoiceId) {
  const deductions = await allQuery(
    'SELECT * FROM deductions WHERE invoice_id = ? ORDER BY created_at DESC',
    [invoiceId]
  );
  
  const logs = await allQuery(
    'SELECT * FROM deduction_logs WHERE invoice_id = ? ORDER BY created_at DESC',
    [invoiceId]
  );

  return { deductions, logs };
}

async function getDeductionDifferences(invoiceId, poId, supplierId) {
  const invoice = await getQuery('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) return { error: '发票不存在' };

  const deductible = await calculateDeductibleAmount(poId, supplierId);
  const validation = await validateInvoiceDeduction(invoiceId, poId, supplierId);

  return {
    invoice: {
      number: invoice.invoice_number,
      totalAmount: invoice.total_amount,
      taxAmount: invoice.tax_amount,
      status: invoice.status
    },
    deductible,
    issues: validation.issues,
    warnings: validation.warnings,
    remainingInvoiceAmount: validation.remainingInvoiceAmount,
    remainingInvoiceTax: validation.remainingInvoiceTax,
    difference: {
      amount: invoice.total_amount - deductible.deductibleAmount - validation.deductedAmount,
      tax: invoice.tax_amount - deductible.deductibleTax - validation.deductedTax
    }
  };
}

module.exports = {
  calculateDeductibleAmount,
  validateInvoiceDeduction,
  createDeduction,
  getInvoiceDeductionHistory,
  getDeductionDifferences,
  logDeductionAction,
  generateIdempotentKey
};
