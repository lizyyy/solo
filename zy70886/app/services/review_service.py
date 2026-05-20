from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.models import ReconciliationResult, ReviewHistory, ReconciliationStatus, ReviewAction
from app.services.reconciliation_engine import ReconciliationEngine


class ReviewService:
    def __init__(self, db: Session):
        self.db = db

    def process_review(
        self,
        reconciliation_result_id: int,
        action: ReviewAction,
        reviewer: str,
        opinion: Optional[str] = None,
        change_summary: Optional[str] = None
    ) -> ReconciliationResult:
        result = self.db.query(ReconciliationResult).filter(
            ReconciliationResult.id == reconciliation_result_id
        ).first()

        if not result:
            raise ValueError("对账记录不存在")

        old_status = result.status.value

        if action == ReviewAction.APPROVE:
            new_status = ReconciliationStatus.APPROVED
            final_disposition = "放行：复核通过"
        elif action == ReviewAction.REJECT:
            new_status = ReconciliationStatus.REJECTED
            final_disposition = "退回：复核不通过"
        elif action == ReviewAction.REQUEST_SUPPLEMENT:
            new_status = ReconciliationStatus.REVIEWED
            final_disposition = "补充材料：要求补充相关资料"
        elif action == ReviewAction.REVISE:
            new_status = ReconciliationStatus.REVIEWED
            final_disposition = "修改：已调整对账结果"
        else:
            new_status = ReconciliationStatus.REVIEWED
            final_disposition = None

        history = ReviewHistory(
            reconciliation_result_id=reconciliation_result_id,
            action=action,
            reviewer=reviewer,
            opinion=opinion,
            old_status=old_status,
            new_status=new_status.value,
            change_summary=change_summary
        )
        self.db.add(history)

        result.status = new_status
        result.review_action = action.value
        result.reviewer = reviewer
        result.review_date = datetime.now()
        result.review_opinion = opinion
        result.final_disposition = final_disposition

        self.db.commit()
        self.db.refresh(result)

        engine = ReconciliationEngine(self.db)
        engine.update_batch_statistics(result.batch_id)

        return result

    def get_review_history(self, reconciliation_result_id: int) -> list:
        return self.db.query(ReviewHistory).filter(
            ReviewHistory.reconciliation_result_id == reconciliation_result_id
        ).order_by(ReviewHistory.review_date.desc()).all()

    def get_audit_trail(self, application_no: str) -> dict:
        from app.models import ContractApplication, StampRecord, ApprovalRecord, ExpressRecord

        application = self.db.query(ContractApplication).filter(
            ContractApplication.application_no == application_no
        ).first()

        if not application:
            return {}

        stamps = self.db.query(StampRecord).filter(
            StampRecord.application_no == application_no
        ).order_by(StampRecord.stamp_date).all()

        approvals = self.db.query(ApprovalRecord).filter(
            ApprovalRecord.application_no == application_no
        ).order_by(ApprovalRecord.approval_date).all()

        expresses = self.db.query(ExpressRecord).filter(
            ExpressRecord.application_no == application_no
        ).order_by(ExpressRecord.send_date).all()

        reconciliation_results = self.db.query(ReconciliationResult).filter(
            ReconciliationResult.application_no == application_no
        ).order_by(ReconciliationResult.created_at.desc()).all()

        audit_trail = {
            "application": application,
            "stamp_records": stamps,
            "approval_records": approvals,
            "express_records": expresses,
            "reconciliation_history": []
        }

        for result in reconciliation_results:
            review_histories = self.get_review_history(result.id)
            audit_trail["reconciliation_history"].append({
                "result": result,
                "reviews": review_histories
            })

        return audit_trail

    def generate_disposition_explanation(self, reconciliation_result_id: int) -> str:
        result = self.db.query(ReconciliationResult).filter(
            ReconciliationResult.id == reconciliation_result_id
        ).first()

        if not result:
            return "记录不存在"

        explanations = []

        if result.is_unauthorized_stamp:
            explanations.append("⚠️ 存在越权盖章风险")

        if result.is_supplementary_attachment:
            explanations.append("📎 存在补盖附件记录")

        if result.is_withdrawal_resubmit:
            explanations.append("🔄 存在撤回重提记录")

        if result.has_missing_approval:
            explanations.append("❌ 缺少审批记录")

        if result.has_missing_stamp:
            explanations.append("❌ 缺少有效盖章记录")

        if result.has_missing_express:
            explanations.append("❌ 缺少快递寄出记录")

        if result.final_disposition:
            explanations.append(f"\n最终处理：{result.final_disposition}")

        if result.reviewer:
            explanations.append(f"复核人：{result.reviewer}")

        if result.review_opinion:
            explanations.append(f"复核意见：{result.review_opinion}")

        return "\n".join(explanations)
