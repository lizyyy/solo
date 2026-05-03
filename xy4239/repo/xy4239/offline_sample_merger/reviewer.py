"""
复核存储模块 - 负责冲突人工复核和数据持久化存储
"""

import json
import sqlite3
import uuid
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

from .models import (
    GeoSample,
    ConflictRecord,
    ConflictType,
    ReviewDecision,
    AuditRecord,
)


class ConflictReviewer:
    def __init__(self, storage_path: str, user: str = "anonymous"):
        self.storage_path = Path(storage_path)
        self.user = user
        self.audit_log: List[AuditRecord] = []
        
        self.storage_path.mkdir(parents=True, exist_ok=True)

    def review_conflict(self, conflict: ConflictRecord, decision: ReviewDecision,
                        notes: str = "", selected_sample_index: Optional[int] = None) -> Dict[str, Any]:
        conflict.is_resolved = True
        conflict.decision = decision
        conflict.resolved_at = datetime.now()
        conflict.resolved_by = self.user
        conflict.notes = notes

        result = {
            "conflict_id": conflict.conflict_id,
            "decision": decision.value,
            "notes": notes,
            "resolved_at": conflict.resolved_at.isoformat(),
            "resolved_by": self.user,
            "sample_id": conflict.samples[0].sample_id if conflict.samples else None,
        }

        audit = AuditRecord(
            action="review_conflict",
            timestamp=datetime.now(),
            user=self.user,
            details={
                "conflict_id": conflict.conflict_id,
                "conflict_type": conflict.conflict_type.value,
                "decision": decision.value,
                "notes": notes,
                "samples_count": len(conflict.samples),
            },
            before_state={
                "is_resolved": False,
                "decision": None,
            },
            after_state={
                "is_resolved": True,
                "decision": decision.value,
            },
        )
        self.audit_log.append(audit)

        return result

    def get_pending_conflicts(self, conflicts: List[ConflictRecord]) -> List[ConflictRecord]:
        return [c for c in conflicts if not c.is_resolved]

    def get_resolved_conflicts(self, conflicts: List[ConflictRecord]) -> List[ConflictRecord]:
        return [c for c in conflicts if c.is_resolved]

    def get_audit_log(self) -> List[AuditRecord]:
        return self.audit_log

    def log_action(self, action: str, details: Dict[str, Any],
                   before_state: Optional[Dict] = None,
                   after_state: Optional[Dict] = None) -> AuditRecord:
        audit = AuditRecord(
            action=action,
            timestamp=datetime.now(),
            user=self.user,
            details=details,
            before_state=before_state,
            after_state=after_state,
        )
        self.audit_log.append(audit)
        return audit


