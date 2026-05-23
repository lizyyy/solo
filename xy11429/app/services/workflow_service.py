import json
import copy
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from ..models import (
    VisitorLedger, WorkflowLog, VersionHistory, LedgerStatus,
    PermissionResult, User, UserRole, SupplementRecord, OriginalEvidence,
    DataSource
)


class WorkflowService:
    def __init__(self, db: Session):
        self.db = db

    def _get_ledger_state(self, ledger: VisitorLedger) -> Dict[str, Any]:
        return {
            'id': ledger.id,
            'ledger_no': ledger.ledger_no,
            'visitor_name': ledger.visitor_name,
            'visitor_phone': ledger.visitor_phone,
            'visitor_id_card': ledger.visitor_id_card,
            'visit_purpose': ledger.visit_purpose,
            'visited_person': ledger.visited_person,
            'visited_department': ledger.visited_department,
            'temp_plate_number': ledger.temp_plate_number,
            'appointment_start_time': ledger.appointment_start_time.isoformat() if ledger.appointment_start_time else None,
            'appointment_end_time': ledger.appointment_end_time.isoformat() if ledger.appointment_end_time else None,
            'actual_entry_time': ledger.actual_entry_time.isoformat() if ledger.actual_entry_time else None,
            'actual_exit_time': ledger.actual_exit_time.isoformat() if ledger.actual_exit_time else None,
            'permission_granted_time': ledger.permission_granted_time.isoformat() if ledger.permission_granted_time else None,
            'permission_revoked_time': ledger.permission_revoked_time.isoformat() if ledger.permission_revoked_time else None,
            'is_cross_day': ledger.is_cross_day,
            'permission_result': ledger.permission_result.value if ledger.permission_result else None,
            'status': ledger.status.value if ledger.status else None,
            'is_manual_judgment': ledger.is_manual_judgment,
            'judgment_reason': ledger.judgment_reason,
        }

    def _calculate_diff(self, prev_state: Dict[str, Any], curr_state: Dict[str, Any]) -> Dict[str, Any]:
        diff = {}
        all_keys = set(prev_state.keys()) | set(curr_state.keys())

        for key in all_keys:
            prev_val = prev_state.get(key)
            curr_val = curr_state.get(key)
            if prev_val != curr_val:
                diff[key] = {
                    'previous': prev_val,
                    'current': curr_val
                }

        return diff

    def _create_version_history(
        self,
        ledger: VisitorLedger,
        action_type: str,
        previous_state: Optional[Dict[str, Any]],
        operator: User,
        change_reason: Optional[str] = None
    ) -> VersionHistory:
        current_state = self._get_ledger_state(ledger)
        diff_summary = self._calculate_diff(previous_state or {}, current_state) if previous_state else {}

        max_version = self.db.query(VersionHistory).filter(
            VersionHistory.ledger_id == ledger.id
        ).count()

        version = VersionHistory(
            ledger_id=ledger.id,
            version_number=max_version + 1,
            action_type=action_type,
            previous_state=previous_state,
            current_state=current_state,
            diff_summary=diff_summary,
            operator_id=operator.id,
            operator_name=operator.full_name or operator.username,
            change_reason=change_reason
        )

        self.db.add(version)
        return version

    def _create_workflow_log(
        self,
        ledger: VisitorLedger,
        action: str,
        from_status: Optional[LedgerStatus],
        to_status: LedgerStatus,
        operator: User,
        comment: Optional[str] = None,
        change_reason: Optional[str] = None
    ) -> WorkflowLog:
        log = WorkflowLog(
            ledger_id=ledger.id,
            action=action,
            from_status=from_status,
            to_status=to_status,
            operator_id=operator.id,
            operator_name=operator.full_name or operator.username,
            operator_role=operator.role.value,
            comment=comment,
            change_reason=change_reason
        )
        self.db.add(log)
        return log

    def _check_permission(self, ledger: VisitorLedger, user: User, action: str) -> bool:
        if user.role == UserRole.ADMIN:
            return True

        if action in ['submit', 'edit_draft']:
            return user.role in [UserRole.OPERATOR, UserRole.AUDITOR, UserRole.SECURITY_SUPERVISOR]

        if action == 'reject':
            return user.role in [UserRole.AUDITOR, UserRole.SECURITY_SUPERVISOR]

        if action in ['second_confirm', 'confirm']:
            return user.role in [UserRole.SECURITY_SUPERVISOR]

        if action == 'freeze':
            return user.role in [UserRole.SECURITY_SUPERVISOR, UserRole.AUDITOR]

        if action == 'manual_judgment':
            return user.role in [UserRole.AUDITOR, UserRole.SECURITY_SUPERVISOR]

        return False

    def submit(self, ledger_id: int, operator: User, comment: Optional[str] = None, change_reason: Optional[str] = None) -> VisitorLedger:
        ledger = self.db.query(VisitorLedger).filter(VisitorLedger.id == ledger_id).first()
        if not ledger:
            raise ValueError("台账不存在")

        if ledger.status not in [LedgerStatus.DRAFT, LedgerStatus.REJECTED]:
            raise ValueError(f"当前状态 {ledger.status.value} 不允许提交")

        if not self._check_permission(ledger, operator, 'submit'):
            raise PermissionError("无权限执行此操作")

        previous_state = self._get_ledger_state(ledger)
        from_status = ledger.status
        ledger.status = LedgerStatus.SUBMITTED

        self._create_version_history(ledger, 'submit', previous_state, operator, change_reason)
        self._create_workflow_log(ledger, '提交', from_status, LedgerStatus.SUBMITTED, operator, comment, change_reason)

        self.db.commit()
        self.db.refresh(ledger)
        return ledger

    def reject(self, ledger_id: int, operator: User, comment: Optional[str] = None, change_reason: Optional[str] = None) -> VisitorLedger:
        ledger = self.db.query(VisitorLedger).filter(VisitorLedger.id == ledger_id).first()
        if not ledger:
            raise ValueError("台账不存在")

        if ledger.status not in [LedgerStatus.SUBMITTED, LedgerStatus.SECOND_CONFIRMATION]:
            raise ValueError(f"当前状态 {ledger.status.value} 不允许驳回")

        if not self._check_permission(ledger, operator, 'reject'):
            raise PermissionError("无权限执行此操作")

        previous_state = self._get_ledger_state(ledger)
        from_status = ledger.status
        ledger.status = LedgerStatus.REJECTED

        self._create_version_history(ledger, 'reject', previous_state, operator, change_reason)
        self._create_workflow_log(ledger, '驳回', from_status, LedgerStatus.REJECTED, operator, comment, change_reason)

        self.db.commit()
        self.db.refresh(ledger)
        return ledger

    def second_confirmation(self, ledger_id: int, operator: User, comment: Optional[str] = None, change_reason: Optional[str] = None) -> VisitorLedger:
        ledger = self.db.query(VisitorLedger).filter(VisitorLedger.id == ledger_id).first()
        if not ledger:
            raise ValueError("台账不存在")

        if ledger.status != LedgerStatus.SUBMITTED:
            raise ValueError(f"当前状态 {ledger.status.value} 不允许二次确认")

        if not self._check_permission(ledger, operator, 'second_confirm'):
            raise PermissionError("无权限执行此操作")

        previous_state = self._get_ledger_state(ledger)
        from_status = ledger.status
        ledger.status = LedgerStatus.SECOND_CONFIRMATION

        self._create_version_history(ledger, 'second_confirmation', previous_state, operator, change_reason)
        self._create_workflow_log(ledger, '二次确认', from_status, LedgerStatus.SECOND_CONFIRMATION, operator, comment, change_reason)

        self.db.commit()
        self.db.refresh(ledger)
        return ledger

    def confirm(self, ledger_id: int, operator: User, comment: Optional[str] = None, change_reason: Optional[str] = None) -> VisitorLedger:
        ledger = self.db.query(VisitorLedger).filter(VisitorLedger.id == ledger_id).first()
        if not ledger:
            raise ValueError("台账不存在")

        if ledger.status != LedgerStatus.SECOND_CONFIRMATION:
            raise ValueError(f"当前状态 {ledger.status.value} 不允许最终确认")

        if not self._check_permission(ledger, operator, 'confirm'):
            raise PermissionError("无权限执行此操作")

        previous_state = self._get_ledger_state(ledger)
        from_status = ledger.status
        ledger.status = LedgerStatus.CONFIRMED

        if ledger.permission_result == PermissionResult.PENDING:
            if ledger.permission_revoked_time:
                ledger.permission_result = PermissionResult.PERMISSION_REVOKED
            elif ledger.permission_granted_time:
                ledger.permission_result = PermissionResult.PERMISSION_GRANTED

        self._create_version_history(ledger, 'confirm', previous_state, operator, change_reason)
        self._create_workflow_log(ledger, '最终确认', from_status, LedgerStatus.CONFIRMED, operator, comment, change_reason)

        self.db.commit()
        self.db.refresh(ledger)
        return ledger

    def withdraw(self, ledger_id: int, operator: User, comment: Optional[str] = None, change_reason: Optional[str] = None) -> VisitorLedger:
        ledger = self.db.query(VisitorLedger).filter(VisitorLedger.id == ledger_id).first()
        if not ledger:
            raise ValueError("台账不存在")

        if ledger.status not in [LedgerStatus.SUBMITTED, LedgerStatus.SECOND_CONFIRMATION]:
            raise ValueError(f"当前状态 {ledger.status.value} 不允许撤回")

        if not self._check_permission(ledger, operator, 'submit'):
            raise PermissionError("无权限执行此操作")

        previous_state = self._get_ledger_state(ledger)
        from_status = ledger.status
        ledger.status = LedgerStatus.DRAFT

        self._create_version_history(ledger, 'withdraw', previous_state, operator, change_reason)
        self._create_workflow_log(ledger, '撤回', from_status, LedgerStatus.DRAFT, operator, comment, change_reason)

        self.db.commit()
        self.db.refresh(ledger)
        return ledger

    def freeze(self, ledger_id: int, operator: User, comment: Optional[str] = None, change_reason: Optional[str] = None) -> VisitorLedger:
        ledger = self.db.query(VisitorLedger).filter(VisitorLedger.id == ledger_id).first()
        if not ledger:
            raise ValueError("台账不存在")

        if ledger.status == LedgerStatus.FROZEN:
            raise ValueError("台账已冻结")

        if not self._check_permission(ledger, operator, 'freeze'):
            raise PermissionError("无权限执行此操作")

        previous_state = self._get_ledger_state(ledger)
        from_status = ledger.status
        ledger.status = LedgerStatus.FROZEN

        self._create_version_history(ledger, 'freeze', previous_state, operator, change_reason)
        self._create_workflow_log(ledger, '冻结', from_status, LedgerStatus.FROZEN, operator, comment, change_reason)

        self.db.commit()
        self.db.refresh(ledger)
        return ledger

    def unfreeze(self, ledger_id: int, operator: User, comment: Optional[str] = None, change_reason: Optional[str] = None) -> VisitorLedger:
        ledger = self.db.query(VisitorLedger).filter(VisitorLedger.id == ledger_id).first()
        if not ledger:
            raise ValueError("台账不存在")

        if ledger.status != LedgerStatus.FROZEN:
            raise ValueError("台账未冻结")

        if not self._check_permission(ledger, operator, 'freeze'):
            raise PermissionError("无权限执行此操作")

        previous_state = self._get_ledger_state(ledger)
        from_status = ledger.status
        ledger.status = LedgerStatus.DRAFT

        self._create_version_history(ledger, 'unfreeze', previous_state, operator, change_reason)
        self._create_workflow_log(ledger, '解冻', from_status, LedgerStatus.DRAFT, operator, comment, change_reason)

        self.db.commit()
        self.db.refresh(ledger)
        return ledger

    def manual_judgment(
        self,
        ledger_id: int,
        operator: User,
        permission_result: PermissionResult,
        judgment_reason: str,
        comment: Optional[str] = None
    ) -> VisitorLedger:
        ledger = self.db.query(VisitorLedger).filter(VisitorLedger.id == ledger_id).first()
        if not ledger:
            raise ValueError("台账不存在")

        if ledger.status not in [LedgerStatus.DRAFT, LedgerStatus.REJECTED, LedgerStatus.SUBMITTED, LedgerStatus.SECOND_CONFIRMATION]:
            raise ValueError(f"当前状态 {ledger.status.value} 不允许人工改判")

        if not self._check_permission(ledger, operator, 'manual_judgment'):
            raise PermissionError("无权限执行此操作")

        previous_state = self._get_ledger_state(ledger)
        ledger.permission_result = permission_result
        ledger.is_manual_judgment = True
        ledger.judgment_reason = judgment_reason

        self._create_version_history(ledger, 'manual_judgment', previous_state, operator, judgment_reason)
        self._create_workflow_log(
            ledger, '人工改判', ledger.status, ledger.status,
            operator, comment, judgment_reason
        )

        self.db.commit()
        self.db.refresh(ledger)
        return ledger

    def edit_draft(
        self,
        ledger_id: int,
        operator: User,
        update_data: Dict[str, Any],
        change_reason: Optional[str] = None
    ) -> VisitorLedger:
        ledger = self.db.query(VisitorLedger).filter(VisitorLedger.id == ledger_id).first()
        if not ledger:
            raise ValueError("台账不存在")

        if ledger.status not in [LedgerStatus.DRAFT, LedgerStatus.REJECTED]:
            raise ValueError(f"当前状态 {ledger.status.value} 不允许编辑")

        if ledger.status == LedgerStatus.FROZEN:
            raise ValueError("台账已冻结，无法编辑")

        if not self._check_permission(ledger, operator, 'edit_draft'):
            raise PermissionError("无权限执行此操作")

        previous_state = self._get_ledger_state(ledger)

        editable_fields = [
            'visitor_name', 'visitor_phone', 'visitor_id_card', 'visit_purpose',
            'visited_person', 'visited_department', 'temp_plate_number',
            'appointment_start_time', 'appointment_end_time',
            'actual_entry_time', 'actual_exit_time',
            'permission_granted_time', 'permission_revoked_time'
        ]

        for field in editable_fields:
            if field in update_data:
                setattr(ledger, field, update_data[field])

        if 'permission_granted_time' in update_data or 'permission_revoked_time' in update_data or 'appointment_end_time' in update_data:
            grant_time = ledger.permission_granted_time
            revoke_time = ledger.permission_revoked_time
            appointment_end = ledger.appointment_end_time

            is_cross_day = False
            if grant_time and revoke_time:
                is_cross_day = grant_time.date() != revoke_time.date()
            elif grant_time and appointment_end:
                is_cross_day = grant_time.date() != appointment_end.date()

            ledger.is_cross_day = is_cross_day

            if is_cross_day and ledger.permission_result not in [PermissionResult.MANUAL_JUDGMENT]:
                ledger.permission_result = PermissionResult.CROSS_DAY_ISSUE

        self._create_version_history(ledger, 'edit', previous_state, operator, change_reason)
        self._create_workflow_log(ledger, '编辑', ledger.status, ledger.status, operator, None, change_reason)

        self.db.commit()
        self.db.refresh(ledger)
        return ledger

    def add_supplement(
        self,
        ledger_id: int,
        operator: User,
        supplement_type: str,
        content: Dict[str, Any],
        remark: Optional[str] = None
    ) -> SupplementRecord:
        ledger = self.db.query(VisitorLedger).filter(VisitorLedger.id == ledger_id).first()
        if not ledger:
            raise ValueError("台账不存在")

        supplement = SupplementRecord(
            ledger_id=ledger_id,
            supplement_type=supplement_type,
            content=content,
            supplementary_by=operator.id,
            remark=remark
        )

        self.db.add(supplement)
        self.db.commit()
        self.db.refresh(supplement)

        evidence = OriginalEvidence(
            ledger_id=ledger_id,
            source_type=DataSource.MANUAL_SUPPLEMENT,
            source_file_name=f"补录单-{supplement.id}",
            raw_data=content,
            is_valid=True
        )
        self.db.add(evidence)
        self.db.commit()

        return supplement

    def get_version_history(self, ledger_id: int) -> List[VersionHistory]:
        return self.db.query(VersionHistory).filter(
            VersionHistory.ledger_id == ledger_id
        ).order_by(VersionHistory.version_number.desc()).all()

    def get_workflow_logs(self, ledger_id: int) -> List[WorkflowLog]:
        return self.db.query(WorkflowLog).filter(
            WorkflowLog.ledger_id == ledger_id
        ).order_by(WorkflowLog.created_at.desc()).all()

    def compare_versions(self, ledger_id: int, version1: int, version2: int) -> Dict[str, Any]:
        v1 = self.db.query(VersionHistory).filter(
            VersionHistory.ledger_id == ledger_id,
            VersionHistory.version_number == version1
        ).first()

        v2 = self.db.query(VersionHistory).filter(
            VersionHistory.ledger_id == ledger_id,
            VersionHistory.version_number == version2
        ).first()

        if not v1 or not v2:
            raise ValueError("版本不存在")

        return {
            'version1': {
                'number': v1.version_number,
                'action': v1.action_type,
                'operator': v1.operator_name,
                'time': v1.created_at,
                'state': v1.current_state
            },
            'version2': {
                'number': v2.version_number,
                'action': v2.action_type,
                'operator': v2.operator_name,
                'time': v2.created_at,
                'state': v2.current_state
            },
            'diff': self._calculate_diff(v1.current_state or {}, v2.current_state or {})
        }
