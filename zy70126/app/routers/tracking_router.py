from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.schemas import (
    TransportRecordCreate, TransportRecordUpdate, TransportRecord,
    EnvironmentLogCreate, EnvironmentLog,
    ReturnInspectionCreate, ReturnInspection
)
from app.services.tracking_service import transport_service, environment_service, inspection_service

router = APIRouter(prefix="/api/v1/tracking", tags=["运输与追踪"])


@router.post("/transport", response_model=TransportRecord)
def create_transport_record(
    data: TransportRecordCreate,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    try:
        return transport_service.create_transport_record(db, data.model_dump(), operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/transport/approval/{approval_id}", response_model=List[TransportRecord])
def get_transport_by_approval(approval_id: int, db: Session = Depends(get_db)):
    return transport_service.get_by_approval(db, approval_id)


@router.get("/transport/{transport_id}", response_model=TransportRecord)
def get_transport_record(transport_id: int, db: Session = Depends(get_db)):
    transport = transport_service.get(db, transport_id)
    if not transport:
        raise HTTPException(status_code=404, detail=f"运输记录 {transport_id} 不存在")
    return transport


@router.patch("/transport/{transport_id}", response_model=TransportRecord)
def update_transport_record(
    transport_id: int,
    data: TransportRecordUpdate,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    try:
        return transport_service.update_transport_record(db, transport_id, update_data, operator)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/environment", response_model=EnvironmentLog)
def create_environment_log(
    data: EnvironmentLogCreate,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    try:
        return environment_service.create_environment_log(db, data.model_dump(), operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/environment/approval/{approval_id}", response_model=List[EnvironmentLog])
def get_environment_by_approval(approval_id: int, db: Session = Depends(get_db)):
    return environment_service.get_by_approval(db, approval_id)


@router.get("/environment/transport/{transport_id}", response_model=List[EnvironmentLog])
def get_environment_by_transport(transport_id: int, db: Session = Depends(get_db)):
    return environment_service.get_by_transport(db, transport_id)


@router.get("/environment/{log_id}", response_model=EnvironmentLog)
def get_environment_log(log_id: int, db: Session = Depends(get_db)):
    log = environment_service.get(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail=f"环境记录 {log_id} 不存在")
    return log


@router.post("/inspection", response_model=ReturnInspection)
def create_inspection(
    data: ReturnInspectionCreate,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    try:
        return inspection_service.create_inspection(db, data.model_dump(), operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/inspection/approval/{approval_id}", response_model=ReturnInspection)
def get_inspection_by_approval(approval_id: int, db: Session = Depends(get_db)):
    inspection = inspection_service.get_by_approval(db, approval_id)
    if not inspection:
        raise HTTPException(status_code=404, detail=f"审批申请 {approval_id} 没有归还验收记录")
    return inspection


@router.get("/inspection/{inspection_id}", response_model=ReturnInspection)
def get_inspection(inspection_id: int, db: Session = Depends(get_db)):
    inspection = inspection_service.get(db, inspection_id)
    if not inspection:
        raise HTTPException(status_code=404, detail=f"验收记录 {inspection_id} 不存在")
    return inspection
