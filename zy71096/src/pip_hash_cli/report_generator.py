import json
import os
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import ValidationReport
from .constants import ExitCode, EXIT_CODE_DESCRIPTIONS, PackageSource


class ReportSerializer:
    @staticmethod
    def to_dict(report: ValidationReport) -> Dict[str, Any]:
        data = asdict(report)
        return data

    @staticmethod
    def to_json(report: ValidationReport, indent: int = 2) -> str:
        def default_serializer(obj):
            if hasattr(obj, '__dict__'):
                return obj.__dict__
            if isinstance(obj, set):
                return list(obj)
            return str(obj)

        return json.dumps(
            asdict(report),
            default=default_serializer,
            ensure_ascii=False,
            indent=indent
        )


class TerminalSummary:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

    def __init__(self, use_colors: bool = True):
        self.use_colors = use_colors

    def _color(self, color_code: str, text: str) -> str:
        if self.use_colors:
            return f"{color_code}{text}{self.RESET}"
        return text

    def generate(self, report: ValidationReport) -> str:
        lines: List[str] = []
        
        lines.append(self._color(self.BOLD, "=" * 60))
        lines.append(self._color(self.BOLD, "Pip 依赖哈希校验报告"))
        lines.append(self._color(self.BOLD, "=" * 60))
        lines.append(f"时间: {report.timestamp}")
        lines.append("")

        status_color = self.GREEN if report.exit_code == ExitCode.SUCCESS else self.RED
        lines.append(
            f"退出码: {self._color(status_color, str(report.exit_code))} "
            f"({report.exit_code_description})"
        )
        lines.append("")

        if report.input_files:
            lines.append(self._color(self.BLUE, "输入文件:"))
            for key, path in report.input_files.items():
                lines.append(f"  {key}: {path}")
            lines.append("")

        lines.append(self._color(self.BLUE, "统计汇总:"))
        total_packages = sum(len(versions) for versions in report.packages.values())
        lines.append(f"  包数量: {total_packages}")
        lines.append(f"  依赖项: {len(report.requirements)}")
        lines.append(f"  哈希校验: {len([c for c in report.hash_checks if c.match])}/{len(report.hash_checks)} 通过")
        lines.append("")

        if report.hash_checks:
            lines.append(self._color(self.BLUE, "哈希校验详情:"))
            for check in report.hash_checks:
                status = self._color(self.GREEN, "✓ 通过") if check.match else self._color(self.RED, "✗ 失败")
                lines.append(f"  [{status}] {check.package_name}=={check.version}")
                if check.mismatch_details:
                    for detail in check.mismatch_details:
                        lines.append(f"      {self._color(self.RED, detail)}")
            lines.append("")

        if report.source_attributions:
            lines.append(self._color(self.BLUE, "包源归因:"))
            for attr in report.source_attributions:
                conf = f" (置信度: {attr.confidence:.0%})" if attr.confidence > 0 else ""
                lines.append(f"  {attr.package_name}=={attr.version}: {attr.primary_source}{conf}")
                if attr.wheelhouse_match:
                    lines.append(f"      wheelhouse: {attr.wheelhouse_match}")
                if len(attr.all_sources) > 1:
                    lines.append(f"      所有来源: {', '.join(attr.all_sources)}")
            lines.append("")

        if report.constraint_conflicts:
            lines.append(self._color(self.YELLOW, "约束冲突:"))
            for conflict in report.constraint_conflicts:
                lines.append(f"  {conflict.package_name}:")
                lines.append(f"    requirements: {conflict.requirement_spec}")
                lines.append(f"    constraints:  {conflict.constraint_spec}")
            lines.append("")

        if report.missing_packages:
            lines.append(self._color(self.RED, "缺失的包:"))
            for pkg in report.missing_packages:
                lines.append(f"  {pkg.get('name', 'unknown')} {pkg.get('specifier', '')}")
            lines.append("")

        if report.missing_hashes:
            lines.append(self._color(self.YELLOW, "缺失哈希的包:"))
            for pkg in report.missing_hashes:
                lines.append(f"  {pkg.get('name', 'unknown')} {pkg.get('specifier', '')}")
            lines.append("")

        if report.warnings:
            lines.append(self._color(self.YELLOW, "警告:"))
            for warning in report.warnings:
                lines.append(f"  ! {warning}")
            lines.append("")

        if report.errors:
            lines.append(self._color(self.RED, "错误:"))
            for error in report.errors:
                lines.append(f"  ✗ {error}")
            lines.append("")

        lines.append(self._color(self.BOLD, "=" * 60))
        exit_desc = EXIT_CODE_DESCRIPTIONS.get(report.exit_code, "未知状态")
        if report.exit_code == ExitCode.SUCCESS:
            lines.append(self._color(self.GREEN, f"结果: {exit_desc}"))
        else:
            lines.append(self._color(self.RED, f"结果: {exit_desc}"))
        lines.append(self._color(self.BOLD, "=" * 60))

        return "\n".join(lines)


