from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from ..storage import Database
from ..models import (
    CallLog,
    PermissionChange,
    EvidenceChain,
    EvidenceNode,
    RecordStatus,
    ProcessingResult,
)
from ..utils import PermissionNotFoundError
from .idempotency_service import IdempotencyService


class PermissionReviewService:
    VALID_PERMISSIONS = {
        "can_view_dashboard",
        "can_edit_users",
        "can_export_data",
        "can_manage_roles",
        "can_access_reports",
        "can_modify_settings",
    }

    def __init__(self, db: Database, idempotency_service: IdempotencyService):
        self.db = db
        self.idempotency = idempotency_service

    def process_permission_change(
        self,
        call_log: CallLog,
        batch_id: Optional[str] = None,
    ) -> ProcessingResult:
        result = ProcessingResult(
            success=False,
            message="处理中",
            details={"log_id": call_log.log_id, "batch_id": batch_id},
        )

        change = self._extract_permission_change(call_log)
        if not change:
            result.message = "无法从调用日志提取权限变更信息"
            result.details["error"] = "invalid_request_format"
            self._save_failed_change(change, result.message)
            return result

        is_duplicate, existing = self.idempotency.check_duplicate(call_log, raise_on_duplicate=False)
        if is_duplicate:
            chain = self.idempotency.build_duplicate_evidence_chain(call_log, existing)
            change.status = RecordStatus.DUPLICATE
            change.failure_reason = "检测到重复记录，幂等键已存在"
            self.db.save_permission_change(change)
            result.success = True
            result.message = "重复记录已识别，跳过处理"
            result.details["status"] = "duplicate"
            result.add_evidence(
                "evidence_chain",
                chain.chain_id,
                "重复检测证据链已保存",
            )
            return result

        if not self._is_permission_valid(change.permission_code):
            change.status = RecordStatus.FAILED
            change.failure_reason = f"权限编码 {change.permission_code} 不存在"
            self.db.save_permission_change(change)
            self._build_not_found_chain(call_log, change)
            result.message = f"权限项 {change.permission_code} 不存在"
            result.details["error"] = "permission_not_found"
            return result

        change.status = RecordStatus.SUCCESS
        self.db.save_permission_change(change)
        self._build_success_chain(call_log, change)

        result.success = True
        result.message = "权限变更处理成功"
        result.details.update({
            "status": "success",
            "change_id": change.change_id,
            "permission_code": change.permission_code,
            "new_value": change.new_value,
        })
        result.add_evidence(
            "permission_change",
            change.change_id,
            "权限变更记录",
        )
        return result

    def _extract_permission_change(self, log: CallLog) -> Optional[PermissionChange]:
        try:
            body = log.request_body
            return PermissionChange(
                tenant_id=log.tenant_id,
                user_id=body.get("user_id", log.user_id),
                permission_code=body.get("permission_code"),
                change_type=body.get("change_type", "grant"),
                source_log_id=log.log_id,
                timestamp=log.timestamp,
                old_value=body.get("old_value"),
                new_value=body.get("new_value", True),
                metadata={"batch_id": body.get("batch_id")},
            )
        except Exception:
            return None

    def _is_permission_valid(self, permission_code: str) -> bool:
        return permission_code in self.VALID_PERMISSIONS

    def _save_failed_change(self, change: Optional[PermissionChange], reason: str):
        if change:
            change.status = RecordStatus.FAILED
            change.failure_reason = reason
            self.db.save_permission_change(change)

    def _build_success_chain(self, log: CallLog, change: PermissionChange):
        chain = EvidenceChain(root_record_id=log.log_id)

        chain.add_node(EvidenceNode(
            node_id=str(uuid4()),
            node_type="CALL_RECEIVED",
            timestamp=log.timestamp,
            description=f"接收到权限变更调用",
            data_reference=f"call_log:{log.log_id}",
            metadata={"action": log.action, "source": log.source_system},
        ))

        chain.add_node(EvidenceNode(
            node_id=str(uuid4()),
            node_type="PERMISSION_VALIDATED",
            timestamp=datetime.now(),
            description=f"权限编码 {change.permission_code} 验证通过",
            data_reference=f"permission:{change.permission_code}",
            metadata={"permission_code": change.permission_code},
        ))

        chain.add_node(EvidenceNode(
            node_id=str(uuid4()),
            node_type="CHANGE_APPLIED",
            timestamp=datetime.now(),
            description=f"权限变更已生效",
            data_reference=f"permission_change:{change.change_id}",
            metadata={
                "change_id": change.change_id,
                "old_value": change.old_value,
                "new_value": change.new_value,
            },
        ))

        self.db.save_evidence_chain(chain)

    def _build_not_found_chain(self, log: CallLog, change: PermissionChange):
        chain = EvidenceChain(root_record_id=log.log_id)

        chain.add_node(EvidenceNode(
            node_id=str(uuid4()),
            node_type="CALL_RECEIVED",
            timestamp=log.timestamp,
            description=f"接收到权限变更调用",
            data_reference=f"call_log:{log.log_id}",
            metadata={},
        ))

        chain.add_node(EvidenceNode(
            node_id=str(uuid4()),
            node_type="VALIDATION_FAILED",
            timestamp=datetime.now(),
            description=f"权限编码不存在",
            data_reference=f"permission:{change.permission_code}",
            metadata={"permission_code": change.permission_code},
        ))

        self.db.save_evidence_chain(chain)

    def get_evidence_timeline(self, log_id: str) -> Optional[dict]:
        chain = self.db.get_evidence_chain(log_id)
        if not chain:
            return None
        return chain.to_dict()
