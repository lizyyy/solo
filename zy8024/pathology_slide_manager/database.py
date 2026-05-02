import sqlite3
import json
from datetime import datetime
from typing import List, Optional, Dict, Tuple
from contextlib import contextmanager

from models import Slide, BorrowRecord, DepartmentRule, SlideStatus


class Database:
    def __init__(self, db_path: str = "pathology_slides.db"):
        self.db_path = db_path
        if db_path == ":memory:":
            self._conn = sqlite3.connect(db_path, check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
        else:
            self._conn = None
        self._init_db()

    @contextmanager
    def _get_conn(self):
        if self.db_path == ":memory:":
            yield self._conn
            self._conn.commit()
        else:
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
        with self._get_conn() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS slides (
                    slide_id TEXT PRIMARY KEY,
                    patient_id TEXT NOT NULL,
                    specimen_type TEXT NOT NULL,
                    collection_date TEXT NOT NULL,
                    department TEXT NOT NULL,
                    storage_location TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT '在库',
                    notes TEXT DEFAULT ''
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS borrow_records (
                    record_id TEXT PRIMARY KEY,
                    slide_id TEXT NOT NULL,
                    borrower_name TEXT NOT NULL,
                    borrower_dept TEXT NOT NULL,
                    borrow_date TEXT NOT NULL,
                    expected_return_date TEXT NOT NULL,
                    actual_return_date TEXT,
                    actual_return_dept TEXT,
                    status TEXT NOT NULL DEFAULT '已借出',
                    notes TEXT DEFAULT '',
                    confirmed_by TEXT,
                    confirmed_at TEXT,
                    FOREIGN KEY (slide_id) REFERENCES slides(slide_id)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS department_rules (
                    department TEXT PRIMARY KEY,
                    max_borrow_days INTEGER NOT NULL,
                    max_concurrent_borrows INTEGER NOT NULL,
                    allow_extend INTEGER DEFAULT 1,
                    requires_approval INTEGER DEFAULT 1,
                    notes TEXT DEFAULT ''
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS borrow_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    record_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    action_date TEXT NOT NULL,
                    operator TEXT,
                    details TEXT,
                    FOREIGN KEY (record_id) REFERENCES borrow_records(record_id)
                )
            """)

    def insert_slides(self, slides: List[Slide]) -> Tuple[int, int]:
        inserted = 0
        updated = 0
        with self._get_conn() as conn:
            cursor = conn.cursor()
            for slide in slides:
                cursor.execute("SELECT slide_id FROM slides WHERE slide_id = ?", (slide.slide_id,))
                existing = cursor.fetchone()
                if existing:
                    cursor.execute("""
                        UPDATE slides SET
                            patient_id = ?, specimen_type = ?, collection_date = ?,
                            department = ?, storage_location = ?, status = ?, notes = ?
                        WHERE slide_id = ?
                    """, (slide.patient_id, slide.specimen_type, slide.collection_date,
                          slide.department, slide.storage_location, slide.status.value, slide.notes,
                          slide.slide_id))
                    updated += 1
                else:
                    cursor.execute("""
                        INSERT INTO slides (slide_id, patient_id, specimen_type, collection_date,
                                          department, storage_location, status, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (slide.slide_id, slide.patient_id, slide.specimen_type, slide.collection_date,
                          slide.department, slide.storage_location, slide.status.value, slide.notes))
                    inserted += 1
        return inserted, updated

    def insert_borrow_record(self, record: BorrowRecord) -> bool:
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO borrow_records (record_id, slide_id, borrower_name, borrower_dept,
                                               borrow_date, expected_return_date, status, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (record.record_id, record.slide_id, record.borrower_name, record.borrower_dept,
                      record.borrow_date, record.expected_return_date, record.status.value, record.notes))
                self._log_history(record.record_id, "借阅", record.borrow_date,
                                details=f"借阅人: {record.borrower_name}, 部门: {record.borrower_dept}")
            return True
        except sqlite3.IntegrityError:
            return False

    def update_slide_status(self, slide_id: str, status: SlideStatus, notes: str = ""):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            if notes:
                cursor.execute("UPDATE slides SET status = ?, notes = ? WHERE slide_id = ?",
                             (status.value, notes, slide_id))
            else:
                cursor.execute("UPDATE slides SET status = ? WHERE slide_id = ?",
                             (status.value, slide_id))

    def update_borrow_record(self, record_id: str, **kwargs):
        allowed_fields = ['actual_return_date', 'actual_return_dept', 'status',
                         'notes', 'confirmed_by', 'confirmed_at']
        set_clause = []
        values = []
        for key, value in kwargs.items():
            if key in allowed_fields:
                if isinstance(value, SlideStatus):
                    value = value.value
                set_clause.append(f"{key} = ?")
                values.append(value)
        if set_clause:
            values.append(record_id)
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute(f"UPDATE borrow_records SET {', '.join(set_clause)} WHERE record_id = ?",
                             values)

    def get_slide(self, slide_id: str) -> Optional[Slide]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM slides WHERE slide_id = ?", (slide_id,))
            row = cursor.fetchone()
            if row:
                return Slide(
                    slide_id=row['slide_id'],
                    patient_id=row['patient_id'],
                    specimen_type=row['specimen_type'],
                    collection_date=row['collection_date'],
                    department=row['department'],
                    storage_location=row['storage_location'],
                    status=SlideStatus(row['status']),
                    notes=row['notes'] or ""
                )
        return None

    def get_all_slides(self) -> List[Slide]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM slides ORDER BY slide_id")
            rows = cursor.fetchall()
            return [Slide(
                slide_id=row['slide_id'],
                patient_id=row['patient_id'],
                specimen_type=row['specimen_type'],
                collection_date=row['collection_date'],
                department=row['department'],
                storage_location=row['storage_location'],
                status=SlideStatus(row['status']),
                notes=row['notes'] or ""
            ) for row in rows]

    def get_borrow_records(self, slide_id: str = None, status: SlideStatus = None) -> List[BorrowRecord]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM borrow_records WHERE 1=1"
            params = []
            if slide_id:
                query += " AND slide_id = ?"
                params.append(slide_id)
            if status:
                query += " AND status = ?"
                params.append(status.value)
            query += " ORDER BY borrow_date DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [BorrowRecord(
                record_id=row['record_id'],
                slide_id=row['slide_id'],
                borrower_name=row['borrower_name'],
                borrower_dept=row['borrower_dept'],
                borrow_date=row['borrow_date'],
                expected_return_date=row['expected_return_date'],
                actual_return_date=row['actual_return_date'],
                actual_return_dept=row['actual_return_dept'],
                status=SlideStatus(row['status']),
                notes=row['notes'] or "",
                confirmed_by=row['confirmed_by'],
                confirmed_at=row['confirmed_at']
            ) for row in rows]

    def get_active_borrow_by_slide(self, slide_id: str) -> Optional[BorrowRecord]:
        records = self.get_borrow_records(slide_id=slide_id, status=SlideStatus.BORROWED)
        return records[0] if records else None

    def get_overdue_records(self) -> List[BorrowRecord]:
        today = datetime.now().strftime("%Y-%m-%d")
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM borrow_records
                WHERE status = ? AND expected_return_date < ?
                ORDER BY expected_return_date
            """, (SlideStatus.BORROWED.value, today))
            rows = cursor.fetchall()
            return [BorrowRecord(
                record_id=row['record_id'],
                slide_id=row['slide_id'],
                borrower_name=row['borrower_name'],
                borrower_dept=row['borrower_dept'],
                borrow_date=row['borrow_date'],
                expected_return_date=row['expected_return_date'],
                actual_return_date=row['actual_return_date'],
                actual_return_dept=row['actual_return_dept'],
                status=SlideStatus(row['status']),
                notes=row['notes'] or "",
                confirmed_by=row['confirmed_by'],
                confirmed_at=row['confirmed_at']
            ) for row in rows]

    def insert_department_rules(self, rules: List[DepartmentRule]) -> Tuple[int, int]:
        inserted = 0
        updated = 0
        with self._get_conn() as conn:
            cursor = conn.cursor()
            for rule in rules:
                cursor.execute("SELECT department FROM department_rules WHERE department = ?",
                             (rule.department,))
                existing = cursor.fetchone()
                if existing:
                    cursor.execute("""
                        UPDATE department_rules SET
                            max_borrow_days = ?, max_concurrent_borrows = ?,
                            allow_extend = ?, requires_approval = ?, notes = ?
                        WHERE department = ?
                    """, (rule.max_borrow_days, rule.max_concurrent_borrows,
                          int(rule.allow_extend), int(rule.requires_approval), rule.notes,
                          rule.department))
                    updated += 1
                else:
                    cursor.execute("""
                        INSERT INTO department_rules (department, max_borrow_days, max_concurrent_borrows,
                                                    allow_extend, requires_approval, notes)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (rule.department, rule.max_borrow_days, rule.max_concurrent_borrows,
                          int(rule.allow_extend), int(rule.requires_approval), rule.notes))
                    inserted += 1
        return inserted, updated

    def get_department_rule(self, department: str) -> Optional[DepartmentRule]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM department_rules WHERE department = ?", (department,))
            row = cursor.fetchone()
            if row:
                return DepartmentRule(
                    department=row['department'],
                    max_borrow_days=row['max_borrow_days'],
                    max_concurrent_borrows=row['max_concurrent_borrows'],
                    allow_extend=bool(row['allow_extend']),
                    requires_approval=bool(row['requires_approval']),
                    notes=row['notes'] or ""
                )
        return None

    def get_all_department_rules(self) -> List[DepartmentRule]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM department_rules ORDER BY department")
            rows = cursor.fetchall()
            return [DepartmentRule(
                department=row['department'],
                max_borrow_days=row['max_borrow_days'],
                max_concurrent_borrows=row['max_concurrent_borrows'],
                allow_extend=bool(row['allow_extend']),
                requires_approval=bool(row['requires_approval']),
                notes=row['notes'] or ""
            ) for row in rows]

    def _log_history(self, record_id: str, action: str, action_date: str,
                    operator: str = None, details: str = None):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO borrow_history (record_id, action, action_date, operator, details)
                VALUES (?, ?, ?, ?, ?)
            """, (record_id, action, action_date, operator, details))

    def get_borrow_history(self, record_id: str = None) -> List[Dict]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            if record_id:
                cursor.execute("""
                    SELECT * FROM borrow_history WHERE record_id = ? ORDER BY action_date
                """, (record_id,))
            else:
                cursor.execute("SELECT * FROM borrow_history ORDER BY action_date DESC")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def search_slides(self, keyword: str = None, status: SlideStatus = None,
                     department: str = None) -> List[Slide]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM slides WHERE 1=1"
            params = []
            if keyword:
                query += " AND (slide_id LIKE ? OR patient_id LIKE ? OR notes LIKE ?)"
                kw = f"%{keyword}%"
                params.extend([kw, kw, kw])
            if status:
                query += " AND status = ?"
                params.append(status.value)
            if department:
                query += " AND department = ?"
                params.append(department)
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [Slide(
                slide_id=row['slide_id'],
                patient_id=row['patient_id'],
                specimen_type=row['specimen_type'],
                collection_date=row['collection_date'],
                department=row['department'],
                storage_location=row['storage_location'],
                status=SlideStatus(row['status']),
                notes=row['notes'] or ""
            ) for row in rows]

    def get_statistics(self) -> Dict:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            stats = {}

            cursor.execute("SELECT COUNT(*) as count FROM slides")
            stats['total_slides'] = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM slides WHERE status = ?",
                          (SlideStatus.AVAILABLE.value,))
            stats['available'] = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM slides WHERE status = ?",
                          (SlideStatus.BORROWED.value,))
            stats['borrowed'] = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM slides WHERE status = ?",
                          (SlideStatus.OVERDUE.value,))
            stats['overdue'] = cursor.fetchone()['count']

            today = datetime.now().strftime("%Y-%m-%d")
            cursor.execute("""
                SELECT COUNT(*) as count FROM borrow_records
                WHERE status = ? AND expected_return_date < ?
            """, (SlideStatus.BORROWED.value, today))
            stats['overdue_count'] = cursor.fetchone()['count']

            return stats

    def delete_all_data(self):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM borrow_history")
            cursor.execute("DELETE FROM borrow_records")
            cursor.execute("DELETE FROM slides")
            cursor.execute("DELETE FROM department_rules")
