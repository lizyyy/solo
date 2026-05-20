from datetime import datetime
from typing import List, Optional
from models import (
    TransferReconciliation, VerificationStatus,
    ReviewAction, ReconciliationSummary, ReconciliationResult
)


class ReviewerService:
    def review_record(
        self,
        reconciliation: TransferReconciliation,
        action: ReviewAction,
        reviewer_id: str,
        reviewer_name: str,
        notes: str = None,
        adjusted_cash: float = None,
        adjusted_check: float = None
    ) -> TransferReconciliation:
        reconciliation.review_action = action
        reconciliation.reviewer_id = reviewer_id
        reconciliation.reviewer_name = reviewer_name
        reconciliation.review_time = datetime.now()
        if notes:
            reconciliation.review_notes.append(f"[复核意见] {notes}")
        if adjusted_cash is not None or adjusted_check is not None:
            cash = adjusted_cash if adjusted_cash is not None else reconciliation.original_record.cash_amount
            check = adjusted_check if adjusted_check is not None else reconciliation.original_record.check_amount
            reconciliation.adjusted_cash_amount = cash
            reconciliation.adjusted_check_amount = check
            reconciliation.adjusted_total_amount = cash + check
            reconciliation.is_adjusted = True
            reconciliation.review_notes.append(f"[金额调整] 现金: {cash:,.2f}, 支票: {check:,.2f}, 合计: {cash + check:,.2f}")
        if action == ReviewAction.APPROVE:
            reconciliation.verification_status = VerificationStatus.APPROVED
            reconciliation.review_notes.append("[状态变更] 复核通过，准予放行")
        elif action == ReviewAction.REJECT:
            reconciliation.verification_status = VerificationStatus.REJECTED
            reconciliation.review_notes.append("[状态变更] 复核驳回，需退回重办")
        elif action == ReviewAction.REQUEST_MORE_INFO:
            reconciliation.verification_status = VerificationStatus.NEEDS_MORE_INFO
            reconciliation.review_notes.append("[状态变更] 需补充材料后再审")
        elif action == ReviewAction.RECALCULATE:
            reconciliation.review_notes.append("[状态变更] 执行重新计算")
        reconciliation.verification_status = VerificationStatus.REVIEWED
        return reconciliation

    def add_note(
        self,
        reconciliation: TransferReconciliation,
        note: str,
        author: str = None
    ) -> TransferReconciliation:
        if author:
            reconciliation.review_notes.append(f"[{author}] {note}")
        else:
            reconciliation.review_notes.append(note)
        return reconciliation

    def generate_summary(self, records: List[TransferReconciliation]) -> ReconciliationSummary:
        summary = ReconciliationSummary()
        summary.total_records = len(records)
        for record in records:
            cash = record.adjusted_cash_amount if record.is_adjusted else record.original_record.cash_amount
            check = record.adjusted_check_amount if record.is_adjusted else record.original_record.check_amount
            summary.total_cash_amount += cash
            summary.total_check_amount += check
            summary.grand_total += (cash + check)
            if record.verification_status == VerificationStatus.MATCHED:
                summary.matched_records += 1
            elif record.verification_status == VerificationStatus.DISCREPANCY:
                summary.discrepancy_records += 1
            elif record.verification_status == VerificationStatus.REVIEWED:
                summary.reviewed_records += 1
            elif record.verification_status == VerificationStatus.APPROVED:
                summary.approved_records += 1
            elif record.verification_status == VerificationStatus.REJECTED:
                summary.rejected_records += 1
            elif record.verification_status == VerificationStatus.NEEDS_MORE_INFO:
                summary.needs_more_info += 1
            for discrepancy in record.discrepancies:
                dtype = discrepancy.discrepancy_type.value
                summary.discrepancy_breakdown[dtype] = summary.discrepancy_breakdown.get(dtype, 0) + 1
        summary.pending_review = summary.discrepancy_records + (summary.reviewed_records - summary.approved_records - summary.rejected_records - summary.needs_more_info)
        return summary

    def get_record_explanation(self, record: TransferReconciliation) -> str:
        lines = []
        lines.append(f"交接编号: {record.transfer_id}")
        lines.append(f"尾箱编号: {record.box_id}")
        lines.append(f"当前状态: {self._status_to_chinese(record.verification_status)}")
        if record.verification_status in [VerificationStatus.APPROVED, VerificationStatus.REJECTED]:
            lines.append(f"处理结果: {self._action_to_chinese(record.review_action)}")
            lines.append(f"复核人: {record.reviewer_name} ({record.reviewer_id})")
            if record.review_time:
                lines.append(f"复核时间: {record.review_time.strftime('%Y-%m-%d %H:%M:%S')}")
        if record.discrepancies:
            lines.append("\n异常说明:")
            for d in record.discrepancies:
                lines.append(f"  - [{d.severity}] {d.description}")
        if record.review_notes:
            lines.append("\n复核记录:")
            for note in record.review_notes:
                lines.append(f"  {note}")
        if record.is_adjusted:
            lines.append("\n金额调整:")
            lines.append(f"  原现金: {record.original_record.cash_amount:,.2f} → 调整后: {record.adjusted_cash_amount:,.2f}")
            lines.append(f"  原支票: {record.original_record.check_amount:,.2f} → 调整后: {record.adjusted_check_amount:,.2f}")
            lines.append(f"  原合计: {record.original_record.total_amount:,.2f} → 调整后: {record.adjusted_total_amount:,.2f}")
        return "\n".join(lines)

    def _status_to_chinese(self, status: VerificationStatus) -> str:
        mapping = {
            VerificationStatus.PENDING: "待处理",
            VerificationStatus.MATCHED: "核对通过",
            VerificationStatus.DISCREPANCY: "存在差异",
            VerificationStatus.REVIEWED: "已复核",
            VerificationStatus.APPROVED: "已放行",
            VerificationStatus.REJECTED: "已退回",
            VerificationStatus.NEEDS_MORE_INFO: "待补件"
        }
        return mapping.get(status, status.value)

    def _action_to_chinese(self, action: ReviewAction) -> str:
        mapping = {
            ReviewAction.APPROVE: "放行",
            ReviewAction.REJECT: "退回",
            ReviewAction.REQUEST_MORE_INFO: "补件",
            ReviewAction.RECALCULATE: "重新计算"
        }
        return mapping.get(action, action.value)
