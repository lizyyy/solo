from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from hazardous_gate.models.schemas import AuditLogRead
from hazardous_gate.storage import AuditLogCRUD, get_async_session

router = APIRouter(prefix="/audit", tags=["审计日志"])

SessionDep = Annotated[AsyncSession, Depends(get_async_session)]


@router.get("", response_model=list[AuditLogRead])
async def list_audit_logs(
    db: SessionDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    action: Optional[str] = Query(None, description="操作类型: CREATE, UPDATE, DELETE, APPROVE, REJECT, ISSUE, RETURN, IMPORT_CSV, EXPORT, RULE_VIOLATION"),
    resource_type: Optional[str] = Query(None, description="资源类型: Reagent, Batch, CourseUsage, ReturnRecord, RuleEngine"),
    user_id: Optional[str] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
) -> list[AuditLogRead]:
    logs = await AuditLogCRUD.get_all(
        db,
        skip=skip,
        limit=limit,
        action=action,
        resource_type=resource_type,
        user_id=user_id,
        start_time=start_time,
        end_time=end_time,
    )
    return list(logs)


@router.get("/actions", response_model=list[str])
async def get_audit_actions() -> list[str]:
    return [
        "CREATE",
        "UPDATE",
        "DELETE",
        "QUANTITY_CHANGE",
        "APPROVE",
        "REJECT",
        "ISSUE",
        "RETURN",
        "IMPORT_CSV",
        "EXPORT",
        "RULE_VIOLATION",
    ]


@router.get("/resource-types", response_model=list[str])
async def get_audit_resource_types() -> list[str]:
    return [
        "Reagent",
        "Batch",
        "CourseUsage",
        "ReturnRecord",
        "RuleEngine",
    ]
