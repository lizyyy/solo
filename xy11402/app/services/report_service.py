from typing import Dict, List, Any
from datetime import datetime, timedelta
from io import BytesIO
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.task import CompensationTask, StatusLog
from app.models.enums import TaskStatus, RetryCategory, TaskSource


def get_retry_category_stats(db: Session) -> Dict[str, Any]:
    stats = (
        db.query(
            CompensationTask.retry_category,
            func.count(CompensationTask.id).label("count"),
        )
        .filter(
            CompensationTask.status.in_(
                [TaskStatus.WAITING_RETRY, TaskStatus.WAITING_MANUAL, TaskStatus.PERMANENT_FAILED]
            )
        )
        .group_by(CompensationTask.retry_category)
        .all()
    )

    result = {}
    for category, count in stats:
        if category:
            result[category] = count

    return {
        "total_waiting": sum(result.values()),
        "by_category": result,
    }


def get_dead_letter_stats(db: Session) -> Dict[str, Any]:
    dead_letter_tasks = (
        db.query(CompensationTask)
        .filter(CompensationTask.status == TaskStatus.PERMANENT_FAILED)
        .all()
    )

    by_source = {}
    by_retry_category = {}

    for task in dead_letter_tasks:
        by_source[task.source] = by_source.get(task.source, 0) + 1
        if task.retry_category:
            by_retry_category[task.retry_category] = by_retry_category.get(task.retry_category, 0) + 1

    return {
        "total": len(dead_letter_tasks),
        "by_source": by_source,
        "by_retry_category": by_retry_category,
    }


def get_recovery_pending_stats(db: Session) -> Dict[str, Any]:
    now = datetime.now()
    pending_retry_tasks = (
        db.query(CompensationTask)
        .filter(
            CompensationTask.status == TaskStatus.WAITING_RETRY,
            CompensationTask.next_retry_at <= now,
        )
        .all()
    )

    overdue_tasks = [
        task for task in pending_retry_tasks if task.next_retry_at and task.next_retry_at < now - timedelta(minutes=1)
    ]

    by_source = {}
    for task in pending_retry_tasks:
        by_source[task.source] = by_source.get(task.source, 0) + 1

    return {
        "pending_retry_count": len(pending_retry_tasks),
        "overdue_count": len(overdue_tasks),
        "by_source": by_source,
    }


def get_status_overview(db: Session) -> Dict[str, Any]:
    stats = (
        db.query(
            CompensationTask.status,
            func.count(CompensationTask.id).label("count"),
        )
        .group_by(CompensationTask.status)
        .all()
    )

    result = {status.value: 0 for status in TaskStatus}
    for status, count in stats:
        result[status] = count

    return result


def get_operation_dashboard(db: Session) -> Dict[str, Any]:
    return {
        "status_overview": get_status_overview(db),
        "retry_category_stats": get_retry_category_stats(db),
        "dead_letter_stats": get_dead_letter_stats(db),
        "recovery_pending_stats": get_recovery_pending_stats(db),
        "generated_at": datetime.now().isoformat(),
    }


def export_tasks_to_excel(db: Session, status: TaskStatus = None) -> BytesIO:
    import pandas as pd

    query = db.query(CompensationTask)
    if status:
        query = query.filter(CompensationTask.status == status)

    tasks = query.all()

    data = []
    for task in tasks:
        data.append({
            "任务编号": task.task_no,
            "幂等键": task.idempotency_key,
            "来源": task.source,
            "状态": task.status,
            "箱号": task.box_no,
            "司机ID": task.driver_id,
            "温度记录ID": task.temperature_record_id,
            "补偿金额": task.compensation_amount,
            "重试次数": task.retry_count,
            "最大重试次数": task.max_retry_count,
            "重试分类": task.retry_category,
            "最后错误": task.last_error,
            "下次重试时间": task.next_retry_at,
            "创建时间": task.created_at,
            "处理时间": task.processed_at,
            "关闭时间": task.closed_at,
        })

    df = pd.DataFrame(data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="任务列表")

    output.seek(0)
    return output


def export_dead_letter_to_excel(db: Session) -> BytesIO:
    import pandas as pd

    tasks = (
        db.query(CompensationTask)
        .filter(CompensationTask.status == TaskStatus.PERMANENT_FAILED)
        .all()
    )

    data = []
    for task in tasks:
        data.append({
            "任务编号": task.task_no,
            "来源": task.source,
            "箱号": task.box_no,
            "司机ID": task.driver_id,
            "补偿金额": task.compensation_amount,
            "重试次数": task.retry_count,
            "重试分类": task.retry_category,
            "最后错误": task.last_error,
            "创建时间": task.created_at,
        })

    df = pd.DataFrame(data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="死信队列")

    output.seek(0)
    return output


def export_retry_tasks_to_excel(db: Session) -> BytesIO:
    import pandas as pd

    now = datetime.now()
    tasks = (
        db.query(CompensationTask)
        .filter(
            CompensationTask.status == TaskStatus.WAITING_RETRY,
            CompensationTask.next_retry_at <= now,
        )
        .all()
    )

    data = []
    for task in tasks:
        data.append({
            "任务编号": task.task_no,
            "来源": task.source,
            "箱号": task.box_no,
            "重试次数": task.retry_count,
            "重试分类": task.retry_category,
            "最后错误": task.last_error,
            "计划重试时间": task.next_retry_at,
            "是否逾期": task.next_retry_at < now if task.next_retry_at else False,
        })

    df = pd.DataFrame(data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="待重试任务")

    output.seek(0)
    return output
