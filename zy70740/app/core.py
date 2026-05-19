from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from . import models, schemas, crud
from .models import JobStatus


def check_resource_availability(db: Session, gpu_model: str, gpu_count: int) -> bool:
    resource = crud.get_gpu_resource(db, gpu_model)
    if not resource:
        return False
    return resource.available >= gpu_count


def priority_arbitration(db: Session, gpu_model: str) -> List[models.Job]:
    pending_jobs = crud.get_pending_jobs_by_gpu(db, gpu_model)
    resource = crud.get_gpu_resource(db, gpu_model)
    
    if not resource or resource.available <= 0:
        return []
    
    started_jobs = []
    available_gpus = resource.available
    
    for idx, job in enumerate(pending_jobs):
        if available_gpus >= job.gpu_count:
            crud.start_job(db, job.job_id)
            crud.update_gpu_available(db, gpu_model, -job.gpu_count)
            available_gpus -= job.gpu_count
            job.queue_position = idx + 1
            started_jobs.append(job)
        else:
            job.queue_position = idx + 1
    
    db.commit()
    return started_jobs


def release_gpus(db: Session, job_id: str, released_by: str) -> models.ReleaseEvent:
    job = crud.get_job(db, job_id)
    if not job:
        return None
    
    gpu_model = job.gpu_model
    released_gpus = job.gpu_count
    
    crud.complete_job(db, job_id)
    crud.update_gpu_available(db, gpu_model, released_gpus)
    
    event = schemas.ReleaseEventCreate(
        job_id=job_id,
        released_gpus=released_gpus,
        gpu_model=gpu_model,
        released_by=released_by,
    )
    return crud.create_release_event(db, event)


def process_timeouts(db: Session) -> List[models.Job]:
    timeout_jobs = crud.check_timeout_jobs(db)
    for job in timeout_jobs:
        crud.update_gpu_available(db, job.gpu_model, job.gpu_count)
    return timeout_jobs


def update_queue_positions(db: Session, gpu_model: str):
    pending_jobs = crud.get_pending_jobs_by_gpu(db, gpu_model)
    for idx, job in enumerate(pending_jobs):
        job.queue_position = idx + 1
    db.commit()


def get_queue_summary(db: Session) -> List[schemas.QueueSummary]:
    from sqlalchemy import func
    
    results = db.query(
        models.Job.gpu_model,
        func.count(models.Job.id).label('total_jobs'),
        func.sum(models.Job.status == JobStatus.PENDING).label('pending_jobs'),
        func.sum(models.Job.status == JobStatus.RUNNING).label('running_jobs'),
        func.avg(models.Job.priority).label('avg_priority'),
    ).group_by(models.Job.gpu_model).all()
    
    summaries = []
    for row in results:
        pending_jobs = crud.get_pending_jobs_by_gpu(db, row.gpu_model)
        total_estimated = sum(j.estimated_duration for j in pending_jobs)
        avg_priority = float(row.avg_priority) if row.avg_priority is not None else 0.0
        
        summaries.append(schemas.QueueSummary(
            gpu_model=row.gpu_model,
            total_jobs=row.total_jobs,
            pending_jobs=row.pending_jobs or 0,
            running_jobs=row.running_jobs or 0,
            avg_priority=avg_priority,
            estimated_wait_time=total_estimated,
        ))
    
    return summaries