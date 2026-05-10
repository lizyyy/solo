from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import GPUCreate, GPUOut, MessageOut
from app.models import GPU, GPUStatus
from app.core.scheduler import MainScheduler

router = APIRouter(prefix="/gpus", tags=["GPUs"])


@router.post("/register", response_model=GPUOut)
def register_gpu(gpu_data: GPUCreate, db: Session = Depends(get_db)):
    scheduler = MainScheduler(db)
    gpu = scheduler.gpu_manager.register_gpu(
        gpu_id=gpu_data.gpu_id,
        name=gpu_data.name,
        model=gpu_data.model,
        memory_gb=gpu_data.memory_gb
    )
    return gpu


@router.get("/", response_model=List[GPUOut])
def list_gpus(status_filter: str = None, db: Session = Depends(get_db)):
    query = db.query(GPU)
    if status_filter:
        query = query.filter(GPU.status == status_filter)
    return query.order_by(GPU.id.asc()).all()


@router.get("/{gpu_id}", response_model=GPUOut)
def get_gpu(gpu_id: str, db: Session = Depends(get_db)):
    gpu = db.query(GPU).filter(GPU.gpu_id == gpu_id).first()
    if not gpu:
        raise HTTPException(status_code=404, detail=f"GPU {gpu_id} not found")
    return gpu


@router.post("/{gpu_id}/maintenance", response_model=MessageOut)
def set_maintenance(gpu_id: str, maintenance: bool = True, db: Session = Depends(get_db)):
    gpu = db.query(GPU).filter(GPU.gpu_id == gpu_id).first()
    if not gpu:
        raise HTTPException(status_code=404, detail=f"GPU {gpu_id} not found")
    
    scheduler = MainScheduler(db)
    success = scheduler.gpu_manager.set_gpu_maintenance(gpu, maintenance)
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot set GPU {gpu_id} to maintenance: GPU is occupied"
        )
    
    return MessageOut(
        success=True,
        message=f"GPU {gpu_id} {'entered' if maintenance else 'exited'} maintenance mode"
    )


@router.get("/available", response_model=List[GPUOut])
def list_available_gpus(db: Session = Depends(get_db)):
    scheduler = MainScheduler(db)
    return scheduler.gpu_manager.get_available_gpus()
