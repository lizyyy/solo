from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import OperationLog
from app.schemas import OperationLogOut

router = APIRouter(prefix="/logs", tags=["操作日志"])


@router.get("", response_model=List[OperationLogOut])
def list_logs(
    target_type: Optional[str] = Query(None),
    target_id: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    query = db.query(OperationLog)
    if target_type:
        query = query.filter(OperationLog.target_type == target_type)
    if target_id:
        query = query.filter(OperationLog.target_id == target_id)
    return query.order_by(OperationLog.created_at.desc()).limit(limit).all()
