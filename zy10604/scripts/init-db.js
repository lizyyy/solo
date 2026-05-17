const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dbDir, 'settlement.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('已连接到 SQLite 数据库');
});

db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`);

  db.run(`
    CREATE TABLE IF NOT EXISTS compensation_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_no VARCHAR(64) NOT NULL,
      batch_no VARCHAR(64) NOT NULL,
      recipient_id VARCHAR(64) NOT NULL,
      recipient_name VARCHAR(128) NOT NULL,
      recipient_type VARCHAR(32) NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      fail_reason TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      evidence TEXT,
      evidence_version INTEGER DEFAULT 1,
      operator VARCHAR(64),
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(transaction_no, recipient_id, batch_no)
    )
  `);
  console.log('创建表: compensation_records');

  db.run(`
    CREATE TABLE IF NOT EXISTS compensation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      transaction_no VARCHAR(64) NOT NULL,
      batch_no VARCHAR(64) NOT NULL,
      recipient_id VARCHAR(64) NOT NULL,
      old_status VARCHAR(32),
      new_status VARCHAR(32) NOT NULL,
      old_evidence TEXT,
      new_evidence TEXT,
      evidence_version INTEGER,
      operation_type VARCHAR(32) NOT NULL,
      operator VARCHAR(64),
      operation_remark TEXT,
      source VARCHAR(32),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES compensation_records(id)
    )
  `);
  console.log('创建表: compensation_history');

  db.run(`CREATE INDEX IF NOT EXISTS idx_transaction_no ON compensation_records(transaction_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_status ON compensation_records(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_batch_no ON compensation_records(batch_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_history_record_id ON compensation_history(record_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_history_transaction ON compensation_history(transaction_no)`);
  console.log('创建索引完成');

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO compensation_records 
    (transaction_no, batch_no, recipient_id, recipient_name, recipient_type, amount, fail_reason, status, evidence, evidence_version, operator, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const historyStmt = db.prepare(`
    INSERT INTO compensation_history 
    (record_id, transaction_no, batch_no, recipient_id, old_status, new_status, old_evidence, new_evidence, evidence_version, operation_type, operator, operation_remark, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sampleData = [
    {
      transaction_no: 'TXN2026051800001',
      batch_no: 'BATCH20260518001',
      recipient_id: 'MERCH001',
      recipient_name: '商户A',
      recipient_type: 'MERCHANT',
      amount: 1500.00,
      fail_reason: '账户余额不足',
      status: 'PENDING',
      evidence: JSON.stringify({ errorCode: 'INSUFFICIENT_BALANCE', timestamp: '2026-05-18T10:00:00Z' }),
      evidence_version: 1,
      operator: 'system',
      remark: '首次分账失败'
    },
    {
      transaction_no: 'TXN2026051800001',
      batch_no: 'BATCH20260518001',
      recipient_id: 'MERCH002',
      recipient_name: '商户B',
      recipient_type: 'MERCHANT',
      amount: 800.50,
      fail_reason: '账户状态异常',
      status: 'COMPENSATING',
      evidence: JSON.stringify({ errorCode: 'ACCOUNT_FROZEN', timestamp: '2026-05-18T10:05:00Z', retryCount: 2 }),
      evidence_version: 2,
      operator: 'system',
      remark: '补偿重试中'
    },
    {
      transaction_no: 'TXN2026051800002',
      batch_no: 'BATCH20260518002',
      recipient_id: 'MERCH003',
      recipient_name: '商户C',
      recipient_type: 'MERCHANT',
      amount: 2500.00,
      fail_reason: '网络超时',
      status: 'COMPENSATED',
      evidence: JSON.stringify({ errorCode: 'NETWORK_TIMEOUT', timestamp: '2026-05-18T11:00:00Z', successTime: '2026-05-18T11:30:00Z' }),
      evidence_version: 2,
      operator: 'system',
      remark: '已补偿成功'
    },
    {
      transaction_no: 'TXN2026051800003',
      batch_no: 'BATCH20260518003',
      recipient_id: 'MERCH004',
      recipient_name: '商户D',
      recipient_type: 'MERCHANT',
      amount: 5000.00,
      fail_reason: '金额超限',
      status: 'MANUAL_REQUIRED',
      evidence: JSON.stringify({ errorCode: 'AMOUNT_EXCEED_LIMIT', limit: 3000, timestamp: '2026-05-18T12:00:00Z' }),
      evidence_version: 1,
      operator: 'system',
      remark: '需人工审核'
    }
  ];

  sampleData.forEach((data, index) => {
    insertStmt.run(
      data.transaction_no, data.batch_no, data.recipient_id, data.recipient_name,
      data.recipient_type, data.amount, data.fail_reason, data.status, data.evidence,
      data.evidence_version, data.operator, data.remark,
      function(err) {
        if (err) {
          console.error('插入数据失败:', err);
        } else {
          const recordId = this.lastID;
          historyStmt.run(
            recordId, data.transaction_no, data.batch_no, data.recipient_id,
            null, data.status, null, data.evidence, data.evidence_version,
            'INIT', data.operator, '初始化记录', 'SYSTEM'
          );

          if (data.status === 'COMPENSATING' || data.status === 'COMPENSATED') {
            historyStmt.run(
              recordId, data.transaction_no, data.batch_no, data.recipient_id,
              'PENDING', data.status,
              JSON.stringify({ errorCode: data.fail_reason, timestamp: '2026-05-18T10:00:00Z' }),
              data.evidence, data.evidence_version,
              'STATUS_CHANGE', 'system', '状态变更', 'SYSTEM'
            );
          }
        }
      }
    );
  });

  insertStmt.finalize();
  historyStmt.finalize();
  console.log('示例数据初始化完成');

  const conflictData = {
    transaction_no: 'TXN2026051800004',
    batch_no: 'BATCH20260518004',
    recipient_id: 'MERCH005',
    recipient_name: '商户E',
    recipient_type: 'MERCHANT',
    amount: 3200.00,
    fail_reason: '上游超时，异步回调成功',
    status: 'CONFLICT',
    evidence: JSON.stringify({ 
      errorCode: 'UPSTREAM_TIMEOUT', 
      timeoutTime: '2026-05-18T14:00:00Z',
      callbackSuccessTime: '2026-05-18T14:05:00Z',
      duplicateCompensationTime: '2026-05-18T14:10:00Z',
      detectedTime: '2026-05-18T14:15:00Z',
      handler: 'operator_zhang',
      handledTime: '2026-05-18T14:30:00Z',
      handlingResult: '已追回重复款项'
    }),
    evidence_version: 3,
    operator: 'operator_zhang',
    remark: '冲突记录：重复补偿已处理'
  };

  db.run(`
    INSERT OR IGNORE INTO compensation_records 
    (transaction_no, batch_no, recipient_id, recipient_name, recipient_type, amount, fail_reason, status, evidence, evidence_version, operator, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    conflictData.transaction_no, conflictData.batch_no, conflictData.recipient_id, conflictData.recipient_name,
    conflictData.recipient_type, conflictData.amount, conflictData.fail_reason, conflictData.status, conflictData.evidence,
    conflictData.evidence_version, conflictData.operator, conflictData.remark
  ], function(err) {
    if (err) {
      console.error('插入冲突数据失败:', err);
    } else {
      const recordId = this.lastID;
      
      const conflictHistory = [
        { oldStatus: null, newStatus: 'PENDING', opType: 'INIT', remark: '超时触发补偿登记', evidence: JSON.stringify({ errorCode: 'UPSTREAM_TIMEOUT', timeoutTime: '2026-05-18T14:00:00Z' }), version: 1, source: 'ASYNC_CALLBACK' },
        { oldStatus: 'PENDING', newStatus: 'COMPENSATING', opType: 'STATUS_CHANGE', remark: '系统自动发起补偿', evidence: JSON.stringify({ errorCode: 'UPSTREAM_TIMEOUT', timeoutTime: '2026-05-18T14:00:00Z', retryTime: '2026-05-18T14:08:00Z' }), version: 2, source: 'SYSTEM' },
        { oldStatus: 'COMPENSATING', newStatus: 'CONFLICT', opType: 'CONFLICT_DETECT', remark: '检测到上游异步成功，存在重复补偿风险', evidence: conflictData.evidence, version: 3, source: 'RECONCILIATION' }
      ];

      conflictHistory.forEach(h => {
        db.run(`
          INSERT INTO compensation_history 
          (record_id, transaction_no, batch_no, recipient_id, old_status, new_status, old_evidence, new_evidence, evidence_version, operation_type, operator, operation_remark, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [recordId, conflictData.transaction_no, conflictData.batch_no, conflictData.recipient_id,
            h.oldStatus, h.newStatus, null, h.evidence, h.version, h.opType, conflictData.operator, h.remark, h.source]);
      });

      console.log('冲突记录及其历史已插入');
    }
  });

  const badData = {
    transaction_no: 'TXN2026051800005',
    batch_no: 'BATCH20260518005',
    recipient_id: 'MERCH006',
    recipient_name: '商户F',
    recipient_type: 'MERCHANT',
    amount: -100.00,
    fail_reason: '导入数据异常：金额为负',
    status: 'IMPORT_ERROR',
    evidence: JSON.stringify({ 
      importSource: 'EXCEL',
      importTime: '2026-05-18T15:00:00Z',
      importOperator: 'operator_li',
      rowNumber: 15,
      errorFields: ['amount'],
      rawData: { transaction_no: 'TXN2026051800005', amount: -100 }
    }),
    evidence_version: 1,
    operator: 'operator_li',
    remark: '导入坏行：金额校验失败'
  };

  db.run(`
    INSERT OR IGNORE INTO compensation_records 
    (transaction_no, batch_no, recipient_id, recipient_name, recipient_type, amount, fail_reason, status, evidence, evidence_version, operator, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    badData.transaction_no, badData.batch_no, badData.recipient_id, badData.recipient_name,
    badData.recipient_type, badData.amount, badData.fail_reason, badData.status, badData.evidence,
    badData.evidence_version, badData.operator, badData.remark
  ], function(err) {
    if (err) {
      console.error('插入坏行数据失败:', err);
    } else {
      const recordId = this.lastID;
      db.run(`
        INSERT INTO compensation_history 
        (record_id, transaction_no, batch_no, recipient_id, old_status, new_status, old_evidence, new_evidence, evidence_version, operation_type, operator, operation_remark, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [recordId, badData.transaction_no, badData.batch_no, badData.recipient_id,
          null, badData.status, null, badData.evidence, 1, 'IMPORT', badData.operator, '导入失败，数据校验不通过', 'IMPORT']);
      console.log('坏行记录已插入');
    }
  });
});

db.close((err) => {
  if (err) {
    console.error('关闭数据库失败:', err.message);
  } else {
    console.log('数据库初始化完成！');
    console.log('数据库路径:', dbPath);
  }
});
