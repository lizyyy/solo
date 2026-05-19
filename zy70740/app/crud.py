from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from . import models, schemas
from .models import JobStatus, GPUModel


def get_job(db: Session, job_id: str):
    return db.query(models.Job).filter(models.Job.job_id == job_id).first()


def get_jobs(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Job).offset(skip).limit(limit).all()


def create_job(db: Session, job: schemas.JobCreate):
    db_job = models.Job(
        job_id=job.job_id,
        gpu_model=job.gpu_model,
        gpu_count=job.gpu_count,
        estimated_duration=job.estimated_duration,
        priority=job.priority,
        user=job.user,
        status=JobStatus.PENDING,
    )
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    return db_job


def update_job(db: Session, job_id: str, job_update: schemas.JobUpdate):
    db_job = get_job(db, job_id)
    if db_job:
        for key, value in job_update.dict(exclude_unset=True).items():
            setattr(db_job, key, value)
        db.commit()
        db.refresh(db_job)
    return db_job


def delete_job(db: Session, job_id: str):
    db_job = get_job(db, job_id)
    if db_job:
        db.delete(db_job)
        db.commit()
    return db_job


def get_pending_jobs_by_gpu(db: Session, gpu_model: str):
    return db.query(models.Job).filter(
        models.Job.status == JobStatus.PENDING,
        models.Job.gpu_model == gpu_model
    ).order_by(models.Job.priority.desc(), models.Job.created_at.asc()).all()


def get_running_jobs(db: Session):
    return db.query(models.Job).filter(models.Job.status == JobStatus.RUNNING).all()


def start_job(db: Session, job_id: str):
    db_job = get_job(db, job_id)
    if db_job and db_job.status == JobStatus.PENDING:
        db_job.status = JobStatus.RUNNING
        db_job.started_at = datetime.utcnow()
        db_job.timeout_at = datetime.utcnow() + timedelta(minutes=db_job.estimated_duration)
        db.commit()
        db.refresh(db_job)
    return db_job


def complete_job(db: Session, job_id: str):
    db_job = get_job(db, job_id)
    if db_job and db_job.status == JobStatus.RUNNING:
        db_job.status = JobStatus.COMPLETED
        db_job.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(db_job)
    return db_job


def cancel_job(db: Session, job_id: str):
    db_job = get_job(db, job_id)
    if db_job and db_job.status in [JobStatus.PENDING, JobStatus.RUNNING]:
        db_job.status = JobStatus.CANCELLED
        db_job.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(db_job)
    return db_job


def check_timeout_jobs(db: Session):
    now = datetime.utcnow()
    timeout_jobs = db.query(models.Job).filter(
        models.Job.status == JobStatus.RUNNING,
        models.Job.timeout_at <= now
    ).all()
    for job in timeout_jobs:
        job.status = JobStatus.FAILED
        job.completed_at = now
    db.commit()
    return timeout_jobs


def create_release_event(db: Session, event: schemas.ReleaseEventCreate):
    db_event = models.ReleaseEvent(
        job_id=event.job_id,
        released_gpus=event.released_gpus,
        gpu_model=event.gpu_model,
        released_by=event.released_by,
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


def get_release_events(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ReleaseEvent).offset(skip).limit(limit).all()


def create_exception_record(db: Session, record: schemas.ExceptionRecordCreate):
    db_record = models.ExceptionRecord(
        original_input=record.original_input,
        handler=record.handler,
        conclusion=record.conclusion,
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


def get_gpu_resource(db: Session, gpu_model: str):
    return db.query(models.GPUResource).filter(models.GPUResource.gpu_model == gpu_model).first()


def create_gpu_resource(db: Session, resource: schemas.GPUResourceCreate):
    db_resource = models.GPUResource(
        gpu_model=resource.gpu_model,
        total=resource.total,
        available=resource.available,
    )
    db.add(db_resource)
    db.commit()
    db.refresh(db_resource)
    return db_resource


def update_gpu_available(db: Session, gpu_model: str, delta: int):
    db_resource = get_gpu_resource(db, gpu_model)
    if db_resource:
        db_resource.available += delta
        db_resource.last_updated = datetime.utcnow()
        db.commit()
        db.refresh(db_resource)
    return db_resource


def get_all_gpu_resources(db: Session):
    return db.query(models.GPUResource).all()