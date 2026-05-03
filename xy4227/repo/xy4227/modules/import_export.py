# 导入导出模块
# 负责导出脱敏 SRT、剪辑决策清单 CSV 和 Markdown 报告

import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

from .models import (
    SubtitleEntry,
    RiskMarker,
    RiskFragment,
    RiskLevel,
    RiskType,
    ReviewStatus,
    SpeakerPermission,
    ProjectState
)
from .parser import SRTParser


class RedactionProcessor:
    """脱敏处理器"""
    
    @staticmethod
    def apply_redactions(subtitle: SubtitleEntry, markers: List[RiskMarker]) -> Tuple[str, List[Dict]]:
        """
        对字幕应用脱敏
        
        Args:
            subtitle: 字幕条目
            markers: 风险标记列表（过滤后的已批准标记）
            
        Returns:
            (脱敏后的文本, 应用的脱敏记录列表)
        """
        text = subtitle.text
        redactions = []
        
        # 过滤出适用于当前字幕的标记
        relevant_markers = [m for m in markers if m.subtitle_id == subtitle.id]
        
        # 只处理已批准或已修改的标记
        approved_markers = [
            m for m in relevant_markers 
            if m.review_status in (ReviewStatus.APPROVED, ReviewStatus.MODIFIED)
        ]
        
        if not approved_markers:
            return text, []
        
        # 按起始位置从后往前处理（避免索引偏移）
        approved_markers.sort(key=lambda m: m.start_index, reverse=True)
        
        for marker in approved_markers:
            # 确定替换文本
            if marker.review_status == ReviewStatus.MODIFIED and marker.custom_replacement:
                replacement = marker.custom_replacement
            else:
                replacement = marker.suggested_replacement
            
            # 记录脱敏信息
            redaction_record = {
                'marker_id': marker.id,
                'original': marker.risk_text,
                'replacement': replacement,
                'start_index': marker.start_index,
                'end_index': marker.end_index,
                'risk_type': marker.risk_type.value,
                'risk_level': marker.risk_level.value,
            }
            redactions.append(redaction_record)
            
            # 应用替换
            text = text[:marker.start_index] + replacement + text[marker.end_index:]
        
        # 反转记录顺序（因为我们是从后往前处理的）
        redactions.reverse()
        
        return text, redactions
    
    @classmethod
    def redact_all_subtitles(cls, 
                              subtitles: List[SubtitleEntry], 
                              markers: List[RiskMarker]) -> Tuple[List[SubtitleEntry], List[Dict]]:
        """
        对所有字幕应用脱敏
        
        Returns:
            (脱敏后的字幕列表, 所有脱敏记录列表)
        """
        redacted_subtitles = []
        all_redactions = []
        
        for subtitle in subtitles:
            redacted_text, redactions = cls.apply_redactions(subtitle, markers)
            
            # 创建新的字幕条目
            redacted_subtitle = SubtitleEntry(
                id=subtitle.id,
                start_time=subtitle.start_time,
                end_time=subtitle.end_time,
                text=redacted_text,
                speaker=subtitle.speaker,
                notes=subtitle.notes
            )
            
            redacted_subtitles.append(redacted_subtitle)
            
            if redactions:
                all_redactions.extend(redactions)
        
        return redacted_subtitles, all_redactions


class SRTExporter:
    """SRT 导出器"""
    
    @staticmethod
    def export_redacted(subtitles: List[SubtitleEntry],
                        markers: List[RiskMarker],
                        output_path: str,
                        include_comments: bool = True) -> str:
        """
        导出脱敏后的 SRT
        
        Args:
            subtitles: 原始字幕列表
            markers: 风险标记列表
            output_path: 输出文件路径
            include_comments: 是否包含注释（脱敏说明）
            
        Returns:
            实际输出文件路径
        """
        # 应用脱敏
        processor = RedactionProcessor()
        redacted_subtitles, redactions = processor.redact_all_subtitles(subtitles, markers)
        
        # 转换为 SRT 格式
        srt_content = SRTParser.to_string(redacted_subtitles)
        
        # 添加文件头注释
        if include_comments:
            header = f"""<!--
脱敏 SRT 导出
生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
原始字幕数: {len(subtitles)}
应用脱敏: {len(redactions)} 处
-->

"""
            srt_content = header + srt_content
        
        # 写入文件
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output, 'w', encoding='utf-8') as f:
            f.write(srt_content)
        
        return str(output)
    
    @staticmethod
    def export_original(subtitles: List[SubtitleEntry], output_path: str) -> str:
        """
        导出原始 SRT（用于对比）
        
        Args:
            subtitles: 字幕列表
            output_path: 输出文件路径
            
        Returns:
            实际输出文件路径
        """
        srt_content = SRTParser.to_string(subtitles)
        
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output, 'w', encoding='utf-8') as f:
            f.write(srt_content)
        
        return str(output)


