from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth import get_current_active_user, allow_data_entry, allow_reviewer, allow_supervisor
from app.models import User, WorkOrder, WorkOrderStatus
from app.schemas import WorkOrderCreate, WorkOrderUpdate, WorkOrder as WorkOrderSchema

router = APIRouter()


@router.post("/", response_model=WorkOrderSchema, dependencies=[Depends(allow_data_entry)])
def create_work_order(
    work_order: WorkOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_order = db.query(WorkOrder).filter(WorkOrder.order_no == work_order.order_no).first()
    if db_order:
        raise HTTPException(status_code=400, detail="工单号已存在")
    
    db_order = WorkOrder(
        **work_order.model_dump(),
        created_by=current_user.id
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order


@router.get("/", response_model=list[WorkOrderSchema])
def list_work_orders(
    skip: int = 0,
    limit: int = 100,
    pile_id: Optional[int] = None,
    alert_id: Optional[int] = None,
    status: Optional[WorkOrderStatus] = None,
    assignee: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(WorkOrder)
    if pile_id:
        query = query.filter(WorkOrder.pile_id == pile_id)
    if alert_id:
        query = query.filter(WorkOrder.alert_id == alert_id)
    if status:
        query = query.filter(WorkOrder.status == status)
    if assignee:
        query = query.filter(WorkOrder.assignee == assignee)
    
    orders = query.order_by(WorkOrder.created_at.desc()).offset(skip).limit(limit).all()
    return orders


@router.get("/{order_id}", response_model=WorkOrderSchema)
def get_work_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    order = db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    return order


@router.put("/{order_id}", response_model=WorkOrderSchema, dependencies=[Depends(allow_reviewer)])
def update_work_order(
    order_id: int,
    order_update: WorkOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_order = db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="工单不存在")
    
    for field, value in order_update.model_dump(exclude_unset=True).items():
        setattr(db_order, field, value)
    
    db.commit()
    db.refresh(db_order)
    return db_order


@router.delete("/{order_id}", dependencies=[Depends(allow_supervisor)])
def delete_work_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_order = db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="工单不存在")
    
    db.delete(db_order)
    db.commit()
    return {"success": True, "message": "删除成功"}
