import json
import os
from datetime import datetime, time
from pathlib import Path
from typing import Any, Dict, List, Optional

from theater_audio_checker.models import (
    AudioItem,
    ZoneSchedule,
    DeviceLog,
    ReviewNote,
    CheckResult,
    CheckIssue,
    CheckSeverity,
    AudioType,
    ZoneStatus,
    ExportData
)


class MarkdownExporter:
    """Markdown 交班单导出器"""

    @staticmethod
    def _severity_icon(severity: CheckSeverity) -> str:
        """获取严重程度图标"""
        icons = {
            CheckSeverity.CRITICAL: "🔴",
            CheckSeverity.WARNING: "🟡",
            CheckSeverity.INFO: "🔵"
        }
        return icons.get(severity, "⚪")

    @staticmethod
    def _audio_type_name(audio_type: AudioType) -> str:
        """音频类型中文名称"""
        names = {
            AudioType.OPENING_BELL: "开场铃",
            AudioType.TOUR_PROMPT: "巡演提示音",
            AudioType.EVACUATION: "疏散广播",
            AudioType.BACKGROUND: "背景音乐",
            AudioType.ANNOUNCEMENT: "常规广播",
            AudioType.OTHER: "其他"
        }
        return names.get(audio_type, audio_type.value)

    @staticmethod
    def _zone_status_name(status: ZoneStatus) -> str:
        """设备状态中文名称"""
        names = {
            ZoneStatus.ONLINE: "在线",
            ZoneStatus.OFFLINE: "离线",
            ZoneStatus.MAINTENANCE: "维护中"
        }
        return names.get(status, status.value)

    @classmethod
    def generate_handover_report(
        cls,
        export_data: ExportData,
        title: Optional[str] = None
    ) -> str:
        """生成交班单 Markdown 内容"""
        lines = []
        
        check_result = export_data.check_result
        
        report_title = title or "剧场音频系统每日检查交班单"
        lines.append(f"# {report_title}")
        lines.append("")
        
        lines.append("## 基本信息")
        lines.append("")
        lines.append(f"- **目标日期**: {export_data.target_date}")
        lines.append(f"- **导出时间**: {export_data.export_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"- **工具版本**: {export_data.version}")
        lines.append("")
        
        if check_result:
            lines.append("## 检查汇总")
            lines.append("")
            
            status_emoji = "✅" if check_result.is_all_clear else "⚠️" if check_result.fail_count == 0 else "❌"
            lines.append(f"**总体状态**: {status_emoji}")
            lines.append("")
            
            lines.append("| 统计项 | 数量 |")
            lines.append("|--------|------|")
            lines.append(f"| 总音频项目 | {check_result.total_audio_items} |")
            lines.append(f"| 总播放计划 | {check_result.total_schedules} |")
            lines.append(f"| 总设备数 | {check_result.total_devices} |")
            lines.append(f"| ✅ 通过检查 | {check_result.pass_count} |")
            lines.append(f"| 🔴 严重错误 | {check_result.fail_count} |")
            lines.append(f"| 🟡 警告 | {check_result.warning_count} |")
            lines.append("")
            
            if check_result.issues:
                lines.append("## 发现的问题")
                lines.append("")
                
                issues_by_severity: Dict[CheckSeverity, List[CheckIssue]] = {}
                for issue in check_result.issues:
                    if issue.severity not in issues_by_severity:
                        issues_by_severity[issue.severity] = []
                    issues_by_severity[issue.severity].append(issue)
                
                for severity in [CheckSeverity.CRITICAL, CheckSeverity.WARNING, CheckSeverity.INFO]:
                    if severity in issues_by_severity:
                        severity_issues = issues_by_severity[severity]
                        icon = cls._severity_icon(severity)
                        severity_name = {
                            CheckSeverity.CRITICAL: "严重错误",
                            CheckSeverity.WARNING: "警告",
                            CheckSeverity.INFO: "信息"
                        }[severity]
                        
                        lines.append(f"### {icon} {severity_name} ({len(severity_issues)})")
                        lines.append("")
                        
                        for idx, issue in enumerate(severity_issues, 1):
                            check_type_name = cls._get_check_type_name(issue.check_type)
                            lines.append(f"#### {idx}. [{check_type_name}] {issue.message}")
                            lines.append("")
                            
                            if issue.affected_item:
                                lines.append(f"- **受影响项目**: {issue.affected_item_name or issue.affected_item} (ID: `{issue.affected_item}`)")
                            
                            if issue.details:
                                details_lines = cls._format_details(issue.details)
                                if details_lines:
                                    lines.append("- **详细信息**:")
                                    lines.append("")
                                    lines.append("```json")
                                    lines.append(json.dumps(issue.details, ensure_ascii=False, indent=2))
                                    lines.append("```")
                                    lines.append("")
                            
                            if issue.review_note_id:
                                lines.append(f"- **已复核**: 备注 ID `{issue.review_note_id}`")
                                lines.append("")
        
        lines.append("## 音频清单")
        lines.append("")
        
        if export_data.audio_items:
            lines.append("| ID | 名称 | 类型 | 响度(dBFS) | 状态 |")
            lines.append("|----|------|------|------------|------|")
            
            for audio in export_data.audio_items:
                type_name = cls._audio_type_name(audio.audio_type)
                loudness_status = "✅" if audio.is_loudness_ok else "⚠️"
                lines.append(f"| `{audio.audio_id}` | {audio.name} | {type_name} | {audio.loudness_dbfs} | {loudness_status} |")
        else:
            lines.append("*无音频数据*")
        
        lines.append("")
        
        lines.append("## 分区播放计划")
        lines.append("")
        
        if export_data.zone_schedules:
            lines.append("| 分区 | 音频ID | 开始时间 | 结束时间 | 覆盖 |")
            lines.append("|------|--------|----------|----------|------|")
            
            for sched in export_data.zone_schedules:
                override_mark = "✅" if sched.is_override else "-"
                lines.append(f"| {sched.zone_name} | `{sched.audio_id}` | {sched.start_time} | {sched.end_time} | {override_mark} |")
        else:
            lines.append("*无播放计划数据*")
        
        lines.append("")
        
        lines.append("## 设备状态")
        lines.append("")
        
        if export_data.device_logs:
            lines.append("| 分区 | 设备名称 | 状态 | 检查时间 |")
            lines.append("|------|----------|------|----------|")
            
            for device in export_data.device_logs:
                status_icon = {
                    ZoneStatus.ONLINE: "🟢",
                    ZoneStatus.OFFLINE: "🔴",
                    ZoneStatus.MAINTENANCE: "🟡"
                }.get(device.status, "⚪")
                status_name = cls._zone_status_name(device.status)
                check_time_str = device.check_time.strftime('%H:%M:%S')
                lines.append(f"| {device.zone_name} | {device.device_name} | {status_icon} {status_name} | {check_time_str} |")
        else:
            lines.append("*无设备数据*")
        
        lines.append("")
        
        lines.append("## 复核备注")
        lines.append("")
        
        if export_data.review_notes:
            for idx, note in enumerate(export_data.review_notes, 1):
                status_icon = "✅" if note.status == "pass" else "⚠️" if note.status == "manual_review" else "❌"
                lines.append(f"### {idx}. {status_icon} {note.item_type} - {note.item_id}")
                lines.append("")
                lines.append(f"- **复核人**: {note.reviewer}")
                lines.append(f"- **复核时间**: {note.review_time.strftime('%Y-%m-%d %H:%M:%S')}")
                lines.append(f"- **复核状态**: {note.status.value}")
                lines.append(f"- **复核意见**: {note.comment}")
                lines.append("")
        else:
            lines.append("*无复核备注*")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("*此报告由剧场音频检查工具自动生成*")
        
        return "\n".join(lines)

    @staticmethod
    def _get_check_type_name(check_type: str) -> str:
        """获取检查类型中文名"""
        names = {
            "loudness_check": "响度检查",
            "time_conflict_check": "时段冲突",
            "emergency_broadcast_check": "应急广播检查",
            "missing_file_check": "文件缺失",
            "duplicate_file_check": "重复文件",
            "device_status_check": "设备状态",
            "audio_reference_check": "音频引用"
        }
        return names.get(check_type, check_type)

    @staticmethod
    def _format_details(details: Dict) -> List[str]:
        """格式化详细信息"""
        if not details:
            return []
        return []

    @classmethod
    def export_to_file(
        cls,
        export_data: ExportData,
        file_path: str,
        title: Optional[str] = None
    ):
        """导出到 Markdown 文件"""
        content = cls.generate_handover_report(export_data, title)
        
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)


