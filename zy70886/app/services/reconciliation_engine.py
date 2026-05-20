from datetime import datetime
from typing import List, Dict, Tuple
from sqlalchemy.orm import Session
from app.models import (
    ContractApplication, StampRecord, ApprovalRecord, ExpressRecord,
    ReconciliationResult, ReconciliationBatch, ReconciliationStatus, DiscrepancyType
)


class ReconciliationEngine:
    def __init__(self, db: Session):
        self.db = db

    def _check_unauthorized_stamp(self, app: ContractApplication, stamps: List[StampRecord], approvals: List[ApprovalRecord]) -> Tuple[bool, str]:
        has_approval = any(a.is_authorised and a.approval_result == '通过' for a in approvals)
        has_stamp = len(stamps) > 0

        if has_stamp and not has_approval:
            return True, "存在越权盖章：已有盖章记录但缺少授权审批"

        for stamp in stamps:
            if stamp.is_withdrawn:
                continue
            if stamp.stamp_type not in ['公章', '合同专用章'] and app.stamp_type == '公章':
                return True, f"印章类型不符：申请{app.stamp_type}，实际盖{stamp.stamp_type}"

        return False, ""

    def _check_supplementary_attachment(self, stamps: List[StampRecord]) -> Tuple[bool, str]:
        has_supplementary = any(s.is_supplementary for s in stamps)
        if has_supplementary:
            reasons = [s.supplementary_reason for s in stamps if s.is_supplementary and s.supplementary_reason]
            return True, f"补盖附件：{'; '.join(reasons) if reasons else '存在补盖记录'}"
        return False, ""

    def _check_withdrawal_resubmit(self, stamps: List[StampRecord]) -> Tuple[bool, str]:
        has_withdrawal = any(s.is_withdrawn for s in stamps)
        if has_withdrawal and len(stamps) > 1:
            reasons = [s.withdrawal_reason for s in stamps if s.is_withdrawn and s.withdrawal_reason]
            return True, f"撤回重提：{'; '.join(reasons) if reasons else '存在撤回后重新盖章记录'}"
        return False, ""

    def _check_missing_approval(self, approvals: List[ApprovalRecord]) -> Tuple[bool, str]:
        if len(approvals) == 0:
            return True, "缺少审批记录"
        all_passed = all(a.approval_result == '通过' for a in approvals)
        if not all_passed:
            return True, "存在未通过的审批记录"
        return False, ""

    def _check_missing_stamp(self, stamps: List[StampRecord]) -> Tuple[bool, str]:
        valid_stamps = [s for s in stamps if not s.is_withdrawn]
        if len(valid_stamps) == 0:
            return True, "缺少有效盖章记录"
        return False, ""

    def _check_missing_express(self, expresses: List[ExpressRecord]) -> Tuple[bool, str]:
        if len(expresses) == 0:
            return True, "缺少快递寄出记录"
        if not any(e.is_received for e in expresses):
            return False, "快递尚未签收"
        return False, ""

    def reconcile_single_application(self, app: ContractApplication, batch_id: str) -> ReconciliationResult:
        stamps = self.db.query(StampRecord).filter(StampRecord.application_no == app.application_no).all()
        approvals = self.db.query(ApprovalRecord).filter(ApprovalRecord.application_no == app.application_no).all()
        expresses = self.db.query(ExpressRecord).filter(ExpressRecord.application_no == app.application_no).all()

        discrepancies = []
        discrepancy_types = []

        is_unauthorized_stamp, desc = self._check_unauthorized_stamp(app, stamps, approvals)
        if is_unauthorized_stamp:
            discrepancies.append(desc)
            discrepancy_types.append(DiscrepancyType.UNAUTHORIZED_STAMP)

        is_supplementary_attachment, desc = self._check_supplementary_attachment(stamps)
        if is_supplementary_attachment:
            discrepancies.append(desc)
            discrepancy_types.append(DiscrepancyType.SUPPLEMENTARY_ATTACHMENT)

        is_withdrawal_resubmit, desc = self._check_withdrawal_resubmit(stamps)
        if is_withdrawal_resubmit:
            discrepancies.append(desc)
            discrepancy_types.append(DiscrepancyType.WITHDRAWAL_RESUBMIT)

        has_missing_approval, desc = self._check_missing_approval(approvals)
        if has_missing_approval:
            discrepancies.append(desc)
            discrepancy_types.append(DiscrepancyType.MISSING_APPROVAL)

        has_missing_stamp, desc = self._check_missing_stamp(stamps)
        if has_missing_stamp:
            discrepancies.append(desc)
            discrepancy_types.append(DiscrepancyType.MISSING_STAMP)

        has_missing_express, desc = self._check_missing_express(expresses)
        if has_missing_express:
            discrepancies.append(desc)
            discrepancy_types.append(DiscrepancyType.MISSING_EXPRESS)

        if len(discrepancies) > 0:
            status = ReconciliationStatus.DISCREPANCY
        else:
            status = ReconciliationStatus.MATCHED

        result = ReconciliationResult(
            application_no=app.application_no,
            batch_id=batch_id,
            status=status,
            discrepancy_types=','.join([dt.value for dt in discrepancy_types]) if discrepancy_types else None,
            discrepancy_description='; '.join(discrepancies) if discrepancies else None,
            is_unauthorized_stamp=is_unauthorized_stamp,
            is_supplementary_attachment=is_supplementary_attachment,
            is_withdrawal_resubmit=is_withdrawal_resubmit,
            has_missing_approval=has_missing_approval,
            has_missing_stamp=has_missing_stamp,
            has_missing_express=has_missing_express
        )

        return result

    def run_reconciliation(self, batch_id: str, batch_name: str = None, created_by: str = None) -> Dict:
        applications = self.db.query(ContractApplication).all()

        matched_count = 0
        discrepancy_count = 0

        for app in applications:
            existing = self.db.query(ReconciliationResult).filter(
                ReconciliationResult.application_no == app.application_no,
                ReconciliationResult.batch_id == batch_id
            ).first()

            if existing:
                self.db.delete(existing)

            result = self.reconcile_single_application(app, batch_id)
            self.db.add(result)

            if result.status == ReconciliationStatus.MATCHED:
                matched_count += 1
            else:
                discrepancy_count += 1

        batch = self.db.query(ReconciliationBatch).filter(ReconciliationBatch.batch_id == batch_id).first()
        if not batch:
            batch = ReconciliationBatch(
                batch_id=batch_id,
                batch_name=batch_name,
                created_by=created_by
            )
            self.db.add(batch)

        batch.total_records = len(applications)
        batch.matched_count = matched_count
        batch.discrepancy_count = discrepancy_count
        batch.status = "completed"
        batch.completed_at = datetime.now()

        self.db.commit()

        return {
            "batch_id": batch_id,
            "total_records": len(applications),
            "matched_count": matched_count,
            "discrepancy_count": discrepancy_count
        }

    def recalculate_single(self, reconciliation_result_id: int) -> ReconciliationResult:
        result = self.db.query(ReconciliationResult).filter(ReconciliationResult.id == reconciliation_result_id).first()
        if not result:
            raise ValueError("对账记录不存在")

        app = self.db.query(ContractApplication).filter(ContractApplication.application_no == result.application_no).first()
        if not app:
            raise ValueError("合同申请不存在")

        self.db.delete(result)
        new_result = self.reconcile_single_application(app, result.batch_id)
        new_result.id = reconciliation_result_id
        new_result.review_status = result.review_status
        new_result.review_action = result.review_action
        new_result.reviewer = result.reviewer
        new_result.review_date = result.review_date
        new_result.review_opinion = result.review_opinion
        new_result.final_disposition = result.final_disposition
        new_result.created_at = result.created_at

        self.db.add(new_result)
        self.db.commit()
        self.db.refresh(new_result)

        return new_result

    def update_batch_statistics(self, batch_id: str):
        results = self.db.query(ReconciliationResult).filter(ReconciliationResult.batch_id == batch_id).all()
        batch = self.db.query(ReconciliationBatch).filter(ReconciliationBatch.batch_id == batch_id).first()

        if not batch:
            return

        batch.total_records = len(results)
        batch.matched_count = sum(1 for r in results if r.status == ReconciliationStatus.MATCHED)
        batch.discrepancy_count = sum(1 for r in results if r.status == ReconciliationStatus.DISCREPANCY)
        batch.reviewed_count = sum(1 for r in results if r.status in [ReconciliationStatus.REVIEWED, ReconciliationStatus.APPROVED, ReconciliationStatus.REJECTED])
        batch.approved_count = sum(1 for r in results if r.status == ReconciliationStatus.APPROVED)
        batch.rejected_count = sum(1 for r in results if r.status == ReconciliationStatus.REJECTED)

        self.db.commit()
