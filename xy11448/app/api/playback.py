from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.auth import get_current_active_user, allow_reviewer
from app.models import User, PlaybackRecord
from app.schemas import PlaybackRecordCreate, PlaybackRecord as PlaybackRecordSchema
from app.services import PlaybackService

router = APIRouter()


@router.post("/alert-chain")
def playback_alert_chain(
    pile_id: int,
    start_time: datetime,
    end_time: datetime,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = PlaybackService.playback_alert_chain(db, pile_id, start_time, end_time)
    
    playback_record = PlaybackRecord(
        pile_id=pile_id,
        start_time=start_time,
        end_time=end_time,
        playback_type="alert_chain",
        created_by=current_user.id
    )
    db.add(playback_record)
    db.commit()
    
    return {"success": True, "data": result}


@router.get("/records", response_model=list[PlaybackRecordSchema])
def list_playback_records(
    skip: int = 0,
    limit: int = 100,
    pile_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(PlaybackRecord)
    if pile_id:
        query = query.filter(PlaybackRecord.pile_id == pile_id)
    
    records = query.order_by(PlaybackRecord.created_at.desc()).offset(skip).limit(limit).all()
    return records


@router.get("/records/{record_id}", response_model=PlaybackRecordSchema)
def get_playback_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    record = db.query(PlaybackRecord).filter(PlaybackRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="回放记录不存在")
    return record


@router.post("/replay/{record_id}")
def replay_playback(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    record = db.query(PlaybackRecord).filter(PlaybackRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="回放记录不存在")
    
    result = PlaybackService.playback_alert_chain(
        db, record.pile_id, record.start_time, record.end_time)
    
    return {"success": True, "data": result}
