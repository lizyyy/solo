from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database import get_db
from app.services.import_service import ImportService
from app.schemas import ImportResult, OrderCreate, OrderResponse, OrderWithDetails
from app.models import Order
import uuid
import os

router = APIRouter(prefix="/api/orders", tags=["订单管理"])


@router.post("", response_model=OrderResponse)
def create_order(order_in: OrderCreate, db: Session = Depends(get_db)):
    order_id = order_in.id if hasattr(order_in, 'id') and order_in.id else str(uuid.uuid4())
    order = Order(
        id=order_id,
        order_no=order_in.order_no,
        tenant_name=order_in.tenant_name,
        tenant_phone=order_in.tenant_phone,
        room_no=order_in.room_no,
        check_in_date=order_in.check_in_date,
        check_out_date=order_in.check_out_date,
        rental_amount=order_in.rental_amount,
        deposit_amount=order_in.deposit_amount,
        deposit_status=order_in.deposit_status
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("", response_model=List[OrderResponse])
def list_orders(
    order_no: Optional[str] = None,
    tenant_name: Optional[str] = None,
    room_no: Optional[str] = None,
    deposit_status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Order)
    if order_no:
        query = query.filter(Order.order_no.ilike(f"%{order_no}%"))
    if tenant_name:
        query = query.filter(Order.tenant_name.ilike(f"%{tenant_name}%"))
    if room_no:
        query = query.filter(Order.room_no.ilike(f"%{room_no}%"))
    if deposit_status:
        query = query.filter(Order.deposit_status == deposit_status)
    return query.offset(skip).limit(limit).all()


@router.get("/{order_id}", response_model=OrderWithDetails)
def get_order(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"订单 {order_id} 不存在")
    return order


@router.post("/import/json", response_model=ImportResult)
async def import_order_json(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="请上传JSON文件")

    file_path = f"/tmp/{uuid.uuid4()}.json"
    try:
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)

        service = ImportService(db)
        result = service.import_order_json(file_path)
        return result
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


@router.post("/{order_id}/deductions")
async def add_deduction(
    order_id: str,
    deduction_type: str = Form(...),
    amount: float = Form(...),
    description: Optional[str] = Form(None),
    evidence: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"订单 {order_id} 不存在")

    evidence_url = None
    if evidence:
        evidence_dir = "uploads/evidence"
        os.makedirs(evidence_dir, exist_ok=True)
        evidence_path = f"{evidence_dir}/{order_id}_{uuid.uuid4()}_{evidence.filename}"
        contents = await evidence.read()
        with open(evidence_path, "wb") as f:
            f.write(contents)
        evidence_url = evidence_path

    service = ImportService(db)
    result = service.import_deduction_photo(
        order_id=order_id,
        photo_url=evidence_url,
        deduction_type=deduction_type,
        amount=amount,
        description=description or ""
    )
    return result


@router.post("/import/meter-csv", response_model=ImportResult)
async def import_meter_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="请上传CSV文件")

    file_path = f"/tmp/{uuid.uuid4()}.csv"
    try:
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)

        service = ImportService(db)
        result = service.import_meter_csv(file_path)
        return result
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


@router.post("/import/deduction-batch", response_model=ImportResult)
async def import_deduction_batch(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="请上传JSON文件")

    file_path = f"/tmp/{uuid.uuid4()}.json"
    try:
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)

        service = ImportService(db)
        result = service.import_deduction_batch(file_path)
        return result
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)