"""偏移计算模块"""
from datetime import timedelta
from typing import List, Optional, Tuple, Dict
from collections import defaultdict

from src.models.models import (
    Subtitle, TimecodeEntry, AudioAnnotation, FeedbackRecord,
    Issue, IssueType, CalibrationProject
)


class OffsetCalculator:
    """偏移计算器"""
    
    @staticmethod
    def calculate_global_offset_by_timecodes(
        subtitles: List[Subtitle],
        timecodes: List[TimecodeEntry]
    ) -> Tuple[Optional[timedelta], float]:
        """
        根据视频时间码计算全局偏移
        返回: (建议偏移量, 置信度 0-1)
        """
        if not subtitles or not timecodes:
            return None, 0.0
        
        # 收集匹配点
        matches = []
        
        for sub in subtitles:
            # 查找与字幕最接近的时间码
            for tc in timecodes:
                # 只考虑对话类型的时间码
                if tc.scene_type not in ['dialogue', 'action']:
                    continue
                
                time_diff = (sub.start_time - tc.timecode).total_seconds()
                
                # 只考虑合理范围内的差异（±10秒）
                if -10 <= time_diff <= 10:
                    matches.append(time_diff)
        
        if not matches:
            return None, 0.0
        
        # 计算中位数（更鲁棒）
        matches.sort()
        median = matches[len(matches) // 2]
        
        # 计算置信度（基于匹配点数量和一致性）
        variance = sum((x - median) ** 2 for x in matches) / len(matches)
        std_dev = variance ** 0.5
        
        confidence = max(0.0, min(1.0, 1.0 - (std_dev / 2.0)))
        confidence = min(confidence, len(matches) / 20.0)  # 至少需要20个匹配点才有高置信度
        
        return timedelta(seconds=-median), confidence
    
    @staticmethod
    def calculate_offset_by_feedback(
        feedback_records: List[FeedbackRecord]
    ) -> Tuple[Optional[timedelta], Dict[str, int]]:
        """
        根据反馈记录计算偏移
        返回: (建议偏移量, 各类型反馈计数)
        """
        if not feedback_records:
            return None, {}
        
        # 统计各类型反馈
        feedback_counts = defaultdict(int)
        delay_feedbacks = []
        
        for fb in feedback_records:
            feedback_counts[fb.issue_type] += 1
            
            # 延迟相关反馈
            if '延迟' in fb.issue_type or 'delay' in fb.issue_type.lower():
                # 尝试从描述中提取时间
                import re
                time_match = re.search(r'(\d+\.?\d*)\s*秒', fb.description)
                if time_match:
                    seconds = float(time_match.group(1))
                    delay_feedbacks.append(seconds)
        
        # 计算平均延迟
        if delay_feedbacks:
            avg_delay = sum(delay_feedbacks) / len(delay_feedbacks)
            return timedelta(seconds=-avg_delay), dict(feedback_counts)
        
        return None, dict(feedback_counts)
    
    @staticmethod
    def calculate_batch_offset(
        subtitles: List[Subtitle],
        start_index: int,
        end_index: int,
        offset: timedelta
    ) -> List[Tuple[int, timedelta]]:
        """
        计算批量偏移应用范围
        返回: [(字幕索引, 偏移量), ...]
        """
        result = []
        
        for sub in subtitles:
            if start_index <= sub.index <= end_index:
                result.append((sub.index, offset))
        
        return result
    
    @staticmethod
    def suggest_offset_by_issue(issue: Issue) -> Optional[timedelta]:
        """
        根据单个问题建议偏移
        """
        if issue.issue_type == IssueType.SUBTITLE_DELAY:
            # 字幕延迟，需要提前
            import re
            time_match = re.search(r'(\d+\.?\d*)\s*秒', issue.description)
            if time_match:
                seconds = float(time_match.group(1))
                return timedelta(seconds=-seconds)
            return timedelta(seconds=-0.5)  # 默认提前0.5秒
        
        elif issue.issue_type == IssueType.SUBTITLE_TOO_EARLY:
            # 字幕过早，需要延后
            import re
            time_match = re.search(r'(\d+\.?\d*)\s*秒', issue.description)
            if time_match:
                seconds = float(time_match.group(1))
                return timedelta(seconds=seconds)
            return timedelta(seconds=0.5)  # 默认延后0.5秒
        
        return None
    
    @staticmethod
    def validate_offset(
        subtitles: List[Subtitle],
        offset: timedelta,
        check_overlap: bool = True
    ) -> Dict[str, any]:
        """
        验证偏移是否会导致问题
        返回: {'valid': bool, 'warnings': List[str], 'new_overlaps': int}
        """
        warnings = []
        new_overlaps = 0
        
        # 应用偏移到临时副本
        temp_subs = []
        for sub in subtitles:
            new_start = sub.start_time + offset
            new_end = sub.end_time + offset
            
            # 检查时间是否为负
            if new_start.total_seconds() < 0:
                warnings.append(f"字幕 #{sub.index} 开始时间将为负数: {new_start}")
            
            temp_subs.append({
                'index': sub.index,
                'start': new_start,
                'end': new_end
            })
        
        # 检查是否会产生新的重叠
        if check_overlap:
            temp_subs.sort(key=lambda x: x['start'])
            for i in range(len(temp_subs) - 1):
                current = temp_subs[i]
                next_sub = temp_subs[i + 1]
                
                if current['end'] > next_sub['start']:
                    overlap = (current['end'] - next_sub['start']).total_seconds()
                    if overlap > 0.1:
                        new_overlaps += 1
                        warnings.append(
                            f"偏移后字幕 #{current['index']} 与 #{next_sub['index']} 将重叠 {overlap:.2f} 秒"
                        )
        
        return {
            'valid': len(warnings) == 0,
            'warnings': warnings,
            'new_overlaps': new_overlaps
        }


class OffsetManager:
    """偏移管理器"""
    
    def __init__(self, project: CalibrationProject):
        self.project = project
        self.offset_history: List[Dict] = []  # 历史记录
    
    def apply_global_offset(self, offset: timedelta, validate: bool = True) -> Dict[str, any]:
        """应用全局偏移"""
        if validate:
            validation = OffsetCalculator.validate_offset(
                self.project.subtitles, offset
            )
            if not validation['valid']:
                return {
                    'success': False,
                    'warnings': validation['warnings'],
                    'message': '偏移验证失败'
                }
        
        # 记录历史
        self.offset_history.append({
            'type': 'global',
            'offset_seconds': offset.total_seconds(),
            'timestamp': __import__('datetime').datetime.now().isoformat()
        })
        
        # 应用偏移
        self.project.apply_global_offset(self.project.global_offset + offset)
        
        return {
            'success': True,
            'new_offset': self.project.global_offset,
            'message': f'已应用全局偏移 {offset.total_seconds():.3f} 秒'
        }
    
    def apply_batch_offset(
        self,
        start_index: int,
        end_index: int,
        offset: timedelta
    ) -> Dict[str, any]:
        """应用批量偏移"""
        affected = 0
        
        for sub in self.project.subtitles:
            if start_index <= sub.index <= end_index:
                sub.apply_offset(offset)
                affected += 1
        
        # 记录历史
        self.offset_history.append({
            'type': 'batch',
            'start_index': start_index,
            'end_index': end_index,
            'offset_seconds': offset.total_seconds(),
            'affected_count': affected,
            'timestamp': __import__('datetime').datetime.now().isoformat()
        })
        
        return {
            'success': True,
            'affected_count': affected,
            'message': f'已对 {affected} 条字幕应用偏移 {offset.total_seconds():.3f} 秒'
        }
    
    def apply_single_offset(
        self,
        subtitle_index: int,
        offset: timedelta
    ) -> Dict[str, any]:
        """应用单条字幕偏移"""
        sub = self.project.get_subtitle_by_index(subtitle_index)
        
        if sub is None:
            return {
                'success': False,
                'message': f'未找到字幕 #{subtitle_index}'
            }
        
        sub.apply_offset(offset)
        
        # 记录历史
        self.offset_history.append({
            'type': 'single',
            'subtitle_index': subtitle_index,
            'offset_seconds': offset.total_seconds(),
            'timestamp': __import__('datetime').datetime.now().isoformat()
        })
        
        return {
            'success': True,
            'new_start': sub.start_time,
            'new_end': sub.end_time,
            'message': f'已对字幕 #{subtitle_index} 应用偏移 {offset.total_seconds():.3f} 秒'
        }
    
    def suggest_auto_offset(self) -> Dict[str, any]:
        """自动建议偏移"""
        suggestions = []
        
        # 1. 基于时间码的建议
        timecode_offset, confidence = OffsetCalculator.calculate_global_offset_by_timecodes(
            self.project.subtitles,
            self.project.timecodes
        )
        
        if timecode_offset:
            suggestions.append({
                'source': 'timecode',
                'offset': timecode_offset,
                'confidence': confidence,
                'description': f'基于视频时间码分析，建议偏移 {timecode_offset.total_seconds():.3f} 秒（置信度: {confidence:.0%}）'
            })
        
        # 2. 基于反馈的建议
        feedback_offset, feedback_counts = OffsetCalculator.calculate_offset_by_feedback(
            self.project.feedback_records
        )
        
        if feedback_offset:
            suggestions.append({
                'source': 'feedback',
                'offset': feedback_offset,
                'feedback_counts': feedback_counts,
                'description': f'基于观众反馈，建议偏移 {feedback_offset.total_seconds():.3f} 秒'
            })
        
        # 3. 基于问题的建议
        for issue in self.project.issues:
            if issue.resolved:
                continue
            
            suggested = OffsetCalculator.suggest_offset_by_issue(issue)
            if suggested:
                suggestions.append({
                    'source': 'issue',
                    'issue_index': self.project.issues.index(issue) + 1,
                    'subtitle_index': issue.subtitle_index,
                    'offset': suggested,
                    'description': f'基于问题 "{issue.issue_type.value}"，建议对字幕 #{issue.subtitle_index} 应用偏移 {suggested.total_seconds():.3f} 秒'
                })
        
        return {
            'suggestions': suggestions,
            'count': len(suggestions)
        }
