from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import ApplicationRecord, ApplicationStatus
from ..schemas import (
    ApplicationRecordCreate, ApplicationRecordResponse,
    ApplicationStatusDetail, RetryRequest
)
from ..services.verification_service import VerificationService
from ..services.lottery_service import LotteryService
from ..services.task_service import TaskService

router = APIRouter(prefix="/api/applications", tags=["申请管理"])


@router.post("", response_model=ApplicationRecordResponse)
def create_application(
    data: ApplicationRecordCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(ApplicationRecord).filter(
        ApplicationRecord.application_number == data.application_number
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"申请编号 {data.application_number} 已存在")

    application = ApplicationRecord(
        application_number=data.application_number,
        applicant_name=data.applicant_name,
        applicant_id_card=data.applicant_id_card,
        contact_phone=data.contact_phone,
        household_address=data.household_address,
        applied_rule_id=data.applied_rule_id
    )
    db.add(application)
    db.flush()

    from ..models import FamilyMember
    for fm_data in data.family_members:
        family_member = FamilyMember(
            application_record_id=application.id,
            name=fm_data.name,
            id_card=fm_data.id_card,
            relation=fm_data.relation,
            is_main_applicant=fm_data.is_main_applicant,
            monthly_income=fm_data.monthly_income,
            social_insurance_months=fm_data.social_insurance_months,
            housing_area_contribution=fm_data.housing_area_contribution
        )
        db.add(family_member)

    db.commit()
    db.refresh(application)
    return application


@router.get("/{application_id}", response_model=ApplicationRecordResponse)
def get_application(application_id: int, db: Session = Depends(get_db)):
    application = db.query(ApplicationRecord).filter(
        ApplicationRecord.id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="申请记录不存在")
    return application


@router.get("/number/{application_number}", response_model=ApplicationRecordResponse)
def get_application_by_number(application_number: str, db: Session = Depends(get_db)):
    application = db.query(ApplicationRecord).filter(
        ApplicationRecord.application_number == application_number
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="申请记录不存在")
    return application


@router.post("/{application_id}/verify")
def verify_application(
    application_id: int,
    operator: Optional[str] = Query(None, description="操作人"),
    db: Session = Depends(get_db)
):
    application = db.query(ApplicationRecord).filter(
        ApplicationRecord.id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="申请记录不存在")

    if application.current_status == ApplicationStatus.REJECTED.value:
        passed, message = VerificationService.retry_verification(db, application, operator)
    else:
        passed, results = VerificationService.run_full_verification(db, application, operator)
        message = results[-1]["message"] if results else "核验完成"

    db.refresh(application)
    return {
        "success": passed,
        "message": message,
        "current_status": application.current_status,
        "current_checkpoint": application.current_checkpoint
    }


@router.get("/{application_id}/status", response_model=ApplicationStatusDetail)
def get_application_status(application_id: int, db: Session = Depends(get_db)):
    detail = LotteryService.get_application_status_detail(db, application_id)
    if not detail:
        raise HTTPException(status_code=404, detail="申请记录不存在")
    return detail


@router.post("/{application_id}/retry")
def retry_application(
    application_id: int,
    data: Optional[RetryRequest] = None,
    db: Session = Depends(get_db)
):
    application = db.query(ApplicationRecord).filter(
        ApplicationRecord.id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="申请记录不存在")

    operator = data.operator if data else None
    remark = data.remark if data else None

    passed, message = VerificationService.retry_verification(db, application, operator, remark)
    db.refresh(application)

    return {
        "success": passed,
        "message": message,
        "current_status": application.current_status,
        "current_checkpoint": application.current_checkpoint
    }


@router.get("/{application_id}/history")
def get_processing_history(
    application_id: int,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    application = db.query(ApplicationRecord).filter(
        ApplicationRecord.id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="申请记录不存在")

    history = LotteryService.get_processing_history(db, application_id, limit)
    return {
        "application_id": application_id,
        "application_number": application.application_number,
        "history_count": len(history),
        "history": history
    }


@router.get("", response_model=List[ApplicationRecordResponse])
def list_applications(
    status: Optional[str] = Query(None, description="状态过滤"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(ApplicationRecord)
    if status:
        query = query.filter(ApplicationRecord.current_status == status)
    query = query.order_by(ApplicationRecord.created_at.desc()).offset(offset).limit(limit)
    return query.all()


@router.post("/{application_id}/verify/async")
def verify_application_async(
    application_id: int,
    db: Session = Depends(get_db)
):
    application = db.query(ApplicationRecord).filter(
        ApplicationRecord.id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="申请记录不存在")

    task = TaskService.create_task(
        db,
        task_name=f"核验申请 {application.application_number}",
        task_type="verification",
        application_record_id=application_id,
        max_retry=3
    )

    return {
        "task_id": task.id,
        "task_name": task.task_name,
        "status": task.status,
        "message": "已创建后台核验任务，请通过任务接口查询执行状态"
    }
