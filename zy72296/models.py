import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum


class RecordStatus(str, Enum):
    IMPORTED = "imported"
    COORD_MIXED = "coord_mixed"
    CAD_REVIEWED = "cad_reviewed"
    PENDING_CONFIRM = "pending_confirm"
    CONFIRMED = "confirmed"


class CoordType(str, Enum):
    LATLNG = "latlng"
    METRIC = "metric"
    MIXED = "mixed"
    UNKNOWN = "unknown"


@dataclass
class InspectionRecord:
    id: Optional[int]
    photo_number: str
    original_line_number: int
    source_file: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    metric_x: Optional[float] = None
    metric_y: Optional[float] = None
    coord_type: CoordType = CoordType.UNKNOWN
    cad_layer_name: Optional[str] = None
    bracket_number: Optional[str] = None
    field_note: str = ""
    status: RecordStatus = RecordStatus.IMPORTED
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> Dict:
        data = asdict(self)
        data["coord_type"] = self.coord_type.value if isinstance(self.coord_type, CoordType) else self.coord_type
        data["status"] = self.status.value if isinstance(self.status, RecordStatus) else self.status
        return data


@dataclass
class ChangeHistory:
    id: Optional[int]
    record_id: int
    field_name: str
    old_value: str
    new_value: str
    changed_by: str
    change_reason: str
    changed_at: str

    def to_dict(self) -> Dict:
        return asdict(self)


