const fs = require('fs');

const content = `require('dotenv').config();
const db = require('../config/database');

const createTables = () => {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = OFF');

    db.run('DROP TABLE IF EXISTS review_logs');
    db.run('DROP TABLE IF EXISTS discrepancies');
    db.run('DROP TABLE IF EXISTS reports');
    db.run('DROP TABLE IF EXISTS reconciliation_tasks');
    db.run('DROP TABLE IF EXISTS payment_records');
    db.run('DROP TABLE IF EXISTS charger_logs');
    db.run('DROP TABLE IF EXISTS orders');

    db.run("CREATE TABLE orders (order_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, charger_id TEXT NOT NULL, start_time DATETIME NOT NULL, end_time DATETIME, charge_amount REAL, amount REAL, status TEXT NOT NULL, platform_source TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");

    db.run('CREATE INDEX idx_orders_user_id ON orders(user_id)');
    db.run('CREATE INDEX idx_orders_charger_id ON orders(charger_id)');
    db.run('CREATE INDEX idx_orders_start_time ON orders(start_time)');
    db.run('CREATE INDEX idx_orders_status ON orders(status)');
    db.run('CREATE INDEX idx_orders_platform ON orders(platform_source)');

    db.run("CREATE TABLE charger_logs (log_id TEXT PRIMARY KEY, charger_id TEXT NOT NULL, order_id TEXT, event_time DATETIME NOT NULL, realtime_charge REAL, status TEXT, event_type TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL)");

    db.run('CREATE INDEX idx_charger_logs_charger_id ON charger_logs(charger_id)');
    db.run('CREATE INDEX idx_charger_logs_order_id ON charger_logs(order_id)');
    db.run('CREATE INDEX idx_charger_logs_event_time ON charger_logs(event_time)');
    db.run('CREATE INDEX idx_charger_logs_event_type ON charger_logs(event_type)');

    db.run("CREATE TABLE payment_records (payment_id TEXT PRIMARY KEY, order_id TEXT NOT NULL, payment_time DATETIME NOT NULL, amount REAL NOT NULL, payment_status TEXT NOT NULL, refund_status TEXT DEFAULT 'none', refund_amount REAL DEFAULT 0, payment_channel TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE)");

    db.run('CREATE INDEX idx_payment_records_order_id ON payment_records(order_id)');
    db.run('CREATE INDEX idx_payment_records_payment_time ON payment_records(payment_time)');
    db.run('CREATE INDEX idx_payment_records_status ON payment_records(payment_status)');
    db.run('CREATE INDEX idx_payment_records_channel ON payment_records(payment_channel)');

    db.run("CREATE TABLE reconciliation_tasks (task_id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME, statistics TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");

    db.run('CREATE INDEX idx_reconciliation_tasks_status ON reconciliation_tasks(status)');
    db.run('CREATE INDEX idx_reconciliation_tasks_created_at ON reconciliation_tasks(created_at)');

    db.run("CREATE TABLE discrepancies (discrepancy_id TEXT PRIMARY KEY, task_id TEXT NOT NULL, order_id TEXT NOT NULL, discrepancy_type TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'pending', result TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (task_id) REFERENCES reconciliation_tasks(task_id) ON DELETE CASCADE, FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE)");

    db.run('CREATE INDEX idx_discrepancies_task_id ON discrepancies(task_id)');
    db.run('CREATE INDEX idx_discrepancies_order_id ON discrepancies(order_id)');
    db.run('CREATE INDEX idx_discrepancies_type ON discrepancies(discrepancy_type)');
    db.run('CREATE INDEX idx_discrepancies_status ON discrepancies(status)');

    db.run("CREATE TABLE review_logs (log_id TEXT PRIMARY KEY, discrepancy_id TEXT NOT NULL, operator TEXT NOT NULL, operation_type TEXT NOT NULL, previous_status TEXT, next_status TEXT, remark TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (discrepancy_id) REFERENCES discrepancies(discrepancy_id) ON DELETE CASCADE)");

    db.run('CREATE INDEX idx_review_logs_discrepancy_id ON review_logs(discrepancy_id)');
    db.run('CREATE INDEX idx_review_logs_operator ON review_logs(operator)');
    db.run('CREATE INDEX idx_review_logs_timestamp ON review_logs(timestamp)');

    db.run("CREATE TABLE reports (report_id TEXT PRIMARY KEY, task_id TEXT, report_type TEXT NOT NULL, content TEXT, generated_at DATETIME DEFAULT CURRENT_TIMESTAMP, file_path TEXT, FOREIGN KEY (task_id) REFERENCES reconciliation_tasks(task_id) ON DELETE SET NULL)");

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

fs.writeFileSync('src/scripts/init-db.js', content);
console.log('Created init-db.js successfully!');
