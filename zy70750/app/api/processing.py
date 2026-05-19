from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import Response
from sqlalchemy.orm import Session
from datetime import datetime
import json
from app.core.database import get_db
from app.core.constants import ErrorCode, TaskStatus, DiffType
from app.schemas import schemas
from app.models import models
from app.services.regression_processor import RegressionProcessor

router = APIRouter(prefix="/api/v1", tags=["processing"])


@router.post("/tasks/{task_id}/start")
def start_task(
    task_id: int,
    background_tasks: BackgroundTasks,
    force_restart: bool = False,
    db: Session = Depends(get_db)
):
    task = db.query(models.RegressionTask).filter(
        models.RegressionTask.id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"Task {task_id} not found",
                "error_code": ErrorCode.NOT_FOUND
            }
        )

    if task.status == TaskStatus.COMPLETED or task.status == TaskStatus.REVIEWED:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Task already processed",
                "error_code": ErrorCode.ALREADY_PROCESSED
            }
        )

    if task.status == TaskStatus.PROCESSING:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Task is already processing",
                "error_code": ErrorCode.INVALID_STATUS
            }
        )

    if task.status == TaskStatus.NEED_REVIEW and not force_restart:
        unreviewed_count = db.query(models.DiffReport).filter(
            models.DiffReport.task_id == task_id,
            models.DiffReport.is_reviewed == False
        ).count()
        raise HTTPException(
            status_code=400,
            detail={
                "message": f"Task has {unreviewed_count} unreviewed diffs, need manual review first. Use force_restart=true to bypass.",
                "error_code": ErrorCode.NEED_MANUAL_REVIEW,
                "unreviewed_count": unreviewed_count
            }
        )

    processor = RegressionProcessor(db)

    def process():
        processor.process_task(task_id, force_restart=force_restart)

    background_tasks.add_task(process)

    return {
        "success": True,
        "message": f"Task {task_id} started in background",
        "task_id": task_id
    }


@router.post("/tasks/{task_id}/review")
def review_task(
    task_id: int,
    reviewed_by: str,
    db: Session = Depends(get_db)
):
    task = db.query(models.RegressionTask).filter(
        models.RegressionTask.id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"Task {task_id} not found",
                "error_code": ErrorCode.NOT_FOUND
            }
        )

    if task.status != TaskStatus.NEED_REVIEW:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Task is not in review status",
                "error_code": ErrorCode.INVALID_STATUS
            }
        )

    diffs = db.query(models.DiffReport).filter(
        models.DiffReport.task_id == task_id,
        models.DiffReport.is_reviewed == False
    ).all()

    for diff in diffs:
        diff.is_reviewed = True
        diff.reviewed_by = reviewed_by
        diff.reviewed_at = datetime.utcnow()

    task.status = TaskStatus.REVIEWED
    db.commit()

    return {
        "success": True,
        "message": f"Task {task_id} reviewed successfully",
        "reviewed_diffs": len(diffs)
    }


@router.post("/diffs/batch-review")
def review_diffs_batch(
    request: schemas.DiffReviewRequest,
    db: Session = Depends(get_db)
):
    if not request.diff_ids:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "No diff IDs provided",
                "error_code": ErrorCode.MISSING_FIELD
            }
        )

    diffs = db.query(models.DiffReport).filter(
        models.DiffReport.id.in_(request.diff_ids)
    ).all()

    for diff in diffs:
        diff.is_reviewed = True
        diff.reviewed_by = request.reviewed_by
        diff.reviewed_at = datetime.utcnow()

    db.commit()

    return {
        "success": True,
        "message": f"Reviewed {len(diffs)} diffs",
        "reviewed_count": len(diffs)
    }


@router.post("/failed-records/{record_id}/resolve")
def resolve_failed_record(
    record_id: int,
    resolved_by: str,
    db: Session = Depends(get_db)
):
    record = db.query(models.FailedRecord).filter(
        models.FailedRecord.id == record_id
    ).first()

    if not record:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"Failed record {record_id} not found",
                "error_code": ErrorCode.NOT_FOUND
            }
        )

    if record.is_resolved:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Failed record already resolved",
                "error_code": ErrorCode.ALREADY_PROCESSED
            }
        )

    record.is_resolved = True
    record.resolved_by = resolved_by
    record.resolved_at = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "message": f"Failed record {record_id} resolved"
    }


