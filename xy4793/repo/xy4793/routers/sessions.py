from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, date
from database import get_db
from models import Room, Session as SessionModel, Event

router = APIRouter()

class SessionCreate(BaseModel):
    room_id: int
    script_name: str
    dm_name: str
    player_count: int = 0
    scheduled_time: datetime

class SessionUpdate(BaseModel):
    script_name: str = None
    dm_name: str = None
    player_count: int = None
    scheduled_time: datetime = None
    status: str = None

class SessionResponse(BaseModel):
    id: int
    room_id: int
    script_name: str
    dm_name: str
    player_count: int
    scheduled_time: datetime
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class EventResponse(BaseModel):
    id: int
    session_id: int
    event_type: str
    sender: str
    content: Optional[str] = None
    event_metadata: Optional[dict] = None
    is_acknowledged: bool
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

@router.post("/", response_model=SessionResponse)
def create_session(session: SessionCreate, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.id == session.room_id).first()
    if room is None:
        raise HTTPException(status_code=404, detail="房间不存在")
    
    existing_session = db.query(SessionModel).filter(
        SessionModel.room_id == session.room_id,
        SessionModel.status.in_(["scheduled", "in_progress", "paused"])
    ).first()
    
    if existing_session:
        raise HTTPException(status_code=400, detail="该房间已有进行中或待开始的场次")
    
    db_session = SessionModel(
        room_id=session.room_id,
        script_name=session.script_name,
        dm_name=session.dm_name,
        player_count=session.player_count,
        scheduled_time=session.scheduled_time,
        status="scheduled"
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@router.get("/", response_model=List[SessionResponse])
def get_sessions(
    skip: int = 0, 
    limit: int = 100, 
    room_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(SessionModel)
    
    if room_id:
        query = query.filter(SessionModel.room_id == room_id)
    if status:
        query = query.filter(SessionModel.status == status)
    
    sessions = query.order_by(SessionModel.scheduled_time.desc()).offset(skip).limit(limit).all()
    return sessions

@router.get("/today", response_model=List[SessionResponse])
def get_today_sessions(db: Session = Depends(get_db)):
    today = date.today()
    start_of_day = datetime.combine(today, datetime.min.time())
    end_of_day = datetime.combine(today, datetime.max.time())
    
    sessions = db.query(SessionModel).filter(
        SessionModel.scheduled_time >= start_of_day,
        SessionModel.scheduled_time <= end_of_day
    ).order_by(SessionModel.scheduled_time).all()
    return sessions

@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="场次不存在")
    return session

@router.put("/{session_id}", response_model=SessionResponse)
def update_session(session_id: int, session: SessionUpdate, db: Session = Depends(get_db)):
    db_session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if db_session is None:
        raise HTTPException(status_code=404, detail="场次不存在")
    
    update_data = session.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_session, key, value)
    
    db.commit()
    db.refresh(db_session)
    return db_session

@router.delete("/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    db_session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if db_session is None:
        raise HTTPException(status_code=404, detail="场次不存在")
    
    if db_session.status in ["in_progress", "paused"]:
        raise HTTPException(status_code=400, detail="正在进行中的场次不能删除")
    
    db.delete(db_session)
    db.commit()
    return {"message": "场次已删除"}

@router.get("/{session_id}/events", response_model=List[EventResponse])
def get_session_events(session_id: int, db: Session = Depends(get_db)):
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="场次不存在")
    
    events = db.query(Event).filter(Event.session_id == session_id).order_by(Event.created_at).all()
    return events
