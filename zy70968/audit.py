from datetime import datetime
from sqlalchemy.orm import Session
from models import AuditLog, Batch
from schemas import AuditAction, BatchStatus


def log_audit(
    db: Session,
    batch_id: int,
    action: str,
    reason: str = None,
    handler: str = None,
    old_status: str = None,
    new_status: str = None,
    details: str = None,
):
    log = AuditLog(
        batch_id=batch_id,
        action=action,
        reason=reason,
        handler=handler,
        old_status=old_status,
        new_status=new_status,
        timestamp=datetime.utcnow(),
        details=details,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_audit_trail(db: Session, batch_id: int):
    logs = db.query(AuditLog).filter(
        AuditLog.batch_id == batch_id
    ).order_by(AuditLog.timestamp.asc()).all()
    return logs


def format_audit_trail(logs) -> list:
    result = []
    for log in logs:
        entry = {
            "time": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "action": log.action,
            "handler": log.handler or "系统",
            "reason": log.reason,
            "transition": f"{log.old_status or 'N/A'} → {log.new_status or 'N/A'}",
            "details": log.details,
        }
        result.append(entry)
    return result


def get_decision_explanation(db: Session, batch_id: int) -> str:
    logs = get_audit_trail(db, batch_id)
    if not logs:
        return "暂无处理记录。"

    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        return "批次不存在。"

    lines = [f"批次 {batch.batch_no} 处理说明:"]

    for log in logs:
        action_text = {
            AuditAction.CREATE: "创建",
            AuditAction.SUBMIT: "提交审核",
            AuditAction.PROCESS: "标记处理中",
            AuditAction.APPROVE: "审核通过",
            AuditAction.RETURN: "退回修改",
            AuditAction.SUPPLEMENT: "要求补充材料",
            AuditAction.UPDATE: "更新信息",
        }.get(log.action, log.action)

        line = f"  [{log.timestamp.strftime('%Y-%m-%d %H:%M')}] {log.handler or '系统'} {action_text}"
        if log.reason:
            line += f"，原因: {log.reason}"
        if log.old_status and log.new_status:
            line += f"（{log.old_status} → {log.new_status}）"
        if log.details:
            line += f"\n    详情: {log.details}"
        lines.append(line)

    lines.append("")
    lines.append(f"当前状态: {batch.status}")
    return "\n".join(lines)
