from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from models import RuleResult


class BaseRule(ABC):
    def __init__(self, db: Session):
        self.db = db
        self.rule_name = ""
        self.rule_code = ""
        self.exception_type = ""
        self.blocked = False

    @abstractmethod
    def apply(self, record: Any) -> List[RuleResult]:
        pass

    @abstractmethod
    def should_apply(self, record: Any) -> bool:
        pass

    def _create_rule_result(self, record: Any, reason: str,
                            details: Optional[str] = None,
                            severity: str = "medium") -> RuleResult:
        from utils import generate_rule_result_id

        result = RuleResult(
            id=generate_rule_result_id(),
            rule_name=self.rule_name,
            rule_code=self.rule_code,
            exception_type=self.exception_type,
            is_blocked=self.blocked,
            reason=reason,
            details=details,
            severity=severity
        )

        if hasattr(record, '__tablename__'):
            if record.__tablename__ == 'food_samples':
                result.sample_id = record.id
            elif record.__tablename__ == 'temperature_records':
                result.temperature_record_id = record.id
            elif record.__tablename__ == 'waste_records':
                result.waste_record_id = record.id

        return result
