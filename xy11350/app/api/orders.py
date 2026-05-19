from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from app.config.database import get_db
from app.utils.security import get_current_active_user
from app.utils.data_masking import mask_sensitive_data
from app.models.models import Order, PrintBatch, User
from app.schemas.schemas import OrderResponse, OrderDetailResponse, OrderCreate, ImportResult
from app.services.import_service import ImportService

router = APIRouter(prefix="/orders", tags=["订单"])


@router.get("/", response_model=List[OrderResponse])
def get_orders(
    batch_id: int = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Order)
    if batch_id:
        query = query.filter(Order.batch_id == batch_id)
    return query.offset(skip).limit(limit).all()


@router.get("/{order_id}", response_model=OrderDetailResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    result = {
        "id": order.id,
        "batch_id": order.batch_id,
        "order_number": order.order_number,
        "product_spec": order.product_spec,
        "quantity": order.quantity,
        "delivery_date": order.delivery_date,
        "created_at": order.created_at,
        "customer_info": order.customer_info,
        "cost_details": order.cost_details
    }
    
    return mask_sensitive_data(result, current_user.role)


@router.post("/", response_model=OrderResponse)
def create_order(
    order: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_order = db.query(Order).filter(Order.order_number == order.order_number).first()
    if db_order:
        raise HTTPException(status_code=400, detail="订单号已存在")
    
    batch = db.query(PrintBatch).filter(PrintBatch.batch_number == order.batch_number).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    db_order = Order(
        batch_id=batch.id,
        order_number=order.order_number,
        product_spec=order.product_spec,
        quantity=order.quantity,
        customer_info=order.customer_info,
        cost_details=order.cost_details,
        delivery_date=order.delivery_date
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order


@router.post("/import/json", response_model=ImportResult)
async def import_orders_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="必须上传JSON文件")
    
    content = await file.read()
    service = ImportService(db)
    success, errors, session_id = service.import_orders_json(content, file.filename, current_user.id)
    
    message = f"导入完成: 成功 {success} 条, 失败 {errors} 条"
    if errors > 0:
        message += f"，请查看错误记录进行处理"
    
    return {
        "session_id": session_id,
        "total_records": success + errors,
        "success_count": success,
        "error_count": errors,
        "message": message
    }
