from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
from datetime import datetime, timedelta
import uuid
from app.models.models import InspectionRecord, InspectionResult
from app.schemas.schemas import InspectionRecordCreate
from app.utils.logger import logger


class InspectionService:
    @staticmethod
    def generate_record_no() -> str:
        date_str = datetime.now().strftime("%Y%m%d")
        uuid_str = str(uuid.uuid4())[:8].upper()
        return f"INSP-{date_str}-{uuid_str}"
    
    @staticmethod
    def get_inspection_record(db: Session, record_id: int) -> Optional[InspectionRecord]:
        return db.query(InspectionRecord).filter(InspectionRecord.id == record_id).first()
    
    @staticmethod
    def get_inspection_record_by_no(db: Session, record_no: str) -> Optional[InspectionRecord]:
        return db.query(InspectionRecord).filter(InspectionRecord.record_no == record_no).first()
    
    @staticmethod
    def get_inspection_records(
        db: Session, 
        skip: int = 0, 
        limit: int = 100,
        pump_room_id: Optional[int] = None,
        result: Optional[InspectionResult] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[InspectionRecord]:
        query = db.query(InspectionRecord)
        
        if pump_room_id:
            query = query.filter(InspectionRecord.pump_room_id == pump_room_id)
        if result:
            query = query.filter(InspectionRecord.result == result)
        if start_date:
            query = query.filter(InspectionRecord.inspection_time >= start_date)
        if end_date:
            query = query.filter(InspectionRecord.inspection_time <= end_date)
        
        return query.order_by(InspectionRecord.inspection_time.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def count_inspection_records(
        db: Session,
        pump_room_id: Optional[int] = None,
        result: Optional[InspectionResult] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> int:
        query = db.query(InspectionRecord)
        
        if pump_room_id:
            query = query.filter(InspectionRecord.pump_room_id == pump_room_id)
        if result:
            query = query.filter(InspectionRecord.result == result)
        if start_date:
            query = query.filter(InspectionRecord.inspection_time >= start_date)
        if end_date:
            query = query.filter(InspectionRecord.inspection_time <= end_date)
        
        return query.count()
    
    @staticmethod
    def create_inspection_record(
        db: Session, 
        record_in: InspectionRecordCreate,
        inspector_id: Optional[int] = None
    ) -> InspectionRecord:
        record_no = record_in.record_no or InspectionService.generate_record_no()
        
        existing = InspectionService.get_inspection_record_by_no(db, record_no)
        if existing:
            logger.warning({"action": "create_inspection_failed", "reason": "duplicate_record_no", "record_no": record_no})
            raise ValueError(f"巡检记录编号 {record_no} 已存在")
        
        try:
            db_record = InspectionRecord(
                record_no=record_no,
                pump_room_id=record_in.pump_room_id,
                inspector_id=inspector_id,
                inspection_time=record_in.inspection_time,
                water_pressure=record_in.water_pressure,
                water_level=record_in.water_level,
                pump_status=record_in.pump_status,
                valve_status=record_in.valve_status,
                pipe_status=record_in.pipe_status,
                electrical_status=record_in.electrical_status,
                temperature=record_in.temperature,
                humidity=record_in.humidity,
                noise_level=record_in.noise_level,
                result=record_in.result,
                issues=record_in.issues,
                remarks=record_in.remarks,
                import_id=record_in.import_id,
                import_batch=record_in.import_batch
            )
            db.add(db_record)
            db.commit()
            db.refresh(db_record)
            logger.info({"action": "create_inspection_record", "record_id": db_record.id, "record_no": record_no})
            return db_record
        except IntegrityError as e:
            db.rollback()
            logger.warning({"action": "create_inspection_failed", "reason": str(e)})
            raise ValueError("创建巡检记录失败")
    
    @staticmethod
    def check_duplicate_import(
        db: Session,
        pump_room_id: int,
        inspection_time: datetime,
        import_id: Optional[str] = None
    ) -> bool:
        query = db.query(InspectionRecord).filter(
            InspectionRecord.pump_room_id == pump_room_id,
            InspectionRecord.inspection_time >= inspection_time - timedelta(minutes=5),
            InspectionRecord.inspection_time <= inspection_time + timedelta(minutes=5)
        )
        
        if import_id:
            query = query.filter(InspectionRecord.import_id == import_id)
        
        return query.first() is not None
