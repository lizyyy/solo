from sqlalchemy.orm import Session
from typing import Dict, Any, List
from datetime import datetime

from app.models.models import (
    ReconciliationDetail, ReconciliationResult,
    ReviewRecord, RectificationOrder
)
from app.schemas.schemas import (
    ReviewRecordCreate, FinalStatus, ReviewAction,
    RecalculateResult, ReconciliationSummary
)
from app.services.auto_check_engine import AutoCheckEngine


class ReviewService:
    def __init__(self, db: Session):
        self.db = db

    def add_review(self, review_data: ReviewRecordCreate) -> ReviewRecord:
        detail = self.db.query(ReconciliationDetail).filter(
            ReconciliationDetail.id == review_data.reconciliation_detail_id
        ).first()
        
        if not detail:
            raise ValueError(f"找不到对账明细ID: {review_data.reconciliation_detail_id}")

        review = ReviewRecord(
            reconciliation_result_id=detail.reconciliation_result_id,
            reconciliation_detail_id=review_data.reconciliation_detail_id,
            reviewer=review_data.reviewer,
            review_action=review_data.review_action.value,
            review_comment=review_data.review_comment,
            adjusted_fine_amount=review_data.adjusted_fine_amount,
            difference_source=review_data.difference_source,
            evidence=review_data.evidence,
            review_time=datetime.now()
        )
        
        self._apply_review_to_detail(detail, review_data)
        self.db.add(review)
        self.db.flush()
        
        recalc_service = RecalculateService(self.db)
        recalc_service.recalculate_result(detail.reconciliation_result_id)
        
        self.db.commit()
        self.db.refresh(review)
        return review

    def _apply_review_to_detail(
        self, detail: ReconciliationDetail, review_data: ReviewRecordCreate
    ) -> None:
        if review_data.final_status:
            detail.final_status = review_data.final_status.value
        
        if review_data.difference_explanation is not None:
            detail.difference_explanation = review_data.difference_explanation
        
        if review_data.review_action == ReviewAction.ADJUST_FINE:
            if review_data.adjusted_fine_amount is not None:
                detail.fine_amount = review_data.adjusted_fine_amount
        
        if review_data.review_action == ReviewAction.APPROVE:
            detail.final_status = FinalStatus.APPROVED
            if not detail.difference_explanation or detail.difference_explanation == "数据完整，无异常":
                detail.difference_explanation = f"已放行：{review_data.review_comment or '符合要求'}"
        
        elif review_data.review_action == ReviewAction.REJECT:
            detail.final_status = FinalStatus.REJECTED
            if review_data.review_comment:
                detail.difference_explanation = f"已退回：{review_data.review_comment}"
        
        elif review_data.review_action == ReviewAction.REQUEST_MATERIAL:
            detail.final_status = FinalStatus.NEED_MATERIAL
            if review_data.review_comment:
                detail.difference_explanation = f"需补材料：{review_data.review_comment}"


class RecalculateService:
    def __init__(self, db: Session):
        self.db = db

    def recalculate_result(self, result_id: int) -> RecalculateResult:
        result = self.db.query(ReconciliationResult).filter(
            ReconciliationResult.id == result_id
        ).first()
        
        if not result:
            raise ValueError(f"找不到对账结果ID: {result_id}")
        
        details = self.db.query(ReconciliationDetail).filter(
            ReconciliationDetail.reconciliation_result_id == result_id
        ).all()
        
        completed_nodes = 0
        missing_photo_nodes = 0
        overdue_nodes = 0
        total_rework_count = 0
        total_fine_amount = 0.0
        approved_count = 0
        rejected_count = 0
        need_material_count = 0
        pending_count = 0
        
        for detail in details:
            if detail.final_status == FinalStatus.APPROVED:
                completed_nodes += 1
            if detail.photo_status != "complete":
                missing_photo_nodes += 1
            if detail.is_overdue:
                overdue_nodes += 1
            total_rework_count += detail.rework_count
            total_fine_amount += detail.fine_amount
            
            if detail.final_status == FinalStatus.APPROVED:
                approved_count += 1
            elif detail.final_status == FinalStatus.REJECTED:
                rejected_count += 1
            elif detail.final_status == FinalStatus.NEED_MATERIAL:
                need_material_count += 1
            else:
                pending_count += 1
        
        total_node_amount = sum(d.node_amount for d in details)
        
        result.completed_nodes = completed_nodes
        result.missing_photo_nodes = missing_photo_nodes
        result.overdue_nodes = overdue_nodes
        result.rework_count = total_rework_count
        result.total_fine_amount = total_fine_amount
        result.payable_amount = max(0.0, total_node_amount - total_fine_amount)
        result.status = "reviewed"
        
        self.db.commit()
        self.db.refresh(result)
        
        return RecalculateResult(
            success=True,
            message=f"已重新计算对账结果，共更新{len(details)}条明细",
            updated_details=len(details),
            updated_summary={
                "total_nodes": result.total_nodes,
                "completed_nodes": completed_nodes,
                "approved_count": approved_count,
                "rejected_count": rejected_count,
                "need_material_count": need_material_count,
                "pending_count": pending_count,
                "total_fine_amount": total_fine_amount,
                "payable_amount": result.payable_amount
            }
        )

    def get_summary(self, result_id: int) -> ReconciliationSummary:
        result = self.db.query(ReconciliationResult).filter(
            ReconciliationResult.id == result_id
        ).first()
        
        if not result:
            raise ValueError(f"找不到对账结果ID: {result_id}")
        
        details = self.db.query(ReconciliationDetail).filter(
            ReconciliationDetail.reconciliation_result_id == result_id
        ).all()
        
        approved_count = sum(1 for d in details if d.final_status == FinalStatus.APPROVED)
        rejected_count = sum(1 for d in details if d.final_status == FinalStatus.REJECTED)
        need_material_count = sum(1 for d in details if d.final_status == FinalStatus.NEED_MATERIAL)
        pending_count = sum(1 for d in details if d.final_status == FinalStatus.PENDING)
        
        completed_rate = (approved_count / result.total_nodes * 100) if result.total_nodes > 0 else 0
        
        return ReconciliationSummary(
            total_nodes=result.total_nodes,
            completed_nodes=result.completed_nodes,
            completed_rate=round(completed_rate, 2),
            missing_photo_nodes=result.missing_photo_nodes,
            overdue_nodes=result.overdue_nodes,
            rework_count=result.rework_count,
            total_fine_amount=result.total_fine_amount,
            payable_amount=result.payable_amount,
            approved_count=approved_count,
            rejected_count=rejected_count,
            need_material_count=need_material_count,
            pending_count=pending_count
        )

    def recalculate_single_detail(self, detail_id: int) -> ReconciliationDetail:
        detail = self.db.query(ReconciliationDetail).filter(
            ReconciliationDetail.id == detail_id
        ).first()
        
        if not detail:
            raise ValueError(f"找不到对账明细ID: {detail_id}")
        
        engine = AutoCheckEngine(self.db)
        result_id = detail.reconciliation_result_id
        
        rectifications = self.db.query(RectificationOrder).filter(
            RectificationOrder.node_id == detail.node_id
        ).all()
        
        rework_count = sum(r.rework_count for r in rectifications)
        has_rework = any(r.is_rework for r in rectifications)
        
        detail.rework_count = rework_count
        detail.is_rework = has_rework
        detail.rectification_count = len(rectifications)
        detail.has_rectification = len(rectifications) > 0
        detail.fine_amount = sum(r.fine_amount for r in rectifications)
        
        self.db.commit()
        self.db.refresh(detail)
        
        self.recalculate_result(result_id)
        
        return detail
