from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import os
from openpyxl import Workbook
from app.database import engine, get_db, Base
from app.models import RepairOrder, Handler, Reminder, Outsourcing, CompletionProof, ExceptionRecord, RepairOrderStatus
from app import schemas, services

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="物业催办外包派单完工复核后端API",
    description="小区业主报修管理系统 - 超时、重复催办、外包派单、完工复核管理",
    version="1.0.0"
)


@app.post("/api/repair-orders/", response_model=schemas.RepairOrder, summary="创建报修单")
def create_repair_order(order: schemas.RepairOrderCreate, db: Session = Depends(get_db)):
    return services.create_repair_order(db, order)


@app.get("/api/repair-orders/", response_model=List[schemas.RepairOrder], summary="查询报修单列表")
def get_repair_orders(
    skip: int = 0,
    limit: int = 100,
    status: Optional[RepairOrderStatus] = None,
    building: Optional[str] = None,
    room_number: Optional[str] = None,
    is_timeout: Optional[bool] = None,
    is_duplicated: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(RepairOrder)
    if status:
        query = query.filter(RepairOrder.status == status)
    if building:
        query = query.filter(RepairOrder.building == building)
    if room_number:
        query = query.filter(RepairOrder.room_number == room_number)
    if is_timeout is not None:
        query = query.filter(RepairOrder.is_timeout == is_timeout)
    if is_duplicated is not None:
        query = query.filter(RepairOrder.is_duplicated == is_duplicated)
    return query.order_by(RepairOrder.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/api/repair-orders/{order_id}", response_model=schemas.RepairOrderDetail, summary="查询报修单详情")
def get_repair_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(RepairOrder).filter(RepairOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="报修单不存在")
    services.check_timeout(db, order)
    return order


@app.put("/api/repair-orders/{order_id}/status", response_model=schemas.RepairOrder, summary="状态流转")
def transition_status(order_id: int, data: schemas.StatusTransition, db: Session = Depends(get_db)):
    try:
        return services.transition_status(db, order_id, data.target_status, data.operator, data.remarks)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/repair-orders/{order_id}/correct", response_model=schemas.RepairOrder, summary="人工修正")
def manual_correction(order_id: int, data: schemas.ManualCorrection, db: Session = Depends(get_db)):
    try:
        return services.manual_correction(db, order_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/repair-orders/{order_id}/close", response_model=schemas.RepairOrder, summary="关闭报修单")
def close_order(order_id: int, operator: str, reason: str = "", db: Session = Depends(get_db)):
    try:
        return services.close_or_cancel_order(db, order_id, operator, is_cancel=False, reason=reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/repair-orders/{order_id}/cancel", response_model=schemas.RepairOrder, summary="撤回报修单")
def cancel_order(order_id: int, operator: str, reason: str = "", db: Session = Depends(get_db)):
    try:
        return services.close_or_cancel_order(db, order_id, operator, is_cancel=True, reason=reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/reminders/", response_model=schemas.Reminder, summary="创建催办记录")
def create_reminder(reminder: schemas.ReminderCreate, db: Session = Depends(get_db)):
    order = db.query(RepairOrder).filter(RepairOrder.id == reminder.repair_order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="报修单不存在")
    db_reminder = Reminder(**reminder.dict())
    db.add(db_reminder)
    db.commit()
    db.refresh(db_reminder)
    return db_reminder


@app.post("/api/reminders/merge/{order_id}", summary="合并催办记录")
def merge_reminders(order_id: int, operator: str, db: Session = Depends(get_db)):
    merged_count = services.merge_reminders(db, order_id, operator)
    return {"merged_count": merged_count, "message": f"成功合并 {merged_count} 条催办记录"}


@app.post("/api/outsourcings/", response_model=schemas.Outsourcing, summary="创建外包派单")
def create_outsourcing(data: schemas.OutsourcingCreate, db: Session = Depends(get_db)):
    try:
        return services.create_outsourcing(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/outsourcings/{outsourcing_id}", response_model=schemas.Outsourcing, summary="更新外包派单")
def update_outsourcing(outsourcing_id: int, data: schemas.OutsourcingUpdate, db: Session = Depends(get_db)):
    outsourcing = db.query(Outsourcing).filter(Outsourcing.id == outsourcing_id).first()
    if not outsourcing:
        raise HTTPException(status_code=404, detail="外包派单不存在")
    for key, value in data.dict(exclude_unset=True).items():
        setattr(outsourcing, key, value)
    db.commit()
    db.refresh(outsourcing)
    return outsourcing


@app.post("/api/completion-proofs/", response_model=schemas.CompletionProof, summary="提交完工证明")
def create_completion_proof(data: schemas.CompletionProofCreate, db: Session = Depends(get_db)):
    try:
        return services.create_completion_proof(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/completion-proofs/{proof_id}/verify", response_model=schemas.CompletionProof, summary="复核完工证明")
def verify_completion_proof(proof_id: int, data: schemas.CompletionProofVerify, db: Session = Depends(get_db)):
    try:
        return services.verify_completion_proof(db, proof_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/handlers/", response_model=schemas.Handler, summary="创建处理人")
def create_handler(handler: schemas.HandlerCreate, db: Session = Depends(get_db)):
    db_handler = Handler(**handler.dict())
    db.add(db_handler)
    db.commit()
    db.refresh(db_handler)
    return db_handler


@app.get("/api/handlers/", response_model=List[schemas.Handler], summary="获取处理人列表")
def get_handlers(skip: int = 0, limit: int = 100, is_outsourcer: Optional[bool] = None, db: Session = Depends(get_db)):
    query = db.query(Handler)
    if is_outsourcer is not None:
        query = query.filter(Handler.is_outsourcer == is_outsourcer)
    return query.offset(skip).limit(limit).all()


@app.get("/api/statistics/", summary="获取统计数据")
def get_statistics(db: Session = Depends(get_db)):
    return services.get_statistics(db)


@app.post("/api/export/", summary="导出报修单数据")
def export_orders(query: schemas.ExportQuery, db: Session = Depends(get_db)):
    db_query = db.query(RepairOrder)
    if query.start_date:
        db_query = db_query.filter(RepairOrder.created_at >= query.start_date)
    if query.end_date:
        db_query = db_query.filter(RepairOrder.created_at <= query.end_date)
    if query.status:
        db_query = db_query.filter(RepairOrder.status.in_(query.status))
    if query.building:
        db_query = db_query.filter(RepairOrder.building == query.building)
    if query.is_timeout is not None:
        db_query = db_query.filter(RepairOrder.is_timeout == query.is_timeout)
    if query.is_outsourced:
        db_query = db_query.join(Outsourcing).filter(Outsourcing.id.isnot(None))
    
    orders = db_query.order_by(RepairOrder.created_at.desc()).all()
    
    os.makedirs("exports", exist_ok=True)
    filename = f"exports/repair_orders_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    
    wb = Workbook()
    ws = wb.active
    ws.title = "报修单数据"
    
    headers = [
        "工单编号", "楼栋", "房号", "联系人", "联系电话", "问题类型",
        "描述", "紧急程度", "状态", "是否超时", "是否重复",
        "创建时间", "完成时间", "关闭时间", "外包商", "外包状态"
    ]
    ws.append(headers)
    
    for order in orders:
        outsourcing = db.query(Outsourcing).filter(Outsourcing.repair_order_id == order.id).first()
        row = [
            order.order_no,
            order.building,
            order.room_number,
            order.contact_name,
            order.contact_phone,
            order.issue_type,
            order.description,
            str(order.urgency),
            str(order.status),
            "是" if order.is_timeout else "否",
            "是" if order.is_duplicated else "否",
            order.created_at.strftime("%Y-%m-%d %H:%M:%S") if order.created_at else "",
            order.completed_at.strftime("%Y-%m-%d %H:%M:%S") if order.completed_at else "",
            order.closed_at.strftime("%Y-%m-%d %H:%M:%S") if order.closed_at else "",
            outsourcing.outsourcer_name if outsourcing else "",
            outsourcing.status if outsourcing else ""
        ]
        ws.append(row)
    
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column_letter].width = adjusted_width
    
    wb.save(filename)
    return FileResponse(filename, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=os.path.basename(filename))


@app.get("/api/exception-records/{order_id}", response_model=List[schemas.ExceptionRecord], summary="获取异常操作记录")
def get_exception_records(order_id: int, db: Session = Depends(get_db)):
    return db.query(ExceptionRecord).filter(ExceptionRecord.repair_order_id == order_id).order_by(ExceptionRecord.created_at.desc()).all()
