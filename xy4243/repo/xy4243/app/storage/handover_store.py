from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .database import Database, datetime_to_iso, iso_to_datetime, json_dumps, json_loads
from app.models import HandoverRecord, HandoverStatus


class HandoverStore:

    def __init__(self, db: Database):
        self.db = db

    def get_all(self) -> List[HandoverRecord]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM handover_records ORDER BY created_at")
            rows = cursor.fetchall()
            return [self._row_to_handover(row) for row in rows]

    def get_by_id(self, handover_id: str) -> Optional[HandoverRecord]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM handover_records WHERE id = ?", (handover_id,))
            row = cursor.fetchone()
            return self._row_to_handover(row) if row else None

    def get_by_prop_id(self, prop_id: str) -> List[HandoverRecord]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM handover_records 
                WHERE prop_id = ? OR prop_name = ?
                ORDER BY created_at
            """, (prop_id, prop_id))
            rows = cursor.fetchall()
            return [self._row_to_handover(row) for row in rows]

    def get_by_scene_id(self, scene_id: str) -> List[HandoverRecord]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM handover_records 
                WHERE scene_id = ?
                ORDER BY created_at
            """, (scene_id,))
            rows = cursor.fetchall()
            return [self._row_to_handover(row) for row in rows]

    def get_by_actor_id(self, actor_id: str) -> List[HandoverRecord]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM handover_records 
                WHERE actor_id = ? OR actor_name = ?
                ORDER BY created_at
            """, (actor_id, actor_id))
            rows = cursor.fetchall()
            return [self._row_to_handover(row) for row in rows]

    def get_by_status(self, status: HandoverStatus) -> List[HandoverRecord]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM handover_records 
                WHERE status = ?
                ORDER BY created_at
            """, (status.name,))
            rows = cursor.fetchall()
            return [self._row_to_handover(row) for row in rows]

    def get_active_handovers(self) -> List[HandoverRecord]:
        active_statuses = [HandoverStatus.PENDING.name, HandoverStatus.READY.name, HandoverStatus.IN_USE.name]
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                SELECT * FROM handover_records 
                WHERE status IN ({','.join(['?' for _ in active_statuses])})
                ORDER BY scheduled_start_time
            """, active_statuses)
            rows = cursor.fetchall()
            return [self._row_to_handover(row) for row in rows]

    def save(self, handover: HandoverRecord) -> HandoverRecord:
        handover.updated_at = datetime.now()
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            existing = self.get_by_id(handover.id)

            if existing:
                cursor.execute("""
                    UPDATE handover_records SET
                        prop_id = ?, prop_name = ?, scene_id = ?, scene_title = ?,
                        actor_id = ?, actor_name = ?, status = ?, quantity = ?,
                        scheduled_start_time = ?, scheduled_end_time = ?,
                        actual_start_time = ?, actual_end_time = ?,
                        handover_person = ?, return_person = ?, verification_person = ?,
                        notes = ?, verification_notes = ?,
                        is_signed_out = ?, signed_out_at = ?,
                        is_signed_in = ?, signed_in_at = ?,
                        is_verified = ?, verified_at = ?,
                        metadata = ?, created_at = ?, updated_at = ?
                    WHERE id = ?
                """, (
                    handover.prop_id, handover.prop_name, handover.scene_id, handover.scene_title,
                    handover.actor_id, handover.actor_name, handover.status.name, handover.quantity,
                    datetime_to_iso(handover.scheduled_start_time),
                    datetime_to_iso(handover.scheduled_end_time),
                    datetime_to_iso(handover.actual_start_time),
                    datetime_to_iso(handover.actual_end_time),
                    handover.handover_person, handover.return_person, handover.verification_person,
                    handover.notes, handover.verification_notes,
                    handover.is_signed_out, datetime_to_iso(handover.signed_out_at),
                    handover.is_signed_in, datetime_to_iso(handover.signed_in_at),
                    handover.is_verified, datetime_to_iso(handover.verified_at),
                    json_dumps(handover.metadata),
                    datetime_to_iso(handover.created_at), datetime_to_iso(handover.updated_at),
                    handover.id
                ))
            else:
                handover.created_at = datetime.now()
                cursor.execute("""
                    INSERT INTO handover_records (
                        id, prop_id, prop_name, scene_id, scene_title,
                        actor_id, actor_name, status, quantity,
                        scheduled_start_time, scheduled_end_time,
                        actual_start_time, actual_end_time,
                        handover_person, return_person, verification_person,
                        notes, verification_notes,
                        is_signed_out, signed_out_at,
                        is_signed_in, signed_in_at,
                        is_verified, verified_at,
                        metadata, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    handover.id, handover.prop_id, handover.prop_name, handover.scene_id, handover.scene_title,
                    handover.actor_id, handover.actor_name, handover.status.name, handover.quantity,
                    datetime_to_iso(handover.scheduled_start_time),
                    datetime_to_iso(handover.scheduled_end_time),
                    datetime_to_iso(handover.actual_start_time),
                    datetime_to_iso(handover.actual_end_time),
                    handover.handover_person, handover.return_person, handover.verification_person,
                    handover.notes, handover.verification_notes,
                    handover.is_signed_out, datetime_to_iso(handover.signed_out_at),
                    handover.is_signed_in, datetime_to_iso(handover.signed_in_at),
                    handover.is_verified, datetime_to_iso(handover.verified_at),
                    json_dumps(handover.metadata),
                    datetime_to_iso(handover.created_at), datetime_to_iso(handover.updated_at)
                ))

            return handover

    def save_all(self, handovers: List[HandoverRecord]) -> List[HandoverRecord]:
        return [self.save(handover) for handover in handovers]

    def delete(self, handover_id: str) -> bool:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM handover_records WHERE id = ?", (handover_id,))
            return cursor.rowcount > 0

    def delete_all(self) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM handover_records")
            return cursor.rowcount

    def count(self) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM handover_records")
            return cursor.fetchone()[0]

    def _row_to_handover(self, row) -> HandoverRecord:
        try:
            status = HandoverStatus[row["status"]]
        except (KeyError, ValueError):
            status = HandoverStatus.PENDING

        return HandoverRecord(
            id=row["id"],
            prop_id=row["prop_id"],
            prop_name=row["prop_name"],
            scene_id=row["scene_id"],
            scene_title=row["scene_title"],
            actor_id=row["actor_id"],
            actor_name=row["actor_name"],
            status=status,
            quantity=row["quantity"],
            scheduled_start_time=iso_to_datetime(row["scheduled_start_time"]),
            scheduled_end_time=iso_to_datetime(row["scheduled_end_time"]),
            actual_start_time=iso_to_datetime(row["actual_start_time"]),
            actual_end_time=iso_to_datetime(row["actual_end_time"]),
            handover_person=row["handover_person"],
            return_person=row["return_person"],
            verification_person=row["verification_person"],
            notes=row["notes"],
            verification_notes=row["verification_notes"],
            is_signed_out=bool(row["is_signed_out"]),
            signed_out_at=iso_to_datetime(row["signed_out_at"]),
            is_signed_in=bool(row["is_signed_in"]),
            signed_in_at=iso_to_datetime(row["signed_in_at"]),
            is_verified=bool(row["is_verified"]),
            verified_at=iso_to_datetime(row["verified_at"]),
            metadata=json_loads(row["metadata"]),
            created_at=iso_to_datetime(row["created_at"]),
            updated_at=iso_to_datetime(row["updated_at"]),
        )
