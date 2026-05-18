from fastapi import APIRouter, HTTPException, status
from typing import List, Optional
from datetime import datetime
from app.services.repair_service import RepairOrderService, BusinessRuleError
from app.schemas.repair_order import (
    RepairOrderCreate,
    RepairOrderAccept,
    RepairOrderProcess,
    RepairOrderComplete,
    RepairOrderVerify,
    RepairOrderReject,
    RepairOrderClose,
    RepairOrderResponse,
    ErrorResponse
)
from app.models.database import RepairStatus

router = APIRouter(prefix="/api/v1/repair-orders", tags=["故障派修"])

def handle_business_error(e: BusinessRuleError):
    error_response = ErrorResponse(
        error_code=e.error_code,
        message=e.message,
        detail=e.detail
    )
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=error_response.model_dump(mode='json')
    )

@router.post("", response_model=RepairOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_repair_order(order_data: RepairOrderCreate):
    try:
        return await RepairOrderService.create_order(order_data)
    except BusinessRuleError as e:
        handle_business_error(e)

@router.post("/{order_id}/accept", response_model=RepairOrderResponse)
async def accept_repair_order(order_id: str, accept_data: RepairOrderAccept):
    try:
        return await RepairOrderService.accept_order(order_id, accept_data)
    except BusinessRuleError as e:
        handle_business_error(e)

@router.post("/{order_id}/start-process", response_model=RepairOrderResponse)
async def start_process_order(order_id: str, process_data: RepairOrderProcess):
    try:
        return await RepairOrderService.start_process(order_id, process_data)
    except BusinessRuleError as e:
        handle_business_error(e)

@router.post("/{order_id}/complete-repair", response_model=RepairOrderResponse)
async def complete_repair_order(order_id: str, complete_data: RepairOrderComplete):
    try:
        return await RepairOrderService.complete_repair(order_id, complete_data)
    except BusinessRuleError as e:
        handle_business_error(e)

@router.post("/{order_id}/verify", response_model=RepairOrderResponse)
async def verify_repair_order(order_id: str, verify_data: RepairOrderVerify):
    try:
        return await RepairOrderService.verify_repair(order_id, verify_data)
    except BusinessRuleError as e:
        handle_business_error(e)

@router.post("/{order_id}/reject", response_model=RepairOrderResponse)
async def reject_repair_order(order_id: str, reject_data: RepairOrderReject):
    try:
        return await RepairOrderService.reject_order(order_id, reject_data)
    except BusinessRuleError as e:
        handle_business_error(e)

@router.post("/{order_id}/close", response_model=RepairOrderResponse)
async def close_repair_order(order_id: str, close_data: RepairOrderClose):
    try:
        return await RepairOrderService.close_order(order_id, close_data)
    except BusinessRuleError as e:
        handle_business_error(e)

@router.get("/{order_id}", response_model=RepairOrderResponse)
async def get_repair_order(order_id: str):
    order = await RepairOrderService.get_order(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code="ORDER_NOT_FOUND",
                message="派修单不存在",
                detail={
                    "intercept_reason": f"派修单 {order_id} 不存在",
                    "suggestions": ["检查派修单号是否正确", "重新查询派修单列表"]
                }
            ).model_dump(mode='json')
        )
    return order

@router.get("", response_model=List[RepairOrderResponse])
async def list_repair_orders(status: Optional[RepairStatus] = None):
    return await RepairOrderService.list_orders(status)
