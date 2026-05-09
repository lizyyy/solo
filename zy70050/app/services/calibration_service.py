from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.calibration import Calibration, CalibrationStatus
from app.models.instrument import Instrument, InstrumentStatus
from app.models.user import User
from app.schemas.calibration import CalibrationCreate, CalibrationResult, CalibrationUpdate
from app.services.history_service import HistoryService
from app.core.config import settings


class CalibrationService:
    @staticmethod
    def create(
        db: Session,
        data: CalibrationCreate,
        created_by: Optional[User] = None,
    ) -> Calibration:
        instrument = db.query(Instrument).filter(Instrument.id == data.instrument_id).first()
        if not instrument:
            raise ValueError("器具不存在")
        
        if instrument.status in [InstrumentStatus.SEALED, InstrumentStatus.DISCARDED]:
            raise ValueError(f"器具当前状态为 {instrument.status.value}，无法安排校准")
        
        existing_scheduled = (
            db.query(Calibration)
            .filter(
                Calibration.instrument_id == data.instrument_id,
                Calibration.status.in_([CalibrationStatus.SCHEDULED, CalibrationStatus.IN_PROGRESS]),
            )
            .first()
        )
        if existing_scheduled:
            raise ValueError("该器具存在未完成的校准计划")
        
        calibration = Calibration(
            instrument_id=data.instrument_id,
            calibration_type=data.calibration_type,
            scheduled_date=data.scheduled_date,
            calibration_agency=data.calibration_agency,
            measurement_uncertainty=data.measurement_uncertainty,
            environmental_conditions=data.environmental_conditions,
            status=CalibrationStatus.SCHEDULED,
        )
        
        db.add(calibration)
        db.flush()
        
        HistoryService.create_history(
            db=db,
            instrument=instrument,
            action="update",
            action_description=f"安排校准：{data.calibration_type}，计划日期：{data.scheduled_date}",
            new_values={"calibration_scheduled": data.scheduled_date.isoformat()},
            created_by=created_by,
        )
        
        db.commit()
        db.refresh(calibration)
        return calibration

    @staticmethod
    def get_by_id(db: Session, calibration_id: int) -> Optional[Calibration]:
        return db.query(Calibration).filter(Calibration.id == calibration_id).first()

    @staticmethod
    def list(
        db: Session,
        status: Optional[CalibrationStatus] = None,
        instrument_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Calibration]:
        query = db.query(Calibration)
        
        if status:
            query = query.filter(Calibration.status == status)
        if instrument_id:
            query = query.filter(Calibration.instrument_id == instrument_id)
        
        return query.order_by(Calibration.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def start_calibration(
        db: Session,
        calibration_id: int,
        operator: Optional[User] = None,
    ) -> Calibration:
        calibration = CalibrationService.get_by_id(db, calibration_id)
        if not calibration:
            raise ValueError("校准记录不存在")
        
        if calibration.status != CalibrationStatus.SCHEDULED:
            raise ValueError(f"校准状态为 {calibration.status.value}，无法开始")
        
        instrument = db.query(Instrument).filter(Instrument.id == calibration.instrument_id).first()
        
        calibration.status = CalibrationStatus.IN_PROGRESS
        
        if instrument and instrument.status == InstrumentStatus.IN_STOCK:
            instrument.status = InstrumentStatus.CALIBRATING
            HistoryService.create_history(
                db=db,
                instrument=instrument,
                action="calibrate",
                action_description=f"开始校准：{calibration.calibration_type}",
                old_values={"status": instrument.status.value},
                new_values={"status": "calibrating"},
                created_by=operator,
            )
        
        db.commit()
        db.refresh(calibration)
        return calibration

    @staticmethod
    def complete_calibration(
        db: Session,
        calibration_id: int,
        result_data: CalibrationResult,
        operator: Optional[User] = None,
    ) -> Calibration:
        calibration = CalibrationService.get_by_id(db, calibration_id)
        if not calibration:
            raise ValueError("校准记录不存在")
        
        if calibration.status not in [CalibrationStatus.IN_PROGRESS, CalibrationStatus.SCHEDULED]:
            raise ValueError(f"校准状态为 {calibration.status.value}，无法完成")
        
        instrument = db.query(Instrument).filter(Instrument.id == calibration.instrument_id).first()
        
        calibration.status = CalibrationStatus.PASSED if result_data.result_pass else CalibrationStatus.FAILED
        calibration.calibration_date = result_data.calibration_date
        calibration.certificate_number = result_data.certificate_number
        calibration.remarks = result_data.remarks
        calibration.result_pass = result_data.result_pass
        calibration.calibrated_by = operator.id if operator else None
        
        if instrument:
            old_status = instrument.status
            if instrument.status == InstrumentStatus.CALIBRATING:
                instrument.status = InstrumentStatus.IN_STOCK
            
            if result_data.result_pass:
                instrument.last_calibration_date = result_data.calibration_date
                months = instrument.calibration_period_months or settings.DEFAULT_CALIBRATION_MONTHS
                instrument.next_calibration_date = result_data.calibration_date + timedelta(days=months * 30)
            
            result_str = "合格" if result_data.result_pass else "不合格"
            HistoryService.record_calibration(
                db=db,
                instrument=instrument,
                calibration_type=calibration.calibration_type,
                result=result_str,
                created_by=operator,
            )
        
        db.commit()
        db.refresh(calibration)
        return calibration

    @staticmethod
    def get_overdue_scheduled(db: Session) -> List[Calibration]:
        today = datetime.utcnow().date()
        return (
            db.query(Calibration)
            .filter(
                Calibration.status == CalibrationStatus.SCHEDULED,
                Calibration.scheduled_date < today,
            )
            .order_by(Calibration.scheduled_date.asc())
            .all()
        )
