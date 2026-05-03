"""时间冲突检查规则"""
from typing import Any, Dict, List
from datetime import datetime
from .base_rule import BaseRule, Issue, Severity


class TimeConflictRule(BaseRule):
    """检查事件时间是否存在前后矛盾"""
    
    def __init__(self):
        super().__init__(
            name="时间冲突检查",
            description="检查事件时间是否存在前后矛盾",
            severity=Severity.HIGH
        )
    
    def check(self, data: List[Dict[str, Any]]) -> List[Issue]:
        """
        执行时间冲突检查
        
        检查逻辑：
        1. 收集所有有时间戳的事件
        2. 检查同一事件在不同来源中的时间是否一致
        3. 检查事件序列是否符合逻辑（如：证据日期不能晚于事件发生日期）
        """
        issues = []
        
        events_with_timestamp = self._collect_events_with_timestamp(data)
        
        issues.extend(self._check_duplicate_events_time_conflict(events_with_timestamp))
        
        issues.extend(self._check_logical_sequence(events_with_timestamp))
        
        return issues
    
    def _collect_events_with_timestamp(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        收集所有有时间戳的事件
        
        Args:
            data: 解析后的数据列表
            
        Returns:
            有时间戳的事件列表
        """
        events = []
        
        for item in data:
            timestamp = item.get('timestamp')
            if timestamp is not None and isinstance(timestamp, datetime):
                events.append({
                    'id': item.get('id', ''),
                    'type': item.get('type', ''),
                    'content': item.get('content', ''),
                    'timestamp': timestamp,
                    'metadata': item.get('metadata', {})
                })
        
        return events
    
    def _check_duplicate_events_time_conflict(
        self, 
        events: List[Dict[str, Any]]
    ) -> List[Issue]:
        """
        检查重复事件的时间冲突
        
        Args:
            events: 有时间戳的事件列表
            
        Returns:
            问题列表
        """
        issues = []
        
        event_groups = {}
        for event in events:
            content = event.get('content', '')
            if content:
                if content not in event_groups:
                    event_groups[content] = []
                event_groups[content].append(event)
        
        for content, group in event_groups.items():
            if len(group) > 1:
                timestamps = [e['timestamp'] for e in group]
                if len(set(timestamps)) > 1:
                    issues.append(self._create_issue(
                        description=f"同一事件存在不同的时间记录：{content[:50]}...",
                        location="多来源数据",
                        details={
                            "content": content,
                            "timestamps": [str(ts) for ts in timestamps],
                            "sources": [e.get('type', 'unknown') for e in group]
                        },
                        severity=Severity.MEDIUM
                    ))
        
        return issues
    
    def _check_logical_sequence(self, events: List[Dict[str, Any]]) -> List[Issue]:
        """
        检查事件序列的逻辑合理性
        
        检查逻辑：
        - 证据日期不能晚于相关事件的发生日期
        - 聊天记录中的事件顺序应该合理
        
        Args:
            events: 有时间戳的事件列表
            
        Returns:
            问题列表
        """
        issues = []
        
        sorted_events = sorted(events, key=lambda x: x['timestamp'])
        
        evidence_events = [e for e in sorted_events if e.get('type') == 'evidence']
        other_events = [e for e in sorted_events if e.get('type') != 'evidence']
        
        for evidence in evidence_events:
            ev_timestamp = evidence['timestamp']
            
            for other in other_events:
                other_timestamp = other['timestamp']
                
                if other_timestamp < ev_timestamp:
                    content_other = other.get('content', '')
                    content_evidence = evidence.get('content', '')
                    
                    if self._events_related(content_other, content_evidence):
                        issues.append(self._create_issue(
                            description=f"时间逻辑冲突：事件 '{content_other[:30]}...' "
                                       f"发生在证据 '{content_evidence[:30]}...' 之前，"
                                       f"但证据日期晚于事件发生日期",
                            location=f"证据 {evidence.get('id', 'unknown')}",
                            evidence_id=evidence.get('id'),
                            details={
                                "evidence_id": evidence.get('id'),
                                "evidence_timestamp": str(ev_timestamp),
                                "event_timestamp": str(other_timestamp),
                                "evidence_content": content_evidence,
                                "event_content": content_other
                            }
                        ))
        
        return issues
    
    def _events_related(self, content1: str, content2: str) -> bool:
        """
        简单检查两个事件是否相关
        
        基于关键词重叠判断
        
        Args:
            content1: 第一个事件内容
            content2: 第二个事件内容
            
        Returns:
            是否相关
        """
        keywords1 = set(content1.lower().split())
        keywords2 = set(content2.lower().split())
        
        common = keywords1 & keywords2
        return len(common) >= 2
