import sqlite3
from datetime import datetime
import json

DB_NAME = 'procurement.db'

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            department TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS budget_subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            total_budget REAL NOT NULL,
            used_budget REAL DEFAULT 0,
            department TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS purchase_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_no TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            requester_id INTEGER,
            department TEXT,
            budget_subject_id INTEGER,
            estimated_amount REAL,
            status TEXT DEFAULT 'pending',
            priority TEXT DEFAULT 'normal',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requester_id) REFERENCES users (id),
            FOREIGN KEY (budget_subject_id) REFERENCES budget_subjects (id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            contact_person TEXT,
            phone TEXT,
            email TEXT,
            address TEXT,
            rating REAL DEFAULT 5,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS supplier_quotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_request_id INTEGER,
            supplier_id INTEGER,
            quote_amount REAL NOT NULL,
            quote_details TEXT,
            valid_until DATE,
            status TEXT DEFAULT 'submitted',
            quote_file TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests (id),
            FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS historical_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_name TEXT NOT NULL,
            item_spec TEXT,
            price REAL NOT NULL,
            supplier_id INTEGER,
            purchase_date DATE NOT NULL,
            quantity INTEGER DEFAULT 1,
            unit TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS approvals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_request_id INTEGER,
            approver_id INTEGER,
            approval_level INTEGER DEFAULT 1,
            status TEXT DEFAULT 'pending',
            comments TEXT,
            approved_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests (id),
            FOREIGN KEY (approver_id) REFERENCES users (id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS comparison_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_request_id INTEGER UNIQUE,
            recommended_supplier_id INTEGER,
            final_price REAL,
            comparison_summary TEXT,
            price_anomalies TEXT,
            budget_anomalies TEXT,
            manual_adjustment TEXT,
            adjusted_by_id INTEGER,
            adjusted_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests (id),
            FOREIGN KEY (recommended_supplier_id) REFERENCES suppliers (id),
            FOREIGN KEY (adjusted_by_id) REFERENCES users (id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            record_id INTEGER NOT NULL,
            field_name TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            changed_by_id INTEGER,
            changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            change_reason TEXT,
            FOREIGN KEY (changed_by_id) REFERENCES users (id)
        )
    ''')

    conn.commit()
    conn.close()

def insert_sample_data():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) FROM users')
    if cursor.fetchone()[0] > 0:
        conn.close()
        return

    users = [
        ('admin', '系统管理员', 'admin', 'IT部门'),
        ('zhangwei', '张伟', 'requester', '市场部'),
        ('limei', '李梅', 'requester', '技术部'),
        ('wanggang', '王刚', 'approver', '财务部'),
        ('liuyan', '刘艳', 'approver', '管理层'),
        ('chenhao', '陈浩', 'purchaser', '采购部')
    ]
    cursor.executemany('INSERT INTO users (username, name, role, department) VALUES (?, ?, ?, ?)', users)

    budget_subjects = [
        ('BJ-001', '市场推广费', 500000, 150000, '市场部'),
        ('BJ-002', '研发设备采购', 1000000, 300000, '技术部'),
        ('BJ-003', '办公用品采购', 100000, 25000, '综合部'),
        ('BJ-004', '服务器采购', 800000, 400000, '技术部'),
        ('BJ-005', '培训费用', 200000, 50000, '人力资源部')
    ]
    cursor.executemany('INSERT INTO budget_subjects (code, name, total_budget, used_budget, department) VALUES (?, ?, ?, ?, ?)', budget_subjects)

    suppliers = [
        ('北京科技设备有限公司', '张经理', '13800138001', 'zhang@bjtech.com', '北京市海淀区中关村大街1号', 4.8),
        ('上海办公设备有限公司', '李经理', '13900139002', 'li@shoffice.com', '上海市浦东新区张江高科技园区', 4.5),
        ('深圳电子科技公司', '王经理', '13700137003', 'wang@sztech.com', '深圳市南山区科技园', 4.9),
        ('广州网络设备公司', '赵经理', '13600136004', 'zhao@gznet.com', '广州市天河区珠江新城', 4.2),
        ('杭州智能设备公司', '孙经理', '13500135005', 'sun@hzsmart.com', '杭州市滨江区互联网产业园', 4.7)
    ]
    cursor.executemany('INSERT INTO suppliers (name, contact_person, phone, email, address, rating) VALUES (?, ?, ?, ?, ?, ?)', suppliers)

    historical_prices = [
        ('笔记本电脑', 'ThinkPad X1 Carbon', 12000, 1, '2025-01-15', 5, '台'),
        ('笔记本电脑', 'MacBook Pro 14', 14500, 3, '2025-02-20', 3, '台'),
        ('显示器', 'Dell U2720Q', 3800, 2, '2025-01-25', 10, '台'),
        ('服务器', 'Dell PowerEdge R750', 45000, 4, '2025-03-10', 2, '台'),
        ('办公桌椅套装', '标准办公桌+人体工学椅', 2800, 2, '2025-02-05', 20, '套'),
        ('投影仪', 'Epson CB-2255U', 8500, 5, '2025-03-20', 3, '台'),
        ('打印机', 'HP LaserJet Pro MFP', 3200, 1, '2025-01-30', 8, '台'),
        ('路由器', 'Cisco Catalyst 9200', 12000, 4, '2025-02-28', 2, '台')
    ]
    cursor.executemany('INSERT INTO historical_prices (item_name, item_spec, price, supplier_id, purchase_date, quantity, unit) VALUES (?, ?, ?, ?, ?, ?, ?)', historical_prices)

    purchase_requests = [
        ('CG-2025-001', '市场部办公电脑采购', '为新入职的10名市场人员采购笔记本电脑', 2, '市场部', 1, 130000, 'comparing', 'high', '2025-05-01 09:00:00', '2025-05-02 10:30:00'),
        ('CG-2025-002', '研发服务器采购', '采购2台高性能服务器用于开发环境', 3, '技术部', 4, 100000, 'pending_approval', 'high', '2025-05-05 14:00:00', '2025-05-06 09:15:00'),
        ('CG-2025-003', '办公用品季度采购', 'Q2办公用品批量采购', 2, '市场部', 3, 30000, 'approved', 'normal', '2025-04-10 08:30:00', '2025-04-12 16:00:00'),
        ('CG-2025-004', '培训室投影仪采购', '采购2台高清投影仪用于培训室', 3, '技术部', 5, 18000, 'rejected', 'normal', '2025-05-08 11:00:00', '2025-05-09 15:20:00'),
        ('CG-2025-005', '网络设备升级', '公司网络路由器设备升级', 3, '技术部', 2, 25000, 'comparing', 'high', '2025-05-10 10:00:00', '2025-05-11 14:45:00'),
        ('CG-2025-006', '新员工办公家具', '为新入职员工采购办公桌椅', 2, '市场部', 3, 15000, 'pending', 'low', '2025-05-12 16:30:00', '2025-05-12 16:30:00')
    ]
    cursor.executemany('INSERT INTO purchase_requests (request_no, title, description, requester_id, department, budget_subject_id, estimated_amount, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', purchase_requests)

    supplier_quotes = [
        (1, 1, 125000, '10台ThinkPad笔记本，含3年保修', '2025-06-01', 'submitted', None, '2025-05-02 11:00:00', '2025-05-02 11:00:00'),
        (1, 3, 138000, '10台MacBook Pro，含发票和配送', '2025-06-15', 'submitted', None, '2025-05-02 14:00:00', '2025-05-02 14:00:00'),
        (1, 2, 128000, '10台Dell笔记本，2年上门服务', '2025-05-30', 'submitted', None, '2025-05-03 09:30:00', '2025-05-03 09:30:00'),
        (2, 4, 95000, '2台Dell服务器，含安装调试', '2025-06-10', 'submitted', None, '2025-05-06 10:00:00', '2025-05-06 10:00:00'),
        (2, 1, 98000, '2台HP服务器，3年7*24服务', '2025-06-05', 'submitted', None, '2025-05-06 15:30:00', '2025-05-06 15:30:00'),
        (3, 2, 28000, '办公用品套装，季度配送', '2025-05-20', 'accepted', None, '2025-04-11 08:00:00', '2025-04-11 08:00:00'),
        (4, 5, 19000, '2台Epson投影仪，含安装', '2025-06-20', 'submitted', None, '2025-05-09 09:00:00', '2025-05-09 09:00:00'),
        (5, 4, 26000, 'Cisco路由器设备，含配置服务', '2025-06-15', 'submitted', None, '2025-05-11 10:00:00', '2025-05-11 10:00:00'),
        (5, 1, 24000, '华为路由器套装，技术支持', '2025-06-10', 'submitted', None, '2025-05-11 13:00:00', '2025-05-11 13:00:00')
    ]
    cursor.executemany('INSERT INTO supplier_quotes (purchase_request_id, supplier_id, quote_amount, quote_details, valid_until, status, quote_file, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', supplier_quotes)

    approvals = [
        (1, 4, 1, 'pending', None, None, '2025-05-02 10:30:00'),
        (2, 4, 1, 'pending', None, None, '2025-05-06 09:15:00'),
        (3, 4, 1, 'approved', '预算合理，同意采购', '2025-04-12 10:00:00', '2025-04-11 16:00:00'),
        (3, 5, 2, 'approved', '同意', '2025-04-12 16:00:00', '2025-04-12 11:00:00'),
        (4, 4, 1, 'rejected', '价格偏高，建议重新比价', '2025-05-09 15:20:00', '2025-05-09 10:00:00'),
        (5, 4, 1, 'pending', None, None, '2025-05-11 14:45:00')
    ]
    cursor.executemany('INSERT INTO approvals (purchase_request_id, approver_id, approval_level, status, comments, approved_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', approvals)

    comparison_results = [
        (1, 1, 125000, '比价结果：北京科技报价最低125000元，历史均价13000元/台，本次均价12500元/台，价格合理。预算科目余额充足。',
         '[]', '[]', None, None, None, '2025-05-03 16:00:00'),
        (3, 2, 28000, '比价结果：上海办公设备报价28000元，符合历史价格区间。预算使用合理。',
         '[]', '[]', None, None, None, '2025-04-12 09:00:00')
    ]
    cursor.executemany('INSERT INTO comparison_results (purchase_request_id, recommended_supplier_id, final_price, comparison_summary, price_anomalies, budget_anomalies, manual_adjustment, adjusted_by_id, adjusted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', comparison_results)

    audit_logs = [
        ('purchase_requests', 1, 'status', 'pending', 'comparing', 6, '2025-05-02 10:30:00', '进入比价阶段'),
        ('supplier_quotes', 1, 'quote_amount', '130000', '125000', 1, '2025-05-02 11:30:00', '供应商调整报价'),
        ('purchase_requests', 3, 'status', 'comparing', 'pending_approval', 6, '2025-04-11 16:00:00', '比价完成，进入审批'),
        ('purchase_requests', 3, 'status', 'pending_approval', 'approved', 5, '2025-04-12 16:00:00', '审批通过'),
        ('purchase_requests', 4, 'status', 'pending_approval', 'rejected', 4, '2025-05-09 15:20:00', '审批退回')
    ]
    cursor.executemany('INSERT INTO audit_logs (table_name, record_id, field_name, old_value, new_value, changed_by_id, changed_at, change_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', audit_logs)

    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def calculate_status(purchase_request_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM purchase_requests WHERE id = ?', (purchase_request_id,))
    request = cursor.fetchone()

    if not request:
        conn.close()
        return None

    cursor.execute('SELECT COUNT(*) as count FROM supplier_quotes WHERE purchase_request_id = ?', (purchase_request_id,))
    quote_count = cursor.fetchone()['count']

    if quote_count == 0:
        status = 'pending'
    elif quote_count < 3:
        status = 'comparing'
    else:
        cursor.execute('SELECT COUNT(*) as count FROM approvals WHERE purchase_request_id = ? AND status = "pending"', (purchase_request_id,))
        pending_approvals = cursor.fetchone()['count']
        
        cursor.execute('SELECT COUNT(*) as count FROM approvals WHERE purchase_request_id = ? AND status = "rejected"', (purchase_request_id,))
        rejected_approvals = cursor.fetchone()['count']

        if rejected_approvals > 0:
            status = 'rejected'
        elif pending_approvals > 0:
            status = 'pending_approval'
        else:
            cursor.execute('SELECT COUNT(*) as count FROM approvals WHERE purchase_request_id = ?', (purchase_request_id,))
            total_approvals = cursor.fetchone()['count']
            if total_approvals >= 2:
                status = 'approved'
            else:
                status = 'pending_approval'

    cursor.execute('UPDATE purchase_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (status, purchase_request_id))
    conn.commit()
    conn.close()
    
    return status

def log_audit(table_name, record_id, field_name, old_value, new_value, changed_by_id, change_reason=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO audit_logs (table_name, record_id, field_name, old_value, new_value, changed_by_id, change_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (table_name, record_id, field_name, str(old_value), str(new_value), changed_by_id, change_reason))
    conn.commit()
    conn.close()
