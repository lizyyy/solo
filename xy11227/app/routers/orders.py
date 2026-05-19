from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Device, Order, OrderLog, OrderStatus, IssueType, User, DeviceEvent, UserRole, IdempotentRecord
from app.schemas import OrderCreate, OrderResponse, OrderReceiveRequest, OrderAttributeRequest, OrderDispatchRequest, OrderReviewRequest, OrderBatchCreateRequest, BatchResult
from app.utils import generate_order_no, generate_request_key, generate_response_hash, mask_sensitive_data, classify_issue_type
from app.auth import get_current_active_user, require_roles

router = APIRouter(prefix="/orders", tags=["工单管理"])


@router.post("/", response_model=OrderResponse, summary="创建工单")
async def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    request_key = generate_request_key("/api/v1/orders/", order_data.model_dump())
    
    existing_idempotent = db.query(IdempotentRecord).filter(IdempotentRecord.request_key == request_key).first()
    if existing_idempotent:
        existing_order = db.query(Order).filter(Order.order_no == existing_idempotent.response_hash).first()
        if existing_order:
            return existing_order
    
    device = db.query(Device).filter(Device.device_code == order_data.device_code).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    order_no = generate_order_no()
    
    issue_type = order_data.issue_type
    if not issue_type and order_data.event_id:
        event = db.query(DeviceEvent).filter(DeviceEvent.event_id == order_data.event_id).first()
        if event:
            issue_type = classify_issue_type(event.event_type.value, event.error_message)
    
    order = Order(
        order_no=order_no,
        device_id=device.id,
        event_id=order_data.event_id,
        status=OrderStatus.PENDING,
        issue_type=issue_type,
        issue_description=order_data.issue_description,
        cabin_number=order_data.cabin_number,
        customer_phone=order_data.customer_phone,
        customer_name=order_data.customer_name,
        created_by=current_user.id
    )
    
    db.add(order)
    db.flush()
    
    log = OrderLog(
        order_id=order.id,
        action="创建工单",
        operator_id=current_user.id,
        operator_name=current_user.full_name or current_user.username,
        detail=f"创建工单，状态：待处理"
    )
    db.add(log)
    
    idempotent_record = IdempotentRecord(
        request_key=request_key,
        endpoint="/api/v1/orders/",
        response_hash=order_no
    )
    db.add(idempotent_record)
    
    db.commit()
    db.refresh(order)
    
    return mask_sensitive_data(order)


