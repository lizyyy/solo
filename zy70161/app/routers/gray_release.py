from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models.models import GrayEffectStatus
from ..schemas.schemas import (
    GrayReleaseCreate,
    GrayReleaseResponse,
    GrayEffectCheckCreate,
    GrayEffectCheckResponse
)
from ..services import GrayReleaseService

router = APIRouter(prefix="/api/gray-releases", tags=["灰度发布"])

gray_service = GrayReleaseService()


@router.post("", response_model=GrayReleaseResponse, summary="开始灰度发布")
def start_gray(data: GrayReleaseCreate, db: Session = Depends(get_db)):
    try:
        gray = gray_service.start_gray_release(db, data)
        db.commit()
        db.refresh(gray)
        return gray
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{gray_id}/stop", response_model=GrayReleaseResponse, summary="停止灰度发布（回滚）")
def stop_gray(gray_id: int, actor: str, reason: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        gray = gray_service.stop_gray_release(db, gray_id, actor, reason)
        db.commit()
        db.refresh(gray)
        return gray
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/effect-checks", response_model=GrayEffectCheckResponse, summary="添加效果回查")
def add_effect_check(data: GrayEffectCheckCreate, db: Session = Depends(get_db)):
    try:
        check = gray_service.add_effect_check(db, data)
        db.commit()
        db.refresh(check)
        return check
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{gray_id}/approve", response_model=GrayReleaseResponse, summary="灰度通过，全量发布")
def approve_gray(gray_id: int, actor: str, comment: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        gray = gray_service.approve_gray_release(db, gray_id, actor, comment)
        db.commit()
        db.refresh(gray)
        return gray
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{gray_id}/reject", response_model=GrayReleaseResponse, summary="灰度不通过")
def reject_gray(gray_id: int, actor: str, comment: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        gray = gray_service.reject_gray_release(db, gray_id, actor, comment)
        db.commit()
        db.refresh(gray)
        return gray
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[GrayReleaseResponse], summary="获取灰度发布列表")
def list_gray_releases(
    rule_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    effect_status: Optional[GrayEffectStatus] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    return gray_service.list_gray_releases(
        db=db,
        rule_id=rule_id,
        is_active=is_active,
        effect_status=effect_status,
        limit=limit,
        offset=offset
    )


@router.get("/{gray_id}", response_model=GrayReleaseResponse, summary="获取灰度发布详情")
def get_gray_release(gray_id: int, db: Session = Depends(get_db)):
    gray = gray_service.get_gray_release(db, gray_id)
    if not gray:
        raise HTTPException(status_code=404, detail="灰度发布不存在")
    return gray


@router.get("/{gray_id}/effect-checks", response_model=List[GrayEffectCheckResponse], summary="获取效果回查列表")
def list_effect_checks(gray_id: int, db: Session = Depends(get_db)):
    return gray_service.list_effect_checks(db, gray_id)


@router.get("/summary/active-count", summary="获取活跃灰度数量")
def get_active_count(db: Session = Depends(get_db)):
    return {
        "active_gray_releases": gray_service.get_active_gray_count(db),
        "message": "请注意监控灰度效果"
    }
