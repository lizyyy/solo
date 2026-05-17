from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import pandas as pd
import os
from database import get_db, init_db, Rider, Order, ExceptionType, Reassignment, AppealMaterial, ArbitrationResult

app = FastAPI(title="异常单申诉改派仲裁证据API", version="1.0.0")

@app.on_event("startup")
async def startup_event():
    init_db()

class ErrorCode:
    MISSING_FIELD = "MISSING_FIELD"
    INVALID_STATUS = "INVALID_STATUS"
    NEED_MANUAL_REVIEW = "NEED_MANUAL_REVIEW"
    ALREADY_PROCESSED = "ALREADY_PROCESSED"
    NOT_FOUND = "NOT_FOUND"
    DUPLICATE_ARBITRATION = "DUPLICATE_ARBITRATION"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"

class RiderCreate(BaseModel):
    rider_no: str
    name: str
    phone: Optional[str] = None
    station: Optional[str] = None

class RiderResponse(BaseModel):
    id: int
    rider_no: str
    name: str
    phone: Optional[str]
    station: Optional[str]
    is_active: bool
    
    class Config:
        orm_mode = True

class OrderCreate(BaseModel):
    order_no: str
    rider_no: str
    customer_address: Optional[str] = None
    customer_phone: Optional[str] = None
    order_amount: Optional[float] = 0.0
    exception_code: Optional[str] = None
    status: str = "normal"

class OrderResponse(BaseModel):
    id: int
    order_no: str
    rider_name: Optional[str]
    exception_name: Optional[str]
    status: str
    order_amount: float
    created_at: datetime
    
    class Config:
        orm_mode = True

class AppealMaterialCreate(BaseModel):
    order_no: str
    material_type: str
    file_path: Optional[str] = None
    description: str
    uploaded_by: str

class AppealMaterialResponse(BaseModel):
    id: int
    order_no: str
    material_type: str
    description: str
    uploaded_at: datetime
    is_valid: bool
    
    class Config:
        orm_mode = True

class ReassignmentCreate(BaseModel):
    order_no: str
    rider_no: str
    from_rider_no: Optional[str] = None
    reason: str

class ReassignmentResponse(BaseModel):
    id: int
    order_no: str
    rider_name: str
    status: str
    reason: str
    created_at: datetime
    
    class Config:
        orm_mode = True

class ArbitrationCreate(BaseModel):
    order_no: str
    result: str
    reason: str
    handled_by: str

class ArbitrationResponse(BaseModel):
    id: int
    order_no: str
    result: str
    reason: str
    need_manual_review: bool
    review_status: str
    created_at: datetime
    
    class Config:
        orm_mode = True

class OrderFilter(BaseModel):
    status: Optional[str] = None
    exception_code: Optional[str] = None
    rider_no: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None

def get_or_create_rider(db: Session, rider_no: str, name: str = None):
    rider = db.query(Rider).filter(Rider.rider_no == rider_no).first()
    if not rider:
        rider = Rider(rider_no=rider_no, name=name or rider_no)
        db.add(rider)
        db.commit()
        db.refresh(rider)
    return rider

def get_exception_type_by_code(db: Session, code: str):
    return db.query(ExceptionType).filter(ExceptionType.code == code).first()

def check_duplicate_arbitration(db: Session, order_id: int):
    return db.query(ArbitrationResult).filter(
        ArbitrationResult.order_id == order_id,
        ArbitrationResult.review_status != "rejected"
    ).first() is not None

def has_sufficient_evidence(db: Session, order_id: int, exception_type: ExceptionType):
    if not exception_type.need_evidence:
        return True
    count = db.query(AppealMaterial).filter(
        AppealMaterial.order_id == order_id,
        AppealMaterial.is_valid == True
    ).count()
    return count > 0

@app.post("/riders/", response_model=RiderResponse)
def create_rider(rider: RiderCreate, db: Session = Depends(get_db)):
    db_rider = db.query(Rider).filter(Rider.rider_no == rider.rider_no).first()
    if db_rider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.ALREADY_PROCESSED,
                message=f"骑手编号 {rider.rider_no} 已存在"
            ).dict()
        )
    db_rider = Rider(**rider.dict())
    db.add(db_rider)
    db.commit()
    db.refresh(db_rider)
    return db_rider

