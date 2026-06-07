from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
from .models import AuditLog
from .utils import safe_json_dumps


class AuditTrail:
    def __init__(self, db: Session, actor: str = "system", ip_address: Optional[str] = None):
        self.db = db
        self.actor = actor
        self.ip_address = ip_address
    
    def log_action(
        self,
        action: str,
        snapshot_id: Optional[str] = None,
        snapshot_db_id: Optional[int] = None,
        run_id: Optional[str] = None,
        run_db_id: Optional[int] = None,
        field_changed: Optional[str] = None,
        old_value: Any = None,
        new_value: Any = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        log = AuditLog(
            action=action,
            actor=self.actor,
            snapshot_id=snapshot_id,
            snapshot_db_id=snapshot_db_id,
            run_id=run_id,
            run_db_id=run_db_id,
            field_changed=field_changed,
            old_value=safe_json_dumps(old_value) if old_value is not None else None,
            new_value=safe_json_dumps(new_value) if new_value is not None else None,
            details=details,
            ip_address=self.ip_address,
        )
        self.db.add(log)
        self.db.flush()
        return log
    
    def log_snapshot_import(self, snapshot_id: str, snapshot_db_id: int, row_count: int, source_file: str):
        return self.log_action(
            action="snapshot.import",
            snapshot_id=snapshot_id,
            snapshot_db_id=snapshot_db_id,
            details={"row_count": row_count, "source_file": source_file},
        )
    
    def log_duplicate_detected(self, snapshot_id: str, snapshot_db_id: int, duplicate_of: str):
        return self.log_action(
            action="snapshot.duplicate_detected",
            snapshot_id=snapshot_id,
            snapshot_db_id=snapshot_db_id,
            details={"duplicate_of_snapshot_id": duplicate_of},
        )
    
    def log_training_start(self, run_id: str, run_db_id: int, snapshot_id: str, algorithm: str):
        return self.log_action(
            action="training.start",
            run_id=run_id,
            run_db_id=run_db_id,
            snapshot_id=snapshot_id,
            details={"algorithm": algorithm},
        )
    
    def log_training_complete(self, run_id: str, run_db_id: int, metrics: Dict[str, Any]):
        return self.log_action(
            action="training.complete",
            run_id=run_id,
            run_db_id=run_db_id,
            details={"metrics": metrics},
        )
    
    def log_duplicate_training(self, run_id: str, run_db_id: int, duplicate_of_run: str):
        return self.log_action(
            action="training.duplicate_detected",
            run_id=run_id,
            run_db_id=run_db_id,
            details={"duplicate_of_run_id": duplicate_of_run},
        )
    
    def log_cluster_name_edit(
        self, run_id: str, run_db_id: int, cluster_id: int,
        old_name: str, new_name: str, edited_by: str
    ):
        return self.log_action(
            action="cluster.name_edit",
            run_id=run_id,
            run_db_id=run_db_id,
            field_changed=f"cluster_{cluster_id}_name",
            old_value=old_name,
            new_value=new_name,
            details={"cluster_id": cluster_id, "edited_by": edited_by},
        )
    
    def log_manual_override(
        self, run_id: str, run_db_id: int, snapshot_id: str, row_number: int,
        old_cluster: int, new_cluster: int, reason: str, overridden_by: str
    ):
        return self.log_action(
            action="result.manual_override",
            run_id=run_id,
            run_db_id=run_db_id,
            snapshot_id=snapshot_id,
            field_changed=f"row_{row_number}_cluster",
            old_value=str(old_cluster),
            new_value=str(new_cluster),
            details={
                "row_number": row_number,
                "reason": reason,
                "overridden_by": overridden_by,
            },
        )
    
    def log_review_decision(
        self, run_id: str, run_db_id: int, decision: str,
        reviewed_by: str, comments: Optional[str] = None
    ):
        return self.log_action(
            action="review.decision",
            run_id=run_id,
            run_db_id=run_db_id,
            field_changed="review_status",
            new_value=decision,
            details={"reviewed_by": reviewed_by, "comments": comments},
        )
    
    def log_export(self, export_id: str, run_id: str, row_count: int, format: str):
        return self.log_action(
            action="result.export",
            run_id=run_id,
            details={
                "export_id": export_id,
                "row_count": row_count,
                "format": format,
            },
        )
    
    def log_version_create(self, version_id: str, snapshot_id: str, run_id: str, version_number: int):
        return self.log_action(
            action="version.create",
            snapshot_id=snapshot_id,
            run_id=run_id,
            details={
                "version_id": version_id,
                "version_number": version_number,
            },
        )
