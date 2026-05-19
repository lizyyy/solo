from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..core.database import get_db
from ..models import JobPosition
from ..schemas import JobPositionCreate, JobPositionUpdate, JobPositionResponse

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.post("/", response_model=JobPositionResponse)
def create_job(job_data: JobPositionCreate, db: Session = Depends(get_db)):
    job = JobPosition(**job_data.dict())
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/", response_model=List[JobPositionResponse])
def list_jobs(
    is_active: bool = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(JobPosition)
    
    if is_active is not None:
        query = query.filter(JobPosition.is_active == is_active)
    
    return query.order_by(JobPosition.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{job_id}", response_model=JobPositionResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(JobPosition).filter(JobPosition.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="岗位不存在")
    return job


@router.put("/{job_id}", response_model=JobPositionResponse)
def update_job(job_id: int, job_data: JobPositionUpdate, db: Session = Depends(get_db)):
    job = db.query(JobPosition).filter(JobPosition.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="岗位不存在")
    
    update_dict = job_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(job, key, value)
    
    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(JobPosition).filter(JobPosition.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="岗位不存在")
    
    job.is_active = False
    db.commit()
    return {"message": "岗位已删除"}
