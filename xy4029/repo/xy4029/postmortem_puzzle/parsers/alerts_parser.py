"""告警CSV解析器"""

import csv
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytz

from ..config import Event, EventSource, EventType, ProjectConfig


class AlertsParser:
    """监控告警CSV解析器
    
    支持常见的监控系统CSV导出格式，如Prometheus Alertmanager、
    Zabbix、Nagios等导出的告警CSV。
    """
    
    COMMON_TIMESTAMP_FIELDS = [
        'timestamp', 'time', 'date', 'datetime', 
        'startsAt', 'endsAt', 'start_time', 'end_time',
        'alert_time', 'trigger_time', 'recovery_time',
        '发生时间', '触发时间', '恢复时间'
    ]
    
    COMMON_SEVERITY_FIELDS = [
        'severity', 'level', 'priority', 'status',
        '严重级别', '级别', '优先级'
    ]
    
    COMMON_TITLE_FIELDS = [
        'alertname', 'alert_name', 'name', 'title', 'summary',
        '告警名称', '标题', '摘要'
    ]
    
    COMMON_DESCRIPTION_FIELDS = [
        'description', 'message', 'details', 'annotations',
        '描述', '消息', '详情', '注解'
    ]
    
    COMMON_STATUS_FIELDS = [
        'status', 'state', 'alert_state',
        '状态', '告警状态'
    ]
    
    def __init__(self, config: ProjectConfig):
        self.config = config
    
    def parse(self, csv_path: Path, timezone: str = 'Asia/Shanghai') -> List[Event]:
        """解析告警CSV文件
        
        Args:
            csv_path: CSV文件路径
            timezone: CSV文件的时区，用于解析不带时区的时间戳
            
        Returns:
            解析出的事件列表
        """
        events: List[Event] = []
        
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                event = self._parse_row(row, timezone, csv_path.name)
                if event:
                    events.append(event)
        
        return events
    
    def _parse_row(self, row: Dict[str, Any], timezone: str, source_file: str) -> Optional[Event]:
        """解析单行CSV数据"""
        timestamp = self._extract_timestamp(row, timezone)
        if not timestamp:
            return None
        
        event_type = self._determine_event_type(row)
        severity = self._extract_severity(row)
        title = self._extract_title(row)
        description = self._extract_description(row)
        
        if not title:
            title = f"告警事件 - {severity or '未知级别'}"
        
        event = Event(
            id=str(uuid.uuid4()),
            timestamp=timestamp,
            original_timestamp=self._get_original_timestamp(row),
            event_type=event_type,
            source=EventSource.ALERTS_CSV,
            source_file=source_file,
            severity=severity,
            title=title,
            description=description,
            raw_content=str(row),
            tags=self._extract_tags(row),
            metadata=self._extract_metadata(row),
        )
        
        return event
    
    def _extract_timestamp(self, row: Dict[str, Any], timezone: str) -> Optional[datetime]:
        """从行数据中提取时间戳"""
        tz = pytz.timezone(timezone)
        
        for field in self.COMMON_TIMESTAMP_FIELDS:
            if field in row and row[field]:
                value = str(row[field]).strip()
                if not value:
                    continue
                
                timestamp = self._parse_timestamp_string(value, tz)
                if timestamp:
                    return timestamp
        
        return None
    
    def _parse_timestamp_string(self, value: str, tz: pytz.BaseTzInfo) -> Optional[datetime]:
        """解析时间戳字符串"""
        formats = [
            '%Y-%m-%dT%H:%M:%S%z',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M:%S%z',
            '%Y/%m/%d %H:%M:%S',
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%d/%m/%Y %H:%M:%S',
            '%m/%d/%Y %H:%M:%S',
        ]
        
        for fmt in formats:
            try:
                dt = datetime.strptime(value, fmt)
                
                if dt.tzinfo is None:
                    dt = tz.localize(dt)
                
                return dt.astimezone(pytz.UTC)
            except (ValueError, TypeError):
                continue
        
        try:
            from dateutil import parser as dateutil_parser
            dt = dateutil_parser.parse(value)
            
            if dt.tzinfo is None:
                dt = tz.localize(dt)
            
            return dt.astimezone(pytz.UTC)
        except (ValueError, TypeError):
            pass
        
        return None
    
    def _get_original_timestamp(self, row: Dict[str, Any]) -> Optional[str]:
        """获取原始时间戳字符串"""
        for field in self.COMMON_TIMESTAMP_FIELDS:
            if field in row and row[field]:
                return str(row[field])
        return None
    
    def _determine_event_type(self, row: Dict[str, Any]) -> str:
        """确定事件类型"""
        for field in self.COMMON_STATUS_FIELDS:
            if field in row:
                value = str(row[field]).lower()
                if 'firing' in value or 'active' in value or 'trigger' in value or '告警' in value:
                    return EventType.ALERT_TRIGGER
                if 'resolved' in value or 'ok' in value or 'recovery' in value or '恢复' in value:
                    return EventType.ALERT_RECOVER
        
        for field in self.COMMON_TITLE_FIELDS:
            if field in row:
                value = str(row[field]).lower()
                if 'recovery' in value or '恢复' in value or 'resolved' in value:
                    return EventType.ALERT_RECOVER
        
        return EventType.ALERT_TRIGGER
    
    def _extract_severity(self, row: Dict[str, Any]) -> Optional[str]:
        """提取严重级别"""
        for field in self.COMMON_SEVERITY_FIELDS:
            if field in row and row[field]:
                value = str(row[field]).strip().lower()
                
                if value in ['critical', 'crit', '紧急', '严重', '1', 'high']:
                    return 'critical'
                elif value in ['warning', 'warn', '警告', '2', 'medium']:
                    return 'warning'
                elif value in ['info', '信息', '3', 'low', 'ok', 'normal']:
                    return 'info'
                else:
                    return value
        
        return None
    
    def _extract_title(self, row: Dict[str, Any]) -> str:
        """提取标题"""
        for field in self.COMMON_TITLE_FIELDS:
            if field in row and row[field]:
                return str(row[field]).strip()
        
        return "告警事件"
    
    def _extract_description(self, row: Dict[str, Any]) -> Optional[str]:
        """提取描述"""
        for field in self.COMMON_DESCRIPTION_FIELDS:
            if field in row and row[field]:
                return str(row[field]).strip()
        
        return None
    
    def _extract_tags(self, row: Dict[str, Any]) -> List[str]:
        """提取标签"""
        tags = []
        
        if 'labels' in row and row['labels']:
            try:
                import json
                labels = json.loads(row['labels'])
                if isinstance(labels, dict):
                    for key, value in labels.items():
                        tags.append(f"{key}:{value}")
            except (json.JSONDecodeError, TypeError):
                pass
        
        if 'tags' in row and row['tags']:
            tag_str = str(row['tags'])
            for separator in [',', ';', ' ']:
                if separator in tag_str:
                    tags.extend([t.strip() for t in tag_str.split(separator) if t.strip()])
                    break
            else:
                tags.append(tag_str.strip())
        
        return [t for t in tags if t]
    
    def _extract_metadata(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """提取元数据"""
        metadata = {}
        
        standard_fields = set(
            self.COMMON_TIMESTAMP_FIELDS + 
            self.COMMON_SEVERITY_FIELDS + 
            self.COMMON_TITLE_FIELDS + 
            self.COMMON_DESCRIPTION_FIELDS +
            self.COMMON_STATUS_FIELDS +
            ['labels', 'tags', 'annotations']
        )
        
        for key, value in row.items():
            if key not in standard_fields and value:
                metadata[key] = value
        
        return metadata
