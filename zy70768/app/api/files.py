from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.services import SourceFileService, ImportPathService
from app.schemas import SourceFile, SourceFileCreate, ImportPath, ImportPathCreate

router = APIRouter(tags=["files"])


@router.post("/source-files/", response_model=SourceFile)
def create_source_file(file: SourceFileCreate, db: Session = Depends(get_db)):
    return SourceFileService.create_source_file(db=db, file=file)


@router.get("/source-files/", response_model=List[SourceFile])
def list_source_files(
    package_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return SourceFileService.list_source_files(db=db, package_id=package_id, skip=skip, limit=limit)


@router.get("/source-files/{file_id}", response_model=SourceFile)
def get_source_file(file_id: int, db: Session = Depends(get_db)):
    file = SourceFileService.get_source_file(db=db, file_id=file_id)
    if not file:
        raise HTTPException(status_code=404, detail="Source file not found")
    return file


@router.post("/imports/", response_model=ImportPath)
def create_import_path(import_path: ImportPathCreate, db: Session = Depends(get_db)):
    return ImportPathService.create_import_path(db=db, import_path=import_path)


@router.get("/imports/", response_model=List[ImportPath])
def list_import_paths(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return ImportPathService.list_import_paths(db=db, skip=skip, limit=limit)
