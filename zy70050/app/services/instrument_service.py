from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.instrument import Instrument, InstrumentStatus
from app.models.user import User
from app.schemas.instrument import InstrumentCreate, InstrumentUpdate
from app.services.history_service import HistoryService
from app.core.config import settings


class InstrumentService:
    @staticmethod
    def create(
        db: Session,
        data: InstrumentCreate,
        created_by: Optional[User] = None,
    ) -> Instrument:
        existing = db.query(Instrument).filter(Instrument.code == data.code).first()
        if existing:
            raise ValueError(f"器具编号 {data.code} 已存在")
        
        instrument = Instrument(
            code=data.code,
            name=data.name,
            specification=data.specification,
            serial_number=data.serial_number,
            manufacturer=data.manufacturer,
            accuracy=data.accuracy,
            measurement_range=data.measurement_range,
            location=data.location,
            calibration_period_months=data.calibration_period_months,
            last_calibration_date=data.last_calibration_date,
            next_calibration_date=data.next_calibration_date,
            created_by=created_by.id if created_by else None,
        )
        
        if data.last_calibration_date and not data.next_calibration_date:
            months = data.calibration_period_months or settings.DEFAULT_CALIBRATION_MONTHS
            instrument.next_calibration_date = data.last_calibration_date + timedelta(days=months * 30)
        
        db.add(instrument)
        db.flush()
        
        HistoryService.record_create(db, instrument, created_by)
        
        db.commit()
        db.refresh(instrument)
        return instrument

    @staticmethod
    def get_by_id(db: Session, instrument_id: int) -> Optional[Instrument]:
        return db.query(Instrument).filter(Instrument.id == instrument_id).first()

    @staticmethod
    def get_by_code(db: Session, code: str) -> Optional[Instrument]:
        return db.query(Instrument).filter(Instrument.code == code).first()

    @staticmethod
    def list(
        db: Session,
        status: Optional[InstrumentStatus] = None,
        keyword: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Instrument]:
        query = db.query(Instrument)
        
        if status:
            query = query.filter(Instrument.status == status)
        
        if keyword:
            query = query.filter(
                (Instrument.code.contains(keyword)) |
                (Instrument.name.contains(keyword)) |
                (Instrument.serial_number.contains(keyword))
            )
        
        return query.order_by(Instrument.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def update(
        db: Session,
        instrument_id: int,
        data: InstrumentUpdate,
        updated_by: Optional[User] = None,
        is_rectify: bool = False,
    ) -> Instrument:
        instrument = InstrumentService.get_by_id(db, instrument_id)
        if not instrument:
            raise ValueError("器具不存在")
        
        old_values = {
            "code": instrument.code,
            "name": instrument.name,
            "status": instrument.status.value if instrument.status else None,
            "location": instrument.location,
            "specification": instrument.specification,
        }
        
        update_data = data.model_dump(exclude_unset=True)
        new_values = {}
        
        for key, value in update_data.items():
            if hasattr(instrument, key):
                new_values[key] = value
                setattr(instrument, key, value)
        
        if update_data.get("last_calibration_date") and not update_data.get("next_calibration_date"):
            months = instrument.calibration_period_months or settings.DEFAULT_CALIBRATION_MONTHS
            instrument.next_calibration_date = instrument.last_calibration_date + timedelta(days=months * 30)
            new_values["next_calibration_date"] = instrument.next_calibration_date
        
        if new_values:
            HistoryService.record_update(
                db=db,
                instrument=instrument,
                old_values=old_values,
                new_values={
                    k: (v.value if hasattr(v, "value") else v)
                    for k, v in new_values.items()
                },
                updated_by=updated_by,
                is_rectify=is_rectify,
            )
        
        db.commit()
        db.refresh(instrument)
        return instrument

    @staticmethod
    def update_status(
        db: Session,
        instrument_id: int,
        new_status: InstrumentStatus,
        operator: Optional[User] = None,
        remark: Optional[str] = None,
    ) -> Instrument:
        instrument = InstrumentService.get_by_id(db, instrument_id)
        if not instrument:
            raise ValueError("器具不存在")
        
        old_status = instrument.status
        instrument.status = new_status
        
        HistoryService.create_history(
            db=db,
            instrument=instrument,
            action="status_change",
            action_description=f"状态变更：{old_status} -> {new_status}",
            old_values={"status": old_status.value if old_status else None},
            new_values={"status": new_status.value},
            created_by=operator,
            remark=remark,
        )
        
        db.commit()
        db.refresh(instrument)
        return instrument

    @staticmethod
    def get_due_calibration(db: Session, days: int = 30) -> List[Instrument]:
        today = datetime.utcnow().date()
        deadline = today + timedelta(days=days)
        return (
            db.query(Instrument)
            .filter(
                and_(
                    Instrument.next_calibration_date.isnot(None),
                    Instrument.next_calibration_date >= today,
                    Instrument.next_calibration_date <= deadline,
                    Instrument.status != InstrumentStatus.DISCARDED,
                    Instrument.status != InstrumentStatus.SEALED,
                )
            )
            .order_by(Instrument.next_calibration_date.asc())
            .all()
        )

    @staticmethod
    def get_overdue_calibration(db: Session) -> List[Instrument]:
        today = datetime.utcnow().date()
        return (
            db.query(Instrument)
            .filter(
                and_(
                    Instrument.next_calibration_date.isnot(None),
                    Instrument.next_calibration_date < today,
                    Instrument.status != InstrumentStatus.DISCARDED,
                    Instrument.status != InstrumentStatus.SEALED,
                )
            )
            .order_by(Instrument.next_calibration_date.asc())
            .all()
        )

    @staticmethod
    def get_stats(db: Session) -> Dict[str, int]:
        total = db.query(Instrument).count()
        stats = {
            "total": total,
            "status_counts": {},
        }
        
        for status in InstrumentStatus:
            count = db.query(Instrument).filter(Instrument.status == status).count()
            stats["status_counts"][status.value] = count
        
        stats["due_calibration"] = len(InstrumentService.get_due_calibration(db))
        stats["overdue_calibration"] = len(InstrumentService.get_overdue_calibration(db))
        
        return stats
