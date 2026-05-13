import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from .models import (
    db, ConfigVersion, GrayCondition, ReleaseBatch, HitSample,
    RollbackPoint, QueryToken, AuditLog, BatchStatus
)


class GraySnapshotService:
    @staticmethod
    def _generate_key(prefix: str) -> str:
        return f"{prefix}_{uuid.uuid4().hex[:16]}"

    @staticmethod
    def _audit_log(operation_type: str, resource_type: str, resource_key: str,
                   operator: str, details: str, request_id: str = None):
        audit = AuditLog(
            operation_type=operation_type,
            resource_type=resource_type,
            resource_key=resource_key,
            operator=operator,
            details=details,
            request_id=request_id
        )
        db.session.add(audit)

    @staticmethod
    def create_config_version(config_name: str, config_content: Dict, version: str,
                              created_by: str, description: str = None, request_id: str = None) -> Tuple[Dict, int]:
        version_key = GraySnapshotService._generate_key("cfg")
        
        if ConfigVersion.query.filter_by(config_name=config_name, version=version).first():
            return {"error": "Config version already exists", "version_key": None}, 409
        
        config = ConfigVersion(
            version_key=version_key,
            config_name=config_name,
            config_content=json.dumps(config_content),
            version=version,
            created_by=created_by,
            description=description
        )
        db.session.add(config)
        db.session.commit()
        
        GraySnapshotService._audit_log(
            "CREATE", "ConfigVersion", version_key, created_by,
            f"Created config {config_name} version {version}", request_id
        )
        
        return {
            "version_key": version_key,
            "config_name": config_name,
            "version": version,
            "created_at": config.created_at.isoformat()
        }, 201

    @staticmethod
    def create_gray_condition(version_key: str, condition_type: str, condition_expression: str,
                              created_by: str, description: str = None, priority: int = 0,
                              request_id: str = None) -> Tuple[Dict, int]:
        config = ConfigVersion.query.filter_by(version_key=version_key).first()
        if not config:
            return {"error": "Config version not found"}, 404
        
        condition_key = GraySnapshotService._generate_key("cond")
        
        condition = GrayCondition(
            condition_key=condition_key,
            config_version_id=config.id,
            condition_type=condition_type,
            condition_expression=condition_expression,
            description=description,
            priority=priority,
            created_by=created_by
        )
        db.session.add(condition)
        db.session.commit()
        
        GraySnapshotService._audit_log(
            "CREATE", "GrayCondition", condition_key, created_by,
            f"Created gray condition for config {version_key}", request_id
        )
        
        return {
            "condition_key": condition_key,
            "condition_type": condition_type,
            "priority": priority
        }, 201

    @staticmethod
    def create_release_batch(version_key: str, batch_name: str, target_percentage: int,
                             created_by: str, request_id: str = None) -> Tuple[Dict, int]:
        config = ConfigVersion.query.filter_by(version_key=version_key).first()
        if not config:
            return {"error": "Config version not found"}, 404
        
        if target_percentage < 0 or target_percentage > 100:
            return {"error": "Target percentage must be between 0 and 100"}, 400
        
        batch_key = GraySnapshotService._generate_key("batch")
        
        batch = ReleaseBatch(
            batch_key=batch_key,
            config_version_id=config.id,
            batch_name=batch_name,
            target_percentage=target_percentage,
            created_by=created_by
        )
        db.session.add(batch)
        db.session.commit()
        
        GraySnapshotService._audit_log(
            "CREATE", "ReleaseBatch", batch_key, created_by,
            f"Created release batch {batch_name} for config {version_key}", request_id
        )
        
        return {
            "batch_key": batch_key,
            "batch_name": batch_name,
            "status": BatchStatus.DRAFT.value,
            "target_percentage": target_percentage
        }, 201

    @staticmethod
    def create_rollback_point(batch_key: str, created_by: str, description: str = None,
                              request_id: str = None) -> Tuple[Dict, int]:
        batch = ReleaseBatch.query.filter_by(batch_key=batch_key).first()
        if not batch:
            return {"error": "Release batch not found"}, 404
        
        rollback_key = GraySnapshotService._generate_key("rb")
        
        snapshot = {
            "batch_key": batch_key,
            "status": batch.status.value,
            "current_percentage": batch.current_percentage,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        rollback = RollbackPoint(
            rollback_key=rollback_key,
            batch_id=batch.id,
            snapshot_content=json.dumps(snapshot),
            created_by=created_by,
            description=description
        )
        db.session.add(rollback)
        db.session.commit()
        
        GraySnapshotService._audit_log(
            "CREATE", "RollbackPoint", rollback_key, created_by,
            f"Created rollback point for batch {batch_key}", request_id
        )
        
        return {
            "rollback_key": rollback_key,
            "created_at": rollback.created_at.isoformat(),
            "snapshot": snapshot
        }, 201

    @staticmethod
    def create_query_token(created_by: str, permissions: List[str], expires_hours: int = 24,
                           request_id: str = None) -> Tuple[Dict, int]:
        token_key = GraySnapshotService._generate_key("tk")
        token_value = uuid.uuid4().hex
        
        token = QueryToken(
            token_key=token_key,
            token_value=token_value,
            created_by=created_by,
            expires_at=datetime.utcnow() + timedelta(hours=expires_hours),
            permissions=json.dumps(permissions)
        )
        db.session.add(token)
        db.session.commit()
        
        GraySnapshotService._audit_log(
            "CREATE", "QueryToken", token_key, created_by,
            f"Created query token with permissions: {permissions}", request_id
        )
        
        return {
            "token_key": token_key,
            "token_value": token_value,
            "expires_at": token.expires_at.isoformat(),
            "permissions": permissions
        }, 201

    @staticmethod
    def evaluate_gray_hit(batch_key: str, user_id: str, user_attributes: Dict,
                          request_id: str = None, operator: str = "system") -> Tuple[Dict, int]:
        batch = ReleaseBatch.query.filter_by(batch_key=batch_key).first()
        if not batch:
            return {"error": "Release batch not found"}, 404
        
        if batch.status not in [BatchStatus.RUNNING, BatchStatus.PENDING]:
            return {"error": f"Batch is not active. Current status: {batch.status.value}"}, 400
        
        existing = HitSample.query.filter_by(batch_id=batch.id, user_id=user_id, is_valid=True).first()
        if existing:
            return {
                "hit": True,
                "already_hit": True,
                "sample_key": existing.sample_key,
                "hit_explanation": existing.hit_explanation
            }, 200
        
        config = ConfigVersion.query.get(batch.config_version_id)
        conditions = GrayCondition.query.filter_by(
            config_version_id=config.id, is_active=True
        ).order_by(GrayCondition.priority.desc()).all()
        
        hit_explanation = None
        matched_condition = None
        
        for condition in conditions:
            try:
                expr = condition.condition_expression
                if GraySnapshotService._evaluate_condition(expr, user_attributes):
                    matched_condition = condition
                    hit_explanation = f"Matched condition {condition.condition_key}: {condition.description}"
                    break
            except Exception as e:
                continue
        
        if not matched_condition:
            hash_val = hash(f"{user_id}_{batch.batch_key}") % 100
            if hash_val < batch.current_percentage:
                hit_explanation = f"Matched by percentage: {batch.current_percentage}%"
            else:
                return {
                    "hit": False,
                    "user_id": user_id,
                    "reason": "Did not match any conditions or percentage threshold"
                }, 200
        
        sample_key = GraySnapshotService._generate_key("sample")
        
        sample = HitSample(
            sample_key=sample_key,
            batch_id=batch.id,
            condition_id=matched_condition.id if matched_condition else None,
            user_id=user_id,
            user_attributes=json.dumps(user_attributes),
            hit_explanation=hit_explanation,
            request_id=request_id
        )
        db.session.add(sample)
        db.session.commit()
        
        GraySnapshotService._audit_log(
            "HIT", "HitSample", sample_key, operator,
            f"User {user_id} hit gray release: {hit_explanation}", request_id
        )
        
        return {
            "hit": True,
            "sample_key": sample_key,
            "user_id": user_id,
            "hit_explanation": hit_explanation,
            "hit_time": sample.hit_time.isoformat()
        }, 200

    @staticmethod
    def _evaluate_condition(expr: str, user_attrs: Dict) -> bool:
        try:
            for key, value in user_attrs.items():
                if isinstance(value, str):
                    expr = expr.replace(f"${key}", f'"{value}"')
                else:
                    expr = expr.replace(f"${key}", str(value))
            return eval(expr)
        except:
            return False

    @staticmethod
    def update_batch_status(batch_key: str, new_status: str, updated_by: str,
                            current_percentage: int = None, conclusion: str = None,
                            request_id: str = None) -> Tuple[Dict, int]:
        batch = ReleaseBatch.query.filter_by(batch_key=batch_key).first()
        if not batch:
            return {"error": "Release batch not found"}, 404
        
        try:
            target_status = BatchStatus(new_status)
        except ValueError:
            return {"error": f"Invalid status: {new_status}"}, 400
        
        valid_transitions = {
            BatchStatus.DRAFT: [BatchStatus.PENDING],
            BatchStatus.PENDING: [BatchStatus.RUNNING, BatchStatus.FAILED],
            BatchStatus.RUNNING: [BatchStatus.PAUSED, BatchStatus.COMPLETED, BatchStatus.ROLLED_BACK],
            BatchStatus.PAUSED: [BatchStatus.RUNNING, BatchStatus.ROLLED_BACK],
        }
        
        if batch.status not in valid_transitions or target_status not in valid_transitions.get(batch.status, []):
            if batch.status not in [BatchStatus.COMPLETED, BatchStatus.ROLLED_BACK, BatchStatus.FAILED]:
                return {"error": f"Invalid status transition from {batch.status.value} to {new_status}"}, 400
        
        old_status = batch.status.value
        batch.status = target_status
        batch.updated_by = updated_by
        
        if current_percentage is not None:
            if 0 <= current_percentage <= 100:
                batch.current_percentage = current_percentage
            else:
                return {"error": "Percentage must be between 0 and 100"}, 400
        
        if conclusion:
            batch.conclusion = conclusion
        
        if target_status == BatchStatus.RUNNING and not batch.start_time:
            batch.start_time = datetime.utcnow()
        
        if target_status in [BatchStatus.COMPLETED, BatchStatus.ROLLED_BACK, BatchStatus.FAILED]:
            batch.end_time = datetime.utcnow()
        
        db.session.commit()
        
        GraySnapshotService._audit_log(
            "STATUS_UPDATE", "ReleaseBatch", batch_key, updated_by,
            f"Status changed from {old_status} to {new_status}", request_id
        )
        
        return {
            "batch_key": batch_key,
            "old_status": old_status,
            "new_status": new_status,
            "current_percentage": batch.current_percentage,
            "updated_at": batch.updated_at.isoformat()
        }, 200

    @staticmethod
    def rollback_to_point(rollback_key: str, rolled_by: str,
                          request_id: str = None) -> Tuple[Dict, int]:
        rollback = RollbackPoint.query.filter_by(rollback_key=rollback_key).first()
        if not rollback:
            return {"error": "Rollback point not found"}, 404
        
        if rollback.is_used:
            return {"error": "Rollback point already used"}, 400
        
        batch = ReleaseBatch.query.get(rollback.batch_id)
        if not batch:
            return {"error": "Associated batch not found"}, 404
        
        snapshot = json.loads(rollback.snapshot_content)
        
        old_status = batch.status.value
        batch.status = BatchStatus.ROLLED_BACK
        batch.updated_by = rolled_by
        batch.current_percentage = snapshot.get("current_percentage", 0)
        batch.end_time = datetime.utcnow()
        
        rollback.is_used = True
        rollback.used_at = datetime.utcnow()
        rollback.used_by = rolled_by
        
        HitSample.query.filter_by(batch_id=batch.id).update({"is_valid": False})
        
        db.session.commit()
        
        GraySnapshotService._audit_log(
            "ROLLBACK", "ReleaseBatch", batch.batch_key, rolled_by,
            f"Rolled back to point {rollback_key}. Snapshot: {snapshot}", request_id
        )
        
        return {
            "batch_key": batch.batch_key,
            "rollback_key": rollback_key,
            "status": BatchStatus.ROLLED_BACK.value,
            "rolled_at": datetime.utcnow().isoformat(),
            "rolled_by": rolled_by,
            "snapshot_restored": snapshot
        }, 200

    @staticmethod
    def get_batch_history(batch_key: str, token_value: str = None) -> Tuple[Dict, int]:
        if token_value:
            token = QueryToken.query.filter_by(token_value=token_value, is_active=True).first()
            if not token:
                return {"error": "Invalid or expired token"}, 401
            if token.expires_at and token.expires_at < datetime.utcnow():
                return {"error": "Token expired"}, 401
            
            token.last_used_at = datetime.utcnow()
            token.use_count += 1
            db.session.commit()
        
        batch = ReleaseBatch.query.filter_by(batch_key=batch_key).first()
        if not batch:
            return {"error": "Release batch not found"}, 404
        
        config = ConfigVersion.query.get(batch.config_version_id)
        hit_samples = HitSample.query.filter_by(batch_id=batch.id).order_by(HitSample.hit_time.desc()).all()
        rollback_points = RollbackPoint.query.filter_by(batch_id=batch.id).order_by(RollbackPoint.created_at.desc()).all()
        audits = AuditLog.query.filter_by(resource_key=batch_key).order_by(AuditLog.operation_time.desc()).all()
        
        return {
            "batch": {
                "batch_key": batch.batch_key,
                "batch_name": batch.batch_name,
                "status": batch.status.value,
                "target_percentage": batch.target_percentage,
                "current_percentage": batch.current_percentage,
                "created_by": batch.created_by,
                "created_at": batch.created_at.isoformat(),
                "updated_by": batch.updated_by,
                "updated_at": batch.updated_at.isoformat() if batch.updated_at else None,
                "conclusion": batch.conclusion
            },
            "config_version": {
                "version_key": config.version_key,
                "config_name": config.config_name,
                "version": config.version
            },
            "hit_samples": [
                {
                    "sample_key": s.sample_key,
                    "user_id": s.user_id,
                    "hit_explanation": s.hit_explanation,
                    "hit_time": s.hit_time.isoformat(),
                    "is_valid": s.is_valid
                } for s in hit_samples
            ],
            "rollback_points": [
                {
                    "rollback_key": r.rollback_key,
                    "created_at": r.created_at.isoformat(),
                    "is_used": r.is_used,
                    "description": r.description
                } for r in rollback_points
            ],
            "audit_logs": [
                {
                    "operation_type": a.operation_type,
                    "operator": a.operator,
                    "operation_time": a.operation_time.isoformat(),
                    "details": a.details
                } for a in audits
            ]
        }, 200
