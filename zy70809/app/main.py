from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
import uuid
import os

from app.config import UPLOAD_DIR
from app.database import engine, get_db, Base
from app.models import Batch, BatchStatus, Equipment, Contract, InspectionPhoto, ValidationResult
from app.excel_parser import parse_equipment_excel, parse_photo_excel, parse_contract_excel
from app.validation_engine import validate_all
from app.schemas import BatchProcessResponse, EquipmentTraceResponse

Base.metadata.create_all(bind=engine)

app = FastAPI(title="消防维保管理系统", version="1.0.0")

@app.post("/api/batch/upload", response_model=BatchProcessResponse)
async def upload_and_process(
    batch_no: Optional[str] = Query(None, description="批次号，用于幂等性控制，不传则自动生成"),
    equipment_file: UploadFile = File(..., description="设备台账Excel"),
    photo_file: Optional[UploadFile] = File(None, description="巡检照片清单Excel"),
    contract_file: Optional[UploadFile] = File(None, description="合同期限表Excel"),
    db: Session = Depends(get_db)
):
    if not batch_no:
        batch_no = f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    existing_batch = db.query(Batch).filter(Batch.batch_no == batch_no).first()
    if existing_batch:
        if existing_batch.status == BatchStatus.COMPLETED:
            return await get_batch_results(existing_batch, db)
        elif existing_batch.status == BatchStatus.PROCESSING:
            raise HTTPException(status_code=400, detail="批次正在处理中，请稍后再试")
        else:
            db.delete(existing_batch)
            db.commit()
    
    batch = Batch(
        batch_no=batch_no,
        status=BatchStatus.PROCESSING
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    try:
        equipment_path = await save_file(equipment_file, batch_no, "equipment")
        batch.equipment_file = equipment_path
        
        photo_path = None
        if photo_file:
            photo_path = await save_file(photo_file, batch_no, "photo")
            batch.photo_file = photo_path
        
        contract_path = None
        if contract_file:
            contract_path = await save_file(contract_file, batch_no, "contract")
            batch.contract_file = contract_path
        
        db.commit()
        
        equipment_list = parse_equipment_excel(equipment_path)
        photo_list = parse_photo_excel(photo_path) if photo_path else []
        contract_list = parse_contract_excel(contract_path) if contract_path else []
        
        save_equipment_to_db(equipment_list, batch.id, db)
        save_photos_to_db(photo_list, batch.id, db)
        save_contracts_to_db(contract_list, batch.id, db)
        
        normal_items, pending_confirm_items, failed_items = validate_all(
            equipment_list, photo_list, contract_list
        )
        
        save_validation_results(pending_confirm_items, batch.id, db)
        save_validation_results(failed_items, batch.id, db)
        
        batch.status = BatchStatus.COMPLETED
        batch.processed_at = datetime.utcnow()
        db.commit()
        
        return BatchProcessResponse(
            batch_no=batch_no,
            status=BatchStatus.COMPLETED,
            normal_count=len(normal_items),
            pending_confirm_count=len(pending_confirm_items),
            failed_count=len(failed_items),
            normal_items=normal_items,
            pending_confirm_items=pending_confirm_items,
            failed_items=failed_items
        )
        
    except Exception as e:
        batch.status = BatchStatus.FAILED
        db.commit()
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")

async def save_file(file: UploadFile, batch_no: str, file_type: str) -> str:
    ext = os.path.splitext(file.filename)[1]
    filename = f"{batch_no}_{file_type}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    return file_path

def save_equipment_to_db(equipment_list, batch_id: int, db: Session):
    for eq in equipment_list:
        db_equipment = Equipment(
            batch_id=batch_id,
            equipment_code=eq["equipment_code"],
            equipment_name=eq["equipment_name"],
            equipment_type=eq["equipment_type"],
            location=eq["location"],
            last_maintenance_date=eq["last_maintenance_date"],
            next_maintenance_date=eq["next_maintenance_date"],
            maintenance_company=eq["maintenance_company"]
        )
        db.add(db_equipment)
    db.commit()

def save_photos_to_db(photo_list, batch_id: int, db: Session):
    for photo in photo_list:
        db_photo = InspectionPhoto(
            batch_id=batch_id,
            equipment_code=photo["equipment_code"],
            photo_name=photo["photo_name"],
            photo_path=photo["photo_path"],
            upload_date=photo["upload_date"],
            inspector=photo["inspector"]
        )
        db.add(db_photo)
    db.commit()

def save_contracts_to_db(contract_list, batch_id: int, db: Session):
    for contract in contract_list:
        db_contract = Contract(
            batch_id=batch_id,
            contract_no=contract["contract_no"],
            equipment_code=contract["equipment_code"],
            contractor=contract["contractor"],
            start_date=contract["start_date"],
            end_date=contract["end_date"],
            contract_amount=contract["contract_amount"]
        )
        db.add(db_contract)
    db.commit()

def save_validation_results(results, batch_id: int, db: Session):
    for result in results:
        db_result = ValidationResult(
            batch_id=batch_id,
            equipment_code=result["equipment_code"],
            result_type=result["result_type"],
            rule_type=result["rule_type"],
            original_data=result["original_data"],
            suggestion=result["suggestion"]
        )
        db.add(db_result)
    db.commit()

def result_to_dict(result):
    return {
        "equipment_code": result.equipment_code,
        "result_type": str(result.result_type),
        "rule_type": str(result.rule_type) if result.rule_type else None,
        "original_data": result.original_data,
        "suggestion": result.suggestion,
        "id": result.id,
        "batch_id": result.batch_id,
        "created_at": str(result.created_at)
    }

async def get_batch_results(batch: Batch, db: Session) -> BatchProcessResponse:
    equipment_list = db.query(Equipment).filter(Equipment.batch_id == batch.id).all()
    pending_confirm_results = db.query(ValidationResult).filter(
        ValidationResult.batch_id == batch.id,
        ValidationResult.result_type == "pending_confirm"
    ).all()
    failed_results = db.query(ValidationResult).filter(
        ValidationResult.batch_id == batch.id,
        ValidationResult.result_type == "failed"
    ).all()
    
    pending_confirm_items = [result_to_dict(r) for r in pending_confirm_results]
    failed_items = [result_to_dict(r) for r in failed_results]
    
    normal_count = len(equipment_list) - len(pending_confirm_items) - len(failed_items)
    normal_items = []
    
    failed_codes = {r["equipment_code"] for r in failed_items}
    pending_codes = {r["equipment_code"] for r in pending_confirm_items}
    
    for eq in equipment_list:
        if eq.equipment_code not in failed_codes and eq.equipment_code not in pending_codes:
            normal_items.append({
                "equipment_code": eq.equipment_code,
                "equipment_name": eq.equipment_name,
                "equipment_type": eq.equipment_type,
                "location": eq.location,
                "last_maintenance_date": str(eq.last_maintenance_date) if eq.last_maintenance_date else None,
                "next_maintenance_date": str(eq.next_maintenance_date) if eq.next_maintenance_date else None,
                "maintenance_company": eq.maintenance_company
            })
    
    return BatchProcessResponse(
        batch_no=batch.batch_no,
        status=batch.status,
        normal_count=normal_count,
        pending_confirm_count=len(pending_confirm_items),
        failed_count=len(failed_items),
        normal_items=normal_items,
        pending_confirm_items=pending_confirm_items,
        failed_items=failed_items
    )

@app.get("/api/equipment/{equipment_code}/trace", response_model=EquipmentTraceResponse)
def trace_equipment(equipment_code: str, db: Session = Depends(get_db)):
    equipment = db.query(Equipment).filter(
        Equipment.equipment_code == equipment_code
    ).order_by(Equipment.created_at.desc()).first()
    
    if not equipment:
        raise HTTPException(status_code=404, detail="设备不存在")
    
    all_equipment = db.query(Equipment).filter(
        Equipment.equipment_code == equipment_code
    ).order_by(Equipment.created_at.desc()).all()
    
    maintenance_dates = [{
        "batch_id": eq.batch_id,
        "last_maintenance_date": str(eq.last_maintenance_date) if eq.last_maintenance_date else None,
        "next_maintenance_date": str(eq.next_maintenance_date) if eq.next_maintenance_date else None,
        "maintenance_company": eq.maintenance_company,
        "created_at": str(eq.created_at)
    } for eq in all_equipment]
    
    contracts = db.query(Contract).filter(
        Contract.equipment_code == equipment_code
    ).all()
    contracts_data = [{
        "contract_no": c.contract_no,
        "contractor": c.contractor,
        "start_date": str(c.start_date) if c.start_date else None,
        "end_date": str(c.end_date) if c.end_date else None,
        "batch_id": c.batch_id
    } for c in contracts]
    
    photos = db.query(InspectionPhoto).filter(
        InspectionPhoto.equipment_code == equipment_code
    ).all()
    photos_data = [{
        "photo_name": p.photo_name,
        "upload_date": str(p.upload_date) if p.upload_date else None,
        "inspector": p.inspector,
        "batch_id": p.batch_id
    } for p in photos]
    
    validation_history = db.query(ValidationResult).filter(
        ValidationResult.equipment_code == equipment_code
    ).order_by(ValidationResult.created_at.desc()).all()
    validation_data = [{
        "result_type": str(v.result_type),
        "rule_type": str(v.rule_type) if v.rule_type else None,
        "suggestion": v.suggestion,
        "batch_id": v.batch_id,
        "created_at": str(v.created_at)
    } for v in validation_history]
    
    final_report = None
    if validation_history:
        latest = validation_history[0]
        if latest.result_type == "normal":
            report_status = "正常"
        elif latest.result_type == "pending_confirm":
            report_status = "待确认"
        else:
            report_status = "异常"
        
        final_report = {
            "status": report_status,
            "last_check_date": str(latest.created_at.date()),
            "issues": [v.suggestion for v in validation_history if v.result_type != "normal"],
            "maintenance_expire": str(equipment.next_maintenance_date) if equipment.next_maintenance_date else "未设置",
            "contract_count": len(contracts),
            "photo_count": len(photos)
        }
    
    return EquipmentTraceResponse(
        equipment_code=equipment_code,
        equipment_name=equipment.equipment_name,
        maintenance_dates=maintenance_dates,
        contracts=contracts_data,
        photos=photos_data,
        validation_history=validation_data,
        final_report=final_report
    )

@app.get("/api/batch/{batch_no}")
def get_batch(batch_no: str, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.batch_no == batch_no).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return {"batch_no": batch.batch_no, "status": batch.status, "created_at": batch.created_at}

@app.get("/api/expired")
def get_expired_list(db: Session = Depends(get_db)):
    from sqlalchemy import and_
    today = datetime.now().date()
    
    latest_equipment = db.query(
        Equipment.equipment_code,
        Equipment.equipment_name,
        Equipment.next_maintenance_date,
        Equipment.location
    ).distinct(Equipment.equipment_code).order_by(
        Equipment.equipment_code, Equipment.created_at.desc()
    ).all()
    
    expired_list = []
    for eq in latest_equipment:
        if eq.next_maintenance_date and eq.next_maintenance_date < today:
            expired_list.append({
                "equipment_code": eq.equipment_code,
                "equipment_name": eq.equipment_name,
                "next_maintenance_date": str(eq.next_maintenance_date),
                "location": eq.location,
                "expired_days": (today - eq.next_maintenance_date).days
            })
    
    return {"count": len(expired_list), "items": expired_list}
