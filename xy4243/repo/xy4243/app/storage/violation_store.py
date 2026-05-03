from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .database import Database, datetime_to_iso, iso_to_datetime, json_dumps, json_loads
from app.models import Violation, CheckStatus


class ViolationStore:

    def __init__(self, db: Database):
        self.db = db

    def get_all(self, include_resolved: bool = False) -> List[Violation]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            if include_resolved:
                cursor.execute("SELECT * FROM violations ORDER BY detected_at")
            else:
                cursor.execute("SELECT * FROM violations WHERE resolved = 0 ORDER BY detected_at")
            rows = cursor.fetchall()
            return [self._row_to_violation(row) for row in rows]

    def get_by_id(self, violation_id: str) -> Optional[Violation]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM violations WHERE id = ?", (violation_id,))
            row = cursor.fetchone()
            return self._row_to_violation(row) if row else None

    def get_by_handover_id(self, handover_id: str) -> List[Violation]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM violations 
                WHERE handover_id = ? OR ? IN (SELECT value FROM json_each(related_entities))
                ORDER BY detected_at
            """, (handover_id, handover_id))
            rows = cursor.fetchall()
            return [self._row_to_violation(row) for row in rows]

    def get_by_type(self, violation_type: str) -> List[Violation]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM violations 
                WHERE violation_type = ? AND resolved = 0
                ORDER BY detected_at
            """, (violation_type,))
            rows = cursor.fetchall()
            return [self._row_to_violation(row) for row in rows]

    def get_by_severity(self, severity: str) -> List[Violation]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM violations 
                WHERE severity = ? AND resolved = 0
                ORDER BY detected_at
            """, (severity,))
            rows = cursor.fetchall()
            return [self._row_to_violation(row) for row in rows]

    def get_unresolved(self) -> List[Violation]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM violations 
                WHERE resolved = 0
                ORDER BY 
                    CASE severity 
                        WHEN 'critical' THEN 1 
                        WHEN 'high' THEN 2 
                        WHEN 'medium' THEN 3 
                        ELSE 4 
                    END,
                    detected_at
            """)
            rows = cursor.fetchall()
            return [self._row_to_violation(row) for row in rows]

    def save(self, violation: Violation) -> Violation:
        violation.updated_at = datetime.now()
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            existing = self.get_by_id(violation.id)

            if existing:
                cursor.execute("""
                    UPDATE violations SET
                        violation_type = ?, check_status = ?, severity = ?,
                        description = ?, prop_id = ?, prop_name = ?,
                        scene_id = ?, scene_title = ?, handover_id = ?,
                        actor_id = ?, actor_name = ?, related_entities = ?,
                        detected_at = ?, resolved = ?, resolved_at = ?,
                        resolved_by = ?, resolution_notes = ?, metadata = ?,
                        created_at = ?, updated_at = ?
                    WHERE id = ?
                """, (
                    violation.violation_type,
                    violation.check_status.name if hasattr(violation.check_status, 'name') else str(violation.check_status),
                    violation.severity,
                    violation.description,
                    violation.prop_id, violation.prop_name,
                    violation.scene_id, violation.scene_title, violation.handover_id,
                    violation.actor_id, violation.actor_name,
                    json_dumps(violation.related_entities),
                    datetime_to_iso(violation.detected_at),
                    violation.resolved, datetime_to_iso(violation.resolved_at),
                    violation.resolved_by, violation.resolution_notes,
                    json_dumps(violation.metadata),
                    datetime_to_iso(violation.created_at), datetime_to_iso(violation.updated_at),
                    violation.id
                ))
            else:
                violation.created_at = datetime.now()
                cursor.execute("""
                    INSERT INTO violations (
                        id, violation_type, check_status, severity,
                        description, prop_id, prop_name,
                        scene_id, scene_title, handover_id,
                        actor_id, actor_name, related_entities,
                        detected_at, resolved, resolved_at,
                        resolved_by, resolution_notes, metadata,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    violation.id, violation.violation_type,
                    violation.check_status.name if hasattr(violation.check_status, 'name') else str(violation.check_status),
                    violation.severity,
                    violation.description,
                    violation.prop_id, violation.prop_name,
                    violation.scene_id, violation.scene_title, violation.handover_id,
                    violation.actor_id, violation.actor_name,
                    json_dumps(violation.related_entities),
                    datetime_to_iso(violation.detected_at),
                    violation.resolved, datetime_to_iso(violation.resolved_at),
                    violation.resolved_by, violation.resolution_notes,
                    json_dumps(violation.metadata),
                    datetime_to_iso(violation.created_at), datetime_to_iso(violation.updated_at)
                ))

            return violation

    def save_all(self, violations: List[Violation]) -> List[Violation]:
        return [self.save(violation) for violation in violations]

    def resolve(self, violation_id: str, resolved_by: str, notes: str = "") -> bool:
        violation = self.get_by_id(violation_id)
        if not violation:
            return False
        violation.resolve(resolved_by, notes)
        self.save(violation)
        return True

    def delete(self, violation_id: str) -> bool:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM violations WHERE id = ?", (violation_id,))
            return cursor.rowcount > 0

    def delete_all(self) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM violations")
            return cursor.rowcount

    def count(self, include_resolved: bool = False) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            if include_resolved:
                cursor.execute("SELECT COUNT(*) FROM violations")
            else:
                cursor.execute("SELECT COUNT(*) FROM violations WHERE resolved = 0")
            return cursor.fetchone()[0]

    def _row_to_violation(self, row) -> Violation:
        try:
            check_status = CheckStatus[row["check_status"]]
        except (KeyError, ValueError):
            check_status = CheckStatus.ERROR

        return Violation(
            id=row["id"],
            violation_type=row["violation_type"],
            check_status=check_status,
            severity=row["severity"],
            description=row["description"],
            prop_id=row["prop_id"],
            prop_name=row["prop_name"],
            scene_id=row["scene_id"],
            scene_title=row["scene_title"],
            handover_id=row["handover_id"],
            actor_id=row["actor_id"],
            actor_name=row["actor_name"],
            related_entities=json_loads(row["related_entities"]),
            detected_at=iso_to_datetime(row["detected_at"]),
            resolved=bool(row["resolved"]),
            resolved_at=iso_to_datetime(row["resolved_at"]),
            resolved_by=row["resolved_by"],
            resolution_notes=row["resolution_notes"],
            metadata=json_loads(row["metadata"]),
            created_at=iso_to_datetime(row["created_at"]),
            updated_at=iso_to_datetime(row["updated_at"]),
        )
