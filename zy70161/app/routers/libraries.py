from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from ..database import get_db
from ..models.models import TermLibrary, TermLibraryVersion
from ..schemas.schemas import (
    TermLibraryCreate,
    TermLibraryUpdate,
    TermLibraryResponse,
    TermLibraryVersionCreate,
    TermLibraryVersionResponse
)

router = APIRouter(prefix="/api/libraries", tags=["词库管理"])


@router.post("", response_model=TermLibraryResponse, summary="创建词库")
def create_library(data: TermLibraryCreate, db: Session = Depends(get_db)):
    existing = db.query(TermLibrary).filter(TermLibrary.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"词库名称已存在: {data.name}")
    
    library = TermLibrary(
        name=data.name,
        description=data.description,
        is_active=True,
        created_by=data.created_by
    )
    db.add(library)
    db.commit()
    db.refresh(library)
    return library


@router.get("", response_model=List[TermLibraryResponse], summary="获取词库列表")
def list_libraries(is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    query = db.query(TermLibrary)
    if is_active is not None:
        query = query.filter(TermLibrary.is_active == is_active)
    return query.order_by(TermLibrary.created_at.desc()).all()


@router.get("/{library_id}", response_model=TermLibraryResponse, summary="获取词库详情")
def get_library(library_id: int, db: Session = Depends(get_db)):
    library = db.query(TermLibrary).filter(TermLibrary.id == library_id).first()
    if not library:
        raise HTTPException(status_code=404, detail="词库不存在")
    return library


@router.put("/{library_id}", response_model=TermLibraryResponse, summary="更新词库")
def update_library(library_id: int, data: TermLibraryUpdate, db: Session = Depends(get_db)):
    library = db.query(TermLibrary).filter(TermLibrary.id == library_id).first()
    if not library:
        raise HTTPException(status_code=404, detail="词库不存在")
    
    update_data = data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(library, field, value)
    
    library.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(library)
    return library


@router.post("/versions", response_model=TermLibraryVersionResponse, summary="创建词库版本")
def create_version(data: TermLibraryVersionCreate, db: Session = Depends(get_db)):
    library = db.query(TermLibrary).filter(TermLibrary.id == data.library_id).first()
    if not library:
        raise HTTPException(status_code=404, detail="词库不存在")
    
    existing = (
        db.query(TermLibraryVersion)
        .filter(
            TermLibraryVersion.library_id == data.library_id,
            TermLibraryVersion.version == data.version
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail=f"版本号已存在: {data.version}")
    
    version = TermLibraryVersion(
        library_id=data.library_id,
        version=data.version,
        description=data.description,
        is_current=False,
        created_by=data.created_by
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


@router.get("/{library_id}/versions", response_model=List[TermLibraryVersionResponse], summary="获取词库版本列表")
def list_versions(library_id: int, db: Session = Depends(get_db)):
    return (
        db.query(TermLibraryVersion)
        .filter(TermLibraryVersion.library_id == library_id)
        .order_by(TermLibraryVersion.created_at.desc())
        .all()
    )


@router.post("/versions/{version_id}/deploy", response_model=TermLibraryVersionResponse, summary="部署词库版本")
def deploy_version(version_id: int, actor: str, db: Session = Depends(get_db)):
    version = db.query(TermLibraryVersion).filter(TermLibraryVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    db.query(TermLibraryVersion).filter(
        TermLibraryVersion.library_id == version.library_id,
        TermLibraryVersion.is_current == True
    ).update({"is_current": False})
    
    version.is_current = True
    version.deployed_at = datetime.utcnow()
    db.commit()
    db.refresh(version)
    return version