class CSVExporter:
    """CSV 导出器"""
    
    @staticmethod
    def export_decision_list(markers: List[RiskMarker],
                             subtitles: List[SubtitleEntry],
                             output_path: str,
                             include_all: bool = False) -> str:
        """
        导出剪辑决策清单 CSV
        
        Args:
            markers: 风险标记列表
            subtitles: 字幕列表（用于获取时间信息）
            output_path: 输出文件路径
            include_all: 是否包含所有状态（否则只包含已处理的）
            
        Returns:
            实际输出文件路径
        """
        # 构建字幕ID映射
        subtitle_map = {s.id: s for s in subtitles}
        
        # 过滤标记
        if not include_all:
            markers = [
                m for m in markers 
                if m.review_status != ReviewStatus.PENDING
            ]
        
        # 按字幕ID排序
        markers.sort(key=lambda m: m.subtitle_id)
        
        # 准备行数据
        rows = []
        
        # 表头
        headers = [
            '决策ID',
            '字幕序号',
            '开始时间',
            '结束时间',
            '风险类型',
            '风险等级',
            '原始文本',
            '建议替换',
            '实际替换',
            '决策状态',
            '复核人',
            '复核时间',
            '备注'
        ]
        
        for marker in markers:
            subtitle = subtitle_map.get(marker.subtitle_id)
            
            # 时间格式化
            if subtitle:
                start_time = ImportExport.format_time(subtitle.start_time)
                end_time = ImportExport.format_time(subtitle.end_time)
            else:
                start_time = end_time = ''
            
            # 确定实际替换文本
            if marker.review_status == ReviewStatus.MODIFIED and marker.custom_replacement:
                actual_replacement = marker.custom_replacement
            elif marker.review_status == ReviewStatus.APPROVED:
                actual_replacement = marker.suggested_replacement
            elif marker.review_status == ReviewStatus.REJECTED:
                actual_replacement = '（保留原文）'
            else:
                actual_replacement = ''
            
            # 复核时间格式化
            reviewed_at = marker.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if marker.reviewed_at else ''
            
            row = {
                '决策ID': marker.id,
                '字幕序号': marker.subtitle_id,
                '开始时间': start_time,
                '结束时间': end_time,
                '风险类型': marker.risk_type.value,
                '风险等级': marker.risk_level.value,
                '原始文本': marker.risk_text,
                '建议替换': marker.suggested_replacement,
                '实际替换': actual_replacement,
                '决策状态': marker.review_status.value,
                '复核人': marker.reviewed_by or '',
                '复核时间': reviewed_at,
                '备注': marker.reviewer_notes or ''
            }
            rows.append(row)
        
        # 写入 CSV
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)
        
        return str(output)
    
    @staticmethod
    def export_risk_summary(fragments: List[RiskFragment],
                           markers: List[RiskMarker],
                           output_path: str) -> str:
        """
        导出风险摘要 CSV
        
        Args:
            fragments: 风险片段列表
            markers: 风险标记列表
            output_path: 输出文件路径
            
        Returns:
            实际输出文件路径
        """
        # 统计数据
        level_stats = defaultdict(int)
        type_stats = defaultdict(int)
        status_stats = defaultdict(int)
        
        for marker in markers:
            level_stats[marker.risk_level.value] += 1
            type_stats[marker.risk_type.value] += 1
            status_stats[marker.review_status.value] += 1
        
        # 准备行数据
        rows = []
        
        # 按风险等级统计
        for level, count in sorted(level_stats.items()):
            rows.append({
                '类别': '风险等级',
                '项目': level,
                '数量': count,
                '说明': ''
            })
        
        # 按风险类型统计
        for risk_type, count in sorted(type_stats.items()):
            rows.append({
                '类别': '风险类型',
                '项目': risk_type,
                '数量': count,
                '说明': ''
            })
        
        # 按复核状态统计
        for status, count in sorted(status_stats.items()):
            rows.append({
                '类别': '复核状态',
                '项目': status,
                '数量': count,
                '说明': ''
            })
        
        # 片段统计
        rows.append({
            '类别': '片段统计',
            '项目': '风险片段数',
            '数量': len(fragments),
            '说明': ''
        })
        
        merged_count = sum(1 for f in fragments if f.merged)
        rows.append({
            '类别': '片段统计',
            '项目': '已合并片段数',
            '数量': merged_count,
            '说明': ''
        })
        
        # 写入 CSV
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['类别', '项目', '数量', '说明'])
            writer.writeheader()
            writer.writerows(rows)
        
        return str(output)


