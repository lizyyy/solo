"""数据存储模块"""
import json
import os
from typing import Any, Dict, List, Optional
from datetime import datetime
from collections import defaultdict


class DataStore:
    """
    数据存储器
    
    用于存储和管理庭审证据相关的数据：
    - 解析后的原始数据
    - 检查出的问题
    - 时间线数据
    - 审计信息
    """
    
    def __init__(self, storage_path: Optional[str] = None):
        """
        初始化数据存储器
        
        Args:
            storage_path: 存储路径，如果为None则使用内存存储
        """
        self.storage_path = storage_path
        self._data: Dict[str, List[Dict[str, Any]]] = {
            'evidence': [],
            'chat': [],
            'memo': [],
            'transcript': []
        }
        self._issues: List[Dict[str, Any]] = []
        self._timeline: List[Dict[str, Any]] = []
        self._audit_trail: List[Dict[str, Any]] = []
        self._metadata: Dict[str, Any] = {
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
            'version': '0.1.0'
        }
        
        if storage_path and os.path.exists(storage_path):
            self._load_from_file()
    
    def add_data(self, data_type: str, items: List[Dict[str, Any]]):
        """
        添加数据
        
        Args:
            data_type: 数据类型（evidence, chat, memo, transcript）
            items: 数据项列表
        """
        if data_type not in self._data:
            raise ValueError(f"不支持的数据类型: {data_type}")
        
        self._data[data_type].extend(items)
        self._update_metadata()
        self._add_audit_trail('add_data', {
            'data_type': data_type,
            'count': len(items)
        })
    
    def get_data(self, data_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        获取数据
        
        Args:
            data_type: 数据类型，如果为None则返回所有数据
            
        Returns:
            数据列表
        """
        if data_type:
            if data_type not in self._data:
                raise ValueError(f"不支持的数据类型: {data_type}")
            return self._data[data_type].copy()
        
        all_data = []
        for items in self._data.values():
            all_data.extend(items)
        return all_data
    
    def get_all_data(self) -> List[Dict[str, Any]]:
        """
        获取所有数据
        
        Returns:
            所有数据的列表
        """
        return self.get_data()
    
    def add_issues(self, issues: List[Dict[str, Any]]):
        """
        添加检查出的问题
        
        Args:
            issues: 问题列表
        """
        self._issues.extend(issues)
        self._update_metadata()
        self._add_audit_trail('add_issues', {
            'count': len(issues)
        })
    
    def get_issues(self, severity: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        获取问题列表
        
        Args:
            severity: 过滤严重程度，如果为None则返回所有问题
            
        Returns:
            问题列表
        """
        if severity:
            return [
                issue for issue in self._issues
                if issue.get('severity') == severity
            ]
        return self._issues.copy()
    
    def set_timeline(self, timeline: List[Dict[str, Any]]):
        """
        设置时间线数据
        
        Args:
            timeline: 时间线数据列表
        """
        self._timeline = timeline.copy()
        self._update_metadata()
        self._add_audit_trail('set_timeline', {
            'event_count': len(timeline)
        })
    
    def get_timeline(self) -> List[Dict[str, Any]]:
        """
        获取时间线数据
        
        Returns:
            时间线数据列表
        """
        return self._timeline.copy()
    
    def get_timeline_by_role(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        按角色分组获取时间线
        
        Returns:
            按角色分组的时间线数据
        """
        grouped = defaultdict(list)
        for event in self._timeline:
            role = event.get('metadata', {}).get('role', '未知')
            grouped[role].append(event)
        return dict(grouped)
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取统计信息
        
        Returns:
            统计信息字典
        """
        return {
            'data': {
                data_type: len(items)
                for data_type, items in self._data.items()
            },
            'issues': {
                'total': len(self._issues),
                'by_severity': self._count_issues_by_severity()
            },
            'timeline': {
                'total_events': len(self._timeline),
                'by_role': {
                    role: len(events)
                    for role, events in self.get_timeline_by_role().items()
                }
            },
            'metadata': self._metadata.copy()
        }
    
    def _count_issues_by_severity(self) -> Dict[str, int]:
        """
        按严重程度统计问题数量
        
        Returns:
            严重程度到数量的映射
        """
        counts = defaultdict(int)
        for issue in self._issues:
            severity = issue.get('severity', 'unknown')
            counts[severity] += 1
        return dict(counts)
    
    def _update_metadata(self):
        """更新元数据"""
        self._metadata['updated_at'] = datetime.now().isoformat()
    
    def _add_audit_trail(self, action: str, details: Dict[str, Any]):
        """
        添加审计追踪记录
        
        Args:
            action: 操作名称
            details: 操作详情
        """
        self._audit_trail.append({
            'timestamp': datetime.now().isoformat(),
            'action': action,
            'details': details
        })
    
    def save(self, path: Optional[str] = None):
        """
        保存数据到文件
        
        Args:
            path: 保存路径，如果为None则使用初始化时的路径
        """
        save_path = path or self.storage_path
        if not save_path:
            raise ValueError("未指定保存路径")
        
        data_to_save = {
            'data': self._data,
            'issues': self._issues,
            'timeline': self._timeline,
            'audit_trail': self._audit_trail,
            'metadata': self._metadata
        }
        
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        
        with open(save_path, 'w', encoding='utf-8') as f:
            json.dump(data_to_save, f, ensure_ascii=False, indent=2, default=str)
    
    def _load_from_file(self):
        """从文件加载数据"""
        with open(self.storage_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self._data = data.get('data', self._data)
        self._issues = data.get('issues', [])
        self._timeline = data.get('timeline', [])
        self._audit_trail = data.get('audit_trail', [])
        self._metadata = data.get('metadata', self._metadata)
    
    def clear(self):
        """清空所有数据"""
        self._data = {
            'evidence': [],
            'chat': [],
            'memo': [],
            'transcript': []
        }
        self._issues = []
        self._timeline = []
        self._audit_trail = []
        self._update_metadata()
        self._add_audit_trail('clear', {})
    
    def export_audit_package(self) -> Dict[str, Any]:
        """
        导出审计包
        
        Returns:
            包含所有审计信息的字典
        """
        return {
            'export_time': datetime.now().isoformat(),
            'version': self._metadata.get('version'),
            'statistics': self.get_statistics(),
            'data': self._data,
            'issues': self._issues,
            'timeline': self._timeline,
            'audit_trail': self._audit_trail
        }
