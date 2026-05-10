from datetime import datetime
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.appeal import Appeal, AppealStatus
from app.models.race import Race
from app.schemas.appeal import AppealCreate, AppealUpdate, AppealStatusUpdate
from app.services.exception_service import ExceptionService


class AppealService:
    """申诉服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.exception_service = ExceptionService(db)

    async def create_appeal(self, appeal_data: AppealCreate) -> Appeal:
        """创建申诉"""
        appeal_number = self._generate_appeal_number()

        appeal = Appeal(
            race_id=appeal_data.race_id,
            appeal_number=appeal_number,
            athlete_id=appeal_data.athlete_id,
            athlete_name=appeal_data.athlete_name,
            bib_number=appeal_data.bib_number,
            status=AppealStatus.PENDING.value,
            appeal_type=appeal_data.appeal_type,
            description=appeal_data.description,
            supporting_documents=appeal_data.supporting_documents,
            submitted_by=appeal_data.submitted_by,
            submitted_at=appeal_data.submitted_at or datetime.utcnow(),
            priority=appeal_data.priority,
        )
        self.db.add(appeal)
        await self.db.flush()
        return appeal

    def _generate_appeal_number(self) -> str:
        """生成申诉编号"""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        import random
        random_suffix = ''.join(random.choices('0123456789', k=4))
        return f"APL-{timestamp}-{random_suffix}"

    async def get_appeal(self, appeal_id: int) -> Optional[Appeal]:
        """获取单个申诉"""
        result = await self.db.execute(
            select(Appeal).where(Appeal.id == appeal_id)
        )
        return result.scalar_one_or_none()

    async def list_appeals(
        self,
        race_id: Optional[int] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        assigned_to: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Appeal]:
        """列出申诉"""
        conditions = []
        if race_id is not None:
            conditions.append(Appeal.race_id == race_id)
        if status is not None:
            conditions.append(Appeal.status == status)
        if priority is not None:
            conditions.append(Appeal.priority == priority)
        if assigned_to is not None:
            conditions.append(Appeal.assigned_to == assigned_to)

        stmt = select(Appeal)
        if conditions:
            stmt = stmt.where(and_(*conditions))

        stmt = stmt.order_by(
            Appeal.priority.desc(),
            Appeal.created_at.desc()
        ).limit(limit).offset(offset)

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def update_appeal(self, appeal_id: int, update_data: AppealUpdate) -> Optional[Appeal]:
        """更新申诉"""
        appeal = await self.get_appeal(appeal_id)
        if not appeal:
            return None

        if update_data.assigned_to is not None:
            appeal.assigned_to = update_data.assigned_to
        if update_data.description is not None:
            appeal.description = update_data.description
        if update_data.supporting_documents is not None:
            appeal.supporting_documents = update_data.supporting_documents
        if update_data.priority is not None:
            appeal.priority = update_data.priority
        if update_data.deadline is not None:
            appeal.deadline = update_data.deadline

        await self.db.flush()
        return appeal

    async def update_status(self, appeal_id: int, status_update: AppealStatusUpdate) -> Optional[Appeal]:
        """更新申诉状态"""
        appeal = await self.get_appeal(appeal_id)
        if not appeal:
            return None

        appeal.status = status_update.status

        if status_update.resolution_notes is not None:
            appeal.resolution_notes = status_update.resolution_notes

        if status_update.status in [AppealStatus.RESOLVED.value, AppealStatus.APPROVED.value, AppealStatus.REJECTED.value]:
            appeal.resolved_at = datetime.utcnow()
            if status_update.resolved_by:
                appeal.resolved_by = status_update.resolved_by

        await self.db.flush()
        return appeal

    async def assign_appeal(self, appeal_id: int, assigned_to: str) -> Optional[Appeal]:
        """分配申诉"""
        appeal = await self.get_appeal(appeal_id)
        if not appeal:
            return None

        appeal.assigned_to = assigned_to
        if appeal.status == AppealStatus.PENDING.value:
            appeal.status = AppealStatus.PROCESSING.value

        await self.db.flush()
        return appeal

    async def count_appeals_by_status(self, race_id: Optional[int] = None) -> dict:
        """按状态统计申诉数量"""
        status_counts = {}

        for status in AppealStatus:
            stmt = select(Appeal).where(Appeal.status == status.value)
            if race_id is not None:
                stmt = stmt.where(Appeal.race_id == race_id)

            result = await self.db.execute(stmt)
            status_counts[status.value] = len(result.scalars().all())

        return status_counts

    async def get_pending_appeals(self, race_id: Optional[int] = None, limit: int = 100) -> List[Appeal]:
        """获取待处理申诉"""
        return await self.list_appeals(
            race_id=race_id,
            status=AppealStatus.PENDING.value,
            limit=limit,
        )
