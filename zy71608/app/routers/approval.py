from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import ResponseModel
from app.services.approval_service import ApprovalService
from app.schemas.reduction import ReductionApplicationInfo

router = APIRouter(prefix="/approvals", tags=["审批工作流"])


@router.post("/{application_id}/submit", response_model=ResponseModel[ReductionApplicationInfo])
def submit_application(
    application_id: int,
    submitter: str = Query(..., description="提交人"),
    db: Session = Depends(get_db),
):
    approval_service = ApprovalService(db)
    try:
        application = approval_service.submit_application(application_id, submitter)
        return ResponseModel(data=ReductionApplicationInfo.model_validate(application), message="申请提交成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{application_id}/process", response_model=ResponseModel[ReductionApplicationInfo])
def process_application(
    application_id: int,
    processor: str = Query(..., description="处理人"),
    db: Session = Depends(get_db),
):
    approval_service = ApprovalService(db)
    try:
        application = approval_service.process_application(application_id, processor)
        return ResponseModel(data=ReductionApplicationInfo.model_validate(application), message="申请已处理")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{application_id}/start-review", response_model=ResponseModel[ReductionApplicationInfo])
def start_review(
    application_id: int,
    reviewer: str = Query(..., description="复核人"),
    db: Session = Depends(get_db),
):
    approval_service = ApprovalService(db)
    try:
        application = approval_service.start_review(application_id, reviewer)
        return ResponseModel(data=ReductionApplicationInfo.model_validate(application), message="进入复核环节")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{application_id}/approve", response_model=ResponseModel[ReductionApplicationInfo])
def approve_application(
    application_id: int,
    approver: str = Query(..., description="审批人"),
    comments: Optional[str] = Body(None, description="审批意见"),
    db: Session = Depends(get_db),
):
    approval_service = ApprovalService(db)
    try:
        application = approval_service.approve_application(application_id, approver, comments)
        return ResponseModel(data=ReductionApplicationInfo.model_validate(application), message="审批通过")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{application_id}/reject", response_model=ResponseModel[ReductionApplicationInfo])
def reject_application(
    application_id: int,
    rejector: str = Query(..., description="驳回人"),
    reason: str = Body(..., description="驳回原因"),
    db: Session = Depends(get_db),
):
    approval_service = ApprovalService(db)
    try:
        application = approval_service.reject_application(application_id, rejector, reason)
        return ResponseModel(data=ReductionApplicationInfo.model_validate(application), message="申请已驳回")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{application_id}/sign-supplementary", response_model=ResponseModel[ReductionApplicationInfo])
def sign_supplementary_agreement(
    application_id: int,
    signer: str = Query(..., description="签署人"),
    agreement_no: str = Body(..., description="补充协议编号"),
    db: Session = Depends(get_db),
):
    approval_service = ApprovalService(db)
    try:
        application = approval_service.sign_supplementary_agreement(application_id, signer, agreement_no)
        return ResponseModel(data=ReductionApplicationInfo.model_validate(application), message="补充协议已签署")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{application_id}/complete", response_model=ResponseModel[ReductionApplicationInfo])
def complete_application(
    application_id: int,
    completer: str = Query(..., description="完成人"),
    db: Session = Depends(get_db),
):
    approval_service = ApprovalService(db)
    try:
        application = approval_service.complete_application(application_id, completer)
        return ResponseModel(data=ReductionApplicationInfo.model_validate(application), message="审批流程已完成")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{application_id}/revise", response_model=ResponseModel[ReductionApplicationInfo])
def revise_application(
    application_id: int,
    reviser: str = Query(..., description="修改人"),
    update_data: dict = Body(..., description="修改内容"),
    reason: str = Body(..., description="修改原因"),
    db: Session = Depends(get_db),
):
    approval_service = ApprovalService(db)
    try:
        application = approval_service.revise_application(application_id, reviser, update_data, reason)
        return ResponseModel(data=ReductionApplicationInfo.model_validate(application), message="申请已修改")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{application_id}/history", response_model=ResponseModel[List[dict]])
def get_approval_history(application_id: int, db: Session = Depends(get_db)):
    approval_service = ApprovalService(db)
    history = approval_service.get_approval_history(application_id)
    return ResponseModel(data=history)


@router.get("/{application_id}/workflow-status", response_model=ResponseModel[dict])
def get_workflow_status(application_id: int, db: Session = Depends(get_db)):
    approval_service = ApprovalService(db)
    try:
        status = approval_service.get_workflow_status(application_id)
        return ResponseModel(data=status)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
