const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'src/models');

const orderModel = `const db = require('../config/database');

const Order = {
  create: (order, callback) => {
    const sql = \`INSERT INTO orders 
      (order_id, user_id, charger_id, start_time, end_time, charge_amount, amount, status, platform_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\`;
    db.run(sql, [
      order.order_id,
      order.user_id,
      order.charger_id,
      order.start_time,
      order.end_time,
      order.charge_amount,
      order.amount,
      order.status,
      order.platform_source
    ], callback);
  },

  findById: (orderId, callback) => {
    const sql = 'SELECT * FROM orders WHERE order_id = ?';
    db.get(sql, [orderId], callback);
  },

  findAll: (callback) => {
    const sql = 'SELECT * FROM orders ORDER BY start_time DESC';
    db.all(sql, callback);
  },

  findByDateRange: (startDate, endDate, callback) => {
    const sql = 'SELECT * FROM orders WHERE start_time >= ? AND start_time <= ? ORDER BY start_time DESC';
    db.all(sql, [startDate, endDate], callback);
  },

  update: (orderId, order, callback) => {
    const sql = \`UPDATE orders SET 
      user_id = ?, charger_id = ?, start_time = ?, end_time = ?, 
      charge_amount = ?, amount = ?, status = ?, platform_source = ?
      WHERE order_id = ?\`;
    db.run(sql, [
      order.user_id,
      order.charger_id,
      order.start_time,
      order.end_time,
      order.charge_amount,
      order.amount,
      order.status,
      order.platform_source,
      orderId
    ], callback);
  },

  delete: (orderId, callback) => {
    const sql = 'DELETE FROM orders WHERE order_id = ?';
    db.run(sql, [orderId], callback);
  },

  bulkInsert: (orders, callback) => {
    const placeholders = orders.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = orders.flatMap(order => [
      order.order_id,
      order.user_id,
      order.charger_id,
      order.start_time,
      order.end_time,
      order.charge_amount,
      order.amount,
      order.status,
      order.platform_source
    ]);
    const sql = \`INSERT INTO orders 
      (order_id, user_id, charger_id, start_time, end_time, charge_amount, amount, status, platform_source)
      VALUES \${placeholders}\`;
    db.run(sql, values, callback);
  }
};

module.exports = Order;
`;

const chargerLogModel = `const db = require('../config/database');

const ChargerLog = {
  create: (log, callback) => {
    const sql = \`INSERT INTO charger_logs 
      (log_id, charger_id, order_id, event_time, realtime_charge, status, event_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)\`;
    db.run(sql, [
      log.log_id,
      log.charger_id,
      log.order_id,
      log.event_time,
      log.realtime_charge,
      log.status,
      log.event_type
    ], callback);
  },

  findById: (logId, callback) => {
    const sql = 'SELECT * FROM charger_logs WHERE log_id = ?';
    db.get(sql, [logId], callback);
  },

  findByOrderId: (orderId, callback) => {
    const sql = 'SELECT * FROM charger_logs WHERE order_id = ? ORDER BY event_time ASC';
    db.all(sql, [orderId], callback);
  },

  findByChargerId: (chargerId, callback) => {
    const sql = 'SELECT * FROM charger_logs WHERE charger_id = ? ORDER BY event_time DESC';
    db.all(sql, [chargerId], callback);
  },

  findAll: (callback) => {
    const sql = 'SELECT * FROM charger_logs ORDER BY event_time DESC';
    db.all(sql, callback);
  },

  bulkInsert: (logs, callback) => {
    const placeholders = logs.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = logs.flatMap(log => [
      log.log_id,
      log.charger_id,
      log.order_id,
      log.event_time,
      log.realtime_charge,
      log.status,
      log.event_type
    ]);
    const sql = \`INSERT INTO charger_logs 
      (log_id, charger_id, order_id, event_time, realtime_charge, status, event_type)
      VALUES \${placeholders}\`;
    db.run(sql, values, callback);
  }
};

module.exports = ChargerLog;
`;

