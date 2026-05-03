"""CSV导出器"""
import csv
import os
from typing import Any, Dict, List


class CSVExporter:
    """
    CSV格式导出器
    
    用于导出问题清单等数据
    """
    
    def __init__(self):
        self.default_headers = [
            '序号',
            '规则名称',
            '严重程度',
            '描述',
            '位置',
            '关联证据ID',
            '详情'
        ]
    
    def export_issues(
        self, 
        issues: List[Dict[str, Any]],
        severity_order: List[str] = None
    ) -> List[List[str]]:
        """
        导出问题清单为CSV行数据
        
        Args:
            issues: 问题列表
            severity_order: 严重程度排序顺序
            
        Returns:
            CSV行数据列表（第一行为表头）
        """
        if severity_order is None:
            severity_order = ['critical', 'high', 'medium', 'low', 'info']
        
        severity_priority = {s: i for i, s in enumerate(severity_order)}
        
        sorted_issues = sorted(
            issues,
            key=lambda x: severity_priority.get(x.get('severity', 'unknown'), 999)
        )
        
        rows = [self.default_headers.copy()]
        
        for i, issue in enumerate(sorted_issues, 1):
            row = [
                str(i),
                issue.get('rule_name', ''),
                self._format_severity(issue.get('severity', '')),
                issue.get('description', ''),
                issue.get('location', ''),
                issue.get('evidence_id', ''),
                self._format_details(issue.get('details', {}))
            ]
            rows.append(row)
        
        return rows
    
    def _format_severity(self, severity: str) -> str:
        """
        格式化严重程度显示
        
        Args:
            severity: 原始严重程度值
            
        Returns:
            格式化的严重程度
        """
        labels = {
            'critical': '严重',
            'high': '高',
            'medium': '中',
            'low': '低',
            'info': '信息'
        }
        return labels.get(severity, severity)
    
    def _format_details(self, details: Dict[str, Any]) -> str:
        """
        格式化详情字段
        
        Args:
            details: 详情字典
            
        Returns:
            格式化的字符串
        """
        if not details:
            return ''
        
        parts = []
        for key, value in details.items():
            if isinstance(value, (str, int, float, bool)):
                parts.append(f"{key}: {value}")
            elif isinstance(value, list) and len(value) <= 5:
                parts.append(f"{key}: {', '.join(str(v) for v in value)}")
        
        return '; '.join(parts)
    
    def export_to_file(
        self, 
        file_path: str, 
        issues: List[Dict[str, Any]],
        severity_order: List[str] = None
    ):
        """
        导出问题清单到CSV文件
        
        Args:
            file_path: 输出文件路径
            issues: 问题列表
            severity_order: 严重程度排序顺序
        """
        rows = self.export_issues(issues, severity_order)
        
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
    
    def export_timeline_to_csv(
        self, 
        timeline: Dict[str, List[Dict[str, Any]]],
        file_path: str
    ):
        """
        导出时间线到CSV文件
        
        Args:
            timeline: 按角色分组的时间线
            file_path: 输出文件路径
        """
        headers = ['角色', '时间', '内容', '类型', 'ID']
        rows = [headers]
        
        for role, events in timeline.items():
            sorted_events = sorted(
                events,
                key=lambda x: x.get('timestamp') if x.get('timestamp') else ''
            )
            
            for event in sorted_events:
                timestamp = event.get('timestamp', '')
                if timestamp:
                    if hasattr(timestamp, 'strftime'):
                        time_str = timestamp.strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        time_str = str(timestamp)
                else:
                    time_str = '未知时间'
                
                row = [
                    role,
                    time_str,
                    event.get('content', ''),
                    event.get('type', ''),
                    event.get('id', '')
                ]
                rows.append(row)
        
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
