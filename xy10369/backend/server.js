const express = require('express');
const cors = require('cors');
const { initDatabase, run, get, all, hashIdCard, uuidv4 } = require('./database');
const seedData = require('./seed');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const initializeDatabase = async () => {
  await initDatabase();
  
  const existingCustomers = all('SELECT COUNT(*) as count FROM customers');
  if (existingCustomers[0] && existingCustomers[0].count === 0) {
    console.log('数据库为空，开始初始化种子数据...');
    seedData();
  } else {
    console.log('数据库已有数据，跳过种子数据初始化');
  }
};

const getRecordWithDetails = (recordNo) => {
  const record = get(`
    SELECT mr.*, c.name as customer_name, c.id_card_hash as customer_id_card_hash,
           c.gender, c.birthday, c.phone, p.name as package_name, p.code as package_code
    FROM medical_records mr
    JOIN customers c ON mr.customer_id = c.id
    JOIN packages p ON mr.package_id = p.id
    WHERE mr.record_no = ?
  `, [recordNo]);

  if (!record) return null;

  const items = all(`
    SELECT ri.*, pi.item_code, pi.item_name, pi.department, pi.sort_order
    FROM record_items ri
    JOIN package_items pi ON ri.item_id = pi.id
    WHERE ri.record_id = ?
    ORDER BY pi.sort_order
  `, [record.id]);

  const receiveHistory = all(`
    SELECT rr.*, pr.reason as print_reason, pr.request_type
    FROM receive_records rr
    LEFT JOIN print_requests pr ON rr.request_id = pr.id
    WHERE rr.record_id = ?
    ORDER BY rr.receive_time DESC
  `, [record.id]);

  return {
    ...record,
    items,
    receiveHistory,
    receiveCount: receiveHistory.length,
    hasReceivedBefore: receiveHistory.length > 0
  };
};

const searchCustomerRecords = (searchType, searchValue) => {
  let records = [];

  if (searchType === 'recordNo') {
    const record = getRecordWithDetails(searchValue);
    if (record) records = [record];
  } else if (searchType === 'idCard') {
    const idCardHash = hashIdCard(searchValue);
    const recordIds = all(`
      SELECT mr.id, mr.record_no
      FROM medical_records mr
      JOIN customers c ON mr.customer_id = c.id
      WHERE c.id_card_hash = ?
      ORDER BY mr.check_date DESC
    `, [idCardHash]);

    records = recordIds.map(r => getRecordWithDetails(r.record_no));
  }

  return records;
};

const checkPrintEligibility = (recordId) => {
  const items = all('SELECT * FROM record_items WHERE record_id = ?', [recordId]);

  const pendingItems = items.filter(item => item.status !== 'completed');
  const pendingRecheckItems = items.filter(item => item.need_recheck === 1 && item.recheck_status === 'pending');

  const issues = [];
  let canPrint = true;

  if (pendingItems.length > 0) {
    canPrint = false;
    issues.push({
      type: 'incomplete_items',
      message: `存在 ${pendingItems.length} 项未完成项目，无法补打`,
      items: pendingItems
    });
  }

  if (pendingRecheckItems.length > 0) {
    issues.push({
      type: 'recheck_pending',
      message: `存在 ${pendingRecheckItems.length} 项复检未处理，请提醒客户`,
      items: pendingRecheckItems,
      warning: true
    });
  }

  return {
    canPrint,
    issues,
    totalItems: items.length,
    completedItems: items.filter(i => i.status === 'completed').length
  };
};

const verifyIdentity = (recordId, receiverName, receiverIdCard) => {
  const record = get(`
    SELECT c.name, c.id_card_hash
    FROM medical_records mr
    JOIN customers c ON mr.customer_id = c.id
    WHERE mr.id = ?
  `, [recordId]);

  if (!record) {
    return { valid: false, message: '记录不存在' };
  }

  const receiverIdCardHash = hashIdCard(receiverIdCard);
  const isSelf = record.id_card_hash === receiverIdCardHash;

  if (isSelf) {
    if (record.name !== receiverName) {
      return {
        valid: false,
        message: '身份核验失败：姓名与身份证信息不匹配',
        detail: `系统记录姓名：${record.name}，输入姓名：${receiverName}`
      };
    }
    return { valid: true, relation: '本人' };
  } else {
    return {
      valid: true,
      relation: '代领',
      warning: true,
      message: '代领，请核验代领人身份并登记'
    };
  }
};

const processPrintRequest = (recordId, requestType, reason, operator) => {
  const record = get('SELECT * FROM medical_records WHERE id = ?', [recordId]);

  if (!record) {
    return { success: false, message: '记录不存在' };
  }

  const eligibility = checkPrintEligibility(recordId);
  if (!eligibility.canPrint) {
    return {
      success: false,
      message: '不符合补打条件',
      issues: eligibility.issues
    };
  }

  const receiveCount = get('SELECT COUNT(*) as count FROM receive_records WHERE record_id = ?', [recordId]).count;

  const isReprint = receiveCount > 0;

  if (isReprint && (!reason || reason.trim() === '')) {
    return {
      success: false,
      message: '重复补打必须填写原因',
      isReprint: true
    };
  }

  const requestId = uuidv4();
  run(
    'INSERT INTO print_requests (id, record_id, request_type, reason, operator, status) VALUES (?, ?, ?, ?, ?, ?)',
    [requestId, recordId, requestType, reason || '首次领取', operator, 'completed']
  );

  run(
    'INSERT INTO audit_logs (id, record_id, action, details, operator) VALUES (?, ?, ?, ?, ?)',
    [
      uuidv4(),
      recordId,
      isReprint ? '重复补打申请' : '首次打印申请',
      isReprint ? `补打原因：${reason}` : '首次打印',
      operator
    ]
  );

  return {
    success: true,
    requestId,
    isReprint,
    warnings: eligibility.issues.filter(i => i.warning)
  };
};

