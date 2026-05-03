"""导出模块 - 处理各种格式的导出"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import os
import csv

from src.models.models import (
    CalibrationProject, Subtitle, Issue, IssueType, IssueSeverity,
    timedelta_to_srt_format
)


class Exporter:
    """导出器基类"""
    
    @staticmethod
    def ensure_dir(file_path: str):
        """确保目录存在"""
        dir_path = os.path.dirname(file_path)
        if dir_path and not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)


class SRTExporter(Exporter):
    """SRT 导出器"""
    
    @classmethod
    def export(cls, subtitles: List[Subtitle], file_path: str, encoding: str = 'utf-8') -> Dict[str, Any]:
        """导出字幕为 SRT 格式"""
        result = {
            'success': False,
            'file_path': file_path,
            'subtitle_count': len(subtitles),
            'message': ''
        }
        
        try:
            cls.ensure_dir(file_path)
            
            srt_lines = []
            for sub in subtitles:
                srt_lines.append(f"{sub.index}")
                start_str = timedelta_to_srt_format(sub.start_time)
                end_str = timedelta_to_srt_format(sub.end_time)
                srt_lines.append(f"{start_str} --> {end_str}")
                srt_lines.append(sub.text)
                srt_lines.append('')  # 空行分隔
            
            content = '\n'.join(srt_lines)
            
            with open(file_path, 'w', encoding=encoding) as f:
                f.write(content)
            
            result['success'] = True
            result['message'] = f'成功导出 {len(subtitles)} 条字幕到 {file_path}'
            
        except Exception as e:
            result['message'] = f'导出失败: {e}'
        
        return result
    
    @classmethod
    def export_with_comparison(
        cls,
        original_subtitles: List[Subtitle],
        modified_subtitles: List[Subtitle],
        file_path: str,
        encoding: str = 'utf-8'
    ) -> Dict[str, Any]:
        """导出带对比信息的 SRT（注释形式）"""
        result = {
            'success': False,
            'file_path': file_path,
            'subtitle_count': len(modified_subtitles),
            'message': ''
        }
        
        try:
            cls.ensure_dir(file_path)
            
            # 创建原始字幕索引
            original_map = {sub.index: sub for sub in original_subtitles}
            
            srt_lines = []
            for sub in modified_subtitles:
                # 检查是否有修改
                original = original_map.get(sub.index)
                has_change = False
                change_note = ""
                
                if original:
                    if sub.start_time != original.start_time or sub.end_time != original.end_time:
                        has_change = True
                        offset = sub.offset_applied.total_seconds()
                        change_note = f"时间偏移: {offset:+.3f}秒"
                
                srt_lines.append(f"{sub.index}")
                
                # 添加修改注释
                if has_change:
                    srt_lines.append(f"# {change_note}")
                    if original:
                        orig_start = timedelta_to_srt_format(original.start_time)
                        orig_end = timedelta_to_srt_format(original.end_time)
                        srt_lines.append(f"# 原始时间: {orig_start} --> {orig_end}")
                
                start_str = timedelta_to_srt_format(sub.start_time)
                end_str = timedelta_to_srt_format(sub.end_time)
                srt_lines.append(f"{start_str} --> {end_str}")
                srt_lines.append(sub.text)
                srt_lines.append('')  # 空行分隔
            
            content = '\n'.join(srt_lines)
            
            with open(file_path, 'w', encoding=encoding) as f:
                f.write(content)
            
            result['success'] = True
            result['message'] = f'成功导出 {len(modified_subtitles)} 条字幕到 {file_path}'
            
        except Exception as e:
            result['message'] = f'导出失败: {e}'
        
        return result


class MarkdownReportExporter(Exporter):
    """Markdown 校准报告导出器"""
    
    @classmethod
    def export(
        cls,
        project: CalibrationProject,
        file_path: str,
        include_resolved: bool = False
    ) -> Dict[str, Any]:
        """导出 Markdown 格式的校准报告"""
        result = {
            'success': False,
            'file_path': file_path,
            'issue_count': len(project.issues),
            'message': ''
        }
        
        try:
            cls.ensure_dir(file_path)
            
            lines = []
            
            # 标题
            lines.append(f"# 字幕无障碍校准报告")
            lines.append("")
            lines.append(f"**项目名称**: {project.name}")
            lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append("")
            
            # 统计概览
            lines.append("## 一、问题统计概览")
            lines.append("")
            
            # 按类型统计
            type_stats = {}
            severity_stats = {}
            
            for issue in project.issues:
                if issue.resolved and not include_resolved:
                    continue
                
                type_key = issue.issue_type.value
                type_stats[type_key] = type_stats.get(type_key, 0) + 1
                
                sev_key = issue.severity.value
                severity_stats[sev_key] = severity_stats.get(sev_key, 0) + 1
            
            total_issues = sum(type_stats.values())
            
            lines.append(f"### 1.1 问题总数: {total_issues}")
            lines.append("")
            
            lines.append("### 1.2 按问题类型分布")
            lines.append("")
            lines.append("| 问题类型 | 数量 | 占比 |")
            lines.append("|---------|------|------|")
            
            for issue_type, count in type_stats.items():
                percentage = (count / total_issues * 100) if total_issues > 0 else 0
                lines.append(f"| {issue_type} | {count} | {percentage:.1f}% |")
            
            lines.append("")
            
            lines.append("### 1.3 按严重程度分布")
            lines.append("")
            lines.append("| 严重程度 | 数量 | 占比 |")
            lines.append("|---------|------|------|")
            
            for severity, count in severity_stats.items():
                percentage = (count / total_issues * 100) if total_issues > 0 else 0
                lines.append(f"| {severity} | {count} | {percentage:.1f}% |")
            
            lines.append("")
            
            # 数据统计
            lines.append("## 二、数据统计")
            lines.append("")
            lines.append(f"- **字幕总数**: {len(project.subtitles)} 条")
            lines.append(f"- **视频时间码**: {len(project.timecodes)} 条")
            lines.append(f"- **环境音标注**: {len(project.audio_annotations)} 条")
            lines.append(f"- **观众反馈**: {len(project.feedback_records)} 条")
            lines.append(f"- **全局偏移**: {project.global_offset.total_seconds():.3f} 秒")
            lines.append("")
            
            # 问题详情
            lines.append("## 三、问题详情")
            lines.append("")
            
            # 按严重程度分组
            severity_order = [IssueSeverity.CRITICAL, IssueSeverity.HIGH, IssueSeverity.MEDIUM, IssueSeverity.LOW]
            
            for severity in severity_order:
                sev_issues = [i for i in project.issues 
                             if i.severity == severity and (not i.resolved or include_resolved)]
                
                if not sev_issues:
                    continue
                
                lines.append(f"### 3.{severity_order.index(severity) + 1} {severity.value}级别问题 ({len(sev_issues)}个)")
                lines.append("")
                
                for idx, issue in enumerate(sev_issues, 1):
                    status = "✅ 已解决" if issue.resolved else "🔴 待处理"
                    
                    lines.append(f"#### 问题 {idx}: {issue.issue_type.value}")
                    lines.append(f"- **状态**: {status}")
                    
                    if issue.subtitle_index:
                        lines.append(f"- **相关字幕**: #{issue.subtitle_index}")
                    
                    if issue.start_time:
                        lines.append(f"- **时间范围**: {issue.start_time} - {issue.end_time or issue.start_time}")
                    
                    lines.append(f"- **问题描述**: {issue.description}")
                    
                    if issue.suggested_fix:
                        lines.append(f"- **建议修复**: {issue.suggested_fix}")
                    
                    if issue.resolved and issue.resolution_note:
                        lines.append(f"- **解决备注**: {issue.resolution_note}")
                    
                    lines.append("")
            
            # 附录
            lines.append("## 四、附录")
            lines.append("")
            
            # 规则说明
            lines.append("### 4.1 检查规则说明")
            lines.append("")
            lines.append("1. **字幕延迟**: 字幕开始时间比视频时间码晚超过 0.5 秒")
            lines.append("2. **字幕过早**: 字幕开始时间比视频时间码早超过 2 秒")
            lines.append("3. **说话人漏标**: 对话字幕缺少说话人标注")
            lines.append("4. **音效提示缺失**: 有环境音标注但缺少对应音效字幕")
            lines.append("5. **阅读速度过快**: 中文字幕阅读速度超过 5 字/秒")
            lines.append("6. **时间轴重叠**: 相邻字幕时间重叠超过 0.1 秒")
            lines.append("")
            
            # 偏移说明
            lines.append("### 4.2 偏移操作说明")
            lines.append("")
            lines.append("- **全局偏移**: 应用于所有字幕的时间调整")
            lines.append("- **批量偏移**: 应用于指定范围内字幕的时间调整")
            lines.append("- **单条偏移**: 应用于单条字幕的时间调整")
            lines.append("")
            
            content = '\n'.join(lines)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            result['success'] = True
            result['message'] = f'成功导出 Markdown 报告到 {file_path}'
            
        except Exception as e:
            result['message'] = f'导出失败: {e}'
        
        return result


class CSVIssueExporter(Exporter):
    """CSV 问题清单导出器"""
    
    @classmethod
    def export(
        cls,
        issues: List[Issue],
        file_path: str,
        include_resolved: bool = False,
        encoding: str = 'utf-8'
    ) -> Dict[str, Any]:
        """导出问题清单为 CSV 格式"""
        result = {
            'success': False,
            'file_path': file_path,
            'issue_count': len(issues),
            'message': ''
        }
        
        try:
            cls.ensure_dir(file_path)
            
            # 过滤问题
            filtered_issues = [
                i for i in issues 
                if not i.resolved or include_resolved
            ]
            
            with open(file_path, 'w', encoding=encoding, newline='') as f:
                fieldnames = [
                    '序号', '问题类型', '严重程度', '字幕索引', '开始时间',
                    '结束时间', '问题描述', '建议修复', '是否已解决', '解决备注'
                ]
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                
                for idx, issue in enumerate(filtered_issues, 1):
                    writer.writerow({
                        '序号': idx,
                        '问题类型': issue.issue_type.value,
                        '严重程度': issue.severity.value,
                        '字幕索引': issue.subtitle_index if issue.subtitle_index else '',
                        '开始时间': str(issue.start_time) if issue.start_time else '',
                        '结束时间': str(issue.end_time) if issue.end_time else '',
                        '问题描述': issue.description,
                        '建议修复': issue.suggested_fix,
                        '是否已解决': '是' if issue.resolved else '否',
                        '解决备注': issue.resolution_note
                    })
            
            result['success'] = True
            result['issue_count'] = len(filtered_issues)
            result['message'] = f'成功导出 {len(filtered_issues)} 个问题到 {file_path}'
            
        except Exception as e:
            result['message'] = f'导出失败: {e}'
        
        return result


class BatchExporter:
    """批量导出器"""
    
    @classmethod
    def export_all(
        cls,
        project: CalibrationProject,
        output_dir: str,
        base_name: str = "calibration"
    ) -> Dict[str, Any]:
        """批量导出所有格式"""
        results = {
            'success': True,
            'output_dir': output_dir,
            'exports': [],
            'errors': []
        }
        
        # 确保输出目录存在
        os.makedirs(output_dir, exist_ok=True)
        
        # 1. 导出 SRT
        srt_path = os.path.join(output_dir, f"{base_name}.srt")
        srt_result = SRTExporter.export(project.subtitles, srt_path)
        results['exports'].append(srt_result)
        if not srt_result['success']:
            results['success'] = False
            results['errors'].append(srt_result['message'])
        
        # 2. 导出 Markdown 报告
        md_path = os.path.join(output_dir, f"{base_name}_report.md")
        md_result = MarkdownReportExporter.export(project, md_path)
        results['exports'].append(md_result)
        if not md_result['success']:
            results['success'] = False
            results['errors'].append(md_result['message'])
        
        # 3. 导出问题清单 CSV
        csv_path = os.path.join(output_dir, f"{base_name}_issues.csv")
        csv_result = CSVIssueExporter.export(project.issues, csv_path)
        results['exports'].append(csv_result)
        if not csv_result['success']:
            results['success'] = False
            results['errors'].append(csv_result['message'])
        
        return results
