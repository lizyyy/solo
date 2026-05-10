from datetime import datetime
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.review import Review, ReviewStatus
from app.models.appeal import Appeal
from app.models.result import ResultVersion
from app.schemas.review import ReviewCreate, ReviewUpdate


class ReviewService:
    """裁判复核服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_review(self, review_data: ReviewCreate) -> Optional[Review]:
        """创建复核记录"""
        if review_data.appeal_id:
            appeal_result = await self.db.execute(
                select(Appeal).where(Appeal.id == review_data.appeal_id)
            )
            if not appeal_result.scalar_one_or_none():
                return None

        if review_data.result_version_id:
            version_result = await self.db.execute(
                select(ResultVersion).where(ResultVersion.id == review_data.result_version_id)
            )
            if not version_result.scalar_one_or_none():
                return None

        review = Review(
            appeal_id=review_data.appeal_id,
            result_version_id=review_data.result_version_id,
            reviewer_id=review_data.reviewer_id,
            reviewer_name=review_data.reviewer_name,
            status=ReviewStatus.DRAFT.value,
            review_type=review_data.review_type,
            findings=review_data.findings,
            recommended_action=review_data.recommended_action,
            evidence_sources=review_data.evidence_sources,
            notes=review_data.notes,
        )
        self.db.add(review)
        await self.db.flush()
        return review

    async def get_review(self, review_id: int) -> Optional[Review]:
        """获取复核记录"""
        result = await self.db.execute(
            select(Review).where(Review.id == review_id)
        )
        return result.scalar_one_or_none()

    async def list_reviews(
        self,
        appeal_id: Optional[int] = None,
        result_version_id: Optional[int] = None,
        status: Optional[str] = None,
        reviewer_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Review]:
        """列出复核记录"""
        conditions = []
        if appeal_id is not None:
            conditions.append(Review.appeal_id == appeal_id)
        if result_version_id is not None:
            conditions.append(Review.result_version_id == result_version_id)
        if status is not None:
            conditions.append(Review.status == status)
        if reviewer_id is not None:
            conditions.append(Review.reviewer_id == reviewer_id)

        stmt = select(Review)
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.order_by(Review.created_at.desc()).limit(limit).offset(offset)

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def update_review(self, review_id: int, update_data: ReviewUpdate) -> Optional[Review]:
        """更新复核记录"""
        review = await self.get_review(review_id)
        if not review:
            return None

        if update_data.status is not None:
            review.status = update_data.status
        if update_data.findings is not None:
            review.findings = update_data.findings
        if update_data.recommended_action is not None:
            review.recommended_action = update_data.recommended_action
        if update_data.evidence_sources is not None:
            review.evidence_sources = update_data.evidence_sources
        if update_data.decision is not None:
            review.decision = update_data.decision
        if update_data.notes is not None:
            review.notes = update_data.notes

        await self.db.flush()
        return review

    async def submit_review(self, review_id: int) -> Optional[Review]:
        """提交复核记录"""
        review = await self.get_review(review_id)
        if not review:
            return None

        review.status = ReviewStatus.SUBMITTED.value
        await self.db.flush()
        return review

    async def approve_review(self, review_id: int, approved_by: str) -> Optional[Review]:
        """批准复核记录"""
        review = await self.get_review(review_id)
        if not review:
            return None

        review.status = ReviewStatus.APPROVED.value
        review.approved_at = datetime.utcnow()
        review.approved_by = approved_by

        await self.db.flush()
        return review

    async def reject_review(self, review_id: int, rejected_by: str, reason: str) -> Optional[Review]:
        """拒绝复核记录"""
        review = await self.get_review(review_id)
        if not review:
            return None

        review.status = ReviewStatus.REJECTED.value
        review.approved_at = datetime.utcnow()
        review.approved_by = rejected_by
        if review.notes:
            review.notes = review.notes + f"\n拒绝原因: {reason}"
        else:
            review.notes = f"拒绝原因: {reason}"

        await self.db.flush()
        return review

    async def list_draft_reviews(self, reviewer_id: Optional[str] = None, limit: int = 100) -> List[Review]:
        """获取草稿状态的复核记录"""
        return await self.list_reviews(
            status=ReviewStatus.DRAFT.value,
            reviewer_id=reviewer_id,
            limit=limit,
        )
