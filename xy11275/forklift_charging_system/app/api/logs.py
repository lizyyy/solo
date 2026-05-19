from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.schemas import OperationLog as OperationLogSchema
from app.services.log_service import LogService

router = APIRouter(prefix="/logs", tags=["操作日志"])


@router.get("/", response_model=List[OperationLogSchema], summary="获取操作日志列表")
def get_logs(
    operator: Optional[str] = Query(None, description="按操作人筛选"),
    status: Optional[str] = Query(None, description="按状态筛选"),
    operation_type: Optional[str] = Query(None, description="按操作类型筛选"),
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    service = LogService(db)
    return service.get_logs(
        operator=operator,
        status=status,
        operation_type=operation_type,
        start_time=start_time,
        end_time=end_time,
        skip=skip,
        limit=limit
    )
