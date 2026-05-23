import json
from datetime import datetime, date
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from .models import (
    Batch, Record, Attachment, StatusTrail, CorrectionTrail,
    BatchStatus, RecordType, DirtyType, User
)
from .schemas import BatchCreate, RecordCreate, RecordUpdate, BatchUpdate


class StateMachine:
    VALID_TRANSITIONS = {
        BatchStatus.DRAFT: [BatchStatus.PENDING_REVIEW, BatchStatus.ARCHIVED],
        BatchStatus.PENDING_REVIEW: [BatchStatus.REVIEWED, BatchStatus.REJECTED, BatchStatus.DRAFT],
        BatchStatus.REVIEWED: [BatchStatus.FROZEN, BatchStatus.PENDING_REVIEW],
        BatchStatus.FROZEN: [BatchStatus.REVIEWED, BatchStatus.ARCHIVED],
        BatchStatus.REJECTED: [BatchStatus.DRAFT, BatchStatus.ARCHIVED],
        BatchStatus.ARCHIVED: [],
    }

    @classmethod
    def can_transition(cls, from_status: BatchStatus, to_status: BatchStatus) -> bool:
        return to_status in cls.VALID_TRANSITIONS.get(from_status, [])


class DirtyRecordAnalyzer:
    @staticmethod
    def check_missing_fields(record: Record) -> Tuple[bool, str]:
        required_fields = ['product_name', 'quantity', 'unit_price', 'amount', 'record_date']
        missing = []
        for field in required_fields:
            if getattr(record, field) is None:
                missing.append(field)
        if missing:
            return True, f"缺失必填字段: {', '.join(missing)}"
        return False, ""

    @staticmethod
    def check_cross_date(record: Record, batch: Batch) -> Tuple[bool, str]:
        if record.record_date and batch.delivery_date:
            record_date = record.record_date.date()
            delivery_date = batch.delivery_date.date()
            if record_date != delivery_date:
                return True, f"记录日期({record_date})与批次交货日期({delivery_date})跨日"
        return False, ""

    @staticmethod
    def check_name_change(record: Record, batch: Batch) -> Tuple[bool, str]:
        if record.supplier_name_in_record and batch.supplier_name:
            if record.supplier_name_in_record.strip() != batch.supplier_name.strip():
                return True, f"供应商名称不一致: 记录中是'{record.supplier_name_in_record}', 批次是'{batch.supplier_name}'"
        return False, ""

    @staticmethod
    def check_amount_conflict(record: Record) -> Tuple[bool, str]:
        if record.quantity and record.unit_price and record.amount:
            calculated = record.quantity * record.unit_price
            diff = abs(calculated - record.amount)
            if diff > 0.01:
                return True, f"金额冲突: 数量×单价={calculated:.2f}, 但记录金额={record.amount}"
        return False, ""

    @staticmethod
    def check_quantity_conflict(record: Record, batch_records: List[Record]) -> Tuple[bool, str]:
        same_product_records = [
            r for r in batch_records
            if r.id != record.id
            and r.product_name == record.product_name
            and r.record_type == record.record_type
        ]
        if same_product_records:
            total_quantity = sum(r.quantity or 0 for r in same_product_records) + (record.quantity or 0)
            return True, f"同产品存在多条记录，总数量: {total_quantity}，请确认是否重复"
        return False, ""

    @classmethod
    def analyze_record(cls, record: Record, batch: Batch, batch_records: List[Record]) -> Tuple[DirtyType, str]:
        is_dirty, note = cls.check_missing_fields(record)
        if is_dirty:
            return DirtyType.MISSING_FIELD, note
        
        is_dirty, note = cls.check_cross_date(record, batch)
        if is_dirty:
            return DirtyType.CROSS_DATE, note
        
        is_dirty, note = cls.check_name_change(record, batch)
        if is_dirty:
            return DirtyType.NAME_CHANGE, note
        
        is_dirty, note = cls.check_amount_conflict(record)
        if is_dirty:
            return DirtyType.AMOUNT_CONFLICT, note
        
        is_dirty, note = cls.check_quantity_conflict(record, batch_records)
        if is_dirty:
            return DirtyType.QUANTITY_CONFLICT, note
        
        return DirtyType.CLEAN, ""


