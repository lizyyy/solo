from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas import (
    ActualCall,
    ActualCallCreate,
)
from app.services import PermissionService

router = APIRouter(prefix="/calls", tags=["calls"])


@router.post("/", response_model=ActualCall)
def record_call(call: ActualCallCreate, db: Session = Depends(get_db)):
    return PermissionService.record_actual_call(db, call)


@router.get("/", response_model=List[ActualCall])
def get_calls(tool_id: int = None, include_archived: bool = False, db: Session = Depends(get_db)):
    if tool_id:
        return PermissionService.get_calls_by_tool(db, tool_id, include_archived)
    from app.models import ActualCall as ACModel
    query = db.query(ACModel)
    if not include_archived:
        query = query.filter(ACModel.archived == False)
    return query.all()


@router.get("/{call_id}", response_model=ActualCall)
def get_call(call_id: str, db: Session = Depends(get_db)):
    call = PermissionService.get_call(db, call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call


@router.post("/{call_id}/archive", response_model=ActualCall)
def archive_call(call_id: str, db: Session = Depends(get_db)):
    call = PermissionService.archive_call(db, call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call
