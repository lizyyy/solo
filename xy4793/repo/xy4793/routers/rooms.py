from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from database import get_db
from models import Room, Session as SessionModel

router = APIRouter()

class RoomCreate(BaseModel):
    name: str
    capacity: int = 6

class RoomUpdate(BaseModel):
    name: str = None
    capacity: int = None
    is_active: bool = None

class RoomResponse(BaseModel):
    id: int
    name: str
    capacity: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class RoomStatusResponse(BaseModel):
    id: int
    name: str
    capacity: int
    is_active: bool
    current_session: Optional[dict] = None
    
    class Config:
        from_attributes = True

@router.post("/", response_model=RoomResponse)
def create_room(room: RoomCreate, db: Session = Depends(get_db)):
    existing_room = db.query(Room).filter(Room.name == room.name).first()
    if existing_room:
        raise HTTPException(status_code=400, detail="房间名称已存在")
    
    db_room = Room(name=room.name, capacity=room.capacity)
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room

@router.get("/", response_model=List[RoomResponse])
def get_rooms(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    rooms = db.query(Room).offset(skip).limit(limit).all()
    return rooms

@router.get("/{room_id}", response_model=RoomResponse)
def get_room(room_id: int, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.id == room_id).first()
    if room is None:
        raise HTTPException(status_code=404, detail="房间不存在")
    return room

@router.put("/{room_id}", response_model=RoomResponse)
def update_room(room_id: int, room: RoomUpdate, db: Session = Depends(get_db)):
    db_room = db.query(Room).filter(Room.id == room_id).first()
    if db_room is None:
        raise HTTPException(status_code=404, detail="房间不存在")
    
    update_data = room.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_room, key, value)
    
    db.commit()
    db.refresh(db_room)
    return db_room

@router.delete("/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db)):
    db_room = db.query(Room).filter(Room.id == room_id).first()
    if db_room is None:
        raise HTTPException(status_code=404, detail="房间不存在")
    
    db_room.is_active = False
    db.commit()
    return {"message": "房间已禁用"}

@router.get("/status/all", response_model=List[RoomStatusResponse])
def get_all_rooms_status(db: Session = Depends(get_db)):
    rooms = db.query(Room).filter(Room.is_active == True).all()
    result = []
    
    for room in rooms:
        current_session = db.query(SessionModel).filter(
            SessionModel.room_id == room.id,
            SessionModel.status.in_(["in_progress", "paused"])
        ).first()
        
        session_info = None
        if current_session:
            session_info = {
                "id": current_session.id,
                "script_name": current_session.script_name,
                "dm_name": current_session.dm_name,
                "status": current_session.status,
                "scheduled_time": current_session.scheduled_time.isoformat() if current_session.scheduled_time else None,
                "actual_start_time": current_session.actual_start_time.isoformat() if current_session.actual_start_time else None,
            }
        
        result.append(RoomStatusResponse(
            id=room.id,
            name=room.name,
            capacity=room.capacity,
            is_active=room.is_active,
            current_session=session_info
        ))
    
    return result