class BatchService:
    @staticmethod
    def create_batch(db: Session, batch_data: BatchCreate, user_id: int) -> Batch:
        existing = db.query(Batch).filter(Batch.batch_no == batch_data.batch_no).first()
        if existing:
            raise ValueError(f"批次号 {batch_data.batch_no} 已存在")
        
        batch = Batch(
            batch_no=batch_data.batch_no,
            supplier_name=batch_data.supplier_name,
            delivery_date=batch_data.delivery_date,
            created_by=user_id,
            status=BatchStatus.DRAFT
        )
        db.add(batch)
        db.flush()
        
        StatusTrailService.create_trail(db, batch.id, None, BatchStatus.DRAFT, user_id, "批次创建")
        db.commit()
        db.refresh(batch)
        return batch

    @staticmethod
    def get_batch(db: Session, batch_id: int) -> Optional[Batch]:
        return db.query(Batch).filter(Batch.id == batch_id).first()

    @staticmethod
    def get_batch_by_no(db: Session, batch_no: str) -> Optional[Batch]:
        return db.query(Batch).filter(Batch.batch_no == batch_no).first()

    @staticmethod
    def list_batches(db: Session, skip: int = 0, limit: int = 100, status: Optional[BatchStatus] = None) -> List[Batch]:
        query = db.query(Batch)
        if status:
            query = query.filter(Batch.status == status)
        return query.order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def transition_status(
        db: Session,
        batch_id: int,
        to_status: BatchStatus,
        user_id: int,
        reason: Optional[str] = None
    ) -> Batch:
        batch = BatchService.get_batch(db, batch_id)
        if not batch:
            raise ValueError(f"批次 {batch_id} 不存在")
        
        from_status = batch.status
        if not StateMachine.can_transition(from_status, to_status):
            raise ValueError(f"不允许从 {from_status.value} 转换到 {to_status.value}")
        
        batch.status = to_status
        
        if to_status == BatchStatus.FROZEN:
            BatchService.calculate_settlement(db, batch)
        
        StatusTrailService.create_trail(db, batch_id, from_status, to_status, user_id, reason)
        db.commit()
        db.refresh(batch)
        return batch

    @staticmethod
    def calculate_settlement(db: Session, batch: Batch):
        records = db.query(Record).filter(Record.batch_id == batch.id, Record.is_processed == True).all()
        
        delivery_records = [r for r in records if r.record_type == RecordType.DELIVERY_NOTE]
        weighing_records = [r for r in records if r.record_type == RecordType.WEIGHING_RECORD]
        
        batch.total_delivery_amount = sum(r.amount or 0 for r in delivery_records)
        batch.total_weighing_amount = sum(r.amount or 0 for r in weighing_records)
        
        batch.final_settlement = batch.total_weighing_amount - batch.bad_fruit_deduction - batch.secondary_sorting_loss

    @staticmethod
    def update_batch(db: Session, batch_id: int, update_data: BatchUpdate, user_id: int) -> Batch:
        batch = BatchService.get_batch(db, batch_id)
        if not batch:
            raise ValueError(f"批次 {batch_id} 不存在")
        
        if batch.status not in [BatchStatus.DRAFT, BatchStatus.PENDING_REVIEW]:
            raise ValueError(f"当前状态 {batch.status.value} 不允许修改批次信息")
        
        for key, value in update_data.model_dump(exclude_unset=True).items():
            if hasattr(batch, key) and value is not None:
                setattr(batch, key, value)
        
        db.commit()
        db.refresh(batch)
        return batch


