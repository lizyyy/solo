from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models import ReleaseRecord
from app.schemas import ReleaseRecordResponse

router = APIRouter()

@router.get("/records", response_model=List[ReleaseRecordResponse])
def get_release_records(gray_rule_id: int = None, release_type: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(ReleaseRecord)
    if gray_rule_id:
        query = query.filter(ReleaseRecord.gray_rule_id == gray_rule_id)
    if release_type:
        query = query.filter(ReleaseRecord.release_type == release_type)
    return query.order_by(ReleaseRecord.released_at.desc()).offset(skip).limit(limit).all()