@app.post("/orders/", response_model=OrderResponse)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    db_order = db.query(Order).filter(Order.order_no == order.order_no).first()
    if db_order:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.ALREADY_PROCESSED,
                message=f"订单号 {order.order_no} 已存在"
            ).dict()
        )
    
    rider = get_or_create_rider(db, order.rider_no)
    
    exception_type = None
    if order.exception_code:
        exception_type = get_exception_type_by_code(db, order.exception_code)
        if not exception_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ErrorResponse(
                    error_code=ErrorCode.NOT_FOUND,
                    message=f"异常类型 {order.exception_code} 不存在"
                ).dict()
            )
    
    db_order = Order(
        order_no=order.order_no,
        rider_id=rider.id,
        customer_address=order.customer_address,
        customer_phone=order.customer_phone,
        order_amount=order.order_amount,
        exception_type_id=exception_type.id if exception_type else None,
        status=order.status,
        exception_time=datetime.utcnow() if exception_type else None
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    response = OrderResponse(
        id=db_order.id,
        order_no=db_order.order_no,
        rider_name=rider.name,
        exception_name=exception_type.name if exception_type else None,
        status=db_order.status,
        order_amount=db_order.order_amount,
        created_at=db_order.created_at
    )
    return response

@app.post("/appeals/", response_model=AppealMaterialResponse)
def create_appeal_material(material: AppealMaterialCreate, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.order_no == material.order_no).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code=ErrorCode.NOT_FOUND,
                message=f"订单 {material.order_no} 不存在"
            ).dict()
        )
    
    db_material = AppealMaterial(
        order_id=order.id,
        material_type=material.material_type,
        file_path=material.file_path,
        description=material.description,
        uploaded_by=material.uploaded_by
    )
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    
    response = AppealMaterialResponse(
        id=db_material.id,
        order_no=material.order_no,
        material_type=db_material.material_type,
        description=db_material.description,
        uploaded_at=db_material.uploaded_at,
        is_valid=db_material.is_valid
    )
    return response

@app.post("/reassignments/", response_model=ReassignmentResponse)
def create_reassignment(reassignment: ReassignmentCreate, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.order_no == reassignment.order_no).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code=ErrorCode.NOT_FOUND,
                message=f"订单 {reassignment.order_no} 不存在"
            ).dict()
        )
    
    if order.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.INVALID_STATUS,
                message="已完成的订单不能改派",
                details={"order_no": reassignment.order_no, "current_status": order.status}
            ).dict()
        )
    
    rider = get_or_create_rider(db, reassignment.rider_no)
    from_rider = None
    if reassignment.from_rider_no:
        from_rider = get_or_create_rider(db, reassignment.from_rider_no)
    
    db_reassignment = Reassignment(
        order_id=order.id,
        rider_id=rider.id,
        from_rider_id=from_rider.id if from_rider else None,
        reason=reassignment.reason,
        status="pending"
    )
    db.add(db_reassignment)
    
    exception_type = get_exception_type_by_code(db, "REASSIGNMENT")
    order.exception_type_id = exception_type.id
    order.status = "reassigned"
    order.exception_time = datetime.utcnow()
    
    db.commit()
    db.refresh(db_reassignment)
    
    response = ReassignmentResponse(
        id=db_reassignment.id,
        order_no=reassignment.order_no,
        rider_name=rider.name,
        status=db_reassignment.status,
        reason=db_reassignment.reason,
        created_at=db_reassignment.created_at
    )
    return response

