from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from . import models, schemas, crud
from .database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="File Upload Scan Pipeline API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/upload", response_model=schemas.UploadTask)
async def upload_file(
    file: UploadFile = File(...),
    organization_id: Optional[int] = Form(None),
    uploaded_by: str = Form("system"),
    db: Session = Depends(get_db)
):
    content = await file.read()
    task = crud.create_upload_task(
        db,
        file_content=content,
        filename=file.filename,
        organization_id=organization_id,
        uploaded_by=uploaded_by
    )
    return task


@app.post("/api/upload/{task_id}/scan", response_model=schemas.UploadTask)
def scan_task(task_id: int, db: Session = Depends(get_db)):
    task = crud.scan_upload_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.post("/api/upload/{task_id}/release", response_model=schemas.UploadTask)
def release_task(
    task_id: int,
    released_by: str = Form(...),
    reason: str = Form(...),
    db: Session = Depends(get_db)
):
    task = crud.release_from_isolation(db, task_id, released_by, reason)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.post("/api/upload/{task_id}/rollback", response_model=schemas.UploadTask)
def rollback_task(
    task_id: int,
    rolled_back_by: str = Form(...),
    reason: str = Form(...),
    db: Session = Depends(get_db)
):
    task = crud.rollback_task(db, task_id, rolled_back_by, reason)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.get("/api/upload", response_model=List[schemas.UploadTask])
def list_tasks(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    organization_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    return crud.get_upload_tasks(db, skip=skip, limit=limit, status=status, organization_id=organization_id)


@app.get("/api/upload/{task_id}", response_model=schemas.UploadTaskDetail)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = crud.get_upload_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.get("/api/security-logs", response_model=List[schemas.SecurityLog])
def list_security_logs(
    skip: int = 0,
    limit: int = 100,
    severity: Optional[str] = None,
    upload_task_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    return crud.get_security_logs(db, skip=skip, limit=limit, severity=severity, upload_task_id=upload_task_id)


@app.get("/api/security-logs/{log_id}", response_model=schemas.SecurityLog)
def get_security_log(log_id: int, db: Session = Depends(get_db)):
    log = crud.get_security_log(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return log


@app.post("/api/security-logs/{log_id}/resolve", response_model=schemas.SecurityLog)
def resolve_security_log(
    log_id: int,
    data: schemas.SecurityLogResolve,
    db: Session = Depends(get_db)
):
    log = crud.resolve_security_log(db, log_id, data.resolved_by)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return log


@app.post("/api/organizations", response_model=schemas.Organization)
def create_organization(org: schemas.OrganizationCreate, db: Session = Depends(get_db)):
    return crud.create_organization(db, org)


@app.get("/api/organizations", response_model=List[schemas.Organization])
def list_organizations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_organizations(db, skip=skip, limit=limit)


@app.post("/api/organizations/batch-import")
def batch_import_organizations(
    data: schemas.BatchImportRequest,
    db: Session = Depends(get_db)
):
    results = crud.batch_import_organizations(db, data.organizations)
    return {"results": results}


@app.post("/api/scan-rules", response_model=schemas.ScanRule)
def create_scan_rule(rule: schemas.ScanRuleCreate, db: Session = Depends(get_db)):
    return crud.create_scan_rule(db, rule)


@app.get("/api/scan-rules", response_model=List[schemas.ScanRule])
def list_scan_rules(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_scan_rules(db, skip=skip, limit=limit)


@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    tasks = crud.get_upload_tasks(db, limit=1000)
    logs = crud.get_security_logs(db, limit=1000)
    
    status_counts = {}
    threat_counts = {}
    
    for task in tasks:
        status_counts[task.status] = status_counts.get(task.status, 0) + 1
        threat_counts[task.threat_level] = threat_counts.get(task.threat_level, 0) + 1
    
    severity_counts = {}
    for log in logs:
        severity_counts[log.severity] = severity_counts.get(log.severity, 0) + 1
    
    return {
        "total_tasks": len(tasks),
        "total_logs": len(logs),
        "status_counts": status_counts,
        "threat_counts": threat_counts,
        "severity_counts": severity_counts
    }
