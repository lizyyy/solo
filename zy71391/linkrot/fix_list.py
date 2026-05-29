from __future__ import annotations

from collections import defaultdict
from typing import Iterable

from .models import (
    CheckResult,
    CheckStatus,
    MaintainerGroup,
    ScanReport,
    Severity,
)


class FixListGenerator:
    def __init__(self, report: ScanReport):
        self.report = report

    def by_maintainer(self) -> list[MaintainerGroup]:
        groups: dict[str, list[CheckResult]] = defaultdict(list)
        for r in self.report.results:
            if r.source_doc is None:
                maintainer = "版本一致性问题"
            else:
                maintainer = r.source_doc.maintainer or "未指定维护人"
            groups[maintainer].append(r)

        result_groups: list[MaintainerGroup] = []
        for maintainer, results in sorted(
            groups.items(),
            key=lambda kv: -sum(1 for r in kv[1] if r.severity == Severity.CRITICAL),
        ):
            mg = MaintainerGroup(maintainer=maintainer)
            mg.results = sorted(
                results,
                key=lambda r: (
                    0 if r.severity == Severity.CRITICAL else
                    1 if r.severity == Severity.WARNING else 2,
                    r.source_doc.rel_path if r.source_doc else "",
                ),
            )
            result_groups.append(mg)

        return result_groups

    def by_file(self) -> dict[str, list[CheckResult]]:
        groups: dict[str, list[CheckResult]] = defaultdict(list)
        for r in self.report.results:
            if r.severity == Severity.INFO and r.status != CheckStatus.PENDING_REVIEW:
                continue
            if r.source_doc:
                key = r.source_doc.rel_path
            else:
                key = "版本/全局问题"
            groups[key].append(r)

        for k in groups:
            groups[k].sort(key=lambda r: (
                0 if r.severity == Severity.CRITICAL else
                1 if r.severity == Severity.WARNING else 2,
                r.link_ref.line_number if r.link_ref else 0,
            ))

        return dict(sorted(groups.items()))

    def by_severity(self) -> dict[Severity, list[CheckResult]]:
        groups: dict[Severity, list[CheckResult]] = defaultdict(list)
        for r in self.report.results:
            if r.status == CheckStatus.OK:
                continue
            groups[r.severity].append(r)

        return {
            Severity.CRITICAL: sorted(groups[Severity.CRITICAL], key=lambda r: self._file_key(r)),
            Severity.WARNING: sorted(groups[Severity.WARNING], key=lambda r: self._file_key(r)),
            Severity.INFO: sorted(groups[Severity.INFO], key=lambda r: self._file_key(r)),
        }

    @staticmethod
    def _file_key(r: CheckResult) -> str:
        if r.source_doc:
            return r.source_doc.rel_path
        return ""


def generate_fix_summary(fix_list: Iterable[CheckResult]) -> str:
    critical = 0
    warning = 0
    review = 0
    for r in fix_list:
        if r.status == CheckStatus.PENDING_REVIEW:
            review += 1
        elif r.severity == Severity.CRITICAL:
            critical += 1
        elif r.severity == Severity.WARNING:
            warning += 1

    parts = []
    if critical:
        parts.append(f"{critical} 个严重问题")
    if warning:
        parts.append(f"{warning} 个警告")
    if review:
        parts.append(f"{review} 条待人工复核")

    if not parts:
        return "没有需要修复的问题 ✅"

    return "需要处理：" + "，".join(parts)


def build_repair_tasks(results: list[CheckResult]) -> list[dict]:
    tasks = []
    for r in results:
        if r.severity == Severity.INFO and r.status != CheckStatus.PENDING_REVIEW:
            continue

        if r.link_ref:
            target = r.link_ref.raw_href
            line = r.link_ref.line_number
        else:
            target = ""
            line = 0

        task = {
            "file": r.source_doc.rel_path if r.source_doc else "版本扫描",
            "line": line,
            "status_label": r.status_label,
            "target": target,
            "problem": r.detail,
            "fix_suggestion": r.suggestion,
            "severity": r.severity.value,
        }
        tasks.append(task)
    return tasks
