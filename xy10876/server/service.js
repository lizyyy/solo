const { dbRun, dbGet, dbAll, uuidv4 } = require('./database');

const REFUND_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  NEED_REVIEW: 'need_review',
  MANUAL_SUCCESS: 'manual_success',
  MANUAL_FAILED: 'manual_failed',
  ARCHIVED: 'archived'
};

const CHANNEL_STATUS = {
  REQUESTED: 'requested',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  UNKNOWN: 'unknown'
};

const generateRefundNo = () => {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RF${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${timestamp}${random}`;
};

const logRequest = async (refundId, action, requestData, responseData, operator, responsibilityNode) => {
  const id = uuidv4();
  const now = Date.now();
  await dbRun(
    `INSERT INTO request_logs (id, refund_id, action, request_data, response_data, operator, responsibility_node, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, refundId, action, JSON.stringify(requestData), JSON.stringify(responseData), operator, responsibilityNode, now]
  );
  return id;
};

const createPayment = async (orderNo, amount, channel) => {
  const id = uuidv4();
  const now = Date.now();
  await dbRun(
    `INSERT INTO payments (id, order_no, amount, channel, status, created_at, paid_at)
     VALUES (?, ?, ?, ?, 'success', ?, ?)`,
    [id, orderNo, amount, channel, now, now]
  );
  return id;
};

