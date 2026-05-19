from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.models.models import User, UserRole, WorkOrderStatus
from app.schemas.schemas import (
    WorkOrderCreate, WorkOrderAssign, WorkOrderArrive,
    WorkOrderReinspect, WorkOrderClose, WorkOrderResponse,
    HistoryLogResponse, ApiResponse, PaginatedResponse
)
from app.services.work_order_service import WorkOrderService
from app.api.deps import get_current_user, require_any_role, get_client_ip

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
def list_work_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    pump_room_id: Optional[int] = None,
    assigned_to: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    status_enum = None
    if status:
        try:
            status_enum = WorkOrderStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail="无效的工单状态")
    
    orders = WorkOrderService.get_work_orders(
        db, skip=skip, limit=limit,
        status=status_enum, pump_room_id=pump_room_id,
        assigned_to=assigned_to
    )
    total = WorkOrderService.count_work_orders(
        db, status=status_enum, pump_room_id=pump_room_id,
        assigned_to=assigned_to
    )
    return PaginatedResponse(
        code=200,
        message="success",
        data=[WorkOrderResponse.model_validate(o) for o in orders],
        total=total,
        page=skip // limit + 1,
        page_size=limit
    )


@router.get("/{order_id}", response_model=ApiResponse)
def get_work_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = WorkOrderService.get_work_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    return ApiResponse(code=200, message="success", data=WorkOrderResponse.model_validate(order))


@router.get("/{order_id}/history", response_model=ApiResponse)
def get_work_order_history(
    order_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = WorkOrderService.get_work_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    
    logs = WorkOrderService.get_history_logs(db, order_id, skip=skip, limit=limit)
    return ApiResponse(
        code=200,
        message="success",
        data=[HistoryLogResponse.model_validate(l) for l in logs]
    )


@router.post("", response_model=ApiResponse)
def create_work_order(
    request: Request,
    order_in: WorkOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        order = WorkOrderService.create_work_order(
            db, order_in, created_by=current_user.id,
            ip_address=get_client_ip(request)
        )
        return ApiResponse(code=201, message="创建成功", data=WorkOrderResponse.model_validate(order))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/assign", response_model=ApiResponse)
def assign_work_order(
    request: Request,
    order_id: int,
    assign_in: WorkOrderAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role(UserRole.ADMIN, UserRole.ENGINEER))
):
    try:
        order = WorkOrderService.assign_work_order(
            db, order_id, assign_in, assigned_by=current_user.id,
            ip_address=get_client_ip(request)
        )
        return ApiResponse(code=200, message="派工成功", data=WorkOrderResponse.model_validate(order))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/arrive", response_model=ApiResponse)
def arrive_work_order(
    request: Request,
    order_id: int,
    arrive_in: WorkOrderArrive,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        order = WorkOrderService.arrive_work_order(
            db, order_id, arrive_in, user_id=current_user.id,
            ip_address=get_client_ip(request)
        )
        return ApiResponse(code=200, message="签到成功", data=WorkOrderResponse.model_validate(order))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/reinspect", response_model=ApiResponse)
def reinspect_work_order(
    request: Request,
    order_id: int,
    reinspect_in: WorkOrderReinspect,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        order = WorkOrderService.reinspect_work_order(
            db, order_id, reinspect_in, user_id=current_user.id,
            ip_address=get_client_ip(request)
        )
        return ApiResponse(code=200, message="复测完成", data=WorkOrderResponse.model_validate(order))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/close", response_model=ApiResponse)
def close_work_order(
    request: Request,
    order_id: int,
    close_in: WorkOrderClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role(UserRole.ADMIN, UserRole.ENGINEER))
):
    try:
        order = WorkOrderService.close_work_order(
            db, order_id, close_in, user_id=current_user.id,
            ip_address=get_client_ip(request)
        )
        return ApiResponse(code=200, message="工单已关闭", data=WorkOrderResponse.model_validate(order))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
