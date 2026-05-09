from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    RepairOrderCreate, AssignRequest, CompleteRequest, AcceptRequest,
    SpareUsageCreate, OperationResponse,
)
from app.services import (
    RepairService, SpareService, StatisticsService, ReferenceDataService,
)

router = APIRouter(prefix="/api/v1", tags=["报修服务"])


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    service = ReferenceDataService(db)
    result = service.list_categories()
    return result


@router.get("/workers")
def list_workers(db: Session = Depends(get_db)):
    service = ReferenceDataService(db)
    result = service.list_workers()
    return result


@router.get("/spare-parts")
def list_spare_parts(db: Session = Depends(get_db)):
    service = SpareService(db)
    result = service.list_spare_parts()
    return result


@router.post("/repair-orders")
def create_repair_order(
    data: RepairOrderCreate,
    db: Session = Depends(get_db),
):
    service = RepairService(db)
    result = service.create_order(data)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result,
        )
    return result


@router.get("/repair-orders")
def list_repair_orders(
    status: Optional[str] = None,
    classroom: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    service = RepairService(db)
    result = service.list_orders(status=status, classroom=classroom, category=category)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result,
        )
    return result


@router.get("/repair-orders/{order_id}")
def get_repair_order(
    order_id: int,
    db: Session = Depends(get_db),
):
    service = RepairService(db)
    result = service.get_order(order_id)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result,
        )
    return result


@router.post("/repair-orders/{order_id}/assign")
def assign_repair_order(
    order_id: int,
    data: AssignRequest,
    operator: str = "系统管理员",
    db: Session = Depends(get_db),
):
    service = RepairService(db)
    result = service.assign_order(order_id, data, operator)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result,
        )
    return result


@router.post("/repair-orders/{order_id}/start")
def start_repair(
    order_id: int,
    operator: str = "维修人员",
    db: Session = Depends(get_db),
):
    service = RepairService(db)
    result = service.start_process(order_id, operator)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result,
        )
    return result


@router.post("/repair-orders/{order_id}/complete")
def complete_repair(
    order_id: int,
    data: CompleteRequest,
    db: Session = Depends(get_db),
):
    service = RepairService(db)
    result = service.complete_order(order_id, data)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result,
        )
    return result


@router.post("/repair-orders/{order_id}/accept")
def accept_repair(
    order_id: int,
    data: AcceptRequest,
    db: Session = Depends(get_db),
):
    service = RepairService(db)
    result = service.accept_order(order_id, data)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result,
        )
    return result


@router.post("/repair-orders/{order_id}/cancel")
def cancel_repair(
    order_id: int,
    reason: str = "",
    operator: str = "系统管理员",
    db: Session = Depends(get_db),
):
    service = RepairService(db)
    result = service.cancel_order(order_id, operator, reason)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result,
        )
    return result


@router.post("/repair-orders/{order_id}/spare-usage")
def use_spare_part(
    order_id: int,
    data: SpareUsageCreate,
    db: Session = Depends(get_db),
):
    service = SpareService(db)
    result = service.use_spare(order_id, data)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result,
        )
    return result


@router.get("/statistics/campus")
def get_campus_statistics(db: Session = Depends(get_db)):
    service = StatisticsService(db)
    result = service.get_campus_stats()
    return result
