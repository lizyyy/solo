from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime
from models import (
    PolicyVersion, PolicyStatus, RouteConfig, ProtectionPolicy,
    CircuitBreakerRecord, CircuitBreakerState
)
from config_importer import import_routes, import_protection_policy
import random


def create_policy_version(
    db: Session,
    version: Optional[str] = None,
    description: str = "",
    routes_config: Optional[Dict[str, Any]] = None,
    protection_config: Optional[Dict[str, Any]] = None,
    auto_apply: bool = False
) -> PolicyVersion:
    if not version:
        version = f"v{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    existing = db.query(PolicyVersion).filter(PolicyVersion.version == version).first()
    if existing:
        raise ValueError(f"Policy version '{version}' already exists")
    
    policy_version = PolicyVersion(
        version=version,
        description=description,
        status=PolicyStatus.DRAFT,
        routes_config=routes_config,
        protection_config=protection_config
    )
    
    db.add(policy_version)
    db.commit()
    db.refresh(policy_version)
    
    if routes_config:
        import_routes(db, routes_config, policy_version.id)
    
    if protection_config:
        import_protection_policy(db, protection_config, policy_version.id)
    
    if auto_apply:
        policy_version = activate_policy_version(db, policy_version.id)
    
    return policy_version


def get_policy_version(db: Session, version_id: int) -> Optional[PolicyVersion]:
    return db.query(PolicyVersion).filter(PolicyVersion.id == version_id).first()


def get_policy_version_by_version(db: Session, version: str) -> Optional[PolicyVersion]:
    return db.query(PolicyVersion).filter(PolicyVersion.version == version).first()


def list_policy_versions(db: Session, status: Optional[str] = None) -> List[PolicyVersion]:
    query = db.query(PolicyVersion)
    if status:
        query = query.filter(PolicyVersion.status == status)
    return query.order_by(PolicyVersion.created_at.desc()).all()


def activate_policy_version(db: Session, version_id: int) -> PolicyVersion:
    policy_version = get_policy_version(db, version_id)
    if not policy_version:
        raise ValueError(f"Policy version with id {version_id} not found")
    
    db.query(PolicyVersion).filter(
        PolicyVersion.status == PolicyStatus.ACTIVE
    ).update({"status": PolicyStatus.DRAFT})
    
    db.query(PolicyVersion).filter(
        PolicyVersion.status == PolicyStatus.CANARY
    ).update({"status": PolicyStatus.DRAFT})
    
    policy_version.status = PolicyStatus.ACTIVE
    policy_version.canary_percentage = 100
    
    reset_circuit_breakers_for_version(db, version_id)
    
    db.commit()
    db.refresh(policy_version)
    return policy_version


def start_canary_release(
    db: Session,
    version_id: int,
    canary_percentage: int = 10,
    keep_old_active: bool = True
) -> PolicyVersion:
    policy_version = get_policy_version(db, version_id)
    if not policy_version:
        raise ValueError(f"Policy version with id {version_id} not found")
    
    if canary_percentage < 0 or canary_percentage > 100:
        raise ValueError("Canary percentage must be between 0 and 100")
    
    if keep_old_active:
        active_version = db.query(PolicyVersion).filter(
            PolicyVersion.status == PolicyStatus.ACTIVE
        ).first()
        if not active_version:
            policy_version.status = PolicyStatus.ACTIVE
            policy_version.canary_percentage = 100
        else:
            policy_version.status = PolicyStatus.CANARY
            policy_version.canary_percentage = canary_percentage
    else:
        db.query(PolicyVersion).filter(
            PolicyVersion.status.in_([PolicyStatus.ACTIVE, PolicyStatus.CANARY])
        ).update({"status": PolicyStatus.DRAFT})
        
        policy_version.status = PolicyStatus.CANARY
        policy_version.canary_percentage = canary_percentage
    
    db.commit()
    db.refresh(policy_version)
    return policy_version


