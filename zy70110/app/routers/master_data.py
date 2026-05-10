from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ColdStorageBay, InspectionWindow, StorageStatus
from app.schemas import (
    ColdStorageBayCreate, ColdStorageBayResponse,
    InspectionWindowCreate, InspectionWindowResponse
)

router = APIRouter(prefix="/master", tags=["基础数据"])


@router.post("/storage-bays", response_model=ColdStorageBayResponse)
def create_storage_bay(
    bay_data: ColdStorageBayCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(ColdStorageBay).filter(
        ColdStorageBay.bay_code == bay_data.bay_code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="仓位编码已存在")
    
    bay = ColdStorageBay(**bay_data.model_dump())
    db.add(bay)
    db.commit()
    db.refresh(bay)
    return bay


@router.get("/storage-bays", response_model=List[ColdStorageBayResponse])
def list_storage_bays(
    status: StorageStatus = None,
    db: Session = Depends(get_db)
):
    query = db.query(ColdStorageBay)
    if status:
        query = query.filter(ColdStorageBay.status == status)
    return query.order_by(ColdStorageBay.bay_code).all()


@router.get("/storage-bays/{bay_id}", response_model=ColdStorageBayResponse)
def get_storage_bay(bay_id: int, db: Session = Depends(get_db)):
    bay = db.query(ColdStorageBay).filter(ColdStorageBay.id == bay_id).first()
    if not bay:
        raise HTTPException(status_code=404, detail="仓位不存在")
    return bay


@router.put("/storage-bays/{bay_id}", response_model=ColdStorageBayResponse)
def update_storage_bay(
    bay_id: int,
    bay_data: ColdStorageBayCreate,
    db: Session = Depends(get_db)
):
    bay = db.query(ColdStorageBay).filter(ColdStorageBay.id == bay_id).first()
    if not bay:
        raise HTTPException(status_code=404, detail="仓位不存在")
    
    for key, value in bay_data.model_dump().items():
        setattr(bay, key, value)
    
    db.commit()
    db.refresh(bay)
    return bay


@router.post("/inspection-windows", response_model=InspectionWindowResponse)
def create_inspection_window(
    window_data: InspectionWindowCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(InspectionWindow).filter(
        InspectionWindow.window_code == window_data.window_code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="检测窗口编码已存在")
    
    window = InspectionWindow(**window_data.model_dump())
    db.add(window)
    db.commit()
    db.refresh(window)
    return window


@router.get("/inspection-windows", response_model=List[InspectionWindowResponse])
def list_inspection_windows(
    is_active: bool = None,
    db: Session = Depends(get_db)
):
    query = db.query(InspectionWindow)
    if is_active is not None:
        query = query.filter(InspectionWindow.is_active == is_active)
    return query.order_by(InspectionWindow.window_code).all()


@router.get("/inspection-windows/{window_id}", response_model=InspectionWindowResponse)
def get_inspection_window(window_id: int, db: Session = Depends(get_db)):
    window = db.query(InspectionWindow).filter(InspectionWindow.id == window_id).first()
    if not window:
        raise HTTPException(status_code=404, detail="检测窗口不存在")
    return window


@router.put("/inspection-windows/{window_id}", response_model=InspectionWindowResponse)
def update_inspection_window(
    window_id: int,
    window_data: InspectionWindowCreate,
    db: Session = Depends(get_db)
):
    window = db.query(InspectionWindow).filter(InspectionWindow.id == window_id).first()
    if not window:
        raise HTTPException(status_code=404, detail="检测窗口不存在")
    
    for key, value in window_data.model_dump().items():
        setattr(window, key, value)
    
    db.commit()
    db.refresh(window)
    return window
