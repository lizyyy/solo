from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import models, schemas, services

router = APIRouter(prefix="/api/mappings", tags=["mappings"])


@router.get("/", response_model=List[schemas.ProductMapping])
def list_mappings(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    mappings = db.query(models.ProductMapping).offset(skip).limit(limit).all()
    return mappings


@router.get("/{mapping_id}", response_model=schemas.ProductMapping)
def get_mapping(mapping_id: int, db: Session = Depends(get_db)):
    mapping = db.query(models.ProductMapping).filter(models.ProductMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return mapping


@router.get("/{mapping_id}/timeline", response_model=List[schemas.MappingTimeline])
def get_mapping_timeline(mapping_id: int, db: Session = Depends(get_db)):
    timeline = db.query(models.MappingTimeline).filter(
        models.MappingTimeline.mapping_id == mapping_id
    ).order_by(models.MappingTimeline.created_at.desc()).all()
    return timeline


@router.post("/", response_model=schemas.ProductMapping)
def create_mapping(mapping: schemas.ProductMappingCreate, db: Session = Depends(get_db)):
    db_mapping = models.ProductMapping(**mapping.dict())
    db.add(db_mapping)
    db.commit()
    db.refresh(db_mapping)
    
    services.add_mapping_timeline(
        db, db_mapping.id, "created",
        {"mapping_data": mapping.dict()},
        "system"
    )
    
    return db_mapping


@router.put("/{mapping_id}", response_model=schemas.ProductMapping)
def update_mapping(mapping_id: int, mapping: schemas.ProductMappingCreate, db: Session = Depends(get_db)):
    db_mapping = db.query(models.ProductMapping).filter(models.ProductMapping.id == mapping_id).first()
    if not db_mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    old_data = {col.name: getattr(db_mapping, col.name) for col in db_mapping.__table__.columns}
    
    for key, value in mapping.dict().items():
        setattr(db_mapping, key, value)
    
    db.commit()
    db.refresh(db_mapping)
    
    services.add_mapping_timeline(
        db, mapping_id, "updated",
        {"old_data": old_data, "new_data": mapping.dict()},
        "system"
    )
    
    return db_mapping


@router.get("/rules/", response_model=List[schemas.MappingRule])
def list_mapping_rules(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    rules = db.query(models.MappingRule).filter(
        models.MappingRule.is_active == True
    ).offset(skip).limit(limit).all()
    return rules


@router.post("/rules/", response_model=schemas.MappingRule)
def create_mapping_rule(rule: schemas.MappingRuleCreate, db: Session = Depends(get_db)):
    db_rule = models.MappingRule(**rule.dict(), version=1)
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule
