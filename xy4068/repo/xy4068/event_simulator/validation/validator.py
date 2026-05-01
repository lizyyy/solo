from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from event_simulator.models.event import Event
from event_simulator.models.jitter_rule import JitterRule
from event_simulator.validation.rules import (
    DuplicateRule,
    MissingFieldRule,
    OutOfOrderRule,
    RuleConflictRule,
    ValidationError,
    ValidationRule,
)


@dataclass
class ValidationResult:
    valid: bool = True
    total_events: int = 0
    total_errors: int = 0
    total_warnings: int = 0
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)
    rules_executed: List[str] = field(default_factory=list)
    validation_time: Optional[datetime] = None
    duration_ms: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        error_counts: Dict[str, int] = {}
        for e in self.errors:
            key = f"{e.rule_name}:{e.error_type}"
            error_counts[key] = error_counts.get(key, 0) + 1
        
        warning_counts: Dict[str, int] = {}
        for w in self.warnings:
            key = f"{w.rule_name}:{w.error_type}"
            warning_counts[key] = warning_counts.get(key, 0) + 1
        
        return {
            "valid": self.valid,
            "total_events": self.total_events,
            "total_errors": self.total_errors,
            "total_warnings": self.total_warnings,
            "error_counts": error_counts,
            "warning_counts": warning_counts,
            "rules_executed": self.rules_executed,
            "validation_time": self.validation_time.isoformat() if self.validation_time else None,
            "duration_ms": self.duration_ms,
            "errors": [e.to_dict() for e in self.errors],
            "warnings": [w.to_dict() for w in self.warnings],
        }
    
    def add_error(self, error: ValidationError):
        if error.severity == "warning":
            self.warnings.append(error)
            self.total_warnings += 1
        else:
            self.errors.append(error)
            self.total_errors += 1
            self.valid = False


class Validator:
    def __init__(self, rules: Optional[List[ValidationRule]] = None):
        self._rules = rules or self._get_default_rules()
    
    @staticmethod
    def _get_default_rules() -> List[ValidationRule]:
        return [
            OutOfOrderRule(),
            DuplicateRule(),
            MissingFieldRule(),
            RuleConflictRule(),
        ]
    
    def add_rule(self, rule: ValidationRule):
        self._rules.append(rule)
    
    def validate(
        self,
        events: List[Event],
        jitter_rules: Optional[List[JitterRule]] = None,
        additional_required_fields: Optional[List[str]] = None,
        enabled_rules: Optional[List[str]] = None,
        disabled_rules: Optional[List[str]] = None,
    ) -> ValidationResult:
        start_time = datetime.now()
        
        result = ValidationResult(
            total_events=len(events),
            validation_time=start_time,
        )
        
        for rule in self._rules:
            if not rule.enabled:
                continue
            
            if enabled_rules and rule.name not in enabled_rules:
                continue
            if disabled_rules and rule.name in disabled_rules:
                continue
            
            result.rules_executed.append(rule.name)
            
            kwargs = {}
            if jitter_rules is not None:
                kwargs["jitter_rules"] = jitter_rules
            if additional_required_fields:
                kwargs["additional_required"] = additional_required_fields
            
            errors = rule.validate(events, **kwargs)
            
            for error in errors:
                result.add_error(error)
        
        end_time = datetime.now()
        result.duration_ms = (end_time - start_time).total_seconds() * 1000
        
        return result
    
    def validate_single(self, event: Event) -> ValidationResult:
        return self.validate([event])
    
    def get_rule_names(self) -> List[str]:
        return [r.name for r in self._rules]
    
    def enable_rule(self, rule_name: str):
        for rule in self._rules:
            if rule.name == rule_name:
                rule.enabled = True
                return
        raise ValueError(f"Rule not found: {rule_name}")
    
    def disable_rule(self, rule_name: str):
        for rule in self._rules:
            if rule.name == rule_name:
                rule.enabled = False
                return
        raise ValueError(f"Rule not found: {rule_name}")
