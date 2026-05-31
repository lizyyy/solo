import sqlite3
import json
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field, asdict


class RecordStatus(str, Enum):
    DRAFT = "draft"
    NORMAL = "normal"
    PENDING_REVIEW = "pending_review"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class IssueType(str, Enum):
    UNIT_MISMATCH = "unit_mismatch"
    CONSTRAINT_OVERRIDDEN = "constraint_overridden"
    RESULT_DRIFT = "result_drift"
    DUPLICATE = "duplicate"
    LATE_ATTACHMENT = "late_attachment"
    MANUAL_CORRECTION = "manual_correction"


class DataSourceType(str, Enum):
    AUTOMATIC = "automatic"
    MANUAL_UPLOAD = "manual_upload"
    LATE_ATTACHMENT = "late_attachment"
    MANUAL_CORRECTION = "manual_correction"


@dataclass
class DataSource:
    source_id: str
    source_type: DataSourceType
    filename: Optional[str] = None
    uploaded_by: Optional[str] = None
    uploaded_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PollutionRecord:
    record_id: str
    source_id: str
    sample_time: datetime
    location: str
    pollutant: str
    value: float
    unit: str
    status: RecordStatus = RecordStatus.DRAFT
    model_version: Optional[str] = None
    constraints: Dict[str, Any] = field(default_factory=dict)
    overridden_constraints: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    current_owner: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AuditLogEntry:
    log_id: str
    record_id: str
    action: str
    old_status: Optional[RecordStatus] = None
    new_status: Optional[RecordStatus] = None
    changed_by: Optional[str] = None
    change_reason: str = ""
    changed_fields: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PendingQueueItem:
    queue_id: str
    record_id: str
    issue_type: IssueType
    issue_description: str
    review_reason: str
    detected_at: datetime = field(default_factory=datetime.now)
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    resolution: Optional[str] = None
    is_active: bool = True


@dataclass
class DuplicateGroup:
    group_id: str
    primary_record_id: str
    duplicate_record_ids: List[str] = field(default_factory=list)
    detected_at: datetime = field(default_factory=datetime.now)
    merged: bool = False