const paymentRecordModel = `const db = require('../config/database');

const PaymentRecord = {
  create: (record, callback) => {
    const sql = \`INSERT INTO payment_records 
      (payment_id, order_id, payment_time, amount, payment_status, refund_status, refund_amount, payment_channel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`;
    db.run(sql, [
      record.payment_id,
      record.order_id,
      record.payment_time,
      record.amount,
      record.payment_status,
      record.refund_status,
      record.refund_amount,
      record.payment_channel
    ], callback);
  },

  findById: (paymentId, callback) => {
    const sql = 'SELECT * FROM payment_records WHERE payment_id = ?';
    db.get(sql, [paymentId], callback);
  },

  findByOrderId: (orderId, callback) => {
    const sql = 'SELECT * FROM payment_records WHERE order_id = ? ORDER BY payment_time DESC';
    db.all(sql, [orderId], callback);
  },

  findAll: (callback) => {
    const sql = 'SELECT * FROM payment_records ORDER BY payment_time DESC';
    db.all(sql, callback);
  },

  findByDateRange: (startDate, endDate, callback) => {
    const sql = 'SELECT * FROM payment_records WHERE payment_time >= ? AND payment_time <= ? ORDER BY payment_time DESC';
    db.all(sql, [startDate, endDate], callback);
  },

  update: (paymentId, record, callback) => {
    const sql = \`UPDATE payment_records SET 
      order_id = ?, payment_time = ?, amount = ?, payment_status = ?, 
      refund_status = ?, refund_amount = ?, payment_channel = ?
      WHERE payment_id = ?\`;
    db.run(sql, [
      record.order_id,
      record.payment_time,
      record.amount,
      record.payment_status,
      record.refund_status,
      record.refund_amount,
      record.payment_channel,
      paymentId
    ], callback);
  },

  bulkInsert: (records, callback) => {
    const placeholders = records.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = records.flatMap(record => [
      record.payment_id,
      record.order_id,
      record.payment_time,
      record.amount,
      record.payment_status,
      record.refund_status,
      record.refund_amount,
      record.payment_channel
    ]);
    const sql = \`INSERT INTO payment_records 
      (payment_id, order_id, payment_time, amount, payment_status, refund_status, refund_amount, payment_channel)
      VALUES \${placeholders}\`;
    db.run(sql, values, callback);
  }
};

module.exports = PaymentRecord;
`;

const reconciliationTaskModel = `const db = require('../config/database');

const ReconciliationTask = {
  create: (task, callback) => {
    const sql = \`INSERT INTO reconciliation_tasks 
      (task_id, name, status, created_at, completed_at, statistics)
      VALUES (?, ?, ?, ?, ?, ?)\`;
    db.run(sql, [
      task.task_id,
      task.name,
      task.status,
      task.created_at,
      task.completed_at,
      task.statistics ? JSON.stringify(task.statistics) : null
    ], callback);
  },

  findById: (taskId, callback) => {
    const sql = 'SELECT * FROM reconciliation_tasks WHERE task_id = ?';
    db.get(sql, [taskId], (err, row) => {
      if (err) return callback(err);
      if (row && row.statistics) {
        row.statistics = JSON.parse(row.statistics);
      }
      callback(null, row);
    });
  },

  findAll: (callback) => {
    const sql = 'SELECT * FROM reconciliation_tasks ORDER BY created_at DESC';
    db.all(sql, (err, rows) => {
      if (err) return callback(err);
      rows.forEach(row => {
        if (row.statistics) {
          row.statistics = JSON.parse(row.statistics);
        }
      });
      callback(null, rows);
    });
  },

  update: (taskId, task, callback) => {
    const sql = \`UPDATE reconciliation_tasks SET 
      name = ?, status = ?, completed_at = ?, statistics = ?
      WHERE task_id = ?\`;
    db.run(sql, [
      task.name,
      task.status,
      task.completed_at,
      task.statistics ? JSON.stringify(task.statistics) : null,
      taskId
    ], callback);
  },

  updateStatus: (taskId, status, callback) => {
    const sql = 'UPDATE reconciliation_tasks SET status = ? WHERE task_id = ?';
    db.run(sql, [status, taskId], callback);
  },

  delete: (taskId, callback) => {
    const sql = 'DELETE FROM reconciliation_tasks WHERE task_id = ?';
    db.run(sql, [taskId], callback);
  }
};

module.exports = ReconciliationTask;
`;

const discrepancyModel = `const db = require('../config/database');

const Discrepancy = {
  create: (discrepancy, callback) => {
    const sql = \`INSERT INTO discrepancies 
      (discrepancy_id, task_id, order_id, discrepancy_type, description, status, result)
      VALUES (?, ?, ?, ?, ?, ?, ?)\`;
    db.run(sql, [
      discrepancy.discrepancy_id,
      discrepancy.task_id,
      discrepancy.order_id,
      discrepancy.discrepancy_type,
      discrepancy.description,
      discrepancy.status,
      discrepancy.result
    ], callback);
  },

  findById: (discrepancyId, callback) => {
    const sql = 'SELECT * FROM discrepancies WHERE discrepancy_id = ?';
    db.get(sql, [discrepancyId], callback);
  },

  findByTaskId: (taskId, callback) => {
    const sql = 'SELECT * FROM discrepancies WHERE task_id = ? ORDER BY discrepancy_id DESC';
    db.all(sql, [taskId], callback);
  },

  findByStatus: (status, callback) => {
    const sql = 'SELECT * FROM discrepancies WHERE status = ? ORDER BY discrepancy_id DESC';
    db.all(sql, [status], callback);
  },

  findAll: (callback) => {
    const sql = 'SELECT * FROM discrepancies ORDER BY discrepancy_id DESC';
    db.all(sql, callback);
  },

  update: (discrepancyId, discrepancy, callback) => {
    const sql = \`UPDATE discrepancies SET 
      task_id = ?, order_id = ?, discrepancy_type = ?, description = ?, status = ?, result = ?
      WHERE discrepancy_id = ?\`;
    db.run(sql, [
      discrepancy.task_id,
      discrepancy.order_id,
      discrepancy.discrepancy_type,
      discrepancy.description,
      discrepancy.status,
      discrepancy.result,
      discrepancyId
    ], callback);
  },

  updateStatus: (discrepancyId, status, result, callback) => {
    const sql = 'UPDATE discrepancies SET status = ?, result = ? WHERE discrepancy_id = ?';
    db.run(sql, [status, result, discrepancyId], callback);
  },

  bulkInsert: (discrepancies, callback) => {
    const placeholders = discrepancies.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = discrepancies.flatMap(d => [
      d.discrepancy_id,
      d.task_id,
      d.order_id,
      d.discrepancy_type,
      d.description,
      d.status,
      d.result
    ]);
    const sql = \`INSERT INTO discrepancies 
      (discrepancy_id, task_id, order_id, discrepancy_type, description, status, result)
      VALUES \${placeholders}\`;
    db.run(sql, values, callback);
  }
};

module.exports = Discrepancy;
`;

const reviewLogModel = `const db = require('../config/database');

const ReviewLog = {
  create: (log, callback) => {
    const sql = \`INSERT INTO review_logs 
      (log_id, discrepancy_id, operator, operation_type, previous_status, next_status, remark, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`;
    db.run(sql, [
      log.log_id,
      log.discrepancy_id,
      log.operator,
      log.operation_type,
      log.previous_status,
      log.next_status,
      log.remark,
      log.timestamp
    ], callback);
  },

  findById: (logId, callback) => {
    const sql = 'SELECT * FROM review_logs WHERE log_id = ?';
    db.get(sql, [logId], callback);
  },

  findByDiscrepancyId: (discrepancyId, callback) => {
    const sql = 'SELECT * FROM review_logs WHERE discrepancy_id = ? ORDER BY timestamp DESC';
    db.all(sql, [discrepancyId], callback);
  },

  findByOperator: (operator, callback) => {
    const sql = 'SELECT * FROM review_logs WHERE operator = ? ORDER BY timestamp DESC';
    db.all(sql, [operator], callback);
  },

  findAll: (callback) => {
    const sql = 'SELECT * FROM review_logs ORDER BY timestamp DESC';
    db.all(sql, callback);
  },

  bulkInsert: (logs, callback) => {
    const placeholders = logs.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = logs.flatMap(log => [
      log.log_id,
      log.discrepancy_id,
      log.operator,
      log.operation_type,
      log.previous_status,
      log.next_status,
      log.remark,
      log.timestamp
    ]);
    const sql = \`INSERT INTO review_logs 
      (log_id, discrepancy_id, operator, operation_type, previous_status, next_status, remark, timestamp)
      VALUES \${placeholders}\`;
    db.run(sql, values, callback);
  }
};

module.exports = ReviewLog;
`;

const reportModel = `const db = require('../config/database');

const Report = {
  create: (report, callback) => {
    const sql = \`INSERT INTO reports 
      (report_id, task_id, report_type, content, generated_at, file_path)
      VALUES (?, ?, ?, ?, ?, ?)\`;
    db.run(sql, [
      report.report_id,
      report.task_id,
      report.report_type,
      report.content ? JSON.stringify(report.content) : null,
      report.generated_at,
      report.file_path
    ], callback);
  },

  findById: (reportId, callback) => {
    const sql = 'SELECT * FROM reports WHERE report_id = ?';
    db.get(sql, [reportId], (err, row) => {
      if (err) return callback(err);
      if (row && row.content) {
        row.content = JSON.parse(row.content);
      }
      callback(null, row);
    });
  },

  findByTaskId: (taskId, callback) => {
    const sql = 'SELECT * FROM reports WHERE task_id = ? ORDER BY generated_at DESC';
    db.all(sql, (err, rows) => {
      if (err) return callback(err);
      rows.forEach(row => {
        if (row.content) {
          row.content = JSON.parse(row.content);
        }
      });
      callback(null, rows);
    });
  },

  findByType: (reportType, callback) => {
    const sql = 'SELECT * FROM reports WHERE report_type = ? ORDER BY generated_at DESC';
    db.all(sql, [reportType], (err, rows) => {
      if (err) return callback(err);
      rows.forEach(row => {
        if (row.content) {
          row.content = JSON.parse(row.content);
        }
      });
      callback(null, rows);
    });
  },

  findAll: (callback) => {
    const sql = 'SELECT * FROM reports ORDER BY generated_at DESC';
    db.all(sql, (err, rows) => {
      if (err) return callback(err);
      rows.forEach(row => {
        if (row.content) {
          row.content = JSON.parse(row.content);
        }
      });
      callback(null, rows);
    });
  },

  delete: (reportId, callback) => {
    const sql = 'DELETE FROM reports WHERE report_id = ?';
    db.run(sql, [reportId], callback);
  }
};

module.exports = Report;
`;

const initDbScript = `require('dotenv').config();
const db = require('../config/database');

const createTables = () => {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = OFF');

    db.run(\`DROP TABLE IF EXISTS review_logs\`);
    db.run(\`DROP TABLE IF EXISTS discrepancies\`);
    db.run(\`DROP TABLE IF EXISTS reports\`);
    db.run(\`DROP TABLE IF EXISTS reconciliation_tasks\`);
    db.run(\`DROP TABLE IF EXISTS payment_records\`);
    db.run(\`DROP TABLE IF EXISTS charger_logs\`);
    db.run(\`DROP TABLE IF EXISTS orders\`);

    db.run(\`
      CREATE TABLE orders (
        order_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        charger_id TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        charge_amount REAL,
        amount REAL,
        status TEXT NOT NULL,
        platform_source TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    \`);

    db.run('CREATE INDEX idx_orders_user_id ON orders(user_id)');
    db.run('CREATE INDEX idx_orders_charger_id ON orders(charger_id)');
    db.run('CREATE INDEX idx_orders_start_time ON orders(start_time)');
    db.run('CREATE INDEX idx_orders_status ON orders(status)');
    db.run('CREATE INDEX idx_orders_platform ON orders(platform_source)');

    db.run(\`
      CREATE TABLE charger_logs (
        log_id TEXT PRIMARY KEY,
        charger_id TEXT NOT NULL,
        order_id TEXT,
        event_time DATETIME NOT NULL,
        realtime_charge REAL,
        status TEXT,
        event_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL
      )
    \`);

    db.run('CREATE INDEX idx_charger_logs_charger_id ON charger_logs(charger_id)');
    db.run('CREATE INDEX idx_charger_logs_order_id ON charger_logs(order_id)');
    db.run('CREATE INDEX idx_charger_logs_event_time ON charger_logs(event_time)');
    db.run('CREATE INDEX idx_charger_logs_event_type ON charger_logs(event_type)');

    db.run(\`
      CREATE TABLE payment_records (
        payment_id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        payment_time DATETIME NOT NULL,
        amount REAL NOT NULL,
        payment_status TEXT NOT NULL,
        refund_status TEXT DEFAULT 'none',
        refund_amount REAL DEFAULT 0,
        payment_channel TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      )
    \`);

    db.run('CREATE INDEX idx_payment_records_order_id ON payment_records(order_id)');
    db.run('CREATE INDEX idx_payment_records_payment_time ON payment_records(payment_time)');
    db.run('CREATE INDEX idx_payment_records_status ON payment_records(payment_status)');
    db.run('CREATE INDEX idx_payment_records_channel ON payment_records(payment_channel)');

    db.run(\`
      CREATE TABLE reconciliation_tasks (
        task_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        statistics TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    \`);

    db.run('CREATE INDEX idx_reconciliation_tasks_status ON reconciliation_tasks(status)');
    db.run('CREATE INDEX idx_reconciliation_tasks_created_at ON reconciliation_tasks(created_at)');

    db.run(\`
      CREATE TABLE discrepancies (
        discrepancy_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        discrepancy_type TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES reconciliation_tasks(task_id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      )
    \`);

    db.run('CREATE INDEX idx_discrepancies_task_id ON discrepancies(task_id)');
    db.run('CREATE INDEX idx_discrepancies_order_id ON discrepancies(order_id)');
    db.run('CREATE INDEX idx_discrepancies_type ON discrepancies(discrepancy_type)');
    db.run('CREATE INDEX idx_discrepancies_status ON discrepancies(status)');

    db.run(\`
      CREATE TABLE review_logs (
        log_id TEXT PRIMARY KEY,
        discrepancy_id TEXT NOT NULL,
        operator TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        previous_status TEXT,
        next_status TEXT,
        remark TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (discrepancy_id) REFERENCES discrepancies(discrepancy_id) ON DELETE CASCADE
      )
    \`);

    db.run('CREATE INDEX idx_review_logs_discrepancy_id ON review_logs(discrepancy_id)');
    db.run('CREATE INDEX idx_review_logs_operator ON review_logs(operator)');
    db.run('CREATE INDEX idx_review_logs_timestamp ON review_logs(timestamp)');

    db.run(\`
      CREATE TABLE reports (
        report_id TEXT PRIMARY KEY,
        task_id TEXT,
        report_type TEXT NOT NULL,
        content TEXT,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        file_path TEXT,
        FOREIGN KEY (task_id) REFERENCES reconciliation_tasks(task_id) ON DELETE SET NULL
      )
    \`);

    db.run('CREATE INDEX idx_reports_task_id ON reports(task_id)');
    db.run('CREATE INDEX idx_reports_type ON reports(report_type)');
    db.run('CREATE INDEX idx_reports_generated_at ON reports(generated_at)');

    db.run('PRAGMA foreign_keys = ON');

    console.log('所有数据表创建成功！');
  });
};

createTables();

setTimeout(() => {
  db.close((err) => {
    if (err) {
      console.error('关闭数据库失败:', err.message);
    } else {
      console.log('数据库连接已关闭');
    }
  });
}, 1000);
`;

const models = {
  'order.js': orderModel,
  'chargerLog.js': chargerLogModel,
  'paymentRecord.js': paymentRecordModel,
  'reconciliationTask.js': reconciliationTaskModel,
  'discrepancy.js': discrepancyModel,
  'reviewLog.js': reviewLogModel,
  'report.js': reportModel
};

Object.entries(models).forEach(([filename, content]) => {
  fs.writeFileSync(path.join(modelsDir, filename), content);
  console.log(`Created: ${filename}`);
});

fs.writeFileSync(path.join(__dirname, 'src/scripts/init-db.js'), initDbScript);
console.log('Created: init-db.js');

console.log('所有文件创建完成！');
