from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
import json

from pharmacy_expiry_tracker.models.orm import ExpiryRecord, ChangeLog, RecordRevision
from pharmacy_expiry_tracker.models.enums import (
    RecordStatus,
    ChangeType,
    UserRole,
    LiabilityResult
)
from pharmacy_expiry_tracker.utils.exceptions import (
    InvalidStateException,
    PermissionDeniedException,
    NotFoundException
)
from pharmacy_expiry_tracker.utils.helpers import serialize_for_audit


class WorkflowService:
    def __init__(self, db: Session):
        self.db = db

    VALID_TRANSITIONS: Dict[RecordStatus, list] = {
        RecordStatus.DRAFT: [
            RecordStatus.SUBMITTED,
            RecordStatus.ARCHIVED
        ],
        RecordStatus.SUBMITTED: [
            RecordStatus.REJECTED,
            RecordStatus.CONFIRMED,
            RecordStatus.DRAFT
        ],
        RecordStatus.REJECTED: [
            RecordStatus.DRAFT,
            RecordStatus.SUBMITTED,
            RecordStatus.CONFIRMED
        ],
        RecordStatus.CONFIRMED: [
            RecordStatus.FROZEN,
            RecordStatus.REJECTED
        ],
        RecordStatus.FROZEN: [
            RecordStatus.CONFIRMED
        ],
        RecordStatus.ARCHIVED: []
    }

    ROLE_PERMISSIONS: Dict[ChangeType, list] = {
        ChangeType.CREATE: [
            UserRole.PHARMACY_MANAGER,
            UserRole.TOWN_SUPERVISOR,
            UserRole.ADMIN
        ],
        ChangeType.SUBMIT: [
            UserRole.PHARMACY_MANAGER,
            UserRole.TOWN_SUPERVISOR
        ],
        ChangeType.REJECT: [
            UserRole.TOWN_SUPERVISOR,
            UserRole.REGIONAL_SUPERVISOR
        ],
        ChangeType.CONFIRM: [
            UserRole.TOWN_SUPERVISOR,
            UserRole.REGIONAL_SUPERVISOR
        ],
        ChangeType.MODIFY: [
            UserRole.PHARMACY_MANAGER,
            UserRole.TOWN_SUPERVISOR
        ],
        ChangeType.REVISE: [
            UserRole.REGIONAL_SUPERVISOR,
            UserRole.ADMIN
        ],
        ChangeType.FREEZE: [
            UserRole.REGIONAL_SUPERVISOR,
            UserRole.AUDITOR,
            UserRole.ADMIN
        ],
        ChangeType.WITHDRAW: [
            UserRole.PHARMACY_MANAGER,
            UserRole.TOWN_SUPERVISOR
        ],
        ChangeType.EXPORT: [
            UserRole.TOWN_SUPERVISOR,
            UserRole.REGIONAL_SUPERVISOR,
            UserRole.AUDITOR,
            UserRole.ADMIN
        ]
    }

    def _check_permission(self, action: ChangeType, user_role: UserRole) -> bool:
        allowed_roles = self.ROLE_PERMISSIONS.get(action, [])
        return user_role in allowed_roles or user_role == UserRole.ADMIN

    def _validate_transition(self, current_status: RecordStatus, target_status: RecordStatus) -> bool:
        valid_targets = self.VALID_TRANSITIONS.get(current_status, [])
        return target_status in valid_targets

    def _create_change_log(
        self,
        record_id: int,
        change_type: ChangeType,
        old_status: Optional[str],
        new_status: Optional[str],
        old_values: Optional[Dict[str, Any]],
        new_values: Optional[Dict[str, Any]],
        change_reason: str,
        changed_by: str,
        user_role: str,
        ip_address: Optional[str] = None
    ) -> ChangeLog:
        change_log = ChangeLog(
            expiry_record_id=record_id,
            change_type=change_type.value,
            old_status=old_status.value if old_status else None,
            new_status=new_status.value if new_status else None,
            old_values=json.dumps(old_values, ensure_ascii=False) if old_values else None,
            new_values=json.dumps(new_values, ensure_ascii=False) if new_values else None,
            change_reason=change_reason,
            changed_by=changed_by,
            user_role=user_role,
            ip_address=ip_address
        )
        self.db.add(change_log)
        return change_log

    def _create_revision(
        self,
        record: ExpiryRecord,
        change_reason: str,
        created_by: str
    ) -> RecordRevision:
        revision = RecordRevision(
            expiry_record_id=record.id,
            version=record.current_version,
            snapshot_data=serialize_for_audit(record),
            change_reason=change_reason,
            created_by=created_by
        )
        self.db.add(revision)
        return revision

    def submit_record(
        self,
        record_id: int,
        operator: str,
        operator_role: str,
        change_reason: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> ExpiryRecord:
        record = self.db.query(ExpiryRecord).filter(ExpiryRecord.id == record_id).first()
        if not record:
            raise NotFoundException(f"记录 {record_id} 不存在")

        user_role = UserRole(operator_role)
        if not self._check_permission(ChangeType.SUBMIT, user_role):
            raise PermissionDeniedException(f"角色 {operator_role} 无提交权限")

        current_status = RecordStatus(record.status)
        target_status = RecordStatus.SUBMITTED

        if not self._validate_transition(current_status, target_status):
            raise InvalidStateException(
                f"无法从状态 {current_status.value} 提交到 {target_status.value}"
            )

        old_status = current_status
        record.status = target_status.value
        record.updated_by = operator
        record.change_reason = change_reason or "提交审核"
        record.current_version += 1

        self._create_revision(record, change_reason or "提交审核", operator)
        self._create_change_log(
            record_id=record_id,
            change_type=ChangeType.SUBMIT,
            old_status=old_status,
            new_status=target_status,
            old_values={"status": old_status.value},
            new_values={"status": target_status.value},
            change_reason=change_reason or "提交审核",
            changed_by=operator,
            user_role=operator_role,
            ip_address=ip_address
        )

        self.db.commit()
        self.db.refresh(record)
        return record

    def reject_record(
        self,
        record_id: int,
        operator: str,
        operator_role: str,
        change_reason: str,
        ip_address: Optional[str] = None
    ) -> ExpiryRecord:
        record = self.db.query(ExpiryRecord).filter(ExpiryRecord.id == record_id).first()
        if not record:
            raise NotFoundException(f"记录 {record_id} 不存在")

        user_role = UserRole(operator_role)
        if not self._check_permission(ChangeType.REJECT, user_role):
            raise PermissionDeniedException(f"角色 {operator_role} 无驳回权限")

        if not change_reason:
            raise InvalidStateException("驳回必须填写原因")

        current_status = RecordStatus(record.status)
        target_status = RecordStatus.REJECTED

        if not self._validate_transition(current_status, target_status):
            raise InvalidStateException(
                f"无法从状态 {current_status.value} 驳回"
            )

        old_status = current_status
        record.status = target_status.value
        record.updated_by = operator
        record.change_reason = change_reason
        record.current_version += 1

        self._create_revision(record, change_reason, operator)
        self._create_change_log(
            record_id=record_id,
            change_type=ChangeType.REJECT,
            old_status=old_status,
            new_status=target_status,
            old_values={"status": old_status.value},
            new_values={"status": target_status.value},
            change_reason=change_reason,
            changed_by=operator,
            user_role=operator_role,
            ip_address=ip_address
        )

        self.db.commit()
        self.db.refresh(record)
        return record

    def confirm_record(
        self,
        record_id: int,
        operator: str,
        operator_role: str,
        change_reason: Optional[str] = None,
        ip_address: Optional[str] = None,
        is_second_confirmation: bool = False
    ) -> ExpiryRecord:
        record = self.db.query(ExpiryRecord).filter(ExpiryRecord.id == record_id).first()
        if not record:
            raise NotFoundException(f"记录 {record_id} 不存在")

        user_role = UserRole(operator_role)
        if not self._check_permission(ChangeType.CONFIRM, user_role):
            raise PermissionDeniedException(f"角色 {operator_role} 无确认权限")

        current_status = RecordStatus(record.status)
        target_status = RecordStatus.CONFIRMED

        if not self._validate_transition(current_status, target_status):
            raise InvalidStateException(
                f"无法从状态 {current_status.value} 确认"
            )

        if is_second_confirmation and current_status != RecordStatus.REJECTED:
            raise InvalidStateException("二次确认仅适用于已驳回状态的记录")

        old_status = current_status
        record.status = target_status.value
        record.updated_by = operator
        record.change_reason = change_reason or ("二次确认通过" if is_second_confirmation else "审核通过")
        record.current_version += 1

        self._create_revision(record, record.change_reason, operator)
        self._create_change_log(
            record_id=record_id,
            change_type=ChangeType.CONFIRM,
            old_status=old_status,
            new_status=target_status,
            old_values={"status": old_status.value},
            new_values={"status": target_status.value},
            change_reason=record.change_reason,
            changed_by=operator,
            user_role=operator_role,
            ip_address=ip_address
        )

        self.db.commit()
        self.db.refresh(record)
        return record

    def withdraw_record(
        self,
        record_id: int,
        operator: str,
        operator_role: str,
        change_reason: str,
        ip_address: Optional[str] = None
    ) -> ExpiryRecord:
        record = self.db.query(ExpiryRecord).filter(ExpiryRecord.id == record_id).first()
        if not record:
            raise NotFoundException(f"记录 {record_id} 不存在")

        user_role = UserRole(operator_role)
        if not self._check_permission(ChangeType.WITHDRAW, user_role):
            raise PermissionDeniedException(f"角色 {operator_role} 无撤回权限")

        current_status = RecordStatus(record.status)
        target_status = RecordStatus.DRAFT

        if current_status not in [RecordStatus.SUBMITTED, RecordStatus.REJECTED]:
            raise InvalidStateException(
                f"无法从状态 {current_status.value} 撤回，仅已提交或已驳回状态可撤回"
            )

        old_status = current_status
        record.status = target_status.value
        record.updated_by = operator
        record.change_reason = change_reason
        record.current_version += 1

        self._create_revision(record, change_reason, operator)
        self._create_change_log(
            record_id=record_id,
            change_type=ChangeType.WITHDRAW,
            old_status=old_status,
            new_status=target_status,
            old_values={"status": old_status.value},
            new_values={"status": target_status.value},
            change_reason=change_reason,
            changed_by=operator,
            user_role=operator_role,
            ip_address=ip_address
        )

        self.db.commit()
        self.db.refresh(record)
        return record

    def freeze_record(
        self,
        record_id: int,
        operator: str,
        operator_role: str,
        change_reason: str,
        ip_address: Optional[str] = None
    ) -> ExpiryRecord:
        record = self.db.query(ExpiryRecord).filter(ExpiryRecord.id == record_id).first()
        if not record:
            raise NotFoundException(f"记录 {record_id} 不存在")

        user_role = UserRole(operator_role)
        if not self._check_permission(ChangeType.FREEZE, user_role):
            raise PermissionDeniedException(f"角色 {operator_role} 无冻结权限")

        current_status = RecordStatus(record.status)

        if current_status != RecordStatus.CONFIRMED:
            raise InvalidStateException(
                f"无法冻结状态 {current_status.value} 的记录，仅已确认状态可冻结"
            )

        if record.is_frozen:
            raise InvalidStateException("记录已处于冻结状态")

        old_status = current_status
        target_status = RecordStatus.FROZEN
        record.status = target_status.value
        record.is_frozen = True
        record.frozen_at = datetime.now()
        record.frozen_by = operator
        record.updated_by = operator
        record.change_reason = change_reason
        record.current_version += 1

        self._create_revision(record, change_reason, operator)
        self._create_change_log(
            record_id=record_id,
            change_type=ChangeType.FREEZE,
            old_status=old_status,
            new_status=target_status,
            old_values={"status": old_status.value, "is_frozen": False},
            new_values={"status": target_status.value, "is_frozen": True},
            change_reason=change_reason,
            changed_by=operator,
            user_role=operator_role,
            ip_address=ip_address
        )

        self.db.commit()
        self.db.refresh(record)
        return record

    def unfreeze_record(
        self,
        record_id: int,
        operator: str,
        operator_role: str,
        change_reason: str,
        ip_address: Optional[str] = None
    ) -> ExpiryRecord:
        record = self.db.query(ExpiryRecord).filter(ExpiryRecord.id == record_id).first()
        if not record:
            raise NotFoundException(f"记录 {record_id} 不存在")

        user_role = UserRole(operator_role)
        if not self._check_permission(ChangeType.FREEZE, user_role):
            raise PermissionDeniedException(f"角色 {operator_role} 无解冻权限")

        current_status = RecordStatus(record.status)

        if current_status != RecordStatus.FROZEN:
            raise InvalidStateException(
                f"无法解冻状态 {current_status.value} 的记录，仅冻结状态可解冻"
            )

        old_status = current_status
        target_status = RecordStatus.CONFIRMED
        record.status = target_status.value
        record.is_frozen = False
        record.updated_by = operator
        record.change_reason = change_reason
        record.current_version += 1

        self._create_revision(record, change_reason, operator)
        self._create_change_log(
            record_id=record_id,
            change_type=ChangeType.UNFREEZE,
            old_status=old_status,
            new_status=target_status,
            old_values={"status": old_status.value, "is_frozen": True},
            new_values={"status": target_status.value, "is_frozen": False},
            change_reason=change_reason,
            changed_by=operator,
            user_role=operator_role,
            ip_address=ip_address
        )

        self.db.commit()
        self.db.refresh(record)
        return record

    def revise_liability(
        self,
        record_id: int,
        new_result: LiabilityResult,
        new_amount: float,
        operator: str,
        operator_role: str,
        change_reason: str,
        ip_address: Optional[str] = None
    ) -> ExpiryRecord:
        record = self.db.query(ExpiryRecord).filter(ExpiryRecord.id == record_id).first()
        if not record:
            raise NotFoundException(f"记录 {record_id} 不存在")

        user_role = UserRole(operator_role)
        if not self._check_permission(ChangeType.REVISE, user_role):
            raise PermissionDeniedException(f"角色 {operator_role} 无改判权限")

        if record.is_frozen:
            raise InvalidStateException("冻结状态的记录无法改判")

        old_values = {
            "liability_result": record.liability_result,
            "liability_amount": record.liability_amount
        }

        record.liability_result = new_result.value
        record.liability_amount = new_amount
        record.updated_by = operator
        record.change_reason = change_reason
        record.current_version += 1

        new_values = {
            "liability_result": new_result.value,
            "liability_amount": new_amount
        }

        self._create_revision(record, change_reason, operator)
        self._create_change_log(
            record_id=record_id,
            change_type=ChangeType.REVISE,
            old_status=RecordStatus(record.status),
            new_status=RecordStatus(record.status),
            old_values=old_values,
            new_values=new_values,
            change_reason=change_reason,
            changed_by=operator,
            user_role=operator_role,
            ip_address=ip_address
        )

        self.db.commit()
        self.db.refresh(record)
        return record

    def get_change_logs(self, record_id: int) -> list:
        return self.db.query(ChangeLog).filter(
            ChangeLog.expiry_record_id == record_id
        ).order_by(ChangeLog.changed_at.desc()).all()

    def get_revisions(self, record_id: int) -> list:
        return self.db.query(RecordRevision).filter(
            RecordRevision.expiry_record_id == record_id
        ).order_by(RecordRevision.version.desc()).all()
