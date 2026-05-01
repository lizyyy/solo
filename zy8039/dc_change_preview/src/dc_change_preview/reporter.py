import csv
from pathlib import Path
from typing import Optional, List, Union

from .models import (
    ChangePlan,
    ChangeStep,
    SimulationResult,
    ValidationIssue,
    RollbackSuggestion,
)


class Reporter:
    def __init__(self, output_dir: Union[str, Path]):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_risk_csv(self, issues: List[ValidationIssue], filename: str = "risk_report.csv") -> Path:
        output_path = self.output_dir / filename
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "severity",
                "issue_type",
                "description",
                "device_id",
                "location",
                "details",
            ])
            for issue in issues:
                writer.writerow([
                    issue.severity,
                    issue.issue_type,
                    issue.description,
                    issue.device_id or "",
                    issue.location or "",
                    str(issue.details),
                ])
        return output_path

    def generate_executable_steps_md(
        self,
        change_plan: ChangePlan,
        simulation_result: SimulationResult,
        filename: str = "executable_steps.md",
    ) -> Path:
        output_path = self.output_dir / filename

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(f"# 变更计划执行步骤\n\n")
            f.write(f"**计划ID**: {change_plan.plan_id}\n\n")
            f.write(f"**描述**: {change_plan.description}\n\n")
            f.write(f"**模拟状态**: {'✅ 成功' if simulation_result.success else '❌ 失败'}\n\n")

            executed = simulation_result.executed_steps
            if executed:
                f.write(f"**可执行步骤** ({len(executed)}/{len(change_plan.steps)})\n\n")
                f.write("| 步骤ID | 类型 | 设备ID | 目标机柜 | 目标U位 | 目标端口 | 备注 |\n")
                f.write("|--------|------|--------|---------|--------|---------|------|\n")
                for step in executed:
                    f.write(f"| {step.step_id} | {step.change_type.value} | {step.device_id} ")
                    f.write(f"| {step.target_rack_id or '-'} | ")
                    if step.target_u_start and step.target_u_end:
                        f.write(f"U{step.target_u_start}-{step.target_u_end} | ")
                    else:
                        f.write(" | ")
                    f.write(f"{step.target_switch_port or '-'} | {step.notes} |\n")
            else:
                f.write("**无成功执行的步骤**\n\n")

            failed_issues = [i for i in simulation_result.issues if i.severity == "critical"]
            if failed_issues:
                f.write(f"\n**失败原因** ({len(failed_issues)})\n\n")
                for issue in failed_issues:
                    f.write(f"- ❌ [{issue.issue_type}] {issue.description}\n")
                    if issue.device_id:
                        f.write(f"  - 设备: {issue.device_id}\n")
                    if issue.location:
                        f.write(f"  - 位置: {issue.location}\n")

            warnings = [i for i in simulation_result.issues if i.severity == "warning"]
            if warnings:
                f.write(f"\n**警告** ({len(warnings)})\n\n")
                for issue in warnings:
                    f.write(f"- ⚠️ [{issue.issue_type}] {issue.description}\n")

        return output_path

    def generate_rollback_md(
        self,
        rollback_suggestions: List[RollbackSuggestion],
        filename: str = "rollback_suggestions.md",
    ) -> Path:
        output_path = self.output_dir / filename

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("# 回滚建议\n\n")
            f.write("> 如果变更过程中出现问题，按以下步骤逆序执行回滚操作\n\n")

            if not rollback_suggestions:
                f.write("**无需回滚步骤**\n\n")
                return output_path

            f.write("## 回滚步骤（逆序执行）\n\n")
            f.write("| 步骤 | 操作 | 设备ID | 说明 |\n")
            f.write("|------|------|--------|------|\n")

            for i, suggestion in enumerate(rollback_suggestions, 1):
                f.write(f"| {i} | {suggestion.action} | {suggestion.target_device_id} | {suggestion.description} |\n")

            f.write("\n## 详细回滚指令\n\n")
            for i, suggestion in enumerate(rollback_suggestions, 1):
                f.write(f"### {i}. {suggestion.description}\n\n")
                f.write(f"- 回滚步骤ID: `{suggestion.step_id}`\n")
                f.write(f"- 操作类型: `{suggestion.action}`\n")
                f.write(f"- 目标设备: `{suggestion.target_device_id}`\n\n")

        return output_path

    def generate_summary_json(
        self,
        change_plan: ChangePlan,
        simulation_result: SimulationResult,
        rollback_suggestions: List[RollbackSuggestion],
        filename: str = "summary.json",
    ) -> Path:
        import json
        output_path = self.output_dir / filename

        summary = {
            "plan_id": change_plan.plan_id,
            "description": change_plan.description,
            "total_steps": len(change_plan.steps),
            "executed_steps": len(simulation_result.executed_steps),
            "simulation_success": simulation_result.success,
            "critical_issues_count": len([i for i in simulation_result.issues if i.severity == "critical"]),
            "warning_count": len([i for i in simulation_result.issues if i.severity == "warning"]),
            "rollback_steps_count": len(rollback_suggestions),
            "output_files": {
                "risk_report": "risk_report.csv",
                "executable_steps": "executable_steps.md",
                "rollback_suggestions": "rollback_suggestions.md",
            },
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)

        return output_path
