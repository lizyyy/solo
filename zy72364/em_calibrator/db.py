import sqlite3
from typing import List, Optional

from .models import CalibrationBatch, TemperatureRecord, ChangeHistory, SensorMapping, WorkflowLog

_SCHEMA = """
CREATE TABLE IF NOT EXISTS calibration_batch (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_hash TEXT UNIQUE,
    source_file TEXT,
    imported_at TEXT,
    record_count INTEGER
);

CREATE TABLE IF NOT EXISTS temperature_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER,
    original_line_no INTEGER,
    sensor_id TEXT,
    equipment_position TEXT,
    temperature_value REAL,
    caliber TEXT,
    remark TEXT,
    status TEXT DEFAULT 'imported',
    created_at TEXT,
    updated_at TEXT,
    UNIQUE(batch_id, original_line_no),
    FOREIGN KEY (batch_id) REFERENCES calibration_batch(id)
);

CREATE TABLE IF NOT EXISTS change_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER,
    change_type TEXT DEFAULT 'import',
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT,
    changed_at TEXT,
    reason TEXT,
    FOREIGN KEY (record_id) REFERENCES temperature_record(id)
);

CREATE TABLE IF NOT EXISTS sensor_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_position TEXT,
    old_sensor_id TEXT,
    new_sensor_id TEXT,
    detected_at TEXT,
    approved_by TEXT,
    verdict TEXT DEFAULT 'pending',
    remark TEXT
);

CREATE TABLE IF NOT EXISTS workflow_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER,
    from_status TEXT,
    to_status TEXT,
    operator TEXT,
    operated_at TEXT,
    note TEXT,
    FOREIGN KEY (record_id) REFERENCES temperature_record(id)
);
"""


def _row_to_batch(row: sqlite3.Row) -> CalibrationBatch:
    return CalibrationBatch(
        id=row["id"],
        batch_hash=row["batch_hash"],
        source_file=row["source_file"],
        imported_at=row["imported_at"],
        record_count=row["record_count"],
    )


