const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const db = require('../db');

const getConfig = (key) => {
  const config = db.prepare('SELECT value FROM system_configs WHERE key = ?').get(key);
  return config ? config.value : null;
};

const isInWarranty = (warrantyEndDate) => {
  return moment().isBefore(moment(warrantyEndDate));
};

const recordHistory = (orderId, action, oldStatus, newStatus, actor, actorRole, details = {}, diff = {}) => {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO order_history (order_id, action, old_status, new_status, actor, actor_role, details, diff, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    orderId,
    action,
    oldStatus,
    newStatus,
    actor,
    actorRole || 'system',
    JSON.stringify(details),
    JSON.stringify(diff),
    now
  );
};

const checkIdempotency = (callbackId) => {
  const existing = db.prepare('SELECT * FROM callbacks WHERE callback_id = ?').get(callbackId);
  if (existing) {
    return { exists: true, result: existing.result, status: existing.status };
  }
  return { exists: false };
};

const recordCallback = (callbackId, orderId, action, status, result = null) => {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO callbacks (callback_id, order_id, action, status, result, executed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(callbackId, orderId, action, status, JSON.stringify(result), now, now);
};

const createAsset = (assetData) => {
  const asset = {
    id: uuidv4(),
    asset_code: assetData.asset_code,
    name: assetData.name,
    type: assetData.type,
    location: assetData.location,
    installation_date: assetData.installation_date,
    warranty_start_date: assetData.warranty_start_date,
    warranty_end_date: assetData.warranty_end_date,
    status: 'active',
    manufacturer: assetData.manufacturer,
    model: assetData.model,
    vendor_id: assetData.vendor_id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.prepare(`
    INSERT INTO assets (id, asset_code, name, type, location, installation_date, warranty_start_date, warranty_end_date, status, manufacturer, model, vendor_id, created_at, updated_at)
    VALUES (@id, @asset_code, @name, @type, @location, @installation_date, @warranty_start_date, @warranty_end_date, @status, @manufacturer, @model, @vendor_id, @created_at, @updated_at)
  `).run(asset);

  return asset;
};

const getAsset = (assetId) => {
  return db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
};

const createVendor = (vendorData) => {
  const vendor = {
    id: uuidv4(),
    name: vendorData.name,
    contact: vendorData.contact,
    phone: vendorData.phone,
    email: vendorData.email,
    service_area: vendorData.service_area,
    rating: 5.0,
    total_orders: 0,
    completed_orders: 0,
    average_response_time: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.prepare(`
    INSERT INTO vendors (id, name, contact, phone, email, service_area, rating, total_orders, completed_orders, average_response_time, created_at, updated_at)
    VALUES (@id, @name, @contact, @phone, @email, @service_area, @rating, @total_orders, @completed_orders, @average_response_time, @created_at, @updated_at)
  `).run(vendor);

  return vendor;
};

const getVendor = (vendorId) => {
  return db.prepare('SELECT * FROM vendors WHERE id = ?').get(vendorId);
};

const findMergeableOrders = (assetId, description) => {
  const mergeHours = parseInt(getConfig('merge_same_asset_hours') || '24');
  const cutoffTime = moment().subtract(mergeHours, 'hours').toISOString();
  
  const orders = db.prepare(`
    SELECT * FROM work_orders 
    WHERE asset_id = ? 
    AND status IN ('submitted', 'assigned', 'in_progress')
    AND created_at >= ?
  `).all(assetId, cutoffTime);

  for (const order of orders) {
    const similarity = calculateDescriptionSimilarity(description, order.description);
    if (similarity > 0.6) {
      return order;
    }
  }
  return null;
};

const calculateDescriptionSimilarity = (desc1, desc2) => {
  if (!desc1 || !desc2) return 0;
  const words1 = new Set(desc1.toLowerCase().split(/\s+/));
  const words2 = new Set(desc2.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return union.size === 0 ? 0 : intersection.size / union.size;
};

const submitRepair = (repairData) => {
  const { asset_id, reporter_id, reporter_name, description, category, priority, callback_id } = repairData;

  if (callback_id) {
    const idempotency = checkIdempotency(callback_id);
    if (idempotency.exists) {
      return {
        success: true,
        idempotent: true,
        message: '重复请求，返回之前的结果',
        data: JSON.parse(idempotency.result || '{}')
      };
    }
  }

  const asset = getAsset(asset_id);
  if (!asset) {
    return { success: false, error: '资产不存在', code: 'ASSET_NOT_FOUND' };
  }

  const mergeableOrder = findMergeableOrders(asset_id, description);
  if (mergeableOrder) {
    const mergedOrders = mergeableOrder.merged_orders ? JSON.parse(mergeableOrder.merged_orders) : [];
    mergedOrders.push({
      reporter_id,
      reporter_name,
      description,
      merged_at: new Date().toISOString()
    });

    db.prepare(`
      UPDATE work_orders 
      SET merged_orders = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(mergedOrders), new Date().toISOString(), mergeableOrder.id);

    recordHistory(
      mergeableOrder.id,
      'MERGE',
      mergeableOrder.status,
      mergeableOrder.status,
      'system',
      'system',
      { merged_reporter: reporter_name, description }
    );

    const result = {
      merged: true,
      parent_order_id: mergeableOrder.id,
      parent_order_no: mergeableOrder.order_no,
      message: '该报修已自动合并到现有工单'
    };

    if (callback_id) {
      recordCallback(callback_id, mergeableOrder.id, 'submit_repair', 'completed', result);
    }

    return { success: true, ...result };
  }

  const inWarranty = isInWarranty(asset.warranty_end_date);
  const order = {
    id: uuidv4(),
    order_no: `WO${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    asset_id,
    vendor_id: null,
    reporter_id,
    reporter_name,
    location: asset.location,
    description,
    category,
    priority: priority || 'normal',
    status: 'submitted',
    warranty_status: inWarranty ? 'in_warranty' : 'out_of_warranty',
    fault_type: null,
    parent_order_id: null,
    merged_orders: JSON.stringify([]),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    due_at: null,
    escalated_at: null,
    completed_at: null
  };

  db.prepare(`
    INSERT INTO work_orders (id, order_no, asset_id, vendor_id, reporter_id, reporter_name, location, description, category, priority, status, warranty_status, fault_type, parent_order_id, merged_orders, created_at, updated_at, due_at, escalated_at, completed_at)
    VALUES (@id, @order_no, @asset_id, @vendor_id, @reporter_id, @reporter_name, @location, @description, @category, @priority, @status, @warranty_status, @fault_type, @parent_order_id, @merged_orders, @created_at, @updated_at, @due_at, @escalated_at, @completed_at)
  `).run(order);

  recordHistory(
    order.id,
    'SUBMIT',
    null,
    'submitted',
    reporter_name || reporter_id,
    'user',
    { asset_name: asset.name, description, category }
  );

  if (inWarranty) {
    const autoAssignResult = autoAssignToVendor(order.id, asset.vendor_id, 'system');
    if (autoAssignResult.success) {
      db.prepare(`
        UPDATE work_orders 
        SET status = 'in_progress', updated_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), order.id);

      recordHistory(
        order.id,
        'AUTO_APPROVE',
        'submitted',
        'in_progress',
        'system',
        'system',
        { reason: '保修期内自动免审' }
      );

      order.status = 'in_progress';
    }
  }

  const result = { ...order, asset };

  if (callback_id) {
    recordCallback(callback_id, order.id, 'submit_repair', 'completed', result);
  }

  return { success: true, data: result };
};

const autoAssignToVendor = (orderId, vendorId, actor) => {
  const order = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(orderId);
  if (!order) {
    return { success: false, error: '工单不存在', code: 'ORDER_NOT_FOUND' };
  }

  const vendor = vendorId ? getVendor(vendorId) : db.prepare('SELECT * FROM vendors ORDER BY rating DESC LIMIT 1').get();
  if (!vendor) {
    return { success: false, error: '没有可用的维保商', code: 'NO_VENDOR_AVAILABLE' };
  }

  const now = new Date().toISOString();
  const responseSlaHours = parseInt(getConfig('response_sla_hours') || '2');
  const dueAt = moment().add(responseSlaHours, 'hours').toISOString();

  db.prepare(`
    UPDATE work_orders 
    SET vendor_id = ?, status = 'assigned', due_at = ?, updated_at = ?
    WHERE id = ?
  `).run(vendor.id, dueAt, now, orderId);

  db.prepare(`
    UPDATE vendors 
    SET total_orders = total_orders + 1, updated_at = ?
    WHERE id = ?
  `).run(now, vendor.id);

  recordHistory(
    orderId,
    'ASSIGN',
    order.status,
    'assigned',
    actor,
    'admin',
    { vendor_id: vendor.id, vendor_name: vendor.name, due_at: dueAt }
  );

  return { success: true, vendor };
};

const assignVendor = (assignData) => {
  const { order_id, vendor_id, actor, callback_id } = assignData;

  if (callback_id) {
    const idempotency = checkIdempotency(callback_id);
    if (idempotency.exists) {
      return {
        success: true,
        idempotent: true,
        message: '重复请求，返回之前的结果',
        data: JSON.parse(idempotency.result || '{}')
      };
    }
  }

  const order = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(order_id);
  if (!order) {
    return { success: false, error: '工单不存在', code: 'ORDER_NOT_FOUND' };
  }

  if (order.status !== 'submitted' && order.status !== 'assigned') {
    return { success: false, error: `当前状态 ${order.status} 不允许派单`, code: 'INVALID_STATUS' };
  }

  const vendor = getVendor(vendor_id);
  if (!vendor) {
    return { success: false, error: '维保商不存在', code: 'VENDOR_NOT_FOUND' };
  }

  const now = new Date().toISOString();
  const responseSlaHours = parseInt(getConfig('response_sla_hours') || '2');
  const dueAt = moment().add(responseSlaHours, 'hours').toISOString();

  const oldStatus = order.status;

  db.prepare(`
    UPDATE work_orders 
    SET vendor_id = ?, status = 'assigned', due_at = ?, updated_at = ?
    WHERE id = ?
  `).run(vendor.id, dueAt, now, order_id);

  if (oldStatus === 'submitted') {
    db.prepare(`
      UPDATE vendors 
      SET total_orders = total_orders + 1, updated_at = ?
      WHERE id = ?
    `).run(now, vendor.id);
  }

  recordHistory(
    order_id,
    'ASSIGN',
    oldStatus,
    'assigned',
    actor,
    'admin',
    { vendor_id: vendor.id, vendor_name: vendor.name, due_at: dueAt }
  );

  const updatedOrder = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(order_id);
  const result = { order: updatedOrder, vendor };

  if (callback_id) {
    recordCallback(callback_id, order_id, 'assign_vendor', 'completed', result);
  }

  return { success: true, data: result };
};

const submitQuote = (quoteData) => {
  const { order_id, vendor_id, labor_cost, parts_cost, other_cost, estimated_time, quote_note, actor, callback_id } = quoteData;

  if (callback_id) {
    const idempotency = checkIdempotency(callback_id);
    if (idempotency.exists) {
      return {
        success: true,
        idempotent: true,
        message: '重复请求，返回之前的结果',
        data: JSON.parse(idempotency.result || '{}')
      };
    }
  }

  const order = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(order_id);
  if (!order) {
    return { success: false, error: '工单不存在', code: 'ORDER_NOT_FOUND' };
  }

  if (order.status !== 'assigned') {
    return { success: false, error: `当前状态 ${order.status} 不允许报价`, code: 'INVALID_STATUS' };
  }

  const total_cost = (labor_cost || 0) + (parts_cost || 0) + (other_cost || 0);
  const quote = {
    id: uuidv4(),
    order_id,
    vendor_id,
    labor_cost: labor_cost || 0,
    parts_cost: parts_cost || 0,
    other_cost: other_cost || 0,
    total_cost,
    estimated_time,
    quote_note,
    approval_status: 'pending',
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    reject_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.prepare(`
    INSERT INTO quotes (id, order_id, vendor_id, labor_cost, parts_cost, other_cost, total_cost, estimated_time, quote_note, approval_status, approved_by, approved_at, rejected_by, rejected_at, reject_reason, created_at, updated_at)
    VALUES (@id, @order_id, @vendor_id, @labor_cost, @parts_cost, @other_cost, @total_cost, @estimated_time, @quote_note, @approval_status, @approved_by, @approved_at, @rejected_by, @rejected_at, @reject_reason, @created_at, @updated_at)
  `).run(quote);

  db.prepare(`
    UPDATE work_orders 
    SET status = 'quoted', updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), order_id);

  recordHistory(
    order_id,
    'QUOTE',
    order.status,
    'quoted',
    actor,
    'vendor',
    { quote_id: quote.id, total_cost, estimated_time }
  );

  const threshold = parseFloat(getConfig('quote_threshold') || '5000');
  const needsApproval = total_cost > threshold;

  const result = {
    quote,
    needs_approval: needsApproval,
    message: needsApproval 
      ? `报价 ${total_cost} 元超过阈值 ${threshold} 元，需要审批` 
      : `报价 ${total_cost} 元在阈值内，可自动批准`
  };

  if (callback_id) {
    recordCallback(callback_id, order_id, 'submit_quote', 'completed', result);
  }

  return { success: true, data: result };
};

const approveQuote = (approvalData) => {
  const { quote_id, actor, callback_id } = approvalData;

  if (callback_id) {
    const idempotency = checkIdempotency(callback_id);
    if (idempotency.exists) {
      return {
        success: true,
        idempotent: true,
        message: '重复请求，返回之前的结果',
        data: JSON.parse(idempotency.result || '{}')
      };
    }
  }

  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quote_id);
  if (!quote) {
    return { success: false, error: '报价不存在', code: 'QUOTE_NOT_FOUND' };
  }

  if (quote.approval_status !== 'pending') {
    return { 
      success: false, 
      error: `报价已${quote.approval_status === 'approved' ? '批准' : '拒绝'}，不能重复操作`, 
      code: 'ALREADY_PROCESSED' 
    };
  }

  const order = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(quote.order_id);
  if (!order) {
    return { success: false, error: '工单不存在', code: 'ORDER_NOT_FOUND' };
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE quotes 
    SET approval_status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
    WHERE id = ?
  `).run(actor, now, now, quote_id);

  db.prepare(`
    UPDATE work_orders 
    SET status = 'in_progress', updated_at = ?
    WHERE id = ?
  `).run(now, quote.order_id);

  const expense = {
    id: uuidv4(),
    order_id: quote.order_id,
    quote_id: quote.id,
    category: 'repair',
    amount: quote.total_cost,
    payer: order.warranty_status === 'in_warranty' ? 'vendor' : 'property',
    description: `维修费：${quote.quote_note || '常规维修'}`,
    created_at: now,
    created_by: actor
  };

  db.prepare(`
    INSERT INTO expenses (id, order_id, quote_id, category, amount, payer, description, created_at, created_by)
    VALUES (@id, @order_id, @quote_id, @category, @amount, @payer, @description, @created_at, @created_by)
  `).run(expense);

  recordHistory(
    quote.order_id,
    'APPROVE',
    order.status,
    'in_progress',
    actor,
    'admin',
    { quote_id, total_cost: quote.total_cost, payer: expense.payer }
  );

  const updatedQuote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quote_id);
  const updatedOrder = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(quote.order_id);
  const result = { quote: updatedQuote, order: updatedOrder, expense };

  if (callback_id) {
    recordCallback(callback_id, quote.order_id, 'approve_quote', 'completed', result);
  }

  return { success: true, data: result };
};

const rejectQuote = (rejectData) => {
  const { quote_id, reason, actor, callback_id } = rejectData;

  if (callback_id) {
    const idempotency = checkIdempotency(callback_id);
    if (idempotency.exists) {
      return {
        success: true,
        idempotent: true,
        message: '重复请求，返回之前的结果',
        data: JSON.parse(idempotency.result || '{}')
      };
    }
  }

  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quote_id);
  if (!quote) {
    return { success: false, error: '报价不存在', code: 'QUOTE_NOT_FOUND' };
  }

  if (quote.approval_status !== 'pending') {
    return { 
      success: false, 
      error: `报价已${quote.approval_status === 'approved' ? '批准' : '拒绝'}，不能重复操作`, 
      code: 'ALREADY_PROCESSED' 
    };
  }

  const order = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(quote.order_id);
  if (!order) {
    return { success: false, error: '工单不存在', code: 'ORDER_NOT_FOUND' };
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE quotes 
    SET approval_status = 'rejected', rejected_by = ?, rejected_at = ?, reject_reason = ?, updated_at = ?
    WHERE id = ?
  `).run(actor, now, reason, now, quote_id);

  db.prepare(`
    UPDATE work_orders 
    SET status = 'assigned', updated_at = ?
    WHERE id = ?
  `).run(now, quote.order_id);

  recordHistory(
    quote.order_id,
    'REJECT',
    order.status,
    'assigned',
    actor,
    'admin',
    { quote_id, reason }
  );

  const updatedQuote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quote_id);
  const result = { quote: updatedQuote, reason };

  if (callback_id) {
    recordCallback(callback_id, quote.order_id, 'reject_quote', 'completed', result);
  }

  return { success: true, data: result };
};

const completeWork = (completeData) => {
  const { order_id, completion_note, actual_time, actor, callback_id } = completeData;

  if (callback_id) {
    const idempotency = checkIdempotency(callback_id);
    if (idempotency.exists) {
      return {
        success: true,
        idempotent: true,
        message: '重复请求，返回之前的结果',
        data: JSON.parse(idempotency.result || '{}')
      };
    }
  }

  const order = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(order_id);
  if (!order) {
    return { success: false, error: '工单不存在', code: 'ORDER_NOT_FOUND' };
  }

  if (order.status !== 'in_progress') {
    return { success: false, error: `当前状态 ${order.status} 不允许完工`, code: 'INVALID_STATUS' };
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE work_orders 
    SET status = 'completed', completed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(now, now, order_id);

  if (order.vendor_id) {
    db.prepare(`
      UPDATE vendors 
      SET completed_orders = completed_orders + 1, updated_at = ?
      WHERE id = ?
    `).run(now, order.vendor_id);
  }

  recordHistory(
    order_id,
    'COMPLETE',
    order.status,
    'completed',
    actor,
    'vendor',
    { completion_note, actual_time }
  );

  const updatedOrder = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(order_id);
  const result = { order: updatedOrder, completion_note, actual_time };

  if (callback_id) {
    recordCallback(callback_id, order_id, 'complete_work', 'completed', result);
  }

  return { success: true, data: result };
};

const updateExpense = (expenseData) => {
  const { order_id, amount, description, actor, callback_id } = expenseData;

  if (callback_id) {
    const idempotency = checkIdempotency(callback_id);
    if (idempotency.exists) {
      return {
        success: true,
        idempotent: true,
        message: '重复请求，返回之前的结果',
        data: JSON.parse(idempotency.result || '{}')
      };
    }
  }

  const order = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(order_id);
  if (!order) {
    return { success: false, error: '工单不存在', code: 'ORDER_NOT_FOUND' };
  }

  if (order.status === 'completed') {
    return { success: false, error: '工单已完工，不能修改费用', code: 'ORDER_COMPLETED' };
  }

  const existingExpense = db.prepare('SELECT * FROM expenses WHERE order_id = ?').get(order_id);
  
  if (existingExpense) {
    const diff = {
      old_amount: existingExpense.amount,
      new_amount: amount,
      old_description: existingExpense.description,
      new_description: description
    };

    db.prepare(`
      UPDATE expenses 
      SET amount = ?, description = ?, created_by = ?
      WHERE id = ?
    `).run(amount, description, actor, existingExpense.id);

    recordHistory(
      order_id,
      'CORRECT_EXPENSE',
      order.status,
      order.status,
      actor,
      'admin',
      { note: '人工修正费用' },
      diff
    );

    const updatedExpense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(existingExpense.id);
    const result = { expense: updatedExpense, diff };

    if (callback_id) {
      recordCallback(callback_id, order_id, 'update_expense', 'completed', result);
    }

    return { success: true, data: result };
  }

  const expense = {
    id: uuidv4(),
    order_id,
    quote_id: null,
    category: 'manual',
    amount,
    payer: order.warranty_status === 'in_warranty' ? 'vendor' : 'property',
    description,
    created_at: new Date().toISOString(),
    created_by: actor
  };

  db.prepare(`
    INSERT INTO expenses (id, order_id, quote_id, category, amount, payer, description, created_at, created_by)
    VALUES (@id, @order_id, @quote_id, @category, @amount, @payer, @description, @created_at, @created_by)
  `).run(expense);

  recordHistory(
    order_id,
    'ADD_EXPENSE',
    order.status,
    order.status,
    actor,
    'admin',
    { amount, description }
  );

  const result = { expense };

  if (callback_id) {
    recordCallback(callback_id, order_id, 'update_expense', 'completed', result);
  }

  return { success: true, data: result };
};

const evaluate = (evalData) => {
  const { order_id, rating, response_time_rating, quality_rating, price_rating, comment, evaluator, callback_id } = evalData;

  if (callback_id) {
    const idempotency = checkIdempotency(callback_id);
    if (idempotency.exists) {
      return {
        success: true,
        idempotent: true,
        message: '重复请求，返回之前的结果',
        data: JSON.parse(idempotency.result || '{}')
      };
    }
  }

  const order = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(order_id);
  if (!order) {
    return { success: false, error: '工单不存在', code: 'ORDER_NOT_FOUND' };
  }

  if (order.status !== 'completed') {
    return { success: false, error: `当前状态 ${order.status} 不允许评价`, code: 'INVALID_STATUS' };
  }

  const existingEval = db.prepare('SELECT * FROM evaluations WHERE order_id = ?').get(order_id);
  if (existingEval) {
    return { success: false, error: '该工单已评价，不能重复评价', code: 'ALREADY_EVALUATED' };
  }

  const evaluation = {
    id: uuidv4(),
    order_id,
    rating,
    response_time_rating,
    quality_rating,
    price_rating,
    comment,
    evaluator,
    created_at: new Date().toISOString()
  };

  db.prepare(`
    INSERT INTO evaluations (id, order_id, rating, response_time_rating, quality_rating, price_rating, comment, evaluator, created_at)
    VALUES (@id, @order_id, @rating, @response_time_rating, @quality_rating, @price_rating, @comment, @evaluator, @created_at)
  `).run(evaluation);

  db.prepare(`
    UPDATE work_orders 
    SET status = 'closed', updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), order_id);

  if (order.vendor_id) {
    const vendorEvals = db.prepare(`
      SELECT AVG(rating) as avg_rating, COUNT(*) as count
      FROM evaluations e
      JOIN work_orders wo ON e.order_id = wo.id
      WHERE wo.vendor_id = ?
    `).get(order.vendor_id);

    if (vendorEvals && vendorEvals.avg_rating) {
      db.prepare(`
        UPDATE vendors 
        SET rating = ?, updated_at = ?
        WHERE id = ?
      `).run(Math.round(vendorEvals.avg_rating * 10) / 10, new Date().toISOString(), order.vendor_id);
    }
  }

  recordHistory(
    order_id,
    'EVALUATE',
    'completed',
    'closed',
    evaluator,
    'user',
    { rating, comment }
  );

  const result = { evaluation };

  if (callback_id) {
    recordCallback(callback_id, order_id, 'evaluate', 'completed', result);
  }

  return { success: true, data: result };
};

const checkEscalation = () => {
  const escalationHours = parseInt(getConfig('escalation_hours') || '4');
  const cutoffTime = moment().subtract(escalationHours, 'hours').toISOString();

  const orders = db.prepare(`
    SELECT * FROM work_orders 
    WHERE status IN ('assigned', 'in_progress')
    AND escalated_at IS NULL
    AND created_at < ?
  `).all(cutoffTime);

  const now = new Date().toISOString();
  const results = [];

  for (const order of orders) {
    db.prepare(`
      UPDATE work_orders 
      SET escalated_at = ?, priority = 'high', updated_at = ?
      WHERE id = ?
    `).run(now, now, order.id);

    recordHistory(
      order.id,
      'ESCALATE',
      order.status,
      order.status,
      'system',
      'system',
      { 
        reason: '维保超时自动升级', 
        escalation_hours: escalationHours,
        original_priority: order.priority,
        new_priority: 'high'
      }
    );

    results.push({
      order_id: order.id,
      order_no: order.order_no,
      message: `工单 ${order.order_no} 已超时 ${escalationHours} 小时，自动升级为高优先级`
    });
  }

  return { success: true, escalated_count: results.length, details: results };
};

const getOrderDetail = (orderId) => {
  const order = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(orderId);
  if (!order) {
    return { success: false, error: '工单不存在', code: 'ORDER_NOT_FOUND' };
  }

  const asset = getAsset(order.asset_id);
  const vendor = order.vendor_id ? getVendor(order.vendor_id) : null;
  const quotes = db.prepare('SELECT * FROM quotes WHERE order_id = ? ORDER BY created_at DESC').all(orderId);
  const expenses = db.prepare('SELECT * FROM expenses WHERE order_id = ?').all(orderId);
  const history = db.prepare('SELECT * FROM order_history WHERE order_id = ? ORDER BY created_at ASC').all(orderId);
  const evaluation = db.prepare('SELECT * FROM evaluations WHERE order_id = ?').get(orderId);

  const mergedOrders = order.merged_orders ? JSON.parse(order.merged_orders) : [];

  const currentResponsible = determineCurrentResponsible(order, vendor, asset);

  return {
    success: true,
    data: {
      order,
      asset,
      vendor,
      quotes,
      expenses,
      history,
      evaluation,
      merged_orders: mergedOrders,
      current_responsible: currentResponsible,
      warranty_info: {
        in_warranty: order.warranty_status === 'in_warranty',
        warranty_end: asset ? asset.warranty_end_date : null
      }
    }
  };
};

const determineCurrentResponsible = (order, vendor, asset) => {
  const statusResponsibility = {
    'submitted': { party: 'property_manager', description: '物业经理待派单' },
    'assigned': { party: vendor ? vendor.name : 'unassigned', description: '维保商待响应' },
    'quoted': { party: 'property_manager', description: '物业经理待审批报价' },
    'in_progress': { party: vendor ? vendor.name : 'unassigned', description: '维保商维修中' },
    'completed': { party: 'user', description: '用户待评价' },
    'closed': { party: 'none', description: '工单已关闭' }
  };

  const base = statusResponsibility[order.status] || { party: 'unknown', description: '未知状态' };

  if (order.escalated_at) {
    base.escalated = true;
    base.escalated_at = order.escalated_at;
  }

  return base;
};

const getAssetHistory = (assetId) => {
  const asset = getAsset(assetId);
  if (!asset) {
    return { success: false, error: '资产不存在', code: 'ASSET_NOT_FOUND' };
  }

  const orders = db.prepare(`
    SELECT * FROM work_orders 
    WHERE asset_id = ? 
    ORDER BY created_at DESC
  `).all(assetId);

  const orderDetails = orders.map(order => {
    const quotes = db.prepare('SELECT * FROM quotes WHERE order_id = ?').all(order.id);
    const expenses = db.prepare('SELECT * FROM expenses WHERE order_id = ?').all(order.id);
    const evaluation = db.prepare('SELECT * FROM evaluations WHERE order_id = ?').get(order.id);
    return { ...order, quotes, expenses, evaluation };
  });

  const totalCost = orderDetails.reduce((sum, order) => {
    return sum + order.expenses.reduce((s, e) => s + e.amount, 0);
  }, 0);

  const vendorStats = {};
  for (const order of orderDetails) {
    if (order.vendor_id) {
      if (!vendorStats[order.vendor_id]) {
        vendorStats[order.vendor_id] = { count: 0, total_cost: 0 };
      }
      vendorStats[order.vendor_id].count++;
      vendorStats[order.vendor_id].total_cost += order.expenses.reduce((s, e) => s + e.amount, 0);
    }
  }

  return {
    success: true,
    data: {
      asset,
      total_orders: orders.length,
      total_cost: totalCost,
      warranty_status: isInWarranty(asset.warranty_end_date) ? 'in_warranty' : 'out_of_warranty',
      vendor_stats: vendorStats,
      orders: orderDetails
    }
  };
};

const searchOrders = (filters) => {
  const { status, asset_id, vendor_id, start_date, end_date, keyword } = filters;
  
  let query = 'SELECT * FROM work_orders WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (asset_id) {
    query += ' AND asset_id = ?';
    params.push(asset_id);
  }
  if (vendor_id) {
    query += ' AND vendor_id = ?';
    params.push(vendor_id);
  }
  if (start_date) {
    query += ' AND created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND created_at <= ?';
    params.push(end_date);
  }
  if (keyword) {
    query += ' AND (description LIKE ? OR order_no LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  query += ' ORDER BY created_at DESC';

  const orders = db.prepare(query).all(...params);
  return { success: true, data: orders };
};

const generateReport = (reportType, params = {}) => {
  const reports = {
    'monthly_summary': () => {
      const startDate = params.start_date || moment().startOf('month').toISOString();
      const endDate = params.end_date || moment().endOf('month').toISOString();

      const orders = db.prepare(`
        SELECT * FROM work_orders 
        WHERE created_at >= ? AND created_at <= ?
      `).all(startDate, endDate);

      const totalExpenses = db.prepare(`
        SELECT SUM(amount) as total FROM expenses e
        JOIN work_orders wo ON e.order_id = wo.id
        WHERE wo.created_at >= ? AND wo.created_at <= ?
      `).get(startDate, endDate);

      const statusBreakdown = {};
      const categoryBreakdown = {};
      const warrantyBreakdown = { in_warranty: 0, out_of_warranty: 0 };

      for (const order of orders) {
        statusBreakdown[order.status] = (statusBreakdown[order.status] || 0) + 1;
        categoryBreakdown[order.category] = (categoryBreakdown[order.category] || 0) + 1;
        if (order.warranty_status === 'in_warranty') warrantyBreakdown.in_warranty++;
        else warrantyBreakdown.out_of_warranty++;
      }

      return {
        report_type: 'monthly_summary',
        period: { start: startDate, end: endDate },
        total_orders: orders.length,
        total_cost: totalExpenses.total || 0,
        status_breakdown: statusBreakdown,
        category_breakdown: categoryBreakdown,
        warranty_breakdown: warrantyBreakdown
      };
    },

    'vendor_performance': () => {
      const vendors = db.prepare('SELECT * FROM vendors').all();
      return vendors.map(vendor => {
        const orders = db.prepare(`
          SELECT * FROM work_orders WHERE vendor_id = ?
        `).all(vendor.id);

        const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'closed');
        const avgRatingQuery = db.prepare(`
          SELECT AVG(rating) as avg_rating FROM evaluations e
          JOIN work_orders wo ON e.order_id = wo.id
          WHERE wo.vendor_id = ?
        `).get(vendor.id);

        return {
          vendor_id: vendor.id,
          vendor_name: vendor.name,
          total_orders: vendor.total_orders,
          completed_orders: vendor.completed_orders,
          completion_rate: vendor.total_orders > 0 
            ? Math.round((vendor.completed_orders / vendor.total_orders) * 100) 
            : 0,
          average_rating: avgRatingQuery.avg_rating || 0,
          current_rating: vendor.rating
        };
      });
    },

    'asset_cost_analysis': () => {
      const assets = db.prepare('SELECT * FROM assets').all();
      return assets.map(asset => {
        const orders = db.prepare('SELECT * FROM work_orders WHERE asset_id = ?').all(asset.id);
        const totalCost = db.prepare(`
          SELECT SUM(amount) as total FROM expenses e
          JOIN work_orders wo ON e.order_id = wo.id
          WHERE wo.asset_id = ?
        `).get(asset.id);

        return {
          asset_id: asset.id,
          asset_code: asset.asset_code,
          asset_name: asset.name,
          asset_type: asset.type,
          warranty_status: isInWarranty(asset.warranty_end_date) ? 'in_warranty' : 'out_of_warranty',
          warranty_end: asset.warranty_end_date,
          total_repair_count: orders.length,
          total_repair_cost: totalCost.total || 0
        };
      }).sort((a, b) => b.total_repair_cost - a.total_repair_cost);
    }
  };

  const reportGenerator = reports[reportType];
  if (!reportGenerator) {
    return { success: false, error: '未知的报告类型', code: 'UNKNOWN_REPORT_TYPE' };
  }

  return { success: true, data: reportGenerator() };
};

const listAssets = () => {
  return { success: true, data: db.prepare('SELECT * FROM assets ORDER BY created_at DESC').all() };
};

const listVendors = () => {
  return { success: true, data: db.prepare('SELECT * FROM vendors ORDER BY rating DESC').all() };
};

module.exports = {
  createAsset,
  createVendor,
  submitRepair,
  assignVendor,
  submitQuote,
  approveQuote,
  rejectQuote,
  completeWork,
  updateExpense,
  evaluate,
  checkEscalation,
  getOrderDetail,
  getAssetHistory,
  searchOrders,
  generateReport,
  listAssets,
  listVendors,
  getAsset,
  getVendor
};
