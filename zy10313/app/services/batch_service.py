from datetime import datetime
from typing import List, Optional
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import (
    ImportBatch, ImportItem, StageRecord, BatchStatus, StageType,
    WriteDetail, RollbackPlan, RollbackItem, RollbackReport
)
from app.schemas.schemas import BatchImportRequest, BatchStatusUpdateRequest


class BatchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_idempotent(self, idempotent_key: str) -> Optional[ImportBatch]:
        result = await self.db.execute(
            select(ImportBatch).where(ImportBatch.request_idempotent_key == idempotent_key)
        )
        return result.scalar_one_or_none()

    async def create_batch(self, request: BatchImportRequest) -> ImportBatch:
        existing_batch = await self.check_idempotent(request.batch.idempotent_key)
        if existing_batch:
            return existing_batch

        batch = ImportBatch(
            batch_no=request.batch.batch_no,
            source_system=request.batch.source_system,
            import_type=request.batch.import_type,
            request_idempotent_key=request.batch.idempotent_key,
            created_by=request.batch.created_by,
            total_count=len(request.items),
            extra_metadata=request.batch.extra_metadata,
            status=BatchStatus.PENDING
        )
        self.db.add(batch)
        await self.db.flush()

        for item_data in request.items:
            item = ImportItem(
                batch_id=batch.id,
                item_no=item_data.item_no,
                item_type=item_data.item_type,
                source_data=item_data.source_data
            )
            self.db.add(item)

        for stage in StageType:
            stage_record = StageRecord(
                batch_id=batch.id,
                stage=stage,
                status="pending"
            )
            self.db.add(stage_record)

        await self.db.commit()
        await self.db.refresh(batch)
        return batch

    async def get_batch_by_no(self, batch_no: str) -> Optional[ImportBatch]:
        result = await self.db.execute(
            select(ImportBatch)
            .options(
                selectinload(ImportBatch.items).selectinload(ImportItem.write_details),
                selectinload(ImportBatch.stage_records)
            )
            .where(ImportBatch.batch_no == batch_no)
        )
        return result.scalar_one_or_none()

    async def get_batch_by_id(self, batch_id: int) -> Optional[ImportBatch]:
        result = await self.db.execute(
            select(ImportBatch)
            .options(
                selectinload(ImportBatch.items).selectinload(ImportItem.write_details),
                selectinload(ImportBatch.stage_records)
            )
            .where(ImportBatch.id == batch_id)
        )
        return result.scalar_one_or_none()

    async def update_batch_status(self, batch_id: int, request: BatchStatusUpdateRequest) -> Optional[ImportBatch]:
        batch = await self.get_batch_by_id(batch_id)
        if not batch:
            return None

        batch.status = request.status
        if request.stage:
            batch.current_stage = request.stage

        if request.stage and request.error_message:
            stage_result = await self.db.execute(
                select(StageRecord).where(
                    and_(
                        StageRecord.batch_id == batch_id,
                        StageRecord.stage == request.stage
                    )
                )
            )
            stage_record = stage_result.scalar_one_or_none()
            if stage_record:
                stage_record.status = "failed"
                stage_record.error_message = request.error_message
                if not stage_record.started_at:
                    stage_record.started_at = datetime.utcnow()
                stage_record.completed_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(batch)
        return batch

    async def start_stage(self, batch_id: int, stage: StageType) -> Optional[StageRecord]:
        result = await self.db.execute(
            select(StageRecord).where(
                and_(
                    StageRecord.batch_id == batch_id,
                    StageRecord.stage == stage
                )
            )
        )
        stage_record = result.scalar_one_or_none()
        if not stage_record:
            return None

        stage_record.status = "running"
        stage_record.started_at = datetime.utcnow()
        stage_record.retry_count += 1

        batch = await self.get_batch_by_id(batch_id)
        if batch:
            batch.current_stage = stage
            if batch.status == BatchStatus.PENDING:
                batch.status = BatchStatus.VALIDATING if stage == StageType.VALIDATION else BatchStatus.PROCESSING

        await self.db.commit()
        await self.db.refresh(stage_record)
        return stage_record

    async def complete_stage(self, batch_id: int, stage: StageType, success: bool = True,
                             error_message: str = None, metrics: dict = None) -> Optional[StageRecord]:
        result = await self.db.execute(
            select(StageRecord).where(
                and_(
                    StageRecord.batch_id == batch_id,
                    StageRecord.stage == stage
                )
            )
        )
        stage_record = result.scalar_one_or_none()
        if not stage_record:
            return None

        stage_record.status = "success" if success else "failed"
        stage_record.completed_at = datetime.utcnow()
        stage_record.error_message = error_message
        if metrics:
            stage_record.metrics = metrics

        await self.db.commit()
        await self.db.refresh(stage_record)
        return stage_record

    async def add_write_detail(self, item_id: int, table_name: str, record_id: str,
                               operation_type: str, before_data: dict, after_data: dict) -> WriteDetail:
        detail = WriteDetail(
            item_id=item_id,
            table_name=table_name,
            record_id=record_id,
            operation_type=operation_type,
            before_data=before_data,
            after_data=after_data
        )
        self.db.add(detail)
        await self.db.commit()
        await self.db.refresh(detail)
        return detail

    async def update_item_status(self, item_id: int, status: str, target_id: str = None,
                                 error_message: str = None) -> Optional[ImportItem]:
        result = await self.db.execute(select(ImportItem).where(ImportItem.id == item_id))
        item = result.scalar_one_or_none()
        if not item:
            return None

        item.status = status
        if target_id:
            item.target_id = target_id
        if error_message:
            item.error_message = error_message

        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def query_batches(self, source_system: str = None, import_type: str = None,
                            status: BatchStatus = None, created_by: str = None,
                            start_date: datetime = None, end_date: datetime = None,
                            page: int = 1, page_size: int = 20) -> (List[ImportBatch], int):
        conditions = []
        if source_system:
            conditions.append(ImportBatch.source_system == source_system)
        if import_type:
            conditions.append(ImportBatch.import_type == import_type)
        if status:
            conditions.append(ImportBatch.status == status)
        if created_by:
            conditions.append(ImportBatch.created_by == created_by)
        if start_date:
            conditions.append(ImportBatch.created_at >= start_date)
        if end_date:
            conditions.append(ImportBatch.created_at <= end_date)

        query = select(ImportBatch)
        if conditions:
            query = query.where(and_(*conditions))

        count_result = await self.db.execute(select(ImportBatch.id).where(and_(*conditions)))
        total = len(count_result.all())

        query = query.order_by(ImportBatch.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        batches = result.scalars().all()

        return list(batches), total
