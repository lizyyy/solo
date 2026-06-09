import sqlite3
import os
from typing import List, Optional, Dict, Any
from datetime import datetime
from contextlib import contextmanager

from models import (
    SparePart, Alarm, ManualNote, AnomalyAttribution, AttributionDetail,
    PartStatus, AlarmStatus, AttributionStatus, NoteSource,
    STATUS_EXPORT_MAPPING
)


DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pipeline_anomaly.db")


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS spare_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_no TEXT NOT NULL UNIQUE,
    part_name TEXT NOT NULL,
    part_model TEXT NOT NULL,
    expected_model TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    pipeline_id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alarms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alarm_no TEXT NOT NULL UNIQUE,
    pipeline_id TEXT NOT NULL,
    alarm_type TEXT NOT NULL,
    alarm_desc TEXT NOT NULL,
    status TEXT NOT NULL,
    trigger_time TEXT NOT NULL,
    resolved_time TEXT,
    related_part_no TEXT
);

CREATE TABLE IF NOT EXISTS manual_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_no TEXT NOT NULL UNIQUE,
    pipeline_id TEXT NOT NULL,
    related_alarm_no TEXT,
    related_part_no TEXT,
    source TEXT NOT NULL,
    operator TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anomaly_attributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attr_no TEXT NOT NULL UNIQUE,
    pipeline_id TEXT NOT NULL,
    part_id INTEGER,
    alarm_id INTEGER,
    note_id INTEGER,
    status TEXT NOT NULL,
    attribution_reason TEXT NOT NULL,
    pending_reason TEXT NOT NULL,
    affected_records TEXT NOT NULL,
    operator TEXT NOT NULL,
    is_model_replace INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (part_id) REFERENCES spare_parts(id),
    FOREIGN KEY (alarm_id) REFERENCES alarms(id),
    FOREIGN KEY (note_id) REFERENCES manual_notes(id)
);
"""


def _dt_to_str(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def _str_to_dt(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%d %H:%M:%S")


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        conn.executescript(SCHEMA_SQL)


class SparePartRepo:
    @staticmethod
    def insert(part: SparePart) -> int:
        with get_conn() as conn:
            cur = conn.execute(
                """INSERT INTO spare_parts(part_no, part_name, part_model, expected_model,
                   quantity, pipeline_id, status, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (part.part_no, part.part_name, part.part_model, part.expected_model,
                 part.quantity, part.pipeline_id, part.status.value,
                 _dt_to_str(part.created_at), _dt_to_str(part.updated_at))
            )
            return cur.lastrowid

    @staticmethod
    def update(part: SparePart):
        part.updated_at = datetime.now()
        with get_conn() as conn:
            conn.execute(
                """UPDATE spare_parts SET part_name=?, part_model=?, expected_model=?,
                   quantity=?, pipeline_id=?, status=?, updated_at=? WHERE id=?""",
                (part.part_name, part.part_model, part.expected_model,
                 part.quantity, part.pipeline_id, part.status.value,
                 _dt_to_str(part.updated_at), part.id)
            )

    @staticmethod
    def get_by_no(part_no: str) -> Optional[SparePart]:
        with get_conn() as conn:
            row = conn.execute("SELECT * FROM spare_parts WHERE part_no=?", (part_no,)).fetchone()
            return SparePartRepo._row_to_obj(row) if row else None

    @staticmethod
    def get_by_id(part_id: int) -> Optional[SparePart]:
        with get_conn() as conn:
            row = conn.execute("SELECT * FROM spare_parts WHERE id=?", (part_id,)).fetchone()
            return SparePartRepo._row_to_obj(row) if row else None

    @staticmethod
    def list_all() -> List[SparePart]:
        with get_conn() as conn:
            rows = conn.execute("SELECT * FROM spare_parts ORDER BY id").fetchall()
            return [SparePartRepo._row_to_obj(r) for r in rows]

    @staticmethod
    def _row_to_obj(row: sqlite3.Row) -> SparePart:
        return SparePart(
            id=row["id"], part_no=row["part_no"], part_name=row["part_name"],
            part_model=row["part_model"], expected_model=row["expected_model"],
            quantity=row["quantity"], pipeline_id=row["pipeline_id"],
            status=PartStatus(row["status"]),
            created_at=_str_to_dt(row["created_at"]),
            updated_at=_str_to_dt(row["updated_at"])
        )


