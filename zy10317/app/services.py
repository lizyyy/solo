from datetime import datetime
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi import HTTPException
from app.models import (
    SyncChannel, Watermark, SourceBatch, ConsumerConfirmation,
    RollbackPoint, DiffSummary, ChannelStatus, BatchStatus
)
from app.schemas import (
    ChannelCreate, ChannelUpdate, WatermarkCreate,
    BatchCreate, BatchUpdate, ConfirmationCreate,
    RollbackPointCreate, RollbackExecute, DiffSummaryCreate
)


class ChannelService:
    @staticmethod
    def create_channel(db: Session, channel: ChannelCreate) -> SyncChannel:
        db_channel = db.query(SyncChannel).filter(
            SyncChannel.channel_code == channel.channel_code
        ).first()
        if db_channel:
            raise HTTPException(status_code=400, detail="通道编码已存在")

        db_channel = SyncChannel(
            channel_code=channel.channel_code,
            channel_name=channel.channel_name,
            source_system=channel.source_system,
            target_system=channel.target_system,
            description=channel.description,
            status=ChannelStatus.ACTIVE,
            created_by=channel.created_by,
            updated_by=channel.created_by
        )
        db.add(db_channel)
        db.flush()

        if channel.initial_watermark:
            db_watermark = Watermark(
                channel_id=db_channel.id,
                watermark_value=channel.initial_watermark,
                watermark_time=datetime.utcnow(),
                sequence=1,
                is_current=True,
                created_by=channel.created_by,
                remark="初始水位"
            )
            db.add(db_watermark)
            db_channel.current_watermark = channel.initial_watermark
            db_channel.current_watermark_time = datetime.utcnow()

        db.commit()
        db.refresh(db_channel)
        return db_channel

    @staticmethod
    def get_channel(db: Session, channel_code: str) -> Optional[SyncChannel]:
        return db.query(SyncChannel).filter(
            SyncChannel.channel_code == channel_code
        ).first()

    @staticmethod
    def get_channel_or_404(db: Session, channel_code: str) -> SyncChannel:
        channel = ChannelService.get_channel(db, channel_code)
        if not channel:
            raise HTTPException(status_code=404, detail="通道不存在")
        return channel

    @staticmethod
    def list_channels(db: Session, status: Optional[ChannelStatus] = None) -> List[SyncChannel]:
        query = db.query(SyncChannel)
        if status:
            query = query.filter(SyncChannel.status == status)
        return query.order_by(desc(SyncChannel.created_at)).all()

    @staticmethod
    def update_channel(db: Session, channel_code: str, update: ChannelUpdate) -> SyncChannel:
        channel = ChannelService.get_channel_or_404(db, channel_code)
        update_data = update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(channel, field, value)
        channel.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(channel)
        return channel


class WatermarkService:
    @staticmethod
    def advance_watermark(
        db: Session,
        watermark_create: WatermarkCreate
    ) -> Tuple[Watermark, bool]:
        channel = ChannelService.get_channel_or_404(db, watermark_create.channel_code)

        if channel.status != ChannelStatus.ACTIVE:
            raise HTTPException(status_code=400, detail=f"通道状态为 {channel.status}，无法推进水位")

        existing = db.query(Watermark).filter(
            Watermark.channel_id == channel.id,
            Watermark.watermark_value == watermark_create.watermark_value,
            Watermark.is_current == True
        ).first()
        if existing:
            return existing, True

        max_sequence = db.query(Watermark).filter(
            Watermark.channel_id == channel.id
        ).with_entities(Watermark.sequence).order_by(
            desc(Watermark.sequence)
        ).first()
        next_sequence = (max_sequence[0] + 1) if max_sequence else 1

        db.query(Watermark).filter(
            Watermark.channel_id == channel.id,
            Watermark.is_current == True
        ).update({Watermark.is_current: False})

        db_watermark = Watermark(
            channel_id=channel.id,
            watermark_value=watermark_create.watermark_value,
            watermark_time=watermark_create.watermark_time,
            sequence=next_sequence,
            is_current=True,
            created_by=watermark_create.created_by,
            remark=watermark_create.remark
        )
        db.add(db_watermark)

        channel.current_watermark = watermark_create.watermark_value
        channel.current_watermark_time = watermark_create.watermark_time
        channel.updated_at = datetime.utcnow()
        channel.updated_by = watermark_create.created_by

        db.commit()
        db.refresh(db_watermark)
        return db_watermark, False

    @staticmethod
    def get_watermark_history(db: Session, channel_code: str, limit: int = 20) -> List[Watermark]:
        channel = ChannelService.get_channel_or_404(db, channel_code)
        return db.query(Watermark).filter(
            Watermark.channel_id == channel.id
        ).order_by(desc(Watermark.sequence)).limit(limit).all()


