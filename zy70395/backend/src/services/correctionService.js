const { v4: uuidv4 } = require('uuid');
const db = require('../database');

function getCurrentTime() {
  return new Date().toISOString();
}

function calculateDiscount(originalAmount, rule) {
  if (!rule) return { appliedDiscount: 0, finalAmount: originalAmount };

  let appliedDiscount = 0;
  if (rule.discount_type === 'percentage') {
    appliedDiscount = originalAmount * (rule.discount_value / 100);
  } else if (rule.discount_type === 'fixed') {
    appliedDiscount = rule.discount_value;
  }

  appliedDiscount = Math.min(appliedDiscount, originalAmount);
  const finalAmount = originalAmount - appliedDiscount;

  return { appliedDiscount, finalAmount };
}

async function getAllRules() {
  return await db.allAsync(`
    SELECT * FROM discount_rules WHERE is_active = 1 ORDER BY priority DESC
  `);
}

async function getActiveVersion(billId) {
  return await db.getAsync(`
    SELECT * FROM bill_versions WHERE bill_id = ? AND is_active = 1
  `, billId);
}

async function getNextVersionNumber(billId) {
  const result = await db.getAsync(`
    SELECT MAX(version_number) as max FROM bill_versions WHERE bill_id = ?
  `, billId);
  return (result.max || 0) + 1;
}

async function checkActiveCorrection(billId) {
  return await db.getAsync(`
    SELECT id FROM correction_requests 
    WHERE bill_id = ? AND status IN ('draft', 'pending_approval')
    LIMIT 1
  `, billId);
}

async function runTransaction(callback) {
  await db.runAsync('BEGIN TRANSACTION');
  try {
    const result = await callback();
    await db.runAsync('COMMIT');
    return result;
  } catch (error) {
    await db.runAsync('ROLLBACK');
    throw error;
  }
}

