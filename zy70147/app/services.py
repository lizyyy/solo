from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import uuid
import hashlib

from app.models import (
    ConfigVersion, GrayscaleRule, ApprovalRequest, InstanceAck, AuditLog, ResourceLock
)
from app.schemas import (
    ConfigVersionCreate, GrayscaleRuleCreate, ApprovalRequestCreate,
    ApprovalAction, InstanceAckCreate, RollbackRequest, GrayscaleMatchResponse
)

class ResourceLockService:
    LOCK_DURATION = timedelta(minutes=5)
    
    @staticmethod
    def acquire_lock(db: Session, resource_key: str, operator: str) -> Optional[str]:
        now = datetime.utcnow()
        
        db.query(ResourceLock).filter(
            ResourceLock.expires_at < now
        ).delete(synchronize_session=False)
        db.commit()
        
        existing = db.query(ResourceLock).filter(
            ResourceLock.resource_key == resource_key
        ).first()
        
        if existing:
            return None
        
        lock_token = uuid.uuid4().hex
        lock = ResourceLock(
            resource_key=resource_key,
            lock_token=lock_token,
            acquired_by=operator,
            acquired_at=now,
            expires_at=now + ResourceLockService.LOCK_DURATION
        )
        db.add(lock)
        try:
            db.commit()
            return lock_token
        except:
            db.rollback()
            return None
    
    @staticmethod
    def release_lock(db: Session, resource_key: str, lock_token: str) -> bool:
        lock = db.query(ResourceLock).filter(
            ResourceLock.resource_key == resource_key,
            ResourceLock.lock_token == lock_token
        ).first()
        
        if lock:
            db.delete(lock)
            db.commit()
            return True
        return False

class AuditService:
    @staticmethod
    def log(db: Session, action: str, operator: str, 
            rule_id: Optional[int] = None, 
            approval_id: Optional[int] = None,
            details: Optional[Dict[str, Any]] = None):
        audit = AuditLog(
            rule_id=rule_id,
            approval_id=approval_id,
            action=action,
            operator=operator,
            details=details
        )
        db.add(audit)
        db.commit()

class ConfigVersionService:
    @staticmethod
    def create(db: Session, data: ConfigVersionCreate) -> ConfigVersion:
        resource_key = f"config:{data.config_key}"
        lock_token = ResourceLockService.acquire_lock(db, resource_key, data.created_by)
        
        if not lock_token:
            raise ValueError(f"配置 {data.config_key} 正在被其他操作占用，请稍后再试")
        
        try:
            existing = db.query(ConfigVersion).filter(
                ConfigVersion.config_key == data.config_key,
                ConfigVersion.version == data.version
            ).first()
            
            if existing:
                raise ValueError(f"配置版本 {data.config_key}@{data.version} 已存在")
            
            config = ConfigVersion(
                config_key=data.config_key,
                version=data.version,
                content=data.content,
                description=data.description,
                created_by=data.created_by
            )
            db.add(config)
            db.commit()
            db.refresh(config)
            
            AuditService.log(
                db, "create_config_version", data.created_by,
                details={
                    "config_key": data.config_key,
                    "version": data.version
                }
            )
            
            return config
        finally:
            ResourceLockService.release_lock(db, resource_key, lock_token)
    
    @staticmethod
    def get_active(db: Session, config_key: str) -> Optional[ConfigVersion]:
        return db.query(ConfigVersion).filter(
            ConfigVersion.config_key == config_key,
            ConfigVersion.is_active == True
        ).first()
    
    @staticmethod
    def activate(db: Session, config_id: int, operator: str) -> bool:
        config = db.query(ConfigVersion).filter(
            ConfigVersion.id == config_id
        ).first()
        
        if not config:
            raise ValueError("配置版本不存在")
        
        resource_key = f"config:{config.config_key}"
        lock_token = ResourceLockService.acquire_lock(db, resource_key, operator)
        
        if not lock_token:
            raise ValueError(f"配置 {config.config_key} 正在被其他操作占用，请稍后再试")
        
        try:
            db.query(ConfigVersion).filter(
                ConfigVersion.config_key == config.config_key
            ).update({"is_active": False}, synchronize_session=False)
            
            config.is_active = True
            db.commit()
            
            AuditService.log(
                db, "activate_config", operator,
                details={
                    "config_key": config.config_key,
                    "version": config.version
                }
            )
            
            return True
        finally:
            ResourceLockService.release_lock(db, resource_key, lock_token)

