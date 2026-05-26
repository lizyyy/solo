from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ProcessingDetail, RawMaterial, Trajectory
from app.schemas import ReviewRequest, DetailWithTrajectories, DetailResponse
from app.services import apply_review, list_audit_logs, trace_key_fields

router = APIRouter(prefix="/api/details", tags=["明细处理与轨迹"])


@router.post("/{detail_id}/review")
def review_detail(detail_id: int, req: ReviewRequest, db: Session = Depends(get_db)):
    try:
        detail = apply_review(db, detail_id, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return DetailResponse.model_validate(detail)


@router.get("/{detail_id}/trajectory")
def get_trajectory(detail_id: int, db: Session = Depends(get_db)):
    detail = db.query(ProcessingDetail).filter(ProcessingDetail.id == detail_id).first()
    if not detail:
        raise HTTPException(status_code=404, detail="明细不存在")
    material = db.query(RawMaterial).filter(RawMaterial.id == detail.raw_material_id).first()
    trajectories = db.query(Trajectory).filter(Trajectory.detail_id == detail_id).order_by(Trajectory.created_at.asc()).all()
    audits = list_audit_logs(db, detail_id)
    return DetailWithTrajectories(
        detail=DetailResponse.model_validate(detail),
        material=material,
        trajectories=trajectories,
        audit_logs=audits,
    )


@router.get("/{detail_id}/trace")
def get_field_trace(detail_id: int, db: Session = Depends(get_db)):
    detail = db.query(ProcessingDetail).filter(ProcessingDetail.id == detail_id).first()
    if not detail:
        raise HTTPException(status_code=404, detail="明细不存在")
    return trace_key_fields(db, detail_id)


@router.post("/{detail_id}/rerun")
def rerun_classification(detail_id: int, db: Session = Depends(get_db)):
    detail = db.query(ProcessingDetail).filter(ProcessingDetail.id == detail_id).first()
    if not detail:
        raise HTTPException(status_code=404, detail="明细不存在")
    from app.classifier import classify_material
    material = db.query(RawMaterial).filter(RawMaterial.id == detail.raw_material_id).first()
    old_category = detail.category
    old_reason = detail.reason_code
    db.delete(detail)
    db.flush()
    new_detail = classify_material(db, detail.batch_id, material)
    db.commit()
    db.refresh(new_detail)
    return {
        "old": {"category": old_category, "reason_code": old_reason},
        "new": {
            "id": new_detail.id,
            "category": new_detail.category,
            "reason_code": new_detail.reason_code,
            "next_action": new_detail.next_action,
        },
    }


@router.get("/{detail_id}/audit")
def get_audit_logs(detail_id: int, db: Session = Depends(get_db)):
    detail = db.query(ProcessingDetail).filter(ProcessingDetail.id == detail_id).first()
    if not detail:
        raise HTTPException(status_code=404, detail="明细不存在")
    return list_audit_logs(db, detail_id)
