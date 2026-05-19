from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.services import PackageService
from app.schemas import Package, PackageCreate, PackageUpdate

router = APIRouter(prefix="/packages", tags=["packages"])


@router.post("/", response_model=Package)
def create_package(pkg: PackageCreate, db: Session = Depends(get_db)):
    existing = PackageService.get_package_by_name(db, name=pkg.name)
    if existing:
        raise HTTPException(status_code=400, detail="Package already exists")
    return PackageService.create_package(db=db, pkg=pkg)


@router.get("/", response_model=List[Package])
def list_packages(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return PackageService.list_packages(db=db, skip=skip, limit=limit)


@router.get("/{package_id}", response_model=Package)
def get_package(package_id: int, db: Session = Depends(get_db)):
    pkg = PackageService.get_package(db=db, package_id=package_id)
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    return pkg


@router.get("/name/{name}", response_model=Package)
def get_package_by_name(name: str, db: Session = Depends(get_db)):
    pkg = PackageService.get_package_by_name(db=db, name=name)
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    return pkg
