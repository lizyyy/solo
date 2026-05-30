import sqlite3
import json
import os
import hashlib
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from contextlib import contextmanager

from models import (
    ReviewRecord, ReviewStatus, SourceType,
    Evidence, EvidenceType, AuditLog, ActionType
)


DB_PATH = os.environ.get('RISK_REVIEW_DB', 'risk_review.db')
EVIDENCE_DIR = os.environ.get('RISK_REVIEW_EVIDENCE_DIR', 'evidence_storage')


@contextmanager
def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    os.makedirs(EVIDENCE_DIR, exist_ok=True)
    with get_connection() as conn:
        conn.executescript('''
        CREATE TABLE IF NOT EXISTS review_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            questionnaire_id TEXT NOT NULL,
            questionnaire_version TEXT NOT NULL,
            source_type TEXT NOT NULL,
            source_batch_id TEXT NOT NULL,
            current_status TEXT NOT NULL,
            pending_reason TEXT NOT NULL,
            assigned_to TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            is_duplicate BOOLEAN NOT NULL DEFAULT 0,
            duplicate_of_id INTEGER,
            correction_note TEXT NOT NULL,
            FOREIGN KEY (duplicate_of_id) REFERENCES review_records(id)
        );

        CREATE TABLE IF NOT EXISTS evidences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_record_id INTEGER NOT NULL,
            evidence_type TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_at DATETIME NOT NULL,
            description TEXT NOT NULL,
            metadata TEXT NOT NULL,
            FOREIGN KEY (review_record_id) REFERENCES review_records(id)
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_record_id INTEGER NOT NULL,
            action_type TEXT NOT NULL,
            operator TEXT NOT NULL,
            old_status TEXT,
            new_status TEXT,
            reason TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            details TEXT NOT NULL,
            FOREIGN KEY (review_record_id) REFERENCES review_records(id)
        );

        CREATE INDEX IF NOT EXISTS idx_customer_questionnaire
        ON review_records(customer_id, questionnaire_id, questionnaire_version);

        CREATE INDEX IF NOT EXISTS idx_status ON review_records(current_status);
        CREATE INDEX IF NOT EXISTS idx_source_batch ON review_records(source_batch_id);
        CREATE INDEX IF NOT EXISTS idx_duplicate ON review_records(is_duplicate);
        CREATE INDEX IF NOT EXISTS idx_evidence_record ON evidences(review_record_id);
        CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_logs(review_record_id);
        CREATE INDEX IF NOT EXISTS idx_evidence_hash ON evidences(file_hash);
        ''')


def compute_file_hash(file_content: bytes) -> str:
    return hashlib.sha256(file_content).hexdigest()


def row_to_review_record(row: sqlite3.Row) -> ReviewRecord:
    return ReviewRecord(
        id=row['id'],
        customer_id=row['customer_id'],
        customer_name=row['customer_name'],
        questionnaire_id=row['questionnaire_id'],
        questionnaire_version=row['questionnaire_version'],
        source_type=SourceType(row['source_type']),
        source_batch_id=row['source_batch_id'],
        current_status=ReviewStatus(row['current_status']),
        pending_reason=row['pending_reason'],
        assigned_to=row['assigned_to'],
        created_by=row['created_by'],
        created_at=datetime.fromisoformat(row['created_at']),
        updated_at=datetime.fromisoformat(row['updated_at']),
        is_duplicate=bool(row['is_duplicate']),
        duplicate_of_id=row['duplicate_of_id'],
        correction_note=row['correction_note'],
        evidences=[],
        audit_logs=[]
    )


def row_to_evidence(row: sqlite3.Row) -> Evidence:
    return Evidence(
        id=row['id'],
        review_record_id=row['review_record_id'],
        evidence_type=EvidenceType(row['evidence_type']),
        file_path=row['file_path'],
        file_name=row['file_name'],
        file_hash=row['file_hash'],
        uploaded_by=row['uploaded_by'],
        uploaded_at=datetime.fromisoformat(row['uploaded_at']),
        description=row['description'],
        metadata=json.loads(row['metadata'])
    )


