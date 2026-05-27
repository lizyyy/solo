const crypto = require('crypto');
const { run, get, all } = require('./database');
const { calculateOverdueRent, evaluateRepairLiability, checkDuplicateDeduction, getDepositBalance, getActiveRules } = require('./rulesEngine');

function generateBatchId(fileType, contentHash) {
  return `${fileType}_${Date.now()}_${crypto.createHash('md5').update(contentHash).digest('hex').substring(0, 8)}`;
}

function generateTransactionNo() {
  return `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

async function checkBatchExists(fileType, contentHash) {
  const hash = crypto.createHash('md5').update(contentHash).digest('hex');
  const existing = await get(`
    SELECT ib.*, (SELECT COUNT(*) FROM import_results ir WHERE ir.batch_id = ib.batch_id) AS record_count
    FROM import_batches ib
    WHERE ib.file_type = ? AND ib.batch_id LIKE ?
    ORDER BY ib.created_at DESC
    LIMIT 1
  `, [fileType, `${fileType}_%_${hash.substring(0, 8)}%`]);

  return existing || null;
}

async function createBatch(batchId, fileType, fileName, totalRecords) {
  await run(`
    INSERT INTO import_batches (batch_id, file_type, file_name, total_records)
    VALUES (?, ?, ?, ?)
  `, [batchId, fileType, fileName, totalRecords]);
  return batchId;
}

async function updateBatchCounts(batchId) {
  const counts = await all(`
    SELECT
      result_status,
      COUNT(*) AS cnt
    FROM import_results
    WHERE batch_id = ?
    GROUP BY result_status
  `, [batchId]);

  const statusMap = { success: 0, pending: 0, failed: 0 };
  counts.forEach(c => {
    if (statusMap[c.result_status] !== undefined) {
      statusMap[c.result_status] = c.cnt;
    }
  });

  await run(`
    UPDATE import_batches
    SET success_count = ?, pending_count = ?, failed_count = ?
    WHERE batch_id = ?
  `, [statusMap.success, statusMap.pending, statusMap.failed, batchId]);
}

async function saveImportResult(batchId, recordType, resultStatus, recordKey, rawData, errorMessage, suggestion) {
  await run(`
    INSERT INTO import_results (batch_id, record_type, result_status, record_key, raw_data, error_message, suggestion)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [batchId, recordType, resultStatus, recordKey, JSON.stringify(rawData), errorMessage, suggestion]);
}

