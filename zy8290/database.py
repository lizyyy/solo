import sqlite3
import os
from typing import Optional, List, Dict, Any
from datetime import datetime
import json

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'store.db')


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_code TEXT UNIQUE NOT NULL,
            product_name TEXT NOT NULL,
            category TEXT,
            cost_price REAL,
            sale_price REAL,
            stock_quantity INTEGER DEFAULT 0,
            unit TEXT,
            supplier TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS import_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_number TEXT UNIQUE NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            total_rows INTEGER DEFAULT 0,
            success_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS import_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER,
            log_type TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (batch_id) REFERENCES import_batches (id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS failed_rows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER,
            row_number INTEGER NOT NULL,
            field_name TEXT,
            original_value TEXT,
            error_type TEXT NOT NULL,
            error_message TEXT NOT NULL,
            fix_suggestion TEXT,
            row_data TEXT,
            retried INTEGER DEFAULT 0,
            resolved INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (batch_id) REFERENCES import_batches (id)
        )
    ''')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_code ON products (product_code)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_failed_rows_batch ON failed_rows (batch_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_import_logs_batch ON import_logs (batch_id)')

    conn.commit()
    conn.close()


class BatchManager:
    @staticmethod
    def create_batch(file_name: str, file_path: str, total_rows: int) -> int:
        batch_number = f"BAT{datetime.now().strftime('%Y%m%d%H%M%S')}"
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO import_batches (batch_number, file_name, file_path, total_rows, status)
            VALUES (?, ?, ?, ?, 'pending')
        ''', (batch_number, file_name, file_path, total_rows))
        batch_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return batch_id

    @staticmethod
    def update_batch_status(batch_id: int, status: str, success_count: int = None, failed_count: int = None):
        conn = get_connection()
        cursor = conn.cursor()
        
        updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP']
        params = [status]
        
        if success_count is not None:
            updates.append('success_count = ?')
            params.append(success_count)
        if failed_count is not None:
            updates.append('failed_count = ?')
            params.append(failed_count)
        
        params.append(batch_id)
        
        cursor.execute(f'''
            UPDATE import_batches 
            SET {', '.join(updates)}
            WHERE id = ?
        ''', params)
        conn.commit()
        conn.close()

    @staticmethod
    def get_all_batches() -> List[Dict[str, Any]]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, batch_number, file_name, total_rows, success_count, 
                   failed_count, status, created_at, updated_at
            FROM import_batches
            ORDER BY created_at DESC
        ''')
        rows = cursor.fetchall()
        conn.close()
        
        batches = []
        for row in rows:
            batches.append({
                'id': row[0],
                'batch_number': row[1],
                'file_name': row[2],
                'total_rows': row[3],
                'success_count': row[4],
                'failed_count': row[5],
                'status': row[6],
                'created_at': row[7],
                'updated_at': row[8]
            })
        return batches

    @staticmethod
    def get_batch_by_id(batch_id: int) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, batch_number, file_name, file_path, total_rows, success_count, 
                   failed_count, status, created_at, updated_at
            FROM import_batches
            WHERE id = ?
        ''', (batch_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'id': row[0],
                'batch_number': row[1],
                'file_name': row[2],
                'file_path': row[3],
                'total_rows': row[4],
                'success_count': row[5],
                'failed_count': row[6],
                'status': row[7],
                'created_at': row[8],
                'updated_at': row[9]
            }
        return None


