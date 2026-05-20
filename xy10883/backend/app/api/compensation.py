from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database import get_db
from app.models import (
    CompensationTask, AnomalyRecord, AnomalyStatus,
    ConfirmationHistory, IdempotentRequest, IgnoreReason,
    TicketLink, RecoveryEvent
)
from app.schemas import CompensationTaskCreate, CompensationTask as CompensationTaskSchema

router = APIRouter()


@router.post("/tasks", response_model=CompensationTaskSchema)
async def create_compensation_task(task: CompensationTaskCreate, db: Session = Depends(get_db)):
    db_task = CompensationTask(**task.model_dump(), status="pending")
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.get("/tasks", response_model=List[CompensationTaskSchema])
async def get_compensation_tasks(status: str = None, db: Session = Depends(get_db)):
    query = db.query(CompensationTask)
    if status:
        query = query.filter(CompensationTask.status == status)
    return query.order_by(CompensationTask.created_at.desc()).all()


def fix_status_inconsistency_single(anomaly: AnomalyRecord, db: Session) -> dict:
    """修复单条异常的状态不一致问题"""
    changes = []

    if anomaly.status == AnomalyStatus.PENDING and anomaly.confirmed_at is not None:
        anomaly.status = AnomalyStatus.CONFIRMED
        changes.append(f"状态从 pending 修正为 confirmed（因为有 confirmed_at）")

    if anomaly.status == AnomalyStatus.CONFIRMED and anomaly.confirmed_at is None:
        anomaly.confirmed_at = anomaly.detected_at
        changes.append(f"设置 confirmed_at 为 {anomaly.detected_at}（因为状态是 confirmed）")

    if anomaly.status == AnomalyStatus.RECOVERED and anomaly.recovered_at is None:
        anomaly.recovered_at = datetime.utcnow()
        changes.append(f"设置 recovered_at 为当前时间（因为状态是 recovered）")

    if anomaly.status == AnomalyStatus.CLOSED and anomaly.closed_at is None:
        anomaly.closed_at = datetime.utcnow()
        changes.append(f"设置 closed_at 为当前时间（因为状态是 closed）")

    if anomaly.status == AnomalyStatus.TICKETED:
        has_ticket = db.query(TicketLink).filter(TicketLink.anomaly_id == anomaly.id).first()
        if not has_ticket:
            pass

    if anomaly.recovered_at is not None and anomaly.status not in [AnomalyStatus.RECOVERED, AnomalyStatus.CLOSED]:
        anomaly.status = AnomalyStatus.RECOVERED
        changes.append(f"状态修正为 recovered（因为有 recovered_at）")

    if anomaly.closed_at is not None and anomaly.status != AnomalyStatus.CLOSED:
        anomaly.status = AnomalyStatus.CLOSED
        changes.append(f"状态修正为 closed（因为有 closed_at）")

    return {"anomaly_id": anomaly.id, "changes": changes}


def rebuild_history_single(anomaly: AnomalyRecord, db: Session) -> dict:
    """重建单条异常的操作历史"""
    changes = []
    history_count = db.query(ConfirmationHistory).filter(ConfirmationHistory.anomaly_id == anomaly.id).count()

    if history_count == 0:
        timestamp = anomaly.detected_at
        base_history = ConfirmationHistory(
            anomaly_id=anomaly.id,
            operator_id="system",
            operator_name="系统补偿",
            previous_status=None,
            new_status=AnomalyStatus.PENDING,
            comment="重建历史记录：异常检测创建",
            timestamp=timestamp
        )
        db.add(base_history)
        changes.append("创建初始检测历史记录")

        if anomaly.confirmed_at and anomaly.status in [AnomalyStatus.CONFIRMED, AnomalyStatus.TICKETED, AnomalyStatus.RECOVERED, AnomalyStatus.CLOSED]:
            confirm_history = ConfirmationHistory(
                anomaly_id=anomaly.id,
                operator_id="system",
                operator_name="系统补偿",
                previous_status=AnomalyStatus.PENDING,
                new_status=AnomalyStatus.CONFIRMED,
                comment="重建历史记录：异常确认",
                timestamp=anomaly.confirmed_at
            )
            db.add(confirm_history)
            changes.append("创建确认历史记录")

        if anomaly.recovered_at and anomaly.status in [AnomalyStatus.RECOVERED, AnomalyStatus.CLOSED]:
            recover_history = ConfirmationHistory(
                anomaly_id=anomaly.id,
                operator_id="system",
                operator_name="系统补偿",
                previous_status=anomaly.status,
                new_status=AnomalyStatus.RECOVERED,
                comment="重建历史记录：异常恢复",
                timestamp=anomaly.recovered_at
            )
            db.add(recover_history)
            changes.append("创建恢复历史记录")

        if anomaly.closed_at:
            close_history = ConfirmationHistory(
                anomaly_id=anomaly.id,
                operator_id="system",
                operator_name="系统补偿",
                previous_status=anomaly.status,
                new_status=AnomalyStatus.CLOSED,
                comment="重建历史记录：异常关闭",
                timestamp=anomaly.closed_at
            )
            db.add(close_history)
            changes.append("创建关闭历史记录")

    return {"anomaly_id": anomaly.id, "history_count_before": history_count, "changes": changes}


