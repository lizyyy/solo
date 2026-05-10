import sqlite3
from datetime import datetime
import os


class Database:
    def __init__(self, db_path=None):
        if db_path is None:
            db_path = os.path.join(os.getcwd(), "returns.db")
        self.db_path = db_path
        self.conn = None
        self.connect()
        self.create_tables()

    def connect(self):
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row

    def close(self):
        if self.conn:
            self.conn.close()

    def create_tables(self):
        cursor = self.conn.cursor()

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS return_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_no TEXT NOT NULL UNIQUE,
                customer_name TEXT,
                return_date TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS return_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                return_order_id INTEGER NOT NULL,
                serial_number TEXT NOT NULL,
                product_name TEXT,
                sku TEXT,
                quality_result TEXT,
                missing_parts_note TEXT,
                refund_status TEXT,
                warehouse_location TEXT,
                repair_responsibility TEXT,
                import_batch_id TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (return_order_id) REFERENCES return_orders (id)
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS import_batches (
                id TEXT PRIMARY KEY,
                file_name TEXT NOT NULL,
                import_time TEXT NOT NULL,
                total_records INTEGER,
                success_records INTEGER,
                status TEXT
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS exceptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER,
                serial_number TEXT,
                order_no TEXT,
                exception_type TEXT NOT NULL,
                exception_detail TEXT NOT NULL,
                is_resolved INTEGER DEFAULT 0,
                resolution_note TEXT,
                resolved_at TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (item_id) REFERENCES return_items (id)
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS fix_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER,
                serial_number TEXT,
                field_name TEXT,
                old_value TEXT,
                new_value TEXT,
                operator TEXT,
                note TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (item_id) REFERENCES return_items (id)
            )
            """
        )

        self.conn.commit()

    def add_return_order(self, order_no, customer_name, return_date):
        cursor = self.conn.cursor()
        now = datetime.now().isoformat()
        try:
            cursor.execute(
                """
                INSERT INTO return_orders (order_no, customer_name, return_date, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (order_no, customer_name, return_date, now, now),
            )
        except sqlite3.IntegrityError:
            cursor.execute(
                """
                UPDATE return_orders
                SET updated_at = ?, customer_name = COALESCE(?, customer_name)
                WHERE order_no = ?
                """,
                (now, customer_name, order_no),
            )
        self.conn.commit()
        cursor.execute("SELECT id FROM return_orders WHERE order_no = ?", (order_no,))
        return cursor.fetchone()["id"]

    def add_return_item(
        self,
        return_order_id,
        serial_number,
        product_name,
        sku,
        quality_result,
        missing_parts_note,
        refund_status,
        warehouse_location,
        repair_responsibility,
        import_batch_id,
    ):
        cursor = self.conn.cursor()
        now = datetime.now().isoformat()
        cursor.execute(
            """
            INSERT INTO return_items (
                return_order_id, serial_number, product_name, sku, quality_result,
                missing_parts_note, refund_status, warehouse_location, repair_responsibility,
                import_batch_id, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                return_order_id,
                serial_number,
                product_name,
                sku,
                quality_result,
                missing_parts_note,
                refund_status,
                warehouse_location,
                repair_responsibility,
                import_batch_id,
                now,
            ),
        )
        self.conn.commit()
        return cursor.lastrowid

    def add_import_batch(self, batch_id, file_name, total_records, success_records, status):
        cursor = self.conn.cursor()
        now = datetime.now().isoformat()
        cursor.execute(
            """
            INSERT INTO import_batches (id, file_name, import_time, total_records, success_records, status)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (batch_id, file_name, now, total_records, success_records, status),
        )
        self.conn.commit()

    def add_exception(
        self,
        item_id,
        serial_number,
        order_no,
        exception_type,
        exception_detail,
    ):
        cursor = self.conn.cursor()
        now = datetime.now().isoformat()
        cursor.execute(
            """
            INSERT INTO exceptions (
                item_id, serial_number, order_no, exception_type, exception_detail, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (item_id, serial_number, order_no, exception_type, exception_detail, now),
        )
        self.conn.commit()

    def add_fix_record(
        self, item_id, serial_number, field_name, old_value, new_value, operator, note
    ):
        cursor = self.conn.cursor()
        now = datetime.now().isoformat()
        cursor.execute(
            """
            INSERT INTO fix_records (
                item_id, serial_number, field_name, old_value, new_value, operator, note, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (item_id, serial_number, field_name, old_value, new_value, operator, note, now),
        )
        self.conn.commit()

    def get_batch_by_id(self, batch_id):
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM import_batches WHERE id = ?", (batch_id,))
        return cursor.fetchone()

    def get_item_by_serial(self, serial_number):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            SELECT ri.*, ro.order_no
            FROM return_items ri
            JOIN return_orders ro ON ri.return_order_id = ro.id
            WHERE ri.serial_number = ?
            ORDER BY ri.created_at DESC
            """,
            (serial_number,),
        )
        return cursor.fetchall()

    def get_all_orders(self):
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM return_orders ORDER BY return_date DESC")
        return cursor.fetchall()

    def get_items_by_order(self, order_no):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            SELECT ri.*, ro.order_no
            FROM return_items ri
            JOIN return_orders ro ON ri.return_order_id = ro.id
            WHERE ro.order_no = ?
            """,
            (order_no,),
        )
        return cursor.fetchall()

    def get_unresolved_exceptions(self):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            SELECT * FROM exceptions
            WHERE is_resolved = 0
            ORDER BY created_at DESC
            """
        )
        return cursor.fetchall()

    def get_all_exceptions(self):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            SELECT * FROM exceptions
            ORDER BY created_at DESC
            """
        )
        return cursor.fetchall()

    def resolve_exception(self, exception_id, resolution_note, operator="系统"):
        cursor = self.conn.cursor()
        now = datetime.now().isoformat()
        cursor.execute(
            """
            UPDATE exceptions
            SET is_resolved = 1, resolution_note = ?, resolved_at = ?
            WHERE id = ?
            """,
            (resolution_note, now, exception_id),
        )
        self.conn.commit()

    def update_item_field(self, item_id, field_name, new_value, operator, note):
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM return_items WHERE id = ?", (item_id,))
        item = cursor.fetchone()
        if item is None:
            raise ValueError(f"找不到商品ID: {item_id}")

        old_value = str(item[field_name]) if item[field_name] is not None else ""
        if old_value == str(new_value):
            return

        cursor.execute(
            f"UPDATE return_items SET {field_name} = ? WHERE id = ?",
            (new_value, item_id),
        )
        self.conn.commit()

        self.add_fix_record(
            item_id, item["serial_number"], field_name, old_value, str(new_value), operator, note
        )
