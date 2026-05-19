from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from ..core.database import get_db
from .. import schemas, services

router = APIRouter()


@router.get("/statistics", response_model=schemas.StatisticsResponse)
def get_statistics(db: Session = Depends(get_db)):
    return services.get_statistics(db)


@router.get("/feature-flags", response_model=List[schemas.FeatureFlag])
def list_feature_flags(skip: int = 0, limit: int = 100, status: str = None, db: Session = Depends(get_db)):
    return services.get_feature_flags(db, skip=skip, limit=limit, status=status)


@router.post("/feature-flags", response_model=schemas.FeatureFlag, status_code=201)
def create_feature_flag(flag: schemas.FeatureFlagCreate, db: Session = Depends(get_db)):
    existing = services.get_feature_flag_by_key(db, flag.key)
    if existing:
        raise HTTPException(status_code=400, detail="Feature flag with this key already exists")
    return services.create_feature_flag(db, flag)


@router.get("/feature-flags/{flag_id}", response_model=schemas.FeatureFlagDetail)
def get_feature_flag(flag_id: int, db: Session = Depends(get_db)):
    flag = services.get_feature_flag(db, flag_id)
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    
    hit_count = len(services.get_hit_records(db, flag_id=flag_id, limit=1000))
    read_count = len(services.get_read_audits(db, flag_id=flag_id, limit=1000))
    change_order_count = len(services.get_change_orders(db, flag_id=flag_id, limit=1000))
    
    return schemas.FeatureFlagDetail(
        id=flag.id,
        name=flag.name,
        key=flag.key,
        description=flag.description,
        enabled=flag.enabled,
        status=flag.status,
        created_at=flag.created_at,
        updated_at=flag.updated_at,
        created_by=flag.created_by,
        current_version=flag.current_version,
        gray_rules=flag.gray_rules,
        hit_count=hit_count,
        read_count=read_count,
        change_order_count=change_order_count
    )


@router.put("/feature-flags/{flag_id}", response_model=schemas.FeatureFlag)
def update_feature_flag(flag_id: int, flag_update: schemas.FeatureFlagUpdate, db: Session = Depends(get_db)):
    updated = services.update_feature_flag(db, flag_id, flag_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    return updated


@router.delete("/feature-flags/{flag_id}", status_code=204)
def delete_feature_flag(flag_id: int, db: Session = Depends(get_db)):
    success = services.delete_feature_flag(db, flag_id)
    if not success:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    return None


@router.post("/feature-flags/evaluate/{key}", response_model=schemas.FeatureFlagEvaluateResponse)
def evaluate_feature_flag(key: str, request: schemas.FeatureFlagEvaluateRequest, db: Session = Depends(get_db)):
    return services.evaluate_feature_flag(
        db, key, user_id=request.user_id, user_group=request.user_group,
        region=request.region, source=request.source, source_id=request.source_id,
        properties=request.properties
    )


@router.get("/feature-flags/{flag_id}/hit-records", response_model=List[schemas.HitRecord])
def get_hit_records(flag_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_hit_records(db, flag_id=flag_id, skip=skip, limit=limit)


@router.get("/feature-flags/{flag_id}/read-audits", response_model=List[schemas.ReadAudit])
def get_read_audits(flag_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_read_audits(db, flag_id=flag_id, skip=skip, limit=limit)


@router.get("/feature-flags/{flag_id}/rollback-versions", response_model=List[schemas.RollbackVersion])
def get_rollback_versions(flag_id: int, db: Session = Depends(get_db)):
    return services.get_rollback_versions(db, flag_id)


@router.post("/feature-flags/{flag_id}/rollback", response_model=schemas.FeatureFlag)
def rollback_feature_flag(flag_id: int, rollback_req: schemas.RollbackRequest, db: Session = Depends(get_db)):
    result = services.rollback_to_version(db, flag_id, rollback_req.version_id, rollback_req.reason)
    if not result:
        raise HTTPException(status_code=404, detail="Rollback failed - version or flag not found")
    return result


@router.get("/change-orders", response_model=List[schemas.ChangeOrder])
def list_change_orders(skip: int = 0, limit: int = 100, status: str = None, flag_id: int = None, db: Session = Depends(get_db)):
    return services.get_change_orders(db, skip=skip, limit=limit, status=status, flag_id=flag_id)


@router.post("/change-orders", response_model=schemas.ChangeOrder, status_code=201)
def create_change_order(order: schemas.ChangeOrderCreate, db: Session = Depends(get_db)):
    return services.create_change_order(db, order)


@router.post("/change-orders/{order_id}/approve", response_model=schemas.ChangeOrder)
def approve_change_order(order_id: int, action: schemas.ApprovalAction, db: Session = Depends(get_db)):
    result = services.approve_change_order(db, order_id, action.approved, comment=action.comment)
    if not result:
        raise HTTPException(status_code=404, detail="Change order not found or not in pending state")
    return result


@router.get("/read-sources", response_model=List[schemas.ReadSource])
def list_read_sources(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_read_sources(db, skip=skip, limit=limit)


@router.post("/read-sources", response_model=schemas.ReadSource, status_code=201)
def create_read_source(source: schemas.ReadSourceCreate, db: Session = Depends(get_db)):
    return services.create_read_source(db, source)


@router.get("/hit-records", response_model=List[schemas.HitRecord])
def list_hit_records(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_hit_records(db, skip=skip, limit=limit)


@router.get("/read-audits", response_model=List[schemas.ReadAudit])
def list_read_audits(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_read_audits(db, skip=skip, limit=limit)


@router.post("/export")
def export_data(export_req: schemas.ExportRequest, db: Session = Depends(get_db)):
    data = services.export_data(db, export_req.export_type, export_req.filters)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{export_req.export_type}_{timestamp}.json"
    return Response(
        content=data,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
