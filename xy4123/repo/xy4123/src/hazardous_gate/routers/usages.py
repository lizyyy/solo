from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from hazardous_gate.audit import AuditService
from hazardous_gate.models.schemas import (
    ApiResponse,
    ApprovalCheckResult,
    CourseUsageCreate,
    CourseUsageRead,
    CourseUsageUpdate,
    ReturnRecordCreate,
    ReturnRecordRead,
    UsageApproval,
)
from hazardous_gate.rules import UsageRuleEngine
from hazardous_gate.storage import CourseUsageCRUD, ReturnRecordCRUD, get_async_session

router = APIRouter(prefix="/usages", tags=["课程领用管理"])

SessionDep = Annotated[AsyncSession, Depends(get_async_session)]


@router.post("", response_model=CourseUsageRead, status_code=status.HTTP_201_CREATED)
async def create_usage(
    usage_in: CourseUsageCreate,
    db: SessionDep,
    user_authorization_level: int = Query(1, ge=1, le=5),
) -> CourseUsageRead:
    rule_engine = UsageRuleEngine(db)
    check_result = await rule_engine.validate_usage(
        usage_in,
        user_authorization_level=user_authorization_level,
        teacher_id=usage_in.teacher_id,
    )

    if not check_result.approved:
        audit_service = AuditService(db)
        for violation in check_result.violations:
            await audit_service.log_rule_violation(
                rule_name=violation.rule_name,
                severity=violation.severity,
                message=violation.message,
                context=violation.details,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "领用校验失败",
                "violations": [v.model_dump() for v in check_result.violations],
                "warnings": [w.model_dump() for w in check_result.warnings],
            },
        )

    usage = await CourseUsageCRUD.create(db, usage_in)

    audit_service = AuditService(db)
    await audit_service.log_usage_create(
        usage_id=usage.id,
        usage_number=usage.usage_number,
        teacher_name=usage.teacher_name,
        course_name=usage.course_name,
        item_count=len(usage.items),
    )

    result = await CourseUsageCRUD.get_by_id(db, usage.id, load_items=True)
    return result


@router.post("/validate", response_model=ApprovalCheckResult)
async def validate_usage(
    usage_in: CourseUsageCreate,
    db: SessionDep,
    user_authorization_level: int = Query(1, ge=1, le=5),
) -> ApprovalCheckResult:
    rule_engine = UsageRuleEngine(db)
    check_result = await rule_engine.validate_usage(
        usage_in,
        user_authorization_level=user_authorization_level,
        teacher_id=usage_in.teacher_id,
    )
    return check_result


@router.get("", response_model=list[CourseUsageRead])
async def list_usages(
    db: SessionDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    teacher_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    experiment_date_from: Optional[date] = Query(None),
    experiment_date_to: Optional[date] = Query(None),
    keyword: Optional[str] = Query(None),
) -> list[CourseUsageRead]:
    usages = await CourseUsageCRUD.get_all(
        db,
        skip=skip,
        limit=limit,
        teacher_id=teacher_id,
        status=status,
        experiment_date_from=experiment_date_from,
        experiment_date_to=experiment_date_to,
        keyword=keyword,
    )
    return list(usages)


@router.get("/{usage_id}", response_model=CourseUsageRead)
async def get_usage(
    usage_id: int,
    db: SessionDep,
) -> CourseUsageRead:
    usage = await CourseUsageCRUD.get_by_id(db, usage_id, load_items=True)
    if not usage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"领用单ID {usage_id} 不存在",
        )
    return usage


@router.put("/{usage_id}", response_model=CourseUsageRead)
async def update_usage(
    usage_id: int,
    usage_in: CourseUsageUpdate,
    db: SessionDep,
) -> CourseUsageRead:
    usage = await CourseUsageCRUD.get_by_id(db, usage_id)
    if not usage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"领用单ID {usage_id} 不存在",
        )

    from hazardous_gate.models.database import UsageStatus
    if usage.status != UsageStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"只有待审批状态的领用单可以修改",
        )

    updated = await CourseUsageCRUD.update(db, usage, usage_in)

    result = await CourseUsageCRUD.get_by_id(db, updated.id, load_items=True)
    return result