def init_db(db_path: str = "river_pollution.db") -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS data_sources (
            source_id TEXT PRIMARY KEY,
            source_type TEXT NOT NULL,
            filename TEXT,
            uploaded_by TEXT,
            uploaded_at TEXT NOT NULL,
            metadata TEXT
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pollution_records (
            record_id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL,
            sample_time TEXT NOT NULL,
            location TEXT NOT NULL,
            pollutant TEXT NOT NULL,
            value REAL NOT NULL,
            unit TEXT NOT NULL,
            status TEXT NOT NULL,
            model_version TEXT,
            constraints TEXT,
            overridden_constraints TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            current_owner TEXT,
            metadata TEXT,
            FOREIGN KEY (source_id) REFERENCES data_sources(source_id)
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            log_id TEXT PRIMARY KEY,
            record_id TEXT NOT NULL,
            action TEXT NOT NULL,
            old_status TEXT,
            new_status TEXT,
            changed_by TEXT,
            change_reason TEXT NOT NULL,
            changed_fields TEXT,
            timestamp TEXT NOT NULL,
            metadata TEXT,
            FOREIGN KEY (record_id) REFERENCES pollution_records(record_id)
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pending_queue (
            queue_id TEXT PRIMARY KEY,
            record_id TEXT NOT NULL,
            issue_type TEXT NOT NULL,
            issue_description TEXT NOT NULL,
            review_reason TEXT NOT NULL,
            detected_at TEXT NOT NULL,
            reviewed_by TEXT,
            reviewed_at TEXT,
            resolution TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (record_id) REFERENCES pollution_records(record_id)
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS duplicate_groups (
            group_id TEXT PRIMARY KEY,
            primary_record_id TEXT NOT NULL,
            duplicate_record_ids TEXT NOT NULL,
            detected_at TEXT NOT NULL,
            merged INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (primary_record_id) REFERENCES pollution_records(record_id)
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS unit_standards (
            pollutant TEXT PRIMARY KEY,
            standard_unit TEXT NOT NULL,
            allowed_units TEXT NOT NULL,
            conversion_factors TEXT NOT NULL
        )
    """)
    
    conn.commit()
    return conn


class RecordRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
    
    def insert_data_source(self, source: DataSource) -> None:
        self.conn.execute(
            "INSERT INTO data_sources VALUES (?, ?, ?, ?, ?, ?)",
            (
                source.source_id,
                source.source_type.value,
                source.filename,
                source.uploaded_by,
                source.uploaded_at.isoformat(),
                json.dumps(source.metadata, ensure_ascii=False)
            )
        )
        self.conn.commit()
    
    def get_data_source(self, source_id: str) -> Optional[DataSource]:
        row = self.conn.execute(
            "SELECT * FROM data_sources WHERE source_id = ?",
            (source_id,)
        ).fetchone()
        if not row:
            return None
        return DataSource(
            source_id=row[0],
            source_type=DataSourceType(row[1]),
            filename=row[2],
            uploaded_by=row[3],
            uploaded_at=datetime.fromisoformat(row[4]),
            metadata=json.loads(row[5]) if row[5] else {}
        )
    
    def insert_record(self, record: PollutionRecord) -> None:
        self.conn.execute(
            "INSERT INTO pollution_records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                record.record_id,
                record.source_id,
                record.sample_time.isoformat(),
                record.location,
                record.pollutant,
                record.value,
                record.unit,
                record.status.value,
                record.model_version,
                json.dumps(record.constraints, ensure_ascii=False),
                json.dumps(record.overridden_constraints, ensure_ascii=False),
                record.created_at.isoformat(),
                record.updated_at.isoformat(),
                record.current_owner,
                json.dumps(record.metadata, ensure_ascii=False)
            )
        )
        self.conn.commit()
    
    def get_record(self, record_id: str) -> Optional[PollutionRecord]:
        row = self.conn.execute(
            "SELECT * FROM pollution_records WHERE record_id = ?",
            (record_id,)
        ).fetchone()
        if not row:
            return None
        return PollutionRecord(
            record_id=row[0],
            source_id=row[1],
            sample_time=datetime.fromisoformat(row[2]),
            location=row[3],
            pollutant=row[4],
            value=row[5],
            unit=row[6],
            status=RecordStatus(row[7]),
            model_version=row[8],
            constraints=json.loads(row[9]) if row[9] else {},
            overridden_constraints=json.loads(row[10]) if row[10] else {},
            created_at=datetime.fromisoformat(row[11]),
            updated_at=datetime.fromisoformat(row[12]),
            current_owner=row[13],
            metadata=json.loads(row[14]) if row[14] else {}
        )
    
    def update_record_status(self, record_id: str, new_status: RecordStatus, 
                             updated_at: Optional[datetime] = None) -> None:
        updated_at = updated_at or datetime.now()
        self.conn.execute(
            "UPDATE pollution_records SET status = ?, updated_at = ? WHERE record_id = ?",
            (new_status.value, updated_at.isoformat(), record_id)
        )
        self.conn.commit()
    
    def update_record(self, record: PollutionRecord) -> None:
        record.updated_at = datetime.now()
        self.conn.execute("""
            UPDATE pollution_records SET
                source_id = ?, sample_time = ?, location = ?, pollutant = ?,
                value = ?, unit = ?, status = ?, model_version = ?,
                constraints = ?, overridden_constraints = ?, updated_at = ?,
                current_owner = ?, metadata = ?
            WHERE record_id = ?
        """, (
            record.source_id,
            record.sample_time.isoformat(),
            record.location,
            record.pollutant,
            record.value,
            record.unit,
            record.status.value,
            record.model_version,
            json.dumps(record.constraints, ensure_ascii=False),
            json.dumps(record.overridden_constraints, ensure_ascii=False),
            record.updated_at.isoformat(),
            record.current_owner,
            json.dumps(record.metadata, ensure_ascii=False),
            record.record_id
        ))
        self.conn.commit()
    
    def insert_audit_log(self, entry: AuditLogEntry) -> None:
        self.conn.execute(
            "INSERT INTO audit_log VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                entry.log_id,
                entry.record_id,
                entry.action,
                entry.old_status.value if entry.old_status else None,
                entry.new_status.value if entry.new_status else None,
                entry.changed_by,
                entry.change_reason,
                json.dumps(entry.changed_fields, ensure_ascii=False),
                entry.timestamp.isoformat(),
                json.dumps(entry.metadata, ensure_ascii=False)
            )
        )
        self.conn.commit()
    
    def get_audit_log(self, record_id: str) -> List[AuditLogEntry]:
        rows = self.conn.execute(
            "SELECT * FROM audit_log WHERE record_id = ? ORDER BY timestamp",
            (record_id,)
        ).fetchall()
        return [
            AuditLogEntry(
                log_id=row[0],
                record_id=row[1],
                action=row[2],
                old_status=RecordStatus(row[3]) if row[3] else None,
                new_status=RecordStatus(row[4]) if row[4] else None,
                changed_by=row[5],
                change_reason=row[6],
                changed_fields=json.loads(row[7]) if row[7] else {},
                timestamp=datetime.fromisoformat(row[8]),
                metadata=json.loads(row[9]) if row[9] else {}
            )
            for row in rows
        ]
    
    def insert_pending_item(self, item: PendingQueueItem) -> None:
        self.conn.execute(
            "INSERT INTO pending_queue VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                item.queue_id,
                item.record_id,
                item.issue_type.value,
                item.issue_description,
                item.review_reason,
                item.detected_at.isoformat(),
                item.reviewed_by,
                item.reviewed_at.isoformat() if item.reviewed_at else None,
                item.resolution,
                1 if item.is_active else 0
            )
        )
        self.conn.commit()
    
    def get_pending_items(self, active_only: bool = True) -> List[PendingQueueItem]:
        query = "SELECT * FROM pending_queue"
        params = ()
        if active_only:
            query += " WHERE is_active = 1"
        query += " ORDER BY detected_at DESC"
        
        rows = self.conn.execute(query, params).fetchall()
        return [
            PendingQueueItem(
                queue_id=row[0],
                record_id=row[1],
                issue_type=IssueType(row[2]),
                issue_description=row[3],
                review_reason=row[4],
                detected_at=datetime.fromisoformat(row[5]),
                reviewed_by=row[6],
                reviewed_at=datetime.fromisoformat(row[7]) if row[7] else None,
                resolution=row[8],
                is_active=bool(row[9])
            )
            for row in rows
        ]
    
    def get_pending_items_for_record(self, record_id: str, 
                                      active_only: bool = True) -> List[PendingQueueItem]:
        query = "SELECT * FROM pending_queue WHERE record_id = ?"
        params = (record_id,)
        if active_only:
            query += " AND is_active = 1"
        query += " ORDER BY detected_at DESC"
        
        rows = self.conn.execute(query, params).fetchall()
        return [
            PendingQueueItem(
                queue_id=row[0],
                record_id=row[1],
                issue_type=IssueType(row[2]),
                issue_description=row[3],
                review_reason=row[4],
                detected_at=datetime.fromisoformat(row[5]),
                reviewed_by=row[6],
                reviewed_at=datetime.fromisoformat(row[7]) if row[7] else None,
                resolution=row[8],
                is_active=bool(row[9])
            )
            for row in rows
        ]
    
    def resolve_pending_item(self, queue_id: str, reviewed_by: str, 
                             resolution: str) -> None:
        self.conn.execute("""
            UPDATE pending_queue SET
                is_active = 0, reviewed_by = ?, reviewed_at = ?, resolution = ?
            WHERE queue_id = ?
        """, (reviewed_by, datetime.now().isoformat(), resolution, queue_id))
        self.conn.commit()
    
    def insert_duplicate_group(self, group: DuplicateGroup) -> None:
        self.conn.execute(
            "INSERT INTO duplicate_groups VALUES (?, ?, ?, ?, ?)",
            (
                group.group_id,
                group.primary_record_id,
                json.dumps(group.duplicate_record_ids, ensure_ascii=False),
                group.detected_at.isoformat(),
                1 if group.merged else 0
            )
        )
        self.conn.commit()
    
    def get_duplicate_groups(self, merged_only: Optional[bool] = None) -> List[DuplicateGroup]:
        query = "SELECT * FROM duplicate_groups"
        params = ()
        if merged_only is not None:
            query += " WHERE merged = ?"
            params = (1 if merged_only else 0,)
        
        rows = self.conn.execute(query, params).fetchall()
        return [
            DuplicateGroup(
                group_id=row[0],
                primary_record_id=row[1],
                duplicate_record_ids=json.loads(row[2]),
                detected_at=datetime.fromisoformat(row[3]),
                merged=bool(row[4])
            )
            for row in rows
        ]
    
    def get_records_by_criteria(self, location: Optional[str] = None,
                                 pollutant: Optional[str] = None,
                                 status: Optional[RecordStatus] = None,
                                 start_time: Optional[datetime] = None,
                                 end_time: Optional[datetime] = None) -> List[PollutionRecord]:
        query = "SELECT * FROM pollution_records WHERE 1=1"
        params = []
        
        if location:
            query += " AND location = ?"
            params.append(location)
        if pollutant:
            query += " AND pollutant = ?"
            params.append(pollutant)
        if status:
            query += " AND status = ?"
            params.append(status.value)
        if start_time:
            query += " AND sample_time >= ?"
            params.append(start_time.isoformat())
        if end_time:
            query += " AND sample_time <= ?"
            params.append(end_time.isoformat())
        
        query += " ORDER BY sample_time DESC"
        rows = self.conn.execute(query, params).fetchall()
        
        return [
            PollutionRecord(
                record_id=row[0],
                source_id=row[1],
                sample_time=datetime.fromisoformat(row[2]),
                location=row[3],
                pollutant=row[4],
                value=row[5],
                unit=row[6],
                status=RecordStatus(row[7]),
                model_version=row[8],
                constraints=json.loads(row[9]) if row[9] else {},
                overridden_constraints=json.loads(row[10]) if row[10] else {},
                created_at=datetime.fromisoformat(row[11]),
                updated_at=datetime.fromisoformat(row[12]),
                current_owner=row[13],
                metadata=json.loads(row[14]) if row[14] else {}
            )
            for row in rows
        ]
    
    def get_unit_standard(self, pollutant: str) -> Optional[Dict[str, Any]]:
        row = self.conn.execute(
            "SELECT * FROM unit_standards WHERE pollutant = ?",
            (pollutant,)
        ).fetchone()
        if not row:
            return None
        return {
            "pollutant": row[0],
            "standard_unit": row[1],
            "allowed_units": json.loads(row[2]),
            "conversion_factors": json.loads(row[3])
        }
    
    def insert_unit_standard(self, pollutant: str, standard_unit: str,
                              allowed_units: List[str],
                              conversion_factors: Dict[str, float]) -> None:
        self.conn.execute(
            "INSERT OR REPLACE INTO unit_standards VALUES (?, ?, ?, ?)",
            (
                pollutant,
                standard_unit,
                json.dumps(allowed_units, ensure_ascii=False),
                json.dumps(conversion_factors, ensure_ascii=False)
            )
        )
        self.conn.commit()