const createRefund = async (paymentOrderNo, amount, reason, operator = 'system') => {
  const payment = await dbGet(`SELECT * FROM payments WHERE order_no = ?`, [paymentOrderNo]);
  if (!payment) {
    throw new Error('支付单不存在');
  }

  const existingRefund = await dbGet(
    `SELECT * FROM refunds WHERE payment_order_no = ? AND status NOT IN ('manual_failed', 'archived')`,
    [paymentOrderNo]
  );
  if (existingRefund) {
    await logRequest(existingRefund.id, 'duplicate_create', 
      { paymentOrderNo, amount, reason }, 
      { code: 'DUPLICATE_REFUND', message: '该支付单已有进行中的退款单' },
      operator, 'create_refund_idempotent_check'
    );
    return { refund: existingRefund, isDuplicate: true };
  }

  const id = uuidv4();
  const refundNo = generateRefundNo();
  const now = Date.now();

  await dbRun(
    `INSERT INTO refunds (id, refund_no, payment_id, payment_order_no, amount, channel, status, operator, reason, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, refundNo, payment.id, paymentOrderNo, amount, payment.channel, REFUND_STATUS.PENDING, operator, reason, now, now]
  );

  await logRequest(id, 'create_refund', 
    { paymentOrderNo, amount, reason }, 
    { refundNo, status: REFUND_STATUS.PENDING },
    operator, 'create_refund_handler'
  );

  const refund = await dbGet(`SELECT * FROM refunds WHERE id = ?`, [id]);
  return { refund, isDuplicate: false };
};

const simulateChannelResponse = () => {
  const rand = Math.random();
  if (rand < 0.3) return { status: CHANNEL_STATUS.SUCCESS, message: '退款成功' };
  if (rand < 0.6) return { status: CHANNEL_STATUS.PROCESSING, message: '处理中，请稍后查询' };
  if (rand < 0.8) return { status: CHANNEL_STATUS.FAILED, message: '渠道处理失败：余额不足' };
  return { status: CHANNEL_STATUS.UNKNOWN, message: '渠道响应超时，状态未知' };
};

const submitToChannel = async (refundId, operator = 'system') => {
  const refund = await dbGet(`SELECT * FROM refunds WHERE id = ?`, [refundId]);
  if (!refund) throw new Error('退款单不存在');

  const allowedStatuses = [REFUND_STATUS.PENDING, REFUND_STATUS.FAILED];
  if (!allowedStatuses.includes(refund.status)) {
    await logRequest(refundId, 'submit_to_channel_invalid', 
      { currentStatus: refund.status }, 
      { code: 'INVALID_STATUS', message: '当前状态不允许提交渠道' },
      operator, 'submit_status_check'
    );
    throw new Error(`当前状态 ${refund.status} 不允许提交渠道`);
  }

  const now = Date.now();
  const channelStatusId = uuidv4();
  const channelResponse = simulateChannelResponse();

  await dbRun(
    `INSERT INTO channel_status (id, refund_id, channel_refund_id, status, channel_response, requested_at, responded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [channelStatusId, refundId, `CH${uuidv4().slice(0, 8)}`, channelResponse.status, JSON.stringify(channelResponse), now, now + 100]
  );

  const newRetryCount = refund.retry_count + 1;
  let newStatus = REFUND_STATUS.PROCESSING;

  if (channelResponse.status === CHANNEL_STATUS.SUCCESS) {
    newStatus = REFUND_STATUS.SUCCESS;
  } else if (channelResponse.status === CHANNEL_STATUS.FAILED) {
    if (newRetryCount >= refund.max_retries) {
      newStatus = REFUND_STATUS.NEED_REVIEW;
    } else {
      newStatus = REFUND_STATUS.FAILED;
    }
  }

  await dbRun(
    `UPDATE refunds SET status = ?, retry_count = ?, updated_at = ? WHERE id = ?`,
    [newStatus, newRetryCount, now, refundId]
  );

  await logRequest(refundId, 'submit_to_channel', 
    { refundNo: refund.refund_no, retryCount: newRetryCount }, 
    { channelResponse, newStatus },
    operator, 'channel_submit_handler'
  );

  return {
    refund: await dbGet(`SELECT * FROM refunds WHERE id = ?`, [refundId]),
    channelResponse,
    channelStatusId
  };
};

const queryChannelStatus = async (refundId, operator = 'system') => {
  const refund = await dbGet(`SELECT * FROM refunds WHERE id = ?`, [refundId]);
  if (!refund) throw new Error('退款单不存在');

  if (refund.status !== REFUND_STATUS.PROCESSING) {
    throw new Error('只有处理中状态可以查询渠道');
  }

  const queryResponse = simulateChannelResponse();
  const now = Date.now();

  let newStatus = refund.status;
  if (queryResponse.status === CHANNEL_STATUS.SUCCESS) {
    newStatus = REFUND_STATUS.SUCCESS;
  } else if (queryResponse.status === CHANNEL_STATUS.FAILED) {
    newStatus = REFUND_STATUS.FAILED;
  }

  await dbRun(
    `UPDATE refunds SET status = ?, updated_at = ? WHERE id = ?`,
    [newStatus, now, refundId]
  );

  await dbRun(
    `INSERT INTO channel_status (id, refund_id, status, channel_response, requested_at, responded_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuidv4(), refundId, queryResponse.status, JSON.stringify(queryResponse), now, now]
  );

  await logRequest(refundId, 'query_channel', 
    { refundNo: refund.refund_no }, 
    { queryResponse, newStatus },
    operator, 'channel_query_handler'
  );

  return {
    refund: await dbGet(`SELECT * FROM refunds WHERE id = ?`, [refundId]),
    queryResponse
  };
};

const manualReview = async (refundId, reviewer, comment, decision) => {
  const refund = await dbGet(`SELECT * FROM refunds WHERE id = ?`, [refundId]);
  if (!refund) throw new Error('退款单不存在');

  if (refund.status !== REFUND_STATUS.NEED_REVIEW) {
    throw new Error('只有需复核状态可以人工处理');
  }

  const id = uuidv4();
  const now = Date.now();
  const newStatus = decision === 'approve' ? REFUND_STATUS.MANUAL_SUCCESS : REFUND_STATUS.MANUAL_FAILED;

  await dbRun(
    `INSERT INTO manual_reviews (id, refund_id, reviewer, comment, decision, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, refundId, reviewer, comment, decision, now]
  );

  await dbRun(
    `UPDATE refunds SET status = ?, updated_at = ? WHERE id = ?`,
    [newStatus, now, refundId]
  );

  await logRequest(refundId, 'manual_review', 
    { reviewer, comment, decision }, 
    { newStatus },
    reviewer, 'manual_review_handler'
  );

  return {
    refund: await dbGet(`SELECT * FROM refunds WHERE id = ?`, [refundId]),
    reviewId: id
  };
};

const archiveReceipt = async (refundId, operator = 'system') => {
  const refund = await dbGet(`SELECT * FROM refunds WHERE id = ?`, [refundId]);
  if (!refund) throw new Error('退款单不存在');

  const completedStatuses = [REFUND_STATUS.SUCCESS, REFUND_STATUS.MANUAL_SUCCESS, REFUND_STATUS.MANUAL_FAILED];
  if (!completedStatuses.includes(refund.status)) {
    throw new Error('只有终态退款单可以归档');
  }

  const existingReceipt = await dbGet(`SELECT * FROM receipts WHERE refund_id = ?`, [refundId]);
  if (existingReceipt) {
    return { receipt: existingReceipt, isDuplicate: true };
  }

  const id = uuidv4();
  const now = Date.now();
  const receiptData = {
    refund,
    channelStatuses: await dbAll(`SELECT * FROM channel_status WHERE refund_id = ?`, [refundId]),
    reviews: await dbAll(`SELECT * FROM manual_reviews WHERE refund_id = ?`, [refundId]),
    logs: await dbAll(`SELECT * FROM request_logs WHERE refund_id = ?`, [refundId])
  };

  await dbRun(
    `INSERT INTO receipts (id, refund_id, receipt_data, archived_at) VALUES (?, ?, ?, ?)`,
    [id, refundId, JSON.stringify(receiptData), now]
  );

  await dbRun(
    `UPDATE refunds SET status = ?, updated_at = ? WHERE id = ?`,
    [REFUND_STATUS.ARCHIVED, now, refundId]
  );

  await logRequest(refundId, 'archive_receipt', 
    { refundNo: refund.refund_no }, 
    { receiptId: id },
    operator, 'receipt_archiver'
  );

  return {
    receipt: await dbGet(`SELECT * FROM receipts WHERE id = ?`, [id]),
    isDuplicate: false
  };
};

const getRefundDetail = async (refundId) => {
  const refund = await dbGet(`SELECT * FROM refunds WHERE id = ?`, [refundId]);
  if (!refund) return null;

  return {
    refund,
    payment: await dbGet(`SELECT * FROM payments WHERE id = ?`, [refund.payment_id]),
    channelStatuses: await dbAll(`SELECT * FROM channel_status WHERE refund_id = ? ORDER BY requested_at DESC`, [refundId]),
    reviews: await dbAll(`SELECT * FROM manual_reviews WHERE refund_id = ? ORDER BY created_at DESC`, [refundId]),
    logs: await dbAll(`SELECT * FROM request_logs WHERE refund_id = ? ORDER BY created_at DESC`, [refundId]),
    receipt: await dbGet(`SELECT * FROM receipts WHERE refund_id = ?`, [refundId])
  };
};

const searchRefunds = async (params = {}) => {
  let sql = `SELECT r.*, p.amount as payment_amount FROM refunds r LEFT JOIN payments p ON r.payment_id = p.id WHERE 1=1`;
  const queryParams = [];

  if (params.refundNo) {
    sql += ` AND r.refund_no LIKE ?`;
    queryParams.push(`%${params.refundNo}%`);
  }
  if (params.paymentOrderNo) {
    sql += ` AND r.payment_order_no LIKE ?`;
    queryParams.push(`%${params.paymentOrderNo}%`);
  }
  if (params.status) {
    sql += ` AND r.status = ?`;
    queryParams.push(params.status);
  }
  if (params.channel) {
    sql += ` AND r.channel = ?`;
    queryParams.push(params.channel);
  }

  sql += ` ORDER BY r.created_at DESC`;

  if (params.limit) {
    sql += ` LIMIT ?`;
    queryParams.push(parseInt(params.limit));
  }

  const refunds = await dbAll(sql, queryParams);
  return refunds;
};

const getAllLogs = async (limit = 100) => {
  return await dbAll(
    `SELECT l.*, r.refund_no FROM request_logs l LEFT JOIN refunds r ON l.refund_id = r.id ORDER BY l.created_at DESC LIMIT ?`,
    [limit]
  );
};

const exportData = async (type, startDate, endDate) => {
  let sql, data;
  const startTs = startDate ? new Date(startDate).getTime() : 0;
  const endTs = endDate ? new Date(endDate).getTime() : Date.now();

  switch (type) {
    case 'refunds':
      data = await dbAll(
        `SELECT * FROM refunds WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC`,
        [startTs, endTs]
      );
      break;
    case 'logs':
      data = await dbAll(
        `SELECT * FROM request_logs WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC`,
        [startTs, endTs]
      );
      break;
    default:
      throw new Error('不支持的导出类型');
  }

  return { type, count: data.length, data, exportTime: new Date().toISOString() };
};

const fixDirtyData = async (refundId, newStatus, operator) => {
  const refund = await dbGet(`SELECT * FROM refunds WHERE id = ?`, [refundId]);
  if (!refund) throw new Error('退款单不存在');

  if (refund.status === REFUND_STATUS.ARCHIVED) {
    await logRequest(refundId, 'fix_dirty_data_denied', 
      { oldStatus: refund.status, newStatus, reason: '已归档数据禁止修改' }, 
      { success: false, code: 'ARCHIVED_DATA_PROTECTED' },
      operator, 'data_correction_handler'
    );
    throw new Error('已归档的退款单禁止修改，保证数据完整性');
  }

  const validStatuses = Object.values(REFUND_STATUS);
  if (!validStatuses.includes(newStatus)) {
    await logRequest(refundId, 'fix_dirty_data_denied', 
      { oldStatus: refund.status, newStatus, reason: '无效的目标状态' }, 
      { success: false, code: 'INVALID_STATUS', validStatuses },
      operator, 'data_correction_handler'
    );
    throw new Error(`无效的目标状态: ${newStatus}。合法状态: ${validStatuses.join(', ')}`);
  }

  const now = Date.now();
  await dbRun(
    `UPDATE refunds SET status = ?, updated_at = ? WHERE id = ?`,
    [newStatus, now, refundId]
  );

  await logRequest(refundId, 'fix_dirty_data', 
    { oldStatus: refund.status, newStatus }, 
    { success: true },
    operator, 'data_correction_handler'
  );

  return await dbGet(`SELECT * FROM refunds WHERE id = ?`, [refundId]);
};

module.exports = {
  REFUND_STATUS,
  CHANNEL_STATUS,
  logRequest,
  createPayment,
  createRefund,
  submitToChannel,
  queryChannelStatus,
  manualReview,
  archiveReceipt,
  getRefundDetail,
  searchRefunds,
  getAllLogs,
  exportData,
  fixDirtyData
};