class BatchService:
    @staticmethod
    def create_batch(db: Session, batch: BatchCreate) -> SourceBatch:
        channel = ChannelService.get_channel_or_404(db, batch.channel_code)

        existing = db.query(SourceBatch).filter(
            SourceBatch.batch_id == batch.batch_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="批次ID已存在")

        db_batch = SourceBatch(
            channel_id=channel.id,
            batch_id=batch.batch_id,
            start_watermark=batch.start_watermark,
            end_watermark=batch.end_watermark,
            start_time=batch.start_time,
            end_time=batch.end_time,
            record_count=batch.record_count,
            data_size=batch.data_size,
            status=BatchStatus.PENDING
        )
        db.add(db_batch)
        db.commit()
        db.refresh(db_batch)
        return db_batch

    @staticmethod
    def get_batch(db: Session, batch_id: str) -> Optional[SourceBatch]:
        return db.query(SourceBatch).filter(SourceBatch.batch_id == batch_id).first()

    @staticmethod
    def get_batch_or_404(db: Session, batch_id: str) -> SourceBatch:
        batch = BatchService.get_batch(db, batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="批次不存在")
        return batch

    @staticmethod
    def update_batch_status(
        db: Session,
        batch_id: str,
        update: BatchUpdate
    ) -> SourceBatch:
        batch = BatchService.get_batch_or_404(db, batch_id)
        update_data = update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(batch, field, value)
        batch.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(batch)
        return batch

    @staticmethod
    def list_batches(db: Session, channel_code: Optional[str] = None,
                    status: Optional[BatchStatus] = None, limit: int = 50) -> List[SourceBatch]:
        query = db.query(SourceBatch)
        if channel_code:
            channel = ChannelService.get_channel_or_404(db, channel_code)
            query = query.filter(SourceBatch.channel_id == channel.id)
        if status:
            query = query.filter(SourceBatch.status == status)
        return query.order_by(desc(SourceBatch.created_at)).limit(limit).all()


class ConfirmationService:
    @staticmethod
    def create_confirmation(
        db: Session,
        confirmation: ConfirmationCreate
    ) -> Tuple[ConsumerConfirmation, bool]:
        batch = BatchService.get_batch_or_404(db, confirmation.batch_id)

        existing = db.query(ConsumerConfirmation).filter(
            ConsumerConfirmation.batch_id == batch.id,
            ConsumerConfirmation.consumer_id == confirmation.consumer_id
        ).first()
        if existing:
            return existing, True

        current_watermark = db.query(Watermark).filter(
            Watermark.channel_id == batch.channel_id,
            Watermark.is_current == True
        ).first()
        if not current_watermark:
            raise HTTPException(status_code=400, detail="通道无当前水位，无法确认")

        db_confirmation = ConsumerConfirmation(
            batch_id=batch.id,
            watermark_id=current_watermark.id,
            consumer_id=confirmation.consumer_id,
            confirmed_count=confirmation.confirmed_count,
            success=confirmation.success,
            processing_time_ms=confirmation.processing_time_ms,
            error_message=confirmation.error_message
        )
        db.add(db_confirmation)

        if confirmation.success:
            batch.status = BatchStatus.CONFIRMED
        else:
            batch.status = BatchStatus.ERROR
            batch.error_message = confirmation.error_message

        batch.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(db_confirmation)
        return db_confirmation, False

    @staticmethod
    def get_confirmations_by_batch(db: Session, batch_id: str) -> List[ConsumerConfirmation]:
        batch = BatchService.get_batch_or_404(db, batch_id)
        return db.query(ConsumerConfirmation).filter(
            ConsumerConfirmation.batch_id == batch.id
        ).order_by(desc(ConsumerConfirmation.confirmed_at)).all()


