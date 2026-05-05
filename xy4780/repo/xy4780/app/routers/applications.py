from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.services import ApplicationService, UserService
from app.config import ApplicationStatus
from app.schemas import (
    ApplicationCreate, ApplicationUpdate, ApplicationResponse,
    SubmitForEthicsReviewRequest, EthicsReviewRequest,
    DeidentificationReviewRequest, MakeAvailableRequest,
    RevokeRequest, ExpireRequest,
    AuditLogResponse, SuccessResponse
)

router = APIRouter(prefix="/api/applications", tags=["applications"])


@router.post(
    "",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建数据访问申请",
    description="创建新的数据访问申请，初始状态为草稿"
)
def create_application(
    data: ApplicationCreate,
    db: Session = Depends(get_db)
):
    service = ApplicationService(db)
    return service.create(data)


@router.get(
    "",
    response_model=List[ApplicationResponse],
    summary="获取申请列表",
    description="分页获取所有数据访问申请，可按状态筛选"
)
def list_applications(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=500, description="返回数量"),
    status_filter: Optional[ApplicationStatus] = Query(None, alias="status", description="状态筛选"),
    db: Session = Depends(get_db)
):
    service = ApplicationService(db)
    return service.get_all(skip=skip, limit=limit, status=status_filter)


@router.get(
    "/{application_id}",
    response_model=ApplicationResponse,
    summary="获取申请详情",
    description="根据ID获取单个申请的详细信息"
)
def get_application(
    application_id: int,
    db: Session = Depends(get_db)
):
    service = ApplicationService(db)
    return service.get_by_id(application_id)


@router.put(
    "/{application_id}",
    response_model=ApplicationResponse,
    summary="更新申请信息",
    description="更新申请信息，仅在草稿状态下允许"
)
def update_application(
    application_id: int,
    data: ApplicationUpdate,
    operator_id: int = Query(..., ge=1, description="操作者ID"),
    db: Session = Depends(get_db)
):
    service = ApplicationService(db)
    return service.update(application_id, data, operator_id)


@router.post(
    "/{application_id}/submit",
    response_model=ApplicationResponse,
    summary="提交伦理审核",
    description="将申请从草稿状态提交到伦理审核状态，需要先上传伦理批件"
)
def submit_for_ethics_review(
    application_id: int,
    request: SubmitForEthicsReviewRequest,
    db: Session = Depends(get_db)
):
    service = ApplicationService(db)
    return service.submit_for_ethics_review(application_id, request)


@router.post(
    "/{application_id}/ethics-review",
    response_model=ApplicationResponse,
    summary="伦理审核",
    description="伦理委员会审核申请，可通过或驳回"
)
def ethics_review(
    application_id: int,
    request: EthicsReviewRequest,
    db: Session = Depends(get_db)
):
    service = ApplicationService(db)
    return service.ethics_review(application_id, request)


@router.post(
    "/{application_id}/deidentification-review",
    response_model=ApplicationResponse,
    summary="脱敏复核",
    description="数据管理员进行脱敏复核，可通过或驳回"
)
def deidentification_review(
    application_id: int,
    request: DeidentificationReviewRequest,
    db: Session = Depends(get_db)
):
    service = ApplicationService(db)
    return service.deidentification_review(application_id, request)


@router.post(
    "/{application_id}/make-available",
    response_model=ApplicationResponse,
    summary="开放下载",
    description="设置下载链接，使申请状态变为可下载"
)
def make_available(
    application_id: int,
    request: MakeAvailableRequest,
    db: Session = Depends(get_db)
):
    service = ApplicationService(db)
    return service.make_available(application_id, request)


@router.post(
    "/{application_id}/revoke",
    response_model=ApplicationResponse,
    summary="撤销申请",
    description="撤销申请，撤销后不可恢复"
)
def revoke_application(
    application_id: int,
    request: RevokeRequest,
    db: Session = Depends(get_db)
):
    service = ApplicationService(db)
    return service.revoke(application_id, request)


@router.post(
    "/{application_id}/expire",
    response_model=ApplicationResponse,
    summary="标记过期",
    description="将申请标记为已过期，过期后不可恢复"
)
def expire_application(
    application_id: int,
    request: ExpireRequest,
    db: Session = Depends(get_db)
):
    service = ApplicationService(db)
    return service.expire(application_id, request)


@router.get(
    "/{application_id}/audit-logs",
    response_model=List[AuditLogResponse],
    summary="获取审计日志",
    description="获取申请的所有操作审计日志"
)
def get_audit_logs(
    application_id: int,
    db: Session = Depends(get_db)
):
    service = ApplicationService(db)
    return service.get_audit_logs(application_id)
