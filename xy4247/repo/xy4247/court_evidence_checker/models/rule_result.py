from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from .base import BaseModel


class RuleType(Enum):
    MISSING_REFERENCE = "missing_reference"
    DUPLICATE_REFERENCE = "duplicate_reference"
    CONFLICTING_REFERENCE = "conflicting_reference"
    DATE_CONFLICT = "date_conflict"
    UNHANDLED_OBJECTION = "unhandled_objection"
    INCONSISTENT_ALIAS = "inconsistent_alias"
    OTHER = "other"


class Severity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class RuleResult(BaseModel):
    rule_type: RuleType
    severity: Severity
    message: str
    evidence_number: Optional[str] = None
    source_files: List[str] = field(default_factory=list)
    line_numbers: List[int] = field(default_factory=list)
    context: Dict = field(default_factory=dict)
    suggestion: Optional[str] = None
    rule_id: Optional[str] = None

    @property
    def evidence_numbers(self) -> List[str]:
        return [self.evidence_number] if self.evidence_number else []

    def to_dict(self) -> Dict:
        return {
            "rule_type": self.rule_type.value,
            "severity": self.severity.value,
            "message": self.message,
            "evidence_number": self.evidence_number,
            "source_files": self.source_files,
            "line_numbers": self.line_numbers,
            "context": self.context,
            "suggestion": self.suggestion,
            "rule_id": self.rule_id,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "RuleResult":
        rule_type = (
            RuleType(data["rule_type"])
            if isinstance(data["rule_type"], str)
            else data["rule_type"]
        )
        severity = (
            Severity(data["severity"])
            if isinstance(data["severity"], str)
            else data["severity"]
        )
        return cls(
            rule_type=rule_type,
            severity=severity,
            message=data["message"],
            evidence_number=data.get("evidence_number"),
            source_files=data.get("source_files", []),
            line_numbers=data.get("line_numbers", []),
            context=data.get("context", {}),
            suggestion=data.get("suggestion"),
            rule_id=data.get("rule_id"),
        )


@dataclass
class CheckResult(BaseModel):
    check_id: str
    check_timestamp: datetime
    rule_results: List[RuleResult] = field(default_factory=list)
    case_number: Optional[str] = None
    case_name: Optional[str] = None
    files_processed: List[str] = field(default_factory=list)
    summary: Dict = field(default_factory=dict)

    @property
    def results(self) -> List[RuleResult]:
        return self.rule_results

    def add_result(self, result: RuleResult) -> None:
        self.rule_results.append(result)
        self._update_summary()

    def add_results(self, results: List[RuleResult]) -> None:
        self.rule_results.extend(results)
        self._update_summary()

    def _update_summary(self) -> None:
        self.summary = {
            "total_issues": len(self.rule_results),
            "by_severity": {},
            "by_rule_type": {},
        }
        for result in self.rule_results:
            sev = result.severity.value
            self.summary["by_severity"][sev] = self.summary["by_severity"].get(sev, 0) + 1
            rt = result.rule_type.value
            self.summary["by_rule_type"][rt] = self.summary["by_rule_type"].get(rt, 0) + 1

    def get_results_by_severity(self, severity: Severity) -> List[RuleResult]:
        return [r for r in self.rule_results if r.severity == severity]

    def get_results_by_rule_type(self, rule_type: RuleType) -> List[RuleResult]:
        return [r for r in self.rule_results if r.rule_type == rule_type]

    @property
    def has_critical_issues(self) -> bool:
        return any(r.severity == Severity.CRITICAL for r in self.rule_results)

    @property
    def issue_count(self) -> int:
        return len(self.rule_results)

    def to_dict(self) -> Dict:
        return {
            "check_id": self.check_id,
            "check_timestamp": self.check_timestamp.isoformat(),
            "case_number": self.case_number,
            "case_name": self.case_name,
            "files_processed": self.files_processed,
            "summary": self.summary,
            "rule_results": [r.to_dict() for r in self.rule_results],
            "has_critical_issues": self.has_critical_issues,
            "issue_count": self.issue_count,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "CheckResult":
        rule_results = []
        for r in data.get("rule_results", []):
            rule_results.append(RuleResult.from_dict(r))
        check_timestamp = datetime.fromisoformat(data["check_timestamp"])
        result = cls(
            check_id=data["check_id"],
            check_timestamp=check_timestamp,
            case_number=data.get("case_number"),
            case_name=data.get("case_name"),
            files_processed=data.get("files_processed", []),
            summary=data.get("summary", {}),
            rule_results=rule_results,
        )
        result._update_summary()
        return result


@dataclass
class CheckSession(BaseModel):
    session_id: str
    created_at: datetime
    check_results: Dict[str, CheckResult] = field(default_factory=dict)
    evidence_catalog: Optional[Dict] = None
    timeline: Optional[Dict] = None
    objections: List[Dict] = field(default_factory=list)
    references: List[Dict] = field(default_factory=list)
    transcript_content: Optional[str] = None
    judgment_draft_content: Optional[str] = None
    _check_result: Optional[CheckResult] = None

    @property
    def check_result(self) -> Optional[CheckResult]:
        if self._check_result:
            return self._check_result
        if self.check_results:
            return next(iter(self.check_results.values()))
        return None

    @check_result.setter
    def check_result(self, value: Optional[CheckResult]) -> None:
        self._check_result = value
        if value:
            self.check_results[value.check_id] = value

    @property
    def timeline_data(self) -> Optional[Dict]:
        return self.timeline

    def to_dict(self) -> Dict:
        return {
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat(),
            "check_results": {k: v.to_dict() for k, v in self.check_results.items()},
            "evidence_catalog": self.evidence_catalog,
            "timeline": self.timeline,
            "objections": self.objections,
            "references": self.references,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "CheckSession":
        check_results = {}
        for k, v in data.get("check_results", {}).items():
            check_results[k] = CheckResult.from_dict(v)
        created_at = datetime.fromisoformat(data["created_at"])
        return cls(
            session_id=data["session_id"],
            created_at=created_at,
            check_results=check_results,
            evidence_catalog=data.get("evidence_catalog"),
            timeline=data.get("timeline"),
            objections=data.get("objections", []),
            references=data.get("references", []),
        )