@router.post("/batch", response_model=BatchResult, summary="批量创建工单")
async def batch_create_orders(
    batch_data: OrderBatchCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    success_ids = []
    failed_ids = []
    failed_details = []
    
    for idx, order_data in enumerate(batch_data.orders):
        try:
            request_key = generate_request_key("/api/v1/orders/batch", order_data.model_dump())
            
            existing_idempotent = db.query(IdempotentRecord).filter(IdempotentRecord.request_key == request_key).first()
            if existing_idempotent:
                existing_order = db.query(Order).filter(Order.order_no == existing_idempotent.response_hash).first()
                if existing_order:
                    success_ids.append(existing_order.id)
                    continue
            
            device = db.query(Device).filter(Device.device_code == order_data.device_code).first()
            if not device:
                raise HTTPException(status_code=404, detail=f"Device {order_data.device_code} not found")
            
            order_no = generate_order_no()
            
            issue_type = order_data.issue_type
            if not issue_type and order_data.event_id:
                event = db.query(DeviceEvent).filter(DeviceEvent.event_id == order_data.event_id).first()
                if event:
                    issue_type = classify_issue_type(event.event_type.value, event.error_message)
            
            order = Order(
                order_no=order_no,
                device_id=device.id,
                event_id=order_data.event_id,
                status=OrderStatus.PENDING,
                issue_type=issue_type,
                issue_description=order_data.issue_description,
                cabin_number=order_data.cabin_number,
                customer_phone=order_data.customer_phone,
                customer_name=order_data.customer_name,
                created_by=current_user.id
            )
            
            db.add(order)
            db.flush()
            
            log = OrderLog(
                order_id=order.id,
                action="创建工单",
                operator_id=current_user.id,
                operator_name=current_user.full_name or current_user.username,
                detail=f"批量创建工单"
            )
            db.add(log)
            
            idempotent_record = IdempotentRecord(
                request_key=request_key,
                endpoint="/api/v1/orders/batch",
                response_hash=order_no
            )
            db.add(idempotent_record)
            db.flush()
            
            success_ids.append(order.id)
            
        except Exception as e:
            db.rollback()
            failed_ids.append(idx)
            failed_details.append({
                "index": idx,
                "device_code": order_data.device_code,
                "error": str(e)
            })
            continue
    
    db.commit()
    
    return BatchResult(
        success=success_ids,
        failed=failed_ids,
        failed_details=failed_details
    )


@router.post("/receive", response_model=BatchResult, summary="接单")
async def receive_orders(
    request_data: OrderReceiveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    success_ids = []
    failed_ids = []
    failed_details = []
    
    for order_id in request_data.order_ids:
        try:
            order = db.query(Order).filter(Order.id == order_id).first()
            if not order:
                raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
            
            if order.status != OrderStatus.PENDING:
                raise HTTPException(status_code=400, detail=f"Order {order_id} is not in PENDING status")
            
            order.status = OrderStatus.RECEIVED
            order.received_by = current_user.id
            order.received_at = datetime.utcnow()
            
            log = OrderLog(
                order_id=order.id,
                action="接单",
                operator_id=current_user.id,
                operator_name=current_user.full_name or current_user.username,
                detail="值班员已接单"
            )
            db.add(log)
            db.flush()
            
            success_ids.append(order_id)
            
        except Exception as e:
            db.rollback()
            failed_ids.append(order_id)
            failed_details.append({
                "order_id": order_id,
                "error": str(e)
            })
            continue
    
    db.commit()
    
    return BatchResult(
        success=success_ids,
        failed=failed_ids,
        failed_details=failed_details
    )


@router.post("/attribute", response_model=OrderResponse, summary="归因")
async def attribute_order(
    request_data: OrderAttributeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    order = db.query(Order).filter(Order.id == request_data.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.status not in [OrderStatus.RECEIVED, OrderStatus.ATTRIBUTED]:
        raise HTTPException(status_code=400, detail="Order must be in RECEIVED or ATTRIBUTED status")
    
    order.issue_type = request_data.issue_type
    order.issue_description = request_data.issue_description or order.issue_description
    order.status = OrderStatus.ATTRIBUTED
    order.attributed_by = current_user.id
    order.attributed_at = datetime.utcnow()
    
    log = OrderLog(
        order_id=order.id,
        action="归因",
        operator_id=current_user.id,
        operator_name=current_user.full_name or current_user.username,
        detail=f"问题类型：{request_data.issue_type.value}"
    )
    db.add(log)
    
    db.commit()
    db.refresh(order)
    
    return mask_sensitive_data(order)


@router.post("/dispatch", response_model=BatchResult, summary="派修")
async def dispatch_orders(
    request_data: OrderDispatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OPERATOR))
):
    engineer = db.query(User).filter(User.id == request_data.engineer_id, User.role == UserRole.ENGINEER).first()
    if not engineer:
        raise HTTPException(status_code=404, detail="Engineer not found")
    
    success_ids = []
    failed_ids = []
    failed_details = []
    
    for order_id in request_data.order_ids:
        try:
            order = db.query(Order).filter(Order.id == order_id).first()
            if not order:
                raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
            
            if order.status != OrderStatus.ATTRIBUTED:
                raise HTTPException(status_code=400, detail=f"Order {order_id} must be in ATTRIBUTED status")
            
            order.status = OrderStatus.DISPATCHED
            order.dispatched_to = request_data.engineer_id
            order.dispatched_at = datetime.utcnow()
            
            log = OrderLog(
                order_id=order.id,
                action="派修",
                operator_id=current_user.id,
                operator_name=current_user.full_name or current_user.username,
                detail=f"派工给工程师：{engineer.full_name or engineer.username}"
            )
            db.add(log)
            db.flush()
            
            success_ids.append(order_id)
            
        except Exception as e:
            db.rollback()
            failed_ids.append(order_id)
            failed_details.append({
                "order_id": order_id,
                "error": str(e)
            })
            continue
    
    db.commit()
    
    return BatchResult(
        success=success_ids,
        failed=failed_ids,
        failed_details=failed_details
    )


@router.post("/review", response_model=OrderResponse, summary="复核")
async def review_order(
    request_data: OrderReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.AUDITOR))
):
    order = db.query(Order).filter(Order.id == request_data.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.status not in [OrderStatus.DISPATCHED, OrderStatus.REVIEWED]:
        raise HTTPException(status_code=400, detail="Order must be in DISPATCHED or REVIEWED status")
    
    order.status = OrderStatus.REVIEWED if not request_data.close else OrderStatus.CLOSED
    order.reviewed_by = current_user.id
    order.reviewed_at = datetime.utcnow()
    if request_data.remark:
        order.remark = (order.remark or "") + f"\n[{datetime.now().isoformat()}] {request_data.remark}"
    
    action = "复核通过" if not request_data.close else "复核关闭"
    log = OrderLog(
        order_id=order.id,
        action=action,
        operator_id=current_user.id,
        operator_name=current_user.full_name or current_user.username,
        detail=request_data.remark or ""
    )
    db.add(log)
    
    db.commit()
    db.refresh(order)
    
    return mask_sensitive_data(order)


@router.get("/", response_model=List[OrderResponse], summary="获取工单列表")
async def get_orders(
    status: OrderStatus = None,
    issue_type: IssueType = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Order)
    if status:
        query = query.filter(Order.status == status)
    if issue_type:
        query = query.filter(Order.issue_type == issue_type)
    
    orders = query.offset(skip).limit(limit).all()
    return mask_sensitive_data(orders)


@router.get("/{order_id}", response_model=OrderResponse, summary="获取工单详情")
async def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return mask_sensitive_data(order)