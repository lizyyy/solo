"""报告导出器 - 终端/JSON/Markdown 一致输出

核心设计原则：
1. 先构建统一的内部数据模型（unified_data）
2. 三种格式只是对同一数据的不同渲染方式
3. 确保三者在数字、统计、结论上完全一致
"""

import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from collections import OrderedDict

from .models import GrayscaleTask, Device, Batch, GrayscaleState, BatchState
from .rollback_engine import LogAggregator, RollbackEngine


class ReportExporter:
    """报告导出器"""

    @staticmethod
    def _get_state_color(state: str) -> str:
        """获取状态对应的颜色代码（终端用）"""
        colors = {
            "success": "\033[92m",
            "pending": "\033[93m",
            "pending_confirm": "\033[95m",
            "rolling": "\033[94m",
            "failed": "\033[91m",
            "rollback": "\033[93m",
            "rolled_back": "\033[92m",
            "rollback_failed": "\033[91m",
            "batch_success": "\033[92m",
            "batch_failed": "\033[91m",
            "batch_rolling": "\033[94m",
            "batch_paused": "\033[93m",
            "batch_rolling_back": "\033[93m",
            "batch_rolled_back": "\033[92m",
            "batch_pending": "\033[93m",
        }
        return colors.get(state, "\033[0m")

    @staticmethod
    def _get_state_emoji(state: str) -> str:
        """获取状态对应的表情符号（Markdown用）"""
        emojis = {
            "success": "✅",
            "pending": "⏳",
            "pending_confirm": "⚠️",
            "rolling": "🔄",
            "failed": "❌",
            "rollback": "↩️",
            "rolled_back": "🔙",
            "rollback_failed": "⚠️",
            "batch_success": "✅",
            "batch_failed": "❌",
            "batch_rolling": "🔄",
            "batch_paused": "⏸️",
            "batch_rolling_back": "↩️",
            "batch_rolled_back": "🔙",
            "batch_pending": "⏳",
            "online": "🟢",
            "offline": "🔴",
            "unknown": "⚪",
        }
        return emojis.get(state, "•")

    @staticmethod
    def build_unified_data(task: GrayscaleTask,
                           rollback_engine: Optional[RollbackEngine] = None,
                           decision_logs: Optional[List[str]] = None) -> Dict[str, Any]:
        """构建统一数据模型 - 所有导出格式的数据源
        此函数是一致性的核心保证
        """
        all_devices = task.get_all_devices()
        log_report = LogAggregator.generate_log_report(task)
        pending_confirm_devices = LogAggregator.get_pending_confirm_devices(task)

        batches_data = []
        for batch in task.processed_batches:
            stats = batch.get_statistics()
            devices_data = []
            for device in batch.processed_devices:
                device_agg = LogAggregator.aggregate_device_logs(device)
                devices_data.append({
                    "meta": {
                        "id": device.meta_id,
                        "created_at": device.meta_created_at.isoformat(),
                        "updated_at": device.meta_updated_at.isoformat(),
                    },
                    "original": {
                        "device_id": device.original_device_id,
                        "firmware_version": device.original_firmware_version,
                        "batch": device.original_batch,
                        "online_status": device.original_online_status.value,
                        "failure_log": device.original_failure_log,
                    },
                    "processed": {
                        "target_version": device.processed_target_version,
                        "current_state": device.processed_current_state.value,
                        "confirm_reasons": [r.value for r in device.processed_confirm_reasons],
                        "failure_count": device.processed_failure_count,
                        "last_failure_time": device.processed_last_failure_time.isoformat()
                        if device.processed_last_failure_time else None,
                        "rollback_from_version": device.processed_rollback_from_version,
                    },
                    "logs": {
                        "upgrade": device_agg.upgrade_logs,
                        "rollback": device_agg.rollback_logs,
                        "failures": device_agg.failure_logs,
                    }
                })

            batches_data.append({
                "meta": {
                    "created_at": batch.meta_created_at.isoformat(),
                    "updated_at": batch.meta_updated_at.isoformat(),
                },
                "original": {
                    "batch_id": batch.original_batch_id,
                    "batch_name": batch.original_batch_name,
                    "device_ids": batch.original_device_ids,
                    "target_version": batch.original_target_version,
                },
                "processed": {
                    "state": batch.processed_state.value,
                    "statistics": stats,
                    "success_count": batch.processed_success_count,
                    "failed_count": batch.processed_failed_count,
                    "pending_count": batch.processed_pending_count,
                    "rollback_count": batch.processed_rollback_count,
                    "pending_confirm_count": batch.processed_pending_confirm_count,
                },
                "devices": devices_data,
            })

        rollback_records_data = []
        if rollback_engine:
            for record in rollback_engine.rollback_records:
                rollback_records_data.append(record.to_dict())

        data = OrderedDict([
            ("report_version", "1.0"),
            ("generated_at", datetime.now().isoformat()),
            ("summary", OrderedDict([
                ("task_id", task.original_task_id),
                ("task_name", task.original_task_name),
                ("target_version", task.original_target_version),
                ("description", task.original_description),
                ("created_at", task.meta_created_at.isoformat()),
                ("updated_at", task.meta_updated_at.isoformat()),
                ("total_devices", len(all_devices)),
                ("total_batches", len(task.processed_batches)),
                ("statistics", OrderedDict([
                    ("success", task.processed_total_success),
                    ("failed", task.processed_total_failed),
                    ("pending", task.processed_total_pending),
                    ("rollback", task.processed_total_rollback),
                    ("pending_confirm", task.processed_total_pending_confirm),
                ])),
                ("success_rate", round(
                    task.processed_total_success / len(all_devices) * 100, 2
                ) if all_devices else 0),
            ])),
            ("conclusion", ReportExporter._generate_conclusion(task)),
            ("warnings", ReportExporter._generate_warnings(task, pending_confirm_devices)),
            ("batches", batches_data),
            ("rollback_records", rollback_records_data),
            ("log_aggregation", log_report),
            ("decision_logs", decision_logs or []),
            ("pending_confirm_devices", [
                {
                    "device_id": d.original_device_id,
                    "reasons": [r.value for r in d.processed_confirm_reasons],
                    "batch": d.original_batch,
                }
                for d in pending_confirm_devices
            ]),
        ])

        return data

    @staticmethod
    def _generate_conclusion(task: GrayscaleTask) -> Dict[str, Any]:
        """生成结论"""
        all_devices = task.get_all_devices()
        if not all_devices:
            return {"level": "info", "message": "无设备数据", "recommendation": ""}

        total = len(all_devices)
        success = task.processed_total_success
        failed = task.processed_total_failed
        pending = task.processed_total_pending
        pending_confirm = task.processed_total_pending_confirm

        if pending_confirm > 0:
            return {
                "level": "warning",
                "message": f"存在 {pending_confirm} 个设备待人工确认，无法自动得出最终结论",
                "recommendation": "请先处理待确认设备，再重新生成报告"
            }

        if pending > 0:
            return {
                "level": "info",
                "message": f"灰度进行中，还有 {pending} 个设备待处理",
                "recommendation": "等待所有设备处理完成后再生成最终报告"
            }

        success_rate = success / total * 100
        if success_rate >= 95:
            return {
                "level": "success",
                "message": f"灰度成功，成功率 {success_rate:.1f}% ({success}/{total})",
                "recommendation": "可继续推进下一批次或全量发布"
            }
        elif success_rate >= 80:
            return {
                "level": "warning",
                "message": f"灰度部分成功，成功率 {success_rate:.1f}% ({success}/{total})，失败 {failed} 个",
                "recommendation": "建议分析失败原因，考虑是否继续或回滚"
            }
        else:
            return {
                "level": "error",
                "message": f"灰度失败，成功率仅 {success_rate:.1f}% ({success}/{total})，失败 {failed} 个",
                "recommendation": "建议立即回滚所有设备，分析失败原因后重试"
            }

    @staticmethod
    def _generate_warnings(task: GrayscaleTask,
                           pending_confirm_devices: List[Device]) -> List[Dict[str, Any]]:
        """生成警告列表"""
        warnings = []

        for device in pending_confirm_devices:
            reasons = [r.value for r in device.processed_confirm_reasons]
            warnings.append({
                "type": "pending_confirm",
                "severity": "high",
                "device_id": device.original_device_id,
                "batch": device.original_batch,
                "reasons": reasons,
                "message": f"设备 {device.original_device_id} 需要人工确认: {', '.join(reasons)}"
            })

        for device in task.get_all_devices():
            if device.processed_current_state == GrayscaleState.ROLLBACK_FAILED:
                warnings.append({
                    "type": "rollback_failed",
                    "severity": "critical",
                    "device_id": device.original_device_id,
                    "batch": device.original_batch,
                    "message": f"设备 {device.original_device_id} 回滚失败，需要人工介入"
                })

        return warnings

    @staticmethod
    def export_json(data: Dict[str, Any], pretty: bool = True) -> str:
        """导出 JSON 格式"""
        indent = 2 if pretty else None
        return json.dumps(data, ensure_ascii=False, indent=indent)

    @staticmethod
    def export_terminal(data: Dict[str, Any], use_color: bool = True) -> str:
        """导出终端友好格式"""
        lines = []
        reset = "\033[0m" if use_color else ""

        summary = data["summary"]
        conclusion = data["conclusion"]
        warnings = data["warnings"]

        color = ReportExporter._get_state_color
        emoji = ReportExporter._get_state_emoji

        lines.append("=" * 70)
        lines.append("  IoT 设备固件灰度报告")
        lines.append("=" * 70)
        lines.append("")
        lines.append(f"任务ID: {summary['task_id']}")
        lines.append(f"任务名称: {summary['task_name']}")
        lines.append(f"目标版本: {summary['target_version']}")
        lines.append(f"生成时间: {data['generated_at']}")
        lines.append("")

        stats = summary["statistics"]
        total = summary["total_devices"]
        lines.append("-" * 70)
        lines.append("  总体统计")
        lines.append("-" * 70)
        lines.append(f"  设备总数: {total}")
        lines.append(f"  {color('success')}成功: {stats['success']}{reset}  "
                     f"{color('failed')}失败: {stats['failed']}{reset}  "
                     f"{color('pending')}待处理: {stats['pending']}{reset}")
        lines.append(f"  {color('rolled_back')}已回滚: {stats['rollback']}{reset}  "
                     f"{color('pending_confirm')}待确认: {stats['pending_confirm']}{reset}")
        lines.append(f"  成功率: {summary['success_rate']:.1f}%")
        lines.append("")

        lines.append("-" * 70)
        lines.append("  结论")
        lines.append("-" * 70)
        concl_color = {
            "success": color("success"),
            "warning": color("pending_confirm"),
            "error": color("failed"),
            "info": color("rolling"),
        }.get(conclusion["level"], "")
        lines.append(f"  {concl_color}[{conclusion['level'].upper()}] {conclusion['message']}{reset}")
        lines.append(f"  建议: {conclusion['recommendation']}")
        lines.append("")

        if warnings:
            lines.append("-" * 70)
            lines.append(f"  警告 ({len(warnings)})")
            lines.append("-" * 70)
            for w in warnings:
                sev_color = color("failed") if w["severity"] == "critical" else color("pending_confirm")
                lines.append(f"  {sev_color}{emoji('pending_confirm')} [{w['type']}] {w['message']}{reset}")
            lines.append("")

        lines.append("-" * 70)
        lines.append("  批次详情")
        lines.append("-" * 70)
        for batch in data["batches"]:
            b_orig = batch["original"]
            b_proc = batch["processed"]
            b_stats = b_proc["statistics"]
            state_color = color(b_proc["state"])
            lines.append("")
            lines.append(f"  批次: {b_orig['batch_id']} ({b_orig['batch_name']})")
            lines.append(f"  状态: {state_color}{emoji(b_proc['state'])} {b_proc['state']}{reset}")
            lines.append(f"  统计: 成功{b_stats['success']} "
                         f"失败{b_stats['failed'] + b_stats['rollback_failed']} "
                         f"待处理{b_stats['pending'] + b_stats['rolling']} "
                         f"已回滚{b_stats['rolled_back']} "
                         f"待确认{b_stats['pending_confirm']}")

            for device in batch["devices"]:
                d_orig = device["original"]
                d_proc = device["processed"]
                dev_state_color = color(d_proc["current_state"])
                dev_emoji = emoji(d_proc["current_state"])
                status_emoji = emoji(d_orig["online_status"])

                marker = ""
                if d_proc["current_state"] == "pending_confirm":
                    marker = f" {color('pending_confirm')}[待确认: {', '.join(d_proc['confirm_reasons'])}]{reset}"
                if d_proc["failure_count"] > 0:
                    marker += f" (失败{d_proc['failure_count']}次)"

                lines.append(f"    {dev_state_color}{dev_emoji}{reset} "
                             f"{d_orig['device_id']} "
                             f"{status_emoji}{d_orig['online_status']} "
                             f"{d_orig['firmware_version']} → {d_proc['target_version']} "
                             f"{dev_state_color}{d_proc['current_state']}{reset}"
                             f"{marker}")

                if d_proc["current_state"] in ["failed", "rollback_failed"]:
                    for log in device["logs"]["failures"][-2:]:
                        lines.append(f"       {color('failed')}└── {log}{reset}")
                if d_proc["current_state"] in ["rolled_back"]:
                    for log in device["logs"]["rollback"][-1:]:
                        lines.append(f"       {color('rolled_back')}└── {log}{reset}")

        if data.get("decision_logs"):
            lines.append("")
            lines.append("-" * 70)
            lines.append("  决策日志 (最近20条)")
            lines.append("-" * 70)
            for log in data["decision_logs"][-20:]:
                lines.append(f"  {log}")

        lines.append("")
        lines.append("=" * 70)
        lines.append("  原始信息: original_* 前缀字段为原始输入，不可修改")
        lines.append("  处理结果: processed_* 前缀字段为系统处理，用于决策")
        lines.append("=" * 70)

        return "\n".join(lines)

    @staticmethod
    def export_markdown(data: Dict[str, Any]) -> str:
        """导出 Markdown 格式"""
        lines = []
        emoji = ReportExporter._get_state_emoji

        summary = data["summary"]
        conclusion = data["conclusion"]
        warnings = data["warnings"]

        lines.append("# IoT 设备固件灰度报告")
        lines.append("")
        lines.append(f"> 生成时间: {data['generated_at']}")
        lines.append(f"> 报告版本: {data['report_version']}")
        lines.append("")

        lines.append("## 任务信息")
        lines.append("")
        lines.append(f"| 项目 | 内容 |")
        lines.append(f"|------|------|")
        lines.append(f"| 任务ID | `{summary['task_id']}` |")
        lines.append(f"| 任务名称 | {summary['task_name']} |")
        lines.append(f"| 目标版本 | `{summary['target_version']}` |")
        lines.append(f"| 描述 | {summary['description'] or '-'} |")
        lines.append(f"| 创建时间 | {summary['created_at']} |")
        lines.append(f"| 更新时间 | {summary['updated_at']} |")
        lines.append("")

        lines.append("## 总体统计")
        lines.append("")
        stats = summary["statistics"]
        total = summary["total_devices"]
        lines.append(f"- **设备总数**: {total}")
        lines.append(f"- {emoji('success')} **成功**: {stats['success']}")
        lines.append(f"- {emoji('failed')} **失败**: {stats['failed']}")
        lines.append(f"- {emoji('pending')} **待处理**: {stats['pending']}")
        lines.append(f"- {emoji('rolled_back')} **已回滚**: {stats['rollback']}")
        lines.append(f"- {emoji('pending_confirm')} **待确认**: {stats['pending_confirm']}")
        lines.append(f"- **成功率**: **{summary['success_rate']:.1f}%**")
        lines.append("")

        lines.append("## 结论")
        lines.append("")
        concl_badge = {
            "success": "✅ **SUCCESS**",
            "warning": "⚠️ **WARNING**",
            "error": "❌ **ERROR**",
            "info": "ℹ️ **INFO**",
        }.get(conclusion["level"], "")
        lines.append(f"### {concl_badge}")
        lines.append("")
        lines.append(f"> {conclusion['message']}")
        lines.append("")
        lines.append(f"**建议**: {conclusion['recommendation']}")
        lines.append("")

        if warnings:
            lines.append("## 警告")
            lines.append("")
            for w in warnings:
                sev = "🔴" if w["severity"] == "critical" else "🟡"
                lines.append(f"- {sev} **[{w['type']}]** {w['message']}")
            lines.append("")

        lines.append("## 批次详情")
        lines.append("")
        for batch in data["batches"]:
            b_orig = batch["original"]
            b_proc = batch["processed"]
            b_stats = b_proc["statistics"]
            lines.append(f"### {emoji(b_proc['state'])} 批次: {b_orig['batch_id']} ({b_orig['batch_name']})")
            lines.append("")
            lines.append(f"- **状态**: `{b_proc['state']}`")
            lines.append(f"- **统计**: 成功{b_stats['success']} / "
                         f"失败{b_stats['failed'] + b_stats['rollback_failed']} / "
                         f"待处理{b_stats['pending'] + b_stats['rolling']} / "
                         f"已回滚{b_stats['rolled_back']} / "
                         f"待确认{b_stats['pending_confirm']}")
            lines.append("")

            lines.append("| 设备ID | 原始状态 | 原版本 | 目标版本 | 当前状态 | 备注 |")
            lines.append("|---------|----------|--------|----------|----------|------|")
            for device in batch["devices"]:
                d_orig = device["original"]
                d_proc = device["processed"]
                status_emoji = emoji(d_orig["online_status"])
                state_emoji = emoji(d_proc["current_state"])

                remarks = []
                if d_proc["current_state"] == "pending_confirm":
                    remarks.append(f"⚠️ 待确认: {', '.join(d_proc['confirm_reasons'])}")
                if d_proc["failure_count"] > 0:
                    remarks.append(f"失败{d_proc['failure_count']}次")
                remarks_str = "<br>".join(remarks) if remarks else "-"

                lines.append(
                    f"| `{d_orig['device_id']}` | {status_emoji} {d_orig['online_status']} | "
                    f"`{d_orig['firmware_version']}` | `{d_proc['target_version']}` | "
                    f"{state_emoji} `{d_proc['current_state']}` | {remarks_str} |"
                )

            lines.append("")
            lines.append("#### 设备日志摘要")
            lines.append("")
            for device in batch["devices"]:
                d_orig = device["original"]
                d_proc = device["processed"]
                if d_proc["current_state"] in ["failed", "rollback_failed", "rolled_back"]:
                    lines.append(f"##### {d_orig['device_id']}")
                    if device["logs"]["failures"]:
                        lines.append("")
                        lines.append("**失败日志**:")
                        for log in device["logs"]["failures"][-3:]:
                            lines.append(f"- `{log}`")
                    if device["logs"]["rollback"]:
                        lines.append("")
                        lines.append("**回滚日志**:")
                        for log in device["logs"]["rollback"][-3:]:
                            lines.append(f"- `{log}`")
                    lines.append("")

        if data.get("pending_confirm_devices"):
            lines.append("## 待确认设备清单")
            lines.append("")
            lines.append("| 设备ID | 批次 | 待确认原因 |")
            lines.append("|---------|------|------------|")
            for item in data["pending_confirm_devices"]:
                lines.append(
                    f"| `{item['device_id']}` | {item['batch']} | "
                    f"{', '.join([f'`{r}`' for r in item['reasons']])} |"
                )
            lines.append("")

        if data.get("rollback_records"):
            lines.append("## 回滚记录")
            lines.append("")
            lines.append("| 设备ID | 从版本 | 到版本 | 原因 | 结果 | 回滚时间 |")
            lines.append("|---------|--------|--------|------|------|----------|")
            for record in data["rollback_records"]:
                result = "✅ 成功" if record["processed_rollback_success"] else "❌ 失败"
                lines.append(
                    f"| `{record['original_device_id']}` | "
                    f"`{record['original_from_version']}` | "
                    f"`{record['original_to_version']}` | "
                    f"{record['original_reason']} | {result} | "
                    f"{record['meta_created_at']} |"
                )
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("> **字段说明**:")
        lines.append("> - `original_*`: 原始输入信息，不可修改，用于溯源")
        lines.append("> - `processed_*`: 系统处理结果，可修改，用于决策")
        lines.append("> - `meta_*`: 元数据，用于审计追踪")
        lines.append("")

        return "\n".join(lines)

    @classmethod
    def export(cls, task: GrayscaleTask,
               rollback_engine: Optional[RollbackEngine] = None,
               decision_logs: Optional[List[str]] = None,
               format_type: str = "terminal") -> str:
        """统一导出入口
        format_type: terminal | json | markdown
        """
        data = cls.build_unified_data(task, rollback_engine, decision_logs)

        if format_type == "json":
            return cls.export_json(data)
        elif format_type == "markdown":
            return cls.export_markdown(data)
        else:
            return cls.export_terminal(data)

    @classmethod
    def export_all(cls, task: GrayscaleTask,
                   rollback_engine: Optional[RollbackEngine] = None,
                   decision_logs: Optional[List[str]] = None) -> Dict[str, str]:
        """导出所有格式，用于验证一致性"""
        data = cls.build_unified_data(task, rollback_engine, decision_logs)
        return {
            "json": cls.export_json(data),
            "terminal": cls.export_terminal(data),
            "markdown": cls.export_markdown(data),
        }
