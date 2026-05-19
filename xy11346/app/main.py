from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List
import os

from app.database import get_db, engine
from app import models
from app import schemas
from app.services import crud
from app.utils.exporter import export_quality_records_to_excel

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="印刷车间品控管理系统", version="1.0.0")

@app.post("/api/paper-batches/", response_model=schemas.PaperBatch)
def create_paper_batch(batch: schemas.PaperBatchCreate, db: Session = Depends(get_db)):
    db_batch = crud.get_paper_batch(db, batch_number=batch.batch_number)
    if db_batch:
        raise HTTPException(status_code=400, detail="纸张批次已存在")
    return crud.create_paper_batch(db=db, batch=batch)

@app.get("/api/paper-batches/", response_model=List[schemas.PaperBatch])
def read_paper_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    batches = crud.get_paper_batches(db, skip=skip, limit=limit)
    return batches

@app.post("/api/quality-thresholds/", response_model=schemas.QualityThreshold)
def create_quality_threshold(threshold: schemas.QualityThresholdCreate, db: Session = Depends(get_db)):
    return crud.create_quality_threshold(db=db, threshold=threshold)

@app.get("/api/quality-thresholds/", response_model=List[schemas.QualityThreshold])
def read_quality_thresholds(product_type: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.get_quality_thresholds(db, product_type=product_type)

@app.post("/api/quality-records/", response_model=schemas.QualityRecord)
def create_quality_record(record: schemas.QualityRecordCreate, db: Session = Depends(get_db)):
    return crud.create_quality_record(db=db, record=record)

@app.get("/api/quality-records/{record_id}", response_model=schemas.QualityRecord)
def read_quality_record(record_id: int, db: Session = Depends(get_db)):
    db_record = crud.get_quality_record(db, record_id=record_id)
    if db_record is None:
        raise HTTPException(status_code=404, detail="记录未找到")
    return db_record

@app.get("/api/quality-records/", response_model=schemas.PaginatedQualityRecords)
def read_quality_records(
    inspector: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    status: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    batch_number: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    total, records = crud.get_quality_records(
        db,
        inspector=inspector,
        start_time=start_time,
        end_time=end_time,
        status=status,
        anomaly_type=anomaly_type,
        batch_number=batch_number,
        skip=skip,
        limit=limit
    )
    return {"total": total, "records": records}

@app.put("/api/quality-records/{record_id}", response_model=schemas.QualityRecord)
def update_quality_record(record_id: int, update: schemas.QualityRecordUpdate, db: Session = Depends(get_db)):
    db_record = crud.update_quality_record(db, record_id=record_id, update=update)
    if db_record is None:
        raise HTTPException(status_code=404, detail="记录未找到")
    return db_record

@app.get("/api/statistics/")
def get_statistics(
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    return crud.get_statistics(db, start_time=start_time, end_time=end_time)

@app.post("/api/export/")
def export_quality_records(
    export_request: schemas.ExportRequest,
    db: Session = Depends(get_db)
):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = f"quality_report_{timestamp}.xlsx"
    
    try:
        export_quality_records_to_excel(
            db,
            inspector=export_request.inspector,
            start_time=export_request.start_time,
            end_time=export_request.end_time,
            status=export_request.status,
            anomaly_type=export_request.anomaly_type,
            batch_number=export_request.batch_number,
            output_path=output_path
        )
        
        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="导出失败")
        
        return FileResponse(
            path=output_path,
            filename=output_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health/")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