class RollbackService:
    @staticmethod
    def create_rollback_point(
        db: Session,
        rollback_create: RollbackPointCreate
    ) -> RollbackPoint:
        channel = ChannelService.get_channel_or_404(db, rollback_create.channel_code)

        db_point = RollbackPoint(
            channel_id=channel.id,
            watermark_value=rollback_create.watermark_value,
            watermark_time=rollback_create.watermark_time,
            point_name=rollback_create.point_name,
            created_by=rollback_create.created_by,
            remark=rollback_create.remark
        )
        db.add(db_point)
        db.commit()
        db.refresh(db_point)
        return db_point

    @staticmethod
    def execute_rollback(
        db: Session,
        rollback_execute: RollbackExecute
    ) -> dict:
        channel = ChannelService.get_channel_or_404(db, rollback_execute.channel_code)

        rollback_point = db.query(RollbackPoint).filter(
            RollbackPoint.id == rollback_execute.rollback_point_id,
            RollbackPoint.channel_id == channel.id
        ).first()
        if not rollback_point:
            raise HTTPException(status_code=404, detail="回退点不存在")
        if not rollback_point.is_active:
            raise HTTPException(status_code=400, detail="回退点已失效")

        previous_watermark = channel.current_watermark

        db.query(Watermark).filter(
            Watermark.channel_id == channel.id,
            Watermark.is_current == True
        ).update({Watermark.is_current: False})

        max_sequence = db.query(Watermark).filter(
            Watermark.channel_id == channel.id
        ).with_entities(Watermark.sequence).order_by(
            desc(Watermark.sequence)
        ).first()
        next_sequence = (max_sequence[0] + 1) if max_sequence else 1

        db_watermark = Watermark(
            channel_id=channel.id,
            watermark_value=rollback_point.watermark_value,
            watermark_time=rollback_point.watermark_time,
            sequence=next_sequence,
            is_current=True,
            created_by=rollback_execute.executed_by,
            remark=f"回退至: {rollback_point.point_name}"
        )
        db.add(db_watermark)

        channel.current_watermark = rollback_point.watermark_value
        channel.current_watermark_time = rollback_point.watermark_time
        channel.updated_at = datetime.utcnow()
        channel.updated_by = rollback_execute.executed_by

        affected_batches = db.query(SourceBatch).filter(
            SourceBatch.channel_id == channel.id,
            SourceBatch.end_watermark > rollback_point.watermark_value
        ).all()
        for batch in affected_batches:
            batch.status = BatchStatus.ROLLED_BACK
            batch.updated_at = datetime.utcnow()

        db.commit()
        return {
            "success": True,
            "previous_watermark": previous_watermark,
            "new_watermark": rollback_point.watermark_value,
            "rolled_back_batches_count": len(affected_batches),
            "executed_by": rollback_execute.executed_by,
            "executed_at": datetime.utcnow()
        }

    @staticmethod
    def list_rollback_points(db: Session, channel_code: str, active_only: bool = True) -> List[RollbackPoint]:
        channel = ChannelService.get_channel_or_404(db, channel_code)
        query = db.query(RollbackPoint).filter(RollbackPoint.channel_id == channel.id)
        if active_only:
            query = query.filter(RollbackPoint.is_active == True)
        return query.order_by(desc(RollbackPoint.created_at)).all()


class DiffService:
    @staticmethod
    def create_diff_summary(db: Session, diff_create: DiffSummaryCreate) -> DiffSummary:
        channel = ChannelService.get_channel_or_404(db, diff_create.channel_code)

        diff_count = (diff_create.missing_in_target +
                      diff_create.missing_in_source +
                      diff_create.mismatch_count)

        db_diff = DiffSummary(
            channel_id=channel.id,
            scan_start_time=diff_create.scan_start_time,
            scan_end_time=diff_create.scan_end_time,
            start_watermark=diff_create.start_watermark,
            end_watermark=diff_create.end_watermark,
            source_count=diff_create.source_count,
            target_count=diff_create.target_count,
            diff_count=diff_count,
            missing_in_target=diff_create.missing_in_target,
            missing_in_source=diff_create.missing_in_source,
            mismatch_count=diff_create.mismatch_count,
            scan_status="completed",
            scanned_by=diff_create.scanned_by,
            remark=diff_create.remark
        )
        db.add(db_diff)
        db.commit()
        db.refresh(db_diff)
        return db_diff

    @staticmethod
    def get_diff_history(db: Session, channel_code: Optional[str] = None, limit: int = 20) -> List[DiffSummary]:
        query = db.query(DiffSummary)
        if channel_code:
            channel = ChannelService.get_channel_or_404(db, channel_code)
            query = query.filter(DiffSummary.channel_id == channel.id)
        return query.order_by(desc(DiffSummary.created_at)).limit(limit).all()