def update_canary_percentage(
    db: Session,
    version_id: int,
    canary_percentage: int
) -> PolicyVersion:
    policy_version = get_policy_version(db, version_id)
    if not policy_version:
        raise ValueError(f"Policy version with id {version_id} not found")
    
    if policy_version.status not in [PolicyStatus.CANARY, PolicyStatus.ACTIVE]:
        raise ValueError(f"Policy version is not in canary or active state")
    
    if canary_percentage < 0 or canary_percentage > 100:
        raise ValueError("Canary percentage must be between 0 and 100")
    
    policy_version.canary_percentage = canary_percentage
    
    if canary_percentage == 100:
        policy_version.status = PolicyStatus.ACTIVE
        db.query(PolicyVersion).filter(
            PolicyVersion.status == PolicyStatus.ACTIVE,
            PolicyVersion.id != version_id
        ).update({"status": PolicyStatus.DRAFT})
    
    db.commit()
    db.refresh(policy_version)
    return policy_version


def rollback_policy_version(
    db: Session,
    from_version_id: int,
    to_version_id: int
) -> Dict[str, Any]:
    from_version = get_policy_version(db, from_version_id)
    to_version = get_policy_version(db, to_version_id)
    
    if not from_version or not to_version:
        raise ValueError("One or both policy versions not found")
    
    if from_version.status not in [PolicyStatus.ACTIVE, PolicyStatus.CANARY]:
        raise ValueError("From version is not active")
    
    from_version.status = PolicyStatus.ROLLED_BACK
    to_version.status = PolicyStatus.ACTIVE
    to_version.canary_percentage = 100
    
    reset_circuit_breakers_for_version(db, to_version_id)
    
    db.commit()
    db.refresh(from_version)
    db.refresh(to_version)
    
    return {
        "rolled_back_from": {
            "id": from_version.id,
            "version": from_version.version
        },
        "rolled_back_to": {
            "id": to_version.id,
            "version": to_version.version
        },
        "timestamp": datetime.now().isoformat()
    }


def get_active_policy_version(db: Session) -> Optional[PolicyVersion]:
    return db.query(PolicyVersion).filter(
        PolicyVersion.status == PolicyStatus.ACTIVE
    ).first()


def get_canary_policy_versions(db: Session) -> List[PolicyVersion]:
    return db.query(PolicyVersion).filter(
        PolicyVersion.status == PolicyStatus.CANARY
    ).all()


def select_policy_version_for_request(db: Session, request_identifier: Optional[str] = None) -> Optional[PolicyVersion]:
    active_version = get_active_policy_version(db)
    canary_versions = get_canary_policy_versions(db)
    
    if not canary_versions:
        return active_version
    
    if request_identifier:
        hash_value = hash(request_identifier) % 100
    else:
        hash_value = random.randint(0, 99)
    
    cumulative_percentage = 0
    for canary_version in canary_versions:
        cumulative_percentage += canary_version.canary_percentage
        if hash_value < cumulative_percentage:
            return canary_version
    
    return active_version


def reset_circuit_breakers_for_version(db: Session, policy_version_id: int):
    circuit_breakers = db.query(CircuitBreakerRecord).filter(
        CircuitBreakerRecord.policy_version_id == policy_version_id
    ).all()
    
    for cb in circuit_breakers:
        cb.state = CircuitBreakerState.CLOSED
        cb.previous_state = None
        cb.failure_count = 0
        cb.success_count = 0
        cb.total_count = 0
        cb.failure_rate = 0.0
        cb.half_open_attempts = 0
        cb.reason = "Reset due to policy version activation"
        cb.created_at = datetime.now()
    
    db.commit()


def get_policy_versions_summary(db: Session) -> List[Dict[str, Any]]:
    versions = list_policy_versions(db)
    return [
        {
            "id": v.id,
            "version": v.version,
            "description": v.description,
            "status": v.status,
            "canary_percentage": v.canary_percentage,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "updated_at": v.updated_at.isoformat() if v.updated_at else None
        }
        for v in versions
    ]