def sync_ticket_status_single(anomaly: AnomalyRecord, db: Session) -> dict:
    """同步单条异常的工单状态"""
    changes = []
    tickets = db.query(TicketLink).filter(TicketLink.anomaly_id == anomaly.id).all()

    for ticket in tickets:
        if ticket.ticket_status == "resolved" and anomaly.status == AnomalyStatus.TICKETED:
            anomaly.status = AnomalyStatus.RECOVERED
            anomaly.recovered_at = datetime.utcnow()
            changes.append(f"工单 {ticket.ticket_id} 已解决，异常状态更新为 recovered")

            history = ConfirmationHistory(
                anomaly_id=anomaly.id,
                operator_id="system",
                operator_name="工单同步",
                previous_status=AnomalyStatus.TICKETED,
                new_status=AnomalyStatus.RECOVERED,
                comment=f"工单 {ticket.ticket_id} 已解决，自动更新异常状态",
                timestamp=datetime.utcnow()
            )
            db.add(history)

        if ticket.ticket_status == "closed" and anomaly.status == AnomalyStatus.RECOVERED:
            anomaly.status = AnomalyStatus.CLOSED
            anomaly.closed_at = datetime.utcnow()
            changes.append(f"工单 {ticket.ticket_id} 已关闭，异常状态更新为 closed")

    return {"anomaly_id": anomaly.id, "ticket_count": len(tickets), "changes": changes}


def remove_duplicate_history_single(anomaly: AnomalyRecord, db: Session) -> dict:
    """移除单条异常的重复历史记录"""
    changes = []
    histories = db.query(ConfirmationHistory).filter(
        ConfirmationHistory.anomaly_id == anomaly.id
    ).order_by(ConfirmationHistory.timestamp).all()

    seen = set()
    duplicates = []

    for history in histories:
        key = (history.previous_status, history.new_status, history.operator_id, history.comment or "")
        if key in seen:
            duplicates.append(history)
        else:
            seen.add(key)

    for dup in duplicates:
        db.delete(dup)
        changes.append(f"删除重复历史记录 ID={dup.id}")

    return {"anomaly_id": anomaly.id, "removed_count": len(duplicates), "changes": changes}


@router.post("/tasks/{task_id}/execute")
async def execute_compensation_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(CompensationTask).filter(CompensationTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="补偿任务不存在")

    if task.status not in ["pending", "failed"]:
        raise HTTPException(status_code=400, detail=f"任务当前状态 '{task.status}' 无法执行")

    task.status = "running"
    task.executed_at = datetime.utcnow()
    db.commit()

    try:
        result_details = []

        if task.task_type == "fix_status_inconsistency":
            if task.anomaly_id:
                anomaly = db.query(AnomalyRecord).filter(AnomalyRecord.id == task.anomaly_id).first()
                if anomaly:
                    result = fix_status_inconsistency_single(anomaly, db)
                    result_details.append(result)
            else:
                anomalies = db.query(AnomalyRecord).all()
                for anomaly in anomalies:
                    result = fix_status_inconsistency_single(anomaly, db)
                    if result["changes"]:
                        result_details.append(result)

        elif task.task_type == "rebuild_history":
            if task.anomaly_id:
                anomaly = db.query(AnomalyRecord).filter(AnomalyRecord.id == task.anomaly_id).first()
                if anomaly:
                    result = rebuild_history_single(anomaly, db)
                    result_details.append(result)
            else:
                anomalies = db.query(AnomalyRecord).all()
                for anomaly in anomalies:
                    result = rebuild_history_single(anomaly, db)
                    if result["changes"]:
                        result_details.append(result)

        elif task.task_type == "sync_ticket_status":
            if task.anomaly_id:
                anomaly = db.query(AnomalyRecord).filter(AnomalyRecord.id == task.anomaly_id).first()
                if anomaly:
                    result = sync_ticket_status_single(anomaly, db)
                    result_details.append(result)
            else:
                anomalies = db.query(AnomalyRecord).filter(AnomalyRecord.status == AnomalyStatus.TICKETED).all()
                for anomaly in anomalies:
                    result = sync_ticket_status_single(anomaly, db)
                    if result["changes"]:
                        result_details.append(result)

        elif task.task_type == "remove_duplicate_history":
            if task.anomaly_id:
                anomaly = db.query(AnomalyRecord).filter(AnomalyRecord.id == task.anomaly_id).first()
                if anomaly:
                    result = remove_duplicate_history_single(anomaly, db)
                    result_details.append(result)
            else:
                anomalies = db.query(AnomalyRecord).all()
                for anomaly in anomalies:
                    result = remove_duplicate_history_single(anomaly, db)
                    if result["changes"]:
                        result_details.append(result)

        else:
            raise HTTPException(status_code=400, detail=f"不支持的任务类型: {task.task_type}")

        db.commit()

        task.status = "completed"
        task.completed_at = datetime.utcnow()
        task.task_description = f"处理了 {len(result_details)} 条记录"
        db.commit()

        return {
            "success": True,
            "task_id": task_id,
            "message": f"补偿任务执行成功，处理了 {len(result_details)} 条记录",
            "details": result_details
        }

    except Exception as e:
        task.status = "failed"
        task.retry_count += 1
        task.last_error = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=f"执行失败: {str(e)}")


