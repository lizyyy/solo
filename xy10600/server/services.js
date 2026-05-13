const db = require('./database');
const crypto = require('crypto');

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function generateRequestId() {
  return 'REQ_' + crypto.randomBytes(8).toString('hex').toUpperCase();
}

async function checkDuplicateRequest(requestId) {
  const row = await getAsync(
    'SELECT id, status FROM price_changes WHERE request_id = ?',
    [requestId]
  );
  return row;
}

async function addTimelineEvent(priceChangeId, eventType, eventDetails, operator) {
  await runAsync(
    `INSERT INTO audit_timeline (price_change_id, event_type, event_details, operator)
     VALUES (?, ?, ?, ?)`,
    [priceChangeId, eventType, JSON.stringify(eventDetails), operator]
  );
}

async function checkActivePromotion(productCode) {
  const today = new Date().toISOString().split('T')[0];
  const row = await getAsync(
    `SELECT p.* FROM promotions p
     JOIN price_changes pc ON p.price_change_id = pc.id
     WHERE pc.product_code = ? 
       AND p.status = 'ACTIVE'
       AND p.effect_start <= ?
       AND (p.effect_end IS NULL OR p.effect_end >= ?)
     ORDER BY p.effect_start DESC
     LIMIT 1`,
    [productCode, today, today]
  );
  return row;
}

async function checkDeviceOffline(deviceId) {
  const row = await getAsync(
    `SELECT id, offline_at FROM esl_changes
     WHERE device_id = ? AND status = 'OFFLINE'
     ORDER BY offline_at DESC
     LIMIT 1`,
    [deviceId]
  );
  if (row) {
    const offlineTime = new Date(row.offline_at);
    const diff = Date.now() - offlineTime.getTime();
    if (diff < 24 * 60 * 60 * 1000) {
      return row;
    }
  }
  return null;
}

