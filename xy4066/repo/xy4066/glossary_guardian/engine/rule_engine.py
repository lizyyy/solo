import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from typing import Any, Dict, List, Optional, Set, Tuple

from ..parsers.glossary_parser import (
    ForbiddenTerm,
    GlossaryEntry,
    GuestEntry,
)
from ..parsers.transcript_parser import TranscriptSegment


class IssueType(Enum):
    UNMATCHED_TERM = auto()
    FORBIDDEN_TERM = auto()
    DUPLICATE_ABBREVIATION = auto()
    CASE_INCONSISTENCY = auto()
    MULTIPLE_TRANSLATIONS = auto()
    NAME_ALIAS_CONFLICT = auto()
    INCONSISTENT_TRANSLATION = auto()


class IssueSeverity(Enum):
    CRITICAL = auto()
    HIGH = auto()
    MEDIUM = auto()
    LOW = auto()


@dataclass
class Issue:
    issue_type: IssueType
    severity: IssueSeverity
    message: str
    location: Optional[Dict[str, Any]] = None
    suggestion: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)
    discovered_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_type": self.issue_type.name,
            "severity": self.severity.name,
            "message": self.message,
            "location": self.location,
            "suggestion": self.suggestion,
            "details": self.details,
            "discovered_at": self.discovered_at,
        }