class JsonExporter:
    """JSON 明细导出器"""

    @staticmethod
    def _convert_to_serializable(obj: Any) -> Any:
        """转换为可序列化对象"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, time):
            return obj.strftime("%H:%M:%S")
        if hasattr(obj, "value"):
            return obj.value
        if hasattr(obj, "dict"):
            return JsonExporter._model_to_dict(obj)
        if isinstance(obj, list):
            return [JsonExporter._convert_to_serializable(item) for item in obj]
        if isinstance(obj, dict):
            return {k: JsonExporter._convert_to_serializable(v) for k, v in obj.items()}
        return obj

    @staticmethod
    def _model_to_dict(model: Any) -> Dict:
        """将 Pydantic 模型转换为字典"""
        if hasattr(model, "model_dump"):
            data = model.model_dump()
        elif hasattr(model, "dict"):
            data = model.dict()
        else:
            data = dict(model)
        
        return JsonExporter._convert_to_serializable(data)

    @classmethod
    def generate_json(
        cls,
        export_data: ExportData,
        indent: int = 2
    ) -> str:
        """生成 JSON 字符串"""
        data = {
            "version": export_data.version,
            "export_time": export_data.export_time.isoformat(),
            "target_date": export_data.target_date,
            "summary": {}
        }
        
        if export_data.check_result:
            data["summary"] = {
                "total_audio_items": export_data.check_result.total_audio_items,
                "total_schedules": export_data.check_result.total_schedules,
                "total_devices": export_data.check_result.total_devices,
                "pass_count": export_data.check_result.pass_count,
                "fail_count": export_data.check_result.fail_count,
                "warning_count": export_data.check_result.warning_count,
                "needs_review_count": export_data.check_result.needs_review_count,
                "total_issues": export_data.check_result.total_issues,
                "is_all_clear": export_data.check_result.is_all_clear
            }
            data["check_result"] = cls._model_to_dict(export_data.check_result)
        
        data["audio_items"] = [cls._model_to_dict(a) for a in export_data.audio_items]
        data["zone_schedules"] = [cls._model_to_dict(s) for s in export_data.zone_schedules]
        data["device_logs"] = [cls._model_to_dict(d) for d in export_data.device_logs]
        data["review_notes"] = [cls._model_to_dict(n) for n in export_data.review_notes]
        
        return json.dumps(data, ensure_ascii=False, indent=indent)

    @classmethod
    def export_to_file(
        cls,
        export_data: ExportData,
        file_path: str,
        indent: int = 2
    ):
        """导出到 JSON 文件"""
        content = cls.generate_json(export_data, indent)
        
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