@router.post("/anomalies/{anomaly_id}/repair")
async def repair_anomaly(anomaly_id: int, repair_type: str, db: Session = Depends(get_db)):
    anomaly = db.query(AnomalyRecord).filter(AnomalyRecord.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="异常记录不存在")

    result = {"anomaly_id": anomaly_id, "repair_type": repair_type}

    if repair_type == "reset_status":
        old_status = anomaly.status
        anomaly.status = AnomalyStatus.PENDING
        anomaly.confirmed_at = None
        anomaly.recovered_at = None
        anomaly.closed_at = None
        db.commit()
        result["old_status"] = old_status
        result["new_status"] = AnomalyStatus.PENDING
        result["message"] = "状态已重置为待处理"

    elif repair_type == "fix_missing_timestamps":
        fixed_fields = []
        if anomaly.status == AnomalyStatus.CONFIRMED and not anomaly.confirmed_at:
            anomaly.confirmed_at = anomaly.detected_at
            fixed_fields.append("confirmed_at")
        if anomaly.status == AnomalyStatus.RECOVERED and not anomaly.recovered_at:
            anomaly.recovered_at = datetime.utcnow()
            fixed_fields.append("recovered_at")
        if anomaly.status == AnomalyStatus.CLOSED and not anomaly.closed_at:
            anomaly.closed_at = datetime.utcnow()
            fixed_fields.append("closed_at")
        db.commit()
        result["fixed_fields"] = fixed_fields
        result["message"] = f"修复了 {len(fixed_fields)} 个缺失的时间戳"

    elif repair_type == "remove_duplicate_history":
        fix_result = remove_duplicate_history_single(anomaly, db)
        db.commit()
        result.update(fix_result)

    elif repair_type == "rebuild_history":
        fix_result = rebuild_history_single(anomaly, db)
        db.commit()
        result.update(fix_result)

    elif repair_type == "fix_status_inconsistency":
        fix_result = fix_status_inconsistency_single(anomaly, db)
        db.commit()
        result.update(fix_result)

    else:
        raise HTTPException(status_code=400, detail=f"不支持的修复类型: {repair_type}")

    return result


@router.post("/cleanup/dirty_data")
async def cleanup_dirty_data(db: Session = Depends(get_db)):
    cleanup_result = {
        "deleted_expired_idempotent_requests": 0,
        "deleted_orphan_confirmations": 0,
        "deleted_orphan_ignores": 0,
        "deleted_orphan_tickets": 0,
        "deleted_orphan_recoveries": 0,
        "fixed_missing_timestamps": 0,
        "fixed_status_inconsistencies": 0
    }

    expired_cutoff = datetime.utcnow() - timedelta(days=7)
    expired_requests = db.query(IdempotentRequest).filter(
        IdempotentRequest.expires_at < expired_cutoff
    ).all()
    cleanup_result["deleted_expired_idempotent_requests"] = len(expired_requests)
    for req in expired_requests:
        db.delete(req)

    orphan_confirmations = db.query(ConfirmationHistory).filter(
        ~ConfirmationHistory.anomaly_id.in_(
            db.query(AnomalyRecord.id)
        )
    ).all()
    cleanup_result["deleted_orphan_confirmations"] = len(orphan_confirmations)
    for h in orphan_confirmations:
        db.delete(h)

    orphan_ignores = db.query(IgnoreReason).filter(
        ~IgnoreReason.anomaly_id.in_(db.query(AnomalyRecord.id))
    ).all()
    cleanup_result["deleted_orphan_ignores"] = len(orphan_ignores)
    for r in orphan_ignores:
        db.delete(r)

    orphan_tickets = db.query(TicketLink).filter(
        ~TicketLink.anomaly_id.in_(db.query(AnomalyRecord.id))
    ).all()
    cleanup_result["deleted_orphan_tickets"] = len(orphan_tickets)
    for t in orphan_tickets:
        db.delete(t)

    orphan_recoveries = db.query(RecoveryEvent).filter(
        ~RecoveryEvent.anomaly_id.in_(db.query(AnomalyRecord.id))
    ).all()
    cleanup_result["deleted_orphan_recoveries"] = len(orphan_recoveries)
    for r in orphan_recoveries:
        db.delete(r)

    anomalies = db.query(AnomalyRecord).all()
    for anomaly in anomalies:
        ts_fixed = False
        if anomaly.status == AnomalyStatus.CONFIRMED and not anomaly.confirmed_at:
            anomaly.confirmed_at = anomaly.detected_at
            ts_fixed = True
        if anomaly.status == AnomalyStatus.RECOVERED and not anomaly.recovered_at:
            anomaly.recovered_at = datetime.utcnow()
            ts_fixed = True
        if anomaly.status == AnomalyStatus.CLOSED and not anomaly.closed_at:
            anomaly.closed_at = datetime.utcnow()
            ts_fixed = True
        if ts_fixed:
            cleanup_result["fixed_missing_timestamps"] += 1

        si_fixed = False
        if anomaly.status == AnomalyStatus.PENDING and anomaly.confirmed_at:
            anomaly.status = AnomalyStatus.CONFIRMED
            si_fixed = True
        if anomaly.recovered_at and anomaly.status not in [AnomalyStatus.RECOVERED, AnomalyStatus.CLOSED]:
            anomaly.status = AnomalyStatus.RECOVERED
            si_fixed = True
        if anomaly.closed_at and anomaly.status != AnomalyStatus.CLOSED:
            anomaly.status = AnomalyStatus.CLOSED
            si_fixed = True
        if si_fixed:
            cleanup_result["fixed_status_inconsistencies"] += 1

    db.commit()

    total_cleaned = sum(cleanup_result.values())
    cleanup_result["total_cleaned"] = total_cleaned
    cleanup_result["message"] = f"脏数据清理完成，共处理 {total_cleaned} 项"

    return cleanup_result


@router.get("/health/status")
async def get_system_health(db: Session = Depends(get_db)):
    status_counts = db.query(
        AnomalyRecord.status,
        func.count(AnomalyRecord.id)
    ).group_by(AnomalyRecord.status).all()

    status_counts_dict = dict(status_counts)

    pending_count = status_counts_dict.get(AnomalyStatus.PENDING, 0)

    oldest_pending = db.query(AnomalyRecord.detected_at).filter(
        AnomalyRecord.status == AnomalyStatus.PENDING
    ).order_by(AnomalyRecord.detected_at.asc()).first()
    pending_max_aging_hours = None
    if oldest_pending:
        delta = datetime.utcnow() - oldest_pending[0]
        pending_max_aging_hours = delta.total_seconds() / 3600

    orphan_count = db.query(ConfirmationHistory).filter(
        ~ConfirmationHistory.anomaly_id.in_(db.query(AnomalyRecord.id))
    ).count()

    expired_idempotent = db.query(IdempotentRequest).filter(
        IdempotentRequest.expires_at < datetime.utcnow()
    ).count()

    health_warnings = []
    if pending_count >= 100:
        health_warnings.append(f"待处理异常过多: {pending_count}")
    if orphan_count > 0:
        health_warnings.append(f"存在孤立记录: {orphan_count}")
    if expired_idempotent > 0:
        health_warnings.append(f"存在过期幂等请求: {expired_idempotent}")

    return {
        "anomaly_status_counts": status_counts_dict,
        "pending_anomalies": pending_count,
        "pending_max_aging_hours": round(pending_max_aging_hours, 2) if pending_max_aging_hours else None,
        "orphan_records": orphan_count,
        "expired_idempotent_requests": expired_idempotent,
        "is_healthy": pending_count < 100 and orphan_count == 0,
        "health_warnings": health_warnings,
        "compensation_tasks_pending": db.query(CompensationTask).filter(CompensationTask.status == "pending").count(),
        "compensation_tasks_failed": db.query(CompensationTask).filter(CompensationTask.status == "failed").count()
    }
