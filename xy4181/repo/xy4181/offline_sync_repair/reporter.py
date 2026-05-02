"""报告生成器模块 - 导出 Markdown、CSV 和 JSON 审计包"""

import csv
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .rules_engine import CheckReport, CheckResult, CheckSeverity, CheckCategory
from .patch_plan import PatchPlan
from .executor import ExecutionResult
from .utils import save_json, get_file_size_str


@dataclass
class ReportPackage:
    """报告包"""
    report_id: str
    generated_at: datetime
    output_dir: Path
    files: List[Path] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)


class Reporter:
    """报告生成器"""

    def __init__(self, work_dir: Path):
        self.work_dir = work_dir

    def generate_check_report(self, check_report: CheckReport, 
                               output_name: str = "check_report") -> ReportPackage:
        """生成检查报告"""
        report_id = f"{output_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        output_dir = self.work_dir / "reports" / report_id
        output_dir.mkdir(parents=True, exist_ok=True)

        package = ReportPackage(
            report_id=report_id,
            generated_at=datetime.now(),
            output_dir=output_dir
        )

        json_path = self._write_check_json(check_report, output_dir, output_name)
        package.files.append(json_path)

        csv_path = self._write_check_csv(check_report, output_dir, output_name)
        package.files.append(csv_path)

        md_path = self._write_check_markdown(check_report, output_dir, output_name)
        package.files.append(md_path)

        package.summary = self._build_check_summary(check_report, package)

        summary_path = output_dir / f"{output_name}_summary.json"
        save_json(package.summary, summary_path)
        package.files.append(summary_path)

        return package

    def generate_plan_report(self, plan: PatchPlan,
                             output_name: str = "patch_plan") -> ReportPackage:
        """生成修补计划报告"""
        report_id = f"{output_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        output_dir = self.work_dir / "reports" / report_id
        output_dir.mkdir(parents=True, exist_ok=True)

        package = ReportPackage(
            report_id=report_id,
            generated_at=datetime.now(),
            output_dir=output_dir
        )

        json_path = self._write_plan_json(plan, output_dir, output_name)
        package.files.append(json_path)

        csv_path = self._write_plan_csv(plan, output_dir, output_name)
        package.files.append(csv_path)

        md_path = self._write_plan_markdown(plan, output_dir, output_name)
        package.files.append(md_path)

        package.summary = self._build_plan_summary(plan, package)

        summary_path = output_dir / f"{output_name}_summary.json"
        save_json(package.summary, summary_path)
        package.files.append(summary_path)

        return package

    def generate_execution_report(self, result: ExecutionResult,
                                   output_name: str = "execution_report") -> ReportPackage:
        """生成执行报告"""
        report_id = f"{output_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        output_dir = self.work_dir / "reports" / report_id
        output_dir.mkdir(parents=True, exist_ok=True)

        package = ReportPackage(
            report_id=report_id,
            generated_at=datetime.now(),
            output_dir=output_dir
        )

        json_path = self._write_execution_json(result, output_dir, output_name)
        package.files.append(json_path)

        csv_path = self._write_execution_csv(result, output_dir, output_name)
        package.files.append(csv_path)

        md_path = self._write_execution_markdown(result, output_dir, output_name)
        package.files.append(md_path)

        package.summary = self._build_execution_summary(result, package)

        summary_path = output_dir / f"{output_name}_summary.json"
        save_json(package.summary, summary_path)
        package.files.append(summary_path)

        return package

    def _write_check_json(self, report: CheckReport, output_dir: Path, name: str) -> Path:
        """写入检查报告 JSON"""
        file_path = output_dir / f"{name}.json"
        save_json(report.to_dict(), file_path)
        return file_path

    def _write_check_csv(self, report: CheckReport, output_dir: Path, name: str) -> Path:
        """写入检查报告 CSV"""
        file_path = output_dir / f"{name}.csv"

        with open(file_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "检查ID", "类别", "严重程度", "标题", "消息",
                "受影响项目数", "推荐操作", "详情摘要"
            ])

            for result in report.results:
                affected_count = len(result.affected_items)
                details_summary = str(result.details)[:100] if result.details else ""

                writer.writerow([
                    result.check_id,
                    result.category.value,
                    result.severity.value,
                    result.title,
                    result.message,
                    affected_count,
                    result.recommendation,
                    details_summary
                ])

        return file_path

    def _write_check_markdown(self, report: CheckReport, output_dir: Path, name: str) -> Path:
        """写入检查报告 Markdown"""
        file_path = output_dir / f"{name}.md"

        critical_results = [r for r in report.results if r.severity == CheckSeverity.CRITICAL]
        error_results = [r for r in report.results if r.severity == CheckSeverity.ERROR]
        warning_results = [r for r in report.results if r.severity == CheckSeverity.WARNING]
        info_results = [r for r in report.results if r.severity == CheckSeverity.INFO]

        md_lines = [
            f"# 同步检查报告",
            "",
            f"> 生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}",
            f"> 报告ID: {name}",
            "",
            "## 摘要",
            "",
            "| 指标 | 数值 |",
            "|------|------|",
            f"| 总检查数 | {report.total_checks} |",
            f"| 通过 | {report.passed_count} |",
            f"| 警告 | {report.warning_count} |",
            f"| 错误 | {report.error_count} |",
            f"| 严重 | {report.critical_count} |",
            "",
        ]

        if critical_results:
            md_lines.extend([
                "## 🔴 严重问题",
                "",
            ])
            for r in critical_results:
                md_lines.extend([
                    f"### {r.title}",
                    "",
                    f"**消息**: {r.message}",
                    "",
                    f"**推荐操作**: {r.recommendation}",
                    "",
                    f"**受影响项目**: {len(r.affected_items)} 个",
                    "",
                    "---",
                    "",
                ])

        if error_results:
            md_lines.extend([
                "## 🟠 错误问题",
                "",
            ])
            for r in error_results:
                md_lines.extend([
                    f"### {r.title}",
                    "",
                    f"**消息**: {r.message}",
                    "",
                    f"**推荐操作**: {r.recommendation}",
                    "",
                    "---",
                    "",
                ])

        if warning_results:
            md_lines.extend([
                "## 🟡 警告问题",
                "",
            ])
            for r in warning_results[:20]:
                md_lines.extend([
                    f"### {r.title}",
                    "",
                    f"**消息**: {r.message}",
                    "",
                    f"**推荐操作**: {r.recommendation}",
                    "",
                    "---",
                    "",
                ])
            if len(warning_results) > 20:
                md_lines.append(f"> 还有 {len(warning_results) - 20} 个警告，请查看完整 JSON/CSV 报告\n")

        if info_results:
            md_lines.extend([
                "## 🟢 通过项",
                "",
            ])
            for r in info_results[:10]:
                md_lines.extend([
                    f"- **{r.title}**: {r.message}",
                    "",
                ])
            if len(info_results) > 10:
                md_lines.append(f"> 还有 {len(info_results) - 10} 个通过项\n")

        if report.summary and report.summary.get("top_issues"):
            md_lines.extend([
                "## 关键问题摘要",
                "",
            ])
            for issue in report.summary["top_issues"]:
                md_lines.append(f"- **[{issue['severity'].upper()}]** {issue['title']}: {issue['message']}\n")

        content = "\n".join(md_lines)
        file_path.write_text(content, encoding="utf-8")
        return file_path

    def _write_plan_json(self, plan: PatchPlan, output_dir: Path, name: str) -> Path:
        """写入修补计划 JSON"""
        file_path = output_dir / f"{name}.json"
        save_json(plan.to_dict(), file_path)
        return file_path

    def _write_plan_csv(self, plan: PatchPlan, output_dir: Path, name: str) -> Path:
        """写入修补计划 CSV"""
        file_path = output_dir / f"{name}.csv"

        with open(file_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "操作ID", "操作类型", "优先级", "目标终端", "描述",
                "预估大小(字节)", "受影响项目"
            ])

            for terminal_id, tp in plan.terminal_plans.items():
                for action in tp.actions:
                    writer.writerow([
                        action.action_id,
                        action.action_type.value,
                        action.priority.value,
                        action.target_terminal or terminal_id,
                        action.description,
                        action.estimated_size_bytes,
                        ", ".join(action.affected_items[:5]) if action.affected_items else ""
                    ])

            for action in plan.global_actions:
                writer.writerow([
                    action.action_id,
                    action.action_type.value,
                    action.priority.value,
                    "全局",
                    action.description,
                    action.estimated_size_bytes,
                    ", ".join(action.affected_items[:5]) if action.affected_items else ""
                ])

        return file_path

    def _write_plan_markdown(self, plan: PatchPlan, output_dir: Path, name: str) -> Path:
        """写入修补计划 Markdown"""
        file_path = output_dir / f"{name}.md"

        summary = plan.summary

        md_lines = [
            f"# 修补计划",
            "",
            f"> 生成时间: {plan.generated_at.strftime('%Y-%m-%d %H:%M:%S')}",
            f"> 计划ID: {plan.plan_id}",
            f"> 描述: {plan.description}",
            "",
            "## 摘要",
            "",
            "| 指标 | 数值 |",
            "|------|------|",
            f"| 涉及终端数 | {summary.get('total_terminals', 0)} |",
            f"| 总操作数 | {summary.get('total_actions', 0)} |",
            f"| 预估总大小 | {get_file_size_str(summary.get('estimated_total_size', 0))} |",
            "",
            "### 按优先级分布",
            "",
            "| 优先级 | 数量 |",
            "|--------|------|",
            f"|  Critical (严重) | {summary.get('by_priority', {}).get('critical', 0)} |",
            f"|  High (高) | {summary.get('by_priority', {}).get('high', 0)} |",
            f"|  Medium (中) | {summary.get('by_priority', {}).get('medium', 0)} |",
            f"|  Low (低) | {summary.get('by_priority', {}).get('low', 0)} |",
            "",
        ]

        if plan.terminal_plans:
            md_lines.extend([
                "## 按终端分类的操作",
                "",
            ])
            for terminal_id, tp in plan.terminal_plans.items():
                md_lines.extend([
                    f"### 终端: {terminal_id}",
                    "",
                    f"- 操作数: {len(tp.actions)}",
                    f"- 预估大小: {get_file_size_str(tp.estimated_total_size)}",
                    f"- Critical: {tp.critical_count}",
                    f"- High: {tp.high_count}",
                    f"- Medium: {tp.medium_count}",
                    f"- Low: {tp.low_count}",
                    "",
                    "| 操作ID | 类型 | 优先级 | 描述 |",
                    "|--------|------|--------|------|",
                ])
                for action in tp.actions:
                    md_lines.append(
                        f"| {action.action_id} | {action.action_type.value} | {action.priority.value} | {action.description} |"
                    )
                md_lines.append("")

        if plan.global_actions:
            md_lines.extend([
                "## 全局操作",
                "",
                "| 操作ID | 类型 | 优先级 | 描述 |",
                "|--------|------|--------|------|",
            ])
            for action in plan.global_actions:
                md_lines.append(
                    f"| {action.action_id} | {action.action_type.value} | {action.priority.value} | {action.description} |"
                )
            md_lines.append("")

        md_lines.extend([
            "## 执行顺序建议",
            "",
            "1. 首先执行所有 **Critical** 优先级的操作",
            "2. 然后执行 **High** 优先级的操作",
            "3. 接着执行 **Medium** 优先级的操作",
            "4. 最后执行 **Low** 优先级的操作",
            "",
            "建议在正式执行前先使用 `apply` 命令进行演练。",
        ])

        content = "\n".join(md_lines)
        file_path.write_text(content, encoding="utf-8")
        return file_path

    def _write_execution_json(self, result: ExecutionResult, output_dir: Path, name: str) -> Path:
        """写入执行报告 JSON"""
        file_path = output_dir / f"{name}.json"
        save_json(result.to_dict(), file_path)
        return file_path

    def _write_execution_csv(self, result: ExecutionResult, output_dir: Path, name: str) -> Path:
        """写入执行报告 CSV"""
        file_path = output_dir / f"{name}.csv"

        with open(file_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "时间戳", "操作ID", "操作类型", "状态", "消息", "持续时间(秒)", "详情"
            ])

            for entry in result.journal:
                writer.writerow([
                    entry.timestamp.isoformat(),
                    entry.action_id,
                    entry.action_type,
                    entry.status.value,
                    entry.message,
                    entry.duration_seconds,
                    str(entry.details)[:200] if entry.details else ""
                ])

        return file_path

    def _write_execution_markdown(self, result: ExecutionResult, output_dir: Path, name: str) -> Path:
        """写入执行报告 Markdown"""
        file_path = output_dir / f"{name}.md"

        summary = result.summary

        md_lines = [
            f"# 执行报告 (演练模式)",
            "",
            f"> 执行时间: {result.executed_at.strftime('%Y-%m-%d %H:%M:%S')}",
            f"> 计划ID: {result.plan_id}",
            f"> 临时目录: {result.temp_dir}",
            f"> 最终状态: {result.status.value}",
            "",
            "## 摘要",
            "",
            "| 指标 | 数值 |",
            "|------|------|",
            f"| 总操作数 | {summary.get('counts', {}).get('total', 0)} |",
            f"| 成功 | {result.success_count} |",
            f"| 失败 | {result.failed_count} |",
            f"| 跳过 | {result.skipped_count} |",
            "",
        ]

        if result.success_count > 0:
            md_lines.extend([
                "## ✅ 成功的操作",
                "",
            ])
            for action_id in summary.get("by_status", {}).get("success", [])[:20]:
                entry = next((e for e in result.journal if e.action_id == action_id and e.status.value == "success"), None)
                if entry:
                    md_lines.append(f"- **{action_id}** ({entry.action_type}): {entry.message}")
            md_lines.append("")

        if result.failed_count > 0:
            md_lines.extend([
                "## ❌ 失败的操作",
                "",
            ])
            for action_id in summary.get("by_status", {}).get("failed", []):
                entry = next((e for e in result.journal if e.action_id == action_id and e.status.value == "failed"), None)
                if entry:
                    md_lines.append(f"- **{action_id}** ({entry.action_type}): {entry.message}")
                    if entry.details.get("error"):
                        md_lines.append(f"  - 错误: {entry.details['error']}")
            md_lines.append("")

        md_lines.extend([
            "## 📋 执行日志",
            "",
            "| 时间 | 操作ID | 类型 | 状态 | 消息 |",
            "|------|--------|------|------|------|",
        ])

        for entry in result.journal:
            status_icon = "✅" if entry.status.value == "success" else "❌" if entry.status.value == "failed" else "⏭️"
            md_lines.append(
                f"| {entry.timestamp.strftime('%H:%M:%S')} | {entry.action_id} | {entry.action_type} | {status_icon} {entry.status.value} | {entry.message[:50]}... |"
            )

        md_lines.extend([
            "",
            "## 说明",
            "",
            "> ⚠️ 此为**演练模式**执行报告，所有操作均在临时目录中模拟执行，未修改实际数据。",
            "",
            f"> 临时目录: `{result.temp_dir}`",
            "",
            "> 如需正式执行，请确认演练结果无误后再进行实际操作。",
        ])

        content = "\n".join(md_lines)
        file_path.write_text(content, encoding="utf-8")
        return file_path

    def _build_check_summary(self, report: CheckReport, package: ReportPackage) -> Dict[str, Any]:
        """构建检查报告摘要"""
        return {
            "report_id": package.report_id,
            "generated_at": package.generated_at.isoformat(),
            "check_report_summary": report.summary,
            "output_dir": str(package.output_dir),
            "files": [str(f.name) for f in package.files],
            "counts": {
                "total": report.total_checks,
                "passed": report.passed_count,
                "warning": report.warning_count,
                "error": report.error_count,
                "critical": report.critical_count
            }
        }

    def _build_plan_summary(self, plan: PatchPlan, package: ReportPackage) -> Dict[str, Any]:
        """构建修补计划摘要"""
        return {
            "report_id": package.report_id,
            "generated_at": package.generated_at.isoformat(),
            "plan_id": plan.plan_id,
            "description": plan.description,
            "plan_summary": plan.summary,
            "output_dir": str(package.output_dir),
            "files": [str(f.name) for f in package.files]
        }

    def _build_execution_summary(self, result: ExecutionResult, package: ReportPackage) -> Dict[str, Any]:
        """构建执行摘要"""
        return {
            "report_id": package.report_id,
            "generated_at": package.generated_at.isoformat(),
            "plan_id": result.plan_id,
            "executed_at": result.executed_at.isoformat(),
            "temp_dir": str(result.temp_dir),
            "final_status": result.status.value,
            "execution_summary": result.summary,
            "output_dir": str(package.output_dir),
            "files": [str(f.name) for f in package.files],
            "counts": {
                "total": len(result.journal),
                "success": result.success_count,
                "failed": result.failed_count,
                "skipped": result.skipped_count
            }
        }
