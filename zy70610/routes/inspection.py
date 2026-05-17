from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import InspectionItem, Inspection, Device
from schemas import (
    InspectionItemCreate, InspectionItemResponse,
    InspectionCreate, InspectionResponse
)
from exceptions import NotFoundException

router = APIRouter()


@router.post("/items", response_model=InspectionItemResponse)
def create_inspection_item(
    item: InspectionItemCreate,
    db: Session = Depends(get_db)
):
    db_item = InspectionItem(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


@router.get("/items", response_model=List[InspectionItemResponse])
def list_inspection_items(
    skip: int = 0,
    limit: int = 100,
    category: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(InspectionItem)
    if category:
        query = query.filter(InspectionItem.category == category)
    return query.offset(skip).limit(limit).all()


@router.post("/score", response_model=InspectionResponse)
def create_inspection(
    inspection: InspectionCreate,
    db: Session = Depends(get_db)
):
    device = db.query(Device).filter(Device.id == inspection.device_id).first()
    if not device:
        raise NotFoundException("设备", inspection.device_id)

    item = db.query(InspectionItem).filter(
        InspectionItem.id == inspection.item_id
    ).first()
    if not item:
        raise NotFoundException("检测项", inspection.item_id)

    if inspection.score > item.max_score:
        inspection.score = item.max_score
    if inspection.score < 0:
        inspection.score = 0

    db_inspection = Inspection(**inspection.dict())
    db.add(db_inspection)
    db.commit()
    db.refresh(db_inspection)

    response = InspectionResponse(
        id=db_inspection.id,
        device_id=db_inspection.device_id,
        item_id=db_inspection.item_id,
        item_name=item.name,
        score=db_inspection.score,
        max_score=item.max_score,
        inspector=db_inspection.inspector,
        notes=db_inspection.notes,
        created_at=db_inspection.created_at
    )
    return response


@router.get("/device/{device_id}", response_model=List[InspectionResponse])
def get_device_inspections(device_id: int, db: Session = Depends(get_db)):
    inspections = db.query(Inspection).filter(
        Inspection.device_id == device_id
    ).all()

    results = []
    for insp in inspections:
        item = db.query(InspectionItem).filter(
            InspectionItem.id == insp.item_id
        ).first()
        results.append(InspectionResponse(
            id=insp.id,
            device_id=insp.device_id,
            item_id=insp.item_id,
            item_name=item.name if item else "",
            score=insp.score,
            max_score=item.max_score if item else 10.0,
            inspector=insp.inspector,
            notes=insp.notes,
            created_at=insp.created_at
        ))
    return results


@router.get("/items/{item_id}", response_model=InspectionItemResponse)
def get_inspection_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(InspectionItem).filter(InspectionItem.id == item_id).first()
    if not item:
        raise NotFoundException("检测项", item_id)
    return item