async function processPriceChange(data) {
  const {
    product_code,
    product_name,
    old_price,
    new_price,
    operator,
    reason,
    devices,
    terminals,
    promotion,
    force = false,
    request_id
  } = data;

  const requestId = request_id || generateRequestId();
  const existing = await checkDuplicateRequest(requestId);

  if (existing) {
    await addTimelineEvent(
      existing.id,
      'DUPLICATE_SUBMISSION',
      { original_status: existing.status, request_id: requestId },
      operator
    );
    return {
      success: true,
      idempotent: true,
      price_change_id: existing.id,
      status: existing.status,
      message: '请求已处理，重复提交已忽略'
    };
  }

  const priceChangeResult = await runAsync(
    `INSERT INTO price_changes
     (product_code, product_name, old_price, new_price, status, reason, operator, request_id)
     VALUES (?, ?, ?, ?, 'PROCESSING', ?, ?, ?)`,
    [product_code, product_name, old_price, new_price, reason, operator, requestId]
  );
  const priceChangeId = priceChangeResult.lastID;

  await addTimelineEvent(
    priceChangeId,
    'SUBMITTED',
    { product_code, old_price, new_price, request_id: requestId },
    operator
  );

  let finalStatus = 'SUCCESS';
  let hasErrors = false;
  let intercepted = false;
  const errorReasons = [];

  if (promotion) {
    const activePromo = await checkActivePromotion(product_code);
    if (activePromo && !force) {
      intercepted = true;
      finalStatus = 'INTERCEPTED';
      errorReasons.push(`存在活跃促销活动: ${activePromo.promotion_name}`);
      await addTimelineEvent(
        priceChangeId,
        'PROMOTION_INTERCEPTED',
        {
          active_promotion: activePromo.promotion_name,
          promotion_id: activePromo.promotion_id
        },
        operator
      );
    }

    await runAsync(
      `INSERT INTO promotions
       (price_change_id, promotion_id, promotion_name, rule_type, effect_start, effect_end, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        priceChangeId,
        promotion.promotion_id || generateRequestId(),
        promotion.promotion_name,
        promotion.rule_type,
        promotion.effect_start,
        promotion.effect_end,
        intercepted ? 'PENDING' : 'ACTIVE'
      ]
    );
  }

  if (devices && devices.length > 0) {
    for (const device of devices) {
      const offlineStatus = await checkDeviceOffline(device.device_id);
      const now = new Date().toISOString();
      let deviceStatus = 'SYNCED';
      let errorMessage = null;
      let offlineAt = null;

      if (device.simulate_offline || offlineStatus) {
        deviceStatus = 'OFFLINE';
        finalStatus = 'MANUAL_CORRECTION_REQUIRED';
        hasErrors = true;
        errorMessage = '设备离线，无法同步价签';
        offlineAt = now;
        errorReasons.push(`设备 ${device.device_id} 离线`);
      }

      await runAsync(
        `INSERT INTO esl_changes
         (price_change_id, device_id, old_price, new_price, status, error_message, sent_at, synced_at, offline_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          priceChangeId,
          device.device_id,
          old_price,
          new_price,
          deviceStatus,
          errorMessage,
          now,
          deviceStatus === 'SYNCED' ? now : null,
          offlineAt
        ]
      );

      if (deviceStatus === 'OFFLINE') {
        await addTimelineEvent(
          priceChangeId,
          'DEVICE_OFFLINE',
          { device_id: device.device_id, error: errorMessage },
          operator
        );
      }
    }
  }

  if (terminals && terminals.length > 0) {
    for (const terminal of terminals) {
      const now = new Date().toISOString();
      let terminalStatus = 'APPLIED';
      let errorMessage = null;

      if (terminal.simulate_failure) {
        terminalStatus = 'FAILED';
        finalStatus = 'MANUAL_CORRECTION_REQUIRED';
        hasErrors = true;
        errorMessage = '收银系统同步失败: 网络超时';
        errorReasons.push(`收银终端 ${terminal.terminal_id} 同步失败`);
      }

      await runAsync(
        `INSERT INTO cashier_changes
         (price_change_id, terminal_id, old_price, new_price, status, error_message, applied_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          priceChangeId,
          terminal.terminal_id,
          old_price,
          new_price,
          terminalStatus,
          errorMessage,
          terminalStatus === 'APPLIED' ? now : null
        ]
      );

      if (terminalStatus === 'FAILED') {
        await addTimelineEvent(
          priceChangeId,
          'CASHIER_FAILURE',
          { terminal_id: terminal.terminal_id, error: errorMessage },
          operator
        );
      }
    }
  }

  if (hasErrors) {
    const esl = await allAsync(
      'SELECT new_price FROM esl_changes WHERE price_change_id = ? AND status = ?',
      [priceChangeId, 'SYNCED']
    );
    const cashier = await allAsync(
      'SELECT new_price FROM cashier_changes WHERE price_change_id = ? AND status = ?',
      [priceChangeId, 'APPLIED']
    );

    if (esl.length > 0 && cashier.length > 0) {
      const eslPrice = esl[0].new_price;
      const cashierPrice = cashier[0].new_price;
      if (Math.abs(eslPrice - cashierPrice) > 0.001) {
        await runAsync(
          `INSERT INTO price_discrepancies
           (price_change_id, esl_price, cashier_price, difference, status)
           VALUES (?, ?, ?, ?, 'OPEN')`,
          [priceChangeId, eslPrice, cashierPrice, Math.abs(eslPrice - cashierPrice)]
        );
        await addTimelineEvent(
          priceChangeId,
          'PRICE_DISCREPANCY_DETECTED',
          { esl_price: eslPrice, cashier_price: cashierPrice, difference: Math.abs(eslPrice - cashierPrice) },
          operator
        );
      }
    }
  }

  await runAsync('UPDATE price_changes SET status = ? WHERE id = ?', [finalStatus, priceChangeId]);
  await addTimelineEvent(
    priceChangeId,
    'COMPLETED',
    { final_status: finalStatus, errors: errorReasons },
    operator
  );

  return {
    success: true,
    idempotent: false,
    price_change_id: priceChangeId,
    status: finalStatus,
    request_id: requestId,
    intercepted: intercepted,
    errors: errorReasons
  };
}

async function rollbackPriceChange(priceChangeId, data) {
  const { rollback_by, rollback_reason, reissue = false } = data;

  const priceChange = await getAsync(
    'SELECT * FROM price_changes WHERE id = ?',
    [priceChangeId]
  );

  if (!priceChange) {
    throw new Error('价签变更记录不存在');
  }

  await runAsync(
    `INSERT INTO rollback_records
     (price_change_id, rollback_by, rollback_reason, esl_rolled_back, cashier_rolled_back)
     VALUES (?, ?, ?, 1, 1)`,
    [priceChangeId, rollback_by, rollback_reason]
  );

  await runAsync(
    'UPDATE esl_changes SET status = ? WHERE price_change_id = ?',
    ['ROLLED_BACK', priceChangeId]
  );

  await runAsync(
    'UPDATE cashier_changes SET status = ? WHERE price_change_id = ?',
    ['ROLLED_BACK', priceChangeId]
  );

  await runAsync(
    'UPDATE promotions SET status = ? WHERE price_change_id = ?',
    ['CANCELLED', priceChangeId]
  );

  await runAsync(
    'UPDATE price_discrepancies SET status = ?, resolved_at = ? WHERE price_change_id = ?',
    ['RESOLVED', new Date().toISOString(), priceChangeId]
  );

  const newStatus = reissue ? 'PENDING_REISSUE' : 'ROLLED_BACK';
  await runAsync(
    'UPDATE price_changes SET status = ? WHERE id = ?',
    [newStatus, priceChangeId]
  );

  await addTimelineEvent(
    priceChangeId,
    'ROLLED_BACK',
    { rollback_reason, reissue, new_status: newStatus },
    rollback_by
  );

  return {
    success: true,
    price_change_id: priceChangeId,
    status: newStatus
  };
}

async function reissuePriceChange(priceChangeId, operator) {
  const rollbackRecord = await getAsync(
    'SELECT * FROM rollback_records WHERE price_change_id = ? ORDER BY rolled_back_at DESC LIMIT 1',
    [priceChangeId]
  );

  const newCount = (rollbackRecord?.reissued_count || 0) + 1;

  await runAsync(
    'UPDATE rollback_records SET reissued_count = ? WHERE id = ?',
    [newCount, rollbackRecord.id]
  );

  await runAsync(
    'UPDATE price_changes SET status = ? WHERE id = ?',
    ['REISSUED', priceChangeId]
  );

  await addTimelineEvent(
    priceChangeId,
    'REISSUED',
    { reissue_count: newCount },
    operator
  );

  return {
    success: true,
    price_change_id: priceChangeId,
    reissue_count: newCount
  };
}

module.exports = {
  processPriceChange,
  rollbackPriceChange,
  reissuePriceChange,
  addTimelineEvent,
  getAsync,
  allAsync,
  runAsync,
  generateRequestId
};
