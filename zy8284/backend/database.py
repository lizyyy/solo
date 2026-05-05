import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data_cleaning.db')

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS uploaded_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            file_type TEXT NOT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            version INTEGER DEFAULT 1
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cleaning_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version INTEGER NOT NULL,
            rules_content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS raw_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER NOT NULL,
            line_number INTEGER NOT NULL,
            raw_data TEXT NOT NULL,
            FOREIGN KEY (file_id) REFERENCES uploaded_files (id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cleaned_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            raw_record_id INTEGER NOT NULL,
            customer_id TEXT,
            order_date TEXT,
            order_amount REAL,
            status TEXT,
            cleaned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            rules_version INTEGER NOT NULL,
            has_manual_override INTEGER DEFAULT 0,
            FOREIGN KEY (raw_record_id) REFERENCES raw_records (id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lineage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cleaned_record_id INTEGER NOT NULL,
            column_name TEXT NOT NULL,
            original_value TEXT,
            cleaned_value TEXT,
            rule_applied TEXT,
            rule_version INTEGER,
            is_manual_override INTEGER DEFAULT 0,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cleaned_record_id) REFERENCES cleaned_records (id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conflicts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conflict_type TEXT NOT NULL,
            customer_id TEXT,
            field_name TEXT,
            value1 TEXT,
            value2 TEXT,
            source_line1 INTEGER,
            source_line2 INTEGER,
            resolved INTEGER DEFAULT 0,
            resolved_value TEXT,
            resolved_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS manual_overrides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cleaned_record_id INTEGER NOT NULL,
            column_name TEXT NOT NULL,
            original_cleaned_value TEXT,
            new_value TEXT,
            reason TEXT,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cleaned_record_id) REFERENCES cleaned_records (id)
        )
    ''')
    
    conn.commit()
    conn.close()

def insert_uploaded_file(filename, file_type, version=1):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO uploaded_files (filename, file_type, version) VALUES (?, ?, ?)',
        (filename, file_type, version)
    )
    file_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return file_id

def insert_cleaning_rules(version, rules_content):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO cleaning_rules (version, rules_content) VALUES (?, ?)',
        (version, rules_content)
    )
    rule_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return rule_id

def insert_raw_record(file_id, line_number, raw_data):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO raw_records (file_id, line_number, raw_data) VALUES (?, ?, ?)',
        (file_id, line_number, raw_data)
    )
    record_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return record_id

def insert_cleaned_record(raw_record_id, customer_id, order_date, order_amount, status, rules_version):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''INSERT INTO cleaned_records 
           (raw_record_id, customer_id, order_date, order_amount, status, rules_version) 
           VALUES (?, ?, ?, ?, ?, ?)''',
        (raw_record_id, customer_id, order_date, order_amount, status, rules_version)
    )
    record_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return record_id

def insert_lineage(cleaned_record_id, column_name, original_value, cleaned_value, rule_applied, rule_version, is_manual_override=0):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''INSERT INTO lineage 
           (cleaned_record_id, column_name, original_value, cleaned_value, rule_applied, rule_version, is_manual_override) 
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        (cleaned_record_id, column_name, original_value, cleaned_value, rule_applied, rule_version, is_manual_override)
    )
    lineage_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return lineage_id

def insert_conflict(conflict_type, customer_id, field_name, value1, value2, source_line1, source_line2):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''INSERT INTO conflicts 
           (conflict_type, customer_id, field_name, value1, value2, source_line1, source_line2) 
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        (conflict_type, customer_id, field_name, value1, value2, source_line1, source_line2)
    )
    conflict_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return conflict_id

def insert_manual_override(cleaned_record_id, column_name, original_cleaned_value, new_value, reason):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''INSERT INTO manual_overrides 
           (cleaned_record_id, column_name, original_cleaned_value, new_value, reason) 
           VALUES (?, ?, ?, ?, ?)''',
        (cleaned_record_id, column_name, original_cleaned_value, new_value, reason)
    )
    override_id = cursor.lastrowid
    cursor.execute(
        'UPDATE cleaned_records SET has_manual_override = 1 WHERE id = ?',
        (cleaned_record_id,)
    )
    conn.commit()
    conn.close()
    return override_id

def get_all_cleaned_records():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT cr.*, rr.line_number, rr.raw_data
        FROM cleaned_records cr
        JOIN raw_records rr ON cr.raw_record_id = rr.id
        ORDER BY rr.line_number
    ''')
    records = cursor.fetchall()
    conn.close()
    return [dict(row) for row in records]

def get_lineage_for_record(cleaned_record_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT l.*, rr.line_number, rr.raw_data
        FROM lineage l
        JOIN cleaned_records cr ON l.cleaned_record_id = cr.id
        JOIN raw_records rr ON cr.raw_record_id = rr.id
        WHERE l.cleaned_record_id = ?
    ''', (cleaned_record_id,))
    lineages = cursor.fetchall()
    conn.close()
    return [dict(row) for row in lineages]

def get_all_conflicts():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM conflicts ORDER BY created_at')
    conflicts = cursor.fetchall()
    conn.close()
    return [dict(row) for row in conflicts]

def resolve_conflict(conflict_id, resolved_value):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''UPDATE conflicts 
           SET resolved = 1, resolved_value = ?, resolved_at = CURRENT_TIMESTAMP 
           WHERE id = ?''',
        (resolved_value, conflict_id)
    )
    conn.commit()
    conn.close()

def get_latest_rules_version():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT MAX(version) as max_version FROM cleaning_rules')
    result = cursor.fetchone()
    conn.close()
    return result['max_version'] if result and result['max_version'] else 0

def get_latest_rules():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT * FROM cleaning_rules ORDER BY version DESC LIMIT 1'
    )
    rule = cursor.fetchone()
    conn.close()
    return dict(rule) if rule else None

def clear_all_data():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM lineage')
    cursor.execute('DELETE FROM manual_overrides')
    cursor.execute('DELETE FROM conflicts')
    cursor.execute('DELETE FROM cleaned_records')
    cursor.execute('DELETE FROM raw_records')
    cursor.execute('DELETE FROM cleaning_rules')
    cursor.execute('DELETE FROM uploaded_files')
    conn.commit()
    conn.close()
