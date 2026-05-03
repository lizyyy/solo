#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
导出模块
支持导出:
- review_report.md - Markdown 格式的问题报告
- issues.csv - CSV 格式的问题列表
"""

import csv
import os
from typing import List, Dict, Any, Optional
from datetime import datetime

from .parser import SubtitleItem
from .rules_engine import Issue, IssueType, IssueSeverity
from .state_storage import StateStorage, ConfirmationStatus


class Exporter:
    """导出器类"""
    
    # 问题类型名称映射
    TYPE_NAMES = {
        IssueType.TIME_OVERLAP: "时间重叠",
        IssueType.HIGH_CHARS_PER_SECOND: "每秒字数过高",
        IssueType.EMPTY_SUBTITLE: "空字幕",
        IssueType.SPEAKER_MISSING: "说话人缺失",
        IssueType.SENSITIVE_WORD: "敏感词命中",
        IssueType.SHORT_DURATION: "字幕时长过短"
    }
    
    # 严重程度名称映射
    SEVERITY_NAMES = {
        IssueSeverity.ERROR: "错误",
        IssueSeverity.WARNING: "警告",
        IssueSeverity.INFO: "提示"
    }
    
    # 状态名称映射
    STATUS_NAMES = {
        ConfirmationStatus.PENDING: "待处理",
        ConfirmationStatus.CONFIRMED: "已确认",
        ConfirmationStatus.DISMISSED: "已忽略",
        ConfirmationStatus.FIXED: "已修复"
    }
    
    @classmethod
    def export_markdown(cls, issues: List[Issue], 
                        subtitles: List[SubtitleItem],
                        output_path: str,
                        state_storage: StateStorage = None) -> bool:
        """
        导出 Markdown 格式的问题报告
        
        Args:
            issues: 问题列表
            subtitles: 字幕列表
            output_path: 输出文件路径
            state_storage: 状态存储（可选，用于获取确认状态）
        
        Returns:
            是否成功导出
        """
        try:
            lines = []
            
            # 标题
            lines.append("# 字幕质检报告")
            lines.append("")
            lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append("")
            
            # 统计信息
            lines.append("## 统计概览")
            lines.append("")
            
            stats = cls._calculate_statistics(issues, state_storage)
            
            lines.append(f"- **总字幕数**: {len(subtitles)}")
            lines.append(f"- **总问题数**: {stats['total']}")
            lines.append("")
            
            lines.append("### 按严重程度分布")
            lines.append("")
            lines.append("| 级别 | 数量 |")
            lines.append("|------|------|")
            lines.append(f"| 错误 (Error) | {stats['by_severity']['error']} |")
            lines.append(f"| 警告 (Warning) | {stats['by_severity']['warning']} |")
            lines.append(f"| 提示 (Info) | {stats['by_severity']['info']} |")
            lines.append("")
            
            lines.append("### 按问题类型分布")
            lines.append("")
            lines.append("| 问题类型 | 数量 |")
            lines.append("|----------|------|")
            
            for issue_type, count in stats['by_type'].items():
                if count > 0:
                    type_name = cls.TYPE_NAMES.get(issue_type, issue_type.value if hasattr(issue_type, 'value') else str(issue_type))
                    lines.append(f"| {type_name} | {count} |")
            
            lines.append("")
            
            if state_storage:
                lines.append("### 处理状态")
                lines.append("")
                lines.append("| 状态 | 数量 |")
                lines.append("|------|------|")
                lines.append(f"| 待处理 | {stats['by_status']['pending']} |")
                lines.append(f"| 已确认 | {stats['by_status']['confirmed']} |")
                lines.append(f"| 已忽略 | {stats['by_status']['dismissed']} |")
                lines.append(f"| 已修复 | {stats['by_status']['fixed']} |")
                lines.append("")
            
            # 详细问题列表
            lines.append("## 详细问题列表")
            lines.append("")
            
            if not issues:
                lines.append("> 未发现任何问题。")
            else:
                # 按严重程度分组
                error_issues = [i for i in issues if i.severity == IssueSeverity.ERROR]
                warning_issues = [i for i in issues if i.severity == IssueSeverity.WARNING]
                info_issues = [i for i in issues if i.severity == IssueSeverity.INFO]
                
                # 错误问题
                if error_issues:
                    lines.append("### 🔴 错误 (Error)")
                    lines.append("")
                    for issue in error_issues:
                        lines.extend(cls._format_issue_markdown(issue, state_storage))
                        lines.append("")
                
                # 警告问题
                if warning_issues:
                    lines.append("### 🟡 警告 (Warning)")
                    lines.append("")
                    for issue in warning_issues:
                        lines.extend(cls._format_issue_markdown(issue, state_storage))
                        lines.append("")
                
                # 提示问题
                if info_issues:
                    lines.append("### 🔵 提示 (Info)")
                    lines.append("")
                    for issue in info_issues:
                        lines.extend(cls._format_issue_markdown(issue, state_storage))
                        lines.append("")
            
            # 附录
            lines.append("## 附录")
            lines.append("")
            lines.append("### 问题类型说明")
            lines.append("")
            lines.append("- **时间重叠**: 当前字幕开始时间早于前一字幕结束时间")
            lines.append("- **每秒字数过高**: 字幕阅读速度超过阈值，可能导致观众无法及时阅读")
            lines.append("- **空字幕**: 字幕文本为空或仅包含空格")
            lines.append("- **说话人缺失**: 字幕缺少说话人标签，或说话人不在有效列表中")
            lines.append("- **敏感词命中**: 字幕文本包含配置的敏感词")
            lines.append("- **字幕时长过短**: 字幕显示时间小于最小阈值")
            lines.append("")
            
            lines.append("---")
            lines.append("")
            lines.append(f"*报告由字幕质检工具生成*")
            
            # 写入文件
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
            
            return True
            
        except Exception as e:
            print(f"导出 Markdown 失败: {e}")
            return False
    
    @classmethod
    def _format_issue_markdown(cls, issue: Issue, 
                               state_storage: StateStorage = None) -> List[str]:
        """
        格式化单个问题为 Markdown
        """
        lines = []
        
        type_name = cls.TYPE_NAMES.get(issue.issue_type, issue.issue_type.value)
        start_time = cls._format_time(issue.start_time)
        end_time = cls._format_time(issue.end_time)
        
        # 获取状态
        status_text = ""
        if state_storage:
            issue_id = StateStorage.generate_issue_id(
                issue.subtitle_index,
                issue.issue_type.value,
                issue.start_time
            )
            status = state_storage.get_issue_status(issue_id)
            status_text = f" [{cls.STATUS_NAMES.get(status, '待处理')}]"
        
        lines.append(f"#### {type_name}{status_text}")
        lines.append("")
        lines.append(f"- **字幕序号**: {issue.subtitle_index}")
        lines.append(f"- **时间范围**: {start_time} - {end_time}")
        if issue.speaker:
            lines.append(f"- **说话人**: {issue.speaker}")
        lines.append(f"- **问题描述**: {issue.message}")
        lines.append("")
        
        # 字幕文本
        lines.append("**字幕文本:**")
        lines.append("")
        lines.append("```")
        lines.append(issue.subtitle_text)
        lines.append("```")
        lines.append("")
        
        # 详细信息
        if issue.details:
            lines.append("**详细信息:**")
            lines.append("")
            for key, value in issue.details.items():
                if isinstance(value, float):
                    value = f"{value:.3f}"
                lines.append(f"- {key}: {value}")
            lines.append("")
        
        lines.append("---")
        
        return lines
    
    @classmethod
    def export_csv(cls, issues: List[Issue], 
                   output_path: str,
                   state_storage: StateStorage = None) -> bool:
        """
        导出 CSV 格式的问题列表
        
        Args:
            issues: 问题列表
            output_path: 输出文件路径
            state_storage: 状态存储（可选）
        
        Returns:
            是否成功导出
        """
        try:
            # 定义 CSV 列
            fieldnames = [
                '序号',
                '问题类型',
                '严重程度',
                '处理状态',
                '字幕序号',
                '开始时间',
                '结束时间',
                '时长(秒)',
                '说话人',
                '问题描述',
                '字幕文本',
                '详细信息'
            ]
            
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                
                for idx, issue in enumerate(issues, 1):
                    # 获取状态
                    status = "待处理"
                    if state_storage:
                        issue_id = StateStorage.generate_issue_id(
                            issue.subtitle_index,
                            issue.issue_type.value,
                            issue.start_time
                        )
                        status_enum = state_storage.get_issue_status(issue_id)
                        status = cls.STATUS_NAMES.get(status_enum, "待处理")
                    
                    # 准备行数据
                    row = {
                        '序号': idx,
                        '问题类型': cls.TYPE_NAMES.get(issue.issue_type, issue.issue_type.value),
                        '严重程度': cls.SEVERITY_NAMES.get(issue.severity, issue.severity.value),
                        '处理状态': status,
                        '字幕序号': issue.subtitle_index,
                        '开始时间': cls._format_time(issue.start_time),
                        '结束时间': cls._format_time(issue.end_time),
                        '时长(秒)': round(issue.end_time - issue.start_time, 3),
                        '说话人': issue.speaker or '',
                        '问题描述': issue.message,
                        '字幕文本': issue.subtitle_text,
                        '详细信息': cls._format_details_for_csv(issue.details)
                    }
                    
                    writer.writerow(row)
            
            return True
            
        except Exception as e:
            print(f"导出 CSV 失败: {e}")
            return False
    
    @classmethod
    def _calculate_statistics(cls, issues: List[Issue], 
                              state_storage: StateStorage = None) -> Dict[str, Any]:
        """
        计算统计信息
        """
        stats = {
            'total': len(issues),
            'by_severity': {
                'error': 0,
                'warning': 0,
                'info': 0
            },
            'by_type': {},
            'by_status': {
                'pending': 0,
                'confirmed': 0,
                'dismissed': 0,
                'fixed': 0
            }
        }
        
        # 初始化类型统计
        for issue_type in IssueType:
            stats['by_type'][issue_type] = 0
        
        for issue in issues:
            # 按严重程度
            if issue.severity == IssueSeverity.ERROR:
                stats['by_severity']['error'] += 1
            elif issue.severity == IssueSeverity.WARNING:
                stats['by_severity']['warning'] += 1
            else:
                stats['by_severity']['info'] += 1
            
            # 按类型
            stats['by_type'][issue.issue_type] += 1
            
            # 按状态
            if state_storage:
                issue_id = StateStorage.generate_issue_id(
                    issue.subtitle_index,
                    issue.issue_type.value,
                    issue.start_time
                )
                status = state_storage.get_issue_status(issue_id)
                
                if status == ConfirmationStatus.CONFIRMED:
                    stats['by_status']['confirmed'] += 1
                elif status == ConfirmationStatus.DISMISSED:
                    stats['by_status']['dismissed'] += 1
                elif status == ConfirmationStatus.FIXED:
                    stats['by_status']['fixed'] += 1
                else:
                    stats['by_status']['pending'] += 1
            else:
                stats['by_status']['pending'] += 1
        
        return stats
    
    @staticmethod
    def _format_time(seconds: float) -> str:
        """
        格式化时间为 HH:MM:SS.mmm
        """
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds * 1000) % 1000)
        
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"
    
    @staticmethod
    def _format_details_for_csv(details: Dict[str, Any]) -> str:
        """
        格式化详细信息为 CSV 字符串
        """
        if not details:
            return ""
        
        parts = []
        for key, value in details.items():
            if isinstance(value, float):
                value = f"{value:.3f}"
            parts.append(f"{key}: {value}")
        
        return "; ".join(parts)
