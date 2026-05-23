import csv
import io
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from ..models import (
    VisitorLedger, UserRole, PermissionResult, LedgerStatus,
    User, WorkflowLog, VersionHistory
)


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def _mask_sensitive_data(self, data: Dict[str, Any], mask: bool = True) -> Dict[str, Any]:
        if not mask:
            return data

        masked = data.copy()

        if masked.get('visitor_phone'):
            phone = masked['visitor_phone']
            if len(phone) >= 7:
                masked['visitor_phone'] = phone[:3] + '****' + phone[-4:]
            else:
                masked['visitor_phone'] = '****'

        if masked.get('visitor_id_card'):
            id_card = masked['visitor_id_card']
            if len(id_card) >= 10:
                masked['visitor_id_card'] = id_card[:6] + '********' + id_card[-4:]
            else:
                masked['visitor_id_card'] = '****'

        return masked

    def _get_ledger_dict(self, ledger: VisitorLedger, include_evidence: bool = False, mask_sensitive: bool = True) -> Dict[str, Any]:
        data = {
            '台账编号': ledger.ledger_no,
            '访客姓名': ledger.visitor_name,
            '联系电话': ledger.visitor_phone,
            '身份证号': ledger.visitor_id_card,
            '来访事由': ledger.visit_purpose,
            '被访人': ledger.visited_person,
            '被访部门': ledger.visited_department,
            '临时车牌': ledger.temp_plate_number,
            '预约开始时间': ledger.appointment_start_time.isoformat() if ledger.appointment_start_time else '',
            '预约结束时间': ledger.appointment_end_time.isoformat() if ledger.appointment_end_time else '',
            '实际进入时间': ledger.actual_entry_time.isoformat() if ledger.actual_entry_time else '',
            '实际离开时间': ledger.actual_exit_time.isoformat() if ledger.actual_exit_time else '',
            '权限开通时间': ledger.permission_granted_time.isoformat() if ledger.permission_granted_time else '',
            '权限收回时间': ledger.permission_revoked_time.isoformat() if ledger.permission_revoked_time else '',
            '是否跨天': '是' if ledger.is_cross_day else '否',
            '权限判定结果': self._translate_permission_result(ledger.permission_result),
            '台账状态': self._translate_status(ledger.status),
            '是否人工改判': '是' if ledger.is_manual_judgment else '否',
            '改判原因': ledger.judgment_reason or '',
            '创建时间': ledger.created_at.isoformat() if ledger.created_at else '',
        }

        if mask_sensitive:
            data = self._mask_sensitive_data(data)

        return data

    def _translate_permission_result(self, result: Optional[PermissionResult]) -> str:
        translations = {
            PermissionResult.PENDING: '待处理',
            PermissionResult.PERMISSION_GRANTED: '权限已开通',
            PermissionResult.PERMISSION_REVOKED: '权限已收回',
            PermissionResult.CROSS_DAY_ISSUE: '跨天问题',
            PermissionResult.UNCERTAIN: '无法确认',
            PermissionResult.MANUAL_JUDGMENT: '人工判定',
        }
        return translations.get(result, '未知') if result else '未知'

    def _translate_status(self, status: Optional[LedgerStatus]) -> str:
        translations = {
            LedgerStatus.DRAFT: '草稿',
            LedgerStatus.SUBMITTED: '已提交',
            LedgerStatus.REJECTED: '已驳回',
            LedgerStatus.SECOND_CONFIRMATION: '二次确认中',
            LedgerStatus.CONFIRMED: '已确认',
            LedgerStatus.FROZEN: '已冻结',
            LedgerStatus.ARCHIVED: '已归档',
        }
        return translations.get(status, '未知') if status else '未知'

    def export_to_csv(
        self,
        ledger_ids: List[int],
        current_user: User,
        mask_sensitive: bool = True
    ) -> str:
        ledgers = self.db.query(VisitorLedger).filter(VisitorLedger.id.in_(ledger_ids)).all()

        output = io.StringIO()
        writer = csv.writer(output)

        if ledgers:
            headers = list(self._get_ledger_dict(ledgers[0], mask_sensitive=mask_sensitive).keys())
            writer.writerow(headers)

        for ledger in ledgers:
            data = self._get_ledger_dict(ledger, mask_sensitive=mask_sensitive)
            writer.writerow(list(data.values()))

        return output.getvalue()

    def export_to_json(
        self,
        ledger_ids: List[int],
        current_user: User,
        include_workflow: bool = False,
        include_version_history: bool = False,
        mask_sensitive: bool = True
    ) -> str:
        ledgers = self.db.query(VisitorLedger).filter(VisitorLedger.id.in_(ledger_ids)).all()

        result = []
        for ledger in ledgers:
            data = self._get_ledger_dict(ledger, mask_sensitive=mask_sensitive)

            if include_workflow:
                logs = self.db.query(WorkflowLog).filter(WorkflowLog.ledger_id == ledger.id).order_by(WorkflowLog.created_at).all()
                data['工作流记录'] = [
                    {
                        '操作': log.action,
                        '操作人': log.operator_name,
                        '操作人角色': log.operator_role,
                        '从状态': self._translate_status(log.from_status),
                        '到状态': self._translate_status(log.to_status),
                        '备注': log.comment or '',
                        '变更原因': log.change_reason or '',
                        '时间': log.created_at.isoformat() if log.created_at else ''
                    }
                    for log in logs
                ]

            if include_version_history:
                versions = self.db.query(VersionHistory).filter(VersionHistory.ledger_id == ledger.id).order_by(VersionHistory.version_number).all()
                data['版本历史'] = [
                    {
                        '版本号': v.version_number,
                        '操作类型': v.action_type,
                        '操作人': v.operator_name,
                        '变更原因': v.change_reason or '',
                        '差异摘要': v.diff_summary,
                        '时间': v.created_at.isoformat() if v.created_at else ''
                    }
                    for v in versions
                ]

            result.append(data)

        return json.dumps(result, ensure_ascii=False, indent=2)

    def get_security_supervisor_view(self, current_user: User) -> Dict[str, Any]:
        if current_user.role not in [UserRole.SECURITY_SUPERVISOR, UserRole.ADMIN]:
            raise PermissionError("无权限访问此视图")

        all_ledgers = self.db.query(VisitorLedger).all()

        role_summary = {
            '草稿': self.db.query(VisitorLedger).filter(VisitorLedger.status == LedgerStatus.DRAFT).count(),
            '已提交': self.db.query(VisitorLedger).filter(VisitorLedger.status == LedgerStatus.SUBMITTED).count(),
            '二次确认中': self.db.query(VisitorLedger).filter(VisitorLedger.status == LedgerStatus.SECOND_CONFIRMATION).count(),
            '已确认': self.db.query(VisitorLedger).filter(VisitorLedger.status == LedgerStatus.CONFIRMED).count(),
            '已驳回': self.db.query(VisitorLedger).filter(VisitorLedger.status == LedgerStatus.REJECTED).count(),
            '已冻结': self.db.query(VisitorLedger).filter(VisitorLedger.status == LedgerStatus.FROZEN).count(),
        }

        cross_day_issues = self.db.query(VisitorLedger).filter(
            VisitorLedger.is_cross_day == True
        ).order_by(VisitorLedger.created_at.desc()).limit(20).all()

        manual_judgments = self.db.query(VisitorLedger).filter(
            VisitorLedger.is_manual_judgment == True
        ).order_by(VisitorLedger.updated_at.desc()).limit(20).all()

        pending_approvals = self.db.query(VisitorLedger).filter(
            VisitorLedger.status.in_([LedgerStatus.SUBMITTED, LedgerStatus.SECOND_CONFIRMATION])
        ).order_by(VisitorLedger.created_at).all()

        change_reasons = self.db.query(WorkflowLog.change_reason).filter(
            WorkflowLog.change_reason.isnot(None)
        ).all()

        reason_dist = {}
        for (reason,) in change_reasons:
            if reason:
                reason_dist[reason] = reason_dist.get(reason, 0) + 1

        return {
            'role_summary': role_summary,
            'change_reason_distribution': reason_dist,
            'cross_day_issues': cross_day_issues,
            'recent_manual_judgments': manual_judgments,
            'pending_approvals': pending_approvals
        }

    def get_statistics(self, current_user: User) -> Dict[str, Any]:
        return {
            'total_records': self.db.query(VisitorLedger).count(),
            'draft_count': self.db.query(VisitorLedger).filter(VisitorLedger.status == LedgerStatus.DRAFT).count(),
            'submitted_count': self.db.query(VisitorLedger).filter(VisitorLedger.status == LedgerStatus.SUBMITTED).count(),
            'confirmed_count': self.db.query(VisitorLedger).filter(VisitorLedger.status == LedgerStatus.CONFIRMED).count(),
            'cross_day_issue_count': self.db.query(VisitorLedger).filter(VisitorLedger.is_cross_day == True).count(),
            'manual_judgment_count': self.db.query(VisitorLedger).filter(VisitorLedger.is_manual_judgment == True).count(),
            'pending_review_count': self.db.query(VisitorLedger).filter(
                VisitorLedger.status.in_([LedgerStatus.SUBMITTED, LedgerStatus.SECOND_CONFIRMATION])
            ).count(),
        }
