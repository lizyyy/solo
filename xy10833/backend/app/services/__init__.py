import hashlib
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from .. import models, schemas


def evaluate_gray_rule(rule: models.GrayRule, user_id: Optional[str] = None,
                       user_group: Optional[str] = None, region: Optional[str] = None,
                       properties: Dict[str, Any] = None) -> tuple[bool, str]:
    properties = properties or {}

    if user_id and user_id in rule.user_ids:
        return True, f"User {user_id} in whitelist"
    
    if user_group and user_group in rule.user_groups:
        return True, f"Group {user_group} in whitelist"
    
    if region and region in rule.regions:
        return True, f"Region {region} in whitelist"
    
    if rule.percentage > 0 and user_id:
        hash_val = int(hashlib.md5(user_id.encode()).hexdigest()[:8], 16)
        if (hash_val % 100) < rule.percentage:
            return True, f"User {user_id} in {rule.percentage}% gray population"
    
    return False, "No gray rule matched"


def evaluate_feature_flag(db: Session, flag_key: str, user_id: Optional[str] = None,
                          user_group: Optional[str] = None, region: Optional[str] = None,
                          source: Optional[str] = None, source_id: Optional[int] = None,
                          properties: Dict[str, Any] = None) -> schemas.FeatureFlagEvaluateResponse:
    flag = db.query(models.FeatureFlag).filter(models.FeatureFlag.key == flag_key).first()
    
    source_name = source
    source_type = None
    if source_id:
        read_source = db.query(models.ReadSource).filter(models.ReadSource.id == source_id).first()
        if read_source:
            source_name = read_source.name
            source_type = read_source.source_type
    
    if not flag:
        audit = models.ReadAudit(
            feature_flag_id=0,
            source_id=source_id,
            source_name=source_name,
            source_type=source_type,
            user_identifier=user_id,
            result=False,
            request_ip=None,
            user_agent=None
        )
        db.add(audit)
        db.commit()
        return schemas.FeatureFlagEvaluateResponse(
            key=flag_key, enabled=False, hit=False, reason="Feature flag not found"
        )
    
    if not flag.enabled:
        audit = models.ReadAudit(
            feature_flag_id=flag.id,
            source_id=source_id,
            source_name=source_name,
            source_type=source_type,
            user_identifier=user_id,
            result=False,
            request_ip=None,
            user_agent=None
        )
        db.add(audit)
        db.commit()
        return schemas.FeatureFlagEvaluateResponse(
            key=flag_key, enabled=False, hit=False, reason="Feature flag disabled"
        )
    
    hit = False
    reason = "No gray rules, default enabled"
    
    if flag.gray_rules:
        for rule in flag.gray_rules:
            rule_hit, rule_reason = evaluate_gray_rule(rule, user_id, user_group, region, properties)
            if rule_hit:
                hit = True
                reason = rule_reason
                break
    else:
        hit = True
    
    hit_record = models.HitRecord(
        feature_flag_id=flag.id,
        user_id=user_id,
        user_group=user_group,
        region=region,
        hit_result=hit,
        source=source_name
    )
    db.add(hit_record)
    
    read_audit = models.ReadAudit(
        feature_flag_id=flag.id,
        source_id=source_id,
        source_name=source_name,
        source_type=source_type,
        user_identifier=user_id,
        result=hit,
        request_ip=None,
        user_agent=None
    )
    db.add(read_audit)
    
    db.commit()
    
    return schemas.FeatureFlagEvaluateResponse(
        key=flag_key, enabled=flag.enabled, hit=hit, reason=reason
    )


def create_feature_flag(db: Session, flag: schemas.FeatureFlagCreate, created_by: str = "system") -> models.FeatureFlag:
    db_flag = models.FeatureFlag(
        name=flag.name,
        key=flag.key,
        description=flag.description,
        enabled=flag.enabled,
        status=flag.status,
        created_by=created_by
    )
    db.add(db_flag)
    db.flush()
    
    for rule in flag.gray_rules:
        db_rule = models.GrayRule(
            feature_flag_id=db_flag.id,
            **rule.model_dump()
        )
        db.add(db_rule)
    
    snapshot = {
        "name": flag.name,
        "key": flag.key,
        "description": flag.description,
        "enabled": flag.enabled,
        "status": flag.status,
        "gray_rules": [r.model_dump() for r in flag.gray_rules]
    }
    db_version = models.RollbackVersion(
        feature_flag_id=db_flag.id,
        version=1,
        snapshot=snapshot,
        description="Initial version",
        created_by=created_by
    )
    db.add(db_version)
    db.commit()
    db.refresh(db_flag)
    return db_flag


