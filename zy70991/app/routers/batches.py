from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app import models, schemas, services
from app.database import get_db

router = APIRouter(prefix="/api/batches", tags=["batches"])


@router.post("", response_model=schemas.BatchResponse)
def create_batch(batch: schemas.BatchCreate, db: Session = Depends(get_db)):
    try:
        db_batch, is_duplicate = services.get_or_create_batch(db, batch)
        response = schemas.BatchResponse.model_validate(db_batch)
        response.is_duplicate = is_duplicate
        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{batch_no}", response_model=schemas.BatchResponse)
def get_batch(batch_no: str, db: Session = Depends(get_db)):
    batch = services.get_batch(db, batch_no)
    if not batch:
        raise HTTPException(status_code=404, detail=f"Batch {batch_no} not found")
    return batch


@router.post("/materials", response_model=schemas.BatchResponse)
def upload_materials(request: schemas.MaterialUploadRequest, db: Session = Depends(get_db)):
    try:
        batch, is_duplicate, fingerprint = services.upload_materials(db, request)
        response = schemas.BatchResponse.model_validate(batch)
        response.is_duplicate = is_duplicate
        return response
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/split", response_model=schemas.SplitResponse)
def split_settlement(request: schemas.SplitRequest, db: Session = Depends(get_db)):
    try:
        batch, is_duplicate, details, message = services.split_settlement(db, request.batch_no)
        return schemas.SplitResponse(
            batch_no=batch.batch_no,
            status=batch.status.value,
            is_duplicate=is_duplicate,
            details=[schemas.SettlementDetailResponse.model_validate(d) for d in details],
            message=message,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{batch_no}/report", response_model=schemas.ReportResponse)
def generate_report(batch_no: str, db: Session = Depends(get_db)):
    try:
        report = services.generate_report(db, batch_no)
        return report
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{batch_no}/report", response_model=schemas.ReportResponse)
def get_report(batch_no: str, db: Session = Depends(get_db)):
    batch = services.get_batch(db, batch_no)
    if not batch:
        raise HTTPException(status_code=404, detail=f"Batch {batch_no} not found")
    
    report = db.query(models.Report).filter(
        models.Report.batch_id == batch.id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail=f"Report for batch {batch_no} not found")
    
    return report
