from datetime import datetime
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update
from sqlalchemy.orm import selectinload
from app.models.race import Race
from app.schemas.race import RaceCreate, RaceUpdate


class RaceService:
    """赛事服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_race(self, race_data: RaceCreate) -> Race:
        """创建赛事"""
        race = Race(
            name=race_data.name,
            description=race_data.description,
            race_date=race_data.race_date,
            is_published=race_data.is_published,
        )
        self.db.add(race)
        await self.db.flush()
        return race

    async def get_race(self, race_id: int) -> Optional[Race]:
        """获取单个赛事"""
        result = await self.db.execute(
            select(Race).where(Race.id == race_id)
        )
        return result.scalar_one_or_none()

    async def list_races(
        self,
        is_published: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Race]:
        """列出赛事"""
        stmt = select(Race)
        if is_published is not None:
            stmt = stmt.where(Race.is_published == is_published)
        stmt = stmt.order_by(Race.race_date.desc()).limit(limit).offset(offset)

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def update_race(self, race_id: int, update_data: RaceUpdate) -> Optional[Race]:
        """更新赛事"""
        race = await self.get_race(race_id)
        if not race:
            return None

        if update_data.name is not None:
            race.name = update_data.name
        if update_data.description is not None:
            race.description = update_data.description
        if update_data.race_date is not None:
            race.race_date = update_data.race_date
        if update_data.is_published is not None:
            race.is_published = update_data.is_published

        await self.db.flush()
        return race

    async def delete_race(self, race_id: int) -> bool:
        """删除赛事"""
        race = await self.get_race(race_id)
        if not race:
            return False

        await self.db.delete(race)
        await self.db.flush()
        return True

    async def publish_race(self, race_id: int) -> Optional[Race]:
        """发布赛事"""
        race = await self.get_race(race_id)
        if not race:
            return None

        race.is_published = True
        await self.db.flush()
        return race

    async def unpublish_race(self, race_id: int) -> Optional[Race]:
        """取消发布赛事"""
        race = await self.get_race(race_id)
        if not race:
            return None

        race.is_published = False
        await self.db.flush()
        return race
