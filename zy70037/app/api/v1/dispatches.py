from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.dispatches import (
    Dispatch,
    DispatchCreate,
    DispatchUpdate,
    DispatchQuery,
    DispatchAssign,
    DispatchAccept,
    DispatchComplete,
)
from app.schemas.base import ResponseModel, PaginatedResponse
from app.services.dispatch_service import DispatchService

router = APIRouter(prefix="/dispatches", tags=["dispatches"])


@router.get("", response_model=PaginatedResponse[Dispatch])
def list_dispatches(
    temperature_event_id: int = Query(None),
    provider_id: int = Query(None),
    worker_id: int = Query(None),
    status: str = Query(None),
    priority: str = Query(None),
    escalation_level: int = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    service = DispatchService(db)
    query_params = DispatchQuery(
        temperature_event_id=temperature_event_id,
        provider_id=provider_id,
        worker_id=worker_id,
        status=status,
        priority=priority,
        escalation_level=escalation_level,
        page=page,
        page_size=page_size,
    )
    dispatches, total = service.list(query_params)
    return PaginatedResponse(
        data=[Dispatch.model_validate(d) for d in dispatches],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{dispatch_id}", response_model=ResponseModel[Dispatch])
def get_dispatch(dispatch_id: int, db: Session = Depends(get_db)):
    service = DispatchService(db)
    dispatch = service.get_by_id(dispatch_id)
    if not dispatch:
        raise HTTPException(status_code=404, detail="派单不存在")
    return ResponseModel(data=Dispatch.model_validate(dispatch))


@router.post("", response_model=ResponseModel[Dispatch])
def create_dispatch(data: DispatchCreate, db: Session = Depends(get_db)):
    service = DispatchService(db)
    dispatch = service.create(data)
    return ResponseModel(data=Dispatch.model_validate(dispatch), message="派单创建成功")


@router.put("/{dispatch_id}", response_model=ResponseModel[Dispatch])
def update_dispatch(dispatch_id: int, data: DispatchUpdate, db: Session = Depends(get_db)):
    service = DispatchService(db)
    dispatch = service.update(dispatch_id, data)
    if not dispatch:
        raise HTTPException(status_code=404, detail="派单不存在")
    return ResponseModel(data=Dispatch.model_validate(dispatch), message="派单更新成功")


@router.delete("/{dispatch_id}", response_model=ResponseModel)
def delete_dispatch(dispatch_id: int, db: Session = Depends(get_db)):
    service = DispatchService(db)
    if not service.delete(dispatch_id):
        raise HTTPException(status_code=404, detail="派单不存在")
    return ResponseModel(message="派单删除成功")


@router.post("/{dispatch_id}/assign", response_model=ResponseModel[Dispatch])
def assign_worker(dispatch_id: int, data: DispatchAssign, db: Session = Depends(get_db)):
    service = DispatchService(db)
    dispatch = service.assign_worker(dispatch_id, data)
    if not dispatch:
        raise HTTPException(status_code=404, detail="派单不存在")
    return ResponseModel(data=Dispatch.model_validate(dispatch), message="维修工分配成功")


@router.post("/{dispatch_id}/accept", response_model=ResponseModel[Dispatch])
def accept_dispatch(dispatch_id: int, data: DispatchAccept, db: Session = Depends(get_db)):
    service = DispatchService(db)
    dispatch = service.accept(dispatch_id, data)
    if not dispatch:
        raise HTTPException(status_code=404, detail="派单不存在")
    return ResponseModel(data=Dispatch.model_validate(dispatch), message="接单成功")


@router.post("/{dispatch_id}/complete", response_model=ResponseModel[Dispatch])
def complete_dispatch(dispatch_id: int, data: DispatchComplete, db: Session = Depends(get_db)):
    service = DispatchService(db)
    dispatch = service.complete(dispatch_id, data)
    if not dispatch:
        raise HTTPException(status_code=404, detail="派单不存在")
    return ResponseModel(data=Dispatch.model_validate(dispatch), message="派单完成")
