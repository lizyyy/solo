"""脱敏与隔离区模块"""

import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from .config import Event, EventType, ProjectConfig


class Sanitizer:
    """敏感数据脱敏器
    
    负责：
    1. 应用敏感字段脱敏规则
    2. 检测无法脱敏的敏感数据
    3. 将问题事件标记为隔离状态
    """
    
    def __init__(self, config: ProjectConfig):
        self.config = config
        self.rules = config.sensitivity_rules
    
    def sanitize(self, event: Event) -> Event:
        """对事件进行脱敏处理
        
        Args:
            event: 原始事件
            
        Returns:
            脱敏后的事件（可能被标记为隔离状态）
        """
        if event.is_quarantined:
            return event
        
        quarantine_reasons: List[str] = []
        
        try:
            if event.title:
                sanitized_title, title_issues = self._sanitize_text(event.title, 'title')
                event.title = sanitized_title
                quarantine_reasons.extend(title_issues)
            
            if event.description:
                sanitized_desc, desc_issues = self._sanitize_text(event.description, 'description')
                event.description = sanitized_desc
                quarantine_reasons.extend(desc_issues)
            
            if event.raw_content:
                sanitized_raw, raw_issues = self._sanitize_text(event.raw_content, 'raw_content')
                event.raw_content = sanitized_raw
                quarantine_reasons.extend(raw_issues)
            
            if event.metadata:
                sanitized_meta, meta_issues = self._sanitize_metadata(event.metadata)
                event.metadata = sanitized_meta
                quarantine_reasons.extend(meta_issues)
            
            if event.tags:
                sanitized_tags, tag_issues = self._sanitize_tags(event.tags)
                event.tags = sanitized_tags
                quarantine_reasons.extend(tag_issues)
        
        except Exception as e:
            quarantine_reasons.append(f"脱敏过程中发生异常: {str(e)}")
        
        if quarantine_reasons:
            event.is_quarantined = True
            event.quarantine_reason = '; '.join(quarantine_reasons)
        
        return event
    
    def _sanitize_text(self, text: str, field_name: str) -> tuple:
        """脱敏文本内容
        
        Returns:
            (脱敏后的文本, 问题列表)
        """
        if not text:
            return text, []
        
        issues: List[str] = []
        sanitized = text
        
        for rule in self.rules:
            if rule.field_names and field_name not in rule.field_names:
                continue
            
            try:
                matches = re.findall(rule.pattern, sanitized, flags=re.IGNORECASE)
                if matches:
                    sanitized = re.sub(
                        rule.pattern,
                        rule.replacement,
                        sanitized,
                        flags=re.IGNORECASE
                    )
            except re.error as e:
                issues.append(
                    f"规则 '{rule.name}' 的正则表达式无效: {str(e)}"
                )
            except Exception as e:
                issues.append(
                    f"应用规则 '{rule.name}' 到字段 '{field_name}' 时出错: {str(e)}"
                )
        
        remaining_sensitive = self._detect_remaining_sensitive(sanitized)
        if remaining_sensitive:
            issues.append(
                f"字段 '{field_name}' 中仍存在疑似敏感数据，无法完全脱敏: "
                f"{', '.join(remaining_sensitive[:3])}"
            )
        
        return sanitized, issues
    
    def _sanitize_metadata(self, metadata: Dict[str, Any]) -> tuple:
        """脱敏元数据
        
        Returns:
            (脱敏后的元数据, 问题列表)
        """
        if not metadata:
            return metadata, []
        
        issues: List[str] = []
        sanitized = {}
        
        for key, value in metadata.items():
            if isinstance(value, str):
                sanitized_value, value_issues = self._sanitize_text(value, f'metadata.{key}')
                sanitized[key] = sanitized_value
                issues.extend(value_issues)
            elif isinstance(value, dict):
                sanitized[key, nested_issues] = self._sanitize_metadata(value)
                issues.extend([f"metadata.{key}: {i}" for i in nested_issues])
            elif isinstance(value, list):
                sanitized_list = []
                for i, item in enumerate(value):
                    if isinstance(item, str):
                        sanitized_item, item_issues = self._sanitize_text(
                            item, f'metadata.{key}[{i}]'
                        )
                        sanitized_list.append(sanitized_item)
                        issues.extend(item_issues)
                    else:
                        sanitized_list.append(item)
                sanitized[key] = sanitized_list
            else:
                sanitized[key] = value
        
        return sanitized, issues
    
    def _sanitize_tags(self, tags: List[str]) -> tuple:
        """脱敏标签列表
        
        Returns:
            (脱敏后的标签列表, 问题列表)
        """
        if not tags:
            return tags, []
        
        issues: List[str] = []
        sanitized = []
        
        for i, tag in enumerate(tags):
            sanitized_tag, tag_issues = self._sanitize_text(tag, f'tags[{i}]')
            sanitized.append(sanitized_tag)
            issues.extend(tag_issues)
        
        return sanitized, issues
    
    def _detect_remaining_sensitive(self, text: str) -> List[str]:
        """检测文本中是否仍存在疑似敏感数据
        
        使用启发式规则检测可能遗漏的敏感数据。
        """
        if not text:
            return []
        
        findings = []
        
        patterns = [
            (r'(?i)(?:api[_-]?key|secret|token|password|pwd|passwd)["\s:=]+\s*[\w-]{8,}', 
             '疑似密钥/令牌'),
            (r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', 
             '疑似邮箱地址'),
            (r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b', 
             '疑似IP地址'),
            (r'\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b', 
             '疑似银行卡号'),
            (r'\b\d{3}[- ]?\d{4}[- ]?\d{4}\b', 
             '疑似手机号'),
        ]
        
        for pattern, description in patterns:
            matches = re.findall(pattern, text)
            if matches:
                findings.append(f"{description} (找到 {len(matches)} 处)")
        
        return findings


