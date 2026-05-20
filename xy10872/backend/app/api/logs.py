from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models import RecoveryLog

router = APIRouter(tags=["日志"])


@router.get("/")
def get_all_logs(limit: int = 100, db: Session = Depends(get_db)):
    return db.query(RecoveryLog).order_by(RecoveryLog.created_at.desc()).limit(limit).all()