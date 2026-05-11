import sqlite3
import json
from datetime import datetime, date
from typing import Optional, List, TypeVar, Type, Dict, Any
from contextlib import contextmanager
import os

from .models import (
    Elder, MealPlan, SubsidyHistory, Order, CancellationRecord,
    DeliveryRecord, PaymentRecord
)

T = TypeVar('T')


class Database:
    def __init__(self, db_path: str = None):
        if db_path is None:
            home_dir = os.path.expanduser("~")
            db_dir = os.path.join(home_dir, ".elder_meal")
            os.makedirs(db_dir, exist_ok=True)
            db_path = os.path.join(db_dir, "elder_meal.db")
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS elders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    phone TEXT,
                    id_card TEXT UNIQUE,
                    subsidy_type TEXT DEFAULT '普通补贴',
                    address TEXT,
                    district TEXT,
                    route TEXT,
                    notes TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS meal_plans (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    price REAL DEFAULT 0,
                    subsidy_amount REAL DEFAULT 0,
                    description TEXT,
                    is_active INTEGER DEFAULT 1
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS subsidy_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    elder_id INTEGER,
                    old_subsidy_type TEXT,
                    new_subsidy_type TEXT,
                    effective_date TEXT,
                    notes TEXT,
                    changed_at TEXT,
                    FOREIGN KEY (elder_id) REFERENCES elders(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    elder_id INTEGER,
                    elder_name TEXT,
                    meal_date TEXT NOT NULL,
                    meal_plan_id INTEGER,
                    meal_plan_name TEXT,
                    price REAL DEFAULT 0,
                    subsidy_type TEXT,
                    subsidy_amount REAL DEFAULT 0,
                    actual_payment REAL DEFAULT 0,
                    delivery_address TEXT,
                    district TEXT,
                    route TEXT,
                    status TEXT DEFAULT '已下单',
                    import_source TEXT,
                    import_id TEXT,
                    created_at TEXT,
                    updated_at TEXT,
                    FOREIGN KEY (elder_id) REFERENCES elders(id),
                    FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id)
                )
            ''')
            
            cursor.execute('''
                CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_elder_date 
                ON orders(elder_id, meal_date, meal_plan_id)
            ''')
            
            cursor.execute('''
                CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_import 
                ON orders(import_source, import_id)
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(meal_date)
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS cancellation_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER,
                    cancel_time TEXT,
                    reason TEXT,
                    reason_detail TEXT,
                    is_after_deadline INTEGER DEFAULT 0,
                    deadline_time TEXT,
                    is_delivered INTEGER DEFAULT 0,
                    refund_amount REAL DEFAULT 0,
                    deduction_amount REAL DEFAULT 0,
                    notes TEXT,
                    FOREIGN KEY (order_id) REFERENCES orders(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS delivery_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER,
                    deliverer TEXT,
                    delivery_time TEXT,
                    delivered INTEGER DEFAULT 1,
                    receiver TEXT,
                    notes TEXT,
                    FOREIGN KEY (order_id) REFERENCES orders(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS payment_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER,
                    amount REAL DEFAULT 0,
                    payment_method TEXT,
                    payment_time TEXT,
                    notes TEXT,
                    FOREIGN KEY (order_id) REFERENCES orders(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS config (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            ''')
            
            cursor.execute('''
                INSERT OR IGNORE INTO config (key, value) VALUES 
                ('cancellation_deadline_time', '20:00'),
                ('cancellation_deadline_days_before', '1'),
                ('deduction_after_deadline_rate', '0.5'),
                ('deduction_after_delivered_rate', '1.0')
            ''')

    def get_config(self, key: str) -> Optional[str]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM config WHERE key = ?", (key,))
            row = cursor.fetchone()
            return row['value'] if row else None

    def set_config(self, key: str, value: str):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
                (key, value)
            )

    def get_all_config(self) -> Dict[str, str]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM config")
            return {row['key']: row['value'] for row in cursor.fetchall()}

    def add_elder(self, elder: Elder) -> int:
        now = datetime.now().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO elders 
                (name, phone, id_card, subsidy_type, address, district, route, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (elder.name, elder.phone, elder.id_card, elder.subsidy_type,
                  elder.address, elder.district, elder.route, elder.notes, now, now))
            return cursor.lastrowid

    def update_elder(self, elder: Elder):
        now = datetime.now().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE elders SET 
                name=?, phone=?, id_card=?, subsidy_type=?, address=?, district=?, route=?, notes=?, updated_at=?
                WHERE id=?
            ''', (elder.name, elder.phone, elder.id_card, elder.subsidy_type,
                  elder.address, elder.district, elder.route, elder.notes, now, elder.id))

    def get_elder(self, elder_id: int) -> Optional[Elder]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM elders WHERE id = ?", (elder_id,))
            row = cursor.fetchone()
            return self._row_to_elder(row) if row else None

    def get_elder_by_id_card(self, id_card: str) -> Optional[Elder]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM elders WHERE id_card = ?", (id_card,))
            row = cursor.fetchone()
            return self._row_to_elder(row) if row else None

    def list_elders(self, search: str = None) -> List[Elder]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if search:
                like = f"%{search}%"
                cursor.execute("SELECT * FROM elders WHERE name LIKE ? OR phone LIKE ? ORDER BY id", (like, like))
            else:
                cursor.execute("SELECT * FROM elders ORDER BY id")
            return [self._row_to_elder(row) for row in cursor.fetchall()]

    def _row_to_elder(self, row) -> Elder:
        return Elder(
            id=row['id'], name=row['name'], phone=row['phone'], id_card=row['id_card'],
            subsidy_type=row['subsidy_type'], address=row['address'], district=row['district'],
            route=row['route'], notes=row['notes'], created_at=row['created_at'], updated_at=row['updated_at']
        )

    def add_meal_plan(self, plan: MealPlan) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO meal_plans (name, price, subsidy_amount, description, is_active)
                VALUES (?, ?, ?, ?, ?)
            ''', (plan.name, plan.price, plan.subsidy_amount, plan.description, 1 if plan.is_active else 0))
            return cursor.lastrowid

    def update_meal_plan(self, plan: MealPlan):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE meal_plans SET 
                name=?, price=?, subsidy_amount=?, description=?, is_active=?
                WHERE id=?
            ''', (plan.name, plan.price, plan.subsidy_amount, plan.description,
                  1 if plan.is_active else 0, plan.id))

    def get_meal_plan(self, plan_id: int) -> Optional[MealPlan]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM meal_plans WHERE id = ?", (plan_id,))
            row = cursor.fetchone()
            return self._row_to_meal_plan(row) if row else None

    def get_meal_plan_by_name(self, name: str) -> Optional[MealPlan]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM meal_plans WHERE name = ?", (name,))
            row = cursor.fetchone()
            return self._row_to_meal_plan(row) if row else None

    def list_meal_plans(self, active_only: bool = False) -> List[MealPlan]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if active_only:
                cursor.execute("SELECT * FROM meal_plans WHERE is_active = 1 ORDER BY id")
            else:
                cursor.execute("SELECT * FROM meal_plans ORDER BY id")
            return [self._row_to_meal_plan(row) for row in cursor.fetchall()]

    def _row_to_meal_plan(self, row) -> MealPlan:
        return MealPlan(
            id=row['id'], name=row['name'], price=row['price'],
            subsidy_amount=row['subsidy_amount'], description=row['description'],
            is_active=row['is_active'] == 1
        )

    def add_subsidy_history(self, history: SubsidyHistory) -> int:
        now = datetime.now().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO subsidy_history 
                (elder_id, old_subsidy_type, new_subsidy_type, effective_date, notes, changed_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (history.elder_id, history.old_subsidy_type, history.new_subsidy_type,
                  history.effective_date, history.notes, now))
            return cursor.lastrowid

    def list_subsidy_history(self, elder_id: int = None) -> List[SubsidyHistory]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if elder_id:
                cursor.execute("SELECT * FROM subsidy_history WHERE elder_id = ? ORDER BY changed_at DESC", (elder_id,))
            else:
                cursor.execute("SELECT * FROM subsidy_history ORDER BY changed_at DESC")
            rows = cursor.fetchall()
            return [SubsidyHistory(
                id=r['id'], elder_id=r['elder_id'], old_subsidy_type=r['old_subsidy_type'],
                new_subsidy_type=r['new_subsidy_type'], effective_date=r['effective_date'],
                notes=r['notes'], changed_at=r['changed_at']
            ) for r in rows]

    def add_order(self, order: Order) -> Optional[int]:
        now = datetime.now().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute('''
                    INSERT INTO orders 
                    (elder_id, elder_name, meal_date, meal_plan_id, meal_plan_name, price,
                     subsidy_type, subsidy_amount, actual_payment, delivery_address, district,
                     route, status, import_source, import_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (order.elder_id, order.elder_name, order.meal_date, order.meal_plan_id,
                      order.meal_plan_name, order.price, order.subsidy_type, order.subsidy_amount,
                      order.actual_payment, order.delivery_address, order.district, order.route,
                      order.status, order.import_source, order.import_id, now, now))
                return cursor.lastrowid
            except sqlite3.IntegrityError:
                return None

    def get_order(self, order_id: int) -> Optional[Order]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
            row = cursor.fetchone()
            return self._row_to_order(row) if row else None

    def get_order_by_import(self, import_source: str, import_id: str) -> Optional[Order]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM orders WHERE import_source = ? AND import_id = ?",
                (import_source, import_id)
            )
            row = cursor.fetchone()
            return self._row_to_order(row) if row else None

    def update_order(self, order: Order):
        now = datetime.now().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE orders SET 
                status=?, actual_payment=?, updated_at=?
                WHERE id=?
            ''', (order.status, order.actual_payment, now, order.id))

    def list_orders(self, meal_date: str = None, status: str = None, 
                    elder_id: int = None, district: str = None, route: str = None) -> List[Order]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM orders WHERE 1=1"
            params = []
            
            if meal_date:
                query += " AND meal_date = ?"
                params.append(meal_date)
            if status:
                query += " AND status = ?"
                params.append(status)
            if elder_id:
                query += " AND elder_id = ?"
                params.append(elder_id)
            if district:
                query += " AND district = ?"
                params.append(district)
            if route:
                query += " AND route = ?"
                params.append(route)
            
            query += " ORDER BY meal_date DESC, id DESC"
            cursor.execute(query, params)
            return [self._row_to_order(row) for row in cursor.fetchall()]

    def _row_to_order(self, row) -> Order:
        return Order(
            id=row['id'], elder_id=row['elder_id'], elder_name=row['elder_name'],
            meal_date=row['meal_date'], meal_plan_id=row['meal_plan_id'],
            meal_plan_name=row['meal_plan_name'], price=row['price'],
            subsidy_type=row['subsidy_type'], subsidy_amount=row['subsidy_amount'],
            actual_payment=row['actual_payment'], delivery_address=row['delivery_address'],
            district=row['district'], route=row['route'], status=row['status'],
            import_source=row['import_source'], import_id=row['import_id'],
            created_at=row['created_at'], updated_at=row['updated_at']
        )

    def add_cancellation(self, record: CancellationRecord) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO cancellation_records 
                (order_id, cancel_time, reason, reason_detail, is_after_deadline,
                 deadline_time, is_delivered, refund_amount, deduction_amount, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (record.order_id, record.cancel_time, record.reason, record.reason_detail,
                  1 if record.is_after_deadline else 0, record.deadline_time,
                  1 if record.is_delivered else 0, record.refund_amount,
                  record.deduction_amount, record.notes))
            return cursor.lastrowid

    def get_cancellation_by_order(self, order_id: int) -> Optional[CancellationRecord]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM cancellation_records WHERE order_id = ?", (order_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return CancellationRecord(
                id=row['id'], order_id=row['order_id'], cancel_time=row['cancel_time'],
                reason=row['reason'], reason_detail=row['reason_detail'],
                is_after_deadline=row['is_after_deadline'] == 1,
                deadline_time=row['deadline_time'], is_delivered=row['is_delivered'] == 1,
                refund_amount=row['refund_amount'], deduction_amount=row['deduction_amount'],
                notes=row['notes']
            )

    def list_cancellations(self, start_date: str = None, end_date: str = None) -> List[CancellationRecord]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            query = '''
                SELECT cr.* FROM cancellation_records cr
                JOIN orders o ON cr.order_id = o.id
                WHERE 1=1
            '''
            params = []
            if start_date:
                query += " AND o.meal_date >= ?"
                params.append(start_date)
            if end_date:
                query += " AND o.meal_date <= ?"
                params.append(end_date)
            query += " ORDER BY cr.cancel_time DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [CancellationRecord(
                id=r['id'], order_id=r['order_id'], cancel_time=r['cancel_time'],
                reason=r['reason'], reason_detail=r['reason_detail'],
                is_after_deadline=r['is_after_deadline'] == 1,
                deadline_time=r['deadline_time'], is_delivered=r['is_delivered'] == 1,
                refund_amount=r['refund_amount'], deduction_amount=r['deduction_amount'],
                notes=r['notes']
            ) for r in rows]

    def add_delivery(self, delivery: DeliveryRecord) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO delivery_records 
                (order_id, deliverer, delivery_time, delivered, receiver, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (delivery.order_id, delivery.deliverer, delivery.delivery_time,
                  1 if delivery.delivered else 0, delivery.receiver, delivery.notes))
            return cursor.lastrowid

    def get_delivery_by_order(self, order_id: int) -> Optional[DeliveryRecord]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM delivery_records WHERE order_id = ?", (order_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return DeliveryRecord(
                id=row['id'], order_id=row['order_id'], deliverer=row['deliverer'],
                delivery_time=row['delivery_time'], delivered=row['delivered'] == 1,
                receiver=row['receiver'], notes=row['notes']
            )

    def add_payment(self, payment: PaymentRecord) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO payment_records 
                (order_id, amount, payment_method, payment_time, notes)
                VALUES (?, ?, ?, ?, ?)
            ''', (payment.order_id, payment.amount, payment.payment_method,
                  payment.payment_time, payment.notes))
            return cursor.lastrowid

    def get_payments_by_order(self, order_id: int) -> List[PaymentRecord]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM payment_records WHERE order_id = ? ORDER BY payment_time", (order_id,))
            rows = cursor.fetchall()
            return [PaymentRecord(
                id=r['id'], order_id=r['order_id'], amount=r['amount'],
                payment_method=r['payment_method'], payment_time=r['payment_time'],
                notes=r['notes']
            ) for r in rows]