class MarkdownReport:
    def generate(self, report: ValidationReport) -> str:
        lines: List[str] = []
        
        lines.append("# Pip 依赖哈希校验报告")
        lines.append("")
        lines.append(f"**生成时间**: {report.timestamp}")
        lines.append("")
        
        status_emoji = "✅" if report.exit_code == ExitCode.SUCCESS else "❌"
        lines.append(f"## 整体状态 {status_emoji}")
        lines.append("")
        lines.append(f"- **退出码**: `{report.exit_code}`")
        lines.append(f"- **说明**: {report.exit_code_description}")
        lines.append("")

        if report.input_files:
            lines.append("## 输入文件")
            lines.append("")
            for key, path in report.input_files.items():
                lines.append(f"- `{key}`: `{path}`")
            lines.append("")

        lines.append("## 统计汇总")
        lines.append("")
        total_packages = sum(len(versions) for versions in report.packages.values())
        passed_checks = len([c for c in report.hash_checks if c.match])
        total_checks = len(report.hash_checks)
        lines.append(f"- 包数量: **{total_packages}**")
        lines.append(f"- 依赖项: **{len(report.requirements)}**")
        lines.append(f"- 哈希校验通过率: **{passed_checks}/{total_checks}** "
                     f"({(passed_checks/total_checks*100):.1f}%)" if total_checks > 0 else "")
        lines.append("")

        if report.hash_checks:
            lines.append("## 哈希校验详情")
            lines.append("")
            lines.append("| 包名 | 版本 | 状态 | 详情 |")
            lines.append("|------|------|------|------|")
            for check in report.hash_checks:
                status = "✅ 通过" if check.match else "❌ 失败"
                details = "<br>".join(check.mismatch_details) if check.mismatch_details else "-"
                lines.append(f"| {check.package_name} | {check.version} | {status} | {details} |")
            lines.append("")

        if report.source_attributions:
            lines.append("## 包源归因")
            lines.append("")
            lines.append("| 包名 | 版本 | 主要来源 | 置信度 | Wheelhouse 路径 |")
            lines.append("|------|------|----------|--------|-----------------|")
            for attr in report.source_attributions:
                wheel_path = attr.wheelhouse_match or "-"
                conf = f"{attr.confidence:.0%}" if attr.confidence > 0 else "-"
                lines.append(f"| {attr.package_name} | {attr.version} | {attr.primary_source} | {conf} | {wheel_path} |")
            lines.append("")

        if report.constraint_conflicts:
            lines.append("## ⚠️ 约束冲突")
            lines.append("")
            lines.append("| 包名 | Requirements | Constraints |")
            lines.append("|------|--------------|-------------|")
            for conflict in report.constraint_conflicts:
                lines.append(f"| {conflict.package_name} | `{conflict.requirement_spec}` | `{conflict.constraint_spec}` |")
            lines.append("")

        if report.missing_packages:
            lines.append("## ❌ 缺失的包")
            lines.append("")
            lines.append("| 包名 | 版本要求 |")
            lines.append("|------|----------|")
            for pkg in report.missing_packages:
                lines.append(f"| {pkg.get('name', 'unknown')} | {pkg.get('specifier', '')} |")
            lines.append("")

        if report.missing_hashes:
            lines.append("## ⚠️ 缺失哈希的包")
            lines.append("")
            lines.append("| 包名 | 版本要求 |")
            lines.append("|------|----------|")
            for pkg in report.missing_hashes:
                lines.append(f"| {pkg.get('name', 'unknown')} | {pkg.get('specifier', '')} |")
            lines.append("")

        if report.warnings:
            lines.append("## ⚠️ 警告")
            lines.append("")
            for warning in report.warnings:
                lines.append(f"- {warning}")
            lines.append("")

        if report.errors:
            lines.append("## ❌ 错误")
            lines.append("")
            for error in report.errors:
                lines.append(f"- {error}")
            lines.append("")

        lines.append("## 退出码说明")
        lines.append("")
        lines.append("| 退出码 | 含义 |")
        lines.append("|--------|------|")
        for code, desc in EXIT_CODE_DESCRIPTIONS.items():
            marker = "← 当前" if code == report.exit_code else ""
            lines.append(f"| `{int(code)}` | {desc} {marker} |")
        lines.append("")

        return "\n".join(lines)


class ReportWriter:
    def __init__(self, output_dir: str, create_dir: bool = True):
        self.output_dir = Path(output_dir)
        if create_dir:
            self.output_dir.mkdir(parents=True, exist_ok=True)

    def write_json(self, report: ValidationReport, filename: str = "report.json") -> str:
        path = self.output_dir / filename
        path.write_text(ReportSerializer.to_json(report), encoding='utf-8')
        return str(path)

    def write_markdown(self, report: ValidationReport, filename: str = "report.md") -> str:
        path = self.output_dir / filename
        md = MarkdownReport()
        path.write_text(md.generate(report), encoding='utf-8')
        return str(path)

    def write_all(self, report: ValidationReport, base_name: str = "pip-hash-report") -> Dict[str, str]:
        results = {}
        results['json'] = self.write_json(report, f"{base_name}.json")
        results['markdown'] = self.write_markdown(report, f"{base_name}.md")
        return results

    def print_terminal_summary(self, report: ValidationReport, use_colors: bool = True):
        summary = TerminalSummary(use_colors=use_colors)
        print(summary.generate(report))