async function processRentalOrders(batchId, orders) {
  const rules = await getActiveRules();
  const results = { success: [], pending: [], failed: [] };

  for (const order of orders) {
    const errors = [];
    if (!order.order_no) errors.push('缺少订单号');
    if (!order.device_id) errors.push('缺少设备编号');
    if (!order.customer_name) errors.push('缺少客户姓名');
    if (!order.rental_start_date) errors.push('缺少租赁开始日期');
    if (order.daily_rent < 0) errors.push('日租金不能为负数');
    if (order.deposit_amount < 0) errors.push('押金金额不能为负数');

    if (errors.length > 0) {
      results.failed.push({
        record: order.raw,
        errors,
        suggestion: '请补充必填字段并确保金额非负后重新导入'
      });
      await saveImportResult(batchId, 'rental', 'failed', order.order_no, order.raw, errors.join('; '), '请补充必填字段并确保金额非负后重新导入');
      continue;
    }

    const existing = await get('SELECT order_no FROM rental_orders WHERE order_no = ?', [order.order_no]);
    if (existing) {
      results.pending.push({
        record: order.raw,
        reason: '订单号已存在',
        suggestion: '确认是否为同一订单的更新，如需更新请先手动处理旧数据'
      });
      await saveImportResult(batchId, 'rental', 'pending', order.order_no, order.raw, '订单号已存在', '确认是否为同一订单的更新，如需更新请先手动处理旧数据');
      continue;
    }

    try {
      await run(`
        INSERT INTO rental_orders (batch_id, order_no, device_id, customer_name, customer_phone,
          rental_start_date, rental_end_date, daily_rent, deposit_amount, status, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [batchId, order.order_no, order.device_id, order.customer_name, order.customer_phone,
        order.rental_start_date, order.rental_end_date, order.daily_rent, order.deposit_amount,
        order.status, JSON.stringify(order.raw)]);

      const depositTxnNo = generateTransactionNo();
      await run(`
        INSERT INTO deposit_transactions (transaction_no, batch_id, rental_order_no, device_id,
          transaction_type, amount, balance, reason, source_type, source_id)
        VALUES (?, ?, ?, ?, 'deposit', ?, ?, '租赁押金收取', 'rental_order', ?)
      `, [depositTxnNo, batchId, order.order_no, order.device_id,
        order.deposit_amount, order.deposit_amount, order.order_no]);

      const overdueResult = calculateOverdueRent(order, rules);
      if (overdueResult.hasOverdue && overdueResult.totalDeduction > 0) {
        const balanceInfo = await getDepositBalance(order.order_no);
        if (overdueResult.totalDeduction <= balanceInfo.balance) {
          let currentBalance = balanceInfo.balance;
          for (const ruleApp of overdueResult.appliedRules) {
            const deductTxnNo = generateTransactionNo();
            currentBalance = currentBalance - ruleApp.amount;
            await run(`
              INSERT INTO deposit_transactions (transaction_no, batch_id, rental_order_no, device_id,
                transaction_type, amount, balance, reason, rule_code, source_type, source_id)
              VALUES (?, ?, ?, ?, 'deduction', ?, ?, ?, ?, 'rental_order', ?)
            `, [deductTxnNo, batchId, order.order_no, order.device_id,
              ruleApp.amount, currentBalance,
              `逾期${overdueResult.overdueDays}天，按规则${ruleApp.rule_name}扣减`,
              ruleApp.rule_code, order.order_no]);
          }
          results.success.push({
            record: order.raw,
            message: `订单导入成功，已自动处理逾期租金扣减：${overdueResult.totalDeduction.toFixed(2)}元`,
            overdueDays: overdueResult.overdueDays,
            deductionAmount: overdueResult.totalDeduction
          });
        } else {
          results.pending.push({
            record: order.raw,
            reason: `逾期租金需扣${overdueResult.totalDeduction.toFixed(2)}元，但押金余额${balanceInfo.balance.toFixed(2)}元不足`,
            suggestion: '请联系客户补缴押金或协商处理方案'
          });
          await saveImportResult(batchId, 'rental', 'pending', order.order_no, order.raw,
            `逾期扣减金额超过押金余额`, '请联系客户补缴押金或协商处理方案');
          continue;
        }
      } else {
        results.success.push({
          record: order.raw,
          message: '订单导入成功'
        });
      }

      await saveImportResult(batchId, 'rental', 'success', order.order_no, order.raw, null, null);
    } catch (e) {
      results.failed.push({
        record: order.raw,
        errors: [e.message],
        suggestion: '系统异常，请联系技术支持'
      });
      await saveImportResult(batchId, 'rental', 'failed', order.order_no, order.raw, e.message, '系统异常，请联系技术支持');
    }
  }

  return results;
}

async function processRepairRecords(batchId, repairs) {
  const rules = await getActiveRules();
  const results = { success: [], pending: [], failed: [] };

  for (const repair of repairs) {
    const errors = [];
    if (!repair.repair_no) errors.push('缺少维修单号');
    if (!repair.device_id) errors.push('缺少设备编号');
    if (!repair.repair_date) errors.push('缺少维修日期');
    if (repair.repair_cost < 0) errors.push('维修费用不能为负数');

    if (errors.length > 0) {
      results.failed.push({
        record: repair.raw,
        errors,
        suggestion: '请补充必填字段并确保金额非负后重新导入'
      });
      await saveImportResult(batchId, 'repair', 'failed', repair.repair_no, repair.raw, errors.join('; '), '请补充必填字段并确保金额非负后重新导入');
      continue;
    }

    const existing = await get('SELECT repair_no FROM repair_records WHERE repair_no = ?', [repair.repair_no]);
    if (existing) {
      results.pending.push({
        record: repair.raw,
        reason: '维修单号已存在',
        suggestion: '确认是否为同一维修单的更新'
      });
      await saveImportResult(batchId, 'repair', 'pending', repair.repair_no, repair.raw, '维修单号已存在', '确认是否为同一维修单的更新');
      continue;
    }

    let rentalOrder = null;
    if (repair.rental_order_no) {
      rentalOrder = await get('SELECT * FROM rental_orders WHERE order_no = ?', [repair.rental_order_no]);
      if (!rentalOrder) {
        results.pending.push({
          record: repair.raw,
          reason: '关联的租赁订单不存在',
          suggestion: '请检查订单号是否正确，或先导入对应的租赁订单'
        });
        await saveImportResult(batchId, 'repair', 'pending', repair.repair_no, repair.raw,
          '关联的租赁订单不存在', '请检查订单号是否正确，或先导入对应的租赁订单');
        continue;
      }
    }

    const isDuplicateDeduction = await checkDuplicateDeduction(null, repair.repair_no, null);
    if (isDuplicateDeduction) {
      results.pending.push({
        record: repair.raw,
        reason: '该维修单号已有扣款记录，可能重复',
        suggestion: '请核实是否为重复维修记录，避免重复扣款'
      });
      await saveImportResult(batchId, 'repair', 'pending', repair.repair_no, repair.raw,
        '该维修单号已有扣款记录', '请核实是否为重复维修记录，避免重复扣款');
      continue;
    }

    try {
      await run(`
        INSERT INTO repair_records (batch_id, repair_no, device_id, rental_order_no, repair_date,
          repair_type, repair_cost, liability, description, status, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [batchId, repair.repair_no, repair.device_id, repair.rental_order_no, repair.repair_date,
        repair.repair_type, repair.repair_cost, repair.liability, repair.description,
        repair.status, JSON.stringify(repair.raw)]);

      const liabilityResult = evaluateRepairLiability(repair, rules);
      if (liabilityResult.shouldDeduct && liabilityResult.deductionAmount > 0 && repair.rental_order_no) {
        const balanceInfo = await getDepositBalance(repair.rental_order_no);
        if (liabilityResult.deductionAmount <= balanceInfo.balance) {
          const deductTxnNo = generateTransactionNo();
          await run(`
            INSERT INTO deposit_transactions (transaction_no, batch_id, rental_order_no, repair_no, device_id,
              transaction_type, amount, balance, reason, rule_code, source_type, source_id)
            VALUES (?, ?, ?, ?, ?, 'deduction', ?, ?, ?, ?, 'repair_record', ?)
          `, [deductTxnNo, batchId, repair.rental_order_no, repair.repair_no, repair.device_id,
            liabilityResult.deductionAmount, balanceInfo.balance - liabilityResult.deductionAmount,
            `维修责任扣减：${repair.repair_type || ''}`,
            liabilityResult.appliedRule?.rule_code, repair.repair_no]);

          results.success.push({
            record: repair.raw,
            message: `维修记录导入成功，已按规则${liabilityResult.appliedRule?.rule_name || ''}扣减押金：${liabilityResult.deductionAmount.toFixed(2)}元`,
            deductionAmount: liabilityResult.deductionAmount
          });
        } else {
          results.pending.push({
            record: repair.raw,
            reason: `维修责任需扣${liabilityResult.deductionAmount.toFixed(2)}元，但押金余额${balanceInfo.balance.toFixed(2)}元不足`,
            suggestion: '请联系客户补缴押金或协商处理方案'
          });
          await saveImportResult(batchId, 'repair', 'pending', repair.repair_no, repair.raw,
            `维修扣款金额超过押金余额`, '请联系客户补缴押金或协商处理方案');
          continue;
        }
      } else {
        results.success.push({
          record: repair.raw,
          message: liabilityResult.shouldDeduct ? '维修记录导入成功' : `维修记录导入成功，按规则${liabilityResult.appliedRule?.rule_name || ''}不扣减押金`,
          deductionAmount: 0
        });
      }

      await saveImportResult(batchId, 'repair', 'success', repair.repair_no, repair.raw, null, null);
    } catch (e) {
      results.failed.push({
        record: repair.raw,
        errors: [e.message],
        suggestion: '系统异常，请联系技术支持'
      });
      await saveImportResult(batchId, 'repair', 'failed', repair.repair_no, repair.raw, e.message, '系统异常，请联系技术支持');
    }
  }

  return results;
}

async function processDepositRules(batchId, rules) {
  const results = { success: [], pending: [], failed: [] };

  for (const rule of rules) {
    const errors = [];
    if (!rule.rule_code) errors.push('缺少规则编码');
    if (!rule.rule_name) errors.push('缺少规则名称');
    if (!rule.rule_type) errors.push('缺少规则类型');

    if (errors.length > 0) {
      results.failed.push({
        record: rule.raw,
        errors,
        suggestion: '请补充必填字段后重新导入'
      });
      await saveImportResult(batchId, 'deposit_rule', 'failed', rule.rule_code, rule.raw, errors.join('; '), '请补充必填字段后重新导入');
      continue;
    }

    const existing = await get('SELECT rule_code FROM deposit_rules WHERE rule_code = ?', [rule.rule_code]);
    if (existing) {
      results.pending.push({
        record: rule.raw,
        reason: '规则编码已存在',
        suggestion: '确认是否更新现有规则，或修改规则编码'
      });
      await saveImportResult(batchId, 'deposit_rule', 'pending', rule.rule_code, rule.raw, '规则编码已存在', '确认是否更新现有规则，或修改规则编码');
      continue;
    }

    try {
      await run(`
        INSERT INTO deposit_rules (batch_id, rule_code, rule_name, rule_type, condition_expr,
          deduction_amount, deduction_percent, priority, description, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [batchId, rule.rule_code, rule.rule_name, rule.rule_type, rule.condition_expr,
        rule.deduction_amount, rule.deduction_percent, rule.priority, rule.description, rule.is_active]);

      results.success.push({
        record: rule.raw,
        message: '规则导入成功'
      });
      await saveImportResult(batchId, 'deposit_rule', 'success', rule.rule_code, rule.raw, null, null);
    } catch (e) {
      results.failed.push({
        record: rule.raw,
        errors: [e.message],
        suggestion: '系统异常，请联系技术支持'
      });
      await saveImportResult(batchId, 'deposit_rule', 'failed', rule.rule_code, rule.raw, e.message, '系统异常，请联系技术支持');
    }
  }

  return results;
}

async function getBatchResult(batchId) {
  const batch = await get('SELECT * FROM import_batches WHERE batch_id = ?', [batchId]);
  if (!batch) return null;

  const results = await all(`
    SELECT * FROM import_results WHERE batch_id = ? ORDER BY result_status, id
  `, [batchId]);

  return {
    batch,
    success: results.filter(r => r.result_status === 'success').map(r => ({
      record_type: r.record_type,
      record_key: r.record_key,
      raw_data: JSON.parse(r.raw_data)
    })),
    pending: results.filter(r => r.result_status === 'pending').map(r => ({
      record_type: r.record_type,
      record_key: r.record_key,
      raw_data: JSON.parse(r.raw_data),
      reason: r.error_message,
      suggestion: r.suggestion
    })),
    failed: results.filter(r => r.result_status === 'failed').map(r => ({
      record_type: r.record_type,
      record_key: r.record_key,
      raw_data: JSON.parse(r.raw_data),
      errors: r.error_message ? r.error_message.split('; ') : [],
      suggestion: r.suggestion
    }))
  };
}

module.exports = {
  generateBatchId,
  checkBatchExists,
  createBatch,
  updateBatchCounts,
  processRentalOrders,
  processRepairRecords,
  processDepositRules,
  getBatchResult
};