class AlarmRepo:
    @staticmethod
    def insert(alarm: Alarm) -> int:
        with get_conn() as conn:
            cur = conn.execute(
                """INSERT INTO alarms(alarm_no, pipeline_id, alarm_type, alarm_desc,
                   status, trigger_time, resolved_time, related_part_no)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (alarm.alarm_no, alarm.pipeline_id, alarm.alarm_type, alarm.alarm_desc,
                 alarm.status.value, _dt_to_str(alarm.trigger_time),
                 _dt_to_str(alarm.resolved_time) if alarm.resolved_time else None,
                 alarm.related_part_no)
            )
            return cur.lastrowid

    @staticmethod
    def update(alarm: Alarm):
        with get_conn() as conn:
            conn.execute(
                """UPDATE alarms SET pipeline_id=?, alarm_type=?, alarm_desc=?, status=?,
                   trigger_time=?, resolved_time=?, related_part_no=? WHERE id=?""",
                (alarm.pipeline_id, alarm.alarm_type, alarm.alarm_desc, alarm.status.value,
                 _dt_to_str(alarm.trigger_time),
                 _dt_to_str(alarm.resolved_time) if alarm.resolved_time else None,
                 alarm.related_part_no, alarm.id)
            )

    @staticmethod
    def get_by_no(alarm_no: str) -> Optional[Alarm]:
        with get_conn() as conn:
            row = conn.execute("SELECT * FROM alarms WHERE alarm_no=?", (alarm_no,)).fetchone()
            return AlarmRepo._row_to_obj(row) if row else None

    @staticmethod
    def get_by_id(alarm_id: int) -> Optional[Alarm]:
        with get_conn() as conn:
            row = conn.execute("SELECT * FROM alarms WHERE id=?", (alarm_id,)).fetchone()
            return AlarmRepo._row_to_obj(row) if row else None

    @staticmethod
    def list_all() -> List[Alarm]:
        with get_conn() as conn:
            rows = conn.execute("SELECT * FROM alarms ORDER BY id").fetchall()
            return [AlarmRepo._row_to_obj(r) for r in rows]

    @staticmethod
    def _row_to_obj(row: sqlite3.Row) -> Alarm:
        return Alarm(
            id=row["id"], alarm_no=row["alarm_no"], pipeline_id=row["pipeline_id"],
            alarm_type=row["alarm_type"], alarm_desc=row["alarm_desc"],
            status=AlarmStatus(row["status"]),
            trigger_time=_str_to_dt(row["trigger_time"]),
            resolved_time=_str_to_dt(row["resolved_time"]) if row["resolved_time"] else None,
            related_part_no=row["related_part_no"]
        )


class ManualNoteRepo:
    @staticmethod
    def insert(note: ManualNote) -> int:
        with get_conn() as conn:
            cur = conn.execute(
                """INSERT INTO manual_notes(note_no, pipeline_id, related_alarm_no,
                   related_part_no, source, operator, content, created_at)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (note.note_no, note.pipeline_id, note.related_alarm_no,
                 note.related_part_no, note.source.value, note.operator,
                 note.content, _dt_to_str(note.created_at))
            )
            return cur.lastrowid

    @staticmethod
    def get_by_no(note_no: str) -> Optional[ManualNote]:
        with get_conn() as conn:
            row = conn.execute("SELECT * FROM manual_notes WHERE note_no=?", (note_no,)).fetchone()
            return ManualNoteRepo._row_to_obj(row) if row else None

    @staticmethod
    def get_by_id(note_id: int) -> Optional[ManualNote]:
        with get_conn() as conn:
            row = conn.execute("SELECT * FROM manual_notes WHERE id=?", (note_id,)).fetchone()
            return ManualNoteRepo._row_to_obj(row) if row else None

    @staticmethod
    def list_all() -> List[ManualNote]:
        with get_conn() as conn:
            rows = conn.execute("SELECT * FROM manual_notes ORDER BY id").fetchall()
            return [ManualNoteRepo._row_to_obj(r) for r in rows]

    @staticmethod
    def list_by_pipeline(pipeline_id: str) -> List[ManualNote]:
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM manual_notes WHERE pipeline_id=? ORDER BY id",
                (pipeline_id,)
            ).fetchall()
            return [ManualNoteRepo._row_to_obj(r) for r in rows]

    @staticmethod
    def _row_to_obj(row: sqlite3.Row) -> ManualNote:
        return ManualNote(
            id=row["id"], note_no=row["note_no"], pipeline_id=row["pipeline_id"],
            related_alarm_no=row["related_alarm_no"], related_part_no=row["related_part_no"],
            source=NoteSource(row["source"]), operator=row["operator"],
            content=row["content"], created_at=_str_to_dt(row["created_at"])
        )


