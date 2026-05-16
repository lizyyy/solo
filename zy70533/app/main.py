from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import json

from . import models, schemas, services, export_service
from .database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Experiment Parameter Freeze API",
    description="API for managing AB experiment parameter freezing with snapshot, approval workflow, and exception tracking",
    version="1.0.0"
)

os.makedirs("exports", exist_ok=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/freezes", response_model=schemas.ExperimentFreezeResponse, tags=["Experiment Freeze"])
def create_freeze(freeze: schemas.ExperimentFreezeCreate, db: Session = Depends(get_db)):
    return services.create_experiment_freeze(db, freeze)


@app.get("/freezes", response_model=List[schemas.ExperimentFreezeResponse], tags=["Experiment Freeze"])
def list_freezes(experiment_id: Optional[str] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_experiment_freezes(db, experiment_id, skip, limit)


@app.get("/freezes/{freeze_id}", response_model=schemas.FreezeDetailResponse, tags=["Experiment Freeze"])
def get_freeze(freeze_id: int, db: Session = Depends(get_db)):
    detail = services.get_freeze_detail(db, freeze_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Freeze record not found")
    return detail


@app.post("/freezes/status", response_model=schemas.ExperimentFreezeResponse, tags=["Experiment Freeze"])
def advance_status(request: schemas.StatusAdvanceRequest, db: Session = Depends(get_db)):
    freeze = services.advance_freeze_status(db, request)
    if not freeze:
        raise HTTPException(status_code=404, detail="Freeze record not found")
    return freeze


@app.post("/change-requests", response_model=schemas.ChangeRequestResponse, tags=["Change Requests"])
def create_change_request(request: schemas.ChangeRequestCreate, db: Session = Depends(get_db)):
    change_request = services.create_change_request(db, request)
    if not change_request:
        raise HTTPException(status_code=404, detail="Freeze record not found")
    return change_request


@app.post("/change-requests/{request_id}/approve", response_model=schemas.ChangeRequestResponse, tags=["Change Requests"])
def approve_change(request_id: int, approval: schemas.ChangeRequestApprove, db: Session = Depends(get_db)):
    change_request = services.approve_change_request(db, request_id, approval)
    if not change_request:
        raise HTTPException(status_code=404, detail="Change request not found")
    return change_request


@app.get("/change-requests", response_model=List[schemas.ChangeRequestResponse], tags=["Change Requests"])
def list_change_requests(freeze_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(models.ChangeRequest)
    if freeze_id:
        query = query.filter(models.ChangeRequest.freeze_id == freeze_id)
    return query.offset(skip).limit(limit).all()


@app.post("/exceptions", response_model=schemas.ExceptionRecordResponse, tags=["Exception Handling"])
def create_exception(exception: schemas.ExceptionRecordCreate, db: Session = Depends(get_db)):
    return services.create_exception_record(db, exception)


@app.post("/exceptions/{exception_id}/resolve", response_model=schemas.ExceptionRecordResponse, tags=["Exception Handling"])
def resolve_exception(exception_id: int, resolve: schemas.ExceptionRecordResolve, db: Session = Depends(get_db)):
    exception = services.resolve_exception_record(db, exception_id, resolve)
    if not exception:
        raise HTTPException(status_code=404, detail="Exception record not found")
    return exception


@app.get("/exceptions", response_model=List[schemas.ExceptionRecordResponse], tags=["Exception Handling"])
def list_exceptions(freeze_id: Optional[int] = None, is_resolved: Optional[bool] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(models.ExceptionRecord)
    if freeze_id:
        query = query.filter(models.ExceptionRecord.freeze_id == freeze_id)
    if is_resolved is not None:
        query = query.filter(models.ExceptionRecord.is_resolved == is_resolved)
    return query.offset(skip).limit(limit).all()


@app.post("/manual-correction", response_model=schemas.ExperimentFreezeResponse, tags=["Manual Correction"])
def apply_manual_correction(correction: schemas.ManualCorrectionRequest, db: Session = Depends(get_db)):
    freeze = services.manual_correction(db, correction)
    if not freeze:
        raise HTTPException(status_code=404, detail="Freeze record not found")
    return freeze


@app.post("/reports", response_model=schemas.FreezeReportResponse, tags=["Reports"])
def create_report(report: schemas.FreezeReportCreate, db: Session = Depends(get_db)):
    return services.generate_freeze_report(db, report)


@app.get("/reports", response_model=List[schemas.FreezeReportResponse], tags=["Reports"])
def list_reports(freeze_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(models.FreezeReport)
    if freeze_id:
        query = query.filter(models.FreezeReport.freeze_id == freeze_id)
    return query.offset(skip).limit(limit).all()


@app.post("/export", tags=["Export"])
def export_freeze(export_request: schemas.ExportRequest, db: Session = Depends(get_db)):
    try:
        result = export_service.export_freeze_data(db, export_request.freeze_id, export_request.export_format)
        if not result:
            raise HTTPException(status_code=404, detail="Freeze record not found")
        
        if result["format"] == "json":
            return JSONResponse(
                content=json.loads(result["content"]),
                headers={"Content-Disposition": f"attachment; filename={result['filename']}"}
            )
        else:
            return FileResponse(
                result["file_path"],
                filename=result["filename"],
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/audit-logs", response_model=List[schemas.AuditLogResponse], tags=["Audit Logs"])
def list_audit_logs(freeze_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(models.AuditLog)
    if freeze_id:
        query = query.filter(models.AuditLog.freeze_id == freeze_id)
    return query.order_by(models.AuditLog.operated_at.desc()).offset(skip).limit(limit).all()


@app.get("/snapshots", response_model=List[schemas.ParameterSnapshotResponse], tags=["Parameter Snapshots"])
def list_snapshots(freeze_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(models.ParameterSnapshot)
    if freeze_id:
        query = query.filter(models.ParameterSnapshot.freeze_id == freeze_id)
    return query.order_by(models.ParameterSnapshot.snapshot_time.desc()).offset(skip).limit(limit).all()
