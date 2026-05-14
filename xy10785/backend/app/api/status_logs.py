from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import StatusLog as StatusLogModel
from app.schemas import StatusLog

router = APIRouter()

@router.get("/{plan_id}", response_model=List[StatusLog])
def get_status_logs(plan_id: int, db: Session = Depends(get_db)):
    return db.query(StatusLogModel).filter(
        StatusLogModel.ad_plan_id == plan_id
    ).order_by(StatusLogModel.created_at.desc()).all()
