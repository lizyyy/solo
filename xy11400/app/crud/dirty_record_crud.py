from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import json

from app import models, schemas
from app.models import DirtyRecordType, BoxItem


class DirtyRecordCRUD:
    def get_dirty_record(self, db: Session, record_id: int) -> Optional[models.DirtyRecord]:
        return db.query(models.DirtyRecord).filter(models.DirtyRecord.id == record_id).first()

    def get_dirty_records_by_batch(
        self, db: Session, batch_id: int, include_resolved: bool = False
    ) -> List[models.DirtyRecord]:
        query = db.query(models.DirtyRecord).filter(models.DirtyRecord.batch_id == batch_id)
        if not include_resolved:
            query = query.filter(models.DirtyRecord.is_resolved == False)
        return query.order_by(models.DirtyRecord.created_at.desc()).all()

    def create_dirty_record(
        self,
        db: Session,
        batch_id: int,
        record_in: schemas.DirtyRecordCreate
    ) -> models.DirtyRecord:
        db_record = models.DirtyRecord(
            batch_id=batch_id,
            **record_in.model_dump()
        )
        db.add(db_record)
        db.commit()
        db.refresh(db_record)
        return db_record

    def resolve_dirty_record(
        self,
        db: Session,
        record_id: int,
        resolver_id: int,
        resolution_note: str
    ) -> Optional[models.DirtyRecord]:
        db_record = self.get_dirty_record(db, record_id)
        if not db_record:
            return None

        db_record.is_resolved = True
        db_record.resolved_by = resolver_id
        db_record.resolved_at = datetime.now()
        db_record.resolution_note = resolution_note

        db.commit()
        db.refresh(db_record)
        return db_record

    def detect_missing_fields(
        self,
        db: Session,
        batch_id: int,
        data: dict,
        required_fields: List[str]
    ) -> Optional[models.DirtyRecord]:
        missing = [f for f in required_fields if not data.get(f)]
        if missing:
            record = schemas.DirtyRecordCreate(
                record_type=DirtyRecordType.MISSING_FIELDS,
                source_data=json.dumps(data, ensure_ascii=False),
                missing_fields=",".join(missing),
                handling_suggestion=f"请补充缺失字段: {', '.join(missing)}"
            )
            return self.create_dirty_record(db, batch_id, record)
        return None

    def detect_cross_day_signature(
        self,
        db: Session,
        batch_id: int,
        departure_date: datetime,
        arrival_date: datetime
    ) -> Optional[models.DirtyRecord]:
        if departure_date and arrival_date and departure_date.date() != arrival_date.date():
            days_diff = (arrival_date.date() - departure_date.date()).days
            data = {
                "departure_date": departure_date.isoformat(),
                "arrival_date": arrival_date.isoformat(),
                "days_diff": days_diff
            }
            record = schemas.DirtyRecordCreate(
                record_type=DirtyRecordType.CROSS_DAY,
                source_data=json.dumps(data, ensure_ascii=False),
                cross_day_info=f"跨日签收: {days_diff}天, 可能影响赔付计算",
                handling_suggestion="请确认运输时效是否正常，必要时调整赔付金额"
            )
            return self.create_dirty_record(db, batch_id, record)
        return None

    def detect_box_rename(
        self,
        db: Session,
        batch_id: int,
        old_box_no: str,
        new_box_no: str,
        box_data: dict
    ) -> Optional[models.DirtyRecord]:
        if old_box_no != new_box_no:
            record = schemas.DirtyRecordCreate(
                record_type=DirtyRecordType.BOX_RENAMED,
                source_data=json.dumps(box_data, ensure_ascii=False),
                old_box_no=old_box_no,
                new_box_no=new_box_no,
                handling_suggestion="箱号已变更，请确认新旧箱号对应关系，避免赔付对象错误"
            )
            return self.create_dirty_record(db, batch_id, record)
        return None

    def detect_amount_conflict(
        self,
        db: Session,
        batch_id: int,
        field: str,
        old_value: str,
        new_value: str,
        source_data: dict
    ) -> Optional[models.DirtyRecord]:
        if old_value != new_value:
            record_type = (
                DirtyRecordType.AMOUNT_CONFLICT
                if "amount" in field.lower() or "price" in field.lower()
                else DirtyRecordType.QUANTITY_CONFLICT
            )
            record = schemas.DirtyRecordCreate(
                record_type=record_type,
                source_data=json.dumps(source_data, ensure_ascii=False),
                conflict_field=field,
                old_value=old_value,
                new_value=new_value,
                handling_suggestion=f"{field}存在冲突，请确认正确值"
            )
            return self.create_dirty_record(db, batch_id, record)
        return None

    def reaggregate_after_resolve(self, db: Session, batch_id: int):
        box_items = db.query(BoxItem).filter(BoxItem.batch_id == batch_id).all()
        total_boxes = len(box_items)
        total_amount = sum(item.amount or 0 for item in box_items)

        batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
        if batch:
            batch.total_boxes = total_boxes
            batch.total_amount = total_amount
            db.commit()


dirty_record_crud = DirtyRecordCRUD()
