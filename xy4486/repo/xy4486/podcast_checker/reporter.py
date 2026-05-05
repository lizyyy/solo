"""
Markdown报告导出模块
生成供主播查看的检查报告
"""

import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .models import CheckResult, Issue, IssueSeverity, IssueType
from .config import Config


class ReportGenerator:
    """Markdown报告生成器"""
    
    def __init__(self, config: Config):
        self.config = config
        self.report_config = config.report_config
        self.output_path = Path(self.report_config.get('output_path', './reports'))
        self.include_suggestions = self.report_config.get('include_suggestions', True)
        
        self._ensure_output_dir()
    
    def _ensure_output_dir(self) -> None:
        """确保输出目录存在"""
        self.output_path.mkdir(parents=True, exist_ok=True)
    
    def generate_report(self, result: CheckResult, output_file: Optional[str] = None) -> str:
        """生成检查报告
        
        Args:
            result: 检查结果
            output_file: 输出文件路径，如果为None则自动生成
            
        Returns:
            生成的报告文件路径
        """
        if output_file is None:
            timestamp = result.check_time.strftime("%Y%m%d_%H%M%S")
            filename = f"EP{result.episode_number}_report_{timestamp}.md"
            output_file = str(self.output_path / filename)
        
        report_content = self._build_report_content(result)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        return output_file
    
    def generate_batch_report(self, results: List[CheckResult], output_file: Optional[str] = None) -> str:
        """生成批量检查报告
        
        Args:
            results: 检查结果列表
            output_file: 输出文件路径
            
        Returns:
            生成的报告文件路径
        """
        if output_file is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"batch_report_{timestamp}.md"
            output_file = str(self.output_path / filename)
        
        report_content = self._build_batch_report_content(results)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        return output_file
    
    def _build_report_content(self, result: CheckResult) -> str:
        """构建单期报告内容"""
        lines = []
        
        status_icon = "✅" if result.passed else "❌"
        lines.append(f"# 播客质量检查报告 - EP{result.episode_number}")
        lines.append("")
        lines.append(f"**检查时间**: {result.check_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**检查状态**: {status_icon} {'通过' if result.passed else '存在问题'}")
        lines.append(f"**错误数量**: {result.error_count}")
        lines.append(f"**警告数量**: {result.warning_count}")
        lines.append("")
        
        lines.append("## 📁 文件清单")
        lines.append("")
        lines.append("| 文件类型 | 状态 | 文件路径 |")
        lines.append("|---------|------|---------|")
        
        file_checks = [
            ("音频文件", result.files.audio_path),
            ("封面图片", result.files.cover_path),
            ("Shownotes", result.files.shownotes_path),
            ("字幕文件", result.files.subtitles_path),
            ("授权素材", result.files.assets_folder),
        ]
        
        for name, path in file_checks:
            status = "✅" if path else "❌"
            display_path = path or "缺失"
            lines.append(f"| {name} | {status} | {display_path} |")
        
        lines.append("")
        
        if result.files.audio_duration:
            lines.append("## 🎧 音频信息")
            lines.append("")
            lines.append(f"- **时长**: {self._format_duration(result.files.audio_duration)}")
            if result.files.audio_bitrate:
                lines.append(f"- **比特率**: {result.files.audio_bitrate} kbps")
            if result.files.audio_sample_rate:
                lines.append(f"- **采样率**: {result.files.audio_sample_rate} Hz")
            lines.append("")
        
        if result.issues:
            lines.append("## ⚠️ 检查发现的问题")
            lines.append("")
            
            errors = [i for i in result.issues if i.severity == IssueSeverity.ERROR]
            warnings = [i for i in result.issues if i.severity == IssueSeverity.WARNING]
            infos = [i for i in result.issues if i.severity == IssueSeverity.INFO]
            
            if errors:
                lines.append("### ❌ 错误（必须修复）")
                lines.append("")
                for issue in errors:
                    lines.append(self._format_issue(issue))
                    lines.append("")
            
            if warnings:
                lines.append("### ⚠️ 警告（建议修复）")
                lines.append("")
                for issue in warnings:
                    lines.append(self._format_issue(issue))
                    lines.append("")
            
            if infos:
                lines.append("### ℹ️ 提示（可选修复）")
                lines.append("")
                for issue in infos:
                    lines.append(self._format_issue(issue))
                    lines.append("")
        
        lines.append("## 📋 检查统计")
        lines.append("")
        lines.append(f"- 检查文件数: {result.total_files_checked}")
        lines.append(f"- 错误数: {result.error_count}")
        lines.append(f"- 警告数: {result.warning_count}")
        lines.append(f"- 检查结果: {'✅ 通过' if result.passed else '❌ 未通过'}")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本报告由播客质量检查工具自动生成*")
        lines.append(f"*生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return "\n".join(lines)
    
    def _format_issue(self, issue: Issue) -> str:
        """格式化单个问题"""
        lines = []
        lines.append(f"**{issue.message}**")
        
        if issue.file_path:
            lines.append(f"- 相关文件: `{issue.file_path}`")
        
        if issue.details and self.include_suggestions:
            details_str = ", ".join([f"{k}: {v}" for k, v in issue.details.items()])
            lines.append(f"- 详细信息: {details_str}")
        
        if issue.suggestion and self.include_suggestions:
            lines.append(f"- 💡 建议: {issue.suggestion}")
        
        return "\n".join(lines)
    
    def _build_batch_report_content(self, results: List[CheckResult]) -> str:
        """构建批量报告内容"""
        lines = []
        
        lines.append("# 播客批量质量检查报告")
        lines.append("")
        lines.append(f"**报告生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**检查节目数**: {len(results)}")
        lines.append("")
        
        lines.append("## 📊 检查概览")
        lines.append("")
        lines.append("| 期数 | 状态 | 错误数 | 警告数 | 检查时间 |")
        lines.append("|------|------|--------|--------|----------|")
        
        for result in sorted(results, key=lambda r: int(r.episode_number)):
            status = "✅ 通过" if result.passed else "❌ 未通过"
            lines.append(
                f"| EP{result.episode_number} | {status} | {result.error_count} | "
                f"{result.warning_count} | {result.check_time.strftime('%Y-%m-%d %H:%M')} |"
            )
        
        lines.append("")
        
        total_errors = sum(r.error_count for r in results)
        total_warnings = sum(r.warning_count for r in results)
        passed_count = sum(1 for r in results if r.passed)
        
        lines.append("## 📈 汇总统计")
        lines.append("")
        lines.append(f"- 检查节目总数: {len(results)}")
        lines.append(f"- 通过检查: {passed_count} 期")
        lines.append(f"- 未通过检查: {len(results) - passed_count} 期")
        lines.append(f"- 总错误数: {total_errors}")
        lines.append(f"- 总警告数: {total_warnings}")
        lines.append("")
        
        if total_errors > 0 or total_warnings > 0:
            lines.append("## ⚠️ 问题汇总")
            lines.append("")
            
            for result in sorted(results, key=lambda r: int(r.episode_number)):
                if result.issues:
                    lines.append(f"### EP{result.episode_number}")
                    lines.append("")
                    
                    errors = [i for i in result.issues if i.severity == IssueSeverity.ERROR]
                    warnings = [i for i in result.issues if i.severity == IssueSeverity.WARNING]
                    
                    for issue in errors:
                        lines.append(f"- ❌ **{issue.message}**")
                        if issue.file_path:
                            lines.append(f"  - 文件: `{issue.file_path}`")
                    
                    for issue in warnings:
                        lines.append(f"- ⚠️ **{issue.message}**")
                        if issue.file_path:
                            lines.append(f"  - 文件: `{issue.file_path}`")
                    
                    lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本报告由播客质量检查工具自动生成*")
        lines.append(f"*生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return "\n".join(lines)
    
    def _format_duration(self, seconds: float) -> str:
        """格式化时长显示"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        
        if hours > 0:
            return f"{hours}小时{minutes}分{secs}秒"
        else:
            return f"{minutes}分{secs}秒"
