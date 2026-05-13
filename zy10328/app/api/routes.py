from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.models.base import get_db
from app.models.schema import EntryAPI, CallSample, HistoryRecord
from app.models.schemas import (
    EntryAPICreate, EntryAPIResponse, StatusUpdate, ExportRequest,
    ProfileSummary, ErrorResponse, StatusEnum
)
from app.services.profile_service import (
    create_entry_api, update_status, process_samples, revoke_profile,
    calculate_request_hash, is_duplicate_request, save_request_hash
)
from app.services.export_service import export_to_json, export_to_excel, get_profile_summary

router = APIRouter(prefix="/api/v1/profiles", tags=["profiles"])


@router.post(
    "",
    response_model=EntryAPIResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"model": ErrorResponse, "description": "重复请求"},
        422: {"model": ErrorResponse, "description": "参数验证失败"}
    }
)
async def create_profile(api_data: EntryAPICreate, db: Session = Depends(get_db)):
    """创建调用画像"""
    request_hash = calculate_request_hash(api_data.model_dump())
    
    if is_duplicate_request(db, request_hash):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ErrorResponse(
                error_code="DUPLICATE_REQUEST",
                error_message="该请求已在24小时内提交过，请不要重复提交",
                suggestion="如需重新提交，请等待24小时后重试或联系管理员清除缓存"
            ).model_dump()
        )
    
    entry_api = create_entry_api(db, api_data)
    save_request_hash(db, request_hash, entry_api.id)
    
    return entry_api


@router.get(
    "",
    response_model=List[EntryAPIResponse],
    summary="查询调用画像列表"
)
async def list_profiles(
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """查询调用画像列表，支持状态和风险等级筛选"""
    query = db.query(EntryAPI)
    
    if status:
        query = query.filter(EntryAPI.status == status)
    if risk_level:
        query = query.filter(EntryAPI.risk_level == risk_level)
    
    profiles = query.order_by(EntryAPI.created_at.desc()).offset(skip).limit(limit).all()
    return profiles


@router.get(
    "/{profile_id}",
    response_model=EntryAPIResponse,
    responses={404: {"model": ErrorResponse, "description": "画像不存在"}}
)
async def get_profile(profile_id: str, db: Session = Depends(get_db)):
    """查询单个调用画像详情"""
    profile = db.query(EntryAPI).filter(EntryAPI.id == profile_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code="PROFILE_NOT_FOUND",
                error_message=f"调用画像 {profile_id} 不存在",
                suggestion="请检查profile_id是否正确"
            ).model_dump()
        )
    return profile


@router.patch(
    "/{profile_id}/status",
    response_model=EntryAPIResponse,
    responses={
        404: {"model": ErrorResponse},
        400: {"model": ErrorResponse, "description": "状态流转不合法"}
    }
)
async def advance_status(profile_id: str, status_update: StatusUpdate, db: Session = Depends(get_db)):
    """推进调用画像状态"""
    profile = db.query(EntryAPI).filter(EntryAPI.id == profile_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code="PROFILE_NOT_FOUND",
                error_message=f"调用画像 {profile_id} 不存在"
            ).model_dump()
        )
    
    valid_transitions = {
        StatusEnum.CREATED: [StatusEnum.VALIDATING, StatusEnum.REVOKED],
        StatusEnum.VALIDATING: [StatusEnum.PROCESSING, StatusEnum.FAILED, StatusEnum.REVOKED],
        StatusEnum.PROCESSING: [StatusEnum.AGGREGATING, StatusEnum.FAILED, StatusEnum.REVOKED],
        StatusEnum.AGGREGATING: [StatusEnum.COMPLETED, StatusEnum.FAILED, StatusEnum.REVOKED],
    }
    
    current_status = StatusEnum(profile.status)
    target_status = status_update.status
    
    if current_status not in valid_transitions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code="INVALID_STATE_TRANSITION",
                error_message=f"当前状态 {current_status.value} 不支持状态变更",
                suggestion="画像已处于终态（COMPLETED/FAILED/REVOKED），无法继续推进"
            ).model_dump()
        )
    
    if target_status not in valid_transitions[current_status]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code="INVALID_STATE_TRANSITION",
                error_message=f"不支持从 {current_status.value} 直接变更到 {target_status.value}",
                suggestion=f"合法的目标状态: {[s.value for s in valid_transitions[current_status]]}"
            ).model_dump()
        )
    
    updated_profile = update_status(db, profile_id, status_update)
    
    if target_status == StatusEnum.AGGREGATING:
        process_samples(db, profile_id)
        updated_profile.status = StatusEnum.COMPLETED.value
        db.commit()
        db.refresh(updated_profile)
    
    return updated_profile


