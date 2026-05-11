from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.errors import BusinessError
from app.schemas import PackageCreate, PackageResponse
from app.services.package_service import PackageService

router = APIRouter(prefix="/api/packages", tags=["体检套餐"])


@router.post("/", response_model=PackageResponse, summary="创建体检套餐")
def create_package(data: PackageCreate, db: Session = Depends(get_db)):
    try:
        service = PackageService(db)
        return service.create_package(data)
    except BusinessError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": e.error_code,
                "error_message": e.error_message,
                "error_type": e.error_type,
                "detail": e.detail,
            }
        )


@router.get("/{package_id}", response_model=PackageResponse, summary="获取套餐详情")
def get_package(package_id: int, db: Session = Depends(get_db)):
    try:
        service = PackageService(db)
        return service.get_package(package_id)
    except BusinessError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": e.error_code,
                "error_message": e.error_message,
                "error_type": e.error_type,
                "detail": e.detail,
            }
        )


@router.get("/", response_model=List[PackageResponse], summary="列出所有套餐")
def list_packages(db: Session = Depends(get_db)):
    service = PackageService(db)
    return service.list_packages()


@router.get("/{package_id}/projects/", summary="获取套餐包含的检查项目")
def get_package_projects(package_id: int, db: Session = Depends(get_db)):
    try:
        service = PackageService(db)
        projects = service.get_package_projects(package_id)
        return {
            "package_id": package_id,
            "projects": projects
        }
    except BusinessError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": e.error_code,
                "error_message": e.error_message,
                "error_type": e.error_type,
                "detail": e.detail,
            }
        )
