from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from ..database import get_db
from ..models import ApplicationStatus
from ..schemas import (
    BorrowApplicationCreate, BorrowApplicationUpdate, BorrowApplicationResponse,
    BorrowRecordBase, UsageMaterialCreate, ReturnRecordBase,
    ManualCorrectionRequest, ApprovalRequest, BusinessResponse,
    StatusHistoryResponse, TimeoutHandleRequest
)
from ..services.application_service import ApplicationService
from ..services.status_service import StatusService
from ..services.timeout_service import TimeoutService

router = APIRouter(prefix="/applications", tags=["外借申请"])


@router.post("", response_model=BusinessResponse, summary="创建外借申请")
def create_application(
    data: BorrowApplicationCreate,
    operator: str = Query(..., description="操作人姓名"),
    db: Session = Depends(get_db)
):
    success, message, application = ApplicationService.create_application(db, operator, data)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return BusinessResponse(
        success=True,
        business_code="APPLICATION_CREATED",
        message=message,
        data={"application_id": application.id, "application_no": application.application_no}
    )


@router.post("/{application_id}/submit", response_model=BusinessResponse, summary="提交审批")
def submit_application(
    application_id: int,
    operator: str = Query(..., description="操作人姓名"),
    db: Session = Depends(get_db)
):
    success, message = ApplicationService.submit_for_approval(db, application_id, operator)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return BusinessResponse(
        success=True,
        business_code="APPLICATION_SUBMITTED",
        message=message
    )


@router.post("/{application_id}/approve", response_model=BusinessResponse, summary="审批申请")
def approve_application(
    application_id: int,
    data: ApprovalRequest,
    db: Session = Depends(get_db)
):
    success, message = ApplicationService.approve_application(
        db, application_id, data.approval_person, data.approval_opinion, data.approve
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return BusinessResponse(
        success=True,
        business_code="APPLICATION_APPROVED" if data.approve else "APPLICATION_REJECTED",
        message=message
    )


@router.post("/{application_id}/borrow", response_model=BusinessResponse, summary="记录外借")
def record_borrow(
    application_id: int,
    data: BorrowRecordBase,
    operator: str = Query(..., description="操作人姓名"),
    db: Session = Depends(get_db)
):
    success, message = ApplicationService.record_borrow(db, application_id, data, operator)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return BusinessResponse(
        success=True,
        business_code="BORROW_RECORDED",
        message=message
    )


@router.post("/{application_id}/materials", response_model=BusinessResponse, summary="上传使用材料")
def upload_material(
    application_id: int,
    data: UsageMaterialCreate,
    uploader: str = Query(..., description="上传人姓名"),
    db: Session = Depends(get_db)
):
    success, message, material = ApplicationService.upload_usage_material(db, application_id, data, uploader)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return BusinessResponse(
        success=True,
        business_code="MATERIAL_UPLOADED",
        message=message,
        data={"material_id": material.id}
    )


@router.post("/materials/{material_id}/verify", response_model=BusinessResponse, summary="核验使用材料")
def verify_material(
    material_id: int,
    verified_by: str = Query(..., description="核验人姓名"),
    is_verified: bool = Query(..., description="是否核验通过"),
    remarks: str = Query("", description="核验备注"),
    db: Session = Depends(get_db)
):
    success, message = ApplicationService.verify_material(
        db, material_id, verified_by, remarks if remarks else None, is_verified
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return BusinessResponse(
        success=True,
        business_code="MATERIAL_VERIFIED",
        message=message
    )


@router.post("/{application_id}/return", response_model=BusinessResponse, summary="归还核验")
def record_return(
    application_id: int,
    data: ReturnRecordBase,
    operator: str = Query(..., description="操作人姓名"),
    db: Session = Depends(get_db)
):
    success, message = ApplicationService.record_return(db, application_id, data, operator)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return BusinessResponse(
        success=True,
        business_code="RETURN_RECORDED",
        message=message
    )


@router.post("/{application_id}/correct", response_model=BusinessResponse, summary="人工修正状态")
def manual_correction(
    application_id: int,
    data: ManualCorrectionRequest,
    db: Session = Depends(get_db)
):
    success, message = ApplicationService.manual_correct_status(
        db, application_id, data.new_status, data.new_timeout_level, data.operator, data.reason
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return BusinessResponse(
        success=True,
        business_code="MANUAL_CORRECTION_DONE",
        message=message
    )


@router.get("", response_model=List[BorrowApplicationResponse], summary="查询申请列表")
def list_applications(
    status: Optional[ApplicationStatus] = None,
    db: Session = Depends(get_db)
):
    from ..models import BorrowApplication
    
    query = db.query(BorrowApplication)
    if status:
        query = query.filter(BorrowApplication.status == status)
    
    return query.order_by(BorrowApplication.created_at.desc()).all()


@router.get("/{application_id}", response_model=BusinessResponse, summary="查询申请详情")
def get_application(application_id: int, db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    from ..models import BorrowApplication
    
    application = db.query(BorrowApplication).options(
        joinedload(BorrowApplication.seal),
        joinedload(BorrowApplication.borrow_records),
        joinedload(BorrowApplication.usage_materials),
        joinedload(BorrowApplication.return_records),
        joinedload(BorrowApplication.timeout_records),
        joinedload(BorrowApplication.status_histories)
    ).filter(BorrowApplication.id == application_id).first()
    
    if not application:
        raise HTTPException(status_code=404, detail="申请不存在")
    
    materials = application.usage_materials
    timeout_msg = f"当前超时等级：{application.current_timeout_level.value}" if application.current_timeout_level else "无超时"
    materials_msg = f"已上传{len(materials)}份材料"
    
    return BusinessResponse(
        success=True,
        business_code="APPLICATION_FOUND",
        message=f"申请状态：{application.status.value}。{timeout_msg}。{materials_msg}。",
        data={
            "application": {
                "id": application.id,
                "application_no": application.application_no,
                "applicant": application.applicant_name,
                "seal_name": application.seal.seal_name if application.seal else None,
                "status": application.status.value,
                "final_result": application.final_result.value if application.final_result else None,
                "materials_count": len(materials),
                "timeout_level": application.current_timeout_level.value if application.current_timeout_level else None
            }
        }
    )


@router.get("/{application_id}/history", response_model=List[StatusHistoryResponse], summary="查询状态变更历史")
def get_history(application_id: int, db: Session = Depends(get_db)):
    histories = StatusService.get_application_history(db, application_id)
    return histories


@router.post("/timeout-alerts/{alert_id}/handle", response_model=BusinessResponse, summary="处理超时告警")
def handle_timeout_alert(
    alert_id: int,
    data: TimeoutHandleRequest,
    db: Session = Depends(get_db)
):
    success, message = TimeoutService.handle_timeout_alert(
        db, alert_id, data.handled_by, data.handling_result
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return BusinessResponse(
        success=True,
        business_code="TIMEOUT_HANDLED",
        message=message
    )
