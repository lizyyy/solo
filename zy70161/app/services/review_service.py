from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from ..models.models import (
    ReviewRequest,
    ReviewStatus,
    TermRule,
    RuleStatus
)
from ..schemas.schemas import ReviewRequestCreate, ReviewApproveRequest
from .state_machine import StateMachineService
from .audit_service import AuditService


class ReviewService:
    def __init__(self, state_machine: StateMachineService):
        self.state_machine = state_machine

    def create_review_request(self, db: Session, review_data: ReviewRequestCreate) -> ReviewRequest:
        rule = db.query(TermRule).filter(TermRule.id == review_data.rule_id).first()
        if not rule:
            raise ValueError(f"规则不存在: id={review_data.rule_id}")

        if rule.status != RuleStatus.DRAFT:
            raise ValueError(
                f"只有「草稿」状态的规则才能提交审核，当前状态为: {self._get_status_display(rule.status)}"
            )

        existing_pending = (
            db.query(ReviewRequest)
            .filter(
                ReviewRequest.rule_id == review_data.rule_id,
                ReviewRequest.status == ReviewStatus.PENDING
            )
            .first()
        )
        if existing_pending:
            raise ValueError(
                f"该规则已有待审核的请求（ID: {existing_pending.id}），请勿重复提交。"
            )

        review = ReviewRequest(
            rule_id=review_data.rule_id,
            status=ReviewStatus.PENDING,
            requested_by=review_data.requested_by,
            comments=review_data.comments,
            requested_at=datetime.utcnow()
        )
        
        db.add(review)
        db.flush()
        
        rule.current_review_id = review.id
        
        AuditService.log_transition(
            db=db,
            rule_id=rule.id,
            action="SUBMIT_REVIEW",
            from_status=RuleStatus.DRAFT,
            to_status=RuleStatus.PENDING_REVIEW,
            actor=review_data.requested_by,
            reason=review_data.comments or "提交审核",
            details={"review_id": review.id}
        )
        
        rule.status = RuleStatus.PENDING_REVIEW
        
        return review

    def process_review(self, db: Session, approval_data: ReviewApproveRequest) -> ReviewRequest:
        review = db.query(ReviewRequest).filter(ReviewRequest.id == approval_data.review_id).first()
        if not review:
            raise ValueError(f"审核请求不存在: id={approval_data.review_id}")

        if review.status != ReviewStatus.PENDING:
            raise ValueError(
                f"该审核请求已处理（状态: {self._get_review_status_display(review.status)}），请勿重复操作。"
            )

        rule = db.query(TermRule).filter(TermRule.id == review.rule_id).first()
        if not rule:
            raise ValueError(f"关联规则不存在: id={review.rule_id}")

        if rule.status != RuleStatus.PENDING_REVIEW:
            raise ValueError(
                f"规则状态已变更，当前状态为: {self._get_status_display(rule.status)}"
            )

        old_status = rule.status
        review.reviewer = approval_data.reviewer
        review.review_comment = approval_data.review_comment
        review.reviewed_at = datetime.utcnow()

        if approval_data.approved:
            review.status = ReviewStatus.APPROVED
            new_status = RuleStatus.PENDING_GRAY
            action = "APPROVE_REVIEW"
            reason = approval_data.review_comment or "审核通过"
        else:
            review.status = ReviewStatus.REJECTED
            new_status = RuleStatus.REVIEW_REJECTED
            action = "REJECT_REVIEW"
            reason = approval_data.review_comment or "审核驳回"

        rule.status = new_status
        rule.current_review_id = None

        AuditService.log_transition(
            db=db,
            rule_id=rule.id,
            action=action,
            from_status=old_status,
            to_status=new_status,
            actor=approval_data.reviewer,
            reason=reason,
            details={
                "review_id": review.id,
                "review_comment": approval_data.review_comment
            }
        )

        return review

    def get_review(self, db: Session, review_id: int) -> Optional[ReviewRequest]:
        return db.query(ReviewRequest).filter(ReviewRequest.id == review_id).first()

    def list_reviews(
        self,
        db: Session,
        rule_id: Optional[int] = None,
        status: Optional[ReviewStatus] = None,
        reviewer: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[ReviewRequest]:
        query = db.query(ReviewRequest)
        
        if rule_id:
            query = query.filter(ReviewRequest.rule_id == rule_id)
        if status:
            query = query.filter(ReviewRequest.status == status)
        if reviewer:
            query = query.filter(ReviewRequest.reviewer == reviewer)
        
        return query.order_by(ReviewRequest.requested_at.desc()).offset(offset).limit(limit).all()

    def get_pending_reviews_count(self, db: Session) -> int:
        return (
            db.query(ReviewRequest)
            .filter(ReviewRequest.status == ReviewStatus.PENDING)
            .count()
        )

    def _get_status_display(self, status: RuleStatus) -> str:
        displays = {
            RuleStatus.DRAFT: "草稿",
            RuleStatus.PENDING_REVIEW: "待审核",
            RuleStatus.REVIEW_REJECTED: "审核驳回",
            RuleStatus.PENDING_GRAY: "待灰度",
            RuleStatus.IN_GRAY: "灰度中",
            RuleStatus.GRAY_REJECTED: "灰度不通过",
            RuleStatus.PRODUCTION: "生产生效",
            RuleStatus.ROLLED_BACK: "已回滚",
            RuleStatus.DEPRECATED: "已废弃"
        }
        return displays.get(status, status.value)

    def _get_review_status_display(self, status: ReviewStatus) -> str:
        displays = {
            ReviewStatus.PENDING: "待审核",
            ReviewStatus.APPROVED: "已通过",
            ReviewStatus.REJECTED: "已驳回"
        }
        return displays.get(status, status.value)
