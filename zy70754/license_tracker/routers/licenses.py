from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db, License as DBLicense
from ..schemas import License, LicenseCreate

router = APIRouter()


@router.post("/", response_model=License)
async def create_license(license_data: LicenseCreate, db: Session = Depends(get_db)):
    existing = db.query(DBLicense).filter(DBLicense.name == license_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="License already exists")

    db_license = DBLicense(**license_data.dict())
    db.add(db_license)
    db.commit()
    db.refresh(db_license)
    return db_license


@router.get("/", response_model=List[License])
async def list_licenses(
    is_approved: bool = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(DBLicense)
    if is_approved is not None:
        query = query.filter(DBLicense.is_approved == is_approved)
    return query.offset(skip).limit(limit).all()


@router.get("/{license_id}", response_model=License)
async def get_license(license_id: int, db: Session = Depends(get_db)):
    lic = db.query(DBLicense).filter(DBLicense.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="License not found")
    return lic


@router.put("/{license_id}", response_model=License)
async def update_license(license_id: int, license_data: LicenseCreate, db: Session = Depends(get_db)):
    lic = db.query(DBLicense).filter(DBLicense.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="License not found")

    for field, value in license_data.dict().items():
        setattr(lic, field, value)

    db.commit()
    db.refresh(lic)
    return lic


@router.delete("/{license_id}")
async def delete_license(license_id: int, db: Session = Depends(get_db)):
    lic = db.query(DBLicense).filter(DBLicense.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="License not found")
    db.delete(lic)
    db.commit()
    return {"success": True}