def _row_to_record(row: sqlite3.Row) -> TemperatureRecord:
    return TemperatureRecord(
        id=row["id"],
        batch_id=row["batch_id"],
        original_line_no=row["original_line_no"],
        sensor_id=row["sensor_id"],
        equipment_position=row["equipment_position"],
        temperature_value=row["temperature_value"],
        caliber=row["caliber"],
        remark=row["remark"],
        status=row["status"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _row_to_change_history(row: sqlite3.Row) -> ChangeHistory:
    return ChangeHistory(
        id=row["id"],
        record_id=row["record_id"],
        change_type=row["change_type"],
        field_name=row["field_name"],
        old_value=row["old_value"],
        new_value=row["new_value"],
        changed_by=row["changed_by"],
        changed_at=row["changed_at"],
        reason=row["reason"],
    )


def _row_to_sensor_mapping(row: sqlite3.Row) -> SensorMapping:
    return SensorMapping(
        id=row["id"],
        equipment_position=row["equipment_position"],
        old_sensor_id=row["old_sensor_id"],
        new_sensor_id=row["new_sensor_id"],
        detected_at=row["detected_at"],
        approved_by=row["approved_by"],
        verdict=row["verdict"],
        remark=row["remark"],
    )


def _row_to_workflow_log(row: sqlite3.Row) -> WorkflowLog:
    return WorkflowLog(
        id=row["id"],
        record_id=row["record_id"],
        from_status=row["from_status"],
        to_status=row["to_status"],
        operator=row["operator"],
        operated_at=row["operated_at"],
        note=row["note"],
    )


class Database:
    def __init__(self, db_path: str = ":memory:"):
        self._conn = sqlite3.connect(db_path)
        self._conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    def close(self):
        self._conn.close()

    def insert_batch(self, batch: CalibrationBatch) -> int:
        cur = self._conn.execute(
            "INSERT INTO calibration_batch (batch_hash, source_file, imported_at, record_count) VALUES (?, ?, ?, ?)",
            (batch.batch_hash, batch.source_file, batch.imported_at, batch.record_count),
        )
        self._conn.commit()
        return cur.lastrowid

    def get_batch_by_hash(self, batch_hash: str) -> Optional[CalibrationBatch]:
        row = self._conn.execute(
            "SELECT * FROM calibration_batch WHERE batch_hash = ?", (batch_hash,)
        ).fetchone()
        if row is None:
            return None
        return _row_to_batch(row)

    def insert_record(self, rec: TemperatureRecord) -> int:
        cur = self._conn.execute(
            "INSERT INTO temperature_record (batch_id, original_line_no, sensor_id, equipment_position, temperature_value, caliber, remark, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (rec.batch_id, rec.original_line_no, rec.sensor_id, rec.equipment_position, rec.temperature_value, rec.caliber, rec.remark, rec.status, rec.created_at, rec.updated_at),
        )
        self._conn.commit()
        return cur.lastrowid

    def update_record(self, rec: TemperatureRecord):
        self._conn.execute(
            "UPDATE temperature_record SET batch_id=?, original_line_no=?, sensor_id=?, equipment_position=?, temperature_value=?, caliber=?, remark=?, status=?, created_at=?, updated_at=? WHERE id=?",
            (rec.batch_id, rec.original_line_no, rec.sensor_id, rec.equipment_position, rec.temperature_value, rec.caliber, rec.remark, rec.status, rec.created_at, rec.updated_at, rec.id),
        )
        self._conn.commit()

    def get_record(self, record_id: int) -> Optional[TemperatureRecord]:
        row = self._conn.execute(
            "SELECT * FROM temperature_record WHERE id = ?", (record_id,)
        ).fetchone()
        if row is None:
            return None
        return _row_to_record(row)

    def get_records_by_batch(self, batch_id: int) -> List[TemperatureRecord]:
        rows = self._conn.execute(
            "SELECT * FROM temperature_record WHERE batch_id = ?", (batch_id,)
        ).fetchall()
        return [_row_to_record(r) for r in rows]

    def get_record_by_batch_and_line(self, batch_id: int, line_no: int) -> Optional[TemperatureRecord]:
        row = self._conn.execute(
            "SELECT * FROM temperature_record WHERE batch_id = ? AND original_line_no = ?",
            (batch_id, line_no),
        ).fetchone()
        if row is None:
            return None
        return _row_to_record(row)

    def get_latest_record_for_position(self, equipment_position: str) -> Optional[TemperatureRecord]:
        row = self._conn.execute(
            "SELECT * FROM temperature_record WHERE equipment_position = ? ORDER BY created_at DESC LIMIT 1",
            (equipment_position,),
        ).fetchone()
        if row is None:
            return None
        return _row_to_record(row)

    def get_previous_record_for_position(self, equipment_position: str, exclude_record_id: int) -> Optional[TemperatureRecord]:
        row = self._conn.execute(
            "SELECT * FROM temperature_record WHERE equipment_position = ? AND id != ? ORDER BY created_at DESC LIMIT 1",
            (equipment_position, exclude_record_id),
        ).fetchone()
        if row is None:
            return None
        return _row_to_record(row)

    def get_records_by_status(self, status: str) -> List[TemperatureRecord]:
        rows = self._conn.execute(
            "SELECT * FROM temperature_record WHERE status = ?", (status,)
        ).fetchall()
        return [_row_to_record(r) for r in rows]

    def count_records_by_batch(self, batch_id: int) -> int:
        row = self._conn.execute(
            "SELECT COUNT(*) AS cnt FROM temperature_record WHERE batch_id = ?", (batch_id,)
        ).fetchone()
        return row["cnt"]

    def insert_change_history(self, ch: ChangeHistory) -> int:
        cur = self._conn.execute(
            "INSERT INTO change_history (record_id, change_type, field_name, old_value, new_value, changed_by, changed_at, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (ch.record_id, ch.change_type, ch.field_name, ch.old_value, ch.new_value, ch.changed_by, ch.changed_at, ch.reason),
        )
        self._conn.commit()
        return cur.lastrowid

    def get_change_history(self, record_id: int) -> List[ChangeHistory]:
        rows = self._conn.execute(
            "SELECT * FROM change_history WHERE record_id = ?", (record_id,)
        ).fetchall()
        return [_row_to_change_history(r) for r in rows]

    def insert_sensor_mapping(self, sm: SensorMapping) -> int:
        cur = self._conn.execute(
            "INSERT INTO sensor_mapping (equipment_position, old_sensor_id, new_sensor_id, detected_at, approved_by, verdict, remark) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (sm.equipment_position, sm.old_sensor_id, sm.new_sensor_id, sm.detected_at, sm.approved_by, sm.verdict, sm.remark),
        )
        self._conn.commit()
        return cur.lastrowid

    def get_pending_sensor_mappings(self) -> List[SensorMapping]:
        rows = self._conn.execute(
            "SELECT * FROM sensor_mapping WHERE verdict = 'pending'"
        ).fetchall()
        return [_row_to_sensor_mapping(r) for r in rows]

    def get_sensor_mapping(self, mapping_id: int) -> Optional[SensorMapping]:
        row = self._conn.execute(
            "SELECT * FROM sensor_mapping WHERE id = ?", (mapping_id,)
        ).fetchone()
        if row is None:
            return None
        return _row_to_sensor_mapping(row)

    def update_sensor_mapping_verdict(self, mapping_id: int, verdict: str, approved_by: str):
        self._conn.execute(
            "UPDATE sensor_mapping SET verdict = ?, approved_by = ? WHERE id = ?",
            (verdict, approved_by, mapping_id),
        )
        self._conn.commit()

    def insert_workflow_log(self, wl: WorkflowLog) -> int:
        cur = self._conn.execute(
            "INSERT INTO workflow_log (record_id, from_status, to_status, operator, operated_at, note) VALUES (?, ?, ?, ?, ?, ?)",
            (wl.record_id, wl.from_status, wl.to_status, wl.operator, wl.operated_at, wl.note),
        )
        self._conn.commit()
        return cur.lastrowid

    def get_workflow_log(self, record_id: int) -> List[WorkflowLog]:
        rows = self._conn.execute(
            "SELECT * FROM workflow_log WHERE record_id = ?", (record_id,)
        ).fetchall()
        return [_row_to_workflow_log(r) for r in rows]