class Database:
    def __init__(self, db_path: str = "inspection.db"):
        self.db_path = db_path
        self.init_db()

    def get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        conn = self.get_conn()
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS inspection_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                photo_number TEXT NOT NULL,
                original_line_number INTEGER NOT NULL,
                source_file TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                metric_x REAL,
                metric_y REAL,
                coord_type TEXT DEFAULT 'unknown',
                cad_layer_name TEXT,
                bracket_number TEXT,
                field_note TEXT DEFAULT '',
                status TEXT DEFAULT 'imported',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(photo_number, source_file)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS change_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id INTEGER NOT NULL,
                field_name TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                changed_by TEXT NOT NULL,
                change_reason TEXT NOT NULL,
                changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (record_id) REFERENCES inspection_records(id)
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_photo_number ON inspection_records(photo_number)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_status ON inspection_records(status)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_record_history ON change_history(record_id)
        """)

        conn.commit()
        conn.close()

    def detect_coord_type(self, lat: Optional[float], lng: Optional[float],
                          mx: Optional[float], my: Optional[float]) -> CoordType:
        has_latlng = lat is not None and lng is not None
        has_metric = mx is not None and my is not None

        if has_latlng and has_metric:
            return CoordType.MIXED
        elif has_latlng:
            return CoordType.LATLNG
        elif has_metric:
            return CoordType.METRIC
        return CoordType.UNKNOWN

    def import_records(self, records: List[Dict], source_file: str,
                       imported_by: str = "system") -> Dict[str, Any]:
        conn = self.get_conn()
        cursor = conn.cursor()

        results = {
            "imported": 0,
            "updated": 0,
            "skipped": 0,
            "coord_mixed": 0,
            "record_ids": []
        }

        for idx, rec in enumerate(records, start=1):
            photo_number = rec.get("photo_number", "").strip()
            if not photo_number:
                results["skipped"] += 1
                continue

            lat = rec.get("latitude")
            lng = rec.get("longitude")
            mx = rec.get("metric_x")
            my = rec.get("metric_y")
            coord_type = self.detect_coord_type(lat, lng, mx, my)

            status = RecordStatus.IMPORTED
            if coord_type == CoordType.MIXED:
                status = RecordStatus.COORD_MIXED
                results["coord_mixed"] += 1

            cursor.execute("""
                SELECT id FROM inspection_records
                WHERE photo_number = ? AND source_file = ?
            """, (photo_number, source_file))
            existing = cursor.fetchone()

            if existing:
                record_id = existing["id"]
                self._update_record(cursor, record_id, rec, coord_type, status, imported_by)
                results["updated"] += 1
            else:
                record_id = self._insert_record(cursor, photo_number, idx,
                                                source_file, rec, coord_type, status)
                results["imported"] += 1

            results["record_ids"].append(record_id)

        conn.commit()
        conn.close()
        return results

    def _insert_record(self, cursor, photo_number: str, line_num: int,
                       source_file: str, rec: Dict, coord_type: CoordType,
                       status: RecordStatus) -> int:
        cursor.execute("""
            INSERT INTO inspection_records
            (photo_number, original_line_number, source_file,
             latitude, longitude, metric_x, metric_y, coord_type,
             cad_layer_name, bracket_number, field_note, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            photo_number, line_num, source_file,
            rec.get("latitude"), rec.get("longitude"),
            rec.get("metric_x"), rec.get("metric_y"),
            coord_type.value,
            rec.get("cad_layer_name"),
            rec.get("bracket_number"),
            rec.get("field_note", ""),
            status.value
        ))
        return cursor.lastrowid

    def _update_record(self, cursor, record_id: int, rec: Dict,
                       coord_type: CoordType, status: RecordStatus,
                       updated_by: str):
        cursor.execute("SELECT * FROM inspection_records WHERE id = ?", (record_id,))
        old = cursor.fetchone()

        updates = []
        params = []

        fields = [
            ("latitude", rec.get("latitude")),
            ("longitude", rec.get("longitude")),
            ("metric_x", rec.get("metric_x")),
            ("metric_y", rec.get("metric_y")),
            ("cad_layer_name", rec.get("cad_layer_name")),
            ("bracket_number", rec.get("bracket_number")),
            ("field_note", rec.get("field_note")),
            ("coord_type", coord_type.value),
            ("status", status.value)
        ]

        for field, new_val in fields:
            old_val = old[field]
            if str(old_val) != str(new_val):
                updates.append(f"{field} = ?")
                params.append(new_val)
                self._log_change(cursor, record_id, field,
                               str(old_val) if old_val is not None else "",
                               str(new_val) if new_val is not None else "",
                               updated_by, "reimport_update")

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            cursor.execute(
                f"UPDATE inspection_records SET {', '.join(updates)} WHERE id = ?",
                params + [record_id]
            )

    def _log_change(self, cursor, record_id: int, field_name: str,
                    old_value: str, new_value: str, changed_by: str,
                    reason: str):
        cursor.execute("""
            INSERT INTO change_history
            (record_id, field_name, old_value, new_value, changed_by, change_reason)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (record_id, field_name, old_value, new_value, changed_by, reason))

    def update_cad_layer(self, record_id: int, cad_layer_name: str,
                         updated_by: str, reason: str = "cad_review") -> bool:
        conn = self.get_conn()
        cursor = conn.cursor()

        cursor.execute("SELECT cad_layer_name, status FROM inspection_records WHERE id = ?", (record_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return False

        old_layer = row["cad_layer_name"] or ""
        old_status = row["status"]

        if old_layer != cad_layer_name:
            self._log_change(cursor, record_id, "cad_layer_name",
                           old_layer, cad_layer_name, updated_by, reason)

        new_status = RecordStatus.CAD_REVIEWED if old_status == RecordStatus.COORD_MIXED.value else old_status
        if new_status != old_status:
            self._log_change(cursor, record_id, "status",
                           old_status, new_status, updated_by, f"status_change_{reason}")

        cursor.execute("""
            UPDATE inspection_records
            SET cad_layer_name = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (cad_layer_name, new_status, record_id))

        conn.commit()
        conn.close()
        return True

    def update_field_note(self, record_id: int, field_note: str,
                          updated_by: str, reason: str = "note_update") -> bool:
        conn = self.get_conn()
        cursor = conn.cursor()

        cursor.execute("SELECT field_note, status FROM inspection_records WHERE id = ?", (record_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return False

        old_note = row["field_note"] or ""
        old_status = row["status"]

        if old_note != field_note:
            self._log_change(cursor, record_id, "field_note",
                           old_note, field_note, updated_by, reason)

        if old_status in [RecordStatus.IMPORTED.value, RecordStatus.CAD_REVIEWED.value]:
            new_status = RecordStatus.PENDING_CONFIRM
            self._log_change(cursor, record_id, "status",
                           old_status, new_status.value, updated_by, "ready_for_confirmation")
            cursor.execute("""
                UPDATE inspection_records
                SET field_note = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (field_note, new_status.value, record_id))
        else:
            cursor.execute("""
                UPDATE inspection_records
                SET field_note = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (field_note, record_id))

        conn.commit()
        conn.close()
        return True

    def confirm_record(self, record_id: int, confirmed_by: str) -> bool:
        conn = self.get_conn()
        cursor = conn.cursor()

        cursor.execute("SELECT status FROM inspection_records WHERE id = ?", (record_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return False

        old_status = row["status"]
        new_status = RecordStatus.CONFIRMED

        self._log_change(cursor, record_id, "status",
                        old_status, new_status.value, confirmed_by, "inspection_confirmed")

        cursor.execute("""
            UPDATE inspection_records
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (new_status.value, record_id))

        conn.commit()
        conn.close()
        return True

    def rollback_status(self, record_id: int, target_status: RecordStatus,
                        rolled_by: str, reason: str) -> bool:
        conn = self.get_conn()
        cursor = conn.cursor()

        cursor.execute("SELECT status FROM inspection_records WHERE id = ?", (record_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return False

        old_status = row["status"]

        self._log_change(cursor, record_id, "status",
                        old_status, target_status.value, rolled_by, f"rollback: {reason}")

        cursor.execute("""
            UPDATE inspection_records
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (target_status.value, record_id))

        conn.commit()
        conn.close()
        return True

    def get_record(self, record_id: int) -> Optional[Dict]:
        conn = self.get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM inspection_records WHERE id = ?", (record_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def get_records(self, status: Optional[RecordStatus] = None,
                    source_file: Optional[str] = None) -> List[Dict]:
        conn = self.get_conn()
        cursor = conn.cursor()

        query = "SELECT * FROM inspection_records WHERE 1=1"
        params = []

        if status:
            query += " AND status = ?"
            params.append(status.value)
        if source_file:
            query += " AND source_file = ?"
            params.append(source_file)

        query += " ORDER BY original_line_number ASC"

        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def get_history(self, record_id: int) -> List[Dict]:
        conn = self.get_conn()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM change_history
            WHERE record_id = ?
            ORDER BY changed_at ASC
        """, (record_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def get_field_summary(self) -> Dict[str, Any]:
        records = self.get_records()
        summary = {
            "total": len(records),
            "by_status": {},
            "by_coord_type": {},
            "source_files": set(),
            "needs_attention": []
        }

        for rec in records:
            status = rec["status"]
            coord = rec["coord_type"]
            summary["by_status"][status] = summary["by_status"].get(status, 0) + 1
            summary["by_coord_type"][coord] = summary["by_coord_type"].get(coord, 0) + 1
            summary["source_files"].add(rec["source_file"])

            if status in [RecordStatus.COORD_MIXED.value, RecordStatus.PENDING_CONFIRM.value]:
                summary["needs_attention"].append({
                    "id": rec["id"],
                    "photo_number": rec["photo_number"],
                    "status": status,
                    "field_note": rec.get("field_note", "")
                })

        summary["source_files"] = list(summary["source_files"])
        return summary

    def get_field_team_view(self) -> List[Dict]:
        records = self.get_records()
        view_data = []

        for rec in records:
            source_tags = []
            if rec.get("photo_number"):
                source_tags.append("照片")
            if rec.get("cad_layer_name"):
                source_tags.append("CAD")
            else:
                source_tags.append("待CAD")

            status_text = {
                RecordStatus.IMPORTED.value: "待处理",
                RecordStatus.COORD_MIXED.value: "坐标混合待复核",
                RecordStatus.CAD_REVIEWED.value: "CAD已审核",
                RecordStatus.PENDING_CONFIRM.value: "待巡检组确认",
                RecordStatus.CONFIRMED.value: "已确认"
            }.get(rec["status"], rec["status"])

            coord_note = ""
            if rec["coord_type"] == CoordType.MIXED.value:
                coord_note = " ⚠️经纬度/米制坐标混合"

            view_data.append({
                "photo_number": rec["photo_number"],
                "bracket_number": rec.get("bracket_number", "未编号"),
                "sources": "/".join(source_tags),
                "status": status_text,
                "coord_note": coord_note,
                "field_note": rec.get("field_note", ""),
                "needs_confirm": rec["status"] == RecordStatus.PENDING_CONFIRM.value
            })

        return view_data
