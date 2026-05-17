import re
from dataclasses import dataclass, field
from typing import List, Dict, Optional
from collections import defaultdict
from .reader import DeadLetterMessage


@dataclass
class ErrorGroup:
    reason: Optional[str]
    count: int = 0
    messages: List[DeadLetterMessage] = field(default_factory=list)
    percentage: float = 0.0


@dataclass
class GroupResult:
    groups: List[ErrorGroup] = field(default_factory=list)
    ungrouped: ErrorGroup = field(default_factory=lambda: ErrorGroup(reason="__ungrouped__"))
    total_messages: int = 0
    total_reasons: int = 0


class ErrorGrouper:
    def __init__(self, normalize_patterns: Optional[List[str]] = None):
        self.normalize_patterns = normalize_patterns or [
            (r"\b\d{13,19}\b", "[ID]"),
            (r"\b[A-Fa-f0-9-]{32,36}\b", "[UUID]"),
            (r"\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\S*", "[TIMESTAMP]"),
        ]

    def group(self, messages: List[DeadLetterMessage]) -> GroupResult:
        result = GroupResult()
        result.total_messages = len(messages)

        groups_dict: Dict[Optional[str], List[DeadLetterMessage]] = defaultdict(list)
        parse_error_group: List[DeadLetterMessage] = []

        for msg in messages:
            if msg.parse_error:
                parse_error_group.append(msg)
                continue

            normalized_reason = self._normalize_reason(msg.error_reason)
            groups_dict[normalized_reason].append(msg)

        for reason, msgs in sorted(groups_dict.items(), key=lambda x: len(x[1]), reverse=True):
            group = ErrorGroup(
                reason=reason,
                count=len(msgs),
                messages=msgs,
                percentage=len(msgs) / result.total_messages * 100 if result.total_messages > 0 else 0
            )
            result.groups.append(group)

        if parse_error_group:
            result.ungrouped = ErrorGroup(
                reason="__parse_errors__",
                count=len(parse_error_group),
                messages=parse_error_group,
                percentage=len(parse_error_group) / result.total_messages * 100 if result.total_messages > 0 else 0
            )

        result.total_reasons = len(result.groups)

        return result

    def _normalize_reason(self, reason: Optional[str]) -> Optional[str]:
        if reason is None:
            return "UNKNOWN"

        normalized = reason
        for pattern, replacement in self.normalize_patterns:
            if isinstance(pattern, str):
                pattern = re.compile(pattern)
            normalized = pattern.sub(replacement, normalized)

        return normalized.strip()
