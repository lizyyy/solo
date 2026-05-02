"""报告导出模块"""

import csv
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import Event, EventType, ProjectConfig, Timeline


class Reporter:
    """报告生成器
    
    负责生成：
    1. Markdown格式的复盘报告
    2. CSV格式的事件清单
    """
    
    EVENT_TYPE_DISPLAY = {
        EventType.ALERT_TRIGGER: '🔔 告警触发',
        EventType.ALERT_RECOVER: '✅ 告警恢复',
        EventType.HUMAN_CONFIRM: '👤 人工确认',
        EventType.CHANGE_OPERATION: '🔧 变更操作',
        EventType.ERROR_SURGE: '💥 错误激增',
        EventType.RECOVERY_VERIFY: '✅ 恢复验证',
        EventType.TODO_ITEM: '📋 待办事项',
        EventType.UNKNOWN: '❓ 未知',
    }
    
    SEVERITY_DISPLAY = {
        'critical': '🔴 严重',
        'error': '🟠 错误',
        'warning': '🟡 警告',
        'info': '🔵 信息',
        'debug': '⚪ 调试',
    }
    
    def __init__(self, config: ProjectConfig):
        self.config = config
    
    def export_markdown(self, timeline: Timeline, output_path: Path) -> None:
        """导出Markdown格式的复盘报告
        
        报告包含：
        - 故障基本信息
        - 时间线概览
        - 影响时长分析
        - 关键事件和证据
        - 待办事项
        """
        content = self._generate_markdown_content(timeline)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def _generate_markdown_content(self, timeline: Timeline) -> str:
        """生成Markdown报告内容"""
        lines = []
        
        lines.append(f"# {timeline.title}")
        lines.append("")
        lines.append(f"> 时间线ID: `{timeline.id}`")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        summary = self._calculate_summary(timeline)
        lines.append("## 📊 概览")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总事件数 | {summary['total_events']} |")
        lines.append(f"| 去重后事件 | {summary['unique_events']} |")
        lines.append(f"| 隔离事件 | {summary['quarantined_events']} |")
        lines.append(f"| 开始时间 | {summary['start_time']} |")
        lines.append(f"| 结束时间 | {summary['end_time']} |")
        lines.append(f"| **总影响时长** | **{summary['total_duration']}** |")
        
        if summary.get('detection_to_confirm'):
            lines.append(f"| 检测到确认耗时 | {summary['detection_to_confirm']} |")
        if summary.get('confirm_to_recovery'):
            lines.append(f"| 确认到恢复耗时 | {summary['confirm_to_recovery']} |")
        
        lines.append("")
        
        lines.append("## ⏱️ 时间线分析")
        lines.append("")
        
        if summary['first_alert']:
            lines.append(f"- **首次告警**: {summary['first_alert']}")
        if summary['first_confirm']:
            lines.append(f"- **首次确认**: {summary['first_confirm']}")
        if summary['first_recovery']:
            lines.append(f"- **首次恢复**: {summary['first_recovery']}")
        
        lines.append("")
        
        lines.append("## 📅 详细时间线")
        lines.append("")
        
        non_duplicate_events = [e for e in timeline.events if not e.is_duplicate]
        
        for i, event in enumerate(non_duplicate_events, 1):
            event_type_display = self.EVENT_TYPE_DISPLAY.get(event.event_type, event.event_type)
            severity_display = self.SEVERITY_DISPLAY.get(event.severity, '')
            
            lines.append(f"### {i}. {event_type_display}")
            lines.append("")
            lines.append(f"- **时间**: {self._format_datetime(event.timestamp)}")
            if event.severity:
                lines.append(f"- **级别**: {severity_display}")
            lines.append(f"- **来源**: {event.source}")
            if event.source_file:
                lines.append(f"- **来源文件**: `{event.source_file}`")
            lines.append("")
            lines.append(f"**标题**: {event.title}")
            lines.append("")
            
            if event.description:
                lines.append("**详情**:")
                lines.append("```")
                lines.append(self._truncate_text(event.description, 2000))
                lines.append("```")
                lines.append("")
            
            if event.tags:
                lines.append(f"**标签**: {', '.join(event.tags)}")
                lines.append("")
        
        key_evidence = self._extract_key_evidence(timeline)
        if key_evidence:
            lines.append("## 🔍 关键证据片段")
            lines.append("")
            
            for i, evidence in enumerate(key_evidence, 1):
                lines.append(f"### {i}. {evidence['title']}")
                lines.append("")
                lines.append(f"- **时间**: {self._format_datetime(evidence['timestamp'])}")
                lines.append(f"- **类型**: {evidence['type']}")
                lines.append("")
                lines.append("```")
                lines.append(evidence['content'])
                lines.append("```")
                lines.append("")
        
        todo_items = self._extract_todo_items(timeline)
        if todo_items:
            lines.append("## 📋 待办事项")
            lines.append("")
            
            for i, item in enumerate(todo_items, 1):
                lines.append(f"{i}. [ ] {item['title']}")
                if item.get('description'):
                    lines.append(f"   - {item['description']}")
                lines.append(f"   - 来源: {item['source']} ( {self._format_datetime(item['timestamp'])} )")
                lines.append("")
        
        if timeline.quarantined_events:
            lines.append("## ⚠️ 隔离事件")
            lines.append("")
            lines.append(f"共 {len(timeline.quarantined_events)} 条事件被隔离，原因如下：")
            lines.append("")
            
            for i, event in enumerate(timeline.quarantined_events, 1):
                lines.append(f"{i}. **{event.title}**")
                lines.append(f"   - 隔离原因: {event.quarantine_reason}")
                lines.append(f"   - 时间: {self._format_datetime(event.timestamp)}")
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append(f"*报告由故障复盘拼图器生成 | {datetime.now().strftime('%Y-%m-%d')}*")
        
        return '\n'.join(lines)
    
    def _calculate_summary(self, timeline: Timeline) -> Dict[str, Any]:
        """计算时间线摘要信息"""
        non_duplicate_events = [e for e in timeline.events if not e.is_duplicate]
        
        summary = {
            'total_events': len(timeline.events),
            'unique_events': len(non_duplicate_events),
            'quarantined_events': len(timeline.quarantined_events),
            'start_time': '-',
            'end_time': '-',
            'total_duration': '-',
        }
        
        if timeline.start_time and timeline.end_time:
            summary['start_time'] = self._format_datetime(timeline.start_time)
            summary['end_time'] = self._format_datetime(timeline.end_time)
            summary['total_duration'] = self._format_duration(
                timeline.end_time - timeline.start_time
            )
        
        alert_triggers = [e for e in non_duplicate_events if e.event_type == EventType.ALERT_TRIGGER]
        if alert_triggers:
            first_alert = min(alert_triggers, key=lambda e: e.timestamp)
            summary['first_alert'] = self._format_datetime(first_alert.timestamp)
        
        confirms = [e for e in non_duplicate_events if e.event_type == EventType.HUMAN_CONFIRM]
        if confirms:
            first_confirm = min(confirms, key=lambda e: e.timestamp)
            summary['first_confirm'] = self._format_datetime(first_confirm.timestamp)
            
            if alert_triggers:
                first_alert = min(alert_triggers, key=lambda e: e.timestamp)
                detection_confirm_duration = first_confirm.timestamp - first_alert.timestamp
                summary['detection_to_confirm'] = self._format_duration(detection_confirm_duration)
        
        recoveries = [
            e for e in non_duplicate_events 
            if e.event_type in [EventType.ALERT_RECOVER, EventType.RECOVERY_VERIFY]
        ]
        if recoveries:
            first_recovery = min(recoveries, key=lambda e: e.timestamp)
            summary['first_recovery'] = self._format_datetime(first_recovery.timestamp)
            
            if confirms:
                first_confirm = min(confirms, key=lambda e: e.timestamp)
                confirm_recovery_duration = first_recovery.timestamp - first_confirm.timestamp
                summary['confirm_to_recovery'] = self._format_duration(confirm_recovery_duration)
        
        return summary
    
    def _extract_key_evidence(self, timeline: Timeline) -> List[Dict[str, Any]]:
        """提取关键证据片段"""
        evidence = []
        non_duplicate_events = [e for e in timeline.events if not e.is_duplicate]
        
        critical_events = [
            e for e in non_duplicate_events 
            if e.severity in ['critical', 'error'] or 
               e.event_type in [EventType.ERROR_SURGE, EventType.CHANGE_OPERATION]
        ]
        
        for event in critical_events[:10]:
            content = event.description or event.title
            evidence.append({
                'title': event.title,
                'timestamp': event.timestamp,
                'type': self.EVENT_TYPE_DISPLAY.get(event.event_type, event.event_type),
                'content': self._truncate_text(content, 500),
            })
        
        return evidence
    
    def _extract_todo_items(self, timeline: Timeline) -> List[Dict[str, Any]]:
        """提取待办事项"""
        non_duplicate_events = [e for e in timeline.events if not e.is_duplicate]
        
        todo_events = [e for e in non_duplicate_events if e.event_type == EventType.TODO_ITEM]
        
        todo_items = []
        for event in todo_events:
            todo_items.append({
                'title': event.title,
                'description': event.description,
                'timestamp': event.timestamp,
                'source': event.source,
            })
        
        return todo_items
    
    def export_csv(self, timeline: Timeline, output_path: Path) -> None:
        """导出CSV格式的事件清单"""
        non_duplicate_events = [e for e in timeline.events if not e.is_duplicate]
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                '序号', '时间(UTC)', '时间(本地)', '事件类型', '严重级别',
                '标题', '描述', '来源', '来源文件', '服务', '标签', '事件ID'
            ])
            
            for i, event in enumerate(non_duplicate_events, 1):
                local_time = self._to_local_time(event.timestamp)
                
                writer.writerow([
                    i,
                    event.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                    local_time.strftime('%Y-%m-%d %H:%M:%S'),
                    self.EVENT_TYPE_DISPLAY.get(event.event_type, event.event_type),
                    event.severity or '',
                    event.title,
                    event.description or '',
                    event.source,
                    event.source_file or '',
                    event.service or '',
                    ', '.join(event.tags) if event.tags else '',
                    event.id,
                ])
    
    def _format_datetime(self, dt: datetime) -> str:
        """格式化日期时间"""
        local_dt = self._to_local_time(dt)
        return local_dt.strftime('%Y-%m-%d %H:%M:%S')
    
    def _to_local_time(self, dt: datetime) -> datetime:
        """转换为本地时间"""
        import pytz
        
        try:
            local_tz = pytz.timezone(self.config.default_timezone)
            if dt.tzinfo is None:
                dt = pytz.UTC.localize(dt)
            return dt.astimezone(local_tz)
        except Exception:
            return dt
    
    def _format_duration(self, delta: timedelta) -> str:
        """格式化持续时间"""
        total_seconds = int(delta.total_seconds())
        
        hours, remainder = divmod(total_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        
        parts = []
        if hours > 0:
            parts.append(f"{hours}小时")
        if minutes > 0:
            parts.append(f"{minutes}分钟")
        if seconds > 0 and hours == 0:
            parts.append(f"{seconds}秒")
        
        if not parts:
            return "0秒"
        
        return ' '.join(parts)
    
    def _truncate_text(self, text: str, max_length: int) -> str:
        """截断文本到指定长度"""
        if len(text) <= max_length:
            return text
        return text[:max_length] + f"\n... (已截断，共 {len(text)} 字符)"
