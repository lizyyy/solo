"""CSV问题导出器"""
from pathlib import Path
from typing import List, Dict, Any
import csv
import logging

from ..models import ReviewResult, Issue, SeverityLevel, IssueType

logger = logging.getLogger(__name__)


class CSVExporter:
    """CSV格式问题导出器"""
    
    FIELD_NAMES = [
        'severity', 'issue_type', 'pool_id', 'pool_name',
        'start_time', 'end_time', 'description', 'details'
    ]
    
    @classmethod
    def export(cls, result: ReviewResult, output_path: Path) -> int:
        """导出问题到CSV文件"""
        logger.info(f"导出问题到CSV: {output_path}")
        
        if not result.all_issues:
            logger.warning("没有问题需要导出")
            cls._write_empty_file(output_path)
            return 0
        
        sorted_issues = cls._sort_issues(result.all_issues)
        
        try:
            with open(output_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=cls.FIELD_NAMES)
                writer.writeheader()
                
                for issue in sorted_issues:
                    row = cls._issue_to_row(issue)
                    writer.writerow(row)
            
            count = len(sorted_issues)
            logger.info(f"成功导出 {count} 个问题到 {output_path}")
            return count
        
        except Exception as e:
            logger.error(f"导出CSV失败: {str(e)}")
            raise
    
    @classmethod
    def _sort_issues(cls, issues: List[Issue]) -> List[Issue]:
        """按严重程度和时间排序问题"""
        severity_order = {
            SeverityLevel.CRITICAL: 0,
            SeverityLevel.WARNING: 1,
            SeverityLevel.INFO: 2
        }
        
        return sorted(
            issues,
            key=lambda x: (
                severity_order.get(x.severity, 99),
                x.start_time if x.start_time else x.pool_id
            )
        )
    
    @classmethod
    def _issue_to_row(cls, issue: Issue) -> Dict[str, Any]:
        """将问题转换为CSV行"""
        return {
            'severity': issue.severity.value,
            'issue_type': issue.issue_type.value,
            'pool_id': issue.pool_id,
            'pool_name': issue.pool_name,
            'start_time': issue.start_time.isoformat() if issue.start_time else '',
            'end_time': issue.end_time.isoformat() if issue.end_time else '',
            'description': issue.description,
            'details': cls._format_details(issue.details)
        }
    
    @classmethod
    def _format_details(cls, details: Dict[str, Any]) -> str:
        """格式化详情字典"""
        if not details:
            return ''
        
        parts = []
        for key, value in details.items():
            if isinstance(value, dict):
                continue
            if isinstance(value, list):
                value = ', '.join(str(v) for v in value)
            parts.append(f"{key}: {value}")
        
        return '; '.join(parts)
    
    @classmethod
    def _write_empty_file(cls, output_path: Path):
        """写入空文件（仅表头）"""
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=cls.FIELD_NAMES)
            writer.writeheader()