class ProductManager:
    @staticmethod
    def product_exists(product_code: str) -> bool:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM products WHERE product_code = ?', (product_code,))
        exists = cursor.fetchone() is not None
        conn.close()
        return exists

    @staticmethod
    def add_product(product_data: Dict[str, Any]) -> bool:
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO products (product_code, product_name, category, cost_price, 
                                      sale_price, stock_quantity, unit, supplier)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                product_data.get('product_code'),
                product_data.get('product_name'),
                product_data.get('category'),
                product_data.get('cost_price'),
                product_data.get('sale_price'),
                product_data.get('stock_quantity'),
                product_data.get('unit'),
                product_data.get('supplier')
            ))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
        finally:
            conn.close()

    @staticmethod
    def update_product(product_code: str, product_data: Dict[str, Any]) -> bool:
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                UPDATE products 
                SET product_name = ?, category = ?, cost_price = ?, 
                    sale_price = ?, stock_quantity = ?, unit = ?, supplier = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_code = ?
            ''', (
                product_data.get('product_name'),
                product_data.get('category'),
                product_data.get('cost_price'),
                product_data.get('sale_price'),
                product_data.get('stock_quantity'),
                product_data.get('unit'),
                product_data.get('supplier'),
                product_code
            ))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    @staticmethod
    def get_all_products() -> List[Dict[str, Any]]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM products ORDER BY created_at DESC')
        rows = cursor.fetchall()
        conn.close()
        
        products = []
        for row in rows:
            products.append({
                'id': row[0],
                'product_code': row[1],
                'product_name': row[2],
                'category': row[3],
                'cost_price': row[4],
                'sale_price': row[5],
                'stock_quantity': row[6],
                'unit': row[7],
                'supplier': row[8],
                'created_at': row[9],
                'updated_at': row[10]
            })
        return products


class FailedRowManager:
    @staticmethod
    def add_failed_row(batch_id: int, row_number: int, field_name: str, 
                        original_value: str, error_type: str, error_message: str,
                        fix_suggestion: str, row_data: Dict[str, Any]):
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO failed_rows 
            (batch_id, row_number, field_name, original_value, error_type, 
             error_message, fix_suggestion, row_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            batch_id, row_number, field_name, original_value, error_type,
            error_message, fix_suggestion, json.dumps(row_data, ensure_ascii=False)
        ))
        conn.commit()
        conn.close()

    @staticmethod
    def get_failed_rows(batch_id: int) -> List[Dict[str, Any]]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, batch_id, row_number, field_name, original_value, 
                   error_type, error_message, fix_suggestion, row_data, 
                   retried, resolved, created_at
            FROM failed_rows
            WHERE batch_id = ? AND resolved = 0
            ORDER BY row_number
        ''', (batch_id,))
        rows = cursor.fetchall()
        conn.close()
        
        failed_rows = []
        for row in rows:
            failed_rows.append({
                'id': row[0],
                'batch_id': row[1],
                'row_number': row[2],
                'field_name': row[3],
                'original_value': row[4],
                'error_type': row[5],
                'error_message': row[6],
                'fix_suggestion': row[7],
                'row_data': json.loads(row[8]) if row[8] else {},
                'retried': row[9],
                'resolved': row[10],
                'created_at': row[11]
            })
        return failed_rows

    @staticmethod
    def mark_as_resolved(failed_row_id: int):
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE failed_rows 
            SET resolved = 1, retried = retried + 1
            WHERE id = ?
        ''', (failed_row_id,))
        conn.commit()
        conn.close()

    @staticmethod
    def mark_as_retried(failed_row_id: int):
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE failed_rows 
            SET retried = retried + 1
            WHERE id = ?
        ''', (failed_row_id,))
        conn.commit()
        conn.close()


class LogManager:
    @staticmethod
    def add_log(batch_id: Optional[int], log_type: str, message: str):
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO import_logs (batch_id, log_type, message)
            VALUES (?, ?, ?)
        ''', (batch_id, log_type, message))
        conn.commit()
        conn.close()

    @staticmethod
    def get_logs(batch_id: Optional[int] = None, limit: int = 100) -> List[Dict[str, Any]]:
        conn = get_connection()
        cursor = conn.cursor()
        
        if batch_id:
            cursor.execute('''
                SELECT id, batch_id, log_type, message, created_at
                FROM import_logs
                WHERE batch_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            ''', (batch_id, limit))
        else:
            cursor.execute('''
                SELECT id, batch_id, log_type, message, created_at
                FROM import_logs
                ORDER BY created_at DESC
                LIMIT ?
            ''', (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        logs = []
        for row in rows:
            logs.append({
                'id': row[0],
                'batch_id': row[1],
                'log_type': row[2],
                'message': row[3],
                'created_at': row[4]
            })
        return logs
