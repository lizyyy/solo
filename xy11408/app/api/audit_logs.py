from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user, allow_supervisor
from app.models import User
from app.schemas import ApiResponse, PaginatedResponse, HttpLogResponse, CommandLogResponse
from app.services import AuditLogService

router = APIRouter()


@router.get("/http", response_model=ApiResponse[PaginatedResponse[HttpLogResponse]], dependencies=[Depends(allow_supervisor)])
def list_http_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: Optional[int] = None,
    method: Optional[str] = None,
    path: Optional[str] = None,
    has_error: Optional[int] = None,
    db: Session = Depends(get_db)
):
    skip = (page - 1) * page_size
    logs, total = AuditLogService.list_http_logs(
        db,
        user_id=user_id,
        method=method,
        path=path,
        has_error=has_error,
        skip=skip,
        limit=page_size
    )

    return ApiResponse(
        data=PaginatedResponse(
            items=[HttpLogResponse.model_validate(log) for log in logs],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size
        ),
        message="查询成功"
    )


@router.get("/commands", response_model=ApiResponse[PaginatedResponse[CommandLogResponse]], dependencies=[Depends(allow_supervisor)])
def list_command_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    operator_id: Optional[int] = None,
    success: Optional[int] = None,
    db: Session = Depends(get_db)
):
    skip = (page - 1) * page_size
    logs, total = AuditLogService.list_command_logs(
        db,
        operator_id=operator_id,
        success=success,
        skip=skip,
        limit=page_size
    )

    enhanced_logs = []
    for log in logs:
        log_data = CommandLogResponse.model_validate(log)
        if log.operator_id:
            operator = db.query(User).filter(User.id == log.operator_id).first()
            if operator:
                log_data.operator_name = operator.full_name
        enhanced_logs.append(log_data)

    return ApiResponse(
        data=PaginatedResponse(
            items=enhanced_logs,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size
        ),
        message="查询成功"
    )


@router.post("/execute-command", response_model=ApiResponse, dependencies=[Depends(allow_supervisor)])
def execute_command(
    command_name: str = Query(..., description="命令名称"),
    command_script: str = Query(..., description="命令脚本"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = AuditLogService.execute_command(
        db,
        command_name=command_name,
        command_script=command_script,
        operator_id=current_user.id
    )
    return ApiResponse(
        success=result.get("success", False),
        data=result,
        message="命令执行完成"
    )
