from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from models import (
    TenantKey, KeyReference, OperationLog, EscrowReport,
    KeyStatus, KeyPurpose, OperationType
)
import uuid


class KeyEscrowService:
    def __init__(self, db: Session):
        self.db = db

    def _generate_key_version(self, tenant_id: str, purpose: str) -> str:
        purpose_short = purpose[:3].upper()
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        return f"{tenant_id}-{purpose_short}-{timestamp}-v1"

    def _log_operation(
        self,
        operation_type: OperationType,
        tenant_id: str,
        key_id: Optional[int],
        key_version: Optional[str],
        raw_input: dict,
        processing_rules: dict,
        success: bool,
        conclusion: str,
        error_message: Optional[str],
        operator: str
    ) -> OperationLog:
        log = OperationLog(
            operation_type=operation_type.value,
            tenant_id=tenant_id,
            key_id=key_id,
            key_version=key_version,
            raw_input=raw_input,
            processing_rules=processing_rules,
            success=success,
            conclusion=conclusion,
            error_message=error_message,
            operator=operator
        )
        self.db.add(log)
        self.db.flush()
        return log

    def create_key(
        self,
        tenant_id: str,
        purpose: KeyPurpose,
        encryption_material: str,
        metadata: Optional[dict],
        operator: str
    ) -> Tuple[Optional[TenantKey], Optional[OperationLog]]:
        raw_input = {
            "tenant_id": tenant_id,
            "purpose": purpose.value,
            "encryption_material": encryption_material,
            "metadata": metadata,
            "operator": operator
        }
        processing_rules = {
            "version_generation": "tenant-purpose-timestamp-version",
            "initial_status": KeyStatus.PENDING.value,
            "approval_required": True,
            "uniqueness_check": "tenant_id + purpose + status=active"
        }

        try:
            existing_active = self.db.query(TenantKey).filter(
                TenantKey.tenant_id == tenant_id,
                TenantKey.purpose == purpose.value,
                TenantKey.status.in_([KeyStatus.ACTIVE.value, KeyStatus.PENDING.value])
            ).first()

            if existing_active:
                conclusion = f"密钥创建失败：租户 {tenant_id} 已有目的为 {purpose.value} 的活跃或待审批密钥"
                log = self._log_operation(
                    OperationType.CREATE, tenant_id, existing_active.id,
                    existing_active.key_version, raw_input, processing_rules,
                    False, conclusion, conclusion, operator
                )
                return None, log

            key_version = self._generate_key_version(tenant_id, purpose.value)

            key = TenantKey(
                tenant_id=tenant_id,
                key_version=key_version,
                purpose=purpose.value,
                status=KeyStatus.PENDING.value,
                encryption_material=encryption_material,
                metadata_=metadata or {}
            )
            self.db.add(key)
            self.db.flush()

            conclusion = f"密钥创建成功：版本 {key_version}，状态 PENDING，待审批"
            log = self._log_operation(
                OperationType.CREATE, tenant_id, key.id, key_version,
                raw_input, processing_rules, True, conclusion, None, operator
            )

            return key, log

        except Exception as e:
            error_msg = f"密钥创建异常: {str(e)}"
            log = self._log_operation(
                OperationType.CREATE, tenant_id, None, None,
                raw_input, processing_rules, False, error_msg, str(e), operator
            )
            raise

    def query_keys(
        self,
        tenant_id: Optional[str] = None,
        purpose: Optional[KeyPurpose] = None,
        status: Optional[KeyStatus] = None,
        key_version: Optional[str] = None
    ) -> List[TenantKey]:
        query = self.db.query(TenantKey)

        if tenant_id:
            query = query.filter(TenantKey.tenant_id == tenant_id)
        if purpose:
            query = query.filter(TenantKey.purpose == purpose.value)
        if status:
            query = query.filter(TenantKey.status == status.value)
        if key_version:
            query = query.filter(TenantKey.key_version == key_version)

        keys = query.order_by(TenantKey.created_at.desc()).all()
        for key in keys:
            key.reference_count = self.db.query(KeyReference).filter(
                KeyReference.key_id == key.id
            ).count()

        return keys

    def record_reference(
        self,
        tenant_id: str,
        key_version: str,
        data_batch_id: str,
        purpose: Optional[str],
        metadata: Optional[dict],
        operator: str
    ) -> Tuple[Optional[KeyReference], Optional[OperationLog]]:
        raw_input = {
            "tenant_id": tenant_id,
            "key_version": key_version,
            "data_batch_id": data_batch_id,
            "purpose": purpose,
            "metadata": metadata,
            "operator": operator
        }
        processing_rules = {
            "key_validation": "must be active status",
            "reference_tracking": "data_batch_id + key_version unique",
            "count_increment": "existing reference count++"
        }

        try:
            key = self.db.query(TenantKey).filter(
                TenantKey.tenant_id == tenant_id,
                TenantKey.key_version == key_version
            ).first()

            if not key:
                conclusion = f"引用失败：密钥版本 {key_version} 不存在"
                log = self._log_operation(
                    OperationType.REFERENCE, tenant_id, None, key_version,
                    raw_input, processing_rules, False, conclusion, conclusion, operator
                )
                return None, log

            if key.status != KeyStatus.ACTIVE.value:
                conclusion = f"引用失败：密钥版本 {key_version} 状态为 {key.status}，非 ACTIVE 状态"
                log = self._log_operation(
                    OperationType.REFERENCE, tenant_id, key.id, key_version,
                    raw_input, processing_rules, False, conclusion, conclusion, operator
                )
                return None, log

            existing_ref = self.db.query(KeyReference).filter(
                KeyReference.key_id == key.id,
                KeyReference.data_batch_id == data_batch_id
            ).first()

            if existing_ref:
                existing_ref.reference_count += 1
                conclusion = f"引用计数更新：批次 {data_batch_id}，当前计数 {existing_ref.reference_count}"
                log = self._log_operation(
                    OperationType.REFERENCE, tenant_id, key.id, key_version,
                    raw_input, processing_rules, True, conclusion, None, operator
                )
                return existing_ref, log

            ref = KeyReference(
                key_id=key.id,
                tenant_id=tenant_id,
                key_version=key_version,
                data_batch_id=data_batch_id,
                purpose=purpose,
                metadata_=metadata or {}
            )
            self.db.add(ref)
            self.db.flush()

            conclusion = f"引用记录创建成功：批次 {data_batch_id} 关联密钥 {key_version}"
            log = self._log_operation(
                OperationType.REFERENCE, tenant_id, key.id, key_version,
                raw_input, processing_rules, True, conclusion, None, operator
            )

            return ref, log

        except Exception as e:
            error_msg = f"引用记录异常: {str(e)}"
            log = self._log_operation(
                OperationType.REFERENCE, tenant_id, None, key_version,
                raw_input, processing_rules, False, error_msg, str(e), operator
            )
            raise

    def advance_status(
        self,
        tenant_id: str,
        key_version: str,
        target_status: KeyStatus,
        approved_by: Optional[str],
        operator: str,
        reason: Optional[str]
    ) -> Tuple[Optional[TenantKey], Optional[OperationLog]]:
        raw_input = {
            "tenant_id": tenant_id,
            "key_version": key_version,
            "target_status": target_status.value,
            "approved_by": approved_by,
            "operator": operator,
            "reason": reason
        }

        valid_transitions = {
            KeyStatus.PENDING: [KeyStatus.ACTIVE, KeyStatus.DEACTIVATED],
            KeyStatus.ACTIVE: [KeyStatus.ROTATING, KeyStatus.DEPRECATED, KeyStatus.DEACTIVATED],
            KeyStatus.ROTATING: [KeyStatus.ACTIVE, KeyStatus.DEPRECATED, KeyStatus.DEACTIVATED],
            KeyStatus.DEPRECATED: [KeyStatus.DEACTIVATED],
            KeyStatus.DEACTIVATED: []
        }

        processing_rules = {
            "valid_transitions": {k.value: [v.value for v in vs] for k, vs in valid_transitions.items()},
            "approval_requirement": "PENDING->ACTIVE requires approval",
            "deactivation_protection": "active keys with references require confirmation"
        }

        try:
            key = self.db.query(TenantKey).filter(
                TenantKey.tenant_id == tenant_id,
                TenantKey.key_version == key_version
            ).first()

            if not key:
                conclusion = f"状态推进失败：密钥版本 {key_version} 不存在"
                log = self._log_operation(
                    OperationType.ROTATE, tenant_id, None, key_version,
                    raw_input, processing_rules, False, conclusion, conclusion, operator
                )
                return None, log

            current_status = KeyStatus(key.status)
            valid_targets = valid_transitions.get(current_status, [])

            if target_status not in valid_targets:
                conclusion = f"状态推进失败：从 {current_status.value} 到 {target_status.value} 不是有效状态转换"
                log = self._log_operation(
                    OperationType.ROTATE, tenant_id, key.id, key_version,
                    raw_input, processing_rules, False, conclusion, conclusion, operator
                )
                return None, log

            if current_status == KeyStatus.PENDING and target_status == KeyStatus.ACTIVE:
                if not approved_by:
                    conclusion = "状态推进失败：PENDING->ACTIVE 需要审批人信息"
                    log = self._log_operation(
                        OperationType.ROTATE, tenant_id, key.id, key_version,
                        raw_input, processing_rules, False, conclusion, conclusion, operator
                    )
                    return None, log
                key.approved_by = approved_by
                key.approved_at = datetime.utcnow()

            if target_status == KeyStatus.DEACTIVATED and key.is_protected:
                ref_count = self.db.query(KeyReference).filter(KeyReference.key_id == key.id).count()
                if ref_count > 0 and not reason:
                    conclusion = f"停用保护触发：该密钥有 {ref_count} 个引用记录，需提供停用理由"
                    log = self._log_operation(
                        OperationType.DEACTIVATE, tenant_id, key.id, key_version,
                        raw_input, processing_rules, False, conclusion, conclusion, operator
                    )
                    return None, log

            key.status = target_status.value

            if target_status == KeyStatus.ACTIVE:
                key.activated_at = datetime.utcnow()
            elif target_status == KeyStatus.DEPRECATED:
                key.deprecated_at = datetime.utcnow()
            elif target_status == KeyStatus.DEACTIVATED:
                key.deactivated_at = datetime.utcnow()

            self.db.flush()

            conclusion = f"状态推进成功：{current_status.value} -> {target_status.value}"
            op_type = OperationType.DEACTIVATE if target_status == KeyStatus.DEACTIVATED else OperationType.ROTATE
            log = self._log_operation(
                op_type, tenant_id, key.id, key_version,
                raw_input, processing_rules, True, conclusion, None, operator
            )

            return key, log

        except Exception as e:
            error_msg = f"状态推进异常: {str(e)}"
            log = self._log_operation(
                OperationType.ROTATE, tenant_id, None, key_version,
                raw_input, processing_rules, False, error_msg, str(e), operator
            )
            raise

    def manual_correction(
        self,
        tenant_id: str,
        key_version: str,
        field_updates: dict,
        operator: str,
        reason: str
    ) -> Tuple[Optional[TenantKey], Optional[OperationLog]]:
        raw_input = {
            "tenant_id": tenant_id,
            "key_version": key_version,
            "field_updates": field_updates,
            "operator": operator,
            "reason": reason
        }

        allowed_fields = {"encryption_material", "is_protected", "metadata", "purpose"}
        processing_rules = {
            "allowed_fields": list(allowed_fields),
            "audit_requirement": "all changes logged with reason",
            "recalculation_trigger": "reference count recalculation on demand"
        }

        try:
            invalid_fields = set(field_updates.keys()) - allowed_fields
            if invalid_fields:
                conclusion = f"人工修正失败：不允许修改字段 {invalid_fields}"
                log = self._log_operation(
                    OperationType.MANUAL_CORRECT, tenant_id, None, key_version,
                    raw_input, processing_rules, False, conclusion, conclusion, operator
                )
                return None, log

            key = self.db.query(TenantKey).filter(
                TenantKey.tenant_id == tenant_id,
                TenantKey.key_version == key_version
            ).first()

            if not key:
                conclusion = f"人工修正失败：密钥版本 {key_version} 不存在"
                log = self._log_operation(
                    OperationType.MANUAL_CORRECT, tenant_id, None, key_version,
                    raw_input, processing_rules, False, conclusion, conclusion, operator
                )
                return None, log

            for field, value in field_updates.items():
                if field == "metadata":
                    key.metadata_ = value
                elif field == "purpose":
                    key.purpose = value
                else:
                    setattr(key, field, value)

            self.db.flush()

            conclusion = f"人工修正成功：已更新字段 {list(field_updates.keys())}"
            log = self._log_operation(
                OperationType.MANUAL_CORRECT, tenant_id, key.id, key_version,
                raw_input, processing_rules, True, conclusion, None, operator
            )

            return key, log

        except Exception as e:
            error_msg = f"人工修正异常: {str(e)}"
            log = self._log_operation(
                OperationType.MANUAL_CORRECT, tenant_id, None, key_version,
                raw_input, processing_rules, False, error_msg, error_msg, operator
            )
            raise

    def export_report(
        self,
        tenant_id: str,
        report_type: str,
        period_start: Optional[datetime],
        period_end: Optional[datetime],
        operator: str
    ) -> Tuple[EscrowReport, dict]:
        report_id = f"RPT-{uuid.uuid4().hex[:8].upper()}"

        if not period_end:
            period_end = datetime.utcnow()
        if not period_start:
            period_start = datetime(2020, 1, 1)

        keys = self.db.query(TenantKey).filter(
            TenantKey.tenant_id == tenant_id,
            TenantKey.created_at >= period_start,
            TenantKey.created_at <= period_end
        ).all()

        references = self.db.query(KeyReference).filter(
            KeyReference.tenant_id == tenant_id,
            KeyReference.referenced_at >= period_start,
            KeyReference.referenced_at <= period_end
        ).all()

        operation_logs = self.db.query(OperationLog).filter(
            OperationLog.tenant_id == tenant_id,
            OperationLog.operated_at >= period_start,
            OperationLog.operated_at <= period_end
        ).all()

        key_summary = {}
        for key in keys:
            key_refs = [r for r in references if r.key_id == key.id]
            key_summary[key.key_version] = {
                "purpose": key.purpose,
                "status": key.status,
                "created_at": key.created_at.isoformat(),
                "approved_by": key.approved_by,
                "reference_count": len(key_refs),
                "data_batches": [r.data_batch_id for r in key_refs],
                "rotation_batch_id": key.rotation_batch_id
            }

        operation_summary = {
            "total_operations": len(operation_logs),
            "success_count": sum(1 for l in operation_logs if l.success),
            "failed_count": sum(1 for l in operation_logs if not l.success),
            "operations_by_type": {}
        }

        for log in operation_logs:
            op_type = log.operation_type
            if op_type not in operation_summary["operations_by_type"]:
                operation_summary["operations_by_type"][op_type] = 0
            operation_summary["operations_by_type"][op_type] += 1

        report_content = {
            "report_id": report_id,
            "tenant_id": tenant_id,
            "report_type": report_type,
            "period": {
                "start": period_start.isoformat(),
                "end": period_end.isoformat()
            },
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": operator,
            "key_summary": key_summary,
            "operation_summary": operation_summary,
            "conclusions": {
                "total_keys": len(keys),
                "active_keys": sum(1 for k in keys if k.status == KeyStatus.ACTIVE.value),
                "total_references": len(references),
                "unique_data_batches": len({r.data_batch_id for r in references})
            }
        }

        report = EscrowReport(
            report_id=report_id,
            tenant_id=tenant_id,
            report_type=report_type,
            generated_by=operator,
            content=report_content,
            period_start=period_start,
            period_end=period_end
        )
        self.db.add(report)
        self.db.flush()

        return report, report_content

    def get_operation_logs(self, tenant_id: str, limit: int = 100) -> List[OperationLog]:
        return self.db.query(OperationLog).filter(
            OperationLog.tenant_id == tenant_id
        ).order_by(OperationLog.operated_at.desc()).limit(limit).all()

    def get_key_references(self, tenant_id: str, key_version: Optional[str] = None) -> List[KeyReference]:
        query = self.db.query(KeyReference).filter(KeyReference.tenant_id == tenant_id)
        if key_version:
            query = query.filter(KeyReference.key_version == key_version)
        return query.order_by(KeyReference.referenced_at.desc()).all()
