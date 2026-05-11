"""数据存储层 - 使用 SQLite 持久化数据"""

import sqlite3
from contextlib import contextmanager
from datetime import datetime
from typing import List, Optional
import json

from .models import (
    Booking, CancellationRecord, CancellationStatus, CancellationType,
    CustomerLevel, ScheduleRule
)


DB_SCHEMA = """
CREATE TABLE IF NOT EXISTS bookings (
    booking_no TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_level TEXT NOT NULL,
    vessel_name TEXT NOT NULL,
    voyage_no TEXT NOT NULL,
    origin_port TEXT NOT NULL,
    destination_port TEXT NOT NULL,
    container_qty INTEGER NOT NULL,
    container_type TEXT NOT NULL,
    freight_rate REAL NOT NULL,
    booking_date TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vessel_name TEXT NOT NULL,
    voyage_no TEXT NOT NULL,
    etd TEXT NOT NULL,
    cutoff_time TEXT NOT NULL,
    free_cancel_hours INTEGER NOT NULL,
    charge_rate REAL NOT NULL,
    compensation_rate REAL NOT NULL,
    UNIQUE(vessel_name, voyage_no)
);

CREATE TABLE IF NOT EXISTS cancellation_records (
    id TEXT PRIMARY KEY,
    booking_no TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    cancellation_type TEXT NOT NULL,
    cancellation_time TEXT NOT NULL,
    new_vessel_name TEXT,
    new_voyage_no TEXT,
    original_vessel_released INTEGER DEFAULT 1,
    status TEXT DEFAULT '免费取消',
    original_fee REAL DEFAULT 0,
    charged_fee REAL DEFAULT 0,
    waiver_reason TEXT,
    waiver_operator TEXT,
    waiver_time TEXT,
    is_repeat_import INTEGER DEFAULT 0,
    exceptions TEXT DEFAULT '[]',
    processed INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (booking_no) REFERENCES bookings(booking_no)
);
"""