@app.post("/arbitrations/", response_model=ArbitrationResponse)
def create_arbitration(arbitration: ArbitrationCreate, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.order_no == arbitration.order_no).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code=ErrorCode.NOT_FOUND,
                message=f"订单 {arbitration.order_no} 不存在"
            ).dict()
        )
    
    if check_duplicate_arbitration(db, order.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.DUPLICATE_ARBITRATION,
                message=f"订单 {arbitration.order_no} 已有未驳回的仲裁记录",
                details={"order_no": arbitration.order_no}
            ).dict()
        )
    
    exception_type = db.query(ExceptionType).filter(ExceptionType.id == order.exception_type_id).first()
    
    if exception_type and not has_sufficient_evidence(db, order.id, exception_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.INSUFFICIENT_EVIDENCE,
                message=f"订单 {arbitration.order_no} 缺少有效的申诉证据",
                details={"order_no": arbitration.order_no, "exception_type": exception_type.name}
            ).dict()
        )
    
    need_manual_review = exception_type.need_manual_review if exception_type else False
    
    db_arbitration = ArbitrationResult(
        order_id=order.id,
        result=arbitration.result,
        reason=arbitration.reason,
        handled_by=arbitration.handled_by,
        need_manual_review=need_manual_review,
        review_status="pending_manual" if need_manual_review else "completed"
    )
    db.add(db_arbitration)
    
    if not need_manual_review:
        order.status = "arbitrated"
    
    db.commit()
    db.refresh(db_arbitration)
    
    if need_manual_review:
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED,
            detail=ErrorResponse(
                error_code=ErrorCode.NEED_MANUAL_REVIEW,
                message="该异常类型需要人工复核",
                details={
                    "arbitration_id": db_arbitration.id,
                    "exception_type": exception_type.name if exception_type else None
                }
            ).dict()
        )
    
    response = ArbitrationResponse(
        id=db_arbitration.id,
        order_no=arbitration.order_no,
        result=db_arbitration.result,
        reason=db_arbitration.reason,
        need_manual_review=db_arbitration.need_manual_review,
        review_status=db_arbitration.review_status,
        created_at=db_arbitration.created_at
    )
    return response

@app.post("/orders/filter/", response_model=List[OrderResponse])
def filter_orders(filter_params: OrderFilter, db: Session = Depends(get_db)):
    query = db.query(Order)
    
    if filter_params.status:
        query = query.filter(Order.status == filter_params.status)
    
    if filter_params.exception_code:
        exception_type = get_exception_type_by_code(db, filter_params.exception_code)
        if exception_type:
            query = query.filter(Order.exception_type_id == exception_type.id)
    
    if filter_params.rider_no:
        rider = db.query(Rider).filter(Rider.rider_no == filter_params.rider_no).first()
        if rider:
            query = query.filter(Order.rider_id == rider.id)
    
    if filter_params.start_date:
        query = query.filter(Order.created_at >= filter_params.start_date)
    
    if filter_params.end_date:
        query = query.filter(Order.created_at <= filter_params.end_date)
    
    orders = query.all()
    
    responses = []
    for order in orders:
        rider = db.query(Rider).filter(Rider.id == order.rider_id).first()
        exception_type = db.query(ExceptionType).filter(ExceptionType.id == order.exception_type_id).first()
        responses.append(OrderResponse(
            id=order.id,
            order_no=order.order_no,
            rider_name=rider.name if rider else None,
            exception_name=exception_type.name if exception_type else None,
            status=order.status,
            order_amount=order.order_amount,
            created_at=order.created_at
        ))
    
    return responses

@app.get("/orders/export/")
def export_orders(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Order)
    if status:
        query = query.filter(Order.status == status)
    
    orders = query.all()
    
    data = []
    for order in orders:
        rider = db.query(Rider).filter(Rider.id == order.rider_id).first()
        exception_type = db.query(ExceptionType).filter(ExceptionType.id == order.exception_type_id).first()
        arbitration = db.query(ArbitrationResult).filter(ArbitrationResult.order_id == order.id).first()
        
        data.append({
            "订单号": order.order_no,
            "骑手姓名": rider.name if rider else "",
            "订单状态": order.status,
            "异常类型": exception_type.name if exception_type else "",
            "订单金额": order.order_amount,
            "创建时间": order.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "仲裁结果": arbitration.result if arbitration else "",
            "仲裁原因": arbitration.reason if arbitration else "",
            "复核状态": arbitration.review_status if arbitration else ""
        })
    
    df = pd.DataFrame(data)
    export_path = f"exception_orders_export_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    df.to_excel(export_path, index=False)
    
    return FileResponse(
        export_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=export_path
    )

@app.get("/exception-types/")
def get_exception_types(db: Session = Depends(get_db)):
    types = db.query(ExceptionType).filter(ExceptionType.is_active == True).all()
    return [{"code": t.code, "name": t.name, "category": t.category, "need_evidence": t.need_evidence, "need_manual_review": t.need_manual_review} for t in types]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
