from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List

import models
import schemas
from database import engine, get_db, init_db
from business_logic import (
    calculate_task_deductions,
    apply_deduction,
    validate_task_for_inspection,
    can_settle_task,
    get_task_status_reason,
    log_operation
)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="民宿运营管理系统", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    init_db()


@app.post("/orders/", response_model=schemas.Order)
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    db_order = db.query(models.Order).filter(models.Order.order_no == order.order_no).first()
    if db_order:
        raise HTTPException(status_code=400, detail="订单号已存在")
    db_order = models.Order(**order.model_dump())
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    log_operation(db, "create_order", order.order_no, "success", "创建订单成功")
    return db_order


@app.get("/orders/", response_model=List[schemas.Order])
def get_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Order).offset(skip).limit(limit).all()


@app.post("/cleaners/", response_model=schemas.Cleaner)
def create_cleaner(cleaner: schemas.CleanerCreate, db: Session = Depends(get_db)):
    db_cleaner = models.Cleaner(**cleaner.model_dump())
    db.add(db_cleaner)
    db.commit()
    db.refresh(db_cleaner)
    return db_cleaner


@app.get("/cleaners/", response_model=List[schemas.Cleaner])
def get_cleaners(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Cleaner).offset(skip).limit(limit).all()


@app.post("/tasks/", response_model=schemas.CleaningTask)
def assign_task(task: schemas.CleaningTaskCreate, db: Session = Depends(get_db)):
    db_task = db.query(models.CleaningTask).filter(models.CleaningTask.task_no == task.task_no).first()
    if db_task:
        log_operation(db, "assign_task", task.task_no, "skipped", "任务已存在，跳过派单")
        return db_task
    
    order = db.query(models.Order).filter(models.Order.id == task.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    cleaner = db.query(models.Cleaner).filter(models.Cleaner.id == task.cleaner_id).first()
    if not cleaner:
        raise HTTPException(status_code=404, detail="保洁员不存在")
    
    db_task = models.CleaningTask(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    log_operation(db, "assign_task", task.task_no, "success", "派单成功")
    return db_task


@app.post("/tasks/batch", response_model=schemas.BatchResult)
def assign_tasks_batch(tasks: List[schemas.CleaningTaskCreate], db: Session = Depends(get_db)):
    successful = []
    failed = []
    
    for task in tasks:
        try:
            db_task = db.query(models.CleaningTask).filter(models.CleaningTask.task_no == task.task_no).first()
            if db_task:
                successful.append({"task_no": task.task_no, "id": db_task.id, "message": "任务已存在"})
                continue
            
            db_task = models.CleaningTask(**task.model_dump())
            db.add(db_task)
            db.flush()
            successful.append({"task_no": task.task_no, "id": db_task.id})
        except Exception as e:
            db.rollback()
            failed.append({"task_no": task.task_no, "error": str(e)})
    
    db.commit()
    return schemas.BatchResult(
        success=len(successful),
        failed=len(failed),
        successful_items=successful,
        failed_items=failed
    )


@app.get("/tasks/", response_model=List[schemas.CleaningTask])
def get_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.CleaningTask).offset(skip).limit(limit).all()


@app.get("/tasks/{task_id}/detail", response_model=schemas.TaskDetailResponse)
def get_task_detail(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.CleaningTask).filter(models.CleaningTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    photos = db.query(models.CleaningPhoto).filter(models.CleaningPhoto.task_id == task_id).all()
    inspections = db.query(models.Inspection).filter(models.Inspection.task_id == task_id).all()
    reworks = db.query(models.Rework).filter(models.Rework.task_id == task_id).all()
    deductions = db.query(models.Deduction).filter(models.Deduction.task_id == task_id).all()
    
    return schemas.TaskDetailResponse(
        task=task,
        photos=photos,
        inspections=inspections,
        reworks=reworks,
        deductions=deductions
    )


@app.get("/tasks/{task_id}/status")
def get_task_status(task_id: int, db: Session = Depends(get_db)):
    return get_task_status_reason(db, task_id)


@app.post("/photos/", response_model=schemas.CleaningPhoto)
def upload_photo(photo: schemas.CleaningPhotoCreate, db: Session = Depends(get_db)):
    task = db.query(models.CleaningTask).filter(models.CleaningTask.id == photo.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    existing = db.query(models.CleaningPhoto).filter(
        models.CleaningPhoto.task_id == photo.task_id,
        models.CleaningPhoto.photo_type == photo.photo_type
    ).first()
    
    if existing:
        log_operation(db, "upload_photo", str(photo.task_id), "skipped", f"{photo.photo_type} 照片已存在")
        return existing
    
    db_photo = models.CleaningPhoto(**photo.model_dump())
    db.add(db_photo)
    db.commit()
    db.refresh(db_photo)
    log_operation(db, "upload_photo", str(photo.task_id), "success", f"上传 {photo.photo_type} 照片")
    return db_photo


@app.post("/photos/batch", response_model=schemas.BatchResult)
def upload_photos_batch(photos: List[schemas.CleaningPhotoCreate], db: Session = Depends(get_db)):
    successful = []
    failed = []
    
    for photo in photos:
        try:
            existing = db.query(models.CleaningPhoto).filter(
                models.CleaningPhoto.task_id == photo.task_id,
                models.CleaningPhoto.photo_type == photo.photo_type
            ).first()
            
            if existing:
                successful.append({"task_id": photo.task_id, "photo_type": photo.photo_type, "message": "照片已存在"})
                continue
            
            db_photo = models.CleaningPhoto(**photo.model_dump())
            db.add(db_photo)
            db.flush()
            successful.append({"task_id": photo.task_id, "photo_type": photo.photo_type})
        except Exception as e:
            db.rollback()
            failed.append({"task_id": photo.task_id, "photo_type": photo.photo_type, "error": str(e)})
    
    db.commit()
    return schemas.BatchResult(
        success=len(successful),
        failed=len(failed),
        successful_items=successful,
        failed_items=failed
    )


@app.post("/inspections/", response_model=schemas.Inspection)
def create_inspection(inspection: schemas.InspectionCreate, db: Session = Depends(get_db)):
    valid, reasons = validate_task_for_inspection(db, inspection.task_id)
    if not valid:
        raise HTTPException(status_code=400, detail="; ".join(reasons))
    
    db_inspection = models.Inspection(**inspection.model_dump())
    db.add(db_inspection)
    
    task = db.query(models.CleaningTask).filter(models.CleaningTask.id == inspection.task_id).first()
    if inspection.passed:
        task.status = "completed"
        calculate_task_deductions(db, inspection.task_id)
    else:
        task.status = "failed"
    
    db.commit()
    db.refresh(db_inspection)
    log_operation(db, "inspection", str(inspection.task_id), "success" if inspection.passed else "failed", 
                  "验收通过" if inspection.passed else f"验收未通过: {inspection.reason}")
    return db_inspection


@app.post("/reworks/", response_model=schemas.Rework)
def request_rework(rework: schemas.ReworkCreate, db: Session = Depends(get_db)):
    task = db.query(models.CleaningTask).filter(models.CleaningTask.id == rework.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task.status != "completed":
        raise HTTPException(status_code=400, detail="只有已完成的任务才能申请返工")
    
    db_rework = models.Rework(**rework.model_dump())
    db.add(db_rework)
    task.status = "rework_needed"
    db.commit()
    db.refresh(db_rework)
    log_operation(db, "rework_request", str(rework.task_id), "success", f"返工申请: {rework.reason}")
    
    if rework.affects_settlement:
        calculate_task_deductions(db, rework.task_id)
    
    return db_rework


@app.put("/reworks/{rework_id}/complete", response_model=schemas.Rework)
def complete_rework(rework_id: int, data: schemas.ReworkComplete, db: Session = Depends(get_db)):
    rework = db.query(models.Rework).filter(models.Rework.id == rework_id).first()
    if not rework:
        raise HTTPException(status_code=404, detail="返工记录不存在")
    
    if rework.completed:
        return rework
    
    rework.completed = data.completed
    rework.completed_at = datetime.utcnow()
    
    pending_reworks = db.query(models.Rework).filter(
        models.Rework.task_id == rework.task_id,
        models.Rework.completed == False
    ).count()
    
    if pending_reworks == 0 and data.completed:
        task = db.query(models.CleaningTask).filter(models.CleaningTask.id == rework.task_id).first()
        task.status = "completed"
    
    db.commit()
    db.refresh(rework)
    log_operation(db, "rework_complete", str(rework_id), "success", "返工完成")
    return rework


@app.post("/deductions/")
def create_deduction(deduction: schemas.DeductionCreate, db: Session = Depends(get_db)):
    result = apply_deduction(db, deduction)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("message", "扣款失败"))
    log_operation(db, "deduction", str(deduction.task_id), "success", 
                  f"{deduction.deduction_type}: {deduction.amount}元 - {deduction.reason}")
    return result


@app.post("/deductions/batch", response_model=schemas.BatchResult)
def create_deductions_batch(deductions: List[schemas.DeductionCreate], db: Session = Depends(get_db)):
    successful = []
    failed = []
    
    for deduction in deductions:
        try:
            result = apply_deduction(db, deduction)
            if result["success"]:
                successful.append({
                    "task_id": deduction.task_id,
                    "amount": deduction.amount,
                    "message": result["message"]
                })
            else:
                failed.append({"task_id": deduction.task_id, "error": result.get("message")})
        except Exception as e:
            db.rollback()
            failed.append({"task_id": deduction.task_id, "error": str(e)})
    
    return schemas.BatchResult(
        success=len(successful),
        failed=len(failed),
        successful_items=successful,
        failed_items=failed
    )


@app.post("/settlements/", response_model=schemas.Settlement)
def create_settlement(settlement: schemas.SettlementCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Settlement).filter(models.Settlement.settlement_no == settlement.settlement_no).first()
    if existing:
        return existing
    
    order = db.query(models.Order).filter(models.Order.id == settlement.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    tasks = db.query(models.CleaningTask).filter(
        models.CleaningTask.order_id == settlement.order_id,
        models.CleaningTask.cleaner_id == settlement.cleaner_id
    ).all()
    
    settlement_items = []
    total_base = 0
    total_deduct = 0
    
    for task in tasks:
        can_settle, reasons = can_settle_task(db, task.id)
        if can_settle:
            calculate_task_deductions(db, task.id)
            item = models.SettlementItem(
                task_id=task.id,
                base_fee=task.base_fee,
                deductions=task.deduction_amount,
                final_fee=task.final_fee
            )
            settlement_items.append(item)
            total_base += task.base_fee
            total_deduct += task.deduction_amount
    
    db_settlement = models.Settlement(
        **settlement.model_dump(),
        total_base_fee=total_base,
        total_deductions=total_deduct,
        final_amount=max(total_base - total_deduct, 0),
        items=settlement_items
    )
    db.add(db_settlement)
    db.commit()
    db.refresh(db_settlement)
    log_operation(db, "settlement_create", settlement.settlement_no, "success", "结算单创建成功")
    return db_settlement


@app.put("/settlements/{settlement_id}/finalize", response_model=schemas.Settlement)
def finalize_settlement(settlement_id: int, data: schemas.SettlementFinalize, db: Session = Depends(get_db)):
    settlement = db.query(models.Settlement).filter(models.Settlement.id == settlement_id).first()
    if not settlement:
        raise HTTPException(status_code=404, detail="结算单不存在")
    
    if settlement.status == "finalized":
        return settlement
    
    settlement.status = "finalized"
    settlement.settled_at = datetime.utcnow()
    settlement.notes = data.notes
    db.commit()
    db.refresh(settlement)
    log_operation(db, "settlement_finalize", settlement.settlement_no, "success", "结算已完成")
    return settlement


@app.get("/settlements/", response_model=List[schemas.Settlement])
def get_settlements(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Settlement).offset(skip).limit(limit).all()


@app.get("/logs/")
def get_operation_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.OperationLog).order_by(models.OperationLog.created_at.desc()).offset(skip).limit(limit).all()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)