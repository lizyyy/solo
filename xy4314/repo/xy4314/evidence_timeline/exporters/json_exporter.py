"""JSON导出器"""
import json
import os
from typing import Any, Dict, List
from datetime import datetime


class JSONExporter:
    """
    JSON格式导出器
    
    用于导出审计包等完整数据
    """
    
    def __init__(self):
        pass
    
    def _json_default(self, obj: Any) -> Any:
        """
        处理JSON序列化时的特殊类型
        
        Args:
            obj: 待序列化的对象
            
        Returns:
            可序列化的表示
        """
        if isinstance(obj, datetime):
            return obj.isoformat()
        if hasattr(obj, '__dict__'):
            return obj.__dict__
        return str(obj)
    
    def export_audit_package(
        self,
        statistics: Dict[str, Any],
        issues: List[Dict[str, Any]],
        timeline: List[Dict[str, Any]],
        data: Dict[str, List[Dict[str, Any]]],
        audit_trail: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        导出审计包
        
        Args:
            statistics: 统计信息
            issues: 问题列表
            timeline: 时间线数据
            data: 原始数据
            audit_trail: 审计追踪记录
            
        Returns:
            审计包字典
        """
        return {
            'version': '0.1.0',
            'export_time': datetime.now().isoformat(),
            'statistics': statistics,
            'issues': issues,
            'timeline': timeline,
            'data': data,
            'audit_trail': audit_trail or []
        }
    
    def export_summary(
        self,
        statistics: Dict[str, Any],
        issues: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        导出摘要信息
        
        Args:
            statistics: 统计信息
            issues: 问题列表
            
        Returns:
            摘要字典
        """
        return {
            'version': '0.1.0',
            'export_time': datetime.now().isoformat(),
            'summary': {
                'total_issues': len(issues),
                'by_severity': self._count_by_severity(issues),
                'by_rule': self._count_by_rule(issues)
            },
            'statistics': statistics,
            'issues': issues
        }
    
    def _count_by_severity(self, issues: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        按严重程度统计
        
        Args:
            issues: 问题列表
            
        Returns:
            严重程度到数量的映射
        """
        counts = {}
        for issue in issues:
            severity = issue.get('severity', 'unknown')
            counts[severity] = counts.get(severity, 0) + 1
        return counts
    
    def _count_by_rule(self, issues: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        按规则统计
        
        Args:
            issues: 问题列表
            
        Returns:
            规则到数量的映射
        """
        counts = {}
        for issue in issues:
            rule_name = issue.get('rule_name', 'unknown')
            counts[rule_name] = counts.get(rule_name, 0) + 1
        return counts
    
    def export_to_file(
        self,
        file_path: str,
        data: Dict[str, Any],
        indent: int = 2
    ):
        """
        导出数据到JSON文件
        
        Args:
            file_path: 输出文件路径
            data: 要导出的数据
            indent: 缩进空格数
        """
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(
                data, 
                f, 
                ensure_ascii=False, 
                indent=indent,
                default=self._json_default
            )
    
    def export_audit_package_to_file(
        self,
        file_path: str,
        statistics: Dict[str, Any],
        issues: List[Dict[str, Any]],
        timeline: List[Dict[str, Any]],
        data: Dict[str, List[Dict[str, Any]]],
        audit_trail: List[Dict[str, Any]] = None
    ):
        """
        导出审计包到文件
        
        Args:
            file_path: 输出文件路径
            statistics: 统计信息
            issues: 问题列表
            timeline: 时间线数据
            data: 原始数据
            audit_trail: 审计追踪记录
        """
        audit_package = self.export_audit_package(
            statistics, issues, timeline, data, audit_trail
        )
        self.export_to_file(file_path, audit_package)