@dataclass
class RuleResult:
    issues: List[Issue] = field(default_factory=list)
    stats: Dict[str, int] = field(default_factory=dict)
    summary: str = ""

    def count_by_type(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for issue in self.issues:
            type_name = issue.issue_type.name
            counts[type_name] = counts.get(type_name, 0) + 1
        return counts

    def count_by_severity(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for issue in self.issues:
            severity_name = issue.severity.name
            counts[severity_name] = counts.get(severity_name, 0) + 1
        return counts


class RuleEngine:
    def __init__(
        self,
        glossary_entries: List[GlossaryEntry],
        forbidden_terms: List[ForbiddenTerm],
        guest_entries: List[GuestEntry],
        settings: Optional[Dict[str, Any]] = None,
    ):
        self.glossary_entries = glossary_entries
        self.forbidden_terms = forbidden_terms
        self.guest_entries = guest_entries
        self.settings = settings or {
            "similarity_threshold": 0.85,
            "case_sensitive": False,
            "ignore_punctuation": True,
            "min_term_length": 2,
        }

        self._build_indices()

    def _build_indices(self):
        self.chinese_to_english: Dict[str, Set[str]] = {}
        self.english_to_chinese: Dict[str, Set[str]] = {}
        self.abbreviation_to_entries: Dict[str, List[GlossaryEntry]] = {}
        self.chinese_patterns: Dict[str, List[Tuple[str, str]]] = {}

        for entry in self.glossary_entries:
            chinese = self._normalize_text(entry.chinese)
            english = self._normalize_text(entry.english)

            if chinese:
                if chinese not in self.chinese_to_english:
                    self.chinese_to_english[chinese] = set()
                self.chinese_to_english[chinese].add(english)

            if english:
                if english not in self.english_to_chinese:
                    self.english_to_chinese[english] = set()
                self.english_to_chinese[english].add(chinese)

            if entry.abbreviation:
                abbr = self._normalize_text(entry.abbreviation)
                if abbr not in self.abbreviation_to_entries:
                    self.abbreviation_to_entries[abbr] = []
                self.abbreviation_to_entries[abbr].append(entry)

        self.chinese_terms = list(self.chinese_to_english.keys())
        self.english_terms = list(self.english_to_chinese.keys())

    def _normalize_text(self, text: str) -> str:
        if not text:
            return ""

        text = text.strip()

        if not self.settings.get("case_sensitive", False):
            text = text.lower()

        if self.settings.get("ignore_punctuation", True):
            text = re.sub(r"[，。！？、；：「」『』（）【】《》〈〉—…·！？,;:\'\"()\[\]<>]", "", text)

        text = re.sub(r"\s+", " ", text)
        return text

    def check_all(self, segments: List[TranscriptSegment]) -> RuleResult:
        issues: List[Issue] = []

        issues.extend(self.check_unmatched_terms(segments))
        issues.extend(self.check_forbidden_terms(segments))
        issues.extend(self.check_duplicate_abbreviations(segments))
        issues.extend(self.check_case_inconsistency(segments))
        issues.extend(self.check_multiple_translations(segments))
        issues.extend(self.check_guest_name_conflicts(segments))

        stats = {
            "total_issues": len(issues),
            "segments_checked": len(segments),
            **self._count_issue_types(issues),
        }

        summary = self._generate_summary(stats, issues)

        return RuleResult(issues=issues, stats=stats, summary=summary)

    def check_unmatched_terms(self, segments: List[TranscriptSegment]) -> List[Issue]:
        issues: List[Issue] = []
        all_text = " ".join(s.text for s in segments)
        normalized_text = self._normalize_text(all_text)

        min_length = self.settings.get("min_term_length", 2)

        chinese_patterns = [t for t in self.chinese_terms if len(t) >= min_length]
        english_patterns = [t for t in self.english_terms if len(t) >= min_length]

        found_chinese: Set[str] = set()
        found_english: Set[str] = set()

        for segment in segments:
            seg_text = segment.text
            normalized_seg = self._normalize_text(seg_text)

            for chinese in chinese_patterns:
                if chinese in normalized_seg and chinese not in found_chinese:
                    expected_english = self.chinese_to_english.get(chinese, set())
                    found = False
                    for eng in expected_english:
                        if eng in normalized_seg:
                            found = True
                            break
                    if not found:
                        found_chinese.add(chinese)
                        issues.append(
                            Issue(
                                issue_type=IssueType.UNMATCHED_TERM,
                                severity=IssueSeverity.MEDIUM,
                                message=f"发现中文术语 '{chinese}'，但未找到对应英文译法",
                                location={
                                    "segment_id": segment.id,
                                    "speaker": segment.speaker,
                                    "text_context": seg_text[:100] if len(seg_text) > 100 else seg_text,
                                },
                                suggestion=f"建议使用译法: {', '.join(expected_english) if expected_english else '无推荐译法'}",
                                details={
                                    "chinese_term": chinese,
                                    "expected_english": list(expected_english),
                                },
                            )
                        )

            for english in english_patterns:
                if english in normalized_seg and english not in found_english:
                    expected_chinese = self.english_to_chinese.get(english, set())
                    found = False
                    for ch in expected_chinese:
                        if ch in normalized_seg:
                            found = True
                            break
                    if not found and expected_chinese:
                        found_english.add(english)
                        issues.append(
                            Issue(
                                issue_type=IssueType.UNMATCHED_TERM,
                                severity=IssueSeverity.MEDIUM,
                                message=f"发现英文术语 '{english}'，但未找到对应中文术语",
                                location={
                                    "segment_id": segment.id,
                                    "speaker": segment.speaker,
                                    "text_context": seg_text[:100] if len(seg_text) > 100 else seg_text,
                                },
                                suggestion=f"建议检查是否缺少中文术语: {', '.join(expected_chinese)}",
                                details={
                                    "english_term": english,
                                    "expected_chinese": list(expected_chinese),
                                },
                            )
                        )

        return issues

    def check_forbidden_terms(self, segments: List[TranscriptSegment]) -> List[Issue]:
        issues: List[Issue] = []

        for segment in segments:
            seg_text = segment.text
            normalized_seg = self._normalize_text(seg_text)

            for ft in self.forbidden_terms:
                forbidden = self._normalize_text(ft.term)
                if forbidden and forbidden in normalized_seg:
                    issues.append(
                        Issue(
                            issue_type=IssueType.FORBIDDEN_TERM,
                            severity=IssueSeverity.HIGH,
                            message=f"发现禁用术语: '{ft.term}'",
                            location={
                                "segment_id": segment.id,
                                "speaker": segment.speaker,
                                "text_context": seg_text[:100] if len(seg_text) > 100 else seg_text,
                            },
                            suggestion=f"建议替代: {ft.alternative}" if ft.alternative else "请联系客户确认",
                            details={
                                "forbidden_term": ft.term,
                                "reason": ft.reason,
                                "alternative": ft.alternative,
                                "category": ft.category,
                            },
                        )
                    )

        return issues

    def check_duplicate_abbreviations(self, segments: List[TranscriptSegment]) -> List[Issue]:
        issues: List[Issue] = []

        duplicate_abbrs = {
            abbr: entries
            for abbr, entries in self.abbreviation_to_entries.items()
            if len(entries) > 1
        }

        all_text = " ".join(s.text for s in segments)
        normalized_text = self._normalize_text(all_text)

        for abbr, entries in duplicate_abbrs.items():
            if abbr in normalized_text:
                issues.append(
                    Issue(
                        issue_type=IssueType.DUPLICATE_ABBREVIATION,
                        severity=IssueSeverity.HIGH,
                        message=f"缩写 '{abbr}' 存在多个对应术语",
                        location={"text_context": f"缩写 '{abbr}' 在文稿中出现"},
                        suggestion="请确认使用哪个术语的译法",
                        details={
                            "abbreviation": abbr,
                            "entries": [
                                {
                                    "chinese": e.chinese,
                                    "english": e.english,
                                    "category": e.category,
                                    "source": e.source,
                                }
                                for e in entries
                            ],
                        },
                    )
                )

        return issues

    def check_case_inconsistency(self, segments: List[TranscriptSegment]) -> List[Issue]:
        issues: List[Issue] = []

        english_terms_with_case: Dict[str, Set[str]] = {}
        for entry in self.glossary_entries:
            if entry.english:
                normalized = self._normalize_text(entry.english)
                if normalized not in english_terms_with_case:
                    english_terms_with_case[normalized] = set()
                english_terms_with_case[normalized].add(entry.english)

        all_text = " ".join(s.text for s in segments)
        words = re.findall(r"[A-Za-z]+(?:[-'’][A-Za-z]+)*", all_text)

        case_variants: Dict[str, Set[str]] = {}
        for word in words:
            normalized = word.lower()
            if normalized not in case_variants:
                case_variants[normalized] = set()
            case_variants[normalized].add(word)

        for normalized, variants in case_variants.items():
            if len(variants) > 1 and normalized in english_terms_with_case:
                expected_cases = english_terms_with_case[normalized]
                unexpected = variants - expected_cases
                if unexpected:
                    issues.append(
                        Issue(
                            issue_type=IssueType.CASE_INCONSISTENCY,
                            severity=IssueSeverity.MEDIUM,
                            message=f"术语大小写不一致: 发现 {', '.join(variants)}",
                            location={"text_context": f"术语 '{normalized}' 有多种大小写形式"},
                            suggestion=f"建议统一使用: {', '.join(expected_cases)}",
                            details={
                                "normalized_term": normalized,
                                "expected_cases": list(expected_cases),
                                "found_variants": list(variants),
                            },
                        )
                    )

        return issues

    def check_multiple_translations(self, segments: List[TranscriptSegment]) -> List[Issue]:
        issues: List[Issue] = []

        for chinese, english_set in self.chinese_to_english.items():
            if len(english_set) > 1:
                all_text = " ".join(s.text for s in segments)
                normalized_text = self._normalize_text(all_text)

                if chinese in normalized_text:
                    issues.append(
                        Issue(
                            issue_type=IssueType.MULTIPLE_TRANSLATIONS,
                            severity=IssueSeverity.HIGH,
                            message=f"中文术语 '{chinese}' 存在多个译法: {', '.join(english_set)}",
                            location={"text_context": f"术语 '{chinese}' 在文稿中出现"},
                            suggestion="请确认统一使用哪个译法",
                            details={
                                "chinese_term": chinese,
                                "available_translations": list(english_set),
                            },
                        )
                    )

        return issues

    def check_guest_name_conflicts(self, segments: List[TranscriptSegment]) -> List[Issue]:
        issues: List[Issue] = []

        all_text = " ".join(s.text for s in segments)
        normalized_text = self._normalize_text(all_text)

        name_to_guest: Dict[str, GuestEntry] = {}
        for guest in self.guest_entries:
            chinese_name = self._normalize_text(guest.chinese_name)
            if chinese_name:
                name_to_guest[chinese_name] = guest
            for alias in guest.aliases:
                alias_normalized = self._normalize_text(alias)
                if alias_normalized and alias_normalized not in name_to_guest:
                    name_to_guest[alias_normalized] = guest

        for segment in segments:
            seg_text = segment.text
            normalized_seg = self._normalize_text(seg_text)

            for name, guest in name_to_guest.items():
                if len(name) < 2:
                    continue
                if name in normalized_seg:
                    if guest.english_name:
                        expected_english = self._normalize_text(guest.english_name)
                        if expected_english not in normalized_seg:
                            issues.append(
                                Issue(
                                    issue_type=IssueType.NAME_ALIAS_CONFLICT,
                                    severity=IssueSeverity.MEDIUM,
                                    message=f"嘉宾 '{guest.chinese_name}' 可能缺少英文名 '{guest.english_name}'",
                                    location={
                                        "segment_id": segment.id,
                                        "speaker": segment.speaker,
                                        "text_context": seg_text[:100] if len(seg_text) > 100 else seg_text,
                                    },
                                    suggestion=f"请确认是否需要添加英文名: {guest.english_name}",
                                    details={
                                        "guest_chinese": guest.chinese_name,
                                        "guest_english": guest.english_name,
                                        "guest_title": guest.title,
                                        "guest_org": guest.organization,
                                    },
                                )
                            )

        return issues

    def _count_issue_types(self, issues: List[Issue]) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for issue in issues:
            type_name = issue.issue_type.name
            counts[type_name] = counts.get(type_name, 0) + 1
        return counts

    def _generate_summary(self, stats: Dict[str, Any], issues: List[Issue]) -> str:
        if not issues:
            return "未发现任何问题，所有检查通过！"

        severity_counts = {}
        for issue in issues:
            sev = issue.severity.name
            severity_counts[sev] = severity_counts.get(sev, 0) + 1

        type_counts = {}
        for issue in issues:
            typ = issue.issue_type.name
            type_counts[typ] = type_counts.get(typ, 0) + 1

        summary_parts = [
            f"共发现 {stats['total_issues']} 个问题",
            f"检查了 {stats['segments_checked']} 个片段",
            "",
            "按严重程度分类:",
        ]

        for sev, count in sorted(severity_counts.items()):
            summary_parts.append(f"  - {sev}: {count} 个")

        summary_parts.extend(["", "按问题类型分类:"])
        for typ, count in sorted(type_counts.items()):
            summary_parts.append(f"  - {typ}: {count} 个")

        return "\n".join(summary_parts)
