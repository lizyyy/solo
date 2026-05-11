from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.errors import BusinessError
from app.schemas import PatientCreate, PatientResponse
from app.services.patient_service import PatientService

router = APIRouter(prefix="/api/patients", tags=["患者信息"])


@router.post("/", response_model=PatientResponse, summary="创建患者信息")
def create_patient(data: PatientCreate, db: Session = Depends(get_db)):
    try:
        service = PatientService(db)
        return service.create_patient(data)
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


@router.get("/{patient_id}", response_model=PatientResponse, summary="获取患者详情")
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    try:
        service = PatientService(db)
        return service.get_patient(patient_id)
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


@router.get("/", response_model=List[PatientResponse], summary="列出所有患者")
def list_patients(db: Session = Depends(get_db)):
    service = PatientService(db)
    return service.list_patients()
