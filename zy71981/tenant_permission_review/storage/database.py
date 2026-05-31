import sqlite3
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from contextlib import contextmanager

from ..config import Config
from ..models import (
    CallLog,
    PermissionChange,
    ManualConfirmation,
    MigrationReport,
    EvidenceChain,
    EvidenceNode,
    RecordStatus,
)


class Database:
    def __init__(self, config: Config = None):
        self.config = config or Config()
        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.config.DB_PATH)
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
        with self._get_connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS call_logs (
                    log_id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    request_body TEXT NOT NULL,
                    idempotency_key TEXT,
                    timestamp TEXT NOT NULL,
                    response_status INTEGER,
                    response_body TEXT,
                    source_system TEXT DEFAULT 'api'
                );
                CREATE INDEX IF NOT EXISTS idx_call_idempotency ON call_logs(idempotency_key);
                CREATE INDEX IF NOT EXISTS idx_call_tenant ON call_logs(tenant_id);
                CREATE INDEX IF NOT EXISTS idx_call_timestamp ON call_logs(timestamp);

                CREATE TABLE IF NOT EXISTS permission_changes (
                    change_id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    permission_code TEXT NOT NULL,
                    change_type TEXT NOT NULL,
                    source_log_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    old_value INTEGER,
                    new_value INTEGER,
                    status TEXT NOT NULL,
                    metadata TEXT,
                    failure_reason TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_perm_tenant ON permission_changes(tenant_id);
                CREATE INDEX IF NOT EXISTS idx_perm_status ON permission_changes(status);

                CREATE TABLE IF NOT EXISTS manual_confirmations (
                    confirmation_id TEXT PRIMARY KEY,
                    related_record_id TEXT NOT NULL,
                    record_type TEXT NOT NULL,
                    operator_id TEXT NOT NULL,
                    operator_name TEXT NOT NULL,
                    action TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    before_state TEXT,
                    after_state TEXT,
                    comments TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_confirm_related ON manual_confirmations(related_record_id);

                CREATE TABLE IF NOT EXISTS migration_reports (
                    report_id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    migration_batch_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    total_records INTEGER NOT NULL,
                    success_count INTEGER NOT NULL,
                    failed_count INTEGER DEFAULT 0,
                    duplicate_count INTEGER DEFAULT 0,
                    late_arrival_count INTEGER DEFAULT 0,
                    manual_corrected_count INTEGER DEFAULT 0,
                    failed_record_ids TEXT,
                    duplicate_record_ids TEXT,
                    late_arrival_ids TEXT,
                    summary TEXT,
                    issues TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_report_batch ON migration_reports(migration_batch_id);

                CREATE TABLE IF NOT EXISTS evidence_chains (
                    chain_id TEXT PRIMARY KEY,
                    root_record_id TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_evidence_root ON evidence_chains(root_record_id);

                CREATE TABLE IF NOT EXISTS evidence_nodes (
                    node_id TEXT PRIMARY KEY,
                    chain_id TEXT NOT NULL,
                    node_type TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    description TEXT NOT NULL,
                    data_reference TEXT NOT NULL,
                    metadata TEXT,
                    sequence INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_node_chain ON evidence_nodes(chain_id);
            """)

    def save_call_log(self, log: CallLog) -> None:
        with self._get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO call_logs 
                (log_id, tenant_id, user_id, action, request_body, idempotency_key, 
                 timestamp, response_status, response_body, source_system)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                log.log_id,
                log.tenant_id,
                log.user_id,
                log.action,
                json.dumps(log.request_body),
                log.idempotency_key,
                log.timestamp.isoformat(),
                log.response_status,
                json.dumps(log.response_body) if log.response_body else None,
                log.source_system,
            ))

    def find_call_by_idempotency_key(self, idempotency_key: str) -> Optional[CallLog]:
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM call_logs WHERE idempotency_key = ? LIMIT 1",
                (idempotency_key,)
            ).fetchone()
            return self._row_to_call_log(row) if row else None

    def _row_to_call_log(self, row) -> CallLog:
        return CallLog(
            log_id=row["log_id"],
            tenant_id=row["tenant_id"],
            user_id=row["user_id"],
            action=row["action"],
            request_body=json.loads(row["request_body"]),
            idempotency_key=row["idempotency_key"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
            response_status=row["response_status"],
            response_body=json.loads(row["response_body"]) if row["response_body"] else None,
            source_system=row["source_system"],
        )

    def save_permission_change(self, change: PermissionChange) -> None:
        with self._get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO permission_changes 
                (change_id, tenant_id, user_id, permission_code, change_type, source_log_id,
                 timestamp, old_value, new_value, status, metadata, failure_reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                change.change_id,
                change.tenant_id,
                change.user_id,
                change.permission_code,
                change.change_type,
                change.source_log_id,
                change.timestamp.isoformat(),
                1 if change.old_value else 0 if change.old_value is not None else None,
                1 if change.new_value else 0 if change.new_value is not None else None,
                change.status.value,
                json.dumps(change.metadata),
                change.failure_reason,
            ))

    def save_manual_confirmation(self, conf: ManualConfirmation) -> None:
        with self._get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO manual_confirmations 
                (confirmation_id, related_record_id, record_type, operator_id, operator_name,
                 action, reason, timestamp, before_state, after_state, comments)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                conf.confirmation_id,
                conf.related_record_id,
                conf.record_type,
                conf.operator_id,
                conf.operator_name,
                conf.action,
                conf.reason,
                conf.timestamp.isoformat(),
                json.dumps(conf.before_state) if conf.before_state else None,
                json.dumps(conf.after_state) if conf.after_state else None,
                conf.comments,
            ))

    def save_migration_report(self, report: MigrationReport) -> None:
        with self._get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO migration_reports 
                (report_id, tenant_id, migration_batch_id, timestamp, total_records,
                 success_count, failed_count, duplicate_count, late_arrival_count,
                 manual_corrected_count, failed_record_ids, duplicate_record_ids,
                 late_arrival_ids, summary, issues)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                report.report_id,
                report.tenant_id,
                report.migration_batch_id,
                report.timestamp.isoformat(),
                report.total_records,
                report.success_count,
                report.failed_count,
                report.duplicate_count,
                report.late_arrival_count,
                report.manual_corrected_count,
                json.dumps(report.failed_record_ids),
                json.dumps(report.duplicate_record_ids),
                json.dumps(report.late_arrival_ids),
                json.dumps(report.summary),
                json.dumps(report.issues),
            ))

    def save_evidence_chain(self, chain: EvidenceChain) -> None:
        with self._get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO evidence_chains (chain_id, root_record_id, created_at)
                VALUES (?, ?, ?)
            """, (chain.chain_id, chain.root_record_id, chain.created_at.isoformat()))

            for idx, node in enumerate(chain.nodes):
                conn.execute("""
                    INSERT OR REPLACE INTO evidence_nodes 
                    (node_id, chain_id, node_type, timestamp, description, data_reference, metadata, sequence)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    node.node_id,
                    chain.chain_id,
                    node.node_type,
                    node.timestamp.isoformat(),
                    node.description,
                    node.data_reference,
                    json.dumps(node.metadata),
                    idx,
                ))

    def get_evidence_chain(self, root_record_id: str) -> Optional[EvidenceChain]:
        with self._get_connection() as conn:
            chain_row = conn.execute(
                "SELECT * FROM evidence_chains WHERE root_record_id = ? LIMIT 1",
                (root_record_id,)
            ).fetchone()
            if not chain_row:
                return None

            chain = EvidenceChain(
                chain_id=chain_row["chain_id"],
                root_record_id=chain_row["root_record_id"],
                created_at=datetime.fromisoformat(chain_row["created_at"]),
                nodes=[],
            )

            node_rows = conn.execute(
                "SELECT * FROM evidence_nodes WHERE chain_id = ? ORDER BY sequence",
                (chain.chain_id,)
            ).fetchall()

            for row in node_rows:
                chain.nodes.append(EvidenceNode(
                    node_id=row["node_id"],
                    node_type=row["node_type"],
                    timestamp=datetime.fromisoformat(row["timestamp"]),
                    description=row["description"],
                    data_reference=row["data_reference"],
                    metadata=json.loads(row["metadata"]) if row["metadata"] else {},
                ))

            return chain

    def get_migration_report(self, batch_id: str) -> Optional[MigrationReport]:
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM migration_reports WHERE migration_batch_id = ? LIMIT 1",
                (batch_id,)
            ).fetchone()
            if not row:
                return None
            return MigrationReport(
                report_id=row["report_id"],
                tenant_id=row["tenant_id"],
                migration_batch_id=row["migration_batch_id"],
                timestamp=datetime.fromisoformat(row["timestamp"]),
                total_records=row["total_records"],
                success_count=row["success_count"],
                failed_count=row["failed_count"],
                duplicate_count=row["duplicate_count"],
                late_arrival_count=row["late_arrival_count"],
                manual_corrected_count=row["manual_corrected_count"],
                failed_record_ids=json.loads(row["failed_record_ids"]),
                duplicate_record_ids=json.loads(row["duplicate_record_ids"]),
                late_arrival_ids=json.loads(row["late_arrival_ids"]),
                summary=json.loads(row["summary"]),
                issues=json.loads(row["issues"]),
            )
