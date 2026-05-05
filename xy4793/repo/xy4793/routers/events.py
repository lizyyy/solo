from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from database import get_db
from models import Event, Session as SessionModel, WebSocketConnection

router = APIRouter()

class EventCreate(BaseModel):
    session_id: int
    event_type: str
    sender: str
    content: Optional[str] = None
    event_metadata: Optional[dict] = None

class EventAcknowledge(BaseModel):
    acknowledged_by: str

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

@router.post("/", response_model=EventResponse)
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    session = db.query(SessionModel).filter(SessionModel.id == event.session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="场次不存在")
    
    db_event = Event(
        session_id=event.session_id,
        event_type=event.event_type,
        sender=event.sender,
        content=event.content,
        event_metadata=event.event_metadata
    )
    db.add(db_event)
    
    if event.event_type == "start":
        session.actual_start_time = datetime.utcnow()
        session.status = "in_progress"
    elif event.event_type == "pause":
        session.status = "paused"
    elif event.event_type == "resume":
        session.status = "in_progress"
    elif event.event_type == "end":
        session.actual_end_time = datetime.utcnow()
        session.status = "ended"
    
    db.commit()
    db.refresh(db_event)
    return db_event

@router.get("/", response_model=List[EventResponse])
def get_events(
    skip: int = 0, 
    limit: int = 100, 
    session_id: Optional[int] = None,
    is_acknowledged: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Event)
    
    if session_id:
        query = query.filter(Event.session_id == session_id)
    if is_acknowledged is not None:
        query = query.filter(Event.is_acknowledged == is_acknowledged)
    
    events = query.order_by(Event.created_at.desc()).offset(skip).limit(limit).all()
    return events

@router.get("/unacknowledged", response_model=List[EventResponse])
def get_unacknowledged_events(db: Session = Depends(get_db)):
    events = db.query(Event).filter(
        Event.is_acknowledged == False,
        Event.event_type.in_(["help", "change_props", "notification"])
    ).order_by(Event.created_at).all()
    return events

@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if event is None:
        raise HTTPException(status_code=404, detail="事件不存在")
    return event

@router.post("/{event_id}/acknowledge", response_model=EventResponse)
def acknowledge_event(event_id: int, ack: EventAcknowledge, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if event is None:
        raise HTTPException(status_code=404, detail="事件不存在")
    
    event.is_acknowledged = True
    event.acknowledged_by = ack.acknowledged_by
    event.acknowledged_at = datetime.utcnow()
    
    db.commit()
    db.refresh(event)
    return event

@router.post("/broadcast")
def broadcast_notification(
    room_id: int, 
    content: str, 
    sender: str = "front_desk",
    db: Session = Depends(get_db)
):
    active_session = db.query(SessionModel).filter(
        SessionModel.room_id == room_id,
        SessionModel.status.in_(["in_progress", "paused"])
    ).first()
    
    if active_session is None:
        raise HTTPException(status_code=400, detail="该房间没有进行中的场次")
    
    event = Event(
        session_id=active_session.id,
        event_type="notification",
        sender=sender,
        content=content
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    
    return {"message": "通知已广播", "event_id": event.id}
