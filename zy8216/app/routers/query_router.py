from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import Animal, Cage, CageOccupancy, CageScan, HealthCheck, Anomaly
from app.schemas import (
    AnimalResponse, CageResponse, AnimalDetailResponse, 
    CageDetailResponse, CageScanResponse, HealthCheckResponse,
    AnomalyResponse
)

router = APIRouter(prefix="/query", tags=["数据查询"])


@router.get("/animals", response_model=List[AnimalResponse])
def get_animals(
    status: Optional[str] = None,
    species: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(Animal)
    
    if status:
        query = query.filter(Animal.status == status)
    if species:
        query = query.filter(Animal.species.ilike(f"%{species}%"))
    
    animals = query.offset(skip).limit(limit).all()
    return animals


@router.get("/animals/{animal_id}", response_model=AnimalDetailResponse)
def get_animal_detail(
    animal_id: str,
    db: Session = Depends(get_db)
):
    animal = db.query(Animal).filter(Animal.animal_id == animal_id).first()
    if not animal:
        raise HTTPException(status_code=404, detail=f"未找到动物 ID: {animal_id}")
    
    current_cage = None
    occupancy = db.query(CageOccupancy).filter(
        CageOccupancy.animal_id == animal.id,
        CageOccupancy.is_active == True
    ).first()
    
    if occupancy:
        cage_occupancy_count = db.query(CageOccupancy).filter(
            CageOccupancy.cage_id == occupancy.cage.id,
            CageOccupancy.is_active == True
        ).count()
        
        current_cage = CageResponse(
            id=occupancy.cage.id,
            cage_id=occupancy.cage.cage_id,
            location=occupancy.cage.location,
            max_capacity=occupancy.cage.max_capacity,
            is_quarantine=occupancy.cage.is_quarantine,
            notes=occupancy.cage.notes,
            current_occupancy=cage_occupancy_count,
            created_at=occupancy.cage.created_at,
            updated_at=occupancy.cage.updated_at
        )
    
    recent_scans = db.query(CageScan).filter(
        CageScan.animal_id == animal.id
    ).order_by(CageScan.scan_timestamp.desc()).limit(10).all()
    
    health_checks = db.query(HealthCheck).filter(
        HealthCheck.animal_id == animal.id
    ).order_by(HealthCheck.check_date.desc()).limit(10).all()
    
    return AnimalDetailResponse(
        id=animal.id,
        animal_id=animal.animal_id,
        tag_id=animal.tag_id,
        species=animal.species,
        strain=animal.strain,
        sex=animal.sex,
        date_of_birth=animal.date_of_birth,
        status=animal.status,
        quarantine_end_date=animal.quarantine_end_date,
        notes=animal.notes,
        created_at=animal.created_at,
        updated_at=animal.updated_at,
        current_cage=current_cage,
        recent_scans=recent_scans,
        health_checks=health_checks
    )


@router.get("/cages", response_model=List[CageResponse])
def get_cages(
    is_quarantine: Optional[bool] = None,
    location: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(Cage)
    
    if is_quarantine is not None:
        query = query.filter(Cage.is_quarantine == is_quarantine)
    if location:
        query = query.filter(Cage.location.ilike(f"%{location}%"))
    
    cages = query.offset(skip).limit(limit).all()
    
    result = []
    for cage in cages:
        occupancy_count = db.query(CageOccupancy).filter(
            CageOccupancy.cage_id == cage.id,
            CageOccupancy.is_active == True
        ).count()
        
        result.append(CageResponse(
            id=cage.id,
            cage_id=cage.cage_id,
            location=cage.location,
            max_capacity=cage.max_capacity,
            is_quarantine=cage.is_quarantine,
            notes=cage.notes,
            current_occupancy=occupancy_count,
            created_at=cage.created_at,
            updated_at=cage.updated_at
        ))
    
    return result


@router.get("/cages/{cage_id}", response_model=CageDetailResponse)
def get_cage_detail(
    cage_id: str,
    db: Session = Depends(get_db)
):
    cage = db.query(Cage).filter(Cage.cage_id == cage_id).first()
    if not cage:
        raise HTTPException(status_code=404, detail=f"未找到笼位 ID: {cage_id}")
    
    current_occupancies = db.query(CageOccupancy).filter(
        CageOccupancy.cage_id == cage.id,
        CageOccupancy.is_active == True
    ).all()
    
    current_animals = [occ.animal for occ in current_occupancies]
    
    recent_scans = db.query(CageScan).filter(
        CageScan.cage_id == cage.id
    ).order_by(CageScan.scan_timestamp.desc()).limit(20).all()
    
    return CageDetailResponse(
        id=cage.id,
        cage_id=cage.cage_id,
        location=cage.location,
        max_capacity=cage.max_capacity,
        is_quarantine=cage.is_quarantine,
        notes=cage.notes,
        current_occupancy=len(current_animals),
        created_at=cage.created_at,
        updated_at=cage.updated_at,
        current_animals=current_animals,
        recent_scans=recent_scans
    )


@router.get("/anomalies", response_model=List[AnomalyResponse])
def get_anomalies(
    anomaly_type: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(Anomaly)
    
    if anomaly_type:
        query = query.filter(Anomaly.anomaly_type == anomaly_type)
    if status:
        query = query.filter(Anomaly.status == status)
    
    anomalies = query.order_by(Anomaly.detected_at.desc()).offset(skip).limit(limit).all()
    return anomalies


@router.get("/anomalies/{anomaly_id}", response_model=AnomalyResponse)
def get_anomaly_detail(
    anomaly_id: int,
    db: Session = Depends(get_db)
):
    anomaly = db.query(Anomaly).filter(Anomaly.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail=f"未找到异常记录 ID: {anomaly_id}")
    return anomaly


@router.get("/scans", response_model=List[CageScanResponse])
def get_scans(
    tag_id: Optional[str] = None,
    cage_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(CageScan)
    
    if tag_id:
        query = query.filter(CageScan.tag_id == tag_id)
    if cage_id:
        cage = db.query(Cage).filter(Cage.cage_id == cage_id).first()
        if cage:
            query = query.filter(CageScan.cage_id == cage.id)
    if start_date:
        query = query.filter(CageScan.scan_timestamp >= start_date)
    if end_date:
        query = query.filter(CageScan.scan_timestamp <= end_date)
    
    scans = query.order_by(CageScan.scan_timestamp.desc()).offset(skip).limit(limit).all()
    return scans
