from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from io import BytesIO
import json

from app.database import engine, Base, get_db
from app.models import FlagStatus
from app import schemas, services
from app.export import ExcelExporter

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Feature Flag Cleanup API", version="1.0.0")


@app.post("/api/flags/", response_model=schemas.FeatureFlag, status_code=201)
def create_flag(flag_create: schemas.FeatureFlagCreate, db: Session = Depends(get_db)):
    service = services.FeatureFlagService(db)
    return service.create_flag(flag_create)


@app.get("/api/flags/", response_model=List[schemas.FeatureFlag])
def list_flags(
    skip: int = 0,
    limit: int = 100,
    status: Optional[FlagStatus] = None,
    db: Session = Depends(get_db)
):
    service = services.FeatureFlagService(db)
    return service.get_flags(skip=skip, limit=limit, status=status)


@app.get("/api/flags/{flag_id}/", response_model=schemas.FeatureFlag)
def get_flag(flag_id: int, db: Session = Depends(get_db)):
    service = services.FeatureFlagService(db)
    flag = service.get_flag(flag_id)
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    return flag


@app.put("/api/flags/{flag_id}/", response_model=schemas.FeatureFlag)
def update_flag(
    flag_id: int,
    flag_update: schemas.FeatureFlagUpdate,
    processed_by: str = Query(..., description="User who performed this action"),
    db: Session = Depends(get_db)
):
    service = services.FeatureFlagService(db)
    flag = service.update_flag(flag_id, flag_update, processed_by)
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    return flag


@app.post("/api/flags/{flag_id}/status/", response_model=schemas.FeatureFlag)
def update_status(
    flag_id: int,
    request: schemas.StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    service = services.FeatureFlagService(db)
    flag = service.update_status(flag_id, request)
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    return flag


@app.post("/api/flags/{flag_id}/scan/", response_model=schemas.ScanResult)
def scan_and_analyze(flag_id: int, db: Session = Depends(get_db)):
    service = services.FeatureFlagService(db)
    result = service.scan_and_analyze(flag_id)
    if not result:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    return result


@app.post("/api/flags/{flag_id}/correct/", response_model=schemas.FeatureFlag)
def manual_correction(
    flag_id: int,
    request: schemas.ManualCorrectionRequest,
    db: Session = Depends(get_db)
):
    service = services.FeatureFlagService(db)
    flag = service.manual_correction(flag_id, request)
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    return flag


@app.post("/api/flags/{flag_id}/cancel/", response_model=schemas.FeatureFlag)
def cancel_flag(
    flag_id: int,
    processed_by: str = Query(..., description="User who cancelled"),
    reason: str = Query(..., description="Reason for cancellation"),
    db: Session = Depends(get_db)
):
    service = services.FeatureFlagService(db)
    flag = service.cancel_flag(flag_id, processed_by, reason)
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    return flag


@app.post("/api/flags/{flag_id}/references/", response_model=schemas.CodeReference, status_code=201)
def add_code_reference(
    flag_id: int,
    ref: schemas.CodeReferenceCreate,
    db: Session = Depends(get_db)
):
    service = services.FeatureFlagService(db)
    code_ref = service.add_code_reference(flag_id, ref)
    if not code_ref:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    return code_ref


@app.post("/api/reports/", response_model=schemas.CleanupReport, status_code=201)
def generate_report(
    generated_by: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = services.ReportService(db)
    return service.generate_cleanup_report(generated_by)


@app.get("/api/reports/", response_model=List[schemas.CleanupReport])
def list_reports(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    service = services.ReportService(db)
    return service.get_all_reports(skip=skip, limit=limit)


@app.get("/api/reports/{report_id}/", response_model=schemas.CleanupReport)
def get_report(report_id: int, db: Session = Depends(get_db)):
    service = services.ReportService(db)
    report = service.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@app.get("/api/export/flags/")
def export_flags_excel(db: Session = Depends(get_db)):
    service = services.FeatureFlagService(db)
    flags = service.get_flags(limit=1000)
    
    exporter = ExcelExporter()
    output = exporter.export_flags(flags)
    
    return StreamingResponse(
        BytesIO(output),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=feature_flags_cleanup.xlsx"}
    )


@app.get("/api/flags/{flag_id}/audit/", response_model=List[schemas.AuditLog])
def get_audit_logs(flag_id: int, db: Session = Depends(get_db)):
    service = services.FeatureFlagService(db)
    flag = service.get_flag(flag_id)
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    return flag.audit_logs


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "featureflag-cleanup"}
