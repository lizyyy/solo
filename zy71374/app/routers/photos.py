from __future__ import annotations
from fastapi import APIRouter, Depends, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.services import photo_service

router = APIRouter(prefix="/photos", tags=["photos"])


class PhotoOut(BaseModel):
    id: int
    experiment_id: int
    file_path: str
    label: Optional[str] = None
    photo_type: Optional[str] = None
    color_hex: Optional[str] = None
    source: str

    class Config:
        from_attributes = True


class PhotoReassign(BaseModel):
    new_experiment_id: int


@router.post("/upload", response_model=PhotoOut)
def upload_photo(
    experiment_id: int = Form(...),
    file: UploadFile = File(...),
    label: Optional[str] = Form(None),
    photo_type: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    file_bytes = file.file.read()
    return photo_service.upload_photo(db, experiment_id, file_bytes, file.filename, label, photo_type)


@router.get("/experiment/{experiment_id}", response_model=list[PhotoOut])
def list_photos(experiment_id: int, db: Session = Depends(get_db)):
    return photo_service.list_photos(db, experiment_id)


@router.patch("/{photo_id}/reassign", response_model=PhotoOut)
def reassign_photo(photo_id: int, body: PhotoReassign, db: Session = Depends(get_db)):
    return photo_service.reassign_photo(db, photo_id, body.new_experiment_id)
