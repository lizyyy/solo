from fastapi import FastAPI, Depends, HTTPException, Header, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json

from database import engine, get_db, Base
from models import OrderStatus, DeductionType, Role
from schemas import (
    OrderCreate, OrderAssign, OrderComplete, OrderResponse, OrderQuery,
    AcceptanceCreate, AcceptanceResponse,
    ReworkCreate, ReworkComplete, ReworkResponse,
    DeductionCreate, DeductionApprove, DeductionResponse, DeductionQuery,
    SettlementCreate, SettlementPay, SettlementResponse, SettlementQuery,
    OperatorInfo, BatchResponse, AuditLogResponse, AuditLogQuery
)
from services import (
    OrderService, AcceptanceService, ReworkService, DeductionService,
    SettlementService, BatchService, AuditLogService
)
from exporter import ReportExporter

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="民宿保洁管理系统",
    description="派单、验收、返工、扣款、结算全流程管理，支持幂等性、批量操作、审计日志和报表导出",
    version="1.0.0"
)


def get_operator(
    x_operator_id: str = Header(...),
    x_operator_name: str = Header(...),
    x_operator_role: Role = Header(...)
) -> OperatorInfo:
    return OperatorInfo(
        operator_id=x_operator_id,
        operator_name=x_operator_name,
        operator_role=x_operator_role
    )


@app.get("/")
def root():
    return {"message": "民宿保洁管理系统 API", "version": "1.0.0"}


