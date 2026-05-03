from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple

from dateutil.parser import parse as parse_date

from .base import BaseRule, RuleContext
from ..models import (
    RuleResult,
    RuleType,
    Severity,
    Reference,
    ReferenceType,
)


class DateConflictRule(BaseRule):
    rule_name: str = "date_conflict"
    rule_type: RuleType = RuleType.DATE_CONFLICT
    default_severity: Severity = Severity.MEDIUM

    CHINESE_DATE_PATTERNS = [
        r"(\d{4})年(\d{1,2})月(\d{1,2})日",
        r"(\d{1,2})月(\d{1,2})日",
    ]

    def __init__(
        self,
        severity: Severity = Severity.MEDIUM,
        allow_year_mismatch: bool = False,
    ):
        super().__init__(severity)
        self.allow_year_mismatch = allow_year_mismatch

    def check(self, context: RuleContext) -> List[RuleResult]:
        self.results = []

        if not context.references:
            return self.results

        dates_by_evidence: Dict[str, List[Tuple[datetime, str, Optional[int]]]] = defaultdict(list)

        for ref in context.references:
            dates = self._extract_dates_from_reference(ref)
            for dt in dates:
                dates_by_evidence[ref.evidence_number].append((dt, ref.source_file, ref.line_number))

        for ev_num, date_entries in dates_by_evidence.items():
            if len(date_entries) < 2:
                continue

            self._check_conflicts(ev_num, date_entries)

        self._check_timeline_consistency(context)

        return self.results

    def _extract_dates_from_reference(self, ref: Reference) -> List[datetime]:
        dates = []

        if ref.reference_date:
            dates.append(ref.reference_date)

        if ref.description:
            extracted = self._parse_dates_from_text(ref.description)
            dates.extend(extracted)

        if ref.source_context:
            extracted = self._parse_dates_from_text(ref.source_context)
            dates.extend(extracted)

        return dates

    def _parse_dates_from_text(self, text: str) -> List[datetime]:
        dates = []

        try:
            parsed = parse_date(text, fuzzy=True)
            if parsed:
                dates.append(parsed)
        except Exception:
            pass

        import re
        for pattern in [r"\d{4}[-/]\d{1,2}[-/]\d{1,2}", r"\d{4}年\d{1,2}月\d{1,2}日"]:
            matches = re.findall(pattern, text)
            for match in matches:
                try:
                    if "年" in match:
                        match = match.replace("年", "-").replace("月", "-").replace("日", "")
                    parsed = parse_date(match)
                    if parsed:
                        dates.append(parsed)
                except Exception:
                    pass

        return dates

    def _check_conflicts(
        self,
        evidence_number: str,
        date_entries: List[Tuple[datetime, str, Optional[int]]],
    ) -> None:
        if len(date_entries) < 2:
            return

        dates = [d[0] for d in date_entries]

        unique_dates = set()
        for dt in dates:
            date_key = (dt.year, dt.month, dt.day) if not self.allow_year_mismatch else (dt.month, dt.day)
            unique_dates.add(date_key)

        if len(unique_dates) > 1:
            source_files = list({d[1] for d in date_entries})
            line_numbers = [d[2] for d in date_entries if d[2]]

            date_strs = [f"{d[0].year}年{d[0].month}月{d[0].day}日" for d in date_entries]

            message = (
                f"证据 [{evidence_number}] 在不同引用中有冲突的日期: {', '.join(set(date_strs))}"
            )
            suggestion = (
                f"请统一证据 [{evidence_number}] 的日期引用，涉及文件: {', '.join(source_files)}"
            )

            self.add_result(
                message=message,
                evidence_number=evidence_number,
                source_files=source_files,
                line_numbers=line_numbers if line_numbers else None,
                context={
                    "conflicting_dates": [
                        {
                            "date": d[0].isoformat(),
                            "source_file": d[1],
                            "line_number": d[2],
                        }
                        for d in date_entries
                    ],
                },
                suggestion=suggestion,
            )

    def _check_timeline_consistency(self, context: RuleContext) -> None:
        if not context.timeline_data:
            return

        timeline_events = context.timeline_data.get("events", {})
        if not timeline_events:
            return

        sorted_events = sorted(
            timeline_events.values(),
            key=lambda x: x.get("event_date", "")
        )

        for i in range(1, len(sorted_events)):
            prev_event = sorted_events[i - 1]
            curr_event = sorted_events[i]

            try:
                prev_date = parse_date(prev_event.get("event_date", ""))
                curr_date = parse_date(curr_event.get("event_date", ""))

                if curr_date < prev_date:
                    message = (
                        f"时间线顺序异常: 事件 [{curr_event.get('description', '未知')}] "
                        f"({curr_date.date()}) 早于前一事件 [{prev_event.get('description', '未知')}] ({prev_date.date()})"
                    )
                    suggestion = "请检查时间线事件的日期顺序是否正确"

                    self.add_result(
                        message=message,
                        evidence_number=None,
                        source_files=[prev_event.get("source_file"), curr_event.get("source_file")],
                        context={
                            "prev_event": prev_event,
                            "curr_event": curr_event,
                            "prev_date": prev_date.isoformat(),
                            "curr_date": curr_date.isoformat(),
                        },
                        suggestion=suggestion,
                    )
            except Exception:
                pass