@router.post("/export")
def export_data(
    request: schemas.ExportRequest,
    require_reviewed: bool = False,
    db: Session = Depends(get_db)
):
    if not request.task_ids:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "No task IDs provided",
                "error_code": ErrorCode.MISSING_FIELD
            }
        )

    if require_reviewed:
        unreviewed_tasks = []
        for task_id in request.task_ids:
            task = db.query(models.RegressionTask).filter(
                models.RegressionTask.id == task_id
            ).first()
            if task and task.status == TaskStatus.NEED_REVIEW:
                unreviewed_count = db.query(models.DiffReport).filter(
                    models.DiffReport.task_id == task_id,
                    models.DiffReport.is_reviewed == False
                ).count()
                if unreviewed_count > 0:
                    unreviewed_tasks.append({"task_id": task_id, "name": task.name, "unreviewed_count": unreviewed_count})
        
        if unreviewed_tasks:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Some tasks have unreviewed diffs, need manual review first",
                    "error_code": ErrorCode.NEED_MANUAL_REVIEW,
                    "unreviewed_tasks": unreviewed_tasks
                }
            )

    export_data = {"tasks": []}

    for task_id in request.task_ids:
        task = db.query(models.RegressionTask).filter(
            models.RegressionTask.id == task_id
        ).first()

        if not task:
            continue

        diffs = db.query(models.DiffReport).filter(
            models.DiffReport.task_id == task_id
        ).all()

        failed_records = db.query(models.FailedRecord).filter(
            models.FailedRecord.task_id == task_id
        ).all()

        task_data = {
            "task_id": task.id,
            "name": task.name,
            "status": task.status,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "statistics": {
                "total_files": task.total_files,
                "total_lines": task.total_lines,
                "processed_lines": task.processed_lines,
                "failed_lines": task.failed_lines,
                "diff_count": task.diff_count,
                "risk_score": task.risk_score
            },
            "differences": [
                {
                    "id": diff.id,
                    "diff_type": diff.diff_type,
                    "field_name": diff.field_name,
                    "original_value": diff.original_value,
                    "masked_value": diff.masked_value,
                    "severity": diff.severity,
                    "is_reviewed": diff.is_reviewed
                }
                for diff in diffs
            ],
            "failed_records": [
                {
                    "id": fr.id,
                    "file_path": fr.file_path,
                    "line_number": fr.line_number,
                    "error_type": fr.error_type,
                    "is_resolved": fr.is_resolved
                }
                for fr in failed_records
            ]
        }
        export_data["tasks"].append(task_data)

    if request.format == "markdown":
        md_content = _generate_markdown_report(export_data)
        return Response(
            content=md_content,
            media_type="text/markdown",
            headers={"Content-Disposition": "attachment; filename=regression_report.md"}
        )
    else:
        return Response(
            content=json.dumps(export_data, indent=2, ensure_ascii=False),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=regression_report.json"}
        )


def _generate_markdown_report(data: dict) -> str:
    md = []
    md.append("# 脱敏规则回归差异报告\n")

    for task in data["tasks"]:
        md.append(f"\n## 任务: {task['name']} (ID: {task['task_id']})\n")
        md.append(f"- **状态**: {task['status']}")
        md.append(f"- **创建时间**: {task['created_at']}")
        md.append(f"- **完成时间**: {task['completed_at']}\n")

        md.append("### 统计信息\n")
        stats = task["statistics"]
        md.append(f"- **总文件数**: {stats['total_files']}")
        md.append(f"- **总行数**: {stats['total_lines']}")
        md.append(f"- **处理成功**: {stats['processed_lines']}")
        md.append(f"- **处理失败**: {stats['failed_lines']}")
        md.append(f"- **差异数量**: {stats['diff_count']}")
        md.append(f"- **风险分数**: {stats['risk_score']}\n")

        if task["differences"]:
            md.append("### 差异详情\n")
            md.append("| ID | 差异类型 | 字段名 | 原值 | 脱敏值 | 严重程度 | 是否已复核 |")
            md.append("|----|----------|--------|------|--------|----------|------------|")
            for diff in task["differences"]:
                md.append(
                    f"| {diff['id']} | {diff['diff_type']} | {diff['field_name'] or '-'} | "
                    f"{diff['original_value'] or '-'} | {diff['masked_value'] or '-'} | "
                    f"{diff['severity']} | {'是' if diff['is_reviewed'] else '否'} |"
                )
            md.append("")

        if task["failed_records"]:
            md.append("### 失败记录\n")
            md.append("| ID | 文件路径 | 行号 | 错误类型 | 是否已解决 |")
            md.append("|----|----------|------|----------|------------|")
            for fr in task["failed_records"]:
                md.append(
                    f"| {fr['id']} | {fr['file_path']} | {fr['line_number']} | "
                    f"{fr['error_type']} | {'是' if fr['is_resolved'] else '否'} |"
                )
            md.append("")

    return "\n".join(md)
