from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app import schemas, models, services
from app.database import get_db

router = APIRouter()


@router.post("", response_model=schemas.Dataset, status_code=status.HTTP_201_CREATED)
def create_dataset(dataset: schemas.DatasetCreate, db: Session = Depends(get_db)):
    existing = services.get_dataset_by_name(db, name=dataset.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=schemas.ErrorResponse(
                error_code="DATASET_EXISTS",
                message=f"数据集名称 '{dataset.name}' 已存在",
                timestamp=datetime.now(timezone.utc)
            ).model_dump()
        )
    
    return services.create_dataset(db=db, dataset=dataset)


@router.get("", response_model=List[schemas.Dataset])
def list_datasets(skip: int = 0, limit: int = 100, is_active: bool = None, db: Session = Depends(get_db)):
    query = db.query(models.Dataset)
    if is_active is not None:
        query = query.filter(models.Dataset.is_active == is_active)
    datasets = query.order_by(models.Dataset.created_at.desc()).offset(skip).limit(limit).all()
    return datasets


@router.get("/{dataset_id}", response_model=schemas.Dataset)
def get_dataset(dataset_id: str, db: Session = Depends(get_db)):
    dataset = services.get_dataset(db, dataset_id=dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=schemas.ErrorResponse(
                error_code="DATASET_NOT_FOUND",
                message=f"数据集 '{dataset_id}' 不存在",
                timestamp=datetime.now(timezone.utc)
            ).model_dump()
        )
    return dataset


@router.patch("/{dataset_id}", response_model=schemas.Dataset)
def update_dataset(dataset_id: str, dataset_update: schemas.DatasetUpdate, db: Session = Depends(get_db)):
    dataset = services.get_dataset(db, dataset_id=dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=schemas.ErrorResponse(
                error_code="DATASET_NOT_FOUND",
                message=f"数据集 '{dataset_id}' 不存在",
                timestamp=datetime.now(timezone.utc)
            ).model_dump()
        )
    
    updated = services.update_dataset(db, dataset_id=dataset_id, dataset_update=dataset_update)
    return updated