@app.post("/api/orders", response_model=OrderResponse, summary="创建保洁订单")
def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    operator: OperatorInfo = Depends(get_operator)
):
    try:
        return OrderService.create_order(db, order_data, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/orders/batch", response_model=BatchResponse, summary="批量创建保洁订单")
def batch_create_orders(
    orders_data: List[OrderCreate],
    db: Session = Depends(get_db),
    operator: OperatorInfo = Depends(get_operator)
):
    def process_func(db_session, item, op):
        return OrderService.create_order(db_session, item, op)

    batch_id, results = BatchService.process_batch(
        db, orders_data, process_func, "BATCH_CREATE_ORDERS", operator
    )

    success_count = sum(1 for r in results if r.success)
    failed_count = len(results) - success_count

    return BatchResponse(
        batch_id=batch_id,
        total_count=len(orders_data),
        success_count=success_count,
        failed_count=failed_count,
        results=results
    )


@app.put("/api/orders/{order_id}/assign", response_model=OrderResponse, summary="派单")
def assign_order(
    order_id: int,
    assign_data: OrderAssign,
    db: Session = Depends(get_db),
    operator: OperatorInfo = Depends(get_operator)
):
    try:
        return OrderService.assign_order(db, order_id, assign_data, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/orders/{order_id}/complete", response_model=OrderResponse, summary="标记订单完成")
def complete_order(
    order_id: int,
    complete_data: OrderComplete,
    db: Session = Depends(get_db),
    operator: OperatorInfo = Depends(get_operator)
):
    try:
        return OrderService.complete_order(db, order_id, complete_data, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/orders/export", summary="导出订单报表")
def export_orders(
    room_number: Optional[str] = None,
    status: Optional[OrderStatus] = None,
    cleaner_id: Optional[int] = None,
    created_by: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query_params = {
        "room_number": room_number,
        "status": status,
        "cleaner_id": cleaner_id,
        "created_by": created_by,
        "start_date": start_date,
        "end_date": end_date
    }
    orders = OrderService.query_orders(db, query_params, 0, 10000)
    excel_data = ReportExporter.export_orders_to_excel(orders)

    return StreamingResponse(
        excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=cleaning_orders_{datetime.now().strftime('%Y%m%d')}.xlsx"}
    )


@app.get("/api/orders/{order_id}", response_model=OrderResponse, summary="获取订单详情")
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = OrderService.get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@app.get("/api/orders", response_model=List[OrderResponse], summary="查询订单列表")
def query_orders(
    room_number: Optional[str] = None,
    status: Optional[OrderStatus] = None,
    cleaner_id: Optional[int] = None,
    created_by: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query_params = {
        "room_number": room_number,
        "status": status,
        "cleaner_id": cleaner_id,
        "created_by": created_by,
        "start_date": start_date,
        "end_date": end_date
    }
    return OrderService.query_orders(db, query_params, skip, limit)


@app.post("/api/acceptances", response_model=AcceptanceResponse, summary="创建验收记录")
def create_acceptance(
    acceptance_data: AcceptanceCreate,
    db: Session = Depends(get_db),
    operator: OperatorInfo = Depends(get_operator)
):
    try:
        return AcceptanceService.create_acceptance(db, acceptance_data, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/reworks", response_model=ReworkResponse, summary="创建返工记录")
def create_rework(
    rework_data: ReworkCreate,
    db: Session = Depends(get_db),
    operator: OperatorInfo = Depends(get_operator)
):
    try:
        return ReworkService.create_rework(db, rework_data, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/reworks/{rework_id}/complete", response_model=ReworkResponse, summary="标记返工完成")
def complete_rework(
    rework_id: int,
    complete_data: ReworkComplete,
    db: Session = Depends(get_db),
    operator: OperatorInfo = Depends(get_operator)
):
    try:
        return ReworkService.complete_rework(db, rework_id, complete_data, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/deductions", response_model=DeductionResponse, summary="创建扣款记录")
def create_deduction(
    deduction_data: DeductionCreate,
    db: Session = Depends(get_db),
    operator: OperatorInfo = Depends(get_operator)
):
    try:
        return DeductionService.create_deduction(db, deduction_data, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/deductions/{deduction_id}/approve", response_model=DeductionResponse, summary="审批扣款")
def approve_deduction(
    deduction_id: int,
    approve_data: DeductionApprove,
    db: Session = Depends(get_db),
    operator: OperatorInfo = Depends(get_operator)
):
    try:
        return DeductionService.approve_deduction(db, deduction_id, approve_data, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/deductions", response_model=List[DeductionResponse], summary="查询扣款列表")
def query_deductions(
    deduction_type: Optional[DeductionType] = None,
    approved: Optional[bool] = None,
    created_by: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query_params = {
        "deduction_type": deduction_type,
        "approved": approved,
        "created_by": created_by,
        "start_date": start_date,
        "end_date": end_date
    }
    return DeductionService.query_deductions(db, query_params, skip, limit)


@app.get("/api/deductions/export", summary="导出扣款报表")
def export_deductions(
    deduction_type: Optional[DeductionType] = None,
    approved: Optional[bool] = None,
    created_by: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query_params = {
        "deduction_type": deduction_type,
        "approved": approved,
        "created_by": created_by,
        "start_date": start_date,
        "end_date": end_date
    }
    deductions = DeductionService.query_deductions(db, query_params, 0, 10000)
    excel_data = ReportExporter.export_deductions_to_excel(deductions)

    return StreamingResponse(
        excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=deductions_{datetime.now().strftime('%Y%m%d')}.xlsx"}
    )


@app.post("/api/settlements", response_model=SettlementResponse, summary="创建结算记录")
def create_settlement(
    settlement_data: SettlementCreate,
    db: Session = Depends(get_db),
    operator: OperatorInfo = Depends(get_operator)
):
    try:
        return SettlementService.create_settlement(db, settlement_data, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/settlements/{settlement_id}/pay", response_model=SettlementResponse, summary="标记结算已支付")
def pay_settlement(
    settlement_id: int,
    pay_data: SettlementPay,
    db: Session = Depends(get_db),
    operator: OperatorInfo = Depends(get_operator)
):
    try:
        return SettlementService.pay_settlement(db, settlement_id, pay_data, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/settlements", response_model=List[SettlementResponse], summary="查询结算列表")
def query_settlements(
    cleaner_id: Optional[int] = None,
    settlement_month: Optional[str] = None,
    paid: Optional[bool] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query_params = {
        "cleaner_id": cleaner_id,
        "settlement_month": settlement_month,
        "paid": paid,
        "start_date": start_date,
        "end_date": end_date
    }
    return SettlementService.query_settlements(db, query_params, skip, limit)


@app.get("/api/settlements/export", summary="导出结算报表")
def export_settlements(
    cleaner_id: Optional[int] = None,
    settlement_month: Optional[str] = None,
    paid: Optional[bool] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query_params = {
        "cleaner_id": cleaner_id,
        "settlement_month": settlement_month,
        "paid": paid,
        "start_date": start_date,
        "end_date": end_date
    }
    settlements = SettlementService.query_settlements(db, query_params, 0, 10000)
    excel_data = ReportExporter.export_settlements_to_excel(settlements)

    return StreamingResponse(
        excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=settlements_{datetime.now().strftime('%Y%m%d')}.xlsx"}
    )


@app.get("/api/audit-logs", response_model=List[AuditLogResponse], summary="查询审计日志")
def query_audit_logs(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    operator_id: Optional[str] = None,
    operator_role: Optional[Role] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query_params = {
        "action": action,
        "entity_type": entity_type,
        "operator_id": operator_id,
        "operator_role": operator_role,
        "start_date": start_date,
        "end_date": end_date
    }
    return AuditLogService.query_logs(db, query_params, skip, limit)


@app.get("/api/audit-logs/export", summary="导出审计日志报表")
def export_audit_logs(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    operator_id: Optional[str] = None,
    operator_role: Optional[Role] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query_params = {
        "action": action,
        "entity_type": entity_type,
        "operator_id": operator_id,
        "operator_role": operator_role,
        "start_date": start_date,
        "end_date": end_date
    }
    logs = AuditLogService.query_logs(db, query_params, 0, 10000)
    excel_data = ReportExporter.export_audit_logs_to_excel(logs)

    return StreamingResponse(
        excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=audit_logs_{datetime.now().strftime('%Y%m%d')}.xlsx"}
    )


@app.get("/api/enums/order-status", summary="获取订单状态枚举")
def get_order_status_enum():
    return {e.name: e.value for e in OrderStatus}


@app.get("/api/enums/deduction-type", summary="获取扣款类型枚举")
def get_deduction_type_enum():
    return {e.name: e.value for e in DeductionType}


@app.get("/api/enums/role", summary="获取角色枚举")
def get_role_enum():
    return {e.name: e.value for e in Role}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
