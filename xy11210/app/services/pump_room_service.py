from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
from app.models.models import PumpRoom
from app.schemas.schemas import PumpRoomCreate
from app.utils.logger import logger


class PumpRoomService:
    @staticmethod
    def get_pump_room(db: Session, pump_room_id: int) -> Optional[PumpRoom]:
        return db.query(PumpRoom).filter(PumpRoom.id == pump_room_id).first()
    
    @staticmethod
    def get_pump_room_by_code(db: Session, code: str) -> Optional[PumpRoom]:
        return db.query(PumpRoom).filter(PumpRoom.code == code).first()
    
    @staticmethod
    def get_pump_rooms(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None) -> List[PumpRoom]:
        query = db.query(PumpRoom)
        if status:
            query = query.filter(PumpRoom.status == status)
        return query.offset(skip).limit(limit).all()
    
    @staticmethod
    def create_pump_room(db: Session, pump_room_in: PumpRoomCreate) -> PumpRoom:
        try:
            db_pump_room = PumpRoom(
                code=pump_room_in.code,
                name=pump_room_in.name,
                location=pump_room_in.location,
                building=pump_room_in.building,
                floor=pump_room_in.floor,
                equipment_count=pump_room_in.equipment_count,
                status=pump_room_in.status,
                description=pump_room_in.description
            )
            db.add(db_pump_room)
            db.commit()
            db.refresh(db_pump_room)
            logger.info({"action": "create_pump_room", "pump_room_id": db_pump_room.id, "code": db_pump_room.code})
            return db_pump_room
        except IntegrityError:
            db.rollback()
            logger.warning({"action": "create_pump_room_failed", "reason": "duplicate_code", "code": pump_room_in.code})
            raise ValueError("泵房编号已存在")
    
    @staticmethod
    def init_default_pump_rooms(db: Session) -> None:
        sample_rooms = [
            {"code": "PR-001", "name": "1号地下泵房", "building": "A栋", "floor": "B1", "location": "地下一层东侧"},
            {"code": "PR-002", "name": "2号地下泵房", "building": "B栋", "floor": "B1", "location": "地下一层西侧"},
            {"code": "PR-003", "name": "3号地下泵房", "building": "C栋", "floor": "B2", "location": "地下二层北侧"},
        ]
        
        for room_data in sample_rooms:
            existing = PumpRoomService.get_pump_room_by_code(db, room_data["code"])
            if not existing:
                pump_room_in = PumpRoomCreate(**room_data)
                PumpRoomService.create_pump_room(db, pump_room_in)
                logger.info({"action": "init_default_pump_room", "code": room_data["code"]})