const confirmReceive = (recordId, requestId, receiverName, receiverIdCard, relation, operator) => {
  const identityCheck = verifyIdentity(recordId, receiverName, receiverIdCard);

  if (!identityCheck.valid) {
    return {
      success: false,
      message: identityCheck.message,
      detail: identityCheck.detail
    };
  }

  const receiveId = uuidv4();
  run(
    `INSERT INTO receive_records (id, record_id, request_id, receiver_name, receiver_id_card_hash, relation, operator)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      receiveId,
      recordId,
      requestId || null,
      receiverName,
      hashIdCard(receiverIdCard),
      relation || identityCheck.relation,
      operator
    ]
  );

  run(
    'INSERT INTO audit_logs (id, record_id, action, details, operator) VALUES (?, ?, ?, ?, ?)',
    [
      uuidv4(),
      recordId,
      '领取确认',
      `领取人：${receiverName}，关系：${relation || identityCheck.relation}`,
      operator
    ]
  );

  return {
    success: true,
    receiveId,
    warning: identityCheck.warning ? identityCheck.message : null
  };
};

const getAuditLogs = (startDate, endDate) => {
  let query = `
    SELECT al.*, mr.record_no, c.name as customer_name
    FROM audit_logs al
    LEFT JOIN medical_records mr ON al.record_id = mr.id
    LEFT JOIN customers c ON mr.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (startDate) {
    query += ' AND date(al.created_at) >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND date(al.created_at) <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY al.created_at DESC';

  return all(query, params);
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/search', (req, res) => {
  try {
    const { searchType, searchValue } = req.body;

    if (!searchType || !searchValue) {
      return res.status(400).json({ error: '请提供查询类型和值' });
    }

    const records = searchCustomerRecords(searchType, searchValue);

    res.json({
      success: true,
      count: records.length,
      records
    });
  } catch (err) {
    console.error('查询错误:', err);
    res.status(500).json({ error: '查询失败', message: err.message });
  }
});

app.get('/api/records/:recordNo', (req, res) => {
  try {
    const record = getRecordWithDetails(req.params.recordNo);

    if (!record) {
      return res.status(404).json({ error: '未找到该记录' });
    }

    res.json({ success: true, record });
  } catch (err) {
    console.error('获取记录错误:', err);
    res.status(500).json({ error: '获取记录失败', message: err.message });
  }
});

app.post('/api/check-eligibility/:recordId', (req, res) => {
  try {
    const eligibility = checkPrintEligibility(req.params.recordId);
    res.json({ success: true, ...eligibility });
  } catch (err) {
    console.error('检查资格错误:', err);
    res.status(500).json({ error: '检查资格失败', message: err.message });
  }
});

app.post('/api/verify-identity', (req, res) => {
  try {
    const { recordId, receiverName, receiverIdCard } = req.body;

    if (!recordId || !receiverName || !receiverIdCard) {
      return res.status(400).json({ error: '请提供完整的身份信息' });
    }

    const result = verifyIdentity(recordId, receiverName, receiverIdCard);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('身份核验错误:', err);
    res.status(500).json({ error: '身份核验失败', message: err.message });
  }
});

app.post('/api/print-request', (req, res) => {
  try {
    const { recordId, requestType, reason, operator } = req.body;

    if (!recordId || !requestType || !operator) {
      return res.status(400).json({ error: '请提供必要的参数' });
    }

    const result = processPrintRequest(
      recordId,
      requestType,
      reason,
      operator
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('打印申请错误:', err);
    res.status(500).json({ error: '打印申请失败', message: err.message });
  }
});

app.post('/api/confirm-receive', (req, res) => {
  try {
    const { recordId, requestId, receiverName, receiverIdCard, relation, operator } = req.body;

    if (!recordId || !receiverName || !receiverIdCard || !operator) {
      return res.status(400).json({ error: '请提供必要的参数' });
    }

    const result = confirmReceive(
      recordId,
      requestId,
      receiverName,
      receiverIdCard,
      relation,
      operator
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('领取确认错误:', err);
    res.status(500).json({ error: '领取确认失败', message: err.message });
  }
});

app.get('/api/audit-logs', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const logs = getAuditLogs(startDate, endDate);

    res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (err) {
    console.error('获取审计日志错误:', err);
    res.status(500).json({ error: '获取审计日志失败', message: err.message });
  }
});

app.get('/api/export-audit', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const logs = getAuditLogs(startDate, endDate);

    const headers = ['时间', '档案编号', '客户姓名', '操作类型', '详情', '操作人'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => [
        log.created_at,
        log.record_no || '',
        log.customer_name || '',
        log.action,
        `"${(log.details || '').replace(/"/g, '""')}"`,
        log.operator
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit_log_${Date.now()}.csv"`);
    res.send('\ufeff' + csvContent);
  } catch (err) {
    console.error('导出审计日志错误:', err);
    res.status(500).json({ error: '导出审计日志失败', message: err.message });
  }
});

const startServer = async () => {
  try {
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`体检中心报告补打台后端服务已启动`);
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log('');
      console.log('测试数据账号：');
      console.log('1. 张三 - 身份证: 110101199001011234 (正常补打)');
      console.log('2. 李四 - 身份证: 110101199002022345 (未完成项目)');
      console.log('3. 王五 - 身份证: 110101199003033456 (复检未完成)');
      console.log('4. 赵六 - 身份证: 110101199004044567 (重复补打)');
    });
  } catch (err) {
    console.error('启动服务器失败:', err);
    process.exit(1);
  }
};

startServer();