class RecordService:
    @staticmethod
    def create_record(db: Session, record_data: RecordCreate, user_id: int) -> Record:
        batch = BatchService.get_batch(db, record_data.batch_id)
        if not batch:
            raise ValueError(f"批次 {record_data.batch_id} 不存在")
        
        if batch.status not in [BatchStatus.DRAFT, BatchStatus.PENDING_REVIEW]:
            raise ValueError(f"批次状态 {batch.status.value} 不允许添加记录")
        
        existing = db.query(Record).filter(
            Record.batch_id == record_data.batch_id,
            Record.external_ref_no == record_data.external_ref_no,
            Record.record_type == record_data.record_type
        ).first()
        if existing:
            raise ValueError(f"该类型的记录参考号 {record_data.external_ref_no} 已存在于批次中")
        
        record = Record(
            **record_data.model_dump(),
            created_by=user_id
        )
        db.add(record)
        db.flush()
        
        RecordService.analyze_and_update_dirty_status(db, record, batch)
        
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def analyze_and_update_dirty_status(db: Session, record: Record, batch: Batch):
        batch_records = db.query(Record).filter(Record.batch_id == batch.id).all()
        dirty_type, dirty_note = DirtyRecordAnalyzer.analyze_record(record, batch, batch_records)
        
        record.is_dirty = dirty_type != DirtyType.CLEAN
        record.dirty_type = dirty_type
        record.dirty_note = dirty_note
        
        if not record.is_dirty:
            record.is_processed = True

    @staticmethod
    def get_record(db: Session, record_id: int) -> Optional[Record]:
        return db.query(Record).filter(Record.id == record_id).first()

    @staticmethod
    def list_records_by_batch(db: Session, batch_id: int, include_dirty: bool = True) -> List[Record]:
        query = db.query(Record).filter(Record.batch_id == batch_id)
        if not include_dirty:
            query = query.filter(Record.is_dirty == False)
        return query.order_by(Record.created_at.desc()).all()

    @staticmethod
    def update_record(db: Session, record_id: int, update_data: RecordUpdate, user_id: int) -> Record:
        record = RecordService.get_record(db, record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")
        
        batch = BatchService.get_batch(db, record.batch_id)
        if batch.status not in [BatchStatus.DRAFT, BatchStatus.PENDING_REVIEW]:
            raise ValueError(f"批次状态 {batch.status.value} 不允许修改记录")
        
        for key, value in update_data.model_dump(exclude_unset=True).items():
            if hasattr(record, key) and value is not None:
                old_value = str(getattr(record, key)) if getattr(record, key) is not None else None
                new_value = str(value)
                if old_value != new_value:
                    CorrectionTrailService.create_trail(
                        db, record_id, key, old_value, new_value, user_id, "修正字段"
                    )
                    setattr(record, key, value)
        
        RecordService.analyze_and_update_dirty_status(db, record, batch)
        
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def reprocess_record(db: Session, record_id: int, user_id: int) -> Record:
        record = RecordService.get_record(db, record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")
        
        batch = BatchService.get_batch(db, record.batch_id)
        RecordService.analyze_and_update_dirty_status(db, record, batch)
        
        db.commit()
        db.refresh(record)
        return record


class AttachmentService:
    @staticmethod
    def add_attachment(
        db: Session,
        record_id: int,
        file_name: str,
        file_path: str,
        file_type: str,
        file_size: int,
        user_id: int
    ) -> Attachment:
        record = RecordService.get_record(db, record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")
        
        batch = BatchService.get_batch(db, record.batch_id)
        if batch.status == BatchStatus.FROZEN:
            raise ValueError("批次已冻结，不允许添加附件")
        
        attachment = Attachment(
            record_id=record_id,
            file_name=file_name,
            file_path=file_path,
            file_type=file_type,
            file_size=file_size,
            uploaded_by=user_id
        )
        db.add(attachment)
        db.commit()
        db.refresh(attachment)
        return attachment

    @staticmethod
    def list_attachments_by_record(db: Session, record_id: int) -> List[Attachment]:
        return db.query(Attachment).filter(Attachment.record_id == record_id).all()


class StatusTrailService:
    @staticmethod
    def create_trail(
        db: Session,
        batch_id: int,
        from_status: Optional[BatchStatus],
        to_status: BatchStatus,
        user_id: int,
        reason: Optional[str] = None
    ) -> StatusTrail:
        trail = StatusTrail(
            batch_id=batch_id,
            from_status=from_status,
            to_status=to_status,
            changed_by=user_id,
            reason=reason
        )
        db.add(trail)
        return trail

    @staticmethod
    def get_trails_by_batch(db: Session, batch_id: int) -> List[StatusTrail]:
        return db.query(StatusTrail).filter(StatusTrail.batch_id == batch_id).order_by(StatusTrail.changed_at).all()


class CorrectionTrailService:
    @staticmethod
    def create_trail(
        db: Session,
        record_id: int,
        field_name: str,
        old_value: Optional[str],
        new_value: str,
        user_id: int,
        correction_note: Optional[str] = None
    ) -> CorrectionTrail:
        trail = CorrectionTrail(
            record_id=record_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            corrected_by=user_id,
            correction_note=correction_note
        )
        db.add(trail)
        return trail

    @staticmethod
    def get_trails_by_record(db: Session, record_id: int) -> List[CorrectionTrail]:
        return db.query(CorrectionTrail).filter(CorrectionTrail.record_id == record_id).order_by(CorrectionTrail.corrected_at).all()