class QuarantineManager:
    """隔离区管理器
    
    负责管理被隔离的事件：
    1. 记录隔离原因
    2. 支持查询和导出隔离事件
    3. 支持人工审核后恢复
    """
    
    QUARANTINE_REASONS = {
        'timestamp_missing': '时间戳缺失',
        'timestamp_invalid': '时间戳格式无效',
        'log_format_mismatch': '日志格式不匹配',
        'source_conflict': '同一事件来源冲突',
        'sensitive_data_remaining': '敏感字段命中但无法脱敏',
        'parsing_error': '解析错误',
        'unknown_error': '未知错误',
    }
    
    def __init__(self):
        self.quarantined_events: Dict[str, Event] = {}
    
    def quarantine(self, event: Event, reason_code: str, details: str = '') -> Event:
        """将事件标记为隔离状态
        
        Args:
            event: 要隔离的事件
            reason_code: 原因代码（对应 QUARANTINE_REASONS）
            details: 详细描述
            
        Returns:
            标记后的事件
        """
        reason_text = self.QUARANTINE_REASONS.get(reason_code, reason_code)
        
        if details:
            full_reason = f"{reason_text}: {details}"
        else:
            full_reason = reason_text
        
        event.is_quarantined = True
        event.quarantine_reason = full_reason
        
        self.quarantined_events[event.id] = event
        
        return event
    
    def release(self, event_id: str) -> Optional[Event]:
        """从隔离区释放事件
        
        Args:
            event_id: 事件ID
            
        Returns:
            释放后的事件，如果不存在则返回 None
        """
        if event_id in self.quarantined_events:
            event = self.quarantined_events.pop(event_id)
            event.is_quarantined = False
            event.quarantine_reason = None
            return event
        return None
    
    def get_quarantined(self, reason_code: Optional[str] = None) -> List[Event]:
        """获取隔离的事件
        
        Args:
            reason_code: 可选的原因代码筛选
            
        Returns:
            隔离事件列表
        """
        events = list(self.quarantined_events.values())
        
        if reason_code:
            events = [
                e for e in events 
                if e.quarantine_reason and reason_code in e.quarantine_reason
            ]
        
        return events
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取隔离区统计信息
        
        Returns:
            统计信息字典
        """
        stats = {
            'total_quarantined': len(self.quarantined_events),
            'by_reason': {},
        }
        
        for event in self.quarantined_events.values():
            reason = event.quarantine_reason or 'unknown'
            reason_prefix = reason.split(':')[0] if ':' in reason else reason
            
            if reason_prefix not in stats['by_reason']:
                stats['by_reason'][reason_prefix] = 0
            stats['by_reason'][reason_prefix] += 1
        
        return stats
    
    def to_dict(self) -> Dict[str, Any]:
        """导出隔离区数据为字典"""
        return {
            'quarantined_events': [
                event.to_dict() for event in self.quarantined_events.values()
            ],
            'statistics': self.get_statistics(),
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'QuarantineManager':
        """从字典加载隔离区数据"""
        manager = cls()
        
        for event_data in data.get('quarantined_events', []):
            event = Event.from_dict(event_data)
            manager.quarantined_events[event.id] = event
        
        return manager
