from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from typing import Any, Dict, List, Optional, Set


class CheckSeverity(Enum):
    CRITICAL = auto()
    ERROR = auto()
    WARNING = auto()
    INFO = auto()


class CheckType(Enum):
    KEY_MISSING = auto()
    KEY_EXTRA = auto()
    PLACEHOLDER_MISMATCH = auto()
    PLACEHOLDER_ORDER = auto()
    ICU_PLURAL_MISMATCH = auto()
    LENGTH_EXCEEDED = auto()
    FORBIDDEN_WORD = auto()
    EMPTY_TRANSLATION = auto()
    INVALID_JSON = auto()


@dataclass
class PlaceholderRule:
    pattern: str
    description: str
    example: str
    allow_any_order: bool = False
    preserve_case: bool = True
    
    def extract(self, text: str) -> List[str]:
        matches = re.findall(self.pattern, text)
        return [m if isinstance(m, str) else ''.join(m) for m in matches]
    
    def validate(self, source_placeholders: List[str], 
                 translated_placeholders: List[str]) -> Dict[str, Any]:
        source_set = set(source_placeholders)
        translated_set = set(translated_placeholders)
        
        missing = source_set - translated_set
        extra = translated_set - source_set
        issues: List[str] = []
        
        if missing:
            issues.append(f"Missing placeholders: {', '.join(missing)}")
        if extra:
            issues.append(f"Extra placeholders: {', '.join(extra)}")
        
        if not self.allow_any_order and source_placeholders != translated_placeholders:
            if source_set == translated_set:
                issues.append("Placeholder order mismatch")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "source_count": len(source_placeholders),
            "translated_count": len(translated_placeholders),
        }


@dataclass
class LengthBudget:
    language: str
    max_length: int
    max_characters: int
    ratio_to_source: float = 1.0
    description: str = ""


@dataclass
class ForbiddenRule:
    word: str
    languages: List[str]
    severity: CheckSeverity
    reason: str = ""


@dataclass
class LanguageEntry:
    key: str
    language: str
    text: str
    context: str = ""
    note: str = ""
    length: int = 0
    pixel_width: Optional[int] = None
    
    def __post_init__(self):
        if not self.length:
            self.length = len(self.text)


@dataclass
class TranslationResource:
    name: str
    source_language: str
    target_languages: List[str]
    entries: Dict[str, Dict[str, LanguageEntry]] = field(default_factory=dict)
    source_file: str = ""
    format: str = "json"
    
    def add_entry(self, entry: LanguageEntry):
        if entry.key not in self.entries:
            self.entries[entry.key] = {}
        self.entries[entry.key][entry.language] = entry
    
    def get_keys(self) -> Set[str]:
        return set(self.entries.keys())
    
    def get_entry(self, key: str, language: str) -> Optional[LanguageEntry]:
        return self.entries.get(key, {}).get(language)
    
    def get_language_entries(self, language: str) -> Dict[str, LanguageEntry]:
        result = {}
        for key, lang_map in self.entries.items():
            if language in lang_map:
                result[key] = lang_map[language]
        return result


@dataclass
class CheckIssue:
    check_type: CheckType
    severity: CheckSeverity
    key: str
    language: str
    message: str
    source_text: str = ""
    translated_text: str = ""
    context: str = ""
    suggestion: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "check_type": self.check_type.name,
            "severity": self.severity.name,
            "key": self.key,
            "language": self.language,
            "message": self.message,
            "source_text": self.source_text,
            "translated_text": self.translated_text,
            "context": self.context,
            "suggestion": self.suggestion,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class ReviewDecision:
    key: str
    language: str
    approved: bool
    reviewer: str
    comment: str = ""
    issue_checksum: str = ""
    timestamp: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "key": self.key,
            "language": self.language,
            "approved": self.approved,
            "reviewer": self.reviewer,
            "comment": self.comment,
            "issue_checksum": self.issue_checksum,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class CheckResult:
    resource_name: str
    total_keys: int
    languages_checked: List[str]
    issues: List[CheckIssue] = field(default_factory=list)
    reviewed_decisions: List[ReviewDecision] = field(default_factory=list)
    
    @property
    def critical_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == CheckSeverity.CRITICAL)
    
    @property
    def error_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == CheckSeverity.ERROR)
    
    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == CheckSeverity.WARNING)
    
    @property
    def info_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == CheckSeverity.INFO)
    
    @property
    def is_clean(self) -> bool:
        return len(self.issues) == 0
    
    @property
    def needs_attention(self) -> bool:
        return self.critical_count > 0 or self.error_count > 0
    
    def get_issues_by_severity(self, severity: CheckSeverity) -> List[CheckIssue]:
        return [i for i in self.issues if i.severity == severity]
    
    def get_issues_by_language(self, language: str) -> List[CheckIssue]:
        return [i for i in self.issues if i.language == language]
    
    def get_issues_by_key(self, key: str) -> List[CheckIssue]:
        return [i for i in self.issues if i.key == key]
    
    def get_approved_issues(self) -> List[CheckIssue]:
        approved = []
        for issue in self.issues:
            for decision in self.reviewed_decisions:
                if (decision.key == issue.key and 
                    decision.language == issue.language and 
                    decision.approved):
                    approved.append(issue)
                    break
        return approved
    
    def get_unresolved_issues(self) -> List[CheckIssue]:
        resolved_checksums = {d.issue_checksum for d in self.reviewed_decisions if d.approved}
        return [i for i in self.issues if self._issue_checksum(i) not in resolved_checksums]
    
    def _issue_checksum(self, issue: CheckIssue) -> str:
        import hashlib
        content = f"{issue.key}:{issue.language}:{issue.check_type.name}:{issue.message}"
        return hashlib.md5(content.encode()).hexdigest()


@dataclass
class ProjectConfig:
    name: str
    version: str
    source_language: str
    target_languages: List[str]
    placeholder_rules: List[PlaceholderRule] = field(default_factory=list)
    length_budgets: Dict[str, LengthBudget] = field(default_factory=dict)
    forbidden_words: List[ForbiddenRule] = field(default_factory=list)
    resource_paths: Dict[str, str] = field(default_factory=dict)
    output_directory: str = "./output"
    
    def default_placeholder_rules(self) -> List[PlaceholderRule]:
        return [
            PlaceholderRule(
                pattern=r'\{(\w+)\}',
                description="Braced variables like {player_name}",
                example="{player_name}",
                allow_any_order=False
            ),
            PlaceholderRule(
                pattern=r'\[(\w+)\]',
                description="Bracketed variables like [item_name]",
                example="[item_name]",
                allow_any_order=False
            ),
            PlaceholderRule(
                pattern=r'%(\d+\$)?[sd]',
                description="printf-style like %s, %d, %1$s",
                example="%1$s",
                allow_any_order=False
            ),
        ]
