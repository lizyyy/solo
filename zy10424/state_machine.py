from datetime import datetime
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from models import (
    SandboxCleanup, CleanupStatus, PreservationTag,
    AuditLog, CleanupSummary, ResourceItem
)


class StateTransitionError(Exception):
    def __init__(self, from_status: str, to_status: str, message: str):
        self.from_status = from_status
        self.to_status = to_status
        self.message = message
        super().__init__(message)


class PreservationInterceptError(Exception):
    def __init__(self, sandbox_id: str, preservation_tag: str, message: str):
        self.sandbox_id = sandbox_id
        self.preservation_tag = preservation_tag
        self.message = message
        super().__init__(message)


class CleanupStateMachine:
    VALID_TRANSITIONS: Dict[str, List[str]] = {
        CleanupStatus.PENDING: [
            CleanupStatus.INVENTORYING,
            CleanupStatus.CANCELLED,
            CleanupStatus.REVOKED
        ],
        CleanupStatus.INVENTORYING: [
            CleanupStatus.INVENTORY_DONE,
            CleanupStatus.ERROR,
            CleanupStatus.CANCELLED,
            CleanupStatus.REVOKED
        ],
        CleanupStatus.INVENTORY_DONE: [
            CleanupStatus.PRESERVATION_CHECKING,
            CleanupStatus.ERROR,
            CleanupStatus.CANCELLED,
            CleanupStatus.REVOKED
        ],
        CleanupStatus.PRESERVATION_CHECKING: [
            CleanupStatus.READY_TO_CLEAN,
            CleanupStatus.REVOKED,
            CleanupStatus.ERROR,
            CleanupStatus.CANCELLED
        ],
        CleanupStatus.READY_TO_CLEAN: [
            CleanupStatus.CLEANING,
            CleanupStatus.REVOKED,
            CleanupStatus.CANCELLED,
            CleanupStatus.ERROR
        ],
        CleanupStatus.CLEANING: [
            CleanupStatus.COMPLETED,
            CleanupStatus.ERROR,
            CleanupStatus.REVOKED
        ],
        CleanupStatus.COMPLETED: [],
        CleanupStatus.CANCELLED: [],
        CleanupStatus.REVOKED: [],
        CleanupStatus.ERROR: [
            CleanupStatus.PENDING,
            CleanupStatus.INVENTORYING,
            CleanupStatus.CANCELLED,
            CleanupStatus.REVOKED
        ]
    }

    PRESERVATION_TAGS_THAT_BLOCK = {
        PreservationTag.UNDER_INVESTIGATION,
        PreservationTag.EVIDENCE,
        PreservationTag.PENDING_REVIEW
    }

    @classmethod
    def can_transition(cls, from_status: str, to_status: str) -> bool:
        valid_targets = cls.VALID_TRANSITIONS.get(from_status, [])
        return to_status in valid_targets

    @classmethod
    def check_preservation_intercept(cls, cleanup: SandboxCleanup) -> Tuple[bool, str]:
        if cleanup.preservation_tag in cls.PRESERVATION_TAGS_THAT_BLOCK:
            reasons = {
                PreservationTag.UNDER_INVESTIGATION: "沙箱样本正在分析排查中，禁止清理",
                PreservationTag.EVIDENCE: "沙箱样本为证据保全状态，禁止清理",
                PreservationTag.PENDING_REVIEW: "沙箱样本待人工复核，暂不清理"
            }
            return True, reasons.get(cleanup.preservation_tag, "存在保全标签，拦截清理")
        return False, ""

    @staticmethod
    def create_audit_log(
        db: Session,
        cleanup_id: int,
        action: str,
        from_status: Optional[str],
        to_status: Optional[str],
        operator: str,
        details: Optional[Dict] = None,
        raw_input_snapshot: Optional[Dict] = None,
        processing_notes: Optional[str] = None
    ) -> AuditLog:
        audit_log = AuditLog(
            cleanup_id=cleanup_id,
            action=action,
            from_status=from_status,
            to_status=to_status,
            operator=operator,
            details=details or {},
            raw_input_snapshot=raw_input_snapshot,
            processing_notes=processing_notes
        )
        db.add(audit_log)
        db.flush()
        return audit_log

    @classmethod
    def transition_status(
        cls,
        db: Session,
        cleanup: SandboxCleanup,
        target_status: str,
        operator: str,
        details: Optional[Dict] = None,
        processing_conclusion: Optional[str] = None,
        raw_input_snapshot: Optional[Dict] = None
    ) -> SandboxCleanup:
        from_status = cleanup.status

        if not cls.can_transition(from_status, target_status):
            valid_targets = ", ".join(cls.VALID_TRANSITIONS.get(from_status, []))
            raise StateTransitionError(
                from_status,
                target_status,
                f"状态转换非法: 从 {from_status} 无法转换到 {target_status}。合法目标状态: {valid_targets or '无'}"
            )

        if target_status == CleanupStatus.READY_TO_CLEAN:
            should_block, block_reason = cls.check_preservation_intercept(cleanup)
            if should_block:
                raise PreservationInterceptError(cleanup.sandbox_id, cleanup.preservation_tag, block_reason)

        if target_status == CleanupStatus.CLEANING:
            cleanup.started_time = datetime.utcnow()

        if target_status in [CleanupStatus.COMPLETED, CleanupStatus.REVOKED, CleanupStatus.CANCELLED]:
            cleanup.completed_time = datetime.utcnow()

        cleanup.status = target_status

        if processing_conclusion:
            cleanup.processing_conclusion = processing_conclusion

        cls.create_audit_log(
            db,
            cleanup.id,
            action="status_transition",
            from_status=from_status,
            to_status=target_status,
            operator=operator,
            details=details,
            raw_input_snapshot=raw_input_snapshot,
            processing_notes=processing_conclusion
        )

        db.flush()
        return cleanup

    @classmethod
    def revoke_cleanup(
        cls,
        db: Session,
        cleanup: SandboxCleanup,
        revoke_reason: str,
        revoked_by: str,
        details: Optional[Dict] = None
    ) -> SandboxCleanup:
        from_status = cleanup.status

        if from_status in [CleanupStatus.COMPLETED, CleanupStatus.CANCELLED]:
            raise StateTransitionError(
                from_status,
                CleanupStatus.REVOKED,
                f"已{from_status}的清理任务无法撤销"
            )

        cleanup.status = CleanupStatus.REVOKED
        cleanup.revoke_reason = revoke_reason
        cleanup.revoked_by = revoked_by
        cleanup.revoked_at = datetime.utcnow()
        cleanup.completed_time = datetime.utcnow()

        cls.create_audit_log(
            db,
            cleanup.id,
            action="revoke",
            from_status=from_status,
            to_status=CleanupStatus.REVOKED,
            operator=revoked_by,
            details={"revoke_reason": revoke_reason, **(details or {})},
            processing_notes=f"撤销原因: {revoke_reason}"
        )

        db.flush()
        return cleanup

    @classmethod
    def record_error(
        cls,
        db: Session,
        cleanup: SandboxCleanup,
        error_message: str,
        operator: str,
        raw_input_snapshot: Optional[Dict] = None,
        processing_notes: Optional[str] = None
    ) -> SandboxCleanup:
        from_status = cleanup.status

        cleanup.status = CleanupStatus.ERROR
        cleanup.error_message = error_message

        cls.create_audit_log(
            db,
            cleanup.id,
            action="error",
            from_status=from_status,
            to_status=CleanupStatus.ERROR,
            operator=operator,
            raw_input_snapshot=raw_input_snapshot,
            processing_notes=processing_notes or f"错误: {error_message}"
        )

        db.flush()
        return cleanup

    @classmethod
    def manual_correct(
        cls,
        db: Session,
        cleanup: SandboxCleanup,
        corrected_status: str,
        modified_by: str,
        modification_reason: str,
        details: Optional[Dict] = None
    ) -> SandboxCleanup:
        from_status = cleanup.status

        cleanup.status = corrected_status
        cleanup.is_manually_modified = True
        cleanup.modified_by = modified_by
        cleanup.modified_at = datetime.utcnow()
        cleanup.modification_reason = modification_reason

        cls.create_audit_log(
            db,
            cleanup.id,
            action="manual_correction",
            from_status=from_status,
            to_status=corrected_status,
            operator=modified_by,
            details={"modification_reason": modification_reason, **(details or {})},
            processing_notes=f"人工修正原因: {modification_reason}"
        )

        db.flush()
        return cleanup

    @staticmethod
    def inventory_resources(
        cleanup: SandboxCleanup,
        resources: List[ResourceItem]
    ) -> SandboxCleanup:
        resource_dicts = [r.model_dump() for r in resources]
        cleanup.resource_inventory = resource_dicts
        return cleanup

    @staticmethod
    def generate_summary(
        db: Session,
        cleanup: SandboxCleanup,
        completed_by: str
    ) -> CleanupSummary:
        resources = cleanup.resource_inventory or []
        total_resources = len(resources)
        preserved_resources = sum(1 for r in resources if isinstance(r, dict) and r.get("should_preserve", False))
        cleaned_resources = total_resources - preserved_resources

        duration = None
        if cleanup.started_time and cleanup.completed_time:
            duration = int((cleanup.completed_time - cleanup.started_time).total_seconds())

        summary = CleanupSummary(
            cleanup_id=cleanup.id,
            sandbox_id=cleanup.sandbox_id,
            total_resources=total_resources,
            preserved_resources=preserved_resources,
            cleaned_resources=cleaned_resources,
            failed_resources=0,
            resource_details=resources,
            duration_seconds=duration,
            completed_by=completed_by,
            completed_at=cleanup.completed_time or datetime.utcnow()
        )

        db.add(summary)
        cleanup.summary = summary
        db.flush()
        return summary