def row_to_audit_log(row: sqlite3.Row) -> AuditLog:
    return AuditLog(
        id=row['id'],
        review_record_id=row['review_record_id'],
        action_type=ActionType(row['action_type']),
        operator=row['operator'],
        old_status=ReviewStatus(row['old_status']) if row['old_status'] else None,
        new_status=ReviewStatus(row['new_status']) if row['new_status'] else None,
        reason=row['reason'],
        created_at=datetime.fromisoformat(row['created_at']),
        details=json.loads(row['details'])
    )


def create_review_record(
    record: ReviewRecord,
    operator: str,
    import_details: Optional[Dict] = None
) -> ReviewRecord:
    now = datetime.now().isoformat()
    record.created_at = datetime.fromisoformat(now)
    record.updated_at = datetime.fromisoformat(now)
    record.update_pending_reason()

    with get_connection() as conn:
        cursor = conn.execute('''
        INSERT INTO review_records (
            customer_id, customer_name, questionnaire_id, questionnaire_version,
            source_type, source_batch_id, current_status, pending_reason,
            assigned_to, created_by, created_at, updated_at,
            is_duplicate, duplicate_of_id, correction_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record.customer_id, record.customer_name,
            record.questionnaire_id, record.questionnaire_version,
            record.source_type.value, record.source_batch_id,
            record.current_status.value, record.pending_reason,
            record.assigned_to, record.created_by,
            now, now,
            int(record.is_duplicate), record.duplicate_of_id,
            record.correction_note
        ))
        record.id = cursor.lastrowid

        conn.execute('''
        INSERT INTO audit_logs (
            review_record_id, action_type, operator,
            old_status, new_status, reason, created_at, details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record.id, ActionType.IMPORT.value, operator,
            None, record.current_status.value,
            f"从{record.source_type.value}导入记录",
            now, json.dumps(import_details or {})
        ))

    return record


def get_review_record(record_id: int, load_related: bool = True) -> Optional[ReviewRecord]:
    with get_connection() as conn:
        row = conn.execute(
            'SELECT * FROM review_records WHERE id = ?',
            (record_id,)
        ).fetchone()
        if not row:
            return None
        record = row_to_review_record(row)
        if load_related:
            record.evidences = get_evidences_for_record(record_id)
            record.audit_logs = get_audit_logs_for_record(record_id)
        return record


def get_evidences_for_record(record_id: int) -> List[Evidence]:
    with get_connection() as conn:
        rows = conn.execute(
            'SELECT * FROM evidences WHERE review_record_id = ? ORDER BY uploaded_at',
            (record_id,)
        ).fetchall()
        return [row_to_evidence(r) for r in rows]


def get_audit_logs_for_record(record_id: int) -> List[AuditLog]:
    with get_connection() as conn:
        rows = conn.execute(
            'SELECT * FROM audit_logs WHERE review_record_id = ? ORDER BY created_at',
            (record_id,)
        ).fetchall()
        return [row_to_audit_log(r) for r in rows]


