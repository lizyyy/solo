from typing import List, Dict, Tuple
from collections import defaultdict
from .base_rule import BaseRule, RuleContext
from ..models import ValidationResult


class DuplicateApplicationRule(BaseRule):
    rule_id = "R004"
    rule_name = "重复申请幂等校验"
    description = "检查是否存在重复的例外申请，同一时间段同一分支不应有多个重叠窗口"

    def validate(self, context: RuleContext) -> List[ValidationResult]:
        results = []

        key_to_exceptions = defaultdict(list)
        for exc in context.parse_result.exceptions:
            key = (exc.repository_id, exc.branch_pattern, exc.applicant)
            key_to_exceptions[key].append(exc)

        for key, exc_list in key_to_exceptions.items():
            if len(exc_list) > 1:
                exc_ids = [e.id for e in exc_list]
                results.append(
                    self._warn(
                        f"检测到重复申请模式: 仓库={key[0]}, 分支={key[1]}, 申请人={key[2]} 有 {len(exc_list)} 条申请",
                        details={
                            "repository_id": key[0],
                            "branch_pattern": key[1],
                            "applicant": key[2],
                            "exception_count": len(exc_list),
                            "exception_ids": exc_ids,
                        },
                        related_records=exc_ids,
                    )
                )

        key_to_windows = defaultdict(list)
        for window in context.parse_result.windows:
            key = (window.exception_id,)
            key_to_windows[key].append(window)

        for key, window_list in key_to_windows.items():
            if len(window_list) > 1:
                window_ids = [w.id for w in window_list]
                results.append(
                    self._warn(
                        f"检测到同一例外关联多个窗口: 例外={key[0]} 有 {len(window_list)} 个窗口",
                        details={
                            "exception_id": key[0],
                            "window_count": len(window_list),
                            "window_ids": window_ids,
                        },
                        related_records=[key[0]] + window_ids,
                    )
                )

        exc_map = {exc.id: exc for exc in context.parse_result.exceptions}
        repo_branch_windows = defaultdict(list)
        for window in context.parse_result.windows:
            exc = exc_map.get(window.exception_id)
            if exc:
                key = (exc.repository_id, exc.branch_pattern)
                repo_branch_windows[key].append(window)
            else:
                key = (f"unknown_{window.id}", "unknown")
                repo_branch_windows[key].append(window)

        for (repo_id, branch), windows in repo_branch_windows.items():
            if len(windows) < 2:
                continue
            overlapping = self._find_overlapping_windows(windows)
            for group in overlapping:
                window_ids = [w.id for w in group]
                results.append(
                    self._fail(
                        f"检测到重叠窗口: 仓库={repo_id}, 分支={branch} 有 {len(group)} 个窗口时间重叠",
                        details={
                            "repository_id": repo_id,
                            "branch_pattern": branch,
                            "window_count": len(group),
                            "window_ids": window_ids,
                            "windows": [
                                {
                                    "id": w.id,
                                    "start": w.start_time.isoformat(),
                                    "end": w.end_time.isoformat(),
                                }
                                for w in group
                            ],
                        },
                        related_records=window_ids,
                    )
                )

        if not results:
            results.append(self._pass("未检测到重复申请或重叠窗口"))

        return results

    def _find_overlapping_windows(self, windows: list) -> List[list]:
        if len(windows) < 2:
            return []

        sorted_windows = sorted(windows, key=lambda w: w.start_time)
        overlapping_groups = []

        for i in range(len(sorted_windows)):
            current_group = [sorted_windows[i]]
            for j in range(i + 1, len(sorted_windows)):
                if self._windows_overlap(sorted_windows[i], sorted_windows[j]):
                    current_group.append(sorted_windows[j])

            if len(current_group) > 1:
                existing = False
                for group in overlapping_groups:
                    if set(w.id for w in current_group) == set(w.id for w in group):
                        existing = True
                        break
                if not existing:
                    overlapping_groups.append(current_group)

        return overlapping_groups

    def _windows_overlap(self, w1, w2) -> bool:
        return w1.start_time < w2.end_time and w2.start_time < w1.end_time
