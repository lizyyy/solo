from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Protocol

from ..models import (
    RuleResult,
    RuleType,
    Severity,
    CheckResult,
    EvidenceCatalog,
    Objection,
    Reference,
    ReferenceType,
)


@dataclass
class RuleContext:
    evidence_catalog: Optional[EvidenceCatalog] = None
    references: List[Reference] = field(default_factory=list)
    objections: List[Objection] = field(default_factory=list)
    timeline_data: Optional[Dict] = None
    parsed_data: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


class BaseRule(ABC):
    rule_name: str = ""
    rule_type: RuleType = RuleType.OTHER
    default_severity: Severity = Severity.MEDIUM

    def __init__(self, severity: Optional[Severity] = None):
        self.severity = severity or self.default_severity
        self.results: List[RuleResult] = []

    @abstractmethod
    def check(self, context: RuleContext) -> List[RuleResult]:
        pass

    def add_result(
        self,
        message: str,
        evidence_number: Optional[str] = None,
        source_files: Optional[List[str]] = None,
        line_numbers: Optional[List[int]] = None,
        context: Optional[Dict] = None,
        suggestion: Optional[str] = None,
        severity: Optional[Severity] = None,
    ) -> None:
        result = RuleResult(
            rule_type=self.rule_type,
            severity=severity or self.severity,
            message=message,
            evidence_number=evidence_number,
            source_files=source_files or [],
            line_numbers=line_numbers or [],
            context=context or {},
            suggestion=suggestion,
            rule_id=f"{self.rule_name}_{len(self.results) + 1}",
        )
        self.results.append(result)


class RuleEngine:
    def __init__(self, rules: Optional[List[BaseRule]] = None):
        self.rules: List[BaseRule] = rules or []
        self.all_results: List[RuleResult] = []

    def register_rule(self, rule: BaseRule) -> None:
        self.rules.append(rule)

    def run_all(
        self,
        context: RuleContext,
        check_id: Optional[str] = None,
        case_number: Optional[str] = None,
        case_name: Optional[str] = None,
        files_processed: Optional[List[str]] = None,
    ) -> CheckResult:
        self.all_results = []

        for rule in self.rules:
            rule.results = []
            results = rule.check(context)
            self.all_results.extend(results)

        check_result = CheckResult(
            check_id=check_id or f"check_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            check_timestamp=datetime.now(),
            rule_results=self.all_results,
            case_number=case_number,
            case_name=case_name,
            files_processed=files_processed or [],
        )
        check_result._update_summary()

        return check_result

    def get_results_by_rule_type(self, rule_type: RuleType) -> List[RuleResult]:
        return [r for r in self.all_results if r.rule_type == rule_type]

    def get_results_by_severity(self, severity: Severity) -> List[RuleResult]:
        return [r for r in self.all_results if r.severity == severity]
