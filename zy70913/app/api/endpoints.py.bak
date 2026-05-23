from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Batch, Grievance, BatchStatus, GrievanceStatus
from app.schemas import Batch as BatchSchema, Grievance as GrievanceSchema, UploadResponse, BatchResultResponse
from app.services.import_service import ImportService
from app.services.rules_engine import RulesEngine

router = APIRouter()

@router.post("/upload", response_model=UploadResponse)
async def upload_files(
    grievance_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        grievance_content = await grievance_file.read()
        grievance_text = grievance_content.decode("utf-8")
        file_hash = ImportService.generate_file_hash(grievance_content)
        is_duplicate, existing_batch = ImportService.check_duplicate_batch(db, file_hash)
        if is_duplicate:
            raise ValueError(f"File already submitted: {existing_batch.batch_no}")
        batch, grievance_list = ImportService.import_grievances_csv(
            db=db, csv_content=grievance_text,
            file_name=grievance_file.filename, file_hash=file_hash
        )
        created = ImportService.create_grievance_records(db, batch, grievance_list)
        engine = RulesEngine(db=db)
        engine.evaluate_batch(created)
        success = sum(1 for g in created if g.status == GrievanceStatus.APPROVED)
        batch.status = BatchStatus.COMPLETED
        batch.success_count = success
        batch.fail_count = len(created) - success
        db.commit()
        return UploadResponse(
            success=True, batch_no=batch.batch_no,
            message=f"Processed {len(created)}",
            total_count=len(created), file_hash=batch.file_hash
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

