from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.models.models import RouteStatus, TaskStatus
from app.schemas.schemas import (
    RouteCreate, RouteUpdate, RouteResponse, RouteDetail, RestockTaskResponse
)
from app.services.route_service import RouteService
from app.services.task_service import TaskService
from app.utils.exceptions import BusinessException, handle_business_exception
from app.utils.idempotent import IdempotentManager, generate_key

router = APIRouter(prefix="/api/routes", tags=["Routes"])


@router.post("", response_model=RouteResponse, status_code=201)
def create_route(
    route_data: RouteCreate,
    idempotent_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    service = RouteService(db)
    
    if idempotent_key:
        idempotent_mgr = IdempotentManager(db)
        existing = idempotent_mgr.check_and_get(idempotent_key, "create_route")
        if existing:
            route = service.get_route(existing.resource_id)
            return route
        
        try:
            route = service.create_route(route_data)
            idempotent_mgr.record(idempotent_key, "create_route", route.id)
            return route
        except BusinessException as e:
            raise handle_business_exception(e)
    
    try:
        return service.create_route(route_data)
    except BusinessException as e:
        raise handle_business_exception(e)


@router.get("", response_model=List[RouteResponse])
def list_routes(
    status: Optional[RouteStatus] = Query(None),
    scheduled_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db)
):
    service = RouteService(db)
    return service.list_routes(status, scheduled_date)


@router.get("/{route_id}", response_model=RouteResponse)
def get_route(route_id: str, db: Session = Depends(get_db)):
    service = RouteService(db)
    try:
        return service.get_route(route_id)
    except BusinessException as e:
        raise handle_business_exception(e)


@router.get("/{route_id}/detail", response_model=RouteDetail)
def get_route_detail(route_id: str, db: Session = Depends(get_db)):
    service = RouteService(db)
    try:
        return service.get_route_detail(route_id)
    except BusinessException as e:
        raise handle_business_exception(e)


@router.post("/{route_id}/tasks/{task_id}", response_model=RouteResponse)
def add_task_to_route(
    route_id: str,
    task_id: str,
    idempotent_key: Optional[str] = Header(None),
    operator: str = Query("system"),
    db: Session = Depends(get_db)
):
    service = RouteService(db)
    
    if idempotent_key:
        idempotent_mgr = IdempotentManager(db)
        existing = idempotent_mgr.check_and_get(idempotent_key, f"add_task_{route_id}")
        if existing:
            return service.get_route(route_id)
        
        try:
            route = service.add_task_to_route(route_id, task_id, operator)
            idempotent_mgr.record(idempotent_key, f"add_task_{route_id}", route.id)
            return route
        except BusinessException as e:
            raise handle_business_exception(e)
    
    try:
        return service.add_task_to_route(route_id, task_id, operator)
    except BusinessException as e:
        raise handle_business_exception(e)


@router.delete("/{route_id}/tasks/{task_id}", response_model=RouteResponse)
def remove_task_from_route(
    route_id: str,
    task_id: str,
    operator: str = Query("system"),
    db: Session = Depends(get_db)
):
    service = RouteService(db)
    try:
        return service.remove_task_from_route(route_id, task_id, operator)
    except BusinessException as e:
        raise handle_business_exception(e)


@router.patch("/{route_id}", response_model=RouteResponse)
def update_route(
    route_id: str,
    update_data: RouteUpdate,
    operator: str = Query("system"),
    db: Session = Depends(get_db)
):
    service = RouteService(db)
    try:
        return service.update_route(route_id, update_data, operator)
    except BusinessException as e:
        raise handle_business_exception(e)


@router.post("/{route_id}/dispatch", response_model=RouteResponse)
def dispatch_route(
    route_id: str,
    idempotent_key: Optional[str] = Header(None),
    operator: str = Query("system"),
    db: Session = Depends(get_db)
):
    service = RouteService(db)
    try:
        return service.update_route_status(route_id, RouteStatus.DISPATCHED, operator, "Route dispatched")
    except BusinessException as e:
        raise handle_business_exception(e)


@router.post("/{route_id}/start", response_model=RouteResponse)
def start_route(
    route_id: str,
    idempotent_key: Optional[str] = Header(None),
    operator: str = Query("system"),
    db: Session = Depends(get_db)
):
    service = RouteService(db)
    try:
        return service.update_route_status(route_id, RouteStatus.IN_PROGRESS, operator, "Route started")
    except BusinessException as e:
        raise handle_business_exception(e)


@router.post("/{route_id}/complete", response_model=RouteResponse)
def complete_route(
    route_id: str,
    idempotent_key: Optional[str] = Header(None),
    operator: str = Query("system"),
    db: Session = Depends(get_db)
):
    service = RouteService(db)
    try:
        return service.update_route_status(route_id, RouteStatus.COMPLETED, operator, "Route completed")
    except BusinessException as e:
        raise handle_business_exception(e)
