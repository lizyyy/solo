from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.temperature_events import (
    TemperatureEvent,
    TemperatureEventCreate,
    TemperatureEventUpdate,
    TemperatureEventQuery,
)
from app.schemas.base import ResponseModel, PaginatedResponse
from app.services.temperature_event_service import TemperatureEventService

router = APIRouter(prefix="/temperature-events", tags=["temperature-events"])


@router.get("", response_model=PaginatedResponse[TemperatureEvent])
def list_events(
    freezer_id: int = Query(None),
    status: str = Query(None),
    event_type: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    service = TemperatureEventService(db)
    query_params = TemperatureEventQuery(
        freezer_id=freezer_id,
        status=status,
        event_type=event_type,
        page=page,
        page_size=page_size,
    )
    events, total = service.list(query_params)
    return PaginatedResponse(
        data=[TemperatureEvent.model_validate(e) for e in events],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{event_id}", response_model=ResponseModel[TemperatureEvent])
def get_event(event_id: int, db: Session = Depends(get_db)):
    service = TemperatureEventService(db)
    event = service.get_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="温度事件不存在")
    return ResponseModel(data=TemperatureEvent.model_validate(event))


@router.post("", response_model=ResponseModel[TemperatureEvent])
def create_event(data: TemperatureEventCreate, db: Session = Depends(get_db)):
    service = TemperatureEventService(db)
    event = service.create(data)
    return ResponseModel(data=TemperatureEvent.model_validate(event), message="温度事件创建成功")


@router.put("/{event_id}", response_model=ResponseModel[TemperatureEvent])
def update_event(event_id: int, data: TemperatureEventUpdate, db: Session = Depends(get_db)):
    service = TemperatureEventService(db)
    event = service.update(event_id, data)
    if not event:
        raise HTTPException(status_code=404, detail="温度事件不存在")
    return ResponseModel(data=TemperatureEvent.model_validate(event), message="温度事件更新成功")


@router.delete("/{event_id}", response_model=ResponseModel)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    service = TemperatureEventService(db)
    if not service.delete(event_id):
        raise HTTPException(status_code=404, detail="温度事件不存在")
    return ResponseModel(message="温度事件删除成功")
