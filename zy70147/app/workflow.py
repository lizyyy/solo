from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.models import (
    ConfigVersion, GrayscaleRule, ApprovalRequest, InstanceAck, AuditLog
)
from app.schemas import (
    ApprovalRequestCreate, ApprovalAction, InstanceAckCreate, RollbackRequest,
    ConfigResolveResponse, GrayscaleMatchResponse
)
from app.services import (
    ResourceLockService, AuditService, ConfigVersionService, 
    GrayscaleRuleService, GrayscaleEngine
)

class ApprovalService:
    @staticmethod
    def create_request(db: Session, data: ApprovalRequestCreate) -> ApprovalRequest:
        rule = db.query(GrayscaleRule).filter(
            GrayscaleRule.id == data.rule_id
        ).first()
        
        if not rule:
            raise ValueError("灰度规则不存在")
        
        if rule.status != "draft":
            raise ValueError(f"规则状态为 {rule.status}，无法发起审批")
        
        existing_pending = db.query(ApprovalRequest).filter(
            ApprovalRequest.rule_id == data.rule_id,
            ApprovalRequest.status == "pending"
        ).first()
        
        if existing_pending:
            raise ValueError("该规则已有待审批的申请")
        
        resource_key = f"approval_rule:{data.rule_id}"
        lock_token = ResourceLockService.acquire_lock(db, resource_key, data.applicant)
        
        if not lock_token:
            raise ValueError("规则正在被其他操作占用")
        
        try:
            approval = ApprovalRequest(
                rule_id=data.rule_id,
                title=data.title,
                applicant=data.applicant,
                approver=data.approver,
                status="pending"
            )
            db.add(approval)
            
            rule.status = "pending"
            db.commit()
            db.refresh(approval)
            
            AuditService.log(
                db, "create_approval", data.applicant,
                rule_id=data.rule_id,
                approval_id=approval.id,
                details={"title": data.title}
            )
            
            return approval
        finally:
            ResourceLockService.release_lock(db, resource_key, lock_token)
    
    @staticmethod
    def process_approval(db: Session, action: ApprovalAction) -> ApprovalRequest:
        approval = db.query(ApprovalRequest).filter(
            ApprovalRequest.id == action.approval_id
        ).first()
        
        if not approval:
            raise ValueError("审批请求不存在")
        
        if approval.status != "pending":
            raise ValueError(f"审批状态为 {approval.status}，无法处理")
        
        rule = db.query(GrayscaleRule).filter(
            GrayscaleRule.id == approval.rule_id
        ).first()
        
        if not rule:
            raise ValueError("关联规则不存在")
        
        resource_key = f"approval_process:{action.approval_id}"
        lock_token = ResourceLockService.acquire_lock(db, resource_key, action.operator)
        
        if not lock_token:
            raise ValueError("审批正在被处理中")
        
        try:
            approval.comment = action.comment
            approval.approval_at = datetime.utcnow()
            
            if action.approved:
                approval.status = "approved"
                rule.status = "released"
                
                old_rules = db.query(GrayscaleRule).filter(
                    GrayscaleRule.id != rule.id,
                    GrayscaleRule.status == "released"
                ).all()
                
                for old_rule in old_rules:
                    old_rule.status = "superseded"
                
                AuditService.log(
                    db, "approve_release", action.operator,
                    rule_id=rule.id,
                    approval_id=approval.id,
                    details={
                        "percentage": rule.percentage,
                        "idc_list": rule.idc_list,
                        "tenant_list": rule.tenant_list
                    }
                )
            else:
                approval.status = "rejected"
                rule.status = "draft"
                
                AuditService.log(
                    db, "reject_release", action.operator,
                    rule_id=rule.id,
                    approval_id=approval.id,
                    details={"comment": action.comment}
                )
            
            db.commit()
            db.refresh(approval)
            
            return approval
        finally:
            ResourceLockService.release_lock(db, resource_key, lock_token)

class InstanceAckService:
    @staticmethod
    def record_ack(db: Session, data: InstanceAckCreate) -> InstanceAck:
        rule = db.query(GrayscaleRule).filter(
            GrayscaleRule.id == data.rule_id
        ).first()
        
        if not rule:
            raise ValueError("灰度规则不存在")
        
        existing = db.query(InstanceAck).filter(
            InstanceAck.rule_id == data.rule_id,
            InstanceAck.instance_id == data.instance_id
        ).first()
        
        if existing and existing.status != "pending":
            raise ValueError(f"实例 {data.instance_id} 已回执过，状态: {existing.status}")
        
        resource_key = f"ack_rule:{data.rule_id}:{data.instance_id}"
        lock_token = ResourceLockService.acquire_lock(db, resource_key, data.instance_id)
        
        if not lock_token:
            raise ValueError("回执正在处理中")
        
        try:
            if existing:
                ack = existing
            else:
                ack = InstanceAck(
                    rule_id=data.rule_id,
                    instance_id=data.instance_id,
                    idc=data.idc,
                    tenant=data.tenant
                )
                db.add(ack)
            
            ack.status = "success" if data.success else "failed"
            ack.ack_content = data.ack_content
            ack.ack_at = datetime.utcnow()
            
            db.commit()
            db.refresh(ack)
            
            AuditService.log(
                db, "instance_ack", data.instance_id,
                rule_id=data.rule_id,
                details={
                    "instance_id": data.instance_id,
                    "status": ack.status
                }
            )
            
            if not data.success:
                try:
                    rollback_service = RollbackService()
                    rollback_service.trigger_auto_rollback(
                        db, data.rule_id, "system",
                        f"实例 {data.instance_id} 回执失败"
                    )
                except Exception as e:
                    pass
            
            return ack
        finally:
            ResourceLockService.release_lock(db, resource_key, lock_token)
    
    @staticmethod
    def get_stats(db: Session, rule_id: int) -> Dict[str, Any]:
        total = db.query(InstanceAck).filter(
            InstanceAck.rule_id == rule_id
        ).count()
        
        success = db.query(InstanceAck).filter(
            InstanceAck.rule_id == rule_id,
            InstanceAck.status == "success"
        ).count()
        
        failed = db.query(InstanceAck).filter(
            InstanceAck.rule_id == rule_id,
            InstanceAck.status == "failed"
        ).count()
        
        pending = db.query(InstanceAck).filter(
            InstanceAck.rule_id == rule_id,
            InstanceAck.status == "pending"
        ).count()
        
        return {
            "rule_id": rule_id,
            "total": total,
            "success": success,
            "failed": failed,
            "pending": pending,
            "success_rate": round(success / total * 100, 2) if total > 0 else 0
        }

