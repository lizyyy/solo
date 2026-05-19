import sqlite3
import os
from datetime import datetime
from typing import Optional, List, Dict, Any


DB_PATH = os.path.join(os.path.dirname(__file__), 'pharmacy.db')


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS medicines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            generic_name TEXT,
            manufacturer TEXT,
            dosage_form TEXT,
            min_dose_per_kg REAL NOT NULL,
            max_dose_per_kg REAL NOT NULL,
            dose_unit TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS medicine_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            medicine_id INTEGER NOT NULL,
            batch_number TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit TEXT NOT NULL,
            manufacture_date DATE NOT NULL,
            expiry_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (medicine_id) REFERENCES medicines(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS contraindications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            medicine_a_id INTEGER NOT NULL,
            medicine_b_id INTEGER NOT NULL,
            reason TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (medicine_a_id) REFERENCES medicines(id),
            FOREIGN KEY (medicine_b_id) REFERENCES medicines(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS prescriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prescription_no TEXT UNIQUE NOT NULL,
            pet_name TEXT NOT NULL,
            pet_weight_kg REAL NOT NULL,
            species TEXT,
            doctor_name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'DRAFT',
            created_by TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS prescription_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prescription_id INTEGER NOT NULL,
            medicine_id INTEGER NOT NULL,
            batch_id INTEGER,
            prescribed_dose REAL NOT NULL,
            dose_unit TEXT NOT NULL,
            calculated_dose REAL NOT NULL,
            quantity INTEGER NOT NULL,
            notes TEXT,
            status TEXT NOT NULL DEFAULT 'PENDING',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
            FOREIGN KEY (medicine_id) REFERENCES medicines(id),
            FOREIGN KEY (batch_id) REFERENCES medicine_batches(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS workflow_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prescription_id INTEGER,
            prescription_item_id INTEGER,
            action TEXT NOT NULL,
            status TEXT NOT NULL,
            reason TEXT,
            operator TEXT NOT NULL,
            operated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            previous_status TEXT,
            new_status TEXT,
            details TEXT,
            FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
            FOREIGN KEY (prescription_item_id) REFERENCES prescription_items(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_trail (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            record_id INTEGER NOT NULL,
            operation TEXT NOT NULL,
            old_values TEXT,
            new_values TEXT,
            operator TEXT NOT NULL,
            operated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_prescriptions_no ON prescriptions(prescription_no)
    ''')
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_workflow_prescription ON workflow_logs(prescription_id)
    ''')
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_workflow_operator ON workflow_logs(operator)
    ''')

    conn.commit()
    conn.close()


def execute_query(query: str, params: tuple = (), fetch: bool = False):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    
    if fetch:
        result = cursor.fetchall()
        conn.close()
        return [dict(row) for row in result]
    
    conn.commit()
    last_id = cursor.lastrowid
    conn.close()
    return last_id


if __name__ == '__main__':
    init_database()
    print('Database initialized successfully!')
