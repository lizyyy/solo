from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Batch, Grievance, BatchStatus, GrievanceStatus, ProcessingHistory
from app.schemas import Batch as BatchSchema, Grievance as GrievanceSchema, UploadResponse, BatchResultResponse, ProcessingHistory as ProcessingHistorySchema
from app.services.import_service import ImportService
from app.services.rules_engine import RulesEngine
import json

router = APIRouter()

@router.post("/upload", response_model=UploadResponse)
async def upload_files(
    grievance_csv: UploadFile = File(...),
    flight_json: Optional[UploadFile] = File(None),
    photo_json: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    def get_failure_reason_and_suggestion(grievance):
        failure_reasons = []
        suggestions = []
        
        if not grievance.is_responsible:
            failure_reasons.append("非责任航段")
            suggestions.append("建议转至对应责任航司处理")
        if grievance.photo_count < 2:
            failure_reasons.append("照片不足")
            suggestions.append("建议补充至少2张照片证据（登机牌、现场照片等）")
        if grievance.final_amount != grievance.apply_amount and grievance.apply_amount > grievance.final_amount:
            failure_reasons.append("金额超限")
            suggestions.append("建议调整金额至上限以内，或提交特殊审批")
        if grievance.is_overdue:
            failure_reasons.append("超时申报")
            suggestions.append("建议驳回或走特殊审批流程")
        
        return "; ".join(failure_reasons), "; ".join(suggestions)

    def build_item_dict(grievance):
        original_data = {}
        if grievance.original_data:
            try:
                original_data = json.loads(grievance.original_data)
            except:
                pass
        failure_reason, suggestion = get_failure_reason_and_suggestion(grievance)
        return {
            "grievance_no": grievance.grievance_no,
            "passenger_name": grievance.passenger_name,
            "flight_no": grievance.flight_no,
            "incident_type": grievance.incident_type,
            "apply_amount": grievance.apply_amount,
            "original_data": original_data,
            "failure_reason": failure_reason,
            "suggestion": suggestion
        }

    try:
        grievance_content = await grievance_csv.read()
        grievance_text = grievance_content.decode("utf-8")
        file_hash = ImportService.generate_file_hash(grievance_content)
        is_duplicate, existing_batch = ImportService.check_duplicate_batch(db, file_hash)
        if is_duplicate:
            raise ValueError(f"File already submitted: {existing_batch.batch_no}")
        batch, grievance_list = ImportService.import_grievances_csv(
            db=db, csv_content=grievance_text,
            file_name=grievance_csv.filename, file_hash=file_hash
        )
        
        flight_map = None
        if flight_json:
            flight_content = await flight_json.read()
            flight_map = ImportService.parse_flights_json(flight_content)
        
        photo_map = None
        if photo_json:
            photo_content = await photo_json.read()
            photo_map = ImportService.parse_photos_json(photo_content)
        
        created = ImportService.create_grievance_records(db, batch, grievance_list, flight_map, photo_map)
        engine = RulesEngine(db=db)
        engine.evaluate_batch(created)
        
        normal_items = [g for g in created if g.status == GrievanceStatus.APPROVED]
        pending_items = [build_item_dict(g) for g in created if g.status == GrievanceStatus.PENDING]
        failed_items = [build_item_dict(g) for g in created if g.status == GrievanceStatus.REJECTED]
        
        batch.status = BatchStatus.COMPLETED
        batch.success_count = len(normal_items)
        batch.fail_count = len(failed_items)
        batch.pending_count = len(pending_items)
        db.commit()
        return UploadResponse(
            success=True, batch_no=batch.batch_no,
            message=f"Processed {len(created)}",
            total_count=len(created),
            normal_count=len(normal_items),
            pending_count=len(pending_items),
            rejected_count=len(failed_items),
            normal_items=normal_items,
            pending_items=pending_items,
            failed_items=failed_items,
            file_hash=batch.file_hash
        )
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/batches", response_model=List[BatchSchema])
def get_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Batch).order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/batches/{batch_no}", response_model=BatchResultResponse)
def get_batch_result(batch_no: str, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.batch_no == batch_no).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Not found")
    grievances = db.query(Grievance).filter(Grievance.batch_id == batch.id).all()
    approved = sum(1 for g in grievances if g.status == GrievanceStatus.APPROVED)
    rejected = sum(1 for g in grievances if g.status == GrievanceStatus.REJECTED)
    pending = sum(1 for g in grievances if g.status == GrievanceStatus.PENDING)
    total = sum(g.final_amount or 0 for g in grievances)
    return BatchResultResponse(
        batch=batch, grievances=grievances,
        approved_count=approved, rejected_count=rejected,
        pending_count=pending, total_amount=total
    )

@router.get("/grievances", response_model=List[GrievanceSchema])
def get_grievances(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Grievance).order_by(Grievance.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/grievances/{grievance_no}", response_model=GrievanceSchema)
def get_grievance(grievance_no: str, db: Session = Depends(get_db)):
    g = db.query(Grievance).filter(Grievance.grievance_no == grievance_no).first()
    if not g:
        raise HTTPException(status_code=404, detail="Not found")
    return g

@router.get("/grievances/{grievance_no}/history", response_model=List[ProcessingHistorySchema])
def get_grievance_history(grievance_no: str, db: Session = Depends(get_db)):
    grievance = db.query(Grievance).filter(Grievance.grievance_no == grievance_no).first()
    if not grievance:
        raise HTTPException(status_code=404, detail="Not found")
    return db.query(ProcessingHistory).filter(ProcessingHistory.grievance_id == grievance.id).order_by(ProcessingHistory.created_at.asc()).all()