def get_feature_flag(db: Session, flag_id: int) -> Optional[models.FeatureFlag]:
    return db.query(models.FeatureFlag).filter(models.FeatureFlag.id == flag_id).first()


def get_feature_flag_by_key(db: Session, key: str) -> Optional[models.FeatureFlag]:
    return db.query(models.FeatureFlag).filter(models.FeatureFlag.key == key).first()


def get_feature_flags(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None) -> List[models.FeatureFlag]:
    query = db.query(models.FeatureFlag)
    if status:
        query = query.filter(models.FeatureFlag.status == status)
    return query.offset(skip).limit(limit).all()


def update_feature_flag(db: Session, flag_id: int, flag_update: schemas.FeatureFlagUpdate,
                        created_by: str = "system") -> Optional[models.FeatureFlag]:
    db_flag = get_feature_flag(db, flag_id)
    if not db_flag:
        return None
    
    before_data = {
        "name": db_flag.name,
        "description": db_flag.description,
        "enabled": db_flag.enabled,
        "status": db_flag.status,
        "gray_rules": [
            {
                "rule_type": r.rule_type,
                "percentage": r.percentage,
                "user_ids": r.user_ids,
                "user_groups": r.user_groups,
                "regions": r.regions
            } for r in db_flag.gray_rules
        ]
    }
    
    update_data = flag_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key != "gray_rules":
            setattr(db_flag, key, value)
    
    if "gray_rules" in update_data:
        db.query(models.GrayRule).filter(models.GrayRule.feature_flag_id == flag_id).delete()
        for rule in update_data["gray_rules"]:
            db_rule = models.GrayRule(feature_flag_id=flag_id, **rule)
            db.add(db_rule)
    
    db_flag.current_version += 1
    db.flush()
    
    after_data = {
        "name": db_flag.name,
        "description": db_flag.description,
        "enabled": db_flag.enabled,
        "status": db_flag.status,
        "gray_rules": [
            {
                "rule_type": r.rule_type,
                "percentage": r.percentage,
                "user_ids": r.user_ids,
                "user_groups": r.user_groups,
                "regions": r.regions
            } for r in db_flag.gray_rules
        ]
    }
    
    snapshot = after_data.copy()
    db_version = models.RollbackVersion(
        feature_flag_id=db_flag.id,
        version=db_flag.current_version,
        snapshot=snapshot,
        description="Updated version",
        created_by=created_by
    )
    db.add(db_version)
    
    change_order = models.ChangeOrder(
        feature_flag_id=db_flag.id,
        order_type="update",
        title=f"Update {db_flag.name}",
        description="Auto-created from direct update",
        before_data=before_data,
        after_data=after_data,
        status="executed",
        created_by=created_by,
        approved_by=created_by,
        executed_at=datetime.utcnow()
    )
    db.add(change_order)
    db.commit()
    db.refresh(db_flag)
    return db_flag


def delete_feature_flag(db: Session, flag_id: int) -> bool:
    db_flag = get_feature_flag(db, flag_id)
    if not db_flag:
        return False
    db.delete(db_flag)
    db.commit()
    return True


