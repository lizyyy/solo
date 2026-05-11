"""SQLite 数据存储层"""
import sqlite3
from datetime import datetime, time
from typing import Optional, List
from contextlib import contextmanager
from pathlib import Path

from .models import (
    Product, Oven, DeliveryWindow, Order, OrderStatus,
    ProofingSchedule, BakingSchedule, ScheduleStatus, Anomaly
)


class Database:
    def __init__(self, db_path: str = "bakery.db"):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.executescript(self._get_schema())

    def _get_schema(self) -> str:
        return """
        CREATE TABLE IF NOT EXISTS products (
            product_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            proofing_time_minutes INTEGER NOT NULL,
            baking_time_minutes INTEGER NOT NULL,
            oven_capacity_units INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ovens (
            oven_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            max_capacity_units INTEGER NOT NULL,
            available_from TEXT NOT NULL,
            available_to TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS delivery_windows (
            window_id TEXT PRIMARY KEY,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            description TEXT
        );

        CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            source_system TEXT NOT NULL,
            source_record_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            customer_name TEXT NOT NULL,
            delivery_window_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            priority INTEGER NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(source_system, source_record_id)
        );

        CREATE TABLE IF NOT EXISTS proofing_schedules (
            schedule_id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            proofing_start TEXT NOT NULL,
            proofing_end TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            notes TEXT,
            FOREIGN KEY (order_id) REFERENCES orders(order_id)
        );

        CREATE TABLE IF NOT EXISTS baking_schedules (
            schedule_id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            oven_id TEXT NOT NULL,
            baking_start TEXT NOT NULL,
            baking_end TEXT NOT NULL,
            units_used INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            notes TEXT,
            FOREIGN KEY (order_id) REFERENCES orders(order_id),
            FOREIGN KEY (oven_id) REFERENCES ovens(oven_id)
        );

        CREATE TABLE IF NOT EXISTS anomalies (
            anomaly_id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            anomaly_type TEXT NOT NULL,
            description TEXT NOT NULL,
            detected_at TEXT NOT NULL,
            resolved INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (order_id) REFERENCES orders(order_id)
        );
        """

    def _time_to_str(self, t: time) -> str:
        return t.strftime("%H:%M:%S")

    def _str_to_time(self, s: str) -> time:
        return datetime.strptime(s, "%H:%M:%S").time()

    def _datetime_to_str(self, dt: datetime) -> str:
        return dt.strftime("%Y-%m-%d %H:%M:%S")

    def _str_to_datetime(self, s: str) -> datetime:
        return datetime.strptime(s, "%Y-%m-%d %H:%M:%S")

    def init_default_data(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM products")
            if cursor.fetchone()['count'] == 0:
                self._init_default_products(cursor)
            cursor.execute("SELECT COUNT(*) as count FROM ovens")
            if cursor.fetchone()['count'] == 0:
                self._init_default_ovens(cursor)
            cursor.execute("SELECT COUNT(*) as count FROM delivery_windows")
            if cursor.fetchone()['count'] == 0:
                self._init_default_delivery_windows(cursor)

    def _init_default_products(self, cursor):
        products = [
            ("P001", "法式长棍", 60, 30, 2),
            ("P002", "羊角面包", 90, 15, 1),
            ("P003", "全麦面包", 45, 40, 3),
            ("P004", "丹麦酥", 120, 20, 1),
            ("P005", "甜甜圈", 30, 10, 1),
        ]
        cursor.executemany(
            "INSERT INTO products (product_id, name, proofing_time_minutes, baking_time_minutes, oven_capacity_units) VALUES (?, ?, ?, ?, ?)",
            products
        )

    def _init_default_ovens(self, cursor):
        ovens = [
            ("O001", "一号烤箱", 10, "04:00:00", "10:00:00"),
            ("O002", "二号烤箱", 15, "04:00:00", "10:00:00"),
            ("O003", "三号烤箱", 8, "05:00:00", "11:00:00"),
        ]
        cursor.executemany(
            "INSERT INTO ovens (oven_id, name, max_capacity_units, available_from, available_to) VALUES (?, ?, ?, ?, ?)",
            ovens
        )

    def _init_default_delivery_windows(self, cursor):
        windows = [
            ("W001", "06:00:00", "07:00:00", "早间配送-第一批"),
            ("W002", "07:00:00", "08:00:00", "早间配送-第二批"),
            ("W003", "08:00:00", "09:00:00", "早间配送-第三批"),
            ("W004", "09:00:00", "10:00:00", "午间配送"),
        ]
        cursor.executemany(
            "INSERT INTO delivery_windows (window_id, start_time, end_time, description) VALUES (?, ?, ?, ?)",
            windows
        )

    def get_all_products(self) -> List[Product]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM products")
            return [Product(**dict(row)) for row in cursor.fetchall()]

    def get_product(self, product_id: str) -> Optional[Product]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM products WHERE product_id = ?", (product_id,))
            row = cursor.fetchone()
            return Product(**dict(row)) if row else None

    def get_all_ovens(self) -> List[Oven]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM ovens")
            results = []
            for row in cursor.fetchall():
                data = dict(row)
                data['available_from'] = self._str_to_time(data['available_from'])
                data['available_to'] = self._str_to_time(data['available_to'])
                results.append(Oven(**data))
            return results

    def get_oven(self, oven_id: str) -> Optional[Oven]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM ovens WHERE oven_id = ?", (oven_id,))
            row = cursor.fetchone()
            if row:
                data = dict(row)
                data['available_from'] = self._str_to_time(data['available_from'])
                data['available_to'] = self._str_to_time(data['available_to'])
                return Oven(**data)
            return None

    def get_all_delivery_windows(self) -> List[DeliveryWindow]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM delivery_windows")
            results = []
            for row in cursor.fetchall():
                data = dict(row)
                data['start_time'] = self._str_to_time(data['start_time'])
                data['end_time'] = self._str_to_time(data['end_time'])
                results.append(DeliveryWindow(**data))
            return results

    def get_delivery_window(self, window_id: str) -> Optional[DeliveryWindow]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM delivery_windows WHERE window_id = ?", (window_id,))
            row = cursor.fetchone()
            if row:
                data = dict(row)
                data['start_time'] = self._str_to_time(data['start_time'])
                data['end_time'] = self._str_to_time(data['end_time'])
                return DeliveryWindow(**data)
            return None

    def create_order(self, order: Order) -> bool:
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """INSERT INTO orders 
                    (order_id, source_system, source_record_id, product_id, quantity, 
                     customer_name, delivery_window_id, status, priority, notes, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        order.order_id, order.source_system, order.source_record_id,
                        order.product_id, order.quantity, order.customer_name,
                        order.delivery_window_id, order.status.value, order.priority,
                        order.notes, self._datetime_to_str(order.created_at),
                        self._datetime_to_str(order.updated_at)
                    )
                )
                return True
        except sqlite3.IntegrityError:
            return False

    def get_order(self, order_id: str) -> Optional[Order]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM orders WHERE order_id = ?", (order_id,))
            row = cursor.fetchone()
            if row:
                data = dict(row)
                data['status'] = OrderStatus(data['status'])
                data['created_at'] = self._str_to_datetime(data['created_at'])
                data['updated_at'] = self._str_to_datetime(data['updated_at'])
                return Order(**data)
            return None

    def get_order_by_source(self, source_system: str, source_record_id: str) -> Optional[Order]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM orders WHERE source_system = ? AND source_record_id = ?",
                (source_system, source_record_id)
            )
            row = cursor.fetchone()
            if row:
                data = dict(row)
                data['status'] = OrderStatus(data['status'])
                data['created_at'] = self._str_to_datetime(data['created_at'])
                data['updated_at'] = self._str_to_datetime(data['updated_at'])
                return Order(**data)
            return None

    def get_all_orders(self) -> List[Order]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM orders ORDER BY created_at")
            results = []
            for row in cursor.fetchall():
                data = dict(row)
                data['status'] = OrderStatus(data['status'])
                data['created_at'] = self._str_to_datetime(data['created_at'])
                data['updated_at'] = self._str_to_datetime(data['updated_at'])
                results.append(Order(**data))
            return results

    def get_orders_by_status(self, status: OrderStatus) -> List[Order]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM orders WHERE status = ? ORDER BY created_at",
                (status.value,)
            )
            results = []
            for row in cursor.fetchall():
                data = dict(row)
                data['status'] = OrderStatus(data['status'])
                data['created_at'] = self._str_to_datetime(data['created_at'])
                data['updated_at'] = self._str_to_datetime(data['updated_at'])
                results.append(Order(**data))
            return results

    def update_order_status(self, order_id: str, status: OrderStatus, notes: Optional[str] = None):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if notes:
                cursor.execute(
                    "UPDATE orders SET status = ?, notes = ?, updated_at = ? WHERE order_id = ?",
                    (status.value, notes, self._datetime_to_str(datetime.now()), order_id)
                )
            else:
                cursor.execute(
                    "UPDATE orders SET status = ?, updated_at = ? WHERE order_id = ?",
                    (status.value, self._datetime_to_str(datetime.now()), order_id)
                )

    def create_proofing_schedule(self, schedule: ProofingSchedule):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO proofing_schedules 
                (schedule_id, order_id, proofing_start, proofing_end, status, notes)
                VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    schedule.schedule_id, schedule.order_id,
                    self._datetime_to_str(schedule.proofing_start),
                    self._datetime_to_str(schedule.proofing_end),
                    schedule.status.value, schedule.notes
                )
            )

    def get_proofing_schedules(self, order_id: Optional[str] = None) -> List[ProofingSchedule]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if order_id:
                cursor.execute(
                    "SELECT * FROM proofing_schedules WHERE order_id = ?",
                    (order_id,)
                )
            else:
                cursor.execute("SELECT * FROM proofing_schedules")
            results = []
            for row in cursor.fetchall():
                data = dict(row)
                data['proofing_start'] = self._str_to_datetime(data['proofing_start'])
                data['proofing_end'] = self._str_to_datetime(data['proofing_end'])
                data['status'] = ScheduleStatus(data['status'])
                results.append(ProofingSchedule(**data))
            return results

    def delete_proofing_schedules_for_order(self, order_id: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM proofing_schedules WHERE order_id = ?", (order_id,))

    def create_baking_schedule(self, schedule: BakingSchedule):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO baking_schedules 
                (schedule_id, order_id, oven_id, baking_start, baking_end, units_used, status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    schedule.schedule_id, schedule.order_id, schedule.oven_id,
                    self._datetime_to_str(schedule.baking_start),
                    self._datetime_to_str(schedule.baking_end),
                    schedule.units_used, schedule.status.value, schedule.notes
                )
            )

    def get_baking_schedules(self, order_id: Optional[str] = None) -> List[BakingSchedule]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if order_id:
                cursor.execute(
                    "SELECT * FROM baking_schedules WHERE order_id = ?",
                    (order_id,)
                )
            else:
                cursor.execute("SELECT * FROM baking_schedules")
            results = []
            for row in cursor.fetchall():
                data = dict(row)
                data['baking_start'] = self._str_to_datetime(data['baking_start'])
                data['baking_end'] = self._str_to_datetime(data['baking_end'])
                data['status'] = ScheduleStatus(data['status'])
                results.append(BakingSchedule(**data))
            return results

    def delete_baking_schedules_for_order(self, order_id: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM baking_schedules WHERE order_id = ?", (order_id,))

    def create_anomaly(self, anomaly: Anomaly):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO anomalies 
                (anomaly_id, order_id, anomaly_type, description, detected_at, resolved)
                VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    anomaly.anomaly_id, anomaly.order_id, anomaly.anomaly_type,
                    anomaly.description, self._datetime_to_str(anomaly.detected_at),
                    1 if anomaly.resolved else 0
                )
            )

    def get_anomalies(self, order_id: Optional[str] = None, unresolved_only: bool = False) -> List[Anomaly]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM anomalies WHERE 1=1"
            params = []
            if order_id:
                query += " AND order_id = ?"
                params.append(order_id)
            if unresolved_only:
                query += " AND resolved = 0"
            query += " ORDER BY detected_at DESC"
            cursor.execute(query, params)
            results = []
            for row in cursor.fetchall():
                data = dict(row)
                data['detected_at'] = self._str_to_datetime(data['detected_at'])
                data['resolved'] = bool(data['resolved'])
                results.append(Anomaly(**data))
            return results

    def resolve_anomaly(self, anomaly_id: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE anomalies SET resolved = 1 WHERE anomaly_id = ?",
                (anomaly_id,)
            )

    def clear_all_schedules(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM proofing_schedules")
            cursor.execute("DELETE FROM baking_schedules")

    def reset_database(self):
        db_file = Path(self.db_path)
        if db_file.exists():
            db_file.unlink()
        self._init_db()