def update_review_record_status(
    record_id: int,
    new_status: ReviewStatus,
    operator: str,
    reason: str,
    details: Optional[Dict] = None
) -> Optional[ReviewRecord]:
    with get_connection() as conn:
        row = conn.execute(
            'SELECT current_status FROM review_records WHERE id = ?',
            (record_id,)
        ).fetchone()
        if not row:
            return None
        old_status = ReviewStatus(row['current_status'])
        now = datetime.now().isoformat()
        pending_reason = ""
        if new_status in [
            ReviewStatus.PENDING_APPROVAL_SCREENSHOT,
            ReviewStatus.PENDING_SUPPLEMENT_EMAIL,
            ReviewStatus.PENDING_MANUAL_CONFIRM,
            ReviewStatus.PENDING_RISK_REVIEW,
            ReviewStatus.NEEDS_CORRECTION,
            ReviewStatus.WITHDRAWN
        ]:
            from models import PENDING_REASONS
            pending_reason = PENDING_REASONS.get(new_status, reason)

        conn.execute('''
        UPDATE review_records
        SET current_status = ?, pending_reason = ?, updated_at = ?
        WHERE id = ?
        ''', (new_status.value, pending_reason, now, record_id))

        conn.execute('''
        INSERT INTO audit_logs (
            review_record_id, action_type, operator,
            old_status, new_status, reason, created_at, details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record_id, ActionType.UPDATE_STATUS.value, operator,
            old_status.value, new_status.value, reason,
            now, json.dumps(details or {})
        ))

    return get_review_record(record_id)


def add_evidence(
    record_id: int,
    evidence_type: EvidenceType,
    file_content: bytes,
    file_name: str,
    uploaded_by: str,
    description: str = "",
    metadata: Optional[Dict] = None
) -> Optional[Evidence]:
    file_hash = compute_file_hash(file_content)
    record = get_review_record(record_id, load_related=False)
    if not record:
        return None

    stored_path = os.path.join(
        EVIDENCE_DIR,
        f"{record_id}_{evidence_type.value}_{file_hash[:16]}_{file_name}"
    )
    with open(stored_path, 'wb') as f:
        f.write(file_content)

    now = datetime.now().isoformat()
    with get_connection() as conn:
        cursor = conn.execute('''
        INSERT INTO evidences (
            review_record_id, evidence_type, file_path, file_name,
            file_hash, uploaded_by, uploaded_at, description, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record_id, evidence_type.value, stored_path, file_name,
            file_hash, uploaded_by, now, description,
            json.dumps(metadata or {})
        ))
        evidence_id = cursor.lastrowid

        conn.execute('''
        INSERT INTO audit_logs (
            review_record_id, action_type, operator,
            old_status, new_status, reason, created_at, details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record_id, ActionType.ADD_EVIDENCE.value, uploaded_by,
            None, None, f"添加{evidence_type.value}证据",
            now, json.dumps({
                "evidence_id": evidence_id,
                "evidence_type": evidence_type.value,
                "file_name": file_name,
                "file_hash": file_hash
            })
        ))

    evidence = get_evidence_by_id(evidence_id)
    _auto_update_status_on_evidence(record_id, evidence_type, uploaded_by)
    return evidence


def _auto_update_status_on_evidence(
    record_id: int,
    evidence_type: EvidenceType,
    operator: str
) -> None:
    record = get_review_record(record_id, load_related=True)
    if not record:
        return

    has_screenshot = record.get_evidence_by_type(EvidenceType.APPROVAL_SCREENSHOT) is not None
    has_email = record.get_evidence_by_type(EvidenceType.SUPPLEMENT_EMAIL) is not None
    has_confirm = record.get_evidence_by_type(EvidenceType.MANUAL_CONFIRMATION) is not None
    has_checklist = record.get_evidence_by_type(EvidenceType.REVIEW_CHECKLIST) is not None

    if record.current_status == ReviewStatus.PENDING_APPROVAL_SCREENSHOT and has_screenshot:
        if not has_email:
            update_review_record_status(
                record_id, ReviewStatus.PENDING_SUPPLEMENT_EMAIL,
                operator, "已上传审批截图，缺少补充邮件"
            )
        elif not has_confirm:
            update_review_record_status(
                record_id, ReviewStatus.PENDING_MANUAL_CONFIRM,
                operator, "审批截图和补充邮件齐全，等待人工确认"
            )
        else:
            update_review_record_status(
                record_id, ReviewStatus.PENDING_RISK_REVIEW,
                operator, "材料齐全，已人工确认，等待风控复核"
            )

    elif record.current_status == ReviewStatus.PENDING_SUPPLEMENT_EMAIL and has_email:
        if not has_confirm:
            update_review_record_status(
                record_id, ReviewStatus.PENDING_MANUAL_CONFIRM,
                operator, "补充邮件已上传，等待人工确认"
            )
        else:
            update_review_record_status(
                record_id, ReviewStatus.PENDING_RISK_REVIEW,
                operator, "材料齐全，已人工确认，等待风控复核"
            )

    elif record.current_status == ReviewStatus.PENDING_MANUAL_CONFIRM and has_confirm:
        update_review_record_status(
            record_id, ReviewStatus.PENDING_RISK_REVIEW,
            operator, "已人工确认，等待风控经理复核"
        )

    elif record.current_status == ReviewStatus.PENDING_RISK_REVIEW and has_checklist:
        update_review_record_status(
            record_id, ReviewStatus.APPROVED,
            operator, "风控复核完成，已通过"
        )


def get_evidence_by_id(evidence_id: int) -> Optional[Evidence]:
    with get_connection() as conn:
        row = conn.execute(
            'SELECT * FROM evidences WHERE id = ?',
            (evidence_id,)
        ).fetchone()
        return row_to_evidence(row) if row else None


def find_duplicate_records(
    customer_id: str,
    questionnaire_id: str,
    questionnaire_version: str
) -> List[ReviewRecord]:
    with get_connection() as conn:
        rows = conn.execute('''
            SELECT * FROM review_records
            WHERE customer_id = ?
              AND questionnaire_id = ?
              AND questionnaire_version = ?
              AND is_duplicate = 0
            ORDER BY created_at DESC
        ''', (customer_id, questionnaire_id, questionnaire_version)).fetchall()
        return [row_to_review_record(r) for r in rows]


def find_duplicate_by_file_hash(file_hash: str) -> Optional[Evidence]:
    with get_connection() as conn:
        row = conn.execute('''
            SELECT * FROM evidences WHERE file_hash = ? LIMIT 1
        ''', (file_hash,)).fetchone()
        return row_to_evidence(row) if row else None


def mark_as_duplicate(
    record_id: int,
    duplicate_of_id: int,
    operator: str,
    reason: str
) -> Optional[ReviewRecord]:
    now = datetime.now().isoformat()
    with get_connection() as conn:
        conn.execute('''
        UPDATE review_records
        SET is_duplicate = 1, duplicate_of_id = ?, updated_at = ?
        WHERE id = ?
        ''', (duplicate_of_id, now, record_id))

        row = conn.execute(
            'SELECT current_status FROM review_records WHERE id = ?',
            (record_id,)
        ).fetchone()
        old_status = ReviewStatus(row['current_status'])

        conn.execute('''
        INSERT INTO audit_logs (
            review_record_id, action_type, operator,
            old_status, new_status, reason, created_at, details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record_id, ActionType.UPDATE_STATUS.value, operator,
            old_status.value, old_status.value, reason,
            now, json.dumps({"duplicate_of_id": duplicate_of_id})
        ))

    return get_review_record(record_id)


