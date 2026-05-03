"""Markdown导出器"""
from typing import Any, Dict, List
from datetime import datetime


class MDExporter:
    """
    Markdown格式导出器
    
    用于导出庭审证据时间线核对的摘要报告
    """
    
    def __init__(self):
        self.severity_labels = {
            'critical': '🔴 严重',
            'high': '🟠 高',
            'medium': '🟡 中',
            'low': '🟢 低',
            'info': 'ℹ️ 信息'
        }
    
    def export_summary(
        self, 
        statistics: Dict[str, Any], 
        issues: List[Dict[str, Any]], 
        timeline: Dict[str, List[Dict[str, Any]]],
        title: str = "庭审证据时间线核对报告"
    ) -> str:
        """
        导出Markdown格式的摘要报告
        
        Args:
            statistics: 统计信息
            issues: 问题列表
            timeline: 按角色分组的时间线
            title: 报告标题
            
        Returns:
            Markdown格式的报告内容
        """
        lines = []
        
        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"> 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 📊 统计概览")
        lines.append("")
        lines.append("### 数据导入情况")
        lines.append("")
        data_stats = statistics.get('data', {})
        for data_type, count in data_stats.items():
            type_labels = {
                'evidence': '证据目录',
                'chat': '聊天记录',
                'memo': '关键日期备忘',
                'transcript': '庭审笔录'
            }
            label = type_labels.get(data_type, data_type)
            lines.append(f"- **{label}**: {count} 条")
        lines.append("")
        
        lines.append("### 问题统计")
        lines.append("")
        issue_stats = statistics.get('issues', {})
        lines.append(f"- **总问题数**: {issue_stats.get('total', 0)}")
        lines.append("")
        lines.append("按严重程度分类：")
        lines.append("")
        severity_stats = issue_stats.get('by_severity', {})
        for severity, count in severity_stats.items():
            label = self.severity_labels.get(severity, severity)
            lines.append(f"- {label}: {count} 个")
        lines.append("")
        
        lines.append("### 时间线统计")
        lines.append("")
        timeline_stats = statistics.get('timeline', {})
        lines.append(f"- **总事件数**: {timeline_stats.get('total_events', 0)}")
        lines.append("")
        role_stats = timeline_stats.get('by_role', {})
        if role_stats:
            lines.append("按角色分组：")
            lines.append("")
            for role, count in role_stats.items():
                lines.append(f"- **{role}**: {count} 个事件")
        lines.append("")
        
        if issues:
            lines.append("## ⚠️ 问题清单")
            lines.append("")
            
            issues_by_severity = self._group_issues_by_severity(issues)
            for severity in ['critical', 'high', 'medium', 'low', 'info']:
                if severity in issues_by_severity:
                    severity_issues = issues_by_severity[severity]
                    label = self.severity_labels.get(severity, severity)
                    lines.append(f"### {label}问题 ({len(severity_issues)}个)")
                    lines.append("")
                    
                    for i, issue in enumerate(severity_issues, 1):
                        lines.append(f"#### {i}. {issue.get('description', '未知问题')}")
                        lines.append("")
                        lines.append(f"- **位置**: {issue.get('location', '未知')}")
                        if issue.get('evidence_id'):
                            lines.append(f"- **关联证据**: {issue.get('evidence_id')}")
                        
                        details = issue.get('details', {})
                        if details:
                            lines.append(f"- **详情**:")
                            for key, value in details.items():
                                if isinstance(value, (str, int, float, bool)):
                                    lines.append(f"  - {key}: {value}")
                        
                        lines.append("")
        
        if timeline:
            lines.append("## 📅 事件时间线")
            lines.append("")
            
            for role, events in timeline.items():
                lines.append(f"### 👤 {role}")
                lines.append("")
                
                sorted_events = sorted(
                    events, 
                    key=lambda x: x.get('timestamp', datetime.min) if x.get('timestamp') else datetime.min
                )
                
                for event in sorted_events:
                    timestamp = event.get('timestamp')
                    if timestamp:
                        if isinstance(timestamp, str):
                            time_str = timestamp
                        else:
                            time_str = timestamp.strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        time_str = "未知时间"
                    
                    content = event.get('content', '无内容')
                    lines.append(f"- **[{time_str}]** {content[:100]}{'...' if len(content) > 100 else ''}")
                
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由庭审证据时间线核对器自动生成*")
        
        return "\n".join(lines)
    
    def _group_issues_by_severity(
        self, 
        issues: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        按严重程度分组问题
        
        Args:
            issues: 问题列表
            
        Returns:
            按严重程度分组的问题
        """
        grouped = {}
        for issue in issues:
            severity = issue.get('severity', 'unknown')
            if severity not in grouped:
                grouped[severity] = []
            grouped[severity].append(issue)
        return grouped
    
    def export_to_file(
        self, 
        file_path: str, 
        statistics: Dict[str, Any], 
        issues: List[Dict[str, Any]], 
        timeline: Dict[str, List[Dict[str, Any]]],
        title: str = "庭审证据时间线核对报告"
    ):
        """
        导出Markdown报告到文件
        
        Args:
            file_path: 输出文件路径
            statistics: 统计信息
            issues: 问题列表
            timeline: 按角色分组的时间线
            title: 报告标题
        """
        content = self.export_summary(statistics, issues, timeline, title)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