class AnomalyAttributionRepo:
    @staticmethod
    def insert(attr: AnomalyAttribution) -> int:
        with get_conn() as conn:
            cur = conn.execute(
                """INSERT INTO anomaly_attributions(attr_no, pipeline_id, part_id, alarm_id,
                   note_id, status, attribution_reason, pending_reason, affected_records,
                   operator, is_model_replace, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (attr.attr_no, attr.pipeline_id, attr.part_id, attr.alarm_id, attr.note_id,
                 attr.status.value, attr.attribution_reason, attr.pending_reason,
                 attr.affected_records, attr.operator, 1 if attr.is_model_replace else 0,
                 _dt_to_str(attr.created_at), _dt_to_str(attr.updated_at))
            )
            return cur.lastrowid

    @staticmethod
    def update(attr: AnomalyAttribution):
        attr.updated_at = datetime.now()
        with get_conn() as conn:
            conn.execute(
                """UPDATE anomaly_attributions SET pipeline_id=?, part_id=?, alarm_id=?, note_id=?,
                   status=?, attribution_reason=?, pending_reason=?, affected_records=?,
                   operator=?, is_model_replace=?, updated_at=? WHERE id=?""",
                (attr.pipeline_id, attr.part_id, attr.alarm_id, attr.note_id,
                 attr.status.value, attr.attribution_reason, attr.pending_reason,
                 attr.affected_records, attr.operator, 1 if attr.is_model_replace else 0,
                 _dt_to_str(attr.updated_at), attr.id)
            )

    @staticmethod
    def get_by_no(attr_no: str) -> Optional[AnomalyAttribution]:
        with get_conn() as conn:
            row = conn.execute("SELECT * FROM anomaly_attributions WHERE attr_no=?", (attr_no,)).fetchone()
            return AnomalyAttributionRepo._row_to_obj(row) if row else None

    @staticmethod
    def get_by_id(attr_id: int) -> Optional[AnomalyAttribution]:
        with get_conn() as conn:
            row = conn.execute("SELECT * FROM anomaly_attributions WHERE id=?", (attr_id,)).fetchone()
            return AnomalyAttributionRepo._row_to_obj(row) if row else None

    @staticmethod
    def list_all() -> List[AnomalyAttribution]:
        with get_conn() as conn:
            rows = conn.execute("SELECT * FROM anomaly_attributions ORDER BY id").fetchall()
            return [AnomalyAttributionRepo._row_to_obj(r) for r in rows]

    @staticmethod
    def list_by_status(status: AttributionStatus) -> List[AnomalyAttribution]:
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM anomaly_attributions WHERE status=? ORDER BY id",
                (status.value,)
            ).fetchall()
            return [AnomalyAttributionRepo._row_to_obj(r) for r in rows]

    @staticmethod
    def get_details() -> List[AttributionDetail]:
        sql = """
        SELECT a.*, p.part_no, p.part_name, p.part_model, p.expected_model,
               p.status as part_status,
               al.alarm_no, al.alarm_type, al.alarm_desc, al.status as alarm_status,
               n.note_no, n.content as note_content, n.operator as note_operator
        FROM anomaly_attributions a
        LEFT JOIN spare_parts p ON a.part_id = p.id
        LEFT JOIN alarms al ON a.alarm_id = al.id
        LEFT JOIN manual_notes n ON a.note_id = n.id
        ORDER BY a.id
        """
        with get_conn() as conn:
            rows = conn.execute(sql).fetchall()
            result = []
            for r in rows:
                status = AttributionStatus(r["status"])
                detail = AttributionDetail(
                    attr_no=r["attr_no"], pipeline_id=r["pipeline_id"],
                    status=status,
                    status_for_export=STATUS_EXPORT_MAPPING[status],
                    attribution_reason=r["attribution_reason"],
                    pending_reason=r["pending_reason"],
                    affected_records=r["affected_records"],
                    part_no=r["part_no"] or "", part_name=r["part_name"] or "",
                    part_model=r["part_model"] or "", expected_model=r["expected_model"] or "",
                    part_status=r["part_status"] or "",
                    alarm_no=r["alarm_no"] or "", alarm_type=r["alarm_type"] or "",
                    alarm_desc=r["alarm_desc"] or "", alarm_status=r["alarm_status"] or "",
                    note_no=r["note_no"] or "", note_content=r["note_content"] or "",
                    note_operator=r["note_operator"] or "",
                    operator=r["operator"], created_at=r["created_at"]
                )
                result.append(detail)
            return result

    @staticmethod
    def _row_to_obj(row: sqlite3.Row) -> AnomalyAttribution:
        return AnomalyAttribution(
            id=row["id"], attr_no=row["attr_no"], pipeline_id=row["pipeline_id"],
            part_id=row["part_id"], alarm_id=row["alarm_id"], note_id=row["note_id"],
            status=AttributionStatus(row["status"]),
            attribution_reason=row["attribution_reason"],
            pending_reason=row["pending_reason"],
            affected_records=row["affected_records"],
            operator=row["operator"],
            is_model_replace=bool(row["is_model_replace"]),
            created_at=_str_to_dt(row["created_at"]),
            updated_at=_str_to_dt(row["updated_at"])
        )
