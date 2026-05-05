"""报告生成器 - 生成 Markdown 报告和 JSON 明细"""

import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .models import TestResult, ValidationMatrix, ValidationStatus


class Reporter:
    """报告生成器"""

    @classmethod
    def generate_markdown(
        cls,
        matrix: ValidationMatrix,
        output_path: str,
        include_details: bool = True,
    ) -> str:
        """生成 Markdown 格式的报告

        Args:
            matrix: 验证矩阵
            output_path: 输出文件路径
            include_details: 是否包含详细输出

        Returns:
            生成的 Markdown 内容
        """
        lines = []

        lines.append(f"# CLI 契约验证报告")
        lines.append("")
        lines.append(f"**契约名称**: {matrix.contract_name}")
        lines.append(f"**版本**: {matrix.contract_version}")
        lines.append(f"**生成时间**: {matrix.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 执行概览")
        lines.append("")
        lines.append("| 状态 | 数量 | 占比 |")
        lines.append("|------|------|------|")

        total = matrix.total_tests
        if total > 0:
            lines.append(
                f"| ✅ 通过 | {matrix.passed_tests} | "
                f"{matrix.passed_tests / total * 100:.1f}% |"
            )
            lines.append(
                f"| ❌ 失败 | {matrix.failed_tests} | "
                f"{matrix.failed_tests / total * 100:.1f}% |"
            )
            lines.append(
                f"| ⚠️  错误 | {matrix.error_tests} | "
                f"{matrix.error_tests / total * 100:.1f}% |"
            )
            lines.append(
                f"| ⏭️  跳过 | {matrix.skipped_tests} | "
                f"{matrix.skipped_tests / total * 100:.1f}% |"
            )
        lines.append("")

        lines.append("## 子命令执行矩阵")
        lines.append("")

        subcommand_results: Dict[str, List[TestResult]] = defaultdict(list)
        for result in matrix.results:
            subcommand_results[result.subcommand_name].append(result)

        for subcommand, results in subcommand_results.items():
            passed = sum(1 for r in results if r.status == ValidationStatus.PASS)
            lines.append(f"### {subcommand}")
            lines.append("")
            lines.append(f"**通过率**: {passed}/{len(results)} ({passed/len(results)*100:.1f}%)")
            lines.append("")
            lines.append("| 测试用例 | 状态 | 耗时 | 退出码 |")
            lines.append("|----------|------|------|--------|")

            for result in results:
                status_icon = cls._status_to_icon(result.status)
                lines.append(
                    f"| {result.test_case_name} | {status_icon} {result.status.value.upper()} | "
                    f"{result.duration_seconds:.3f}s | {result.actual_exit_code} |"
                )
            lines.append("")

        if include_details:
            lines.append("## 详细结果")
            lines.append("")

            for result in matrix.results:
                if result.status == ValidationStatus.PASS:
                    continue

                lines.append(f"### {result.subcommand_name} - {result.test_case_name}")
                lines.append("")
                lines.append(f"**状态**: {cls._status_to_icon(result.status)} {result.status.value.upper()}")
                lines.append(f"**命令**: `{result.command}`")
                lines.append(f"**期望退出码**: {result.expected_exit_code}")
                lines.append(f"**实际退出码**: {result.actual_exit_code}")
                lines.append(f"**耗时**: {result.duration_seconds:.3f}s")
                lines.append("")

                if result.failures:
                    lines.append("**失败原因**:")
                    lines.append("")
                    for failure in result.failures:
                        lines.append(f"- {failure}")
                    lines.append("")

                if result.actual_stdout:
                    lines.append("**stdout**:")
                    lines.append("")
                    lines.append("```")
                    for line in result.actual_stdout.strip().split("\n")[:50]:
                        lines.append(line)
                    if len(result.actual_stdout.strip().split("\n")) > 50:
                        lines.append("... (已截断)")
                    lines.append("```")
                    lines.append("")

                if result.actual_stderr:
                    lines.append("**stderr**:")
                    lines.append("")
                    lines.append("```")
                    for line in result.actual_stderr.strip().split("\n")[:50]:
                        lines.append(line)
                    if len(result.actual_stderr.strip().split("\n")) > 50:
                        lines.append("... (已截断)")
                    lines.append("```")
                    lines.append("")

                if result.notes:
                    lines.append(f"**人工复核备注**: {result.notes}")
                    lines.append("")

        content = "\n".join(lines)

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_text(content, encoding="utf-8")

        return content

    @classmethod
    def generate_json(
        cls,
        matrix: ValidationMatrix,
        output_path: str,
        include_full_output: bool = True,
    ) -> str:
        """生成 JSON 格式的明细报告

        Args:
            matrix: 验证矩阵
            output_path: 输出文件路径
            include_full_output: 是否包含完整的 stdout/stderr

        Returns:
            生成的 JSON 字符串
        """
        data = {
            "contract_name": matrix.contract_name,
            "contract_version": matrix.contract_version,
            "generated_at": matrix.generated_at.isoformat(),
            "summary": {
                "total": matrix.total_tests,
                "passed": matrix.passed_tests,
                "failed": matrix.failed_tests,
                "error": matrix.error_tests,
                "skipped": matrix.skipped_tests,
            },
            "results": [],
        }

        for result in matrix.results:
            result_data = {
                "subcommand": result.subcommand_name,
                "test_case": result.test_case_name,
                "status": result.status.value,
                "command": result.command,
                "expected_exit_code": result.expected_exit_code,
                "actual_exit_code": result.actual_exit_code,
                "duration_seconds": result.duration_seconds,
                "timestamp": result.timestamp.isoformat(),
                "failures": result.failures,
                "tags": result.tags,
                "notes": result.notes,
            }

            if include_full_output:
                result_data["stdout"] = result.actual_stdout
                result_data["stderr"] = result.actual_stderr

            data["results"].append(result_data)

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        content = json.dumps(data, ensure_ascii=False, indent=2)
        output_file.write_text(content, encoding="utf-8")

        return content

    @classmethod
    def _status_to_icon(cls, status: ValidationStatus) -> str:
        """将状态转换为图标"""
        icon_map = {
            ValidationStatus.PASS: "✅",
            ValidationStatus.FAIL: "❌",
            ValidationStatus.ERROR: "⚠️",
            ValidationStatus.SKIP: "⏭️",
        }
        return icon_map.get(status, "❓")
