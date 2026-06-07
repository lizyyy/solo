from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import models, schemas
from ..services import appeal_service

router = APIRouter(prefix="/versions", tags=["versions"])


@router.get("/", response_model=List[schemas.ModelVersion])
def list_versions(db: Session = Depends(get_db)):
    return db.query(models.ModelVersion).order_by(models.ModelVersion.created_at.desc()).all()


@router.post("/", response_model=schemas.ModelVersion)
def create_version(data: schemas.ModelVersionCreate, db: Session = Depends(get_db)):
    existing = db.query(models.ModelVersion).filter(
        models.ModelVersion.version_name == data.version_name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="版本名称已存在")

    version = models.ModelVersion(
        version_name=data.version_name,
        description=data.description
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


@router.get("/{version_id}", response_model=schemas.ModelVersion)
def get_version(version_id: int, db: Session = Depends(get_db)):
    version = db.query(models.ModelVersion).filter(models.ModelVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    return version


@router.get("/compare/{v1_id}/{v2_id}", response_model=schemas.VersionCompareResult)
def compare_versions(v1_id: int, v2_id: int, db: Session = Depends(get_db)):
    return appeal_service.compare_versions(db, v1_id, v2_id)
