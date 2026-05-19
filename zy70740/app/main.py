from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
import json

from . import models, schemas, crud, core
from .database import engine, get_db
from .models import JobStatus, GPUModel

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="GPU作业排队优先级仲裁后端API", version="1.0.0")


@app.post("/jobs/", response_model=schemas.JobResponse, status_code=201)
def create_job(job: schemas.JobCreate, db: Session = Depends(get_db)):
    db_job = crud.get_job(db, job_id=job.job_id)
    if db_job:
        return db_job
    
    resource = crud.get_gpu_resource(db, job.gpu_model)
    if not resource:
        raise HTTPException(status_code=400, detail=f"GPU model {job.gpu_model} not configured")
    
    created_job = crud.create_job(db=db, job=job)
    core.update_queue_positions(db, job.gpu_model)
    return created_job


@app.get("/jobs/", response_model=List[schemas.JobResponse])
def read_jobs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    jobs = crud.get_jobs(db, skip=skip, limit=limit)
    return jobs


@app.get("/jobs/{job_id}", response_model=schemas.JobResponse)
def read_job(job_id: str, db: Session = Depends(get_db)):
    db_job = crud.get_job(db, job_id=job_id)
    if db_job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return db_job


@app.put("/jobs/{job_id}", response_model=schemas.JobResponse)
def update_job(job_id: str, job_update: schemas.JobUpdate, db: Session = Depends(get_db)):
    db_job = crud.update_job(db, job_id, job_update)
    if db_job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    core.update_queue_positions(db, db_job.gpu_model)
    return db_job


@app.delete("/jobs/{job_id}", response_model=schemas.JobResponse)
def cancel_job(job_id: str, db: Session = Depends(get_db)):
    db_job = crud.cancel_job(db, job_id)
    if db_job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if db_job.status == JobStatus.RUNNING:
        crud.update_gpu_available(db, db_job.gpu_model, db_job.gpu_count)
    core.update_queue_positions(db, db_job.gpu_model)
    return db_job


@app.post("/jobs/advance/{gpu_model}", response_model=List[schemas.JobResponse])
def advance_queue(gpu_model: GPUModel, db: Session = Depends(get_db)):
    started_jobs = core.priority_arbitration(db, gpu_model)
    return started_jobs


@app.post("/jobs/{job_id}/release", response_model=schemas.ReleaseEventResponse)
def release_job(job_id: str, released_by: str, db: Session = Depends(get_db)):
    event = core.release_gpus(db, job_id, released_by)
    if event is None:
        raise HTTPException(status_code=404, detail="Job not found")
    core.priority_arbitration(db, event.gpu_model)
    return event


@app.post("/jobs/process-timeouts", response_model=List[schemas.JobResponse])
def process_timeouts(db: Session = Depends(get_db)):
    timeout_jobs = core.process_timeouts(db)
    for job in timeout_jobs:
        core.priority_arbitration(db, job.gpu_model)
    return timeout_jobs


@app.get("/release-events/", response_model=List[schemas.ReleaseEventResponse])
def read_release_events(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    events = crud.get_release_events(db, skip=skip, limit=limit)
    return events


@app.post("/exceptions/", response_model=schemas.ExceptionRecordResponse, status_code=201)
def create_exception_record(record: schemas.ExceptionRecordCreate, db: Session = Depends(get_db)):
    return crud.create_exception_record(db, record)


@app.get("/queue/summary/", response_model=List[schemas.QueueSummary])
def get_queue_summary(db: Session = Depends(get_db)):
    return core.get_queue_summary(db)


@app.get("/queue/export/", response_model=schemas.QueueExport)
def export_queue(db: Session = Depends(get_db)):
    jobs = crud.get_jobs(db)
    summary = core.get_queue_summary(db)
    job_responses = [schemas.JobResponse.model_validate(job) for job in jobs]
    return schemas.QueueExport(
        jobs=job_responses,
        summary=summary,
        generated_at=datetime.utcnow(),
    )


@app.post("/gpu-resources/", response_model=schemas.GPUResourceCreate)
def create_gpu_resource(resource: schemas.GPUResourceCreate, db: Session = Depends(get_db)):
    existing = crud.get_gpu_resource(db, resource.gpu_model)
    if existing:
        raise HTTPException(status_code=400, detail="GPU resource already exists")
    return crud.create_gpu_resource(db, resource)


@app.get("/gpu-resources/")
def get_gpu_resources(db: Session = Depends(get_db)):
    return crud.get_all_gpu_resources(db)


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "path": request.url.path},
    )