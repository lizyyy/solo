import hashlib
import re
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
import models
import schemas
from models import BatchStatus, ClaimStatus, DesensitizationType


class DesensitizationEngine:
    @staticmethod
    def apply_rule(value: Any, rule: models.DesensitizationRule) -> Tuple[Any, str]:
        if value is None:
            return None, "skip_null"

        rule_type = rule.rule_type
        str_value = str(value)

        if rule_type == DesensitizationType.MASK:
            return DesensitizationEngine._mask(str_value, rule), f"mask:{rule.name}"

        elif rule_type == DesensitizationType.HASH:
            return DesensitizationEngine._hash(str_value), f"hash:{rule.name}"

        elif rule_type == DesensitizationType.TRUNCATE:
            return DesensitizationEngine._truncate(str_value, rule), f"truncate:{rule.name}"

        elif rule_type == DesensitizationType.REPLACE:
            return DesensitizationEngine._replace(str_value, rule), f"replace:{rule.name}"

        elif rule_type == DesensitizationType.REMOVE:
            return None, f"remove:{rule.name}"

        return value, "no_rule"

    @staticmethod
    def _mask(value: str, rule: models.DesensitizationRule) -> str:
        if len(value) <= rule.keep_start + rule.keep_end:
            return rule.mask_char * len(value)

        prefix = value[:rule.keep_start]
        suffix = value[-rule.keep_end:] if rule.keep_end > 0 else ""
        middle_len = len(value) - rule.keep_start - rule.keep_end
        middle = rule.mask_char * middle_len
        return prefix + middle + suffix

    @staticmethod
    def _hash(value: str) -> str:
        return hashlib.sha256(value.encode()).hexdigest()[:16]

    @staticmethod
    def _truncate(value: str, rule: models.DesensitizationRule) -> str:
        if rule.pattern and rule.pattern.isdigit():
            max_len = int(rule.pattern)
            return value[:max_len] + "..." if len(value) > max_len else value
        return value[:10] + "..."

    @staticmethod
    def _replace(value: str, rule: models.DesensitizationRule) -> str:
        if rule.pattern and rule.replacement:
            return re.sub(rule.pattern, rule.replacement, value)
        return rule.replacement or "[REDACTED]"

    @staticmethod
    def get_nested_value(data: Dict[str, Any], path: str) -> Any:
        keys = path.split(".")
        value = data
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return None
        return value

    @staticmethod
    def set_nested_value(data: Dict[str, Any], path: str, value: Any) -> None:
        keys = path.split(".")
        current = data
        for key in keys[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]
        current[keys[-1]] = value

    @classmethod
    def desensitize_data(cls, data: Dict[str, Any], sensitive_fields: List[models.SensitiveField]) -> Tuple[Dict[str, Any], List[str]]:
        result = data.copy()
        applied_rules = []

        for field in sensitive_fields:
            value = cls.get_nested_value(result, field.field_path)
            if value is not None and field.rule:
                new_value, rule_applied = cls.apply_rule(value, field.rule)
                cls.set_nested_value(result, field.field_path, new_value)
                applied_rules.append(f"{field.field_path}: {rule_applied}")

        return result, applied_rules


class AuthorizationService:
    @staticmethod
    def check_claim_authorization(db: Session, claim_id: int, user: str) -> bool:
        claim = db.query(models.ClaimRecord).filter(models.ClaimRecord.id == claim_id).first()
        if not claim:
            return False

        if claim.status != ClaimStatus.APPROVED:
            return False

        if claim.expire_at and claim.expire_at < datetime.now():
            return False

        if claim.claimant != user:
            return False

        return True

    @staticmethod
    def check_batch_access(db: Session, batch_id: int, user: str) -> bool:
        batch = db.query(models.SampleBatch).filter(models.SampleBatch.id == batch_id).first()
        if not batch:
            return False

        if batch.status not in [BatchStatus.APPROVED, BatchStatus.DRAFT]:
            return False

        return True

    @staticmethod
    def approve_claim(db: Session, claim_id: int, approver: str, comment: str = None) -> models.ClaimRecord:
        claim = db.query(models.ClaimRecord).filter(models.ClaimRecord.id == claim_id).first()
        if not claim:
            raise ValueError("Claim not found")

        batch = db.query(models.SampleBatch).filter(models.SampleBatch.id == claim.batch_id).first()
        scope = db.query(models.AuthorizationScope).filter(
            models.AuthorizationScope.batch_id == claim.batch_id
        ).first()

        claim_hours = scope.claim_hours if scope else 24

        claim.status = ClaimStatus.APPROVED
        claim.approver = approver
        claim.approval_comment = comment
        claim.claimed_at = datetime.now()
        claim.expire_at = datetime.now() + timedelta(hours=claim_hours)

        db.commit()
        db.refresh(claim)
        return claim

    @staticmethod
    def revoke_claim(db: Session, claim_id: int, operator: str, reason: str) -> models.ClaimRecord:
        claim = db.query(models.ClaimRecord).filter(models.ClaimRecord.id == claim_id).first()
        if not claim:
            raise ValueError("Claim not found")

        claim.status = ClaimStatus.REVOKED
        claim.revoked_at = datetime.now()
        claim.revoke_reason = reason

        db.commit()
        db.refresh(claim)
        return claim

    @staticmethod
    def expire_claims(db: Session) -> int:
        expired_claims = db.query(models.ClaimRecord).filter(
            models.ClaimRecord.status == ClaimStatus.APPROVED,
            models.ClaimRecord.expire_at < datetime.now()
        ).all()

        count = 0
        for claim in expired_claims:
            claim.status = ClaimStatus.EXPIRED
            count += 1

        db.commit()
        return count


class ExceptionRecorder:
    @staticmethod
    def record_exception(
        db: Session,
        operation: str,
        operator: str,
        original_input: Dict[str, Any],
        error_message: str,
        processing_basis: Dict[str, Any] = None,
        stack_trace: str = None,
        batch_id: int = None
    ) -> models.ExceptionRecord:
        exception = models.ExceptionRecord(
            batch_id=batch_id,
            operation=operation,
            operator=operator,
            original_input=original_input,
            error_message=error_message,
            processing_basis=processing_basis,
            stack_trace=stack_trace,
            resolved=False
        )
        db.add(exception)
        db.commit()
        db.refresh(exception)
        return exception


class AccessLogger:
    @staticmethod
    def log_access(
        db: Session,
        claim_id: int,
        access_type: str,
        api_path: str = None,
        ip_address: str = None,
        user_agent: str = None,
        request_data: Dict[str, Any] = None,
        response_data: Dict[str, Any] = None
    ) -> models.AccessLog:
        log = models.AccessLog(
            claim_id=claim_id,
            access_type=access_type,
            api_path=api_path,
            ip_address=ip_address,
            user_agent=user_agent,
            request_data=request_data,
            response_data=response_data
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log