class SampleStorage:
    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_database()

    def _init_database(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS samples (
            id TEXT PRIMARY KEY,
            sample_id TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            sample_time TEXT,
            collector TEXT,
            photo_paths TEXT,
            rock_type TEXT,
            description TEXT,
            depth REAL,
            hash_value TEXT,
            package_name TEXT,
            create_time TEXT,
            modify_time TEXT,
            custom_fields TEXT,
            inserted_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS conflicts (
            id TEXT PRIMARY KEY,
            conflict_id TEXT UNIQUE NOT NULL,
            conflict_type TEXT NOT NULL,
            sample_ids TEXT NOT NULL,
            description TEXT,
            is_resolved INTEGER DEFAULT 0,
            decision TEXT,
            resolved_at TEXT,
            resolved_by TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            user TEXT NOT NULL,
            details TEXT,
            before_state TEXT,
            after_state TEXT
        )
        """)

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_samples_sample_id ON samples(sample_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_conflicts_resolved ON conflicts(is_resolved)")

        conn.commit()
        conn.close()

    def save_sample(self, sample: GeoSample) -> bool:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        existing = cursor.execute(
            "SELECT id FROM samples WHERE sample_id = ?", 
            (sample.sample_id,)
        ).fetchone()

        sample_dict = sample.to_dict()

        if existing:
            cursor.execute("""
            UPDATE samples SET
                latitude = ?, longitude = ?, sample_time = ?,
                collector = ?, photo_paths = ?, rock_type = ?,
                description = ?, depth = ?, hash_value = ?,
                package_name = ?, create_time = ?, modify_time = ?,
                custom_fields = ?, updated_at = CURRENT_TIMESTAMP
            WHERE sample_id = ?
            """, (
                sample_dict["latitude"], sample_dict["longitude"], sample_dict["sample_time"],
                sample_dict["collector"], json.dumps(sample_dict["photo_paths"], ensure_ascii=False),
                sample_dict["rock_type"], sample_dict["description"], sample_dict["depth"],
                sample_dict["hash_value"], sample_dict["package_name"],
                sample_dict["create_time"], sample_dict["modify_time"],
                json.dumps(sample_dict["custom_fields"], ensure_ascii=False),
                sample.sample_id,
            ))
        else:
            record_id = str(uuid.uuid4())
            cursor.execute("""
            INSERT INTO samples (
                id, sample_id, latitude, longitude, sample_time,
                collector, photo_paths, rock_type, description, depth,
                hash_value, package_name, create_time, modify_time, custom_fields
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record_id, sample.sample_id, sample_dict["latitude"], sample_dict["longitude"],
                sample_dict["sample_time"], sample_dict["collector"],
                json.dumps(sample_dict["photo_paths"], ensure_ascii=False),
                sample_dict["rock_type"], sample_dict["description"], sample_dict["depth"],
                sample_dict["hash_value"], sample_dict["package_name"],
                sample_dict["create_time"], sample_dict["modify_time"],
                json.dumps(sample_dict["custom_fields"], ensure_ascii=False),
            ))

        conn.commit()
        conn.close()
        return True

    def save_samples(self, samples: List[GeoSample]) -> int:
        count = 0
        for sample in samples:
            if self.save_sample(sample):
                count += 1
        return count

    def load_sample(self, sample_id: str) -> Optional[GeoSample]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        row = cursor.execute(
            "SELECT * FROM samples WHERE sample_id = ?", 
            (sample_id,)
        ).fetchone()

        conn.close()

        if row:
            return self._row_to_sample(dict(row))
        return None

    def load_all_samples(self) -> List[GeoSample]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        rows = cursor.execute("SELECT * FROM samples ORDER BY sample_time").fetchall()
        conn.close()

        return [self._row_to_sample(dict(row)) for row in rows]

    def _row_to_sample(self, row: Dict) -> GeoSample:
        photo_paths = json.loads(row["photo_paths"]) if row["photo_paths"] else []
        custom_fields = json.loads(row["custom_fields"]) if row["custom_fields"] else {}

        data = {
            "sample_id": row["sample_id"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "sample_time": row["sample_time"],
            "collector": row["collector"],
            "photo_paths": photo_paths,
            "rock_type": row["rock_type"],
            "description": row["description"],
            "depth": row["depth"],
            "hash_value": row["hash_value"],
            "package_name": row["package_name"],
            "create_time": row["create_time"],
            "modify_time": row["modify_time"],
            "custom_fields": custom_fields,
        }

        return GeoSample.from_dict(data)

    def save_conflict(self, conflict: ConflictRecord) -> bool:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        existing = cursor.execute(
            "SELECT id FROM conflicts WHERE conflict_id = ?",
            (conflict.conflict_id,)
        ).fetchone()

        conflict_dict = conflict.to_dict()
        sample_ids = json.dumps([s.sample_id for s in conflict.samples], ensure_ascii=False)

        if existing:
            cursor.execute("""
            UPDATE conflicts SET
                conflict_type = ?, sample_ids = ?, description = ?,
                is_resolved = ?, decision = ?, resolved_at = ?,
                resolved_by = ?, notes = ?
            WHERE conflict_id = ?
            """, (
                conflict_dict["conflict_type"], sample_ids,
                conflict_dict["description"], 1 if conflict.is_resolved else 0,
                conflict_dict["decision"], conflict_dict["resolved_at"],
                conflict_dict["resolved_by"], conflict_dict["notes"],
                conflict.conflict_id,
            ))
        else:
            record_id = str(uuid.uuid4())
            cursor.execute("""
            INSERT INTO conflicts (
                id, conflict_id, conflict_type, sample_ids, description,
                is_resolved, decision, resolved_at, resolved_by, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record_id, conflict.conflict_id, conflict_dict["conflict_type"],
                sample_ids, conflict_dict["description"],
                1 if conflict.is_resolved else 0,
                conflict_dict["decision"], conflict_dict["resolved_at"],
                conflict_dict["resolved_by"], conflict_dict["notes"],
            ))

        conn.commit()
        conn.close()
        return True

    def save_conflicts(self, conflicts: List[ConflictRecord]) -> int:
        count = 0
        for conflict in conflicts:
            if self.save_conflict(conflict):
                count += 1
        return count

    def load_conflicts(self, only_pending: bool = False) -> List[ConflictRecord]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        query = "SELECT * FROM conflicts ORDER BY created_at"
        params = ()
        if only_pending:
            query = "SELECT * FROM conflicts WHERE is_resolved = 0 ORDER BY created_at"

        rows = cursor.execute(query, params).fetchall()
        conn.close()

        results = []
        for row in rows:
            row_dict = dict(row)
            conflict = self._row_to_conflict(row_dict)
            if conflict:
                results.append(conflict)

        return results

    def _row_to_conflict(self, row: Dict) -> Optional[ConflictRecord]:
        try:
            sample_ids = json.loads(row["sample_ids"]) if row["sample_ids"] else []
            samples = []
            for sample_id in sample_ids:
                sample = self.load_sample(sample_id)
                if sample:
                    samples.append(sample)

            conflict_type_map = {ct.value: ct for ct in ConflictType}
            conflict_type = conflict_type_map.get(row["conflict_type"], ConflictType.ID_COLLISION)

            decision_map = {rd.value: rd for rd in ReviewDecision}
            decision = decision_map.get(row["decision"]) if row["decision"] else None

            resolved_at = None
            if row["resolved_at"]:
                try:
                    resolved_at = datetime.fromisoformat(row["resolved_at"])
                except ValueError:
                    pass

            return ConflictRecord(
                conflict_id=row["conflict_id"],
                conflict_type=conflict_type,
                samples=samples,
                description=row["description"] or "",
                is_resolved=bool(row["is_resolved"]),
                decision=decision,
                resolved_at=resolved_at,
                resolved_by=row["resolved_by"] or "",
                notes=row["notes"] or "",
            )
        except Exception:
            return None

    def save_audit_log(self, audit_records: List[AuditRecord]) -> int:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        count = 0

        for audit in audit_records:
            cursor.execute("""
            INSERT INTO audit_log (action, timestamp, user, details, before_state, after_state)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (
                audit.action,
                audit.timestamp.isoformat(),
                audit.user,
                json.dumps(audit.details, ensure_ascii=False) if audit.details else None,
                json.dumps(audit.before_state, ensure_ascii=False) if audit.before_state else None,
                json.dumps(audit.after_state, ensure_ascii=False) if audit.after_state else None,
            ))
            count += 1

        conn.commit()
        conn.close()
        return count

    def get_sample_count(self) -> int:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        result = cursor.execute("SELECT COUNT(*) FROM samples").fetchone()
        conn.close()
        return result[0] if result else 0

    def get_conflict_stats(self) -> Dict[str, int]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        total = cursor.execute("SELECT COUNT(*) FROM conflicts").fetchone()[0]
        resolved = cursor.execute("SELECT COUNT(*) FROM conflicts WHERE is_resolved = 1").fetchone()[0]
        pending = cursor.execute("SELECT COUNT(*) FROM conflicts WHERE is_resolved = 0").fetchone()[0]

        conn.close()

        return {
            "total": total,
            "resolved": resolved,
            "pending": pending,
        }
