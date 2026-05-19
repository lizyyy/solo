from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.models import (
    Hazard, HazardStatus,
    Rectification,
    Review, ReviewResult
)


class WorkflowService:
    def __init__(self, db: Session):
        self.db = db

    def assign_hazard(
        self,
        hazard_id: int,
        responsible_person: str,
        responsible_phone: Optional[str] = None,
        deadline: Optional[datetime] = None,
        assigned_by: Optional[str] = None
    ) -> Hazard:
        hazard = self.db.query(Hazard).filter(Hazard.id == hazard_id).first()
        if not hazard:
            raise ValueError(f"隐患 {hazard_id} 不存在")
        
        if hazard.status not in [HazardStatus.PENDING, HazardStatus.ASSIGNED]:
            raise ValueError(f"当前状态 {hazard.status.value} 无法进行分配操作")
        
        hazard.responsible_person = responsible_person
        hazard.responsible_phone = responsible_phone
        hazard.deadline = deadline
        hazard.status = HazardStatus.ASSIGNED
        hazard.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(hazard)
        return hazard

    def start_rectification(
        self,
        hazard_id: int,
        started_by: Optional[str] = None
    ) -> Hazard:
        hazard = self.db.query(Hazard).filter(Hazard.id == hazard_id).first()
        if not hazard:
            raise ValueError(f"隐患 {hazard_id} 不存在")
        
        if hazard.status not in [HazardStatus.ASSIGNED, HazardStatus.REJECTED]:
            raise ValueError(f"当前状态 {hazard.status.value} 无法开始整改")
        
        hazard.status = HazardStatus.RECTIFYING
        hazard.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(hazard)
        return hazard

    def complete_rectification(
        self,
        hazard_id: int,
        rectifier: str,
        action_taken: str,
        measures: Optional[str] = None,
        cost: int = 0,
        completed_at: Optional[datetime] = None,
        remarks: Optional[str] = None
    ) -> Rectification:
        hazard = self.db.query(Hazard).filter(Hazard.id == hazard_id).first()
        if not hazard:
            raise ValueError(f"隐患 {hazard_id} 不存在")
        
        if hazard.status != HazardStatus.RECTIFYING:
            raise ValueError(f"当前状态 {hazard.status.value} 无法完成整改")
        
        rectification = Rectification(
            hazard_id=hazard_id,
            rectifier=rectifier,
            action_taken=action_taken,
            measures=measures,
            cost=cost,
            started_at=hazard.updated_at,
            completed_at=completed_at or datetime.utcnow(),
            remarks=remarks
        )
        self.db.add(rectification)
        
        hazard.status = HazardStatus.REVIEWING
        hazard.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(rectification)
        return rectification

    def submit_review(
        self,
        hazard_id: int,
        reviewer: str,
        result: ReviewResult,
        comments: Optional[str] = None,
        suggestions: Optional[str] = None,
        next_review_date: Optional[datetime] = None,
        reviewed_at: Optional[datetime] = None
    ) -> Review:
        hazard = self.db.query(Hazard).filter(Hazard.id == hazard_id).first()
        if not hazard:
            raise ValueError(f"隐患 {hazard_id} 不存在")
        
        if hazard.status != HazardStatus.REVIEWING:
            raise ValueError(f"当前状态 {hazard.status.value} 无法进行复查")
        
        is_passed = result == ReviewResult.PASS
        
        review = Review(
            hazard_id=hazard_id,
            reviewer=reviewer,
            reviewed_at=reviewed_at or datetime.utcnow(),
            result=result,
            is_passed=is_passed,
            comments=comments,
            suggestions=suggestions,
            next_review_date=next_review_date
        )
        self.db.add(review)
        
        if is_passed:
            hazard.status = HazardStatus.CLOSED
            hazard.closed_at = datetime.utcnow()
            hazard.closed_by = reviewer
        elif result == ReviewResult.NEED_RECTIFY:
            hazard.status = HazardStatus.RECTIFYING
        else:
            hazard.status = HazardStatus.REJECTED
        
        hazard.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(review)
        return review

    def reopen_hazard(
        self,
        hazard_id: int,
        reason: str,
        reopened_by: Optional[str] = None
    ) -> Hazard:
        hazard = self.db.query(Hazard).filter(Hazard.id == hazard_id).first()
        if not hazard:
            raise ValueError(f"隐患 {hazard_id} 不存在")
        
        if hazard.status != HazardStatus.CLOSED:
            raise ValueError(f"只有已闭环的隐患才能重新打开")
        
        hazard.status = HazardStatus.REVIEWING
        hazard.closed_at = None
        hazard.closed_by = None
        hazard.remarks = f"{hazard.remarks or ''}\n重新打开原因: {reason}"
        hazard.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(hazard)
        return hazard

    def get_allowed_transitions(self, current_status: HazardStatus) -> List[HazardStatus]:
        transition_map = {
            HazardStatus.PENDING: [HazardStatus.ASSIGNED],
            HazardStatus.ASSIGNED: [HazardStatus.RECTIFYING],
            HazardStatus.RECTIFYING: [HazardStatus.REVIEWING],
            HazardStatus.REVIEWING: [HazardStatus.CLOSED, HazardStatus.RECTIFYING, HazardStatus.REJECTED],
            HazardStatus.CLOSED: [HazardStatus.REVIEWING],
            HazardStatus.REJECTED: [HazardStatus.RECTIFYING]
        }
        return transition_map.get(current_status, [])

    def can_transition_to(self, current_status: HazardStatus, target_status: HazardStatus) -> bool:
        return target_status in self.get_allowed_transitions(current_status)

    def get_workflow_summary(self, hazard_id: int) -> Dict[str, Any]:
        hazard = self.db.query(Hazard).filter(Hazard.id == hazard_id).first()
        if not hazard:
            raise ValueError(f"隐患 {hazard_id} 不存在")
        
        rectifications = self.db.query(Rectification).filter(
            Rectification.hazard_id == hazard_id
        ).order_by(Rectification.created_at).all()
        
        reviews = self.db.query(Review).filter(
            Review.hazard_id == hazard_id
        ).order_by(Review.created_at).all()
        
        return {
            "hazard_id": hazard.id,
            "hazard_code": hazard.hazard_code,
            "current_status": hazard.status.value,
            "current_status_label": self._get_status_label(hazard.status),
            "allowed_next_status": [s.value for s in self.get_allowed_transitions(hazard.status)],
            "rectification_count": len(rectifications),
            "review_count": len(reviews),
            "rectification_history": [
                {
                    "rectifier": r.rectifier,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                    "action_taken": r.action_taken,
                    "cost": r.cost
                }
                for r in rectifications
            ],
            "review_history": [
                {
                    "reviewer": r.reviewer,
                    "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                    "result": r.result.value,
                    "is_passed": r.is_passed,
                    "comments": r.comments
                }
                for r in reviews
            ],
            "created_at": hazard.created_at.isoformat(),
            "closed_at": hazard.closed_at.isoformat() if hazard.closed_at else None
        }

    def _get_status_label(self, status: HazardStatus) -> str:
        label_map = {
            HazardStatus.PENDING: "待分配",
            HazardStatus.ASSIGNED: "已分配",
            HazardStatus.RECTIFYING: "整改中",
            HazardStatus.REVIEWING: "待复查",
            HazardStatus.CLOSED: "已闭环",
            HazardStatus.REJECTED: "整改不通过"
        }
        return label_map.get(status, status.value)

    def batch_update_status(
        self,
        hazard_ids: List[int],
        target_status: HazardStatus,
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        success_count = 0
        failed_count = 0
        errors = []
        
        for hazard_id in hazard_ids:
            try:
                hazard = self.db.query(Hazard).filter(Hazard.id == hazard_id).first()
                if not hazard:
                    errors.append(f"隐患 {hazard_id}: 不存在")
                    failed_count += 1
                    continue
                
                if not self.can_transition_to(hazard.status, target_status):
                    errors.append(f"隐患 {hazard_id}: 无法从 {hazard.status.value} 变更为 {target_status.value}")
                    failed_count += 1
                    continue
                
                hazard.status = target_status
                hazard.updated_at = datetime.utcnow()
                success_count += 1
            except Exception as e:
                errors.append(f"隐患 {hazard_id}: {str(e)}")
                failed_count += 1
        
        self.db.commit()
        
        return {
            "success_count": success_count,
            "failed_count": failed_count,
            "errors": errors
        }


workflow_service = WorkflowService