@router.post("/{usage_id}/approve", response_model=CourseUsageRead)
async def approve_usage(
    usage_id: int,
    approval: UsageApproval,
    db: SessionDep,
) -> CourseUsageRead:
    usage = await CourseUsageCRUD.get_by_id(db, usage_id)
    if not usage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"领用单ID {usage_id} 不存在",
        )

    rule_engine = UsageRuleEngine(db)
    check_result = await rule_engine.validate_usage_for_approval(usage_id)

    if approval.approved and not check_result.approved:
        audit_service = AuditService(db)
        for violation in check_result.violations:
            await audit_service.log_rule_violation(
                rule_name=violation.rule_name,
                severity=violation.severity,
                message=violation.message,
                context=violation.details,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "审批校验失败",
                "violations": [v.model_dump() for v in check_result.violations],
                "warnings": [w.model_dump() for w in check_result.warnings],
            },
        )

    approved = await CourseUsageCRUD.approve(db, usage_id, approval)

    audit_service = AuditService(db)
    await audit_service.log_usage_approve(
        usage_id=usage_id,
        usage_number=approved.usage_number,
        approved=approval.approved,
        approved_by=approval.approved_by,
        violations=[v.model_dump() for v in check_result.violations],
    )

    result = await CourseUsageCRUD.get_by_id(db, approved.id, load_items=True)
    return result


@router.post("/{usage_id}/issue", response_model=CourseUsageRead)
async def issue_usage(
    usage_id: int,
    db: SessionDep,
) -> CourseUsageRead:
    usage = await CourseUsageCRUD.get_by_id(db, usage_id)
    if not usage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"领用单ID {usage_id} 不存在",
        )

    from hazardous_gate.models.database import UsageStatus
    if usage.status != UsageStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"只有已批准状态的领用单可以发放",
        )

    rule_engine = UsageRuleEngine(db)
    check_result = await rule_engine.validate_usage_for_approval(usage_id)

    if not check_result.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "发放校验失败",
                "violations": [v.model_dump() for v in check_result.violations],
            },
        )

    issued = await CourseUsageCRUD.issue(db, usage_id)

    audit_service = AuditService(db)
    await audit_service.log_usage_issue(
        usage_id=usage_id,
        usage_number=issued.usage_number,
    )

    result = await CourseUsageCRUD.get_by_id(db, issued.id, load_items=True)
    return result


@router.post("/{usage_id}/return", response_model=ReturnRecordRead)
async def create_return(
    usage_id: int,
    return_in: ReturnRecordCreate,
    db: SessionDep,
) -> ReturnRecordRead:
    usage = await CourseUsageCRUD.get_by_id(db, usage_id)
    if not usage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"领用单ID {usage_id} 不存在",
        )

    return_in.course_usage_id = usage_id

    return_record = await ReturnRecordCRUD.create(db, return_in)

    if return_record:
        audit_service = AuditService(db)
        await audit_service.log_return_create(
            return_id=return_record.id,
            return_number=return_record.return_number,
            usage_id=usage_id,
            return_type=return_record.return_type,
            handler=return_record.handler,
            total_returned=float(return_record.total_returned_quantity),
            total_waste=float(return_record.total_waste_quantity),
        )

    if not return_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="创建归还记录失败",
        )

    result = await ReturnRecordCRUD.get_by_id(db, return_record.id, load_items=True)
    return result


@router.get("/{usage_id}/returns", response_model=list[ReturnRecordRead])
async def get_usage_returns(
    usage_id: int,
    db: SessionDep,
) -> list[ReturnRecordRead]:
    usage = await CourseUsageCRUD.get_by_id(db, usage_id)
    if not usage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"领用单ID {usage_id} 不存在",
        )

    returns = await ReturnRecordCRUD.get_by_usage(db, usage_id)
    return list(returns)
