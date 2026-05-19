from datetime import date
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db, init_db
from models import Order, OrderItem, ShortageRecord, CompensationRecord, SettlementRecord
from schemas import (
    OrderCreate, ShortageIdentifyRequest, ShortageConfirmRequest,
    CompensationRequest, RollbackRequest, SettlementRequest,
    ExportRequest, OperatorContext, Role
)
from compensation_service import CompensationService
from export_service import ExportService
from data_masking import DataMasking

app = FastAPI(title="生鲜缺货补偿系统", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    init_db()


def get_operator_context(
    x_operator_role: Role = Header(...),
    x_operator_id: str = Header(...),
    x_operator_name: str = Header(...),
    x_real_ip: Optional[str] = Header(None),
    user_agent: Optional[str] = Header(None)
) -> OperatorContext:
    return OperatorContext(
        operator_role=x_operator_role,
        operator_id=x_operator_id,
        operator_name=x_operator_name,
        ip_address=x_real_ip,
        user_agent=user_agent
    )


@app.post("/api/v1/orders", summary="创建订单")
def create_order(
    order: OrderCreate,
    db: Session = Depends(get_db),
    operator_context: OperatorContext = Depends(get_operator_context)
):
    db_order = Order(
        order_no=order.order_no,
        customer_id=order.customer_id,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        total_amount=order.total_amount,
        delivery_date=order.delivery_date
    )
    db.add(db_order)
    db.flush()

    for item in order.items:
        db_item = OrderItem(
            order_id=db_order.id,
            product_id=item.product_id,
            product_name=item.product_name,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.quantity * item.unit_price
        )
        db.add(db_item)

    db.commit()
    db.refresh(db_order)
    return {"success": True, "order_no": db_order.order_no, "order_id": db_order.id}


@app.post("/api/v1/shortages/identify", summary="缺货识别")
def identify_shortage(
    request: ShortageIdentifyRequest,
    db: Session = Depends(get_db),
    operator_context: OperatorContext = Depends(get_operator_context)
):
    service = CompensationService(db)
    result = service.identify_shortage(request, operator_context)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    return result.dict()


@app.post("/api/v1/shortages/confirm", summary="缺货确认")
def confirm_shortage(
    request: ShortageConfirmRequest,
    db: Session = Depends(get_db),
    operator_context: OperatorContext = Depends(get_operator_context)
):
    service = CompensationService(db)
    result = service.confirm_shortage(request, operator_context)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    return result.dict()


@app.post("/api/v1/compensations/process", summary="处理补偿")
def process_compensation(
    request: CompensationRequest,
    db: Session = Depends(get_db),
    operator_context: OperatorContext = Depends(get_operator_context)
):
    service = CompensationService(db)
    result = service.process_compensation(request, operator_context)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    return result.dict()


@app.post("/api/v1/compensations/rollback", summary="补偿回滚")
def rollback_compensation(
    request: RollbackRequest,
    db: Session = Depends(get_db),
    operator_context: OperatorContext = Depends(get_operator_context)
):
    service = CompensationService(db)
    result = service.rollback_compensation(request, operator_context)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    return result.dict()


@app.post("/api/v1/settlements/process", summary="结算处理")
def process_settlement(
    request: SettlementRequest,
    db: Session = Depends(get_db),
    operator_context: OperatorContext = Depends(get_operator_context)
):
    service = CompensationService(db)
    result = service.process_settlement(request, operator_context)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    return result.dict()


@app.get("/api/v1/shortages/{shortage_no}", summary="查询缺货记录")
def get_shortage(
    shortage_no: str,
    db: Session = Depends(get_db),
    operator_context: OperatorContext = Depends(get_operator_context)
):
    shortage = db.query(ShortageRecord).filter(ShortageRecord.shortage_no == shortage_no).first()
    if not shortage:
        raise HTTPException(status_code=404, detail="缺货记录不存在")

    data = {
        "shortage_no": shortage.shortage_no,
        "order_no": shortage.order.order_no if shortage.order else "",
        "product_id": shortage.product_id,
        "product_name": shortage.product_name,
        "shortage_quantity": shortage.shortage_quantity,
        "shortage_amount": shortage.shortage_amount,
        "status": shortage.status.value,
        "identified_by": shortage.identified_by,
        "identified_at": shortage.identified_at,
        "customer_name": shortage.order.customer_name if shortage.order else "",
        "customer_phone": shortage.order.customer_phone if shortage.order else "",
    }

    data = DataMasking.mask_dict(data, operator_context.operator_role)
    return {"success": True, "data": data}


@app.get("/api/v1/compensations/{compensation_no}", summary="查询补偿记录")
def get_compensation(
    compensation_no: str,
    db: Session = Depends(get_db),
    operator_context: OperatorContext = Depends(get_operator_context)
):
    compensation = db.query(CompensationRecord).filter(CompensationRecord.compensation_no == compensation_no).first()
    if not compensation:
        raise HTTPException(status_code=404, detail="补偿记录不存在")

    data = {
        "compensation_no": compensation.compensation_no,
        "shortage_no": compensation.shortage.shortage_no if compensation.shortage else "",
        "compensation_type": compensation.compensation_type.value,
        "amount": compensation.amount,
        "coupon_value": compensation.coupon_value,
        "coupon_id": compensation.coupon_id,
        "status": compensation.status.value,
        "operator_name": compensation.operator_name,
        "processed_at": compensation.processed_at,
    }

    data = DataMasking.mask_dict(data, operator_context.operator_role)
    return {"success": True, "data": data}


@app.post("/api/v1/export", summary="导出数据")
def export_data(
    request: ExportRequest,
    db: Session = Depends(get_db),
    operator_context: OperatorContext = Depends(get_operator_context)
):
    service = ExportService(db)
    result = service.export_to_file(request, operator_context)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result


@app.get("/api/v1/export/download", summary="下载导出文件")
def download_export(
    filepath: str,
    db: Session = Depends(get_db),
    operator_context: OperatorContext = Depends(get_operator_context)
):
    import os
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(filepath, filename=os.path.basename(filepath))


@app.get("/api/v1/audit-logs", summary="查询审计日志")
def get_audit_logs(
    operation_type: Optional[str] = None,
    result: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    operator_context: OperatorContext = Depends(get_operator_context)
):
    from audit_service import AuditService
    service = AuditService(db)
    logs = service.query_logs(
        operation_type=operation_type,
        result=result,
        skip=skip,
        limit=limit
    )
    return {
        "success": True,
        "data": [
            {
                "id": log.id,
                "operation_type": log.operation_type,
                "reference_type": log.reference_type,
                "reference_id": log.reference_id,
                "operator_role": log.operator_role,
                "operator_name": log.operator_name,
                "result": log.result,
                "reason": log.reason,
                "created_at": log.created_at
            }
            for log in logs
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
