"""
报告导出模块
支持导出 Markdown 质检报告、CSV 问题清单和 JSON 审计记录
"""

import os
import json
import csv
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from rules_engine import (
    QualityCheckResult,
    QualityIssue,
    IssueSeverity,
    IssueType,
    QualityCheckConfig
)
from audio_metadata import ProgramScheduleItem, AudioMetadata


class ReportExporter:
    """报告导出器"""
    
    def __init__(self):
        self.export_time = datetime.now()
    
    def _format_timestamp(self, dt: datetime = None) -> str:
        """格式化时间戳"""
        if dt is None:
            dt = self.export_time
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    
    def _format_date(self, dt: datetime = None) -> str:
        """格式化日期"""
        if dt is None:
            dt = self.export_time
        return dt.strftime("%Y-%m-%d")
    
    def _get_severity_icon(self, severity: IssueSeverity) -> str:
        """获取严重程度图标（用于Markdown）"""
        icon_map = {
            IssueSeverity.CRITICAL: "🔴",
            IssueSeverity.WARNING: "🟡",
            IssueSeverity.INFO: "🔵"
        }
        return icon_map.get(severity, "⚪")
    
    def _get_resolution_icon(self, issue: QualityIssue) -> str:
        """获取处理状态图标"""
        if issue.resolution_action == "accept":
            return "✅"
        elif issue.resolution_action == "reject":
            return "❌"
        elif issue.resolution_action == "needs_fix":
            return "🔧"
        elif issue.resolution_action == "deferred":
            return "⏳"
        elif issue.resolved:
            return "✅"
        else:
            return "⏳"
    
    def export_markdown_report(self,
                                result: QualityCheckResult,
                                schedule_items: List[ProgramScheduleItem] = None,
                                audio_metadata: Dict[str, AudioMetadata] = None,
                                config: QualityCheckConfig = None,
                                project_name: str = "",
                                output_path: str = None) -> str:
        """
        导出 Markdown 格式的质检报告
        
        Args:
            result: 质检结果
            schedule_items: 节目单条目列表
            audio_metadata: 音频元数据
            config: 质检配置
            project_name: 项目名称
            output_path: 输出文件路径，如果为 None 则返回内容字符串
            
        Returns:
            如果 output_path 为 None，返回 Markdown 内容；否则返回保存的文件路径
        """
        lines = []
        
        # 报告标题
        lines.append(f"# 播前音频质检报告")
        lines.append("")
        lines.append(f"> 生成时间: {self._format_timestamp()}")
        if project_name:
            lines.append(f"> 项目: {project_name}")
        lines.append("")
        
        # 摘要
        lines.append("## 📊 质检摘要")
        lines.append("")
        
        # 统计表格
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总检查项 | {result.total_checks} |")
        lines.append(f"| 严重问题 | {result.critical_count} |")
        lines.append(f"| 警告 | {result.warning_count} |")
        lines.append(f"| 未解决问题 | {len(result.unresolved_issues)} |")
        lines.append(f"| 已解决问题 | {len(result.resolved_issues)} |")
        lines.append("")
        
        # 状态指示器
        if result.has_critical_issues:
            lines.append("⚠️ **存在未解决的严重问题，请优先处理！**")
        elif result.has_warnings:
            lines.append("ℹ️ 存在警告，建议检查。")
        else:
            lines.append("✅ 所有检查项已通过或解决。")
        lines.append("")
        
        # 问题列表
        if result.issues:
            lines.append("## 🐛 问题详情")
            lines.append("")
            
            # 按严重程度分组
            critical_issues = result.get_issues_by_severity(IssueSeverity.CRITICAL)
            warning_issues = result.get_issues_by_severity(IssueSeverity.WARNING)
            info_issues = result.get_issues_by_severity(IssueSeverity.INFO)
            
            # 严重问题
            if critical_issues:
                lines.append("### 🔴 严重问题")
                lines.append("")
                for idx, issue in enumerate(critical_issues, 1):
                    lines.append(f"**{idx}. {self._get_resolution_icon(issue)} {issue.issue_type_display}**")
                    lines.append(f"")
                    lines.append(f"- 条目编号: `{issue.item_id or 'N/A'}`")
                    lines.append(f"- 音频文件: `{issue.audio_file or 'N/A'}`")
                    lines.append(f"- 标题: {issue.title or 'N/A'}")
                    lines.append(f"- 描述: {issue.message}")
                    if issue.expected_value is not None:
                        lines.append(f"- 期望值: `{issue.expected_value}`")
                    if issue.actual_value is not None:
                        lines.append(f"- 实际值: `{issue.actual_value}`")
                    lines.append(f"- 处理状态: **{issue.resolution_display}**")
                    if issue.resolution_note:
                        lines.append(f"- 处理备注: {issue.resolution_note}")
                    lines.append("")
            
            # 警告
            if warning_issues:
                lines.append("### 🟡 警告")
                lines.append("")
                for idx, issue in enumerate(warning_issues, 1):
                    lines.append(f"**{idx}. {self._get_resolution_icon(issue)} {issue.issue_type_display}**")
                    lines.append(f"")
                    lines.append(f"- 条目编号: `{issue.item_id or 'N/A'}`")
                    lines.append(f"- 音频文件: `{issue.audio_file or 'N/A'}`")
                    lines.append(f"- 标题: {issue.title or 'N/A'}")
                    lines.append(f"- 描述: {issue.message}")
                    if issue.expected_value is not None:
                        lines.append(f"- 期望值: `{issue.expected_value}`")
                    if issue.actual_value is not None:
                        lines.append(f"- 实际值: `{issue.actual_value}`")
                    lines.append(f"- 处理状态: **{issue.resolution_display}**")
                    if issue.resolution_note:
                        lines.append(f"- 处理备注: {issue.resolution_note}")
                    lines.append("")
            
            # 信息
            if info_issues:
                lines.append("### 🔵 信息")
                lines.append("")
                for idx, issue in enumerate(info_issues, 1):
                    lines.append(f"**{idx}. {self._get_resolution_icon(issue)} {issue.issue_type_display}**")
                    lines.append(f"")
                    lines.append(f"- 条目编号: `{issue.item_id or 'N/A'}`")
                    lines.append(f"- 音频文件: `{issue.audio_file or 'N/A'}`")
                    lines.append(f"- 标题: {issue.title or 'N/A'}")
                    lines.append(f"- 描述: {issue.message}")
                    lines.append(f"- 处理状态: **{issue.resolution_display}**")
                    if issue.resolution_note:
                        lines.append(f"- 处理备注: {issue.resolution_note}")
                    lines.append("")
        
        # 排播时间线
        if schedule_items:
            lines.append("## 📅 排播时间线")
            lines.append("")
            lines.append("| 编号 | 类型 | 标题 | 开始时间 | 结束时间 | 时长 | 音频文件 |")
            lines.append("|------|------|------|----------|----------|------|----------|")
            
            # 按开始时间排序
            sorted_items = sorted(
                schedule_items,
                key=lambda x: x._time_to_seconds(x.start_time)
            )
            
            for item in sorted_items:
                lines.append(
                    f"| {item.item_id} | {item.type_display} | {item.title} | "
                    f"{item.start_time} | {item.end_time_formatted[:8]} | "
                    f"{item.duration_formatted} | {item.audio_file or '-'} |"
                )
            lines.append("")
        
        # 音频文件详情
        if audio_metadata:
            lines.append("## 🎵 音频文件详情")
            lines.append("")
            lines.append("| 文件名 | 格式 | 采样率 | 声道 | 位深度 | 时长 | 峰值 | 平均音量 |")
            lines.append("|--------|------|--------|------|--------|------|------|----------|")
            
            for filename, metadata in audio_metadata.items():
                peak_str = f"{metadata.peak_dbfs:.1f} dBFS" if metadata.peak_dbfs > -float('inf') else "N/A"
                rms_str = f"{metadata.rms_dbfs:.1f} dBFS" if metadata.rms_dbfs > -float('inf') else "N/A"
                
                lines.append(
                    f"| {filename} | {metadata.format_str} | "
                    f"{metadata.sample_rate or 'N/A'} Hz | "
                    f"{metadata.channels or 'N/A'} | "
                    f"{metadata.bit_depth or 'N/A'} bit | "
                    f"{metadata.duration_formatted} | "
                    f"{peak_str} | {rms_str} |"
                )
            lines.append("")
        
        # 质检配置
        if config:
            lines.append("## ⚙️ 质检配置")
            lines.append("")
            config_dict = config.to_dict()
            
            # 格式要求
            lines.append("### 格式要求")
            lines.append(f"- 允许格式: {', '.join(config_dict['allowed_formats']).upper()}")
            lines.append(f"- 要求采样率: {config_dict['required_sample_rate']} Hz")
            lines.append(f"- 要求声道数: {config_dict['required_channels']}")
            lines.append(f"- 最小位深度: {config_dict['min_bit_depth']} bit")
            lines.append("")
            
            # 时长容差
            lines.append("### 时长容差")
            lines.append(f"- 最大超出: {config_dict['max_duration_over_seconds']} 秒")
            lines.append(f"- 最大缩短: {config_dict['max_duration_under_seconds']} 秒")
            lines.append(f"- 容差百分比: {config_dict['duration_tolerance_percent']}%")
            lines.append("")
            
            # 音频质量
            lines.append("### 音频质量")
            lines.append(f"- 峰值警告阈值: {config_dict['max_peak_dbfs']} dBFS")
            lines.append(f"- 峰值危险阈值: {config_dict['critical_peak_dbfs']} dBFS")
            lines.append(f"- 最小平均音量: {config_dict['min_rms_dbfs']} dBFS")
            lines.append(f"- 最大片头静音: {config_dict['max_leading_silence_seconds']} 秒")
            lines.append(f"- 最大片尾静音: {config_dict['max_trailing_silence_seconds']} 秒")
            lines.append("")
            
            # 排播规则
            lines.append("### 排播规则")
            lines.append(f"- 检查广告重复: {'是' if config_dict['check_ad_duplicates'] else '否'}")
            lines.append(f"- 最小广告间隔: {config_dict['min_ad_interval_minutes']} 分钟")
            lines.append(f"- 检查时间线重叠: {'是' if config_dict['check_timeline_overlap'] else '否'}")
            lines.append("")
        
        # 页脚
        lines.append("---")
        lines.append("")
        lines.append(f"*报告由播前音频质检台生成 | {self._format_timestamp()}*")
        
        content = "\n".join(lines)
        
        if output_path:
            # 确保目录存在
            output_dir = os.path.dirname(output_path)
            if output_dir and not os.path.exists(output_dir):
                os.makedirs(output_dir)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return output_path
        else:
            return content
    
    def export_csv_issue_list(self,
                               result: QualityCheckResult,
                               output_path: str = None) -> str:
        """
        导出 CSV 格式的问题清单
        
        Args:
            result: 质检结果
            output_path: 输出文件路径，如果为 None 则返回内容字符串
            
        Returns:
            如果 output_path 为 None，返回 CSV 内容；否则返回保存的文件路径
        """
        # 表头
        headers = [
            "序号", "严重程度", "问题类型", "条目编号", "音频文件",
            "标题", "问题描述", "期望值", "实际值",
            "处理状态", "处理动作", "处理备注"
        ]
        
        # 数据行
        rows = []
        for idx, issue in enumerate(result.issues, 1):
            row = [
                idx,
                issue.severity_display,
                issue.issue_type_display,
                issue.item_id,
                issue.audio_file,
                issue.title,
                issue.message,
                str(issue.expected_value) if issue.expected_value is not None else "",
                str(issue.actual_value) if issue.actual_value is not None else "",
                issue.resolution_display,
                issue.resolution_action,
                issue.resolution_note
            ]
            rows.append(row)
        
        if output_path:
            # 确保目录存在
            output_dir = os.path.dirname(output_path)
            if output_dir and not os.path.exists(output_dir):
                os.makedirs(output_dir)
            
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(headers)
                writer.writerows(rows)
            
            return output_path
        else:
            # 构建 CSV 字符串
            import io
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(headers)
            writer.writerows(rows)
            return output.getvalue()
    
    def export_json_audit_log(self,
                               result: QualityCheckResult,
                               schedule_items: List[ProgramScheduleItem] = None,
                               audio_metadata: Dict[str, AudioMetadata] = None,
                               config: QualityCheckConfig = None,
                               project_name: str = "",
                               output_path: str = None) -> str:
        """
        导出 JSON 格式的审计记录
        
        Args:
            result: 质检结果
            schedule_items: 节目单条目列表
            audio_metadata: 音频元数据
            config: 质检配置
            project_name: 项目名称
            output_path: 输出文件路径，如果为 None 则返回内容字符串
            
        Returns:
            如果 output_path 为 None，返回 JSON 字符串；否则返回保存的文件路径
        """
        audit_log = {
            "version": "1.0",
            "audit_type": "audio_quality_check",
            "generated_at": self.export_time.isoformat(),
            "project_name": project_name,
            "summary": result.to_dict(),
            "issues": [issue.to_dict() for issue in result.issues]
        }
        
        # 添加节目单信息
        if schedule_items:
            audit_log["schedule"] = {
                "total_items": len(schedule_items),
                "items": [item.to_dict() for item in schedule_items]
            }
        
        # 添加音频元数据信息
        if audio_metadata:
            audit_log["audio_files"] = {
                filename: metadata.to_dict()
                for filename, metadata in audio_metadata.items()
            }
        
        # 添加配置
        if config:
            audit_log["config"] = config.to_dict()
        
        # 添加统计信息
        audit_log["statistics"] = {
            "total_issues": len(result.issues),
            "by_severity": {
                "critical": len(result.get_issues_by_severity(IssueSeverity.CRITICAL)),
                "warning": len(result.get_issues_by_severity(IssueSeverity.WARNING)),
                "info": len(result.get_issues_by_severity(IssueSeverity.INFO))
            },
            "by_resolution": {
                "resolved": len(result.resolved_issues),
                "unresolved": len(result.unresolved_issues)
            }
        }
        
        json_content = json.dumps(audit_log, ensure_ascii=False, indent=2)
        
        if output_path:
            # 确保目录存在
            output_dir = os.path.dirname(output_path)
            if output_dir and not os.path.exists(output_dir):
                os.makedirs(output_dir)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(json_content)
            
            return output_path
        else:
            return json_content
    
    def export_all(self,
                   result: QualityCheckResult,
                   output_directory: str,
                   base_filename: str = None,
                   schedule_items: List[ProgramScheduleItem] = None,
                   audio_metadata: Dict[str, AudioMetadata] = None,
                   config: QualityCheckConfig = None,
                   project_name: str = "") -> Dict[str, str]:
        """
        导出所有格式的报告
        
        Args:
            result: 质检结果
            output_directory: 输出目录
            base_filename: 基础文件名（不含扩展名）
            schedule_items: 节目单条目
            audio_metadata: 音频元数据
            config: 质检配置
            project_name: 项目名称
            
        Returns:
            字典，键为格式类型，值为文件路径
        """
        if base_filename is None:
            base_filename = f"quality_check_{self._format_date()}"
        
        # 确保输出目录存在
        os.makedirs(output_directory, exist_ok=True)
        
        outputs = {}
        
        # Markdown 报告
        md_path = os.path.join(output_directory, f"{base_filename}.md")
        outputs["markdown"] = self.export_markdown_report(
            result=result,
            schedule_items=schedule_items,
            audio_metadata=audio_metadata,
            config=config,
            project_name=project_name,
            output_path=md_path
        )
        
        # CSV 问题清单
        csv_path = os.path.join(output_directory, f"{base_filename}_issues.csv")
        outputs["csv"] = self.export_csv_issue_list(
            result=result,
            output_path=csv_path
        )
        
        # JSON 审计记录
        json_path = os.path.join(output_directory, f"{base_filename}_audit.json")
        outputs["json"] = self.export_json_audit_log(
            result=result,
            schedule_items=schedule_items,
            audio_metadata=audio_metadata,
            config=config,
            project_name=project_name,
            output_path=json_path
        )
        
        return outputs


# 便捷函数
def export_report(result: QualityCheckResult,
                  output_path: str,
                  format_type: str = "markdown",
                  **kwargs) -> str:
    """
    便捷函数：导出报告
    
    Args:
        result: 质检结果
        output_path: 输出路径
        format_type: 格式类型："markdown", "csv", "json"
        **kwargs: 其他参数传递给对应导出方法
        
    Returns:
        导出的文件路径
    """
    exporter = ReportExporter()
    
    if format_type == "markdown":
        return exporter.export_markdown_report(
            result=result,
            output_path=output_path,
            **kwargs
        )
    elif format_type == "csv":
        return exporter.export_csv_issue_list(
            result=result,
            output_path=output_path,
            **kwargs
        )
    elif format_type == "json":
        return exporter.export_json_audit_log(
            result=result,
            output_path=output_path,
            **kwargs
        )
    else:
        raise ValueError(f"不支持的格式类型: {format_type}")
