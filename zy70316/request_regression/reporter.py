import os
import json
from typing import Dict, List
from collections import defaultdict

from colorama import Fore, Style

from .models import ComparisonResult, FieldDiff, DiffType, SampleStatus
from .config import RegressionConfig


class Reporter:
    def __init__(self, config: RegressionConfig):
        self.config = config

    def generate_cli_report(
        self,
        comparisons: Dict[str, ComparisonResult],
        samples_by_group: Dict[str, List],
        bad_samples: List,
    ) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("请求回归测试报告")
        lines.append("=" * 80)
        lines.append("")

        total_samples = sum(len(samples) for samples in samples_by_group.values())
        passed = sum(1 for r in comparisons.values() if not r.has_diff or r.approved)
        failed = sum(1 for r in comparisons.values() if r.has_diff and not r.approved)

        lines.append(f"总样本数: {total_samples}")
        lines.append(f"通过: {Fore.GREEN}{passed}{Style.RESET_ALL}")
        lines.append(f"失败: {Fore.RED}{failed}{Style.RESET_ALL}")
        lines.append(f"坏样本: {Fore.YELLOW}{len(bad_samples)}{Style.RESET_ALL}")
        lines.append("")

        if bad_samples:
            lines.append(f"{Fore.YELLOW}问题样本列表:{Style.RESET_ALL}")
            lines.append("-" * 40)
            for sample in bad_samples:
                status_desc = {
                    SampleStatus.BAD: "样本格式错误",
                    SampleStatus.MISSING_HEADERS: "缺少必需头信息",
                    SampleStatus.DESENSITIZATION_FAILED: "脱敏失败",
                }.get(sample.status, sample.status.value)
                lines.append(f"  ID: {sample.id}, 分组: {sample.group}, 状态: {Fore.YELLOW}{status_desc}{Style.RESET_ALL}")
            lines.append("")

        grouped_comparisons = defaultdict(list)
        for result in comparisons.values():
            grouped_comparisons[result.sample_group].append(result)

        for group, results in grouped_comparisons.items():
            group_passed = sum(1 for r in results if not r.has_diff or r.approved)
            group_failed = sum(1 for r in results if r.has_diff and not r.approved)
            lines.append(f"分组: {Fore.CYAN}{group}{Style.RESET_ALL}")
            lines.append(f"  通过: {group_passed}, 失败: {group_failed}")

            for result in results:
                if not result.has_diff:
                    lines.append(f"    {Fore.GREEN}✓{Style.RESET_ALL} {result.sample_id} - 无差异")
                elif result.approved:
                    lines.append(f"    {Fore.CYAN}✓{Style.RESET_ALL} {result.sample_id} - 已批准 ({result.approval_record})")
                else:
                    lines.append(f"    {Fore.RED}✗{Style.RESET_ALL} {result.sample_id} - 存在差异 (严重度: {result.severity_score})")
                    self._print_diffs(lines, result.diffs)

            lines.append("")

        return "\n".join(lines)

    def _print_diffs(self, lines: List[str], diffs: List[FieldDiff], indent: str = "      ") -> None:
        by_type = defaultdict(list)
        for diff in diffs:
            by_type[diff.diff_type].append(diff)

        for diff_type, type_diffs in by_type.items():
            ignored = any(d.ignored for d in type_diffs)
            if ignored:
                lines.append(f"{indent}{Fore.MAGENTA}[忽略] {self._diff_type_name(diff_type)}{Style.RESET_ALL}")
            else:
                lines.append(f"{indent}{Fore.RED}[{self._diff_type_name(diff_type)}]{Style.RESET_ALL}")

            for diff in type_diffs:
                if diff.ignored:
                    prefix = f"{indent}  {Fore.MAGENTA}*{Style.RESET_ALL}"
                else:
                    prefix = f"{indent}  "

                lines.append(f"{prefix}{diff.path}:")

                if diff.diff_type == DiffType.NEW_FIELD:
                    lines.append(f"{prefix}    + 新值: {diff.new_value}")
                elif diff.diff_type == DiffType.MISSING_FIELD:
                    lines.append(f"{prefix}    - 旧值: {diff.old_value}")
                elif diff.diff_type in [DiffType.VALUE_CHANGED, DiffType.ERROR_MESSAGE]:
                    lines.append(f"{prefix}    - 旧值: {diff.old_value}")
                    lines.append(f"{prefix}    + 新值: {diff.new_value}")
                elif diff.diff_type == DiffType.ORDER_CHANGED:
                    lines.append(f"{prefix}    - 旧重复: {diff.old_value}")
                    lines.append(f"{prefix}    + 新重复: {diff.new_value}")

    def _diff_type_name(self, diff_type: DiffType) -> str:
        return {
            DiffType.NEW_FIELD: "新增字段",
            DiffType.MISSING_FIELD: "缺失字段",
            DiffType.VALUE_CHANGED: "值变更",
            DiffType.ORDER_CHANGED: "排序变更",
            DiffType.ERROR_MESSAGE: "错误信息变更",
        }.get(diff_type, diff_type.value)

    def generate_json_report(
        self,
        comparisons: Dict[str, ComparisonResult],
        samples_by_group: Dict[str, List],
        bad_samples: List,
        output_path: str,
    ) -> str:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        total_samples = sum(len(samples) for samples in samples_by_group.values())
        passed = sum(1 for r in comparisons.values() if not r.has_diff or r.approved)
        failed = sum(1 for r in comparisons.values() if r.has_diff and not r.approved)

        grouped = {}
        for group, samples in samples_by_group.items():
            group_comparisons = [c for c in comparisons.values() if c.sample_group == group]
            grouped[group] = {
                "total": len(samples),
                "passed": sum(1 for r in group_comparisons if not r.has_diff or r.approved),
                "failed": sum(1 for r in group_comparisons if r.has_diff and not r.approved),
                "comparisons": [c.to_dict() for c in group_comparisons],
            }

        report = {
            "summary": {
                "total": total_samples,
                "passed": passed,
                "failed": failed,
                "bad_samples": len(bad_samples),
            },
            "groups": grouped,
            "bad_samples": [s.to_dict() for s in bad_samples],
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        return output_path
