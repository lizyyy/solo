from dataclasses import dataclass
from typing import List, Dict, Optional, Any
from collections import defaultdict

from ..models import (
    Repository,
    Dependency,
    OwnerOpinion,
    ExtensionRequest,
    UpgradeBatch,
    SourceLocation,
    BadRow,
)
from ..parsers import ParseResult
from ..engine import ValidationResult


@dataclass
class SourceTrace:
    repo_name: str
    repository_source: Optional[SourceLocation]
    opinion_sources: List[SourceLocation]
    extension_sources: List[SourceLocation]
    batch_sources: List[SourceLocation]


class SourceTracker:
    def __init__(self, parse_result: ParseResult):
        self.parse_result = parse_result
        self._traces: Dict[str, SourceTrace] = {}
        self._build_traces()

    def _build_traces(self):
        for repo in self.parse_result.repositories:
            self._traces[repo.name] = SourceTrace(
                repo_name=repo.name,
                repository_source=repo.source,
                opinion_sources=[],
                extension_sources=[],
                batch_sources=[],
            )

        for opinion in self.parse_result.owner_opinions:
            if opinion.repo_name in self._traces:
                self._traces[opinion.repo_name].opinion_sources.append(opinion.source)

        for ext in self.parse_result.extension_requests:
            if ext.repo_name in self._traces:
                self._traces[ext.repo_name].extension_sources.append(ext.source)

        for batch in self.parse_result.upgrade_batches:
            for repo_name in self._traces:
                self._traces[repo_name].batch_sources.append(batch.source)

    def get_trace(self, repo_name: str) -> Optional[SourceTrace]:
        return self._traces.get(repo_name)

    def get_all_traces(self) -> List[SourceTrace]:
        return sorted(self._traces.values(), key=lambda t: t.repo_name)

    def get_sources_summary(self) -> Dict[str, List[str]]:
        summary: Dict[str, List[str]] = defaultdict(list)
        for trace in self._traces.values():
            if trace.repository_source:
                summary[trace.repository_source.file_path].append(f"{trace.repo_name}: 仓库信息")
            for src in trace.opinion_sources:
                summary[src.file_path].append(f"{trace.repo_name}: 负责人意见")
            for src in trace.extension_sources:
                summary[src.file_path].append(f"{trace.repo_name}: 延期申请")
        return dict(summary)


class AuditTrail:
    def __init__(self, parse_result: ParseResult, validation_result: ValidationResult):
        self.parse_result = parse_result
        self.validation_result = validation_result
        self.source_tracker = SourceTracker(parse_result)

    def generate_audit_report(self) -> List[Dict[str, Any]]:
        report = []
        for status in self.validation_result.repo_statuses:
            trace = self.source_tracker.get_trace(status.repo_name)
            repo_info = {
                "repo_name": status.repo_name,
                "decision": status.decision,
                "can_upgrade": status.can_upgrade,
                "approved_packages": status.approved_packages,
                "issues_count": len(status.issues),
                "issues": [
                    {
                        "level": i.level,
                        "message": i.message,
                        "package_name": i.package_name,
                        "rule_name": i.rule_name,
                    }
                    for i in status.issues
                ],
                "sources": {
                    "repository": str(trace.repository_source) if trace and trace.repository_source else None,
                    "opinions": [str(s) for s in (trace.opinion_sources if trace else [])],
                    "extensions": [str(s) for s in (trace.extension_sources if trace else [])],
                } if trace else {},
            }
            report.append(repo_info)
        return sorted(report, key=lambda x: x["repo_name"])

    def get_bad_rows_report(self) -> List[Dict[str, Any]]:
        return [
            {
                "source": str(row.source),
                "error_type": row.error_type,
                "error_message": row.error_message,
                "raw_data": row.raw_data,
            }
            for row in sorted(self.parse_result.bad_rows, key=lambda r: (r.source.file_path, r.source.row_number or 0))
        ]

    def get_statistics(self) -> Dict[str, Any]:
        return {
            "total_repos": len(self.parse_result.repositories),
            "total_dependencies": len(self.parse_result.dependencies),
            "total_opinions": len(self.parse_result.owner_opinions),
            "total_extensions": len(self.parse_result.extension_requests),
            "total_batches": len(self.parse_result.upgrade_batches),
            "bad_rows_count": len(self.parse_result.bad_rows),
            "validation": {
                "approved": self.validation_result.approved_count,
                "rejected": self.validation_result.rejected_count,
                "need_extension": self.validation_result.need_extension_count,
                "pending": self.validation_result.pending_count,
            },
            "issues_by_level": {
                "error": sum(1 for i in self.validation_result.all_issues if i.level == "error"),
                "warning": sum(1 for i in self.validation_result.all_issues if i.level == "warning"),
                "info": sum(1 for i in self.validation_result.all_issues if i.level == "info"),
            },
        }