class GrayscaleEngine:
    @staticmethod
    def _hash_instance(instance_id: str, rule_id: int) -> int:
        data = f"{instance_id}:{rule_id}"
        return int(hashlib.md5(data.encode()).hexdigest(), 16) % 10000
    
    @staticmethod
    def check_match(db: Session, rule: GrayscaleRule, 
                    idc: Optional[str], tenant: Optional[str], 
                    instance_id: str) -> GrayscaleMatchResponse:
        if rule.status != "released":
            return GrayscaleMatchResponse(
                should_apply=False,
                reason="规则未发布"
            )
        
        idc_match = True
        if rule.idc_list:
            idc_match = idc in rule.idc_list if idc else False
        
        tenant_match = True
        if rule.tenant_list:
            tenant_match = tenant in rule.tenant_list if tenant else False
        
        if rule.match_mode == "all":
            if not (idc_match and tenant_match):
                return GrayscaleMatchResponse(
                    should_apply=False,
                    reason="机房或租户不匹配"
                )
        else:
            if not (idc_match or tenant_match):
                if rule.idc_list or rule.tenant_list:
                    return GrayscaleMatchResponse(
                        should_apply=False,
                        reason="机房和租户都不匹配"
                    )
        
        if rule.percentage <= 0:
            return GrayscaleMatchResponse(
                should_apply=False,
                reason="放量比例为0"
            )
        
        if rule.percentage >= 100:
            return GrayscaleMatchResponse(
                should_apply=True,
                rule_id=rule.id,
                config_version_id=rule.config_version_id,
                reason="全量发布"
            )
        
        hash_value = GrayscaleEngine._hash_instance(instance_id, rule.id)
        threshold = int(rule.percentage * 100)
        
        if hash_value < threshold:
            return GrayscaleMatchResponse(
                should_apply=True,
                rule_id=rule.id,
                config_version_id=rule.config_version_id,
                reason="命中比例"
            )
        else:
            return GrayscaleMatchResponse(
                should_apply=False,
                reason="未命中比例"
            )

class GrayscaleRuleService:
    @staticmethod
    def create(db: Session, data: GrayscaleRuleCreate) -> GrayscaleRule:
        config = db.query(ConfigVersion).filter(
            ConfigVersion.id == data.config_version_id
        ).first()
        
        if not config:
            raise ValueError("配置版本不存在")
        
        resource_key = f"rule_config:{data.config_version_id}"
        lock_token = ResourceLockService.acquire_lock(db, resource_key, data.created_by)
        
        if not lock_token:
            raise ValueError("该配置版本的规则正在被其他操作占用")
        
        try:
            existing = db.query(GrayscaleRule).filter(
                GrayscaleRule.config_version_id == data.config_version_id,
                GrayscaleRule.status.in_(['draft', 'pending', 'released'])
            ).first()
            
            if existing:
                raise ValueError(f"该配置版本已有状态为 {existing.status} 的规则")
            
            rule = GrayscaleRule(
                name=data.name,
                config_version_id=data.config_version_id,
                idc_list=data.idc_list,
                tenant_list=data.tenant_list,
                percentage=data.percentage,
                match_mode=data.match_mode,
                created_by=data.created_by,
                status="draft"
            )
            db.add(rule)
            db.commit()
            db.refresh(rule)
            
            AuditService.log(
                db, "create_grayscale_rule", data.created_by,
                rule_id=rule.id,
                details={
                    "name": data.name,
                    "config_version_id": data.config_version_id
                }
            )
            
            return rule
        finally:
            ResourceLockService.release_lock(db, resource_key, lock_token)
    
    @staticmethod
    def get_active_rules_by_config(db: Session, config_key: str) -> List[GrayscaleRule]:
        subquery = db.query(ConfigVersion.id).filter(
            ConfigVersion.config_key == config_key
        ).subquery()
        
        return db.query(GrayscaleRule).filter(
            GrayscaleRule.config_version_id.in_(subquery),
            GrayscaleRule.status == "released"
        ).order_by(GrayscaleRule.created_at.desc()).all()
