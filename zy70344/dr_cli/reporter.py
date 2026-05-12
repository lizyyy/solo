from datetime import datetime
from typing import Optional

from tabulate import tabulate

from .models import ExecutionState, StepStatus, SwitchStatus
from .utils import format_duration


class Reporter:
    @staticmethod
    def generate_report(state: ExecutionState, output_file: Optional[str] = None) -> str:
        lines = []

        lines.append("=" * 80)
        lines.append("                    容灾切换演练复盘报告")
        lines.append("=" * 80)
        lines.append("")

        lines.append("【演练基本信息】")
        lines.append("-" * 40)
        lines.append(f"  演练计划:      {state.plan_name}")
        lines.append(f"  运行ID:        {state.run_id}")
        lines.append(f"  开始时间:      {state.started_at.strftime('%Y-%m-%d %H:%M:%S')}")
        if state.completed_at:
            lines.append(f"  结束时间:      {state.completed_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"  总耗时:        {format_duration(state.total_duration)}")
        lines.append(f"  当前状态:      {Reporter._format_status(state.current_status)}")
        lines.append(f"  最终结果:      {Reporter._get_final_result(state)}")
        lines.append("")

        lines.append("【服务状态】")
        lines.append("-" * 40)
        if state.services:
            service_rows = []
            for svc in state.services:
                active_endpoint = (
                    svc.secondary_endpoint
                    if svc.status == "secondary"
                    else svc.primary_endpoint
                )
                service_rows.append([
                    svc.name,
                    "备站" if svc.status == "secondary" else "主站",
                    active_endpoint,
                ])
            lines.append(tabulate(
                service_rows,
                headers=["服务", "当前站点", "活跃端点"],
                tablefmt="grid",
            ))
        else:
            lines.append("  (无服务信息)")
        lines.append("")

        lines.append("【步骤执行详情】")
        lines.append("-" * 40)

        step_types = {
            "precheck": "前置检查",
            "switch": "服务切换",
            "verify": "服务验证",
        }

        for step_type, type_name in step_types.items():
            steps = [s for s in state.steps if s.step_type == step_type]
            if not steps:
                continue

            lines.append(f"\n  {type_name}:")
            step_rows = []
            for i, step in enumerate(steps, 1):
                status_display = Reporter._format_step_status(step.status)
                svc_name = "全局"
                if step.service_id:
                    svc = next((s for s in state.services if s.id == step.service_id), None)
                    if svc:
                        svc_name = svc.name

                details_str = ""
                if step.status == StepStatus.FAILED and step.error_message:
                    details_str = f"错误: {step.error_message}"
                elif step.status == StepStatus.SKIPPED and step.skip_reason:
                    details_str = f"跳过原因: {step.skip_reason}"

                step_rows.append([
                    i,
                    step.name,
                    svc_name,
                    status_display,
                    format_duration(step.duration_seconds),
                    details_str,
                ])

            lines.append(tabulate(
                step_rows,
                headers=["序号", "步骤", "服务", "状态", "耗时", "详情"],
                tablefmt="grid",
                maxcolwidths=[5, 25, 15, 10, 10, 40],
            ))

        lines.append("")

        lines.append("【统计摘要】")
        lines.append("-" * 40)
        total = len(state.steps)
        passed = state.passed_steps
        failed = state.failed_steps
        skipped = state.skipped_steps

        summary_rows = [
            ["总步骤数", total],
            ["通过", passed],
            ["失败", failed],
            ["跳过", skipped],
        ]
        lines.append(tabulate(summary_rows, tablefmt="plain"))
        lines.append("")

        if state.sync_statuses:
            lines.append("【数据同步状态】")
            lines.append("-" * 40)
            sync_rows = []
            for sync in state.sync_statuses:
                svc = next((s for s in state.services if s.id == sync.service_id), None)
                svc_name = svc.name if svc else sync.service_id
                sync_rows.append([
                    svc_name,
                    "已同步" if sync.is_synced else "未同步",
                    f"{sync.lag_seconds}s",
                ])
            lines.append(tabulate(
                sync_rows,
                headers=["服务", "同步状态", "延迟"],
                tablefmt="grid",
            ))
            lines.append("")

        if state.human_interventions:
            lines.append("【人工介入记录】")
            lines.append("-" * 40)
            for i, intervention in enumerate(state.human_interventions, 1):
                lines.append(f"  {i}. {intervention}")
            lines.append("")

        failed_steps = [s for s in state.steps if s.status == StepStatus.FAILED]
        if failed_steps:
            lines.append("【失败点详情】")
            lines.append("-" * 40)
            for step in failed_steps:
                svc_name = "全局"
                if step.service_id:
                    svc = next((s for s in state.services if s.id == step.service_id), None)
                    if svc:
                        svc_name = svc.name
                lines.append(f"  - {step.name} ({svc_name}): {step.error_message}")
            lines.append("")

        if state.current_status in [SwitchStatus.ROLLED_BACK, SwitchStatus.VERIFY_FAILED]:
            lines.append("【回切状态】")
            lines.append("-" * 40)
            if state.current_status == SwitchStatus.ROLLED_BACK:
                lines.append("  状态: 已成功回切")
            else:
                lines.append("  状态: 建议执行回切")
            lines.append("")

        lines.append("=" * 80)
        lines.append("                    报告生成时间: " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        lines.append("=" * 80)

        report_text = "\n".join(lines)

        if output_file:
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(report_text)

        return report_text

    @staticmethod
    def _format_status(status: SwitchStatus) -> str:
        mapping = {
            SwitchStatus.NOT_STARTED: "未开始",
            SwitchStatus.PRECHECKING: "前置检查中",
            SwitchStatus.PRECHECK_FAILED: "前置检查失败",
            SwitchStatus.READY_TO_SWITCH: "准备切换",
            SwitchStatus.SWITCHING: "切换中",
            SwitchStatus.SWITCHED: "已切换",
            SwitchStatus.VERIFYING: "验证中",
            SwitchStatus.VERIFY_FAILED: "验证失败",
            SwitchStatus.COMPLETED: "已完成",
            SwitchStatus.ROLLING_BACK: "回切中",
            SwitchStatus.ROLLED_BACK: "已回切",
        }
        return mapping.get(status, status.value)

    @staticmethod
    def _format_step_status(status: StepStatus) -> str:
        mapping = {
            StepStatus.PENDING: "待执行",
            StepStatus.RUNNING: "执行中",
            StepStatus.PASSED: "通过",
            StepStatus.FAILED: "失败",
            StepStatus.SKIPPED: "跳过",
        }
        return mapping.get(status, status.value)

    @staticmethod
    def _get_final_result(state: ExecutionState) -> str:
        if state.current_status == SwitchStatus.COMPLETED:
            return "演练通过"
        elif state.current_status == SwitchStatus.ROLLED_BACK:
            return "已回切"
        elif state.current_status in [SwitchStatus.VERIFY_FAILED, SwitchStatus.PRECHECK_FAILED]:
            return "演练失败"
        else:
            return "进行中"
