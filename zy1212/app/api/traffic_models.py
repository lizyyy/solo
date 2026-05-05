from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Project, TrafficModel
from app.schemas import (
    TrafficModel as TrafficModelSchema,
    TrafficModelCreate,
    TrafficModelUpdate,
    TrafficModelList,
)

router = APIRouter(prefix="/traffic-models", tags=["Traffic Models"])


@router.post("/", response_model=TrafficModelSchema, status_code=201)
def create_traffic_model(
    traffic_model: TrafficModelCreate,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == traffic_model.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    db_model = TrafficModel(
        project_id=traffic_model.project_id,
        name=traffic_model.name,
        description=traffic_model.description,
        model_type=traffic_model.model_type,
        virtual_users=traffic_model.virtual_users,
        ramp_up_seconds=traffic_model.ramp_up_seconds,
        duration_seconds=traffic_model.duration_seconds,
        think_time_min_ms=traffic_model.think_time_min_ms,
        think_time_max_ms=traffic_model.think_time_max_ms,
        distribution_pattern=traffic_model.distribution_pattern.value,
        interface_distribution=traffic_model.interface_distribution,
        is_active=traffic_model.is_active,
    )
    db.add(db_model)
    db.commit()
    db.refresh(db_model)
    return db_model


@router.get("/", response_model=TrafficModelList)
def list_traffic_models(
    project_id: Optional[int] = Query(None, ge=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    model_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    query = db.query(TrafficModel)
    
    if project_id:
        query = query.filter(TrafficModel.project_id == project_id)
    
    if model_type:
        query = query.filter(TrafficModel.model_type == model_type)
    
    if is_active is not None:
        query = query.filter(TrafficModel.is_active == is_active)
    
    total = query.count()
    traffic_models = query.offset(skip).limit(limit).all()
    
    return TrafficModelList(
        total=total,
        items=traffic_models,
        page=skip // limit + 1,
        page_size=limit,
    )


@router.get("/{traffic_model_id}", response_model=TrafficModelSchema)
def get_traffic_model(traffic_model_id: int, db: Session = Depends(get_db)):
    traffic_model = db.query(TrafficModel).filter(
        TrafficModel.id == traffic_model_id
    ).first()
    if not traffic_model:
        raise HTTPException(status_code=404, detail="流量模型不存在")
    return traffic_model


@router.put("/{traffic_model_id}", response_model=TrafficModelSchema)
def update_traffic_model(
    traffic_model_id: int,
    traffic_model_update: TrafficModelUpdate,
    db: Session = Depends(get_db),
):
    traffic_model = db.query(TrafficModel).filter(
        TrafficModel.id == traffic_model_id
    ).first()
    if not traffic_model:
        raise HTTPException(status_code=404, detail="流量模型不存在")
    
    update_data = traffic_model_update.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        if hasattr(traffic_model, key):
            if key == 'distribution_pattern' and value:
                setattr(traffic_model, key, value.value)
            else:
                setattr(traffic_model, key, value)
    
    db.commit()
    db.refresh(traffic_model)
    return traffic_model


@router.delete("/{traffic_model_id}", status_code=204)
def delete_traffic_model(traffic_model_id: int, db: Session = Depends(get_db)):
    traffic_model = db.query(TrafficModel).filter(
        TrafficModel.id == traffic_model_id
    ).first()
    if not traffic_model:
        raise HTTPException(status_code=404, detail="流量模型不存在")
    
    db.delete(traffic_model)
    db.commit()