def query_records(
    filters: Optional[Dict[str, Any]] = None,
    order_by: str = "created_at DESC",
    limit: Optional[int] = None,
    offset: int = 0
) -> Tuple[List[ReviewRecord], int]:
    filters = filters or {}
    where_clauses = []
    params: List[Any] = []

    if 'customer_id' in filters:
        where_clauses.append("customer_id = ?")
        params.append(filters['customer_id'])
    if 'customer_name' in filters:
        where_clauses.append("customer_name LIKE ?")
        params.append(f"%{filters['customer_name']}%")
    if 'status' in filters:
        statuses = filters['status'] if isinstance(filters['status'], list) else [filters['status']]
        placeholders = ", ".join(["?"] * len(statuses))
        where_clauses.append(f"current_status IN ({placeholders})")
        params.extend([s.value if isinstance(s, ReviewStatus) else s for s in statuses])
    if 'source_type' in filters:
        where_clauses.append("source_type = ?")
        st = filters['source_type']
        params.append(st.value if isinstance(st, SourceType) else st)
    if 'source_batch_id' in filters:
        where_clauses.append("source_batch_id = ?")
        params.append(filters['source_batch_id'])
    if 'is_duplicate' in filters:
        where_clauses.append("is_duplicate = ?")
        params.append(1 if filters['is_duplicate'] else 0)
    if 'created_by' in filters:
        where_clauses.append("created_by = ?")
        params.append(filters['created_by'])
    if 'assigned_to' in filters:
        where_clauses.append("assigned_to = ?")
        params.append(filters['assigned_to'])

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    with get_connection() as conn:
        count_row = conn.execute(
            f'SELECT COUNT(*) as cnt FROM review_records WHERE {where_sql}',
            params
        ).fetchone()
        total = count_row['cnt']

        sql = f'''
            SELECT * FROM review_records
            WHERE {where_sql}
            ORDER BY {order_by}
        '''
        if limit:
            sql += f" LIMIT {limit} OFFSET {offset}"
        rows = conn.execute(sql, params).fetchall()
        records = [row_to_review_record(r) for r in rows]

    return records, total


def list_all_records(load_related: bool = False) -> List[ReviewRecord]:
    records, _ = query_records(order_by="created_at DESC")
    if load_related:
        for r in records:
            r.evidences = get_evidences_for_record(r.id)
            r.audit_logs = get_audit_logs_for_record(r.id)
    return records
