from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional, Dict, Any
from datetime import datetime, date
import json
from app import models, schemas
from app.database import get_db, init_db, engine
from app.models import FlyAshBatch, TonBag, InspectionRecord, LandfillReservation, ReviewNote, AuditLog
from app.services import (
    AuditService, InspectionService, RiskCalculationService,
    OutboundValidationService, ManualOverrideService, ExportService
)
from app.import_export import CSVImportService, JSONImportService

app = FastAPI(
    title="飞灰螯合出库哨 API",
    description="垃圾焚烧厂飞灰固化车间本地后端 API - 飞灰批次管理、螯合剂投加记录、浸出检测、吨袋称重、填埋预约、出库校验",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    init_db()

@app.get("/")
def root():
    return {
        "name": "飞灰螯合出库哨",
        "version": "1.0.0",
        "status": "running",
        "time": datetime.now().isoformat()
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/api/batches/", response_model=schemas.FlyAshBatchResponse, tags=["批次管理"])
def create_batch(
    batch: schemas.FlyAshBatchCreate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人")
):
    existing = db.query(FlyAshBatch).filter(
        FlyAshBatch.batch_number == batch.batch_number
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"批次 {batch.batch_number} 已存在")
    
    db_batch = FlyAshBatch(**batch.model_dump())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    
    AuditService.log_operation(
        db=db,
        operation_type="CREATE",
        module="batch_management",
        resource_type="fly_ash_batch",
        resource_id=str(db_batch.id),
        operator=operator,
        operation_detail=f"创建批次 {batch.batch_number}"
    )
    
    return db_batch

@app.get("/api/batches/", response_model=List[schemas.FlyAshBatchResponse], tags=["批次管理"])
def list_batches(
    skip: int = 0,
    limit: int = 100,
    batch_number: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(FlyAshBatch)
    
    if batch_number:
        query = query.filter(FlyAshBatch.batch_number.contains(batch_number))
    if start_date:
        query = query.filter(FlyAshBatch.batch_date >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(FlyAshBatch.batch_date <= datetime.combine(end_date, datetime.max.time()))
    
    batches = query.order_by(FlyAshBatch.batch_date.desc()).offset(skip).limit(limit).all()
    return batches

@app.get("/api/batches/{batch_id}", response_model=schemas.FlyAshBatchResponse, tags=["批次管理"])
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(FlyAshBatch).filter(FlyAshBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch

@app.put("/api/batches/{batch_id}", response_model=schemas.FlyAshBatchResponse, tags=["批次管理"])
def update_batch(
    batch_id: int,
    batch_update: schemas.FlyAshBatchUpdate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人")
):
    batch = db.query(FlyAshBatch).filter(FlyAshBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    old_values = {
        key: getattr(batch, key)
        for key in batch_update.model_dump(exclude_unset=True).keys()
    }
    
    for key, value in batch_update.model_dump(exclude_unset=True).items():
        setattr(batch, key, value)
    
    db.commit()
    db.refresh(batch)
    
    AuditService.log_operation(
        db=db,
        operation_type="UPDATE",
        module="batch_management",
        resource_type="fly_ash_batch",
        resource_id=str(batch.id),
        operator=operator,
        operation_detail=f"更新批次 {batch.batch_number}",
        old_value=json.dumps(old_values),
        new_value=json.dumps(batch_update.model_dump(exclude_unset=True))
    )
    
    return batch

@app.delete("/api/batches/{batch_id}", tags=["批次管理"])
def delete_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人")
):
    batch = db.query(FlyAshBatch).filter(FlyAshBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    bags = db.query(TonBag).filter(TonBag.batch_id == batch_id).all()
    if bags:
        raise HTTPException(status_code=400, detail="该批次有关联的吨袋，无法删除")
    
    batch_number = batch.batch_number
    db.delete(batch)
    db.commit()
    
    AuditService.log_operation(
        db=db,
        operation_type="DELETE",
        module="batch_management",
        resource_type="fly_ash_batch",
        resource_id=str(batch_id),
        operator=operator,
        operation_detail=f"删除批次 {batch_number}"
    )
    
    return {"message": "删除成功", "batch_number": batch_number}

@app.post("/api/bags/", response_model=schemas.TonBagResponse, tags=["吨袋管理"])
def create_bag(
    bag: schemas.TonBagCreate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人")
):
    existing = db.query(TonBag).filter(TonBag.bag_number == bag.bag_number).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"吨袋 {bag.bag_number} 已存在")
    
    if bag.batch_id:
        batch = db.query(FlyAshBatch).filter(FlyAshBatch.id == bag.batch_id).first()
        if not batch:
            raise HTTPException(status_code=400, detail=f"批次 ID {bag.batch_id} 不存在")
    
    db_bag = TonBag(**bag.model_dump())
    db.add(db_bag)
    db.commit()
    db.refresh(db_bag)
    
    AuditService.log_operation(
        db=db,
        operation_type="CREATE",
        module="ton_bag_management",
        resource_type="ton_bag",
        resource_id=str(db_bag.id),
        operator=operator,
        operation_detail=f"创建吨袋 {bag.bag_number}"
    )
    
    return db_bag

@app.get("/api/bags/", response_model=List[schemas.TonBagResponse], tags=["吨袋管理"])
def list_bags(
    skip: int = 0,
    limit: int = 100,
    bag_number: Optional[str] = None,
    batch_id: Optional[int] = None,
    is_qualified: Optional[bool] = None,
    is_outbound: Optional[bool] = None,
    risk_level: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(TonBag)
    
    if bag_number:
        query = query.filter(TonBag.bag_number.contains(bag_number))
    if batch_id:
        query = query.filter(TonBag.batch_id == batch_id)
    if is_qualified is not None:
        query = query.filter(TonBag.is_qualified == is_qualified)
    if is_outbound is not None:
        query = query.filter(TonBag.is_outbound == is_outbound)
    if risk_level:
        query = query.filter(TonBag.risk_level == risk_level)
    
    bags = query.order_by(TonBag.created_at.desc()).offset(skip).limit(limit).all()
    return bags

@app.get("/api/bags/{bag_id}", response_model=schemas.TonBagResponse, tags=["吨袋管理"])
def get_bag(bag_id: int, db: Session = Depends(get_db)):
    bag = db.query(TonBag).filter(TonBag.id == bag_id).first()
    if not bag:
        raise HTTPException(status_code=404, detail="吨袋不存在")
    return bag

@app.put("/api/bags/{bag_id}", response_model=schemas.TonBagResponse, tags=["吨袋管理"])
def update_bag(
    bag_id: int,
    bag_update: schemas.TonBagUpdate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人")
):
    bag = db.query(TonBag).filter(TonBag.id == bag_id).first()
    if not bag:
        raise HTTPException(status_code=404, detail="吨袋不存在")
    
    old_values = {
        key: getattr(bag, key)
        for key in bag_update.model_dump(exclude_unset=True).keys()
    }
    
    for key, value in bag_update.model_dump(exclude_unset=True).items():
        setattr(bag, key, value)
    
    db.commit()
    db.refresh(bag)
    
    AuditService.log_operation(
        db=db,
        operation_type="UPDATE",
        module="ton_bag_management",
        resource_type="ton_bag",
        resource_id=str(bag.id),
        operator=operator,
        operation_detail=f"更新吨袋 {bag.bag_number}",
        old_value=json.dumps(old_values),
        new_value=json.dumps(bag_update.model_dump(exclude_unset=True))
    )
    
    return bag

@app.post("/api/inspections/", response_model=schemas.InspectionRecordResponse, tags=["检测管理"])
def create_inspection(
    inspection: schemas.InspectionRecordCreate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人")
):
    existing = db.query(InspectionRecord).filter(
        InspectionRecord.inspection_number == inspection.inspection_number
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"检测记录 {inspection.inspection_number} 已存在")
    
    db_inspection = InspectionRecord(**inspection.model_dump())
    
    is_qualified, violations = InspectionService.check_inspection_qualified(db_inspection)
    db_inspection.is_qualified = is_qualified
    
    db.add(db_inspection)
    db.commit()
    db.refresh(db_inspection)
    
    InspectionService.update_inspection_status(db, db_inspection, is_qualified)
    
    AuditService.log_operation(
        db=db,
        operation_type="CREATE",
        module="inspection_management",
        resource_type="inspection_record",
        resource_id=str(db_inspection.id),
        operator=operator,
        operation_detail=f"创建检测记录 {inspection.inspection_number}，合格={is_qualified}"
    )
    
    return db_inspection

@app.get("/api/inspections/", response_model=List[schemas.InspectionRecordResponse], tags=["检测管理"])
def list_inspections(
    skip: int = 0,
    limit: int = 100,
    inspection_number: Optional[str] = None,
    bag_id: Optional[int] = None,
    batch_id: Optional[int] = None,
    is_qualified: Optional[bool] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(InspectionRecord)
    
    if inspection_number:
        query = query.filter(InspectionRecord.inspection_number.contains(inspection_number))
    if bag_id:
        query = query.filter(InspectionRecord.bag_id == bag_id)
    if batch_id:
        query = query.filter(InspectionRecord.batch_id == batch_id)
    if is_qualified is not None:
        query = query.filter(InspectionRecord.is_qualified == is_qualified)
    if start_date:
        query = query.filter(InspectionRecord.inspection_date >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(InspectionRecord.inspection_date <= datetime.combine(end_date, datetime.max.time()))
    
    inspections = query.order_by(InspectionRecord.inspection_date.desc()).offset(skip).limit(limit).all()
    return inspections

@app.get("/api/inspections/{inspection_id}", response_model=schemas.InspectionRecordResponse, tags=["检测管理"])
def get_inspection(inspection_id: int, db: Session = Depends(get_db)):
    inspection = db.query(InspectionRecord).filter(InspectionRecord.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    return inspection

@app.put("/api/inspections/{inspection_id}", response_model=schemas.InspectionRecordResponse, tags=["检测管理"])
def update_inspection(
    inspection_id: int,
    inspection_update: schemas.InspectionRecordUpdate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人")
):
    inspection = db.query(InspectionRecord).filter(InspectionRecord.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    
    for key, value in inspection_update.model_dump(exclude_unset=True).items():
        setattr(inspection, key, value)
    
    if 'is_qualified' not in inspection_update.model_dump(exclude_unset=True):
        is_qualified, violations = InspectionService.check_inspection_qualified(inspection)
        inspection.is_qualified = is_qualified
    
    db.commit()
    db.refresh(inspection)
    
    AuditService.log_operation(
        db=db,
        operation_type="UPDATE",
        module="inspection_management",
        resource_type="inspection_record",
        resource_id=str(inspection.id),
        operator=operator,
        operation_detail=f"更新检测记录 {inspection.inspection_number}"
    )
    
    return inspection

@app.post("/api/reservations/", response_model=schemas.LandfillReservationResponse, tags=["预约管理"])
def create_reservation(
    reservation: schemas.LandfillReservationCreate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人")
):
    existing = db.query(LandfillReservation).filter(
        LandfillReservation.reservation_number == reservation.reservation_number
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"预约 {reservation.reservation_number} 已存在")
    
    db_reservation = LandfillReservation(**reservation.model_dump())
    db.add(db_reservation)
    db.commit()
    db.refresh(db_reservation)
    
    AuditService.log_operation(
        db=db,
        operation_type="CREATE",
        module="reservation_management",
        resource_type="landfill_reservation",
        resource_id=str(db_reservation.id),
        operator=operator,
        operation_detail=f"创建预约 {reservation.reservation_number}"
    )
    
    return db_reservation

@app.get("/api/reservations/", response_model=List[schemas.LandfillReservationResponse], tags=["预约管理"])
def list_reservations(
    skip: int = 0,
    limit: int = 100,
    reservation_number: Optional[str] = None,
    batch_id: Optional[int] = None,
    status: Optional[str] = None,
    is_completed: Optional[bool] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(LandfillReservation)
    
    if reservation_number:
        query = query.filter(LandfillReservation.reservation_number.contains(reservation_number))
    if batch_id:
        query = query.filter(LandfillReservation.batch_id == batch_id)
    if status:
        query = query.filter(LandfillReservation.status == status)
    if is_completed is not None:
        query = query.filter(LandfillReservation.is_completed == is_completed)
    if start_date:
        query = query.filter(LandfillReservation.reservation_date >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(LandfillReservation.reservation_date <= datetime.combine(end_date, datetime.max.time()))
    
    reservations = query.order_by(LandfillReservation.reservation_date.desc()).offset(skip).limit(limit).all()
    return reservations

@app.get("/api/reservations/{reservation_id}", response_model=schemas.LandfillReservationResponse, tags=["预约管理"])
def get_reservation(reservation_id: int, db: Session = Depends(get_db)):
    reservation = db.query(LandfillReservation).filter(
        LandfillReservation.id == reservation_id
    ).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="预约不存在")
    return reservation

@app.put("/api/reservations/{reservation_id}", response_model=schemas.LandfillReservationResponse, tags=["预约管理"])
def update_reservation(
    reservation_id: int,
    reservation_update: schemas.LandfillReservationUpdate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人")
):
    reservation = db.query(LandfillReservation).filter(
        LandfillReservation.id == reservation_id
    ).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="预约不存在")
    
    for key, value in reservation_update.model_dump(exclude_unset=True).items():
        setattr(reservation, key, value)
    
    db.commit()
    db.refresh(reservation)
    
    AuditService.log_operation(
        db=db,
        operation_type="UPDATE",
        module="reservation_management",
        resource_type="landfill_reservation",
        resource_id=str(reservation.id),
        operator=operator,
        operation_detail=f"更新预约 {reservation.reservation_number}"
    )
    
    return reservation

@app.post("/api/reservations/{reservation_id}/execute", tags=["出库管理"])
def execute_outbound(
    reservation_id: int,
    bag_ids: List[int],
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人")
):
    validation = OutboundValidationService.validate_outbound(db, reservation_id, bag_ids)
    
    if not validation.is_valid:
        raise HTTPException(
            status_code=400,
            detail={
                "errors": validation.errors,
                "unqualified_bags": validation.unqualified_bags,
                "duplicate_bags": validation.duplicate_bags
            }
        )
    
    reservation = db.query(LandfillReservation).filter(
        LandfillReservation.id == reservation_id
    ).first()
    
    total_weight = 0.0
    for bag_id in bag_ids:
        bag = db.query(TonBag).filter(TonBag.id == bag_id).first()
        bag.is_outbound = True
        bag.outbound_time = datetime.utcnow()
        bag.reservation_id = reservation_id
        total_weight += bag.weight
    
    reservation.actual_weight = total_weight
    reservation.status = "completed"
    reservation.is_completed = True
    reservation.completion_time = datetime.utcnow()
    
    db.commit()
    
    AuditService.log_operation(
        db=db,
        operation_type="OUTBOUND_EXECUTE",
        module="outbound_management",
        resource_type="landfill_reservation",
        resource_id=str(reservation_id),
        operator=operator,
        operation_detail=f"执行出库: 预约 {reservation.reservation_number}，吨袋数量 {len(bag_ids)}，总重量 {total_weight:.2f} 吨",
        new_value=json.dumps({"bag_ids": bag_ids, "total_weight": total_weight})
    )
    
    return {
        "message": "出库执行成功",
        "reservation_number": reservation.reservation_number,
        "bag_count": len(bag_ids),
        "total_weight": total_weight,
        "warnings": validation.warnings
    }

@app.post("/api/review-notes/", response_model=schemas.ReviewNoteResponse, tags=["复核备注"])
def create_review_note(
    note: schemas.ReviewNoteCreate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人")
):
    db_note = ReviewNote(**note.model_dump())
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    
    AuditService.log_operation(
        db=db,
        operation_type="CREATE",
        module="review_management",
        resource_type="review_note",
        resource_id=str(db_note.id),
        operator=operator,
        operation_detail=f"创建复核备注，风险评估: {note.risk_assessment}"
    )
    
    return db_note

@app.get("/api/review-notes/", response_model=List[schemas.ReviewNoteResponse], tags=["复核备注"])
def list_review_notes(
    skip: int = 0,
    limit: int = 100,
    batch_id: Optional[int] = None,
    reservation_id: Optional[int] = None,
    is_exception: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ReviewNote)
    
    if batch_id:
        query = query.filter(ReviewNote.batch_id == batch_id)
    if reservation_id:
        query = query.filter(ReviewNote.reservation_id == reservation_id)
    if is_exception is not None:
        query = query.filter(ReviewNote.is_exception == is_exception)
    
    notes = query.order_by(ReviewNote.review_time.desc()).offset(skip).limit(limit).all()
    return notes

@app.get("/api/audit-logs/", response_model=List[schemas.AuditLogResponse], tags=["审计日志"])
def list_audit_logs(
    skip: int = 0,
    limit: int = 100,
    operation_type: Optional[str] = None,
    module: Optional[str] = None,
    operator: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    
    if operation_type:
        query = query.filter(AuditLog.operation_type == operation_type)
    if module:
        query = query.filter(AuditLog.module == module)
    if operator:
        query = query.filter(AuditLog.operator.contains(operator))
    if start_date:
        query = query.filter(AuditLog.log_time >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(AuditLog.log_time <= datetime.combine(end_date, datetime.max.time()))
    
    logs = query.order_by(AuditLog.log_time.desc()).offset(skip).limit(limit).all()
    return logs

@app.post("/api/import/csv/batches", tags=["数据导入"])
async def import_batches_csv(
    file: UploadFile = File(...),
    operator: str = Query("system", description="操作人"),
    db: Session = Depends(get_db)
):
    content = await file.read()
    result = CSVImportService.import_batches(db, content.decode('utf-8'), operator)
    return result

@app.post("/api/import/csv/bags", tags=["数据导入"])
async def import_bags_csv(
    file: UploadFile = File(...),
    operator: str = Query("system", description="操作人"),
    db: Session = Depends(get_db)
):
    content = await file.read()
    result = CSVImportService.import_ton_bags(db, content.decode('utf-8'), operator)
    return result

@app.post("/api/import/csv/inspections", tags=["数据导入"])
async def import_inspections_csv(
    file: UploadFile = File(...),
    operator: str = Query("system", description="操作人"),
    db: Session = Depends(get_db)
):
    content = await file.read()
    result = CSVImportService.import_inspections(db, content.decode('utf-8'), operator)
    return result

@app.post("/api/import/csv/reservations", tags=["数据导入"])
async def import_reservations_csv(
    file: UploadFile = File(...),
    operator: str = Query("system", description="操作人"),
    db: Session = Depends(get_db)
):
    content = await file.read()
    result = CSVImportService.import_reservations(db, content.decode('utf-8'), operator)
    return result

@app.post("/api/import/json", tags=["数据导入"])
async def import_json(
    file: UploadFile = File(...),
    operator: str = Query("system", description="操作人"),
    db: Session = Depends(get_db)
):
    content = await file.read()
    results = JSONImportService.import_json_data(db, content.decode('utf-8'), operator)
    return results

@app.post("/api/risk/recalculate", tags=["风险管理"], response_model=List[schemas.RiskRecalculationResult])
def recalculate_risk(
    request: schemas.RiskRecalculationRequest,
    db: Session = Depends(get_db)
):
    results = []
    for bag_id in request.bag_ids:
        bag = db.query(TonBag).filter(TonBag.id == bag_id).first()
        if bag:
            result = RiskCalculationService.recalculate_bag_risk(db, bag, request.operator)
            results.append(result)
    return results

@app.post("/api/qualification/manual-override", tags=["人工改判"], response_model=schemas.ManualOverrideResult)
def manual_override(
    request: schemas.ManualOverrideRequest,
    db: Session = Depends(get_db)
):
    result = ManualOverrideService.manual_override_qualification(
        db=db,
        bag_id=request.bag_id,
        new_is_qualified=request.new_is_qualified,
        override_reason=request.override_reason,
        operator=request.operator,
        approval_required=request.approval_required
    )
    return result

@app.get("/api/outbound/validate/{reservation_id}", tags=["出库管理"])
def validate_outbound(
    reservation_id: int,
    bag_ids: List[int] = Query(..., description="待出库吨袋 ID 列表"),
    db: Session = Depends(get_db)
):
    validation = OutboundValidationService.validate_outbound(db, reservation_id, bag_ids)
    return validation

@app.get("/api/export/handover/{reservation_id}", tags=["数据导出"], response_class=PlainTextResponse)
def export_handover_markdown(
    reservation_id: int,
    db: Session = Depends(get_db)
):
    markdown = ExportService.generate_handover_markdown(db, reservation_id)
    return PlainTextResponse(
        content=markdown,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=handover_{reservation_id}.md"}
    )

@app.get("/api/export/audit/{reservation_id}", tags=["数据导出"])
def export_audit_package(
    reservation_id: int,
    db: Session = Depends(get_db)
):
    package = ExportService.generate_audit_package(db, reservation_id)
    return JSONResponse(
        content=package,
        headers={"Content-Disposition": f"attachment; filename=audit_package_{reservation_id}.json"}
    )

@app.get("/api/export/audit/{reservation_id}/download", tags=["数据导出"])
def download_audit_package(
    reservation_id: int,
    db: Session = Depends(get_db)
):
    package = ExportService.generate_audit_package(db, reservation_id)
    json_str = json.dumps(package, ensure_ascii=False, indent=2, default=str)
    return PlainTextResponse(
        content=json_str,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=audit_package_{reservation_id}.json"}
    )

@app.get("/api/stats/summary", tags=["统计信息"])
def get_stats_summary(db: Session = Depends(get_db)):
    total_batches = db.query(FlyAshBatch).count()
    total_bags = db.query(TonBag).count()
    qualified_bags = db.query(TonBag).filter(TonBag.is_qualified == True).count()
    outbound_bags = db.query(TonBag).filter(TonBag.is_outbound == True).count()
    pending_bags = db.query(TonBag).filter(
        TonBag.is_outbound == False,
        TonBag.is_qualified == True
    ).count()
    
    high_risk_bags = db.query(TonBag).filter(
        TonBag.risk_level.in_(["high", "critical"])
    ).count()
    
    total_inspections = db.query(InspectionRecord).count()
    passed_inspections = db.query(InspectionRecord).filter(
        InspectionRecord.is_qualified == True
    ).count()
    
    total_reservations = db.query(LandfillReservation).count()
    completed_reservations = db.query(LandfillReservation).filter(
        LandfillReservation.is_completed == True
    ).count()
    
    return {
        "batches": {
            "total": total_batches
        },
        "ton_bags": {
            "total": total_bags,
            "qualified": qualified_bags,
            "outbound": outbound_bags,
            "pending": pending_bags,
            "high_risk": high_risk_bags
        },
        "inspections": {
            "total": total_inspections,
            "passed": passed_inspections,
            "pass_rate": round(passed_inspections / total_inspections * 100, 2) if total_inspections > 0 else 0
        },
        "reservations": {
            "total": total_reservations,
            "completed": completed_reservations
        }
    }
