from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.schemas.load_test import (
    LoadTestPlanCreate, LoadTestPlanUpdate,
    LoadTestPlan as LoadTestPlanSchema,
    ApiResponse, LoadTestPlanListResponse
)
from app.services.load_test_service import LoadTestService

router = APIRouter()

@router.post("/plans", response_model=ApiResponse)
def create_plan(
    plan_create: LoadTestPlanCreate,
    db: Session = Depends(get_db)
):
    service = LoadTestService(db)
    return service.create_plan(plan_create)

@router.get("/plans", response_model=ApiResponse)
def get_plans(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    version: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    api_name: Optional[str] = Query(None),
    created_by: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    service = LoadTestService(db)
    return service.get_plans(skip, limit, version, status, api_name, created_by)

@router.get("/plans/{plan_id}", response_model=ApiResponse)
def get_plan(
    plan_id: int,
    db: Session = Depends(get_db)
):
    service = LoadTestService(db)
    plan = service.get_plan_by_id(plan_id)
    if not plan:
        return {
            "code": 404,
            "status": "intercepted",
            "message": "压测计划不存在",
            "data": None
        }
    return {
        "code": 200,
        "status": "success",
        "message": "获取成功",
        "data": plan
    }

@router.put("/plans/{plan_id}", response_model=ApiResponse)
def update_plan(
    plan_id: int,
    plan_update: LoadTestPlanUpdate,
    db: Session = Depends(get_db)
):
    service = LoadTestService(db)
    return service.update_plan(plan_id, plan_update)

@router.post("/plans/{plan_id}/approve", response_model=ApiResponse)
def approve_plan(
    plan_id: int,
    approved_by: str = Query(...),
    db: Session = Depends(get_db)
):
    service = LoadTestService(db)
    return service.approve_plan(plan_id, approved_by)

@router.post("/plans/{plan_id}/rollback", response_model=ApiResponse)
def rollback_plan(
    plan_id: int,
    remark: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    service = LoadTestService(db)
    return service.rollback_plan(plan_id, remark)

@router.post("/plans/{plan_id}/retry", response_model=ApiResponse)
def retry_plan(
    plan_id: int,
    db: Session = Depends(get_db)
):
    service = LoadTestService(db)
    return service.retry_plan(plan_id)

@router.post("/bottlenecks/{bottleneck_id}/confirm", response_model=ApiResponse)
def confirm_bottleneck(
    bottleneck_id: int,
    confirmed_by: str = Query(...),
    suggestion: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    service = LoadTestService(db)
    return service.confirm_bottleneck(bottleneck_id, confirmed_by, suggestion)

@router.post("/errors/{error_id}/anomaly", response_model=ApiResponse)
def mark_error_anomaly(
    error_id: int,
    is_anomaly: bool = Query(...),
    anomaly_reason: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    service = LoadTestService(db)
    return service.mark_error_anomaly(error_id, is_anomaly, anomaly_reason)

@router.get("/plans/{plan_id}/export", response_model=ApiResponse)
def export_plan(
    plan_id: int,
    db: Session = Depends(get_db)
):
    service = LoadTestService(db)
    return service.export_plan(plan_id)