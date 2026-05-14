from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.deps import get_db
from ..schemas.seed_log import SeedLogSchema
from ..schemas.common import Response
from ..services.log_service import LogService

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("/", response_model=Response[List[SeedLogSchema]])
def list_logs(
    skip: int = 0,
    limit: int = 100,
    batch_id: int = None,
    template_id: int = None,
    db: Session = Depends(get_db)
):
    logs = LogService.list_logs(db, skip=skip, limit=limit, batch_id=batch_id, template_id=template_id)
    return Response(data=logs, message="Logs retrieved successfully")


@router.get("/{log_id}", response_model=Response[SeedLogSchema])
def get_log(log_id: int, db: Session = Depends(get_db)):
    log = LogService.get_log(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return Response(data=log, message="Log retrieved successfully")


@router.get("/{log_id}/diff", response_model=Response[Dict[str, Any]])
def get_log_diff(log_id: int, db: Session = Depends(get_db)):
    diff = LogService.get_state_diff(db, log_id)
    if not diff:
        raise HTTPException(status_code=404, detail="Log not found")
    return Response(data=diff, message="State diff retrieved successfully")
