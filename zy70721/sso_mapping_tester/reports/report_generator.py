import json
import csv
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from ..core.validator import UserMappingResult
from ..core.playback import PlaybackResult
from ..core.conflict_detector import ConflictDetectionResult
from ..parsers.base_parser import ParseResult
from ..utils.hash import stable_dict


class ReportGenerator:
    def __init__(
        self,
        mapping_results: List[UserMappingResult],
        playback_results: List[PlaybackResult],
        conflict_results: List[ConflictDetectionResult],
        parse_results: Dict[str, ParseResult],
    ):
        self.mapping_results = mapping_results
        self.playback_results = playback_results
        self.conflict_results = conflict_results
        self.parse_results = parse_results

    def _get_summary(self) -> Dict[str, Any]:
        total_users = len(self.mapping_results)
        failed_mapping = sum(1 for r in self.mapping_results if not r.success)

        total_test_users = len(self.playback_results)
        matched_users = sum(1 for r in self.playback_results if r.matched)
        diff_users = sum(1 for r in self.playback_results if r.has_diffs)

        total_conflicts = sum(len(r.conflicts) for r in self.conflict_results)
        conflict_users = sum(1 for r in self.conflict_results if r.has_conflicts)

        parse_errors = []
        for name, pr in self.parse_results.items():
            for err in pr.errors:
                parse_errors.append({
                    "category": name,
                    **err.to_dict(),
                })

        return stable_dict({
            "generated_at": datetime.now().isoformat(),
            "mapping": {
                "total_users": total_users,
                "success_count": total_users - failed_mapping,
                "failed_count": failed_mapping,
                "success_rate": (total_users - failed_mapping) / total_users if total_users > 0 else 0,
            },
            "playback": {
                "total_test_users": total_test_users,
                "matched_count": matched_users,
                "diff_count": diff_users,
                "match_rate": matched_users / total_test_users if total_test_users > 0 else 0,
            },
            "conflicts": {
                "total_conflicts": total_conflicts,
                "conflict_user_count": conflict_users,
            },
            "parse_errors": parse_errors,
            "has_errors": failed_mapping > 0 or len(parse_errors) > 0 or total_conflicts > 0 or diff_users > 0,
        })

    def generate_json(self, output_path: str, include_details: bool = True) -> None:
        report = {
            "summary": self._get_summary(),
        }

        if include_details:
            report["mapping_results"] = [r.to_dict() for r in self.mapping_results]
            report["playback_results"] = [r.to_dict() for r in self.playback_results]
            report["conflict_results"] = [r.to_dict() for r in self.conflict_results]

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

    def generate_csv(self, output_dir: str) -> None:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        with open(output_path / "mapping_errors.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "user_id", "field_name", "error_message",
                "source_file", "line_number", "source_value", "mapped_value",
            ])
            for result in self.mapping_results:
                for error in result.errors:
                    writer.writerow([
                        result.user_id,
                        error.field_name,
                        error.error_message,
                        error.source_trace.get("source_file", ""),
                        error.source_trace.get("line_number", ""),
                        error.source_value,
                        error.mapped_value,
                    ])

        with open(output_path / "playback_diffs.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "user_id", "field_name", "diff_type", "expected", "actual",
                "test_source_file", "test_line_number",
            ])
            for result in self.playback_results:
                for diff in result.attribute_diffs:
                    writer.writerow([
                        result.user_id,
                        diff.field_name,
                        diff.diff_type,
                        diff.expected,
                        diff.actual,
                        result.test_user.source_file,
                        result.test_user.line_number,
                    ])

        with open(output_path / "conflicts.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "user_id", "conflict_type", "role_name", "expected", "actual",
                "description", "severity", "source_file", "line_number",
            ])
            for result in self.conflict_results:
                for conflict in result.conflicts:
                    writer.writerow([
                        result.user_id,
                        conflict.conflict_type.value,
                        conflict.role_name,
                        conflict.expected,
                        conflict.actual,
                        conflict.description,
                        conflict.severity,
                        conflict.source_trace.get("source_file", "") if conflict.source_trace else "",
                        conflict.source_trace.get("line_number", "") if conflict.source_trace else "",
                    ])

        with open(output_path / "parse_errors.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "category", "file_path", "line_number", "error_type", "message", "raw_line",
            ])
            for name, pr in self.parse_results.items():
                for err in pr.errors:
                    writer.writerow([
                        name,
                        err.file_path,
                        err.line_number,
                        err.error_type,
                        err.message,
                        err.raw_line,
                    ])

    def generate_markdown(self, output_path: str, include_details: bool = True) -> None:
        summary = self._get_summary()
        lines = []

        lines.append("# SSO 属性映射测试报告")
        lines.append("")
        lines.append(f"**生成时间**: {summary['generated_at']}")
        lines.append("")

        lines.append("## 执行摘要")
        lines.append("")

        lines.append("### 属性映射验证")
        lines.append(f"- 总用户数: {summary['mapping']['total_users']}")
        lines.append(f"- 成功: {summary['mapping']['success_count']}")
        lines.append(f"- 失败: {summary['mapping']['failed_count']}")
        lines.append(f"- 成功率: {summary['mapping']['success_rate']:.2%}")
        lines.append("")

        lines.append("### 测试用户回放")
        lines.append(f"- 总测试用户数: {summary['playback']['total_test_users']}")
        lines.append(f"- 匹配: {summary['playback']['matched_count']}")
        lines.append(f"- 差异: {summary['playback']['diff_count']}")
        lines.append(f"- 匹配率: {summary['playback']['match_rate']:.2%}")
        lines.append("")

        lines.append("### 角色冲突检测")
        lines.append(f"- 总冲突数: {summary['conflicts']['total_conflicts']}")
        lines.append(f"- 有冲突用户数: {summary['conflicts']['conflict_user_count']}")
        lines.append("")

        if summary["parse_errors"]:
            lines.append("### 解析错误")
            lines.append(f"- 总错误数: {len(summary['parse_errors'])}")
            lines.append("")

        if include_details:
            lines.append("## 详细报告")
            lines.append("")

            failed_mappings = [r for r in self.mapping_results if not r.success]
            if failed_mappings:
                lines.append("### 属性映射错误详情")
                lines.append("")
                for result in failed_mappings[:20]:
                    lines.append(f"#### 用户: {result.user_id}")
                    for error in result.errors:
                        lines.append(f"- **{error.field_name}**: {error.error_message}")
                        lines.append(f"  - 源值: `{error.source_value}`")
                        lines.append(f"  - 映射值: `{error.mapped_value}`")
                        if error.source_trace:
                            lines.append(f"  - 源位置: {error.source_trace.get('source_file')}:{error.source_trace.get('line_number')}")
                    lines.append("")
                if len(failed_mappings) > 20:
                    lines.append(f"... 还有 {len(failed_mappings) - 20} 个用户有映射错误")
                    lines.append("")

            diff_playbacks = [r for r in self.playback_results if r.has_diffs]
            if diff_playbacks:
                lines.append("### 回放差异详情")
                lines.append("")
                for result in diff_playbacks[:20]:
                    lines.append(f"#### 用户: {result.user_id}")
                    for diff in result.attribute_diffs:
                        lines.append(f"- **{diff.field_name}** ({diff.diff_type}):")
                        lines.append(f"  - 期望: `{diff.expected}`")
                        lines.append(f"  - 实际: `{diff.actual}`")
                    if result.expected_roles != result.actual_roles:
                        lines.append(f"- **角色差异**:")
                        lines.append(f"  - 期望: `{', '.join(result.expected_roles)}`")
                        lines.append(f"  - 实际: `{', '.join(result.actual_roles)}`")
                    lines.append("")
                if len(diff_playbacks) > 20:
                    lines.append(f"... 还有 {len(diff_playbacks) - 20} 个用户有回放差异")
                    lines.append("")

            conflict_results = [r for r in self.conflict_results if r.has_conflicts]
            if conflict_results:
                lines.append("### 角色冲突详情")
                lines.append("")
                for result in conflict_results[:20]:
                    lines.append(f"#### 用户: {result.user_id}")
                    for conflict in result.conflicts:
                        lines.append(f"- **{conflict.conflict_type.value}** ({conflict.severity}): {conflict.description}")
                    lines.append("")
                if len(conflict_results) > 20:
                    lines.append(f"... 还有 {len(conflict_results) - 20} 个用户有角色冲突")
                    lines.append("")

        if summary["has_errors"]:
            lines.append("## ⚠️ 检测到错误")
            lines.append("")
            lines.append("请查看详细报告中的错误信息，并根据源文件位置进行修正。")
        else:
            lines.append("## ✅ 所有检查通过")
            lines.append("")
            lines.append("所有属性映射验证、测试用户回放和角色冲突检测均已通过。")

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def generate_all(self, output_dir: str) -> None:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        self.generate_json(output_path / "report.json", include_details=True)
        self.generate_json(output_path / "report_summary.json", include_details=False)
        self.generate_csv(output_path / "csv")
        self.generate_markdown(output_path / "report.md", include_details=True)
