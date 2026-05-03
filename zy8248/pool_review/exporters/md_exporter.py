"""Markdown报告导出器"""
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
import logging

from ..models import (
    ReviewResult, Issue, SeverityLevel, IssueType,
    PoolReviewResult
)

logger = logging.getLogger(__name__)


class MarkdownExporter:
    """Markdown格式报告导出器"""
    
    @classmethod
    def export(cls, result: ReviewResult, output_path: Path) -> bool:
        """导出复盘报告到Markdown文件"""
        logger.info(f"导出Markdown报告: {output_path}")
        
        try:
            md_content = cls._generate_report(result)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(md_content)
            
            logger.info(f"成功导出报告到 {output_path}")
            return True
        
        except Exception as e:
            logger.error(f"导出Markdown失败: {str(e)}")
            raise
    
    @classmethod
    def _generate_report(cls, result: ReviewResult) -> str:
        """生成完整的Markdown报告"""
        parts = []
        
        parts.append(cls._generate_header(result))
        parts.append(cls._generate_summary(result))
        parts.append(cls._generate_issues_by_severity(result))
        parts.append(cls._generate_pool_details(result))
        parts.append(cls._generate_footer())
        
        return '\n\n'.join(parts)
    
    @classmethod
    def _generate_header(cls, result: ReviewResult) -> str:
        """生成报告头部"""
        review_date = result.review_date.strftime('%Y年%m月%d日')
        
        return f"""# 泳池水质投药复盘报告

**复盘日期**: {review_date}  
**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
    
    @classmethod
    def _generate_summary(cls, result: ReviewResult) -> str:
        """生成概览部分"""
        total_pools = len(result.pools)
        total_issues = len(result.all_issues)
        
        by_severity = result.get_all_issues_by_severity()
        critical_count = len(by_severity[SeverityLevel.CRITICAL])
        warning_count = len(by_severity[SeverityLevel.WARNING])
        info_count = len(by_severity[SeverityLevel.INFO])
        
        by_type = result.count_issues_by_type()
        
        status_emoji = "🔴" if critical_count > 0 else "🟡" if warning_count > 0 else "🟢"
        status_text = "存在严重问题，需立即处理" if critical_count > 0 else \
                      "存在警告问题，建议检查" if warning_count > 0 else \
                      "运行正常"
        
        summary_lines = [
            "## 概览",
            "",
            f"**整体状态**: {status_emoji} {status_text}",
            "",
            "### 统计数据",
            "",
            "| 指标 | 数值 |",
            "|------|------|",
            f"| 复盘泳池数 | {total_pools} |",
            f"| 总问题数 | {total_issues} |",
            f"| 🔴 严重问题 | {critical_count} |",
            f"| 🟡 警告问题 | {warning_count} |",
            f"| ℹ️ 信息问题 | {info_count} |",
        ]
        
        if by_type:
            summary_lines.extend([
                "",
                "### 问题类型分布",
                "",
                "| 问题类型 | 数量 |",
                "|----------|------|",
            ])
            
            type_names = {
                'chlorine_decay': '余氯衰减异常',
                'ph_out_of_window': 'pH超窗',
                'orp_out_of_window': 'ORP超窗',
                'post_visitor_missing': '客流后补测缺失',
                'dosing_conflict': '投药冷却窗口冲突',
                'sensor_gap': '传感器断采',
                'cross_midnight_issue': '跨午夜问题'
            }
            
            for issue_type, count in sorted(by_type.items(), key=lambda x: -x[1]):
                name = type_names.get(issue_type, issue_type)
                summary_lines.append(f"| {name} | {count} |")
        
        return '\n'.join(summary_lines)
    
    @classmethod
    def _generate_issues_by_severity(cls, result: ReviewResult) -> str:
        """按严重级别生成问题列表"""
        parts = ["## 问题详情"]
        
        by_severity = result.get_all_issues_by_severity()
        
        severity_configs = [
            (SeverityLevel.CRITICAL, "🔴 严重问题", "需要立即处理的问题"),
            (SeverityLevel.WARNING, "🟡 警告问题", "需要关注的问题"),
            (SeverityLevel.INFO, "ℹ️ 信息提示", "一般性提示"),
        ]
        
        for severity, title, description in severity_configs:
            issues = by_severity[severity]
            if not issues:
                continue
            
            parts.append(f"\n### {title}")
            parts.append(f"\n*{description}*")
            
            for i, issue in enumerate(issues, 1):
                parts.append(cls._format_issue(issue, i))
        
        if not result.all_issues:
            parts.append("\n✅ 未发现任何问题，所有泳池运行正常！")
        
        return '\n'.join(parts)
    
    @classmethod
    def _format_issue(cls, issue: Issue, index: int) -> str:
        """格式化单个问题"""
        time_range = ""
        if issue.start_time and issue.end_time:
            start_str = issue.start_time.strftime('%H:%M')
            end_str = issue.end_time.strftime('%H:%M')
            time_range = f"  \n**时间**: {start_str} - {end_str}"
        elif issue.start_time:
            time_range = f"  \n**时间**: {issue.start_time.strftime('%H:%M')}"
        
        type_names = {
            'chlorine_decay': '余氯衰减',
            'ph_out_of_window': 'pH超窗',
            'orp_out_of_window': 'ORP超窗',
            'post_visitor_missing': '客流后补测',
            'dosing_conflict': '投药冲突',
            'sensor_gap': '传感器断采',
            'cross_midnight_issue': '跨午夜问题'
        }
        issue_type_name = type_names.get(issue.issue_type.value, issue.issue_type.value)
        
        return f"""
**{index}. [{issue_type_name}] {issue.pool_name} ({issue.pool_id})**

**描述**: {issue.description}{time_range}
"""
    
    @classmethod
    def _generate_pool_details(cls, result: ReviewResult) -> str:
        """生成各泳池详情"""
        parts = ["\n## 各泳池详情"]
        
        for pool_id, pool_result in sorted(result.pools.items()):
            critical_count = pool_result.count_critical()
            warning_count = pool_result.count_warnings()
            
            status_emoji = "🔴" if critical_count > 0 else "🟡" if warning_count > 0 else "🟢"
            
            parts.append(f"\n### {status_emoji} {pool_result.pool_name} ({pool_id})")
            
            summary = pool_result.summary
            parts.append(f"- **传感器读数**: {summary.get('sensor_readings_count', 0)} 条")
            parts.append(f"- **投药记录**: {summary.get('dosing_records_count', 0)} 条")
            parts.append(f"- **问题统计**: 🔴 {critical_count} 个, 🟡 {warning_count} 个")
            
            if pool_result.issues:
                parts.append("\n**问题列表**:")
                for i, issue in enumerate(pool_result.issues, 1):
                    severity_emoji = "🔴" if issue.severity == SeverityLevel.CRITICAL else \
                                     "🟡" if issue.severity == SeverityLevel.WARNING else "ℹ️"
                    time_str = issue.start_time.strftime('%H:%M') if issue.start_time else ""
                    parts.append(f"  {i}. {severity_emoji} [{issue.issue_type.value}] {time_str} - {issue.description[:80]}...")
        
        return '\n'.join(parts)
    
    @classmethod
    def _generate_footer(cls) -> str:
        """生成报告页脚"""
        return """
---

*此报告由 Pool Review 工具自动生成*  
*如遇问题，请联系系统管理员*
"""
