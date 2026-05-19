import re
from typing import List, Dict, Any, Tuple
from datetime import datetime

from .models import Silence, Alert, LabelMatcher, MatchResult


class LabelMatchEngine:
    def __init__(self):
        pass

    def match_silence_alert(self, silence: Silence, alert: Alert) -> Tuple[bool, Dict[str, Any]]:
        match_details = {
            "silence_id": silence.id,
            "matched_matchers": [],
            "unmatched_matchers": [],
            "total_matchers": len(silence.matchers),
        }

        if not silence.matchers:
            match_details["reason"] = "silence has no matchers"
            return False, match_details

        all_matched = True
        for matcher in silence.matchers:
            matched, matcher_detail = self._match_label(matcher, alert.labels)
            matcher_detail["matcher_name"] = matcher.name
            matcher_detail["matcher_value"] = matcher.value
            matcher_detail["is_regex"] = matcher.is_regex

            if matched:
                match_details["matched_matchers"].append(matcher_detail)
            else:
                match_details["unmatched_matchers"].append(matcher_detail)
                all_matched = False

        return all_matched, match_details

    def _match_label(self, matcher: LabelMatcher, labels: Dict[str, str]) -> Tuple[bool, Dict[str, Any]]:
        detail = {
            "label_name": matcher.name,
            "expected_value": matcher.value,
            "actual_value": labels.get(matcher.name),
            "match_type": "regex" if matcher.is_regex else "exact",
        }

        if matcher.name not in labels:
            detail["result"] = False
            detail["reason"] = "label not present"
            return False, detail

        actual_value = labels[matcher.name]
        detail["actual_value"] = actual_value

        if matcher.is_regex:
            try:
                pattern = re.compile(matcher.value)
                matched = bool(pattern.match(actual_value))
                detail["result"] = matched
                detail["reason"] = "regex matched" if matched else "regex did not match"
                return matched, detail
            except re.error as e:
                detail["result"] = False
                detail["reason"] = f"invalid regex: {str(e)}"
                return False, detail
        else:
            matched = (matcher.value == actual_value)
            detail["result"] = matched
            detail["reason"] = "exact match" if matched else "value mismatch"
            return matched, detail

    def match_all(self, silences: List[Silence], alerts: List[Alert]) -> List[MatchResult]:
        results = []
        for silence in silences:
            if silence.parse_error:
                continue

            matched_alerts = []
            match_details = []

            for alert in alerts:
                if alert.parse_error:
                    continue

                matched, detail = self.match_silence_alert(silence, alert)
                if matched:
                    matched_alerts.append(alert)
                    match_details.append(detail)

            results.append(MatchResult(
                silence=silence,
                matched_alerts=matched_alerts,
                match_details=match_details,
            ))

        return results

    def get_alert_covering_silences(self, alert: Alert, silences: List[Silence]) -> List[Silence]:
        covering_silences = []
        for silence in silences:
            if silence.parse_error:
                continue
            matched, _ = self.match_silence_alert(silence, alert)
            if matched:
                covering_silences.append(silence)
        return covering_silences


class SourceTracker:
    def __init__(self):
        self.silence_sources: Dict[str, List[Dict[str, Any]]] = {}
        self.alert_sources: Dict[str, List[Dict[str, Any]]] = {}

    def track_silence_source(self, silence: Silence) -> None:
        key = silence.id or f"{silence.created_by}-{hash(str(silence.matchers))}"
        if key not in self.silence_sources:
            self.silence_sources[key] = []
        self.silence_sources[key].append({
            "source_file": silence.source_file,
            "source_line": silence.source_line,
            "created_by": silence.created_by,
            "starts_at": silence.starts_at,
            "ends_at": silence.ends_at,
        })

    def track_alert_source(self, alert: Alert, identifier: str) -> None:
        if identifier not in self.alert_sources:
            self.alert_sources[identifier] = []
        self.alert_sources[identifier].append({
            "source_file": alert.source_file,
            "source_line": alert.source_line,
            "labels": alert.labels,
        })

    def get_silence_sources(self, silence_id: str) -> List[Dict[str, Any]]:
        return self.silence_sources.get(silence_id, [])

    def get_duplicate_silences(self) -> List[Tuple[str, List[Dict[str, Any]]]]:
        duplicates = []
        for key, sources in self.silence_sources.items():
            if len(sources) > 1:
                duplicates.append((key, sources))
        return duplicates

    def get_creator_summary(self) -> Dict[str, int]:
        creator_counts: Dict[str, int] = {}
        for sources in self.silence_sources.values():
            for source in sources:
                creator = source.get("created_by", "unknown")
                creator_counts[creator] = creator_counts.get(creator, 0) + 1
        return dict(sorted(creator_counts.items()))