class RollbackService:
    @staticmethod
    def trigger_rollback(db: Session, data: RollbackRequest) -> bool:
        rule = db.query(GrayscaleRule).filter(
            GrayscaleRule.id == data.rule_id
        ).first()
        
        if not rule:
            raise ValueError("灰度规则不存在")
        
        if rule.status not in ["released", "superseded"]:
            raise ValueError(f"规则状态为 {rule.status}，无法回滚")
        
        approval = db.query(ApprovalRequest).filter(
            ApprovalRequest.rule_id == data.rule_id,
            ApprovalRequest.status == "approved"
        ).order_by(ApprovalRequest.approval_at.desc()).first()
        
        resource_key = f"rollback_rule:{data.rule_id}"
        lock_token = ResourceLockService.acquire_lock(db, resource_key, data.operator)
        
        if not lock_token:
            raise ValueError("回滚正在进行中")
        
        try:
            rule.status = "rolled_back"
            
            if approval:
                approval.rollback_reason = data.reason
                approval.rollback_at = datetime.utcnow()
            
            db.commit()
            
            AuditService.log(
                db, "manual_rollback", data.operator,
                rule_id=data.rule_id,
                approval_id=approval.id if approval else None,
                details={"reason": data.reason}
            )
            
            return True
        finally:
            ResourceLockService.release_lock(db, resource_key, lock_token)
    
    @staticmethod
    def trigger_auto_rollback(db: Session, rule_id: int, 
                               operator: str, reason: str) -> bool:
        rule = db.query(GrayscaleRule).filter(
            GrayscaleRule.id == rule_id,
            GrayscaleRule.status == "released"
        ).first()
        
        if not rule:
            return False
        
        existing_rollback = db.query(AuditLog).filter(
            AuditLog.rule_id == rule_id,
            AuditLog.action.in_(["manual_rollback", "auto_rollback"])
        ).first()
        
        if existing_rollback:
            return False
        
        resource_key = f"rollback_rule:{rule_id}"
        lock_token = ResourceLockService.acquire_lock(db, resource_key, operator)
        
        if not lock_token:
            return False
        
        try:
            rule.status = "rolled_back"
            
            approval = db.query(ApprovalRequest).filter(
                ApprovalRequest.rule_id == rule_id,
                ApprovalRequest.status == "approved"
            ).order_by(ApprovalRequest.approval_at.desc()).first()
            
            if approval:
                approval.rollback_reason = reason
                approval.rollback_at = datetime.utcnow()
            
            db.commit()
            
            AuditService.log(
                db, "auto_rollback", operator,
                rule_id=rule_id,
                approval_id=approval.id if approval else None,
                details={"reason": reason}
            )
            
            return True
        finally:
            ResourceLockService.release_lock(db, resource_key, lock_token)

class ConfigResolver:
    @staticmethod
    def resolve(db: Session, config_key: str, 
                idc: Optional[str], tenant: Optional[str],
                instance_id: str) -> ConfigResolveResponse:
        active_rules = GrayscaleRuleService.get_active_rules_by_config(db, config_key)
        
        for rule in active_rules:
            result = GrayscaleEngine.check_match(
                db, rule, idc, tenant, instance_id
            )
            
            if result.should_apply:
                config = db.query(ConfigVersion).filter(
                    ConfigVersion.id == rule.config_version_id
                ).first()
                
                if config:
                    return ConfigResolveResponse(
                        config_key=config.config_key,
                        version=config.version,
                        content=config.content,
                        source=f"grayscale_rule:{rule.id}"
                    )
        
        active_config = ConfigVersionService.get_active(db, config_key)
        
        if active_config:
            return ConfigResolveResponse(
                config_key=active_config.config_key,
                version=active_config.version,
                content=active_config.content,
                source="active_version"
            )
        
        latest = db.query(ConfigVersion).filter(
            ConfigVersion.config_key == config_key
        ).order_by(ConfigVersion.created_at.desc()).first()
        
        if latest:
            return ConfigResolveResponse(
                config_key=latest.config_key,
                version=latest.version,
                content=latest.content,
                source="latest_version"
            )
        
        raise ValueError(f"配置 {config_key} 不存在")
