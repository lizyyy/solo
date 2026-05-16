from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from database import get_db, init_db
from models import (
    SandboxCleanup, CleanupStatus, PreservationTag,
    AuditLog, CleanupSummary,
    SandboxCleanupCreate, SandboxCleanupUpdate,
    StatusTransition, ManualCorrection, RevokeRequest,
    ErrorRecord, ExportFilter, CleanupSummaryExport,
    ResourceItem, CleanupPlan
)
from state_machine import (
    CleanupStateMachine,
    StateTransitionError,
    PreservationInterceptError
)

app = FastAPI(
    title="沙箱清理保全API",
    description="提供沙箱清理的保全流程、状态管理和撤销机制",
    version="1.0.0"
)


@app.on_event("startup")
async def startup_event():
    init_db()


@app.exception_handler(StateTransitionError)
async def state_transition_error_handler(request, exc: StateTransitionError):
    return JSONResponse(
        status_code=400,
        content={
            "error": "状态转换错误",
            "from_status": exc.from_status,
            "to_status": exc.to_status,
            "message": exc.message
        }
    )


@app.exception_handler(PreservationInterceptError)
async def preservation_intercept_error_handler(request, exc: PreservationInterceptError):
    return JSONResponse(
        status_code=403,
        content={
            "error": "保全拦截",
            "sandbox_id": exc.sandbox_id,
            "preservation_tag": exc.preservation_tag,
            "message": exc.message
        }
    )


@app.post("/api/v1/cleanups", response_model=dict, summary="创建清理任务")
async def create_cleanup(
    cleanup_data: SandboxCleanupCreate,
    db: Session = Depends(get_db)
):
    cleanup = SandboxCleanup(
        sandbox_id=cleanup_data.sandbox_id,
        preservation_tag=cleanup_data.preservation_tag,
        scheduled_time=cleanup_data.scheduled_time,
        created_by=cleanup_data.created_by,
        assignee=cleanup_data.assignee,
        remarks=cleanup_data.remarks,
        raw_input=cleanup_data.raw_input
    )

    if cleanup_data.resource_inventory:
        cleanup.resource_inventory = [r.model_dump() for r in cleanup_data.resource_inventory]

    if cleanup_data.cleanup_plan:
        cleanup.cleanup_plan = cleanup_data.cleanup_plan.model_dump()

    db.add(cleanup)
    db.flush()

    CleanupStateMachine.create_audit_log(
        db,
        cleanup.id,
        action="create",
        from_status=None,
        to_status=CleanupStatus.PENDING,
        operator=cleanup_data.created_by,
        details={"sandbox_id": cleanup_data.sandbox_id},
        raw_input_snapshot=cleanup_data.raw_input
    )

    db.commit()
    db.refresh(cleanup)

    return {
        "cleanup_id": cleanup.id,
        "sandbox_id": cleanup.sandbox_id,
        "status": cleanup.status,
        "preservation_tag": cleanup.preservation_tag,
        "created_at": cleanup.created_at
    }