def create_change_order(db: Session, order: schemas.ChangeOrderCreate,
                        created_by: str = "system") -> models.ChangeOrder:
    db_flag = get_feature_flag(db, order.feature_flag_id)
    before_data = {}
    if db_flag:
        before_data = {
            "name": db_flag.name,
            "description": db_flag.description,
            "enabled": db_flag.enabled,
            "status": db_flag.status,
            "gray_rules": [
                {
                    "rule_type": r.rule_type,
                    "percentage": r.percentage,
                    "user_ids": r.user_ids,
                    "user_groups": r.user_groups,
                    "regions": r.regions
                } for r in db_flag.gray_rules
            ]
        }
    
    db_order = models.ChangeOrder(
        feature_flag_id=order.feature_flag_id,
        order_type=order.order_type,
        title=order.title,
        description=order.description,
        before_data=before_data,
        after_data=order.after_data,
        status="pending",
        created_by=created_by
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order


def approve_change_order(db: Session, order_id: int, approved: bool,
                         approved_by: str = "system", comment: Optional[str] = None) -> Optional[models.ChangeOrder]:
    db_order = db.query(models.ChangeOrder).filter(models.ChangeOrder.id == order_id).first()
    if not db_order or db_order.status != "pending":
        return None
    
    db_order.status = "approved" if approved else "rejected"
    db_order.approved_by = approved_by
    db_order.approved_at = datetime.utcnow()
    
    if approved:
        db_flag = get_feature_flag(db, db_order.feature_flag_id)
        if db_flag:
            after_data = db_order.after_data
            if "name" in after_data:
                db_flag.name = after_data["name"]
            if "description" in after_data:
                db_flag.description = after_data["description"]
            if "enabled" in after_data:
                db_flag.enabled = after_data["enabled"]
            if "status" in after_data:
                db_flag.status = after_data["status"]
            if "gray_rules" in after_data:
                db.query(models.GrayRule).filter(models.GrayRule.feature_flag_id == db_flag.id).delete()
                for rule in after_data["gray_rules"]:
                    db_rule = models.GrayRule(feature_flag_id=db_flag.id, **rule)
                    db.add(db_rule)
            
            db_flag.current_version += 1
            snapshot = after_data.copy()
            db_version = models.RollbackVersion(
                feature_flag_id=db_flag.id,
                version=db_flag.current_version,
                snapshot=snapshot,
                description=comment or "Approved change",
                created_by=approved_by
            )
            db.add(db_version)
            db_order.executed_at = datetime.utcnow()
            db_order.status = "executed"
    
    db.commit()
    db.refresh(db_order)
    return db_order


def get_change_orders(db: Session, skip: int = 0, limit: int = 100,
                      status: Optional[str] = None, flag_id: Optional[int] = None) -> List[models.ChangeOrder]:
    query = db.query(models.ChangeOrder)
    if status:
        query = query.filter(models.ChangeOrder.status == status)
    if flag_id:
        query = query.filter(models.ChangeOrder.feature_flag_id == flag_id)
    return query.order_by(models.ChangeOrder.created_at.desc()).offset(skip).limit(limit).all()


def rollback_to_version(db: Session, flag_id: int, version_id: int,
                        reason: Optional[str] = None, created_by: str = "system") -> Optional[models.FeatureFlag]:
    db_version = db.query(models.RollbackVersion).filter(models.RollbackVersion.id == version_id).first()
    if not db_version or db_version.feature_flag_id != flag_id:
        return None
    
    db_flag = get_feature_flag(db, flag_id)
    if not db_flag:
        return None
    
    snapshot = db_version.snapshot
    if "name" in snapshot:
        db_flag.name = snapshot["name"]
    if "description" in snapshot:
        db_flag.description = snapshot["description"]
    if "enabled" in snapshot:
        db_flag.enabled = snapshot["enabled"]
    if "status" in snapshot:
        db_flag.status = snapshot["status"]
    if "gray_rules" in snapshot:
        db.query(models.GrayRule).filter(models.GrayRule.feature_flag_id == flag_id).delete()
        for rule in snapshot["gray_rules"]:
            db_rule = models.GrayRule(feature_flag_id=flag_id, **rule)
            db.add(db_rule)
    
    db_flag.current_version += 1
    db.flush()
    
    new_snapshot = {
        "name": db_flag.name,
        "description": db_flag.description,
        "enabled": db_flag.enabled,
        "status": db_flag.status,
        "gray_rules": [
            {
                "rule_type": r.rule_type,
                "percentage": r.percentage,
                "user_ids": r.user_ids,
                "user_groups": r.user_groups,
                "regions": r.regions
            } for r in db_flag.gray_rules
        ]
    }
    db_new_version = models.RollbackVersion(
        feature_flag_id=db_flag.id,
        version=db_flag.current_version,
        snapshot=new_snapshot,
        description=reason or f"Rollback to version {db_version.version}",
        created_by=created_by
    )
    db.add(db_new_version)
    
    change_order = models.ChangeOrder(
        feature_flag_id=db_flag.id,
        order_type="rollback",
        title=f"Rollback {db_flag.name} to v{db_version.version}",
        description=reason or "Rollback action",
        before_data=snapshot,
        after_data=new_snapshot,
        status="executed",
        created_by=created_by,
        approved_by=created_by,
        executed_at=datetime.utcnow()
    )
    db.add(change_order)
    db.commit()
    db.refresh(db_flag)
    return db_flag


def get_rollback_versions(db: Session, flag_id: int) -> List[models.RollbackVersion]:
    return db.query(models.RollbackVersion).filter(
        models.RollbackVersion.feature_flag_id == flag_id
    ).order_by(models.RollbackVersion.version.desc()).all()


def get_hit_records(db: Session, flag_id: Optional[int] = None,
                    skip: int = 0, limit: int = 100) -> List[models.HitRecord]:
    query = db.query(models.HitRecord)
    if flag_id:
        query = query.filter(models.HitRecord.feature_flag_id == flag_id)
    return query.order_by(models.HitRecord.created_at.desc()).offset(skip).limit(limit).all()


def get_read_audits(db: Session, flag_id: Optional[int] = None,
                    skip: int = 0, limit: int = 100) -> List[models.ReadAudit]:
    query = db.query(models.ReadAudit)
    if flag_id:
        query = query.filter(models.ReadAudit.feature_flag_id == flag_id)
    return query.order_by(models.ReadAudit.created_at.desc()).offset(skip).limit(limit).all()


def get_statistics(db: Session) -> schemas.StatisticsResponse:
    total_flags = db.query(models.FeatureFlag).count()
    enabled_flags = db.query(models.FeatureFlag).filter(models.FeatureFlag.enabled == True).count()
    total_hits = db.query(models.HitRecord).count()
    total_reads = db.query(models.ReadAudit).count()
    pending_changes = db.query(models.ChangeOrder).filter(models.ChangeOrder.status == "pending").count()
    
    return schemas.StatisticsResponse(
        total_flags=total_flags,
        enabled_flags=enabled_flags,
        total_hits=total_hits,
        total_reads=total_reads,
        pending_changes=pending_changes
    )


def create_read_source(db: Session, source: schemas.ReadSourceCreate) -> models.ReadSource:
    import uuid
    db_source = models.ReadSource(
        name=source.name,
        source_type=source.source_type,
        description=source.description,
        api_key=str(uuid.uuid4())
    )
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source


def get_read_sources(db: Session, skip: int = 0, limit: int = 100) -> List[models.ReadSource]:
    return db.query(models.ReadSource).offset(skip).limit(limit).all()


def record_read_audit(db: Session, flag_id: int, source_id: Optional[int] = None,
                      source_name: Optional[str] = None, source_type: Optional[str] = None,
                      user_identifier: Optional[str] = None, result: bool = False,
                      request_ip: Optional[str] = None, user_agent: Optional[str] = None) -> models.ReadAudit:
    db_audit = models.ReadAudit(
        feature_flag_id=flag_id,
        source_id=source_id,
        source_name=source_name,
        source_type=source_type,
        user_identifier=user_identifier,
        result=result,
        request_ip=request_ip,
        user_agent=user_agent
    )
    db.add(db_audit)
    db.commit()
    db.refresh(db_audit)
    return db_audit


def export_data(db: Session, export_type: str, filters: Optional[Dict[str, Any]] = None) -> str:
    filters = filters or {}
    
    if export_type == "feature_flags":
        flags = get_feature_flags(db)
        data = [
            {
                "id": f.id,
                "name": f.name,
                "key": f.key,
                "description": f.description,
                "enabled": f.enabled,
                "status": f.status,
                "created_at": f.created_at.isoformat(),
                "gray_rules": [
                    {
                        "rule_type": r.rule_type,
                        "percentage": r.percentage,
                        "user_ids": r.user_ids,
                        "user_groups": r.user_groups,
                        "regions": r.regions
                    } for r in f.gray_rules
                ]
            } for f in flags
        ]
    elif export_type == "hit_records":
        records = get_hit_records(db, limit=1000)
        data = [
            {
                "id": r.id,
                "feature_flag_id": r.feature_flag_id,
                "user_id": r.user_id,
                "user_group": r.user_group,
                "region": r.region,
                "hit_result": r.hit_result,
                "source": r.source,
                "created_at": r.created_at.isoformat()
            } for r in records
        ]
    elif export_type == "change_orders":
        orders = get_change_orders(db, limit=1000)
        data = [
            {
                "id": o.id,
                "feature_flag_id": o.feature_flag_id,
                "order_type": o.order_type,
                "title": o.title,
                "description": o.description,
                "status": o.status,
                "created_by": o.created_by,
                "approved_by": o.approved_by,
                "created_at": o.created_at.isoformat(),
                "approved_at": o.approved_at.isoformat() if o.approved_at else None,
                "executed_at": o.executed_at.isoformat() if o.executed_at else None
            } for o in orders
        ]
    elif export_type == "read_audits":
        audits = get_read_audits(db, limit=1000)
        data = [
            {
                "id": a.id,
                "feature_flag_id": a.feature_flag_id,
                "source_id": a.source_id,
                "source_name": a.source_name,
                "source_type": a.source_type,
                "user_identifier": a.user_identifier,
                "result": a.result,
                "request_ip": a.request_ip,
                "user_agent": a.user_agent,
                "created_at": a.created_at.isoformat()
            } for a in audits
        ]
    else:
        data = []
    
    return json.dumps(data, indent=2, ensure_ascii=False)