class DataStore:
    def __init__(self, db_path: str = "freight_cancel.db"):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_db(self):
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.executescript(DB_SCHEMA)
            conn.commit()

    def save_booking(self, booking: Booking):
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT OR REPLACE INTO bookings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                booking.booking_no, booking.customer_id, booking.customer_name,
                booking.customer_level.value, booking.vessel_name, booking.voyage_no,
                booking.origin_port, booking.destination_port, booking.container_qty,
                booking.container_type, booking.freight_rate,
                booking.booking_date.isoformat(), booking.created_at.isoformat()
            ))
            conn.commit()

    def get_booking(self, booking_no: str) -> Optional[Booking]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM bookings WHERE booking_no = ?", (booking_no,))
            row = cur.fetchone()
            if row:
                return Booking(
                    booking_no=row["booking_no"],
                    customer_id=row["customer_id"],
                    customer_name=row["customer_name"],
                    customer_level=CustomerLevel(row["customer_level"]),
                    vessel_name=row["vessel_name"],
                    voyage_no=row["voyage_no"],
                    origin_port=row["origin_port"],
                    destination_port=row["destination_port"],
                    container_qty=row["container_qty"],
                    container_type=row["container_type"],
                    freight_rate=row["freight_rate"],
                    booking_date=datetime.fromisoformat(row["booking_date"]),
                    created_at=datetime.fromisoformat(row["created_at"])
                )
        return None

    def get_all_bookings(self) -> List[Booking]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM bookings")
            rows = cur.fetchall()
        return [self._row_to_booking(row) for row in rows]

    def _row_to_booking(self, row) -> Booking:
        return Booking(
            booking_no=row["booking_no"],
            customer_id=row["customer_id"],
            customer_name=row["customer_name"],
            customer_level=CustomerLevel(row["customer_level"]),
            vessel_name=row["vessel_name"],
            voyage_no=row["voyage_no"],
            origin_port=row["origin_port"],
            destination_port=row["destination_port"],
            container_qty=row["container_qty"],
            container_type=row["container_type"],
            freight_rate=row["freight_rate"],
            booking_date=datetime.fromisoformat(row["booking_date"]),
            created_at=datetime.fromisoformat(row["created_at"])
        )

    def save_schedule_rule(self, rule: ScheduleRule):
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT OR REPLACE INTO schedule_rules 
                (vessel_name, voyage_no, etd, cutoff_time, free_cancel_hours, charge_rate, compensation_rate)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                rule.vessel_name, rule.voyage_no,
                rule.etd.isoformat(), rule.cutoff_time.isoformat(),
                rule.free_cancel_hours, rule.charge_rate, rule.compensation_rate
            ))
            conn.commit()

    def get_schedule_rule(self, vessel_name: str, voyage_no: str) -> Optional[ScheduleRule]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT * FROM schedule_rules 
                WHERE vessel_name = ? AND voyage_no = ?
            """, (vessel_name, voyage_no))
            row = cur.fetchone()
            if row:
                return ScheduleRule(
                    vessel_name=row["vessel_name"],
                    voyage_no=row["voyage_no"],
                    etd=datetime.fromisoformat(row["etd"]),
                    cutoff_time=datetime.fromisoformat(row["cutoff_time"]),
                    free_cancel_hours=row["free_cancel_hours"],
                    charge_rate=row["charge_rate"],
                    compensation_rate=row["compensation_rate"]
                )
        return None

    def save_cancellation(self, record: CancellationRecord):
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT OR REPLACE INTO cancellation_records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record.id, record.booking_no, record.customer_id,
                record.cancellation_type.value, record.cancellation_time.isoformat(),
                record.new_vessel_name, record.new_voyage_no,
                1 if record.original_vessel_released else 0,
                record.status.value, record.original_fee, record.charged_fee,
                record.waiver_reason, record.waiver_operator,
                record.waiver_time.isoformat() if record.waiver_time else None,
                1 if record.is_repeat_import else 0,
                json.dumps(record.exceptions),
                1 if record.processed else 0,
                datetime.now().isoformat()
            ))
            conn.commit()

    def get_cancellation(self, record_id: str) -> Optional[CancellationRecord]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM cancellation_records WHERE id = ?", (record_id,))
            row = cur.fetchone()
            if row:
                return self._row_to_cancellation(row)
        return None

    def get_cancellations_by_booking(self, booking_no: str) -> List[CancellationRecord]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT * FROM cancellation_records 
                WHERE booking_no = ? ORDER BY cancellation_time ASC
            """, (booking_no,))
            rows = cur.fetchall()
        return [self._row_to_cancellation(row) for row in rows]

    def get_all_cancellations(self) -> List[CancellationRecord]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM cancellation_records ORDER BY cancellation_time ASC")
            rows = cur.fetchall()
        return [self._row_to_cancellation(row) for row in rows]

    def get_processed_cancellations(self, booking_no: str, cancellation_type: CancellationType) -> List[CancellationRecord]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT * FROM cancellation_records 
                WHERE booking_no = ? AND cancellation_type = ? AND processed = 1
            """, (booking_no, cancellation_type.value))
            rows = cur.fetchall()
        return [self._row_to_cancellation(row) for row in rows]

    def _row_to_cancellation(self, row) -> CancellationRecord:
        return CancellationRecord(
            id=row["id"],
            booking_no=row["booking_no"],
            customer_id=row["customer_id"],
            cancellation_type=CancellationType(row["cancellation_type"]),
            cancellation_time=datetime.fromisoformat(row["cancellation_time"]),
            new_vessel_name=row["new_vessel_name"],
            new_voyage_no=row["new_voyage_no"],
            original_vessel_released=row["original_vessel_released"] == 1,
            status=CancellationStatus(row["status"]),
            original_fee=row["original_fee"],
            charged_fee=row["charged_fee"],
            waiver_reason=row["waiver_reason"],
            waiver_operator=row["waiver_operator"],
            waiver_time=datetime.fromisoformat(row["waiver_time"]) if row["waiver_time"] else None,
            is_repeat_import=row["is_repeat_import"] == 1,
            exceptions=json.loads(row["exceptions"]),
            processed=row["processed"] == 1
        )
