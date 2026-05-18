from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app import schemas, crud, models
from app.rules import RuleEngine

router = APIRouter(prefix="/api/orders", tags=["repair_orders"])


@router.post("/", response_model=schemas.RepairOrder)
def create_order(order: schemas.RepairOrderCreate, db: Session = Depends(get_db)):
    return crud.create_repair_order(db, order)


@router.get("/{order_id}", response_model=schemas.RepairOrder)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = crud.get_repair_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    RuleEngine.update_overdue_status(db, order)
    return order


@router.get("/no/{order_no}", response_model=schemas.RepairOrder)
def get_order_by_no(order_no: str, db: Session = Depends(get_db)):
    order = crud.get_repair_order_by_no(db, order_no)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    RuleEngine.update_overdue_status(db, order)
    return order


@router.post("/query")
def query_orders(query: schemas.RepairOrderQuery, db: Session = Depends(get_db)):
    orders, total = crud.query_repair_orders(db, query)
    for order in orders:
        RuleEngine.update_overdue_status(db, order)
    return {
        "data": orders,
        "total": total,
        "page": query.page,
        "page_size": query.page_size
    }


@router.post("/{order_id}/reminders", response_model=schemas.Reminder)
def add_reminder(order_id: int, reminder: schemas.ReminderCreate, db: Session = Depends(get_db)):
    order = crud.get_repair_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    return crud.add_reminder(db, order_id, reminder)


@router.post("/{order_id}/advance/{transition}")
def advance_status(order_id: int, transition: str, request: schemas.StatusAdvanceRequest, db: Session = Depends(get_db)):
    order = crud.advance_status(db, order_id, transition, request)
    if not order:
        raise HTTPException(status_code=400, detail="状态流转失败，请检查当前状态和操作是否匹配")
    return order


@router.post("/{order_id}/correct")
def manual_correction(order_id: int, request: schemas.ManualCorrectionRequest, db: Session = Depends(get_db)):
    order = crud.manual_correction(db, order_id, request)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    return order


@router.post("/{order_id}/close")
def close_order(order_id: int, request: schemas.CloseOrderRequest, db: Session = Depends(get_db)):
    order = crud.close_order(db, order_id, request)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    return order


@router.post("/{order_id}/merge")
def merge_order(order_id: int, request: schemas.MergeReminderRequest, db: Session = Depends(get_db)):
    source_order = crud.get_repair_order(db, order_id)
    target_order = crud.get_repair_order(db, request.merge_into_order_id)
    if not source_order or not target_order:
        raise HTTPException(status_code=404, detail="工单不存在")
    if source_order.id == target_order.id:
        raise HTTPException(status_code=400, detail="不能合并到自身")
    
    success = RuleEngine.merge_orders(db, source_order, target_order, request.operated_by)
    if not success:
        raise HTTPException(status_code=400, detail="合并失败")
    return {"message": "合并成功", "source_order_id": order_id, "target_order_id": request.merge_into_order_id}


@router.get("/{order_id}/merge-candidates")
def get_merge_candidates(order_id: int, db: Session = Depends(get_db)):
    order = crud.get_repair_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    candidates = RuleEngine.find_merge_candidates(db, order)
    return {"candidates": candidates}


@router.post("/{order_id}/outsource")
def create_outsource(order_id: int, outsource_data: schemas.OutsourceOrderCreate, operated_by: str = Query(...), db: Session = Depends(get_db)):
    outsource = crud.create_outsource_order(db, order_id, outsource_data, operated_by)
    if not outsource:
        raise HTTPException(status_code=400, detail="创建外包单失败，可能已存在外包单或工单不存在")
    return outsource


@router.post("/{order_id}/completion-proof")
def create_completion_proof(order_id: int, proof_data: schemas.CompletionProofCreate, db: Session = Depends(get_db)):
    proof = crud.create_completion_proof(db, order_id, proof_data)
    if not proof:
        raise HTTPException(status_code=400, detail="创建完工证明失败，可能已存在或工单不存在")
    return proof


@router.post("/{order_id}/verify")
def verify_completion(order_id: int, request: schemas.VerifyCompletionRequest, db: Session = Depends(get_db)):
    proof = crud.verify_completion(db, order_id, request)
    if not proof:
        raise HTTPException(status_code=400, detail="验证失败，工单或完工证明不存在")
    return proof


@router.post("/export")
def export_orders(export_request: schemas.ExportRequest, db: Session = Depends(get_db)):
    from sqlalchemy import and_
    q = db.query(models.RepairOrder).join(models.BuildingRoom)
    
    if export_request.status:
        q = q.filter(models.RepairOrder.status == export_request.status)
    if export_request.is_overdue is not None:
        q = q.filter(models.RepairOrder.is_overdue == export_request.is_overdue)
    if export_request.start_date:
        q = q.filter(models.RepairOrder.reported_at >= export_request.start_date)
    if export_request.end_date:
        q = q.filter(models.RepairOrder.reported_at <= export_request.end_date)
    
    orders = q.order_by(models.RepairOrder.created_at.desc()).all()
    
    result = []
    for order in orders:
        RuleEngine.update_overdue_status(db, order)
        result.append({
            "工单号": order.order_no,
            "楼栋": order.building_room.building,
            "房号": order.building_room.room_number,
            "报修类型": order.repair_type,
            "描述": order.description,
            "联系人": order.contact_name,
            "联系电话": order.contact_phone,
            "状态": order.status,
            "优先级": order.priority,
            "是否超时": "是" if order.is_overdue else "否",
            "催办次数": order.reminder_count,
            "是否已合并": "是" if order.is_merged else "否",
            "报修时间": order.reported_at.strftime("%Y-%m-%d %H:%M:%S"),
            "预计完成时间": order.expected_completion_at.strftime("%Y-%m-%d %H:%M:%S") if order.expected_completion_at else "",
            "完成时间": order.completed_at.strftime("%Y-%m-%d %H:%M:%S") if order.completed_at else "",
            "处理人": order.handler.name if order.handler else ""
        })
    
    return {
        "export_type": export_request.export_type,
        "total": len(result),
        "data": result
    }


@router.post("/batch-check-overdue")
def batch_check_overdue(db: Session = Depends(get_db)):
    count = RuleEngine.batch_update_overdue(db)
    return {"updated_count": count, "message": f"已更新 {count} 个超时工单状态"}