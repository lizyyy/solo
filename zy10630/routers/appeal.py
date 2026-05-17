from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Appeal, AppealHistory, AppealStatus, AppealSource
from schemas import (
    AppealCreate,
    AppealUpdate,
    AppealResponse,
    AppealDetailResponse,
    AppealHistoryResponse,
    AppealListResponse,
)
from datetime import datetime

router = APIRouter()


@router.post("", response_model=AppealResponse, status_code=201)
def create_appeal(appeal_data: AppealCreate, db: Session = Depends(get_db)):
    db_appeal = Appeal(
        image_url=appeal_data.image_url,
        image_hash=appeal_data.image_hash,
        review_tags=appeal_data.review_tags,
        model_version=appeal_data.model_version,
        appeal_material=appeal_data.appeal_material,
        status=AppealStatus.BANNED,
        source=appeal_data.source,
        operator=appeal_data.operator,
    )
    db.add(db_appeal)
    db.flush()

    history = AppealHistory(
        appeal_id=db_appeal.id,
        old_status=None,
        new_status=AppealStatus.BANNED,
        source=appeal_data.source,
        operator=appeal_data.operator,
        remark="创建申诉记录，初始状态：已封禁",
    )
    db.add(history)
    db.commit()
    db.refresh(db_appeal)
    return db_appeal


@router.get("", response_model=AppealListResponse)
def list_appeals(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[AppealStatus] = None,
    image_hash: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Appeal)
    
    if status:
        query = query.filter(Appeal.status == status)
    if image_hash:
        query = query.filter(Appeal.image_hash == image_hash)
    
    total = query.count()
    appeals = query.order_by(Appeal.created_at.desc()).offset(skip).limit(limit).all()
    
    return AppealListResponse(total=total, items=appeals)


@router.get("/{appeal_id}", response_model=AppealDetailResponse)
def get_appeal_detail(appeal_id: int, db: Session = Depends(get_db)):
    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="申诉记录不存在")
    
    history = db.query(AppealHistory).filter(AppealHistory.appeal_id == appeal_id).order_by(AppealHistory.created_at.desc()).all()
    
    return {
        **appeal.__dict__,
        "history": history
    }


@router.get("/{appeal_id}/history", response_model=List[AppealHistoryResponse])
def get_appeal_history(appeal_id: int, db: Session = Depends(get_db)):
    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="申诉记录不存在")
    
    history = db.query(AppealHistory).filter(AppealHistory.appeal_id == appeal_id).order_by(AppealHistory.created_at.desc()).all()
    return history


@router.put("/{appeal_id}/status", response_model=AppealResponse)
def update_appeal_status(appeal_id: int, update_data: AppealUpdate, db: Session = Depends(get_db)):
    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="申诉记录不存在")
    
    old_status = appeal.status
    
    if old_status == update_data.status:
        raise HTTPException(status_code=400, detail="状态未发生变化")
    
    appeal.status = update_data.status
    appeal.operator = update_data.operator
    appeal.updated_at = datetime.utcnow()
    
    history = AppealHistory(
        appeal_id=appeal_id,
        old_status=old_status,
        new_status=update_data.status,
        source=update_data.source,
        operator=update_data.operator,
        remark=update_data.remark or f"状态变更：{old_status.value} → {update_data.status.value}",
    )
    db.add(history)
    db.commit()
    db.refresh(appeal)
    return appeal


@router.delete("/{appeal_id}", status_code=204)
def delete_appeal(appeal_id: int, db: Session = Depends(get_db)):
    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="申诉记录不存在")
    db.delete(appeal)
    db.commit()
