from sqlalchemy.orm import Session
from typing import Optional, List, Dict
from datetime import datetime
from ..models.models import AuditLog, RuleStatus, TermRule
import json


class AuditService:
    @staticmethod
    def log_transition(
        db: Session,
        rule_id: int,
        action: str,
        from_status: Optional[RuleStatus],
        to_status: Optional[RuleStatus],
        actor: str,
        reason: Optional[str] = None,
        details: Optional[Dict] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        audit_log = AuditLog(
            rule_id=rule_id,
            action=action,
            from_status=from_status,
            to_status=to_status,
            actor=actor,
            timestamp=datetime.utcnow(),
            reason=reason,
            details=json.dumps(details, ensure_ascii=False) if details else None,
            ip_address=ip_address
        )
        db.add(audit_log)
        db.flush()
        return audit_log

    @staticmethod
    def log_action(
        db: Session,
        rule_id: int,
        action: str,
        actor: str,
        reason: Optional[str] = None,
        details: Optional[Dict] = None
    ) -> AuditLog:
        return AuditService.log_transition(
            db=db,
            rule_id=rule_id,
            action=action,
            from_status=None,
            to_status=None,
            actor=actor,
            reason=reason,
            details=details
        )

    @staticmethod
    def get_rule_history(db: Session, rule_id: int, limit: int = 100) -> List[AuditLog]:
        return (
            db.query(AuditLog)
            .filter(AuditLog.rule_id == rule_id)
            .order_by(AuditLog.timestamp.desc())
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_actor_history(db: Session, actor: str, limit: int = 100) -> List[AuditLog]:
        return (
            db.query(AuditLog)
            .filter(AuditLog.actor == actor)
            .order_by(AuditLog.timestamp.desc())
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_recent_changes(db: Session, hours: int = 24) -> List[AuditLog]:
        cutoff_time = datetime.utcnow() - datetime.timedelta(hours=hours)
        return (
            db.query(AuditLog)
            .filter(AuditLog.timestamp >= cutoff_time)
            .order_by(AuditLog.timestamp.desc())
            .all()
        )

    @staticmethod
    def format_audit_log_for_display(log: AuditLog) -> Dict:
        def status_display(status):
            if status is None:
                return "无"
            displays = {
                RuleStatus.DRAFT: "草稿",
                RuleStatus.PENDING_REVIEW: "待审核",
                RuleStatus.REVIEW_REJECTED: "审核驳回",
                RuleStatus.PENDING_GRAY: "待灰度",
                RuleStatus.IN_GRAY: "灰度中",
                RuleStatus.GRAY_REJECTED: "灰度不通过",
                RuleStatus.PRODUCTION: "生产生效",
                RuleStatus.ROLLED_BACK: "已回滚",
                RuleStatus.DEPRECATED: "已废弃"
            }
            return displays.get(status, status.value)

        action_display = {
            "CREATE": "创建规则",
            "UPDATE": "更新规则",
            "SUBMIT_REVIEW": "提交审核",
            "APPROVE_REVIEW": "审核通过",
            "REJECT_REVIEW": "审核驳回",
            "START_GRAY": "开始灰度",
            "APPROVE_GRAY": "灰度通过",
            "REJECT_GRAY": "灰度不通过",
            "ROLLBACK": "回滚",
            "DEPRECATE": "废弃",
            "EXPORT": "导出"
        }

        return {
            "id": log.id,
            "rule_id": log.rule_id,
            "action": log.action,
            "action_display": action_display.get(log.action, log.action),
            "from_status": log.from_status.value if log.from_status else None,
            "from_status_display": status_display(log.from_status),
            "to_status": log.to_status.value if log.to_status else None,
            "to_status_display": status_display(log.to_status),
            "actor": log.actor,
            "timestamp": log.timestamp.isoformat(),
            "reason": log.reason,
            "details": log.details,
            "summary": AuditService._generate_log_summary(log)
        }

    @staticmethod
    def _generate_log_summary(log: AuditLog) -> str:
        status_display = {
            RuleStatus.DRAFT: "草稿",
            RuleStatus.PENDING_REVIEW: "待审核",
            RuleStatus.REVIEW_REJECTED: "审核驳回",
            RuleStatus.PENDING_GRAY: "待灰度",
            RuleStatus.IN_GRAY: "灰度中",
            RuleStatus.GRAY_REJECTED: "灰度不通过",
            RuleStatus.PRODUCTION: "生产生效",
            RuleStatus.ROLLED_BACK: "已回滚",
            RuleStatus.DEPRECATED: "已废弃"
        }
        
        if log.from_status and log.to_status:
            from_disp = status_display.get(log.from_status, log.from_status.value)
            to_disp = status_display.get(log.to_status, log.to_status.value)
            return f"{log.actor} 将规则从「{from_disp}」流转到「{to_disp}」"
        elif log.action == "CREATE":
            return f"{log.actor} 创建了规则"
        elif log.action == "UPDATE":
            return f"{log.actor} 更新了规则信息"
        else:
            return f"{log.actor} 执行了 {log.action} 操作"