class MarkdownReportExporter:
    """Markdown 报告导出器"""
    
    @staticmethod
    def _format_time(seconds: float) -> str:
        """格式化时间为 HH:MM:SS 格式"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        milliseconds = int((seconds - int(seconds)) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    
    @staticmethod
    def _get_risk_level_color(level: RiskLevel) -> str:
        """获取风险等级对应的颜色指示"""
        colors = {
            RiskLevel.CRITICAL: '🔴',
            RiskLevel.HIGH: '🟠',
            RiskLevel.MEDIUM: '🟡',
            RiskLevel.LOW: '🟢',
        }
        return colors.get(level, '⚪')
    
    @staticmethod
    def _get_status_icon(status: ReviewStatus) -> str:
        """获取复核状态图标"""
        icons = {
            ReviewStatus.APPROVED: '✅',
            ReviewStatus.REJECTED: '❌',
            ReviewStatus.MODIFIED: '🔄',
            ReviewStatus.PENDING: '⏳',
        }
        return icons.get(status, '❓')
    
    @classmethod
    def export_report(cls,
                     state: ProjectState,
                     output_path: str,
                     include_fragments: bool = True,
                     include_decisions: bool = True) -> str:
        """
        导出脱敏审核报告
        
        Args:
            state: 项目状态
            output_path: 输出文件路径
            include_fragments: 是否包含风险片段详情
            include_decisions: 是否包含决策详情
            
        Returns:
            实际输出文件路径
        """
        lines = []
        
        # 标题
        lines.append('# 采访素材脱敏审核报告')
        lines.append('')
        
        # 基本信息
        lines.append('## 项目基本信息')
        lines.append('')
        lines.append(f'- **项目名称**: {state.project_name}')
        lines.append(f'- **创建时间**: {state.created_at.strftime("%Y-%m-%d %H:%M:%S")}')
        lines.append(f'- **报告生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        lines.append(f'- **字幕总数**: {len(state.subtitles)}')
        lines.append(f'- **说话人数量**: {len(state.speakers)}')
        lines.append(f'- **敏感词规则数**: {len(state.sensitive_words)}')
        lines.append('')
        
        # 统计摘要
        lines.append('## 风险统计摘要')
        lines.append('')
        
        if state.risk_markers:
            # 按等级统计
            level_stats = defaultdict(int)
            for marker in state.risk_markers:
                level_stats[marker.risk_level.value] += 1
            
            lines.append('### 按风险等级分布')
            lines.append('')
            lines.append('| 风险等级 | 数量 | 图标 |')
            lines.append('|---------|------|------|')
            
            level_order = [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]
            for level in level_order:
                count = level_stats.get(level.value, 0)
                lines.append(f'| {level.value} | {count} | {cls._get_risk_level_color(level)} |')
            lines.append('')
            
            # 按类型统计
            type_stats = defaultdict(int)
            for marker in state.risk_markers:
                type_stats[marker.risk_type.value] += 1
            
            lines.append('### 按风险类型分布')
            lines.append('')
            lines.append('| 风险类型 | 数量 |')
            lines.append('|---------|------|')
            
            for risk_type, count in sorted(type_stats.items()):
                lines.append(f'| {risk_type} | {count} |')
            lines.append('')
            
            # 按复核状态统计
            status_stats = defaultdict(int)
            for marker in state.risk_markers:
                status_stats[marker.review_status.value] += 1
            
            lines.append('### 按复核状态分布')
            lines.append('')
            lines.append('| 复核状态 | 数量 | 图标 |')
            lines.append('|---------|------|------|')
            
            status_order = [ReviewStatus.PENDING, ReviewStatus.APPROVED, ReviewStatus.MODIFIED, ReviewStatus.REJECTED]
            for status in status_order:
                count = status_stats.get(status.value, 0)
                lines.append(f'| {status.value} | {count} | {cls._get_status_icon(status)} |')
            lines.append('')
            
            # 片段统计
            lines.append('### 风险片段统计')
            lines.append('')
            lines.append(f'- **风险片段总数**: {len(state.risk_fragments)}')
            merged_count = sum(1 for f in state.risk_fragments if f.merged)
            lines.append(f'- **已合并片段数**: {merged_count}')
            lines.append('')
        else:
            lines.append('> ✅ 未检测到任何风险内容。')
            lines.append('')
        
        # 风险片段详情
        if include_fragments and state.risk_fragments:
            lines.append('## 风险片段详情')
            lines.append('')
            
            for i, fragment in enumerate(state.risk_fragments, 1):
                lines.append(f'### 片段 {i}: {cls._get_risk_level_color(fragment.highest_risk_level)} {fragment.highest_risk_level.value}级风险')
                lines.append('')
                
                start_time = cls._format_time(fragment.start_time)
                end_time = cls._format_time(fragment.end_time)
                lines.append(f'- **时间范围**: {start_time} --> {end_time}')
                lines.append(f'- **关联字幕**: {fragment.subtitle_ids}')
                lines.append(f'- **包含风险标记数**: {len(fragment.risk_markers)}')
                lines.append(f'- **复核状态**: {cls._get_status_icon(fragment.review_status)} {fragment.review_status.value}')
                if fragment.merged:
                    lines.append(f'- **合并来源**: {fragment.merged_from}')
                lines.append('')
                
                # 列出该片段中的风险标记
                lines.append('**风险标记详情**:')
                lines.append('')
                lines.append('| 风险文本 | 类型 | 等级 | 建议替换 | 状态 |')
                lines.append('|---------|------|------|---------|------|')
                
                for marker in fragment.risk_markers:
                    lines.append(
                        f'| `{marker.risk_text}` | {marker.risk_type.value} | '
                        f'{cls._get_risk_level_color(marker.risk_level)} {marker.risk_level.value} | '
                        f'`{marker.suggested_replacement}` | '
                        f'{cls._get_status_icon(marker.review_status)} {marker.review_status.value} |'
                    )
                lines.append('')
                
                # 显示相关字幕原文
                lines.append('**相关字幕原文**:')
                lines.append('')
                lines.append('```')
                
                subtitle_map = {s.id: s for s in state.subtitles}
                for sub_id in sorted(fragment.subtitle_ids):
                    subtitle = subtitle_map.get(sub_id)
                    if subtitle:
                        st = cls._format_time(subtitle.start_time)
                        et = cls._format_time(subtitle.end_time)
                        lines.append(f'[{sub_id}] {st} --> {et}')
                        lines.append(f'    {subtitle.text}')
                        lines.append('')
                
                lines.append('```')
                lines.append('')
                lines.append('---')
                lines.append('')
        
        # 决策详情
        if include_decisions:
            approved_markers = [
                m for m in state.risk_markers 
                if m.review_status in (ReviewStatus.APPROVED, ReviewStatus.MODIFIED)
            ]
            
            if approved_markers:
                lines.append('## 脱敏决策详情')
                lines.append('')
                
                lines.append('### 已批准的脱敏')
                lines.append('')
                lines.append('| 字幕序号 | 原始文本 | 替换文本 | 风险类型 | 风险等级 | 复核人 | 备注 |')
                lines.append('|---------|---------|---------|---------|---------|--------|------|')
                
                subtitle_map = {s.id: s for s in state.subtitles}
                
                for marker in approved_markers:
                    replacement = (marker.custom_replacement 
                                   if marker.review_status == ReviewStatus.MODIFIED 
                                   else marker.suggested_replacement)
                    
                    lines.append(
                        f'| {marker.subtitle_id} | `{marker.risk_text}` | `{replacement}` | '
                        f'{marker.risk_type.value} | {cls._get_risk_level_color(marker.risk_level)} | '
                        f'{marker.reviewed_by or "系统"} | {marker.reviewer_notes or "-"} |'
                    )
                lines.append('')
            
            rejected_markers = [
                m for m in state.risk_markers 
                if m.review_status == ReviewStatus.REJECTED
            ]
            
            if rejected_markers:
                lines.append('### 已驳回的标记')
                lines.append('')
                lines.append('| 字幕序号 | 标记文本 | 风险类型 | 风险等级 | 驳回原因 |')
                lines.append('|---------|---------|---------|---------|---------|')
                
                for marker in rejected_markers:
                    lines.append(
                        f'| {marker.subtitle_id} | `{marker.risk_text}` | {marker.risk_type.value} | '
                        f'{cls._get_risk_level_color(marker.risk_level)} | {marker.reviewer_notes or "无"} |'
                    )
                lines.append('')
        
        # 说话人权限摘要
        if state.speakers:
            lines.append('## 说话人权限摘要')
            lines.append('')
            lines.append('| 说话人 | 别名 | 权限 | 备注 |')
            lines.append('|-------|------|------|------|')
            
            for speaker in state.speakers:
                alias_text = ', '.join(speaker.alias) if speaker.alias else '-'
                permission_icon = ('✅' if speaker.permission == SpeakerPermission.FULL_AUTHORIZATION 
                                    else '⚠️' if speaker.permission == SpeakerPermission.PARTIAL_AUTHORIZATION
                                    else '❌')
                lines.append(
                    f'| {speaker.name} | {alias_text} | '
                    f'{permission_icon} {speaker.permission.value} | {speaker.notes or "-"} |'
                )
            lines.append('')
        
        # 附录
        lines.append('## 附录')
        lines.append('')
        lines.append('### 风险等级说明')
        lines.append('')
        lines.append('- 🔴 **严重 (CRITICAL)**: 未授权姓名、身份证号等核心隐私信息')
        lines.append('- 🟠 **高 (HIGH)**: 手机号、邮箱、地址等敏感个人信息')
        lines.append('- 🟡 **中 (MEDIUM)**: 公司信息、特定敏感词')
        lines.append('- 🟢 **低 (LOW)**: 一般性敏感词，可根据上下文判断')
        lines.append('')
        
        lines.append('### 复核状态说明')
        lines.append('')
        lines.append('- ✅ **已通过 (APPROVED)**: 接受系统建议的脱敏处理')
        lines.append('- 🔄 **已修改 (MODIFIED)**: 使用自定义替换文本')
        lines.append('- ❌ **已驳回 (REJECTED)**: 认为不是风险，保留原文')
        lines.append('- ⏳ **待复核 (PENDING)**: 尚未进行复核')
        lines.append('')
        
        lines.append('---')
        lines.append('')
        lines.append(f'*报告生成于: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}*')
        
        # 写入文件
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return str(output)


class ImportExport:
    """统一导入导出入口"""
    
    srt_exporter = SRTExporter
    csv_exporter = CSVExporter
    markdown_exporter = MarkdownReportExporter
    redaction_processor = RedactionProcessor
    
    @classmethod
    def export_all(cls,
                   state: ProjectState,
                   output_dir: str,
                   base_name: str = "redacted") -> Dict[str, str]:
        """
        一键导出所有文件
        
        Args:
            state: 项目状态
            output_dir: 输出目录
            base_name: 基础文件名
            
        Returns:
            导出文件路径字典
        """
        output = Path(output_dir)
        output.mkdir(parents=True, exist_ok=True)
        
        results = {}
        
        # 导出脱敏 SRT
        srt_path = str(output / f"{base_name}.srt")
        results['srt'] = cls.srt_exporter.export_redacted(
            state.subtitles,
            state.risk_markers,
            srt_path
        )
        
        # 导出决策清单 CSV
        decisions_path = str(output / f"{base_name}_decisions.csv")
        results['decisions_csv'] = cls.csv_exporter.export_decision_list(
            state.risk_markers,
            state.subtitles,
            decisions_path
        )
        
        # 导出风险摘要 CSV
        summary_path = str(output / f"{base_name}_summary.csv")
        results['summary_csv'] = cls.csv_exporter.export_risk_summary(
            state.risk_fragments,
            state.risk_markers,
            summary_path
        )
        
        # 导出 Markdown 报告
        report_path = str(output / f"{base_name}_report.md")
        results['report'] = cls.markdown_exporter.export_report(
            state,
            report_path
        )
        
        return results
    
    @staticmethod
    def format_time(seconds: float) -> str:
        """格式化时间为 HH:MM:SS,mmm 格式（SRT 标准）"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        milliseconds = int((seconds - int(seconds)) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"
