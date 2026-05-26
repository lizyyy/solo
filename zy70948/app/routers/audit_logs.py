from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app import schemas
from app.services import list_logs

router = APIRouter(prefix="/audit-logs", tags=["审计日志"])


@router.get("", response_model=schemas.AuditLogListResp, summary="查询审计日志")
def api_list(
    batch_id: Optional[int] = None,
    record_id: Optional[int] = None,
    skip: int = 0, limit: int = 200,
    db: Session = Depends(get_db),
):
    total, items = list_logs(db, batch_id=batch_id, record_id=record_id, skip=skip, limit=limit)
    return {"total": total, "items": items}
