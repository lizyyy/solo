"""
报告生成模块 - 负责生成按人和按日期视图的 Markdown 报告
"""

from datetime import date, timedelta
from typing import List, Dict, Optional, Any
from collections import defaultdict
import os
import logging

from .normalizer import NormalizedTodoItem, DateNormalizer
from .validator import ValidationResult

logger = logging.getLogger(__name__)


class ReportGenerator:
    """报告生成器"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.report_config = config.get("report", {})
        self.date_config = config.get("date", {})
        
        # 按人视图配置
        self.by_person_config = self.report_config.get("by_person", {
            "enabled": True,
            "title": "按负责人分组",
            "sort_by": "deadline_asc"
        })
        
        # 按日期视图配置
        self.by_date_config = self.report_config.get("by_date", {
            "enabled": True,
            "title": "按截止日期分组",
            "sort_by": "deadline_asc"
        })
        
        # 元数据配置
        self.metadata_config = self.report_config.get("metadata", {
            "show_source_file": True,
            "show_blocking": True,
            "show_raw_content": False
        })
        
        # 日期格式化器
        self.date_normalizer = DateNormalizer(config)
    
    def generate(
        self, 
        items: List[NormalizedTodoItem], 
        validation_result: ValidationResult,
        output_dir: str
    ) -> str:
        """
        生成完整报告
        
        Args:
            items: 归一化后的待办项列表
            validation_result: 校验结果
            output_dir: 输出目录
            
        Returns:
            生成的报告文件路径
        """
        # 确保输出目录存在
        os.makedirs(output_dir, exist_ok=True)
        
        # 生成报告内容
        report_content = self._build_report(items, validation_result)
        
        # 写入文件
        output_path = os.path.join(output_dir, "summary.md")
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        logger.info(f"报告已生成: {output_path}")
        return output_path
    
    def _build_report(
        self, 
        items: List[NormalizedTodoItem], 
        validation_result: ValidationResult
    ) -> str:
        """构建完整的报告内容"""
        lines = []
        
        # 标题
        lines.append("# 会议纪要待办汇总")
        lines.append("")
        lines.append(f"> 生成时间: {date.today().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 统计概览
        lines.extend(self._build_summary_section(items, validation_result))
        lines.append("")
        
        # 按人视图
        if self.by_person_config.get("enabled", True):
            lines.extend(self._build_by_person_section(items))
            lines.append("")
        
        # 按日期视图
        if self.by_date_config.get("enabled", True):
            lines.extend(self._build_by_date_section(items))
            lines.append("")
        
        # 警告和无法识别的项
        if validation_result.unrecognized_items:
            lines.extend(self._build_warnings_section(validation_result))
            lines.append("")
        
        # 页脚
        lines.append("---")
        lines.append("")
        lines.append("*此报告由会议纪要待办整理工具自动生成*")
        
        return "\n".join(lines)
    
    def _build_summary_section(
        self, 
        items: List[NormalizedTodoItem], 
        validation_result: ValidationResult
    ) -> List[str]:
        """构建统计概览部分"""
        lines = []
        lines.append("## 📊 统计概览")
        lines.append("")
        
        # 计算统计数据
        total_count = len(items)
        completed_count = sum(1 for item in items if item.is_completed)
        pending_count = total_count - completed_count
        with_assignee = sum(1 for item in items if item.has_assignee)
        with_deadline = sum(1 for item in items if item.has_deadline)
        with_blocking = sum(1 for item in items if item.has_blocking)
        
        # 过期的待办
        today = date.today()
        overdue_count = sum(
            1 for item in items 
            if item.has_deadline and item.deadline < today and not item.is_completed
        )
        
        # 即将到期（7天内）
        soon_due_count = sum(
            1 for item in items 
            if item.has_deadline 
            and today <= item.deadline <= today + timedelta(days=7)
            and not item.is_completed
        )
        
        # 构建表格
        lines.append("| 指标 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 总待办数 | {total_count} |")
        lines.append(f"| ✅ 已完成 | {completed_count} |")
        lines.append(f"| ⏳ 待处理 | {pending_count} |")
        lines.append(f"| 📅 有截止日期 | {with_deadline} |")
        lines.append(f"| 👤 有负责人 | {with_assignee} |")
        lines.append(f"| 🔗 有阻塞项 | {with_blocking} |")
        lines.append(f"| ⚠️ 已过期 | {overdue_count} |")
        lines.append(f"| ⏰ 7天内到期 | {soon_due_count} |")
        lines.append("")
        
        # 无法识别的项
        if validation_result.unrecognized_items:
            lines.append(f"**注意**: 有 {len(validation_result.unrecognized_items)} 个待办项无法完全识别（缺少负责人或截止日期），请查看下方「无法识别的待办」部分。")
            lines.append("")
        
        return lines
    
    def _build_by_person_section(self, items: List[NormalizedTodoItem]) -> List[str]:
        """构建按负责人分组的部分"""
        lines = []
        title = self.by_person_config.get("title", "按负责人分组")
        lines.append(f"## 👤 {title}")
        lines.append("")
        
        # 按负责人分组
        items_by_person = defaultdict(list)
        unassigned_items = []
        
        for item in items:
            if item.has_assignee and item.assignee_normalized:
                items_by_person[item.assignee_normalized].append(item)
            else:
                unassigned_items.append(item)
        
        # 排序方式
        sort_by = self.by_person_config.get("sort_by", "deadline_asc")
        
        # 按每个人生成内容
        for person in sorted(items_by_person.keys()):
            person_items = items_by_person[person]
            
            # 排序
            person_items = self._sort_items(person_items, sort_by)
            
            # 统计
            total = len(person_items)
            completed = sum(1 for i in person_items if i.is_completed)
            pending = total - completed
            
            lines.append(f"### {person}")
            lines.append("")
            lines.append(f"共 {total} 项待办（{completed} 已完成，{pending} 待处理）")
            lines.append("")
            
            # 列出来
            for item in person_items:
                lines.extend(self._format_todo_item(item))
                lines.append("")
        
        # 未分配的项
        if unassigned_items:
            lines.append("### 📋 未分配")
            lines.append("")
            lines.append(f"共 {len(unassigned_items)} 项待办")
            lines.append("")
            
            unassigned_items = self._sort_items(unassigned_items, sort_by)
            for item in unassigned_items:
                lines.extend(self._format_todo_item(item))
                lines.append("")
        
        return lines
    
    def _build_by_date_section(self, items: List[NormalizedTodoItem]) -> List[str]:
        """构建按截止日期分组的部分"""
        lines = []
        title = self.by_date_config.get("title", "按截止日期分组")
        lines.append(f"## 📅 {title}")
        lines.append("")
        
        today = date.today()
        
        # 分类
        overdue_items = []  # 已过期
        today_items = []     # 今天到期
        week_items = []      # 本周内
        future_items = []    # 本周后
        no_date_items = []   # 无截止日期
        
        for item in items:
            if not item.has_deadline:
                no_date_items.append(item)
                continue
            
            deadline = item.deadline
            if deadline < today:
                overdue_items.append(item)
            elif deadline == today:
                today_items.append(item)
            elif deadline <= today + timedelta(days=7):
                week_items.append(item)
            else:
                future_items.append(item)
        
        # 排序
        sort_by = self.by_date_config.get("sort_by", "deadline_asc")
        
        # 已过期
        if overdue_items:
            lines.append("### ⚠️ 已过期")
            lines.append("")
            overdue_items = self._sort_items(overdue_items, sort_by)
            for item in overdue_items:
                lines.extend(self._format_todo_item(item, show_date=True))
                lines.append("")
        
        # 今天到期
        if today_items:
            lines.append("### 🎯 今天到期")
            lines.append("")
            today_items = self._sort_items(today_items, sort_by)
            for item in today_items:
                lines.extend(self._format_todo_item(item, show_date=False))
                lines.append("")
        
        # 本周内
        if week_items:
            lines.append("### ⏰ 7天内到期")
            lines.append("")
            week_items = self._sort_items(week_items, sort_by)
            for item in week_items:
                lines.extend(self._format_todo_item(item, show_date=True))
                lines.append("")
        
        # 未来
        if future_items:
            lines.append("### 📆 未来")
            lines.append("")
            future_items = self._sort_items(future_items, sort_by)
            for item in future_items:
                lines.extend(self._format_todo_item(item, show_date=True))
                lines.append("")
        
        # 无截止日期
        if no_date_items:
            lines.append("### ❓ 无截止日期")
            lines.append("")
            no_date_items = self._sort_items(no_date_items, "content")
            for item in no_date_items:
                lines.extend(self._format_todo_item(item, show_date=False))
                lines.append("")
        
        return lines
    
    def _build_warnings_section(self, validation_result: ValidationResult) -> List[str]:
        """构建警告部分"""
        lines = []
        lines.append("## ⚠️ 无法识别的待办")
        lines.append("")
        lines.append("以下待办项缺少负责人或截止日期，无法正确归类：")
        lines.append("")
        
        for idx, item in enumerate(validation_result.unrecognized_items, 1):
            lines.append(f"### 待办 #{idx}")
            lines.append("")
            lines.append(f"- **内容**: {item['content']}")
            lines.append(f"- **原因**: {item['reason']}")
            lines.append(f"- **来源**: `{item['source_file']}:{item['line_number']}`")
            
            if item.get('raw_content'):
                lines.append(f"- **原始内容**: {item['raw_content']}")
            
            # 建议
            suggestions = []
            if not item.get('has_assignee'):
                suggestions.append("添加负责人：如 `@张三` 或 `负责人: 张三`")
            if not item.get('has_deadline'):
                suggestions.append("添加截止日期：如 `截止 2024-01-15` 或 `下周一完成`")
            
            if suggestions:
                lines.append(f"- **建议**: {'; '.join(suggestions)}")
            
            lines.append("")
        
        # 也可以链接到 warnings.json
        lines.append("> 详细信息请查看同目录下的 `warnings.json` 文件")
        lines.append("")
        
        return lines
    
    def _sort_items(
        self, 
        items: List[NormalizedTodoItem], 
        sort_by: str
    ) -> List[NormalizedTodoItem]:
        """对待办项进行排序"""
        if sort_by == "deadline_asc":
            # 按截止日期升序，无日期的放后面
            return sorted(
                items,
                key=lambda x: (
                    x.deadline if x.has_deadline else date.max,
                    x.content
                )
            )
        elif sort_by == "deadline_desc":
            # 按截止日期降序
            return sorted(
                items,
                key=lambda x: (
                    x.deadline if x.has_deadline else date.min,
                    x.content
                ),
                reverse=True
            )
        elif sort_by == "person":
            # 按负责人
            return sorted(
                items,
                key=lambda x: (
                    x.assignee_normalized or "",
                    x.deadline if x.has_deadline else date.max
                )
            )
        else:  # content
            # 按内容
            return sorted(items, key=lambda x: x.content)
    
    def _format_todo_item(
        self, 
        item: NormalizedTodoItem,
        show_date: bool = False
    ) -> List[str]:
        """格式化单个待办项"""
        lines = []
        
        # 状态图标
        status_icon = "✅" if item.is_completed else "⬜"
        status_text = "已完成" if item.is_completed else "待处理"
        
        # 主条目
        main_line = f"- {status_icon} **{item.content}**"
        
        # 元数据
        meta_parts = []
        
        # 负责人（如果不在按人视图中显示）
        if self.metadata_config.get("show_source_file", True):
            # 如果当前不是按人视图，显示负责人
            if item.has_assignee and item.assignee_normalized:
                meta_parts.append(f"👤 {item.assignee_normalized}")
        
        # 截止日期
        if show_date and item.has_deadline:
            date_str = self.date_normalizer.format_date(item.deadline)
            meta_parts.append(f"📅 {date_str}")
        
        # 状态
        if self.by_person_config.get("show_status", True):
            meta_parts.append(status_text)
        
        if meta_parts:
            main_line += f" ({' | '.join(meta_parts)})"
        
        lines.append(main_line)
        
        # 详细元数据（缩进）
        detail_parts = []
        
        # 来源文件
        if self.metadata_config.get("show_source_file", True):
            detail_parts.append(f"  - 📄 来源: `{item.source_file}:{item.line_number}`")
        
        # 阻塞项
        if self.metadata_config.get("show_blocking", True) and item.has_blocking:
            for blocking in item.blocking_normalized:
                detail_parts.append(f"  - 🔗 阻塞: {blocking}")
        
        # 原始内容（如果配置了显示）
        if self.metadata_config.get("show_raw_content", False):
            detail_parts.append(f"  - 📝 原文: {item.raw_content}")
        
        if detail_parts:
            lines.extend(detail_parts)
        
        return lines
