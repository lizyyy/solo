from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.drill import Drill, DrillStatus
from models.event import Event, MergeStatus
from models.risk_level import RiskLevel
from detector.issue_detector import Issue, IssueType, IssueSeverity, IssueStatus
from config import APP_NAME, APP_VERSION


class MarkdownExporter:
    def __init__(self):
        self._area_names: Dict[str, str] = {}
        self._event_type_names: Dict[str, str] = {}
        self._observer_names: Dict[str, str] = {}
    
    def set_area_names(self, area_names: Dict[str, str]):
        self._area_names = area_names
    
    def set_event_type_names(self, event_type_names: Dict[str, str]):
        self._event_type_names = event_type_names
    
    def set_observer_names(self, observer_names: Dict[str, str]):
        self._observer_names = observer_names
    
    def _get_area_name(self, code: str) -> str:
        return self._area_names.get(code, code)
    
    def _get_event_type_name(self, code: str) -> str:
        return self._event_type_names.get(code, code)
    
    def _get_observer_name(self, code: str) -> str:
        return self._observer_names.get(code, code)
    
    def _format_time(self, dt: Optional[datetime]) -> str:
        if dt is None:
            return "未知时间"
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    
    def _format_time_short(self, dt: Optional[datetime]) -> str:
        if dt is None:
            return "--:--:--"
        return dt.strftime("%H:%M:%S")
    
    def _format_duration(self, seconds: int) -> str:
        if seconds < 60:
            return f"{seconds}秒"
        elif seconds < 3600:
            return f"{seconds // 60}分{seconds % 60}秒"
        else:
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            return f"{hours}小时{minutes}分"
    
    def _get_risk_level_icon(self, risk_level: RiskLevel) -> str:
        if risk_level == RiskLevel.CRITICAL:
            return "🔴"
        elif risk_level == RiskLevel.HIGH:
            return "🟠"
        elif risk_level == RiskLevel.MEDIUM:
            return "🟡"
        else:
            return "🟢"
    
    def _get_issue_severity_icon(self, severity: IssueSeverity) -> str:
        if severity == IssueSeverity.CRITICAL:
            return "🛑"
        elif severity == IssueSeverity.HIGH:
            return "⚠️"
        elif severity == IssueSeverity.MEDIUM:
            return "⚡"
        else:
            return "ℹ️"
    
    def export(
        self,
        drill: Drill,
        events: List[Event],
        issues: List[Issue],
        import_batches: Optional[List] = None,
        time_offsets: Optional[Dict[str, int]] = None,
        output_path: Optional[str] = None,
    ) -> str:
        lines = []
        
        lines.append(f"# {drill.name}")
        lines.append("")
        lines.append(f"> 演练复盘报告")
        lines.append("")
        lines.append(f"**生成时间**: {self._format_time(datetime.now())}")
        lines.append(f"**生成工具**: {APP_NAME} v{APP_VERSION}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 一、演练基本信息")
        lines.append("")
        
        info_table = [
            "| 项目 | 内容 |",
            "|------|------|",
        ]
        
        info_table.append(f"| 演练名称 | {drill.name} |")
        info_table.append(f"| 演练编号 | {drill.code} |")
        info_table.append(f"| 演练类型 | {drill.drill_type or '未指定'} |")
        info_table.append(f"| 当前状态 | {drill.status} |")
        info_table.append(f"| 计划开始时间 | {self._format_time(drill.planned_start_time)} |")
        info_table.append(f"| 实际开始时间 | {self._format_time(drill.actual_start_time)} |")
        info_table.append(f"| 实际结束时间 | {self._format_time(drill.actual_end_time)} |")
        
        if drill.actual_start_time and drill.actual_end_time:
            duration = int((drill.actual_end_time - drill.actual_start_time).total_seconds())
            info_table.append(f"| 演练时长 | {self._format_duration(duration)} |")
        
        if drill.description:
            info_table.append(f"| 描述 | {drill.description} |")
        
        lines.extend(info_table)
        lines.append("")
        
        if import_batches:
            lines.append("## 二、数据导入情况")
            lines.append("")
            
            lines.append(f"共导入 **{len(import_batches)}** 个批次。")
            lines.append("")
            
            batch_table = [
                "| 批次 | 文件名 | 来源 | 总记录 | 有效 | 无效 | 状态 |",
                "|------|--------|------|--------|------|------|------|",
            ]
            
            for i, batch in enumerate(import_batches, 1):
                batch_table.append(
                    f"| {i} | {batch.file_name} | {batch.source_name or '-'} | "
                    f"{batch.total_records} | {batch.valid_records} | {batch.invalid_records} | "
                    f"{batch.status} |"
                )
            
            lines.extend(batch_table)
            lines.append("")
        
        if time_offsets:
            lines.append("## 三、时间偏移配置")
            lines.append("")
            
            offset_table = [
                "| 来源 | 偏移量(秒) | 说明 |",
                "|------|-----------|------|",
            ]
            
            for source, offset in time_offsets.items():
                direction = "提前" if offset > 0 else "延后" if offset < 0 else "无偏移"
                abs_offset = abs(offset)
                offset_table.append(f"| {source} | {offset} | {direction} {self._format_duration(abs_offset)} |")
            
            lines.extend(offset_table)
            lines.append("")
        
        lines.append("## 四、事件时间线")
        lines.append("")
        
        if not events:
            lines.append("*暂无事件记录*")
            lines.append("")
        else:
            valid_events = [e for e in events if e.is_valid]
            valid_events.sort(key=lambda e: e.unified_time or datetime.min)
            
            lines.append(f"共 **{len(valid_events)}** 条有效事件记录。")
            lines.append("")
            
            lines.append("### 4.1 时间线概览")
            lines.append("")
            
            current_hour = None
            for event in valid_events:
                unified_time = event.unified_time
                
                if unified_time:
                    hour = unified_time.hour
                    if current_hour != hour:
                        current_hour = hour
                        lines.append(f"#### {hour:02d}时")
                        lines.append("")
                
                time_str = self._format_time_short(unified_time)
                risk_icon = self._get_risk_level_icon(event.risk_level)
                area_name = self._get_area_name(event.area_code)
                event_type_name = self._get_event_type_name(event.event_type_code)
                
                line = f"- **[{time_str}]** {risk_icon} `{event.source}`"
                line += f" - {area_name} - {event_type_name}"
                if event.description:
                    line += f": {event.description}"
                
                lines.append(line)
            
            lines.append("")
            
            lines.append("### 4.2 事件详细列表")
            lines.append("")
            
            detail_table = [
                "| 序号 | 时间 | 来源 | 区域 | 事件类型 | 风险 | 描述 | 照片 | 备注 |",
                "|------|------|------|------|----------|------|------|------|------|",
            ]
            
            for i, event in enumerate(valid_events, 1):
                time_str = self._format_time_short(event.unified_time)
                risk_icon = self._get_risk_level_icon(event.risk_level)
                area_name = self._get_area_name(event.area_code)
                event_type_name = self._get_event_type_name(event.event_type_code)
                photos = ", ".join(event.photo_numbers) if event.photo_numbers else "-"
                notes = event.notes or "-"
                desc = event.description or "-"
                
                detail_table.append(
                    f"| {i} | {time_str} | {event.source} | {area_name} | {event_type_name} | "
                    f"{risk_icon} | {desc} | {photos} | {notes} |"
                )
            
            lines.extend(detail_table)
            lines.append("")
        
        if issues:
            lines.append("## 五、问题检测报告")
            lines.append("")
            
            critical_count = sum(1 for i in issues if i.severity == IssueSeverity.CRITICAL)
            high_count = sum(1 for i in issues if i.severity == IssueSeverity.HIGH)
            medium_count = sum(1 for i in issues if i.severity == IssueSeverity.MEDIUM)
            low_count = sum(1 for i in issues if i.severity == IssueSeverity.LOW)
            
            lines.append(f"共检测到 **{len(issues)}** 个问题:")
            lines.append(f"- 🔴 严重: {critical_count} 个")
            lines.append(f"- 🟠 高: {high_count} 个")
            lines.append(f"- 🟡 中: {medium_count} 个")
            lines.append(f"- 🟢 低: {low_count} 个")
            lines.append("")
            
            for severity in [IssueSeverity.CRITICAL, IssueSeverity.HIGH, IssueSeverity.MEDIUM, IssueSeverity.LOW]:
                severity_issues = [i for i in issues if i.severity == severity]
                if not severity_issues:
                    continue
                
                icon = self._get_issue_severity_icon(severity)
                lines.append(f"### 5.{list(IssueSeverity).index(severity) + 1} {icon} {severity.value}级别问题")
                lines.append("")
                
                for issue in severity_issues:
                    lines.append(f"#### {issue.title}")
                    lines.append("")
                    lines.append(f"**类型**: {issue.issue_type}")
                    lines.append(f"**状态**: {issue.status}")
                    
                    if issue.related_sources:
                        lines.append(f"**涉及来源**: {', '.join(issue.related_sources)}")
                    
                    if issue.related_area_codes:
                        area_names = [self._get_area_name(c) for c in issue.related_area_codes]
                        lines.append(f"**涉及区域**: {', '.join(area_names)}")
                    
                    lines.append("")
                    lines.append(f"> {issue.description}")
                    lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append(f"*本报告由 {APP_NAME} v{APP_VERSION} 自动生成*")
        lines.append("")
        
        content = "\n".join(lines)
        
        if output_path:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            output_file.write_text(content, encoding='utf-8')
        
        return content
