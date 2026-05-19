from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.models import RuleResult
from app.models.enums import RuleType, RuleResultStatus


class RuleResultRepository:
    def __init__(self):
        pass

    def get_by_batch(self, db: Session, batch_id: int) -> List[RuleResult]:
        return db.query(RuleResult).filter(RuleResult.batch_id == batch_id).order_by(RuleResult.created_at.desc()).all()

    def get_by_batch_and_type(self, db: Session, batch_id: int, rule_type: RuleType) -> List[RuleResult]:
        return db.query(RuleResult).filter(
            RuleResult.batch_id == batch_id,
            RuleResult.rule_type == rule_type
        ).order_by(RuleResult.created_at.desc()).all()

    def get_latest_by_batch(self, db: Session, batch_id: int) -> Optional[RuleResult]:
        return db.query(RuleResult).filter(RuleResult.batch_id == batch_id).order_by(RuleResult.created_at.desc()).first()

    def create(self, db: Session, rule_result: RuleResult) -> RuleResult:
        db.add(rule_result)
        db.commit()
        db.refresh(rule_result)
        return rule_result

    def has_blocked_rules(self, db: Session, batch_id: int) -> bool:
        return db.query(RuleResult).filter(
            RuleResult.batch_id == batch_id,
            RuleResult.status == RuleResultStatus.BLOCKED
        ).first() is not None

    def get_blocked_reasons(self, db: Session, batch_id: int) -> List[str]:
        results = db.query(RuleResult).filter(
            RuleResult.batch_id == batch_id,
            RuleResult.status == RuleResultStatus.BLOCKED
        ).all()
        return [r.reason for r in results]
