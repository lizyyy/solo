from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import ApplicationRecord, ApplicationStatus, LotteryPool, ObjectionRecord
from ..schemas import (
    LotteryPoolCreate, LotteryPoolResponse,
    ObjectionRecordCreate, ObjectionRecordResponse
)
from ..services.lottery_service import LotteryService

router = APIRouter(prefix="/api/lottery", tags=["摇号管理"])


@router.post("/pools", response_model=LotteryPoolResponse)
def create_lottery_pool(data: LotteryPoolCreate, db: Session = Depends(get_db)):
    try:
        pool = LotteryService.create_lottery_pool(
            db,
            pool_id=data.pool_id,
            pool_name=data.pool_name,
            lottery_year=data.lottery_year,
            lottery_batch=data.lottery_batch,
            total_quota=data.total_quota,
            announcement_date=data.announcement_date
        )
        return pool
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/pools", response_model=List[LotteryPoolResponse])
def list_lottery_pools(
    active_only: bool = Query(True, description="仅显示活跃摇号池"),
    db: Session = Depends(get_db)
):
    query = db.query(LotteryPool)
    if active_only:
        query = query.filter(LotteryPool.is_active == True)
    return query.order_by(LotteryPool.created_at.desc()).all()


@router.post("/pools/{pool_id}/lock/{application_id}")
def lock_application_to_pool(
    pool_id: str,
    application_id: int,
    operator: Optional[str] = Query(None, description="操作人"),
    db: Session = Depends(get_db)
):
    application = db.query(ApplicationRecord).filter(
        ApplicationRecord.id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="申请记录不存在")

    success, message = LotteryService.lock_for_lottery(db, application, pool_id, operator)
    if not success:
        raise HTTPException(status_code=400, detail=message)

    db.refresh(application)
    return {
        "success": True,
        "message": message,
        "application_id": application_id,
        "pool_id": pool_id,
        "current_status": application.current_status
    }


@router.post("/pools/{pool_id}/announce")
def start_public_announcement(
    pool_id: str,
    operator: Optional[str] = Query(None, description="操作人"),
    db: Session = Depends(get_db)
):
    success, message = LotteryService.start_public_announcement(db, pool_id, operator)
    if not success:
        raise HTTPException(status_code=400, detail=message)

    return {"success": True, "message": message}


@router.post("/applications/{application_id}/objections", response_model=ObjectionRecordResponse)
def submit_objection(
    application_id: int,
    data: ObjectionRecordCreate,
    db: Session = Depends(get_db)
):
    success, message, objection = LotteryService.submit_objection(
        db,
        application_id=application_id,
        objector_name=data.objector_name,
        objector_contact=data.objector_contact,
        objection_content=data.objection_content
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)

    return objection


@router.get("/applications/{application_id}/objections", response_model=List[ObjectionRecordResponse])
def list_application_objections(application_id: int, db: Session = Depends(get_db)):
    application = db.query(ApplicationRecord).filter(
        ApplicationRecord.id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="申请记录不存在")

    return db.query(ObjectionRecord).filter(
        ObjectionRecord.application_record_id == application_id
    ).order_by(ObjectionRecord.objection_date.desc()).all()


@router.post("/objections/{objection_id}/handle")
def handle_objection(
    objection_id: int,
    handling_remark: str = Query(..., description="处理意见"),
    handling_result: str = Query(..., description="处理结果: objection_justified 或 objection_dismissed"),
    operator: Optional[str] = Query(None, description="操作人"),
    db: Session = Depends(get_db)
):
    if handling_result not in ["objection_justified", "objection_dismissed"]:
        raise HTTPException(status_code=400, detail="handling_result 必须是 objection_justified 或 objection_dismissed")

    success, message = LotteryService.handle_objection(
        db,
        objection_id=objection_id,
        handling_remark=handling_remark,
        handling_result=handling_result,
        operator=operator
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)

    return {"success": True, "message": message}


@router.post("/pools/{pool_id}/finalize")
def finalize_lottery_result(
    pool_id: str,
    operator: Optional[str] = Query(None, description="操作人"),
    db: Session = Depends(get_db)
):
    success, message, result = LotteryService.finalize_result(db, pool_id, operator)
    if not success:
        raise HTTPException(status_code=400, detail=message)

    return {
        "success": True,
        "message": message,
        "result": result
    }
