from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update
from sqlalchemy.orm import selectinload
from app.models.exception import ExceptionRecord, ExceptionType
from app.schemas.exception import ExceptionRecordCreate


class ExceptionService:
    """异常记录服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_exception(
        self,
        exception_type: str,
        title: str,
        source_module: Optional[str] = None,
        severity: str = "MEDIUM",
        description: Optional[str] = None,
        raw_data: Optional[str] = None,
        related_record_id: Optional[str] = None,
        related_record_type: Optional[str] = None,
    ) -> ExceptionRecord:
        """创建异常记录"""

        exception = ExceptionRecord(
            exception_type=exception_type,
            title=title,
            source_module=source_module,
            severity=severity,
            description=description,
            raw_data=raw_data,
            related_record_id=related_record_id,
            related_record_type=related_record_type,
            status="OPEN",
            is_handled=False,
        )
        self.db.add(exception)
        await self.db.flush()
        return exception

    async def get_exception(self, exception_id: int) -> Optional[ExceptionRecord]:
        """获取单条异常记录"""
        result = await self.db.execute(
            select(ExceptionRecord).where(ExceptionRecord.id == exception_id)
        )
        return result.scalar_one_or_none()

    async def list_exceptions(
        self,
        status: Optional[str] = None,
        exception_type: Optional[str] = None,
        severity: Optional[str] = None,
        related_record_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[ExceptionRecord]:
        """列出异常记录"""
        conditions = []
        if status:
            conditions.append(ExceptionRecord.status == status)
        if exception_type:
            conditions.append(ExceptionRecord.exception_type == exception_type)
        if severity:
            conditions.append(ExceptionRecord.severity == severity)
        if related_record_id:
            conditions.append(ExceptionRecord.related_record_id == related_record_id)

        stmt = select(ExceptionRecord)
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.order_by(ExceptionRecord.created_at.desc()).limit(limit).offset(offset)

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def handle_exception(
        self,
        exception_id: int,
        handled_by: str,
        resolution_notes: str,
        status: str = "RESOLVED",
    ) -> Optional[ExceptionRecord]:
        """处理异常记录"""
        exception = await self.get_exception(exception_id)
        if not exception:
            return None

        exception.status = status
        exception.is_handled = True
        exception.handled_at = datetime.utcnow()
        exception.handled_by = handled_by
        exception.resolution_notes = resolution_notes

        await self.db.flush()
        return exception

    async def ignore_exception(
        self,
        exception_id: int,
        handled_by: str,
        reason: str,
    ) -> Optional[ExceptionRecord]:
        """忽略异常记录"""
        return await self.handle_exception(
            exception_id=exception_id,
            handled_by=handled_by,
            resolution_notes=reason,
            status="IGNORED",
        )

    async def count_exceptions(
        self,
        status: Optional[str] = None,
        exception_type: Optional[str] = None,
        severity: Optional[str] = None,
    ) -> int:
        """统计异常数量"""
        conditions = []
        if status:
            conditions.append(ExceptionRecord.status == status)
        if exception_type:
            conditions.append(ExceptionRecord.exception_type == exception_type)
        if severity:
            conditions.append(ExceptionRecord.severity == severity)

        stmt = select(ExceptionRecord.id)
        if conditions:
            stmt = stmt.where(and_(*conditions))

        result = await self.db.execute(stmt)
        return len(result.scalars().all())