@app.get("/api/v1/cleanups", response_model=List[dict], summary="查询清理任务列表")
async def list_cleanups(
    sandbox_id: Optional[str] = None,
    status: Optional[List[CleanupStatus]] = Query(None),
    has_preservation: Optional[bool] = None,
    created_by: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(SandboxCleanup)

    if sandbox_id:
        query = query.filter(SandboxCleanup.sandbox_id == sandbox_id)
    if status:
        query = query.filter(SandboxCleanup.status.in_(status))
    if created_by:
        query = query.filter(SandboxCleanup.created_by == created_by)
    if has_preservation is not None:
        if has_preservation:
            query = query.filter(
                SandboxCleanup.preservation_tag.in_([
                    PreservationTag.UNDER_INVESTIGATION,
                    PreservationTag.EVIDENCE,
                    PreservationTag.PENDING_REVIEW
                ])
            )
        else:
            query = query.filter(
                SandboxCleanup.preservation_tag == PreservationTag.NO_PRESERVATION
            )

    cleanups = query.order_by(SandboxCleanup.created_at.desc()).offset(skip).limit(limit).all()

    return [
        {
            "cleanup_id": c.id,
            "sandbox_id": c.sandbox_id,
            "status": c.status,
            "preservation_tag": c.preservation_tag,
            "created_at": c.created_at,
            "created_by": c.created_by,
            "assignee": c.assignee,
            "has_error": bool(c.error_message),
            "is_manually_modified": c.is_manually_modified
        }
        for c in cleanups
    ]


@app.get("/api/v1/cleanups/{cleanup_id}", response_model=dict, summary="获取清理任务详情")
async def get_cleanup(
    cleanup_id: int,
    include_audit_logs: bool = False,
    db: Session = Depends(get_db)
):
    cleanup = db.query(SandboxCleanup).filter(SandboxCleanup.id == cleanup_id).first()
    if not cleanup:
        raise HTTPException(status_code=404, detail="清理任务不存在")

    result = {
        "cleanup_id": cleanup.id,
        "sandbox_id": cleanup.sandbox_id,
        "status": cleanup.status,
        "preservation_tag": cleanup.preservation_tag,
        "resource_inventory": cleanup.resource_inventory,
        "cleanup_plan": cleanup.cleanup_plan,
        "scheduled_time": cleanup.scheduled_time,
        "started_time": cleanup.started_time,
        "completed_time": cleanup.completed_time,
        "created_at": cleanup.created_at,
        "updated_at": cleanup.updated_at,
        "created_by": cleanup.created_by,
        "assignee": cleanup.assignee,
        "remarks": cleanup.remarks,
        "revoke_reason": cleanup.revoke_reason,
        "revoked_by": cleanup.revoked_by,
        "revoked_at": cleanup.revoked_at,
        "error_message": cleanup.error_message,
        "processing_conclusion": cleanup.processing_conclusion,
        "is_manually_modified": cleanup.is_manually_modified,
        "modified_by": cleanup.modified_by,
        "modified_at": cleanup.modified_at,
        "modification_reason": cleanup.modification_reason,
        "raw_input": cleanup.raw_input
    }

    if include_audit_logs:
        audit_logs = db.query(AuditLog).filter(AuditLog.cleanup_id == cleanup_id).order_by(AuditLog.timestamp.desc()).all()
        result["audit_logs"] = [
            {
                "log_id": log.id,
                "action": log.action,
                "from_status": log.from_status,
                "to_status": log.to_status,
                "operator": log.operator,
                "timestamp": log.timestamp,
                "details": log.details,
                "raw_input_snapshot": log.raw_input_snapshot,
                "processing_notes": log.processing_notes
            }
            for log in audit_logs
        ]

    return result


@app.put("/api/v1/cleanups/{cleanup_id}", response_model=dict, summary="更新清理任务")
async def update_cleanup(
    cleanup_id: int,
    update_data: SandboxCleanupUpdate,
    operator: str,
    db: Session = Depends(get_db)
):
    cleanup = db.query(SandboxCleanup).filter(SandboxCleanup.id == cleanup_id).first()
    if not cleanup:
        raise HTTPException(status_code=404, detail="清理任务不存在")

    if cleanup.status in [CleanupStatus.COMPLETED, CleanupStatus.REVOKED, CleanupStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="已终止的任务不能修改")

    update_dict = update_data.model_dump(exclude_unset=True)

    if "resource_inventory" in update_dict and update_dict["resource_inventory"]:
        update_dict["resource_inventory"] = [r.model_dump() for r in update_data.resource_inventory]

    if "cleanup_plan" in update_dict and update_dict["cleanup_plan"]:
        update_dict["cleanup_plan"] = update_data.cleanup_plan.model_dump()

    for field, value in update_dict.items():
        if value is not None:
            setattr(cleanup, field, value)

    CleanupStateMachine.create_audit_log(
        db,
        cleanup.id,
        action="update",
        from_status=cleanup.status,
        to_status=cleanup.status,
        operator=operator,
        details={"updated_fields": list(update_dict.keys())}
    )

    db.commit()
    db.refresh(cleanup)

    return {
        "cleanup_id": cleanup.id,
        "status": cleanup.status,
        "preservation_tag": cleanup.preservation_tag
    }


@app.post("/api/v1/cleanups/{cleanup_id}/transition", response_model=dict, summary="状态推进")
async def transition_status(
    cleanup_id: int,
    transition: StatusTransition,
    db: Session = Depends(get_db)
):
    cleanup = db.query(SandboxCleanup).filter(SandboxCleanup.id == cleanup_id).first()
    if not cleanup:
        raise HTTPException(status_code=404, detail="清理任务不存在")

    cleanup = CleanupStateMachine.transition_status(
        db,
        cleanup,
        transition.target_status,
        transition.operator,
        transition.details,
        transition.processing_conclusion
    )

    if transition.target_status == CleanupStatus.COMPLETED:
        CleanupStateMachine.generate_summary(db, cleanup, transition.operator)

    db.commit()
    db.refresh(cleanup)

    return {
        "cleanup_id": cleanup.id,
        "sandbox_id": cleanup.sandbox_id,
        "previous_status": transition.details.get("from_status") if transition.details else None,
        "current_status": cleanup.status,
        "processing_conclusion": cleanup.processing_conclusion
    }


@app.post("/api/v1/cleanups/{cleanup_id}/revoke", response_model=dict, summary="撤销清理任务")
async def revoke_cleanup(
    cleanup_id: int,
    revoke_request: RevokeRequest,
    db: Session = Depends(get_db)
):
    cleanup = db.query(SandboxCleanup).filter(SandboxCleanup.id == cleanup_id).first()
    if not cleanup:
        raise HTTPException(status_code=404, detail="清理任务不存在")

    cleanup = CleanupStateMachine.revoke_cleanup(
        db,
        cleanup,
        revoke_request.revoke_reason,
        revoke_request.revoked_by,
        revoke_request.details
    )

    db.commit()
    db.refresh(cleanup)

    return {
        "cleanup_id": cleanup.id,
        "sandbox_id": cleanup.sandbox_id,
        "status": cleanup.status,
        "revoke_reason": cleanup.revoke_reason,
        "revoked_by": cleanup.revoked_by,
        "revoked_at": cleanup.revoked_at
    }


@app.post("/api/v1/cleanups/{cleanup_id}/error", response_model=dict, summary="记录异常")
async def record_error(
    cleanup_id: int,
    error_record: ErrorRecord,
    db: Session = Depends(get_db)
):
    cleanup = db.query(SandboxCleanup).filter(SandboxCleanup.id == cleanup_id).first()
    if not cleanup:
        raise HTTPException(status_code=404, detail="清理任务不存在")

    cleanup = CleanupStateMachine.record_error(
        db,
        cleanup,
        error_record.error_message,
        error_record.operator,
        error_record.raw_input_snapshot,
        error_record.processing_notes
    )

    db.commit()
    db.refresh(cleanup)

    return {
        "cleanup_id": cleanup.id,
        "sandbox_id": cleanup.sandbox_id,
        "status": cleanup.status,
        "error_message": cleanup.error_message,
        "has_raw_input_snapshot": bool(error_record.raw_input_snapshot)
    }


@app.post("/api/v1/cleanups/{cleanup_id}/manual-correction", response_model=dict, summary="人工修正")
async def manual_correction(
    cleanup_id: int,
    correction: ManualCorrection,
    db: Session = Depends(get_db)
):
    cleanup = db.query(SandboxCleanup).filter(SandboxCleanup.id == cleanup_id).first()
    if not cleanup:
        raise HTTPException(status_code=404, detail="清理任务不存在")

    cleanup = CleanupStateMachine.manual_correct(
        db,
        cleanup,
        correction.corrected_status,
        correction.modified_by,
        correction.modification_reason,
        correction.details
    )

    db.commit()
    db.refresh(cleanup)

    return {
        "cleanup_id": cleanup.id,
        "sandbox_id": cleanup.sandbox_id,
        "current_status": cleanup.status,
        "is_manually_modified": cleanup.is_manually_modified,
        "modified_by": cleanup.modified_by,
        "modification_reason": cleanup.modification_reason
    }


@app.post("/api/v1/cleanups/export", response_model=List[CleanupSummaryExport], summary="导出清理摘要")
async def export_cleanups(
    filter: ExportFilter,
    db: Session = Depends(get_db)
):
    query = db.query(SandboxCleanup).outerjoin(CleanupSummary)

    if filter.status:
        query = query.filter(SandboxCleanup.status.in_(filter.status))
    if filter.sandbox_id:
        query = query.filter(SandboxCleanup.sandbox_id.contains(filter.sandbox_id))
    if filter.start_date:
        query = query.filter(SandboxCleanup.created_at >= filter.start_date)
    if filter.end_date:
        query = query.filter(SandboxCleanup.created_at <= filter.end_date)
    if filter.has_preservation is not None:
        if filter.has_preservation:
            query = query.filter(
                SandboxCleanup.preservation_tag.in_([
                    PreservationTag.UNDER_INVESTIGATION,
                    PreservationTag.EVIDENCE,
                    PreservationTag.PENDING_REVIEW
                ])
            )
        else:
            query = query.filter(
                SandboxCleanup.preservation_tag == PreservationTag.NO_PRESERVATION
            )

    cleanups = query.order_by(SandboxCleanup.created_at.desc()).all()

    results = []
    for cleanup in cleanups:
        summary = db.query(CleanupSummary).filter(CleanupSummary.cleanup_id == cleanup.id).first()

        total_resources = 0
        preserved_resources = 0
        cleaned_resources = 0
        failed_resources = 0
        duration_seconds = None

        if summary:
            total_resources = summary.total_resources
            preserved_resources = summary.preserved_resources
            cleaned_resources = summary.cleaned_resources
            failed_resources = summary.failed_resources
            duration_seconds = summary.duration_seconds
        elif cleanup.resource_inventory:
            total_resources = len(cleanup.resource_inventory)
            preserved_resources = sum(1 for r in cleanup.resource_inventory if isinstance(r, dict) and r.get("should_preserve", False))
            cleaned_resources = total_resources - preserved_resources

        results.append(CleanupSummaryExport(
            cleanup_id=cleanup.id,
            sandbox_id=cleanup.sandbox_id,
            status=cleanup.status,
            preservation_tag=cleanup.preservation_tag,
            created_at=cleanup.created_at,
            completed_at=cleanup.completed_time,
            total_resources=total_resources,
            preserved_resources=preserved_resources,
            cleaned_resources=cleaned_resources,
            failed_resources=failed_resources,
            duration_seconds=duration_seconds,
            revoke_reason=cleanup.revoke_reason,
            error_message=cleanup.error_message,
            processing_conclusion=cleanup.processing_conclusion,
            is_manually_modified=cleanup.is_manually_modified,
            modification_reason=cleanup.modification_reason
        ))

    return results


@app.get("/api/v1/cleanups/{cleanup_id}/summary", response_model=dict, summary="获取清理摘要详情")
async def get_cleanup_summary(
    cleanup_id: int,
    db: Session = Depends(get_db)
):
    cleanup = db.query(SandboxCleanup).filter(SandboxCleanup.id == cleanup_id).first()
    if not cleanup:
        raise HTTPException(status_code=404, detail="清理任务不存在")

    summary = db.query(CleanupSummary).filter(CleanupSummary.cleanup_id == cleanup_id).first()

    if not summary:
        summary = CleanupStateMachine.generate_summary(db, cleanup, "system")
        db.commit()

    return {
        "cleanup_id": summary.cleanup_id,
        "sandbox_id": summary.sandbox_id,
        "total_resources": summary.total_resources,
        "preserved_resources": summary.preserved_resources,
        "cleaned_resources": summary.cleaned_resources,
        "failed_resources": summary.failed_resources,
        "resource_details": summary.resource_details,
        "duration_seconds": summary.duration_seconds,
        "completed_by": summary.completed_by,
        "completed_at": summary.completed_at,
        "exported_at": summary.exported_at,
        "exported_by": summary.exported_by
    }


@app.get("/api/v1/status/valid-transitions", response_model=dict, summary="查看所有合法状态转换")
async def get_valid_transitions():
    return {
        "valid_transitions": CleanupStateMachine.VALID_TRANSITIONS,
        "preservation_blocking_tags": list(CleanupStateMachine.PRESERVATION_TAGS_THAT_BLOCK)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
