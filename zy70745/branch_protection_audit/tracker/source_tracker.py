from typing import List, Dict, Any, Set
from dataclasses import dataclass
from collections import defaultdict
from ..models import ParseResult, AuditConclusion, SourceLocation


@dataclass
class TrackedRecord:
    record_id: str
    record_type: str
    source_locations: List[SourceLocation]
    related_ids: List[str]
    issues: List[Dict[str, Any]]


class SourceTracker:
    def __init__(self):
        self.record_sources: Dict[str, List[SourceLocation]] = {}
        self.file_records: Dict[str, List[str]] = defaultdict(list)
        self.bad_records: List[TrackedRecord] = []

    def track_parse_result(self, parse_result: ParseResult):
        for repo in parse_result.repositories:
            self._track_source(repo.id, "repository", repo.source)
        for exc in parse_result.exceptions:
            self._track_source(exc.id, "exception", exc.source)
        for window in parse_result.windows:
            self._track_source(window.id, "window", window.source)
        for recovery in parse_result.recoveries:
            self._track_source(recovery.id, "recovery", recovery.source)

    def _track_source(self, record_id: str, record_type: str, source: SourceLocation):
        if record_id not in self.record_sources:
            self.record_sources[record_id] = []
        self.record_sources[record_id].append(source)

        file_path = source.file_path
        self.file_records[file_path].append(record_id)

    def track_audit_conclusion(self, conclusion: AuditConclusion):
        for record in conclusion.records:
            issues = []
            for validation in record.validations:
                if validation.status in ["FAIL", "WARN"]:
                    issues.append(
                        {
                            "rule_id": validation.rule_id,
                            "rule_name": validation.rule_name,
                            "status": validation.status,
                            "message": validation.message,
                            "level": validation.level,
                            "details": validation.details,
                        }
                    )

            if issues:
                tracked = TrackedRecord(
                    record_id=record.record_id,
                    record_type=record.record_type,
                    source_locations=self.record_sources.get(record.record_id, []),
                    related_ids=record.validations[0].related_records
                    if record.validations
                    else [],
                    issues=issues,
                )
                self.bad_records.append(tracked)

    def get_source_summary(self) -> Dict[str, Any]:
        files_with_issues = set()
        for record in self.bad_records:
            for source in record.source_locations:
                files_with_issues.add(source.file_path)

        return {
            "总问题记录数": len(self.bad_records),
            "涉及文件数": len(files_with_issues),
            "问题文件列表": sorted(list(files_with_issues)),
            "按文件统计问题": self._get_issues_by_file(),
            "按问题类型统计": self._get_issues_by_type(),
        }

    def _get_issues_by_file(self) -> Dict[str, List[Dict[str, Any]]]:
        file_issues = defaultdict(list)
        for record in self.bad_records:
            for source in record.source_locations:
                for issue in record.issues:
                    file_issues[source.file_path].append(
                        {
                            "record_id": record.record_id,
                            "record_type": record.record_type,
                            "line_number": source.line_number,
                            "row_index": source.row_index,
                            "sheet_name": source.sheet_name,
                            "issue_message": issue["message"],
                            "issue_status": issue["status"],
                            "rule_id": issue["rule_id"],
                        }
                    )
        return dict(file_issues)

    def _get_issues_by_type(self) -> Dict[str, int]:
        type_counts = defaultdict(int)
        for record in self.bad_records:
            for issue in record.issues:
                type_counts[issue["status"]] += 1
        return dict(type_counts)

    def get_bad_records_with_locations(self) -> List[Dict[str, Any]]:
        result = []
        for record in sorted(self.bad_records, key=lambda r: r.record_id):
            locations = []
            for source in record.source_locations:
                locations.append(
                    {
                        "file_path": source.file_path,
                        "sheet_name": source.sheet_name,
                        "line_number": source.line_number,
                        "row_index": source.row_index,
                        "location_string": source.get_location_str(),
                    }
                )

            result.append(
                {
                    "record_id": record.record_id,
                    "record_type": record.record_type,
                    "source_locations": locations,
                    "related_ids": record.related_ids,
                    "issues": record.issues,
                    "issue_count": len(record.issues),
                }
            )
        return result