async function importBills(records) {
  return await runTransaction(async () => {
    const results = { imported: 0, updated: 0, errors: [] };

    for (const record of records) {
      try {
        const customerId = record.customer_id || uuidv4();
        const existingCustomer = await db.getAsync(`
          SELECT id FROM customers WHERE id = ? OR name = ?
        `, customerId, record.customer_name);

        if (!existingCustomer) {
          await db.runAsync(`
            INSERT INTO customers (id, name, email, phone)
            VALUES (?, ?, ?, ?)
          `, customerId, record.customer_name, record.email || null, record.phone || null);
        } else {
          await db.runAsync(`
            UPDATE customers SET email = ?, phone = ? WHERE id = ?
          `, record.email || null, record.phone || null, existingCustomer.id);
        }

        const finalCustomerId = existingCustomer ? existingCustomer.id : customerId;
        const originalAmount = parseFloat(record.original_amount) || 0;

        let rule = null;
        if (record.rule_id) {
          rule = await db.getAsync(`SELECT * FROM discount_rules WHERE id = ?`, record.rule_id);
        }

        const { appliedDiscount, finalAmount } = calculateDiscount(originalAmount, rule);

        const existingBill = await db.getAsync(`
          SELECT id FROM bills WHERE bill_number = ?
        `, record.bill_number);

        if (existingBill) {
          results.updated++;
        } else {
          const billId = uuidv4();
          const now = getCurrentTime();

          await db.runAsync(`
            INSERT INTO bills (id, bill_number, customer_id, bill_month, original_amount, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, billId, record.bill_number, finalCustomerId, record.bill_month, originalAmount, record.status || 'pending', now, now);

          const versionNumber = 1;
          const versionId = uuidv4();

          await db.runAsync(`
            INSERT INTO bill_versions (id, bill_id, version_number, rule_id, rule_name, discount_type, discount_value, applied_discount, final_amount, is_paid, is_active, reason, created_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
            versionId,
            billId,
            versionNumber,
            rule ? rule.id : null,
            rule ? rule.name : '无折扣',
            rule ? rule.discount_type : null,
            rule ? rule.discount_value : 0,
            appliedDiscount,
            finalAmount,
            record.status === 'paid' ? 1 : 0,
            1,
            '初始版本',
            now,
            record.created_by || 'system'
          );

          if (record.items) {
            const items = JSON.parse(record.items);
            for (const item of items) {
              await db.runAsync(`
                INSERT INTO bill_items (id, bill_version_id, item_name, quantity, unit_price, item_amount)
                VALUES (?, ?, ?, ?, ?, ?)
              `, uuidv4(), versionId, item.name, item.quantity, item.unit_price, item.amount);
            }
          }

          results.imported++;
        }
      } catch (error) {
        results.errors.push({ record, error: error.message });
      }
    }

    return results;
  });
}

async function getAllBillsWithDetails() {
  const bills = await db.allAsync(`
    SELECT b.*, c.name as customer_name, c.email as customer_email,
           (SELECT COUNT(*) FROM bill_anomalies WHERE bill_id = b.id AND status = 'open') as open_anomalies_count,
           (SELECT COUNT(*) FROM correction_requests WHERE bill_id = b.id AND status != 'rejected') as corrections_count
    FROM bills b
    JOIN customers c ON b.customer_id = c.id
    ORDER BY b.created_at DESC
  `);

  for (const bill of bills) {
    const activeVersion = await getActiveVersion(bill.id);
    if (activeVersion) {
      bill.active_version = activeVersion;
    }
  }

  return bills;
}

async function getBillWithAllDetails(billId) {
  const bill = await db.getAsync(`
    SELECT b.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
    FROM bills b
    JOIN customers c ON b.customer_id = c.id
    WHERE b.id = ?
  `, billId);

  if (!bill) return null;

  bill.versions = await getBillVersions(billId);
  bill.anomalies = await db.allAsync(`
    SELECT ba.*, bv.version_number
    FROM bill_anomalies ba
    JOIN bill_versions bv ON ba.version_id = bv.id
    WHERE ba.bill_id = ?
    ORDER BY ba.detected_at DESC
  `, billId);

  bill.corrections = await db.allAsync(`
    SELECT cr.*,
           (SELECT COUNT(*) FROM correction_approvals WHERE correction_request_id = cr.id) as approval_count,
           (SELECT COUNT(*) FROM customer_notifications WHERE correction_request_id = cr.id) as notification_count
    FROM correction_requests cr
    WHERE cr.bill_id = ?
    ORDER BY cr.requested_at DESC
  `, billId);

  bill.rollbacks = await db.allAsync(`
    SELECT vr.*,
           rv.version_number as rolled_back_version_number,
           rv.final_amount as rolled_back_amount,
           rv2.version_number as restored_version_number,
           rv2.final_amount as restored_amount
    FROM version_rollbacks vr
    JOIN bill_versions rv ON vr.rolled_back_version_id = rv.id
    JOIN bill_versions rv2 ON vr.restored_version_id = rv2.id
    WHERE vr.bill_id = ?
    ORDER BY vr.rolled_back_at DESC
  `, billId);

  return bill;
}

async function getBillVersions(billId) {
  return await db.allAsync(`
    SELECT bv.*,
           (SELECT COUNT(*) FROM bill_items WHERE bill_version_id = bv.id) as items_count,
           (SELECT COUNT(*) FROM correction_approvals ca 
            JOIN correction_requests cr ON ca.correction_request_id = cr.id
            WHERE cr.source_version_id = bv.id) as linked_approvals
    FROM bill_versions bv
    WHERE bv.bill_id = ?
    ORDER BY bv.version_number DESC
  `, billId);
}

async function markAnomaly(billId, anomalyType, anomalyReason, detectedBy) {
  const activeVersion = await getActiveVersion(billId);
  if (!activeVersion) {
    throw new Error('账单没有活跃版本');
  }

  const anomalyId = uuidv4();
  const now = getCurrentTime();

  await db.runAsync(`
    INSERT INTO bill_anomalies (id, bill_id, version_id, anomaly_type, anomaly_reason, detected_by, detected_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, anomalyId, billId, activeVersion.id, anomalyType, anomalyReason, detectedBy, now, 'open');

  return { id: anomalyId, success: true };
}

async function trialCorrection(billId, targetRuleId) {
  const activeVersion = await getActiveVersion(billId);
  if (!activeVersion) {
    throw new Error('账单没有活跃版本');
  }

  const bill = await db.getAsync(`SELECT * FROM bills WHERE id = ?`, billId);
  const targetRule = targetRuleId ? 
    await db.getAsync(`SELECT * FROM discount_rules WHERE id = ?`, targetRuleId) : null;

  const { appliedDiscount: newDiscount, finalAmount: newFinalAmount } = 
    calculateDiscount(bill.original_amount, targetRule);

  const correctionType = activeVersion.is_paid ? 'adjustment' : 'full_recalc';
  const adjustmentAmount = activeVersion.is_paid ? 
    (newFinalAmount - activeVersion.final_amount) : null;

  return {
    source_version: {
      id: activeVersion.id,
      version_number: activeVersion.version_number,
      original_amount: bill.original_amount,
      applied_discount: activeVersion.applied_discount,
      final_amount: activeVersion.final_amount,
      rule_name: activeVersion.rule_name
    },
    target: {
      rule_id: targetRule ? targetRule.id : null,
      rule_name: targetRule ? targetRule.name : '无折扣',
      discount_type: targetRule ? targetRule.discount_type : null,
      discount_value: targetRule ? targetRule.discount_value : 0,
      applied_discount: newDiscount,
      final_amount: newFinalAmount
    },
    comparison: {
      original_amount: bill.original_amount,
      old_discount: activeVersion.applied_discount,
      new_discount: newDiscount,
      discount_diff: newDiscount - activeVersion.applied_discount,
      old_final: activeVersion.final_amount,
      new_final: newFinalAmount,
      amount_diff: newFinalAmount - activeVersion.final_amount
    },
    correction_type: correctionType,
    adjustment_amount: adjustmentAmount,
    is_paid: activeVersion.is_paid === 1,
    can_notify: false
  };
}

async function createCorrectionRequest(billId, targetRuleId, requestedBy, notes) {
  const existingActive = await checkActiveCorrection(billId);
  if (existingActive) {
    throw new Error('该账单已有活跃的订正申请，请先处理');
  }

  const activeVersion = await getActiveVersion(billId);
  if (!activeVersion) {
    throw new Error('账单没有活跃版本');
  }

  const bill = await db.getAsync(`SELECT * FROM bills WHERE id = ?`, billId);
  const targetRule = targetRuleId ? 
    await db.getAsync(`SELECT * FROM discount_rules WHERE id = ?`, targetRuleId) : null;

  const { appliedDiscount: newDiscount, finalAmount: newFinalAmount } = 
    calculateDiscount(bill.original_amount, targetRule);

  const correctionType = activeVersion.is_paid ? 'adjustment' : 'full_recalc';
  const adjustmentAmount = activeVersion.is_paid ? 
    (newFinalAmount - activeVersion.final_amount) : null;

  const correctionId = uuidv4();
  const now = getCurrentTime();

  await db.runAsync(`
    INSERT INTO correction_requests (id, bill_id, anomaly_id, source_version_id, target_rule_id, target_rule_name, trial_result, trial_final_amount, correction_type, adjustment_amount, requested_by, requested_at, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    correctionId,
    billId,
    null,
    activeVersion.id,
    targetRule ? targetRule.id : null,
    targetRule ? targetRule.name : '无折扣',
    newDiscount,
    newFinalAmount,
    correctionType,
    adjustmentAmount,
    requestedBy,
    now,
    'draft',
    notes
  );

  return {
    id: correctionId,
    correction_type: correctionType,
    adjustment_amount: adjustmentAmount,
    new_final_amount: newFinalAmount
  };
}

async function getAllCorrectionRequests() {
  return await db.allAsync(`
    SELECT cr.*, 
           b.bill_number,
           b.bill_month,
           c.name as customer_name,
           bv.version_number as source_version,
           bv.final_amount as source_amount
    FROM correction_requests cr
    JOIN bills b ON cr.bill_id = b.id
    JOIN customers c ON b.customer_id = c.id
    JOIN bill_versions bv ON cr.source_version_id = bv.id
    ORDER BY cr.requested_at DESC
  `);
}

async function getCorrectionRequestWithDetails(correctionId) {
  const correction = await db.getAsync(`
    SELECT cr.*,
           b.bill_number,
           b.bill_month,
           b.original_amount,
           b.status as bill_status,
           c.id as customer_id,
           c.name as customer_name,
           c.email as customer_email,
           bv.version_number as source_version_number,
           bv.final_amount as source_final_amount,
           bv.applied_discount as source_discount,
           bv.rule_name as source_rule_name,
           bv.is_paid as source_is_paid
    FROM correction_requests cr
    JOIN bills b ON cr.bill_id = b.id
    JOIN customers c ON b.customer_id = c.id
    JOIN bill_versions bv ON cr.source_version_id = bv.id
    WHERE cr.id = ?
  `, correctionId);

  if (!correction) return null;

  correction.approvals = await db.allAsync(`
    SELECT * FROM correction_approvals 
    WHERE correction_request_id = ?
    ORDER BY approved_at ASC
  `, correctionId);

  correction.notifications = await db.allAsync(`
    SELECT * FROM customer_notifications 
    WHERE correction_request_id = ?
    ORDER BY sent_at DESC
  `, correctionId);

  correction.generated_version = await db.getAsync(`
    SELECT * FROM bill_versions 
    WHERE bill_id = ? AND version_number > (
      SELECT version_number FROM bill_versions WHERE id = ?
    )
    ORDER BY version_number DESC
    LIMIT 1
  `, correction.bill_id, correction.source_version_id);

  return correction;
}

async function approveCorrection(correctionId, approver, comment) {
  const correction = await db.getAsync(`SELECT * FROM correction_requests WHERE id = ?`, correctionId);
  if (!correction) throw new Error('订正申请不存在');
  if (correction.status !== 'draft' && correction.status !== 'pending_approval') {
    throw new Error('当前状态不能审批');
  }

  const approvalId = uuidv4();
  const now = getCurrentTime();

  await db.runAsync(`
    INSERT INTO correction_approvals (id, correction_request_id, approver, action, comment, approved_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, approvalId, correctionId, approver, 'approve', comment, now);

  await db.runAsync(`
    UPDATE correction_requests SET status = 'approved' WHERE id = ?
  `, correctionId);

  return { id: approvalId, success: true };
}

async function rejectCorrection(correctionId, approver, comment) {
  const correction = await db.getAsync(`SELECT * FROM correction_requests WHERE id = ?`, correctionId);
  if (!correction) throw new Error('订正申请不存在');
  if (correction.status !== 'draft' && correction.status !== 'pending_approval') {
    throw new Error('当前状态不能驳回');
  }

  const approvalId = uuidv4();
  const now = getCurrentTime();

  await db.runAsync(`
    INSERT INTO correction_approvals (id, correction_request_id, approver, action, comment, approved_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, approvalId, correctionId, approver, 'reject', comment, now);

  await db.runAsync(`
    UPDATE correction_requests SET status = 'rejected' WHERE id = ?
  `, correctionId);

  return { id: approvalId, success: true };
}

async function publishCorrection(correctionId, approver) {
  return await runTransaction(async () => {
    const correction = await db.getAsync(`SELECT * FROM correction_requests WHERE id = ?`, correctionId);
    if (!correction) throw new Error('订正申请不存在');
    if (correction.status !== 'approved') {
      throw new Error('只有已审批的订正可以发布');
    }

    const now = getCurrentTime();
    const bill = await db.getAsync(`SELECT * FROM bills WHERE id = ?`, correction.bill_id);
    const sourceVersion = await db.getAsync(`SELECT * FROM bill_versions WHERE id = ?`, correction.source_version_id);

    const targetRule = correction.target_rule_id ? 
      await db.getAsync(`SELECT * FROM discount_rules WHERE id = ?`, correction.target_rule_id) : null;

    const nextVersion = await getNextVersionNumber(correction.bill_id);
    const newVersionId = uuidv4();

    const { appliedDiscount, finalAmount } = calculateDiscount(bill.original_amount, targetRule);

    await db.runAsync(`
      UPDATE bill_versions SET is_active = 0 WHERE bill_id = ? AND is_active = 1
    `, correction.bill_id);

    await db.runAsync(`
      INSERT INTO bill_versions (id, bill_id, version_number, rule_id, rule_name, discount_type, discount_value, applied_discount, final_amount, is_paid, is_active, reason, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      newVersionId,
      correction.bill_id,
      nextVersion,
      targetRule ? targetRule.id : null,
      targetRule ? targetRule.name : '无折扣',
      targetRule ? targetRule.discount_type : null,
      targetRule ? targetRule.discount_value : 0,
      appliedDiscount,
      finalAmount,
      sourceVersion.is_paid,
      1,
      `订正版本 - 申请ID: ${correctionId.substring(0, 8)}`,
      now,
      approver
    );

    await db.runAsync(`
      UPDATE correction_requests SET status = 'published' WHERE id = ?
    `, correctionId);

    const canNotify = !sourceVersion.is_paid;
    const notificationId = uuidv4();
    const customer = await db.getAsync(`SELECT * FROM customers WHERE id = ?`, bill.customer_id);

    const notificationContent = canNotify ? 
      `尊敬的${customer.name}，您的账单${bill.bill_number}已完成订正，新版本金额为￥${finalAmount.toFixed(2)}。` :
      null;

    await db.runAsync(`
      INSERT INTO customer_notifications (id, correction_request_id, bill_id, customer_id, notification_type, status, sent_at, error_message, content)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      notificationId,
      correctionId,
      correction.bill_id,
      customer.id,
      correction.correction_type === 'adjustment' ? 'adjustment_notice' : 'bill_updated',
      canNotify ? 'pending' : 'skipped',
      null,
      null,
      notificationContent
    );

    const anomalies = await db.allAsync(`
      SELECT id FROM bill_anomalies WHERE bill_id = ? AND status = 'open'
    `, correction.bill_id);

    for (const anomaly of anomalies) {
      await db.runAsync(`
        UPDATE bill_anomalies SET status = 'resolved' WHERE id = ?
      `, anomaly.id);
    }

    return {
      version_id: newVersionId,
      version_number: nextVersion,
      final_amount: finalAmount,
      notification_id: canNotify ? notificationId : null,
      can_notify: canNotify,
      notification_status: canNotify ? 'pending' : 'skipped'
    };
  });
}

async function rollbackVersion(billId, targetVersionId, rolledBackBy, reason) {
  return await runTransaction(async () => {
    const activeVersion = await getActiveVersion(billId);
    if (!activeVersion) {
      throw new Error('账单没有活跃版本');
    }

    const targetVersion = await db.getAsync(`
      SELECT * FROM bill_versions WHERE bill_id = ? AND id = ?
    `, billId, targetVersionId);

    if (!targetVersion) {
      throw new Error('目标版本不存在');
    }

    if (targetVersion.id === activeVersion.id) {
      throw new Error('不能回滚到当前活跃版本');
    }

    const now = getCurrentTime();
    const rollbackId = uuidv4();

    await db.runAsync(`
      UPDATE bill_versions SET is_active = 0 WHERE bill_id = ?
    `, billId);

    await db.runAsync(`
      UPDATE bill_versions SET is_active = 1 WHERE id = ?
    `, targetVersionId);

    await db.runAsync(`
      INSERT INTO version_rollbacks (id, bill_id, rolled_back_version_id, restored_version_id, reason, rolled_back_by, rolled_back_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      rollbackId,
      billId,
      activeVersion.id,
      targetVersionId,
      reason || '手动回滚',
      rolledBackBy,
      now
    );

    return {
      id: rollbackId,
      rolled_back_version: {
        id: activeVersion.id,
        version_number: activeVersion.version_number,
        final_amount: activeVersion.final_amount
      },
      restored_version: {
        id: targetVersion.id,
        version_number: targetVersion.version_number,
        final_amount: targetVersion.final_amount
      }
    };
  });
}

async function sendNotification(notificationId) {
  const notification = await db.getAsync(`SELECT * FROM customer_notifications WHERE id = ?`, notificationId);
  if (!notification) throw new Error('通知不存在');
  if (notification.status === 'sent') throw new Error('通知已发送');

  const success = Math.random() > 0.3;
  const now = getCurrentTime();

  if (success) {
    await db.runAsync(`
      UPDATE customer_notifications SET status = 'sent', sent_at = ? WHERE id = ?
    `, now, notificationId);

    return { status: 'sent', sent_at: now };
  } else {
    await db.runAsync(`
      UPDATE customer_notifications SET status = 'failed', error_message = ?, sent_at = ? WHERE id = ?
    `, '邮件服务器连接超时（模拟）', now, notificationId);

    return { status: 'failed', error_message: '邮件服务器连接超时（模拟）', sent_at: now };
  }
}

async function getOverview() {
  const billsTotal = await db.getAsync(`SELECT COUNT(*) as count FROM bills`);
  const billsPaid = await db.getAsync(`SELECT COUNT(*) as count FROM bills WHERE status = 'paid'`);
  const billsPending = await db.getAsync(`SELECT COUNT(*) as count FROM bills WHERE status = 'pending'`);
  
  const anomaliesTotal = await db.getAsync(`SELECT COUNT(*) as count FROM bill_anomalies`);
  const anomaliesOpen = await db.getAsync(`SELECT COUNT(*) as count FROM bill_anomalies WHERE status = 'open'`);
  const anomaliesResolved = await db.getAsync(`SELECT COUNT(*) as count FROM bill_anomalies WHERE status = 'resolved'`);
  
  const correctionsTotal = await db.getAsync(`SELECT COUNT(*) as count FROM correction_requests`);
  const correctionsDraft = await db.getAsync(`SELECT COUNT(*) as count FROM correction_requests WHERE status = 'draft'`);
  const correctionsApproved = await db.getAsync(`SELECT COUNT(*) as count FROM correction_requests WHERE status = 'approved'`);
  const correctionsPublished = await db.getAsync(`SELECT COUNT(*) as count FROM correction_requests WHERE status = 'published'`);
  const correctionsRejected = await db.getAsync(`SELECT COUNT(*) as count FROM correction_requests WHERE status = 'rejected'`);
  
  const versionsTotal = await db.getAsync(`SELECT COUNT(*) as count FROM bill_versions`);
  const versionsActive = await db.getAsync(`SELECT COUNT(*) as count FROM bill_versions WHERE is_active = 1`);
  
  const notificationsTotal = await db.getAsync(`SELECT COUNT(*) as count FROM customer_notifications`);
  const notificationsPending = await db.getAsync(`SELECT COUNT(*) as count FROM customer_notifications WHERE status = 'pending'`);
  const notificationsSent = await db.getAsync(`SELECT COUNT(*) as count FROM customer_notifications WHERE status = 'sent'`);
  const notificationsFailed = await db.getAsync(`SELECT COUNT(*) as count FROM customer_notifications WHERE status = 'failed'`);
  const notificationsSkipped = await db.getAsync(`SELECT COUNT(*) as count FROM customer_notifications WHERE status = 'skipped'`);

  return {
    bills: {
      total: billsTotal.count,
      paid: billsPaid.count,
      pending: billsPending.count
    },
    anomalies: {
      total: anomaliesTotal.count,
      open: anomaliesOpen.count,
      resolved: anomaliesResolved.count
    },
    corrections: {
      total: correctionsTotal.count,
      draft: correctionsDraft.count,
      approved: correctionsApproved.count,
      published: correctionsPublished.count,
      rejected: correctionsRejected.count
    },
    versions: {
      total: versionsTotal.count,
      active: versionsActive.count
    },
    notifications: {
      total: notificationsTotal.count,
      pending: notificationsPending.count,
      sent: notificationsSent.count,
      failed: notificationsFailed.count,
      skipped: notificationsSkipped.count
    }
  };
}

async function createSampleData() {
  return await runTransaction(async () => {
    const tables = ['bill_items', 'bill_versions', 'bills', 'customers', 'discount_rules', 'bill_anomalies', 'correction_approvals', 'customer_notifications', 'correction_requests', 'version_rollbacks'];
    
    for (const table of tables) {
      await db.runAsync(`DELETE FROM ${table}`);
    }

    const now = getCurrentTime();
    const customer1Id = uuidv4();
    const customer2Id = uuidv4();
    const customer3Id = uuidv4();

    await db.runAsync(`
      INSERT INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)
    `, customer1Id, '张三科技有限公司', 'zhangsan@example.com', '13800138001');
    
    await db.runAsync(`
      INSERT INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)
    `, customer2Id, '李四贸易有限公司', 'lisi@example.com', '13800138002');
    
    await db.runAsync(`
      INSERT INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)
    `, customer3Id, '王五网络科技', 'wangwu@example.com', '13800138003');

    const ruleWrongId = uuidv4();
    const ruleCorrectId = uuidv4();
    const rulePremiumId = uuidv4();

    await db.runAsync(`
      INSERT INTO discount_rules (id, name, description, discount_type, discount_value, priority, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, ruleWrongId, '错误折扣规则-5%', '错误应用的5%折扣', 'percentage', 5, 1, 1, now);
    
    await db.runAsync(`
      INSERT INTO discount_rules (id, name, description, discount_type, discount_value, priority, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, ruleCorrectId, '正确折扣规则-10%', '标准客户10%折扣', 'percentage', 10, 2, 1, now);
    
    await db.runAsync(`
      INSERT INTO discount_rules (id, name, description, discount_type, discount_value, priority, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, rulePremiumId, '高级客户折扣-15%', '高级客户15%折扣', 'percentage', 15, 3, 1, now);

    const wrongRule = { id: ruleWrongId, discount_type: 'percentage', discount_value: 5, name: '错误折扣规则-5%' };
    const correctRule = { id: ruleCorrectId, discount_type: 'percentage', discount_value: 10, name: '正确折扣规则-10%' };
    const premiumRule = { id: rulePremiumId, discount_type: 'percentage', discount_value: 15, name: '高级客户折扣-15%' };

    const bill1Id = uuidv4();
    const bill1Original = 10000;
    const { appliedDiscount: b1WrongDisc, finalAmount: b1WrongFinal } = calculateDiscount(bill1Original, wrongRule);
    const bill1Version1Id = uuidv4();

    await db.runAsync(`
      INSERT INTO bills (id, bill_number, customer_id, bill_month, original_amount, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, bill1Id, 'BILL-2024-001', customer1Id, '2024-01', bill1Original, 'pending', now, now);

    await db.runAsync(`
      INSERT INTO bill_versions (id, bill_id, version_number, rule_id, rule_name, discount_type, discount_value, applied_discount, final_amount, is_paid, is_active, reason, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, bill1Version1Id, bill1Id, 1, wrongRule.id, wrongRule.name, wrongRule.discount_type, wrongRule.discount_value, b1WrongDisc, b1WrongFinal, 0, 1, '初始版本（错误折扣）', now, 'system');

    const bill2Id = uuidv4();
    const bill2Original = 20000;
    const { appliedDiscount: b2WrongDisc, finalAmount: b2WrongFinal } = calculateDiscount(bill2Original, wrongRule);
    const bill2Version1Id = uuidv4();

    await db.runAsync(`
      INSERT INTO bills (id, bill_number, customer_id, bill_month, original_amount, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, bill2Id, 'BILL-2024-002', customer2Id, '2024-01', bill2Original, 'paid', now, now);

    await db.runAsync(`
      INSERT INTO bill_versions (id, bill_id, version_number, rule_id, rule_name, discount_type, discount_value, applied_discount, final_amount, is_paid, is_active, reason, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, bill2Version1Id, bill2Id, 1, wrongRule.id, wrongRule.name, wrongRule.discount_type, wrongRule.discount_value, b2WrongDisc, b2WrongFinal, 1, 1, '初始版本（已支付）', now, 'system');

    const bill3Id = uuidv4();
    const bill3Original = 15000;
    const { appliedDiscount: b3WrongDisc, finalAmount: b3WrongFinal } = calculateDiscount(bill3Original, wrongRule);
    const bill3Version1Id = uuidv4();

    await db.runAsync(`
      INSERT INTO bills (id, bill_number, customer_id, bill_month, original_amount, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, bill3Id, 'BILL-2024-003', customer3Id, '2024-02', bill3Original, 'pending', now, now);

    await db.runAsync(`
      INSERT INTO bill_versions (id, bill_id, version_number, rule_id, rule_name, discount_type, discount_value, applied_discount, final_amount, is_paid, is_active, reason, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, bill3Version1Id, bill3Id, 1, wrongRule.id, wrongRule.name, wrongRule.discount_type, wrongRule.discount_value, b3WrongDisc, b3WrongFinal, 0, 1, '初始版本', now, 'system');

    const anomaly1Id = uuidv4();
    await db.runAsync(`
      INSERT INTO bill_anomalies (id, bill_id, version_id, anomaly_type, anomaly_reason, detected_by, detected_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, anomaly1Id, bill1Id, bill1Version1Id, 'wrong_discount', '错误应用了5%折扣，应该是10%', 'billing_team', now, 'open');

    const anomaly2Id = uuidv4();
    await db.runAsync(`
      INSERT INTO bill_anomalies (id, bill_id, version_id, anomaly_type, anomaly_reason, detected_by, detected_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, anomaly2Id, bill2Id, bill2Version1Id, 'wrong_discount', '已支付账单折扣错误，需要差额调整', 'billing_team', now, 'open');

    const correction2Id = uuidv4();
    const { appliedDiscount: b2CorrDisc, finalAmount: b2CorrFinal } = calculateDiscount(bill2Original, correctRule);
    const adjustmentAmount = b2CorrFinal - b2WrongFinal;

    await db.runAsync(`
      INSERT INTO correction_requests (id, bill_id, anomaly_id, source_version_id, target_rule_id, target_rule_name, trial_result, trial_final_amount, correction_type, adjustment_amount, requested_by, requested_at, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, correction2Id, bill2Id, anomaly2Id, bill2Version1Id, correctRule.id, correctRule.name, b2CorrDisc, b2CorrFinal, 'adjustment', adjustmentAmount, 'analyst1', now, 'rejected', '已支付账单需要差额调整');

    await db.runAsync(`
      INSERT INTO correction_approvals (id, correction_request_id, approver, action, comment, approved_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, uuidv4(), correction2Id, 'manager1', 'reject', '差额计算需要复核，建议重新提交', now);

    const correction3Id = uuidv4();
    const { appliedDiscount: b3CorrDisc, finalAmount: b3CorrFinal } = calculateDiscount(bill3Original, premiumRule);

    await db.runAsync(`
      INSERT INTO correction_requests (id, bill_id, anomaly_id, source_version_id, target_rule_id, target_rule_name, trial_result, trial_final_amount, correction_type, adjustment_amount, requested_by, requested_at, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, correction3Id, bill3Id, null, bill3Version1Id, premiumRule.id, premiumRule.name, b3CorrDisc, b3CorrFinal, 'full_recalc', null, 'analyst2', now, 'published', '客户升级为高级客户');

    const bill3Version2Id = uuidv4();
    await db.runAsync(`
      INSERT INTO bill_versions (id, bill_id, version_number, rule_id, rule_name, discount_type, discount_value, applied_discount, final_amount, is_paid, is_active, reason, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, bill3Version2Id, bill3Id, 2, premiumRule.id, premiumRule.name, premiumRule.discount_type, premiumRule.discount_value, b3CorrDisc, b3CorrFinal, 0, 0, `订正版本 - 申请ID: ${correction3Id.substring(0, 8)}`, now, 'manager2');

    const { appliedDiscount: correct3Disc, finalAmount: correct3Final } = calculateDiscount(bill3Original, correctRule);
    const bill3Version3Id = uuidv4();
    await db.runAsync(`
      INSERT INTO bill_versions (id, bill_id, version_number, rule_id, rule_name, discount_type, discount_value, applied_discount, final_amount, is_paid, is_active, reason, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, bill3Version3Id, bill3Id, 3, correctRule.id, correctRule.name, correctRule.discount_type, correctRule.discount_value, correct3Disc, correct3Final, 0, 1, '重复订正-回滚后', now, 'manager2');

    await db.runAsync(`
      INSERT INTO customer_notifications (id, correction_request_id, bill_id, customer_id, notification_type, status, sent_at, error_message, content)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, uuidv4(), correction3Id, bill3Id, customer3Id, 'bill_updated', 'failed', now, '邮件服务器连接超时（模拟）', '尊敬的王五网络科技，您的账单BILL-2024-003已完成订正。');

    await db.runAsync(`
      INSERT INTO version_rollbacks (id, bill_id, rolled_back_version_id, restored_version_id, reason, rolled_back_by, rolled_back_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, uuidv4(), bill3Id, bill3Version2Id, bill3Version1Id, '重复订正回滚', 'manager3', now);

    await db.runAsync(`
      INSERT INTO correction_approvals (id, correction_request_id, approver, action, comment, approved_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, uuidv4(), correction3Id, 'manager2', 'approve', '同意订正', now);
    
    await db.runAsync(`
      INSERT INTO correction_approvals (id, correction_request_id, approver, action, comment, approved_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, uuidv4(), correction3Id, 'manager2', 'approve', '重新审批', now);

    return {
      customers: 3,
      rules: 3,
      bills: 3,
      versions: 5,
      anomalies: 2,
      corrections: 2,
      notifications: 1,
      rollbacks: 1,
      sample_scenarios: {
        scenario1_unpaid_recalc: {
          bill_number: 'BILL-2024-001',
          description: '未支付账单重算 - 应从5%折扣改为10%折扣',
          old_discount: '5%',
          new_discount: '10%',
          old_amount: b1WrongFinal,
          new_amount: calculateDiscount(bill1Original, correctRule).finalAmount
        },
        scenario2_paid_adjustment: {
          bill_number: 'BILL-2024-002',
          description: '已支付账单差额调整 - 被审批驳回',
          status: 'rejected',
          adjustment_amount: adjustmentAmount
        },
        scenario3_repeat_correction: {
          bill_number: 'BILL-2024-003',
          description: '重复订正比并回滚 - 通知失败',
          versions: 3,
          notification_status: 'failed',
          has_rollback: true
        }
      }
    };
  });
}

module.exports = {
  importBills,
  getAllRules,
  getActiveVersion,
  getBillVersions,
  getAllBillsWithDetails,
  getBillWithAllDetails,
  markAnomaly,
  trialCorrection,
  createCorrectionRequest,
  getAllCorrectionRequests,
  getCorrectionRequestWithDetails,
  approveCorrection,
  rejectCorrection,
  publishCorrection,
  rollbackVersion,
  sendNotification,
  getOverview,
  createSampleData
};