@router.post(
    "/{profile_id}/revoke",
    response_model=EntryAPIResponse,
    responses={404: {"model": ErrorResponse}}
)
async def revoke_profile_endpoint(
    profile_id: str,
    reason: str = "人工撤销",
    operator: str = "admin",
    db: Session = Depends(get_db)
):
    """撤销调用画像"""
    profile = revoke_profile(db, profile_id, reason, operator)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code="PROFILE_NOT_FOUND",
                error_message=f"调用画像 {profile_id} 不存在"
            ).model_dump()
        )
    return profile


@router.get(
    "/{profile_id}/summary",
    response_model=ProfileSummary,
    responses={404: {"model": ErrorResponse}}
)
async def get_profile_summary_endpoint(profile_id: str, db: Session = Depends(get_db)):
    """获取调用画像素描统计"""
    try:
        return get_profile_summary(db, profile_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code="PROFILE_NOT_FOUND",
                error_message=str(e)
            ).model_dump()
        )


@router.post(
    "/{profile_id}/export",
    responses={
        200: {"content": {"application/json": {}, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}}},
        404: {"model": ErrorResponse}
    }
)
async def export_profile(profile_id: str, export_request: ExportRequest, db: Session = Depends(get_db)):
    """导出调用画像"""
    try:
        if export_request.format.lower() == "excel":
            excel_data = export_to_excel(
                db, profile_id,
                export_request.include_samples,
                export_request.include_history
            )
            return StreamingResponse(
                iter([excel_data.getvalue()]),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename=profile_{profile_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.xlsx"}
            )
        else:
            return export_to_json(
                db, profile_id,
                export_request.include_samples,
                export_request.include_history
            )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code="PROFILE_NOT_FOUND",
                error_message=str(e)
            ).model_dump()
        )


@router.get(
    "/{profile_id}/history",
    response_model=List[dict],
    responses={404: {"model": ErrorResponse}}
)
async def get_profile_history(profile_id: str, db: Session = Depends(get_db)):
    """查询调用画像的历史变更记录"""
    profile = db.query(EntryAPI).filter(EntryAPI.id == profile_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code="PROFILE_NOT_FOUND",
                error_message=f"调用画像 {profile_id} 不存在"
            ).model_dump()
        )
    
    history = db.query(HistoryRecord).filter(
        HistoryRecord.entry_api_id == profile_id
    ).order_by(HistoryRecord.created_at.desc()).all()
    
    return [
        {
            "id": h.id,
            "action": h.action,
            "operator": h.operator,
            "previous_status": h.previous_status,
            "new_status": h.new_status,
            "change_reason": h.change_reason,
            "created_at": h.created_at
        }
        for h in history
    ]


@router.get(
    "/{profile_id}/samples",
    response_model=List[dict],
    responses={404: {"model": ErrorResponse}}
)
async def get_profile_samples(
    profile_id: str,
    category: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """查询调用画像的样本列表，支持分类和状态筛选"""
    profile = db.query(EntryAPI).filter(EntryAPI.id == profile_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code="PROFILE_NOT_FOUND",
                error_message=f"调用画像 {profile_id} 不存在"
            ).model_dump()
        )
    
    query = db.query(CallSample).filter(CallSample.entry_api_id == profile_id)
    
    if category:
        query = query.filter(CallSample.category == category)
    if status:
        query = query.filter(CallSample.status == status)
    
    samples = query.order_by(CallSample.timestamp.desc()).all()
    
    return [
        {
            "id": s.id,
            "trace_id": s.trace_id,
            "request_id": s.request_id,
            "user_id": s.user_id,
            "timestamp": s.timestamp,
            "status": s.status,
            "total_latency": s.total_latency,
            "category": s.category,
            "error_message": s.error_message
        }
        for s in samples
    ]
