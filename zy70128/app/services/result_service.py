from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from app.models.result import ResultVersion, ResultRecord
from app.models.race import Race
from app.schemas.result import ResultVersionCreate, ResultRecordCreate
from app.services.exception_service import ExceptionService


class ResultService:
    """成绩服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.exception_service = ExceptionService(db)

    async def create_version(self, version_data: ResultVersionCreate) -> Optional[ResultVersion]:
        """创建成绩版本"""
        max_version_result = await self.db.execute(
            select(ResultVersion).where(
                ResultVersion.race_id == version_data.race_id
            ).order_by(ResultVersion.version_number.desc())
        )
        max_version = max_version_result.scalars().first()
        next_version_number = max_version.version_number + 1 if max_version else 1

        version = ResultVersion(
            race_id=version_data.race_id,
            version_number=next_version_number,
            notes=version_data.notes,
            created_by=version_data.created_by,
        )
        self.db.add(version)
        await self.db.flush()

        for record_data in version_data.records:
            record = ResultRecord(
                version_id=version.id,
                athlete_id=record_data.athlete_id,
                athlete_name=record_data.athlete_name,
                bib_number=record_data.bib_number,
                start_time=record_data.start_time,
                end_time=record_data.end_time,
                duration_seconds=record_data.duration_seconds,
                rank=record_data.rank,
                category=record_data.category,
                status=record_data.status,
                source=record_data.source,
            )
            self.db.add(record)

        await self.db.flush()
        return version

    async def get_version(self, version_id: int, include_records: bool = True) -> Optional[ResultVersion]:
        """获取成绩版本"""
        stmt = select(ResultVersion).where(ResultVersion.id == version_id)
        if include_records:
            stmt = stmt.options(selectinload(ResultVersion.records))

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_versions(
        self,
        race_id: Optional[int] = None,
        is_latest: Optional[bool] = None,
        is_public: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[ResultVersion]:
        """列出成绩版本"""
        conditions = []
        if race_id is not None:
            conditions.append(ResultVersion.race_id == race_id)
        if is_latest is not None:
            conditions.append(ResultVersion.is_latest == is_latest)
        if is_public is not None:
            conditions.append(ResultVersion.is_public == is_public)

        stmt = select(ResultVersion)
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.order_by(ResultVersion.created_at.desc()).limit(limit).offset(offset)

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_latest_version(self, race_id: int, include_records: bool = True) -> Optional[ResultVersion]:
        """获取最新的成绩版本"""
        stmt = select(ResultVersion).where(
            and_(
                ResultVersion.race_id == race_id,
                ResultVersion.is_latest == True,
            )
        )
        if include_records:
            stmt = stmt.options(selectinload(ResultVersion.records))

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def publish_version(self, version_id: int) -> Optional[ResultVersion]:
        """发布成绩版本"""
        version = await self.get_version(version_id)
        if not version:
            return None

        await self.db.execute(
            select(ResultVersion).where(
                ResultVersion.race_id == version.race_id
            )
        )

        await self.db.execute(
            ResultVersion.__table__.update().where(
                ResultVersion.race_id == version.race_id
            ).values(is_public=False)
        )

        version.is_public = True
        version.is_latest = True
        version.published_at = datetime.utcnow()

        await self.db.flush()
        return version

    async def create_new_version_from_previous(
        self,
        race_id: int,
        notes: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> Optional[ResultVersion]:
        """基于最新版本创建新版本"""
        latest_version = await self.get_latest_version(race_id, include_records=True)
        if not latest_version:
            return None

        new_version = ResultVersion(
            race_id=race_id,
            version_number=latest_version.version_number + 1,
            notes=notes,
            created_by=created_by,
        )
        self.db.add(new_version)
        await self.db.flush()

        for record in latest_version.records:
            new_record = ResultRecord(
                version_id=new_version.id,
                athlete_id=record.athlete_id,
                athlete_name=record.athlete_name,
                bib_number=record.bib_number,
                start_time=record.start_time,
                end_time=record.end_time,
                duration_seconds=record.duration_seconds,
                rank=record.rank,
                category=record.category,
                status=record.status,
                source=record.source,
            )
            self.db.add(new_record)

        await self.db.flush()
        return new_version

    async def update_record(
        self,
        record_id: int,
        updates: Dict[str, Any],
    ) -> Optional[ResultRecord]:
        """更新成绩记录"""
        stmt = select(ResultRecord).where(ResultRecord.id == record_id)
        result = await self.db.execute(stmt)
        record = result.scalar_one_or_none()
        if not record:
            return None

        for key, value in updates.items():
            if hasattr(record, key):
                setattr(record, key, value)

        await self.db.flush()
        return record

    async def validate_version_consistency(self, version_id: int) -> Dict[str, Any]:
        """验证成绩版本一致性"""
        version = await self.get_version(version_id, include_records=True)
        if not version:
            return {"valid": False, "errors": ["版本不存在"]}

        errors = []
        inconsistencies = []

        records_by_athlete = {}
        for record in version.records:
            if record.athlete_id in records_by_athlete:
                errors.append(f"运动员ID重复: {record.athlete_id}")
            records_by_athlete[record.athlete_id] = record

        ranks = [record.rank for record in version.records if record.rank is not None and record.status == "FINISHED"]
        expected_ranks = list(range(1, len(ranks) + 1))
        actual_ranks = sorted(ranks)
        if expected_ranks != actual_ranks:
            inconsistencies.append("名次不连续或缺失")

        version_notes = "成绩一致性检查完成"

        return {
            "valid": len(errors) == 0 and len(inconsistencies) == 0,
            "errors": errors,
            "inconsistencies": inconsistencies,
            "notes": version_notes,
        }
