"""
导出器 - 负责导出报告和问题列表
"""

import csv
from datetime import date, datetime, time
from pathlib import Path
from typing import Dict, List, Optional, Any

from cinema_review.models import (
    Screening,
    Issue,
    IssueType,
    ScreeningTimeline
)


class Exporter:
    """导出器类"""
    
    def __init__(
        self,
        output_dir: Path,
        review_date: date
    ):
        """
        初始化导出器
        
        Args:
            output_dir: 输出目录
            review_date: 审核日期
        """
        self.output_dir = output_dir
        self.review_date = review_date
        
        # 确保输出目录存在
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def export_projection_review(
        self,
        screenings: List[Screening],
        issues: List[Issue],
        timelines: Dict[str, ScreeningTimeline],
        hall_names: Dict[str, str],
        include_resolved: bool = True
    ) -> Path:
        """
        导出排片审核报告 (projection_review.md)
        
        Args:
            screenings: 排片列表
            issues: 问题列表
            timelines: 时间线映射
            hall_names: 影厅ID到名称的映射
            include_resolved: 是否包含已解决的问题
            
        Returns:
            导出文件路径
        """
        filename = f"projection_review_{self.review_date.isoformat()}.md"
        filepath = self.output_dir / filename
        
        # 过滤问题
        if not include_resolved:
            issues = [i for i in issues if i.status not in ("resolved", "dismissed")]
        
        # 按影厅分组排片
        from collections import defaultdict
        screenings_by_hall: Dict[str, List[Screening]] = defaultdict(list)
        for s in screenings:
            screenings_by_hall[s.hall_id].append(s)
        
        # 按影厅和严重程度分组问题
        issues_by_hall: Dict[str, List[Issue]] = defaultdict(list)
        issues_by_type: Dict[str, List[Issue]] = defaultdict(list)
        
        for issue in issues:
            issues_by_hall[issue.hall_id].append(issue)
            issues_by_type[issue.issue_type.value].append(issue)
        
        # 统计
        total_issues = len(issues)
        high_issues = len([i for i in issues if i.severity == "high"])
        medium_issues = len([i for i in issues if i.severity == "medium"])
        low_issues = len([i for i in issues if i.severity == "low"])
        
        # 生成Markdown内容
        content = self._generate_markdown(
            screenings_by_hall=screenings_by_hall,
            issues_by_hall=issues_by_hall,
            issues_by_type=issues_by_type,
            timelines=timelines,
            hall_names=hall_names,
            total_issues=total_issues,
            high_issues=high_issues,
            medium_issues=medium_issues,
            low_issues=low_issues,
            screenings=screenings
        )
        
        # 写入文件
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        
        return filepath
    
    def export_issues_csv(
        self,
        issues: List[Issue],
        include_resolved: bool = True
    ) -> Path:
        """
        导出问题列表 (issues.csv)
        
        Args:
            issues: 问题列表
            include_resolved: 是否包含已解决的问题
            
        Returns:
            导出文件路径
        """
        filename = f"issues_{self.review_date.isoformat()}.csv"
        filepath = self.output_dir / filename
        
        # 过滤问题
        if not include_resolved:
            issues = [i for i in issues if i.status not in ("resolved", "dismissed")]
        
        # 写入CSV
        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                "问题ID", "问题类型", "影厅ID", "影厅名称", "影片名称",
                "严重程度", "状态", "描述", "备注", "创建时间", "解决时间"
            ])
            
            # 写入数据行
            for issue in issues:
                writer.writerow([
                    issue.id,
                    issue.issue_type.value,
                    issue.hall_id,
                    issue.hall_name,
                    issue.film_name,
                    self._get_severity_text(issue.severity),
                    self._get_status_text(issue.status),
                    issue.description,
                    issue.notes,
                    issue.created_at.strftime("%Y-%m-%d %H:%M:%S") if issue.created_at else "",
                    issue.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if issue.resolved_at else ""
                ])
        
        return filepath
    
    def _generate_markdown(
        self,
        screenings_by_hall: Dict[str, List[Screening]],
        issues_by_hall: Dict[str, List[Issue]],
        issues_by_type: Dict[str, List[Issue]],
        timelines: Dict[str, ScreeningTimeline],
        hall_names: Dict[str, str],
        total_issues: int,
        high_issues: int,
        medium_issues: int,
        low_issues: int,
        screenings: List[Screening]
    ) -> str:
        """
        生成Markdown报告内容
        
        Args:
            各种数据参数
            
        Returns:
            Markdown字符串
        """
        lines = []
        
        # 标题
        lines.append("# 影院排片审核报告")
        lines.append("")
        lines.append(f"**审核日期**: {self.review_date.isoformat()}")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 摘要
        lines.append("## 摘要")
        lines.append("")
        lines.append(f"- **总排片数**: {len(screenings)} 场")
        lines.append(f"- **涉及影厅**: {len(screenings_by_hall)} 个")
        lines.append(f"- **检测到问题**: {total_issues} 个")
        lines.append(f"  - 🔴 严重: {high_issues} 个")
        lines.append(f"  - 🟡 中等: {medium_issues} 个")
        lines.append(f"  - 🟢 轻微: {low_issues} 个")
        lines.append("")
        
        # 按问题类型统计
        if issues_by_type:
            lines.append("### 问题类型分布")
            lines.append("")
            lines.append("| 问题类型 | 数量 |")
            lines.append("|----------|------|")
            for issue_type, type_issues in issues_by_type.items():
                lines.append(f"| {issue_type} | {len(type_issues)} |")
            lines.append("")
        
        # 详细问题列表
        lines.append("## 问题详情")
        lines.append("")
        
        if total_issues == 0:
            lines.append("✅ 未检测到任何问题！")
            lines.append("")
        else:
            # 按严重程度分组显示
            for severity in ["high", "medium", "low"]:
                severity_issues = [i for i in issues_by_hall.values() for i in i if i.severity == severity]
                
                if not severity_issues:
                    continue
                
                severity_text = self._get_severity_text(severity)
                severity_icon = "🔴" if severity == "high" else ("🟡" if severity == "medium" else "🟢")
                
                lines.append(f"### {severity_icon} {severity_text}问题 ({len(severity_issues)}个)")
                lines.append("")
                
                for issue in severity_issues:
                    status_icon = "✅" if issue.status == "resolved" else ("⚪" if issue.status == "dismissed" else "🔍")
                    lines.append(f"#### {status_icon} {issue.issue_type.value}")
                    lines.append("")
                    lines.append(f"- **影厅**: {issue.hall_name} ({issue.hall_id})")
                    lines.append(f"- **影片**: {issue.film_name}")
                    lines.append(f"- **状态**: {self._get_status_text(issue.status)}")
                    lines.append(f"- **描述**: {issue.description}")
                    if issue.notes:
                        lines.append(f"- **备注**: {issue.notes}")
                    lines.append("")
        
        # 各影厅排片概览
        lines.append("## 各影厅排片概览")
        lines.append("")
        
        for hall_id, hall_screenings in sorted(screenings_by_hall.items()):
            hall_name = hall_names.get(hall_id, hall_id)
            hall_issues = issues_by_hall.get(hall_id, [])
            
            # 按时间排序
            hall_screenings.sort(key=lambda s: s.start_time)
            
            lines.append(f"### {hall_name}")
            lines.append("")
            lines.append(f"- **排片数**: {len(hall_screenings)} 场")
            if hall_issues:
                lines.append(f"- **问题数**: {len(hall_issues)} 个")
            lines.append("")
            
            # 排片时间表
            lines.append("| 开始时间 | 结束时间 | 影片 | 时长 | 状态 |")
            lines.append("|----------|----------|------|------|------|")
            
            for scr in hall_screenings:
                # 检查是否有问题
                has_issue = any(
                    i.screening_id == scr.id or scr.id in (i.related_screening_ids or [])
                    for i in hall_issues
                )
                
                status_icon = "⚠️" if has_issue else "✅"
                
                lines.append(
                    f"| {scr.start_time.strftime('%H:%M')} | "
                    f"{scr.end_time.strftime('%H:%M')} | "
                    f"{scr.film_name} | "
                    f"{scr.duration_minutes}分钟 | "
                    f"{status_icon} |"
                )
            
            lines.append("")
        
        # 页脚
        lines.append("---")
        lines.append("")
        lines.append("*此报告由影院排片核对工具自动生成*")
        
        return "\n".join(lines)
    
    @staticmethod
    def _get_severity_text(severity: str) -> str:
        """获取严重程度的中文显示"""
        mapping = {
            "high": "严重",
            "medium": "中等",
            "low": "轻微"
        }
        return mapping.get(severity, severity)
    
    @staticmethod
    def _get_status_text(status: str) -> str:
        """获取状态的中文显示"""
        mapping = {
            "new": "新问题",
            "resolved": "已解决",
            "dismissed": "已忽略"
        }
        return mapping.get(status, status)
