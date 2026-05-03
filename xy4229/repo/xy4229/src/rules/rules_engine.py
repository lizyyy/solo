"""规则引擎 - 字幕无障碍检查"""
from datetime import timedelta
from typing import List, Optional, Dict, Any, Tuple
import re

from src.models.models import (
    Subtitle, TimecodeEntry, AudioAnnotation, FeedbackRecord,
    Issue, IssueType, IssueSeverity, CalibrationProject
)


class RulesConfig:
    """规则配置"""
    
    # 字幕延迟阈值（秒）- 字幕应该在说话前多久出现
    SUBTITLE_DELAY_THRESHOLD_POSITIVE = 0.5  # 字幕比语音晚超过0.5秒
    SUBTITLE_DELAY_THRESHOLD_NEGATIVE = 2.0  # 字幕比语音早超过2秒
    
    # 阅读速度阈值（字/秒）
    MAX_READING_SPEED = 5.0  # 中文每秒不超过5字
    MIN_DURATION_PER_LINE = 1.5  # 每行最少显示时间（秒）
    
    # 时间重叠阈值
    OVERLAP_THRESHOLD = 0.1  # 允许的最小重叠时间（秒）
    
    # 说话人标注配置
    SPEAKER_REQUIRED_FOR_DIALOGUE = True
    SPEAKER_PATTERNS = [
        r'^[^\[\]【】()：:]+[：:]\s*',  # 张三: 或 张三：
        r'^\[([^\]]+)\]',  # [张三]
        r'^【([^】]+)】',  # 【张三】
    ]


class RulesEngine:
    """规则引擎主类"""
    
    def __init__(self, config: Optional[RulesConfig] = None):
        self.config = config or RulesConfig()
    
    def check_all(self, project: CalibrationProject) -> List[Issue]:
        """执行所有检查"""
        issues = []
        
        # 1. 检查字幕延迟/过早
        issues.extend(self.check_subtitle_timing(project))
        
        # 2. 检查说话人漏标
        issues.extend(self.check_speaker_missing(project))
        
        # 3. 检查音效提示缺失
        issues.extend(self.check_sound_effect_missing(project))
        
        # 4. 检查阅读速度过快
        issues.extend(self.check_reading_speed(project))
        
        # 5. 检查时间轴重叠
        issues.extend(self.check_timeline_overlap(project))
        
        # 按开始时间排序
        issues.sort(key=lambda x: x.start_time or timedelta(0))
        
        return issues
    
    def check_subtitle_timing(self, project: CalibrationProject) -> List[Issue]:
        """检查字幕时间是否与视频时间码匹配"""
        issues = []
        
        subtitles = project.subtitles
        timecodes = project.timecodes
        
        if not timecodes:
            return issues
        
        # 为每个字幕查找最近的时间码
        for sub in subtitles:
            # 查找与字幕开始时间最接近的时间码
            closest_tc = None
            min_diff = None
            
            for tc in timecodes:
                diff = abs(sub.start_time - tc.timecode)
                if min_diff is None or diff < min_diff:
                    min_diff = diff
                    closest_tc = tc
            
            if closest_tc is None:
                continue
            
            # 计算字幕与时间码的差异
            time_diff = (sub.start_time - closest_tc.timecode).total_seconds()
            
            # 字幕过晚（延迟）
            if time_diff > self.config.SUBTITLE_DELAY_THRESHOLD_POSITIVE:
                severity = IssueSeverity.MEDIUM
                if time_diff > 1.0:
                    severity = IssueSeverity.HIGH
                if time_diff > 2.0:
                    severity = IssueSeverity.CRITICAL
                
                issues.append(Issue(
                    issue_type=IssueType.SUBTITLE_DELAY,
                    subtitle_index=sub.index,
                    start_time=sub.start_time,
                    end_time=sub.end_time,
                    severity=severity,
                    description=f"字幕延迟 {time_diff:.2f} 秒。字幕开始于 {sub.start_time}，对应视频时间码在 {closest_tc.timecode} ({closest_tc.description})",
                    suggested_fix=f"建议将字幕提前 {time_diff:.2f} 秒，或调整时间码位置"
                ))
            
            # 字幕过早
            elif time_diff < -self.config.SUBTITLE_DELAY_THRESHOLD_NEGATIVE:
                early_seconds = abs(time_diff)
                severity = IssueSeverity.LOW
                if early_seconds > 3.0:
                    severity = IssueSeverity.MEDIUM
                
                issues.append(Issue(
                    issue_type=IssueType.SUBTITLE_TOO_EARLY,
                    subtitle_index=sub.index,
                    start_time=sub.start_time,
                    end_time=sub.end_time,
                    severity=severity,
                    description=f"字幕过早 {early_seconds:.2f} 秒。字幕开始于 {sub.start_time}，对应视频时间码在 {closest_tc.timecode}",
                    suggested_fix=f"建议将字幕延后 {early_seconds:.2f} 秒"
                ))
        
        return issues
    
    def check_speaker_missing(self, project: CalibrationProject) -> List[Issue]:
        """检查说话人漏标"""
        issues = []
        
        subtitles = project.subtitles
        
        for sub in subtitles:
            # 跳过音效提示字幕
            if sub.sound_effect:
                continue
            
            # 检查是否有说话人标注
            if sub.speaker is None:
                # 进一步检查文本是否是对话
                # 对话通常不含特殊符号，且是完整句子
                text = sub.text.strip()
                
                # 跳过纯音效格式的文本
                if re.match(r'^[\[【(].*?[\]】)]$', text):
                    continue
                
                # 检查是否是对话内容（不是纯符号或数字）
                if len(text) > 2 and not text.isdigit():
                    issues.append(Issue(
                        issue_type=IssueType.SPEAKER_MISSING,
                        subtitle_index=sub.index,
                        start_time=sub.start_time,
                        end_time=sub.end_time,
                        severity=IssueSeverity.MEDIUM,
                        description=f"字幕 #{sub.index} 缺少说话人标注。文本：{text[:30]}{'...' if len(text) > 30 else ''}",
                        suggested_fix=f"建议添加说话人标注，例如：[说话人] 或 说话人："
                    ))
        
        return issues
    
    def check_sound_effect_missing(self, project: CalibrationProject) -> List[Issue]:
        """检查音效提示缺失"""
        issues = []
        
        audio_annotations = project.audio_annotations
        subtitles = project.subtitles
        
        if not audio_annotations:
            return issues
        
        # 对每个音频标注，检查是否有对应的音效字幕
        for ann in audio_annotations:
            # 只检查需要提示的音效类型
            if ann.sound_type not in ['effect', 'music', 'ambient']:
                continue
            
            # 跳过静音
            if ann.sound_type == 'silence':
                continue
            
            # 查找是否有字幕覆盖此音效时间段
            has_effect_subtitle = False
            
            for sub in subtitles:
                # 检查是否是音效字幕
                if sub.sound_effect:
                    # 检查时间是否重叠
                    overlap_start = max(sub.start_time, ann.start_time)
                    overlap_end = min(sub.end_time, ann.end_time)
                    
                    if overlap_start < overlap_end:
                        has_effect_subtitle = True
                        break
            
            if not has_effect_subtitle:
                # 计算严重程度
                severity = IssueSeverity.LOW
                if ann.volume == 'loud':
                    severity = IssueSeverity.MEDIUM
                if ann.volume == 'loud' and '爆炸' in ann.description or '枪声' in ann.description:
                    severity = IssueSeverity.HIGH
                
                issues.append(Issue(
                    issue_type=IssueType.SOUND_EFFECT_MISSING,
                    subtitle_index=None,
                    start_time=ann.start_time,
                    end_time=ann.end_time,
                    severity=severity,
                    description=f"音效提示缺失。时间：{ann.start_time} - {ann.end_time}，类型：{ann.sound_type}，描述：{ann.description}",
                    suggested_fix=f"建议添加音效字幕，例如：[{ann.description}]"
                ))
        
        return issues
    
    def check_reading_speed(self, project: CalibrationProject) -> List[Issue]:
        """检查阅读速度是否过快"""
        issues = []
        
        subtitles = project.subtitles
        
        for sub in subtitles:
            duration_seconds = sub.duration.total_seconds()
            
            if duration_seconds <= 0:
                continue
            
            # 计算阅读速度（字/秒）
            reading_speed = sub.reading_speed
            
            # 检查是否超过阈值
            if reading_speed > self.config.MAX_READING_SPEED:
                # 计算需要的额外时间
                needed_seconds = sub.word_count / self.config.MAX_READING_SPEED
                extra_needed = needed_seconds - duration_seconds
                
                severity = IssueSeverity.MEDIUM
                if reading_speed > 8.0:
                    severity = IssueSeverity.HIGH
                if reading_speed > 10.0:
                    severity = IssueSeverity.CRITICAL
                
                issues.append(Issue(
                    issue_type=IssueType.READING_SPEED_TOO_FAST,
                    subtitle_index=sub.index,
                    start_time=sub.start_time,
                    end_time=sub.end_time,
                    severity=severity,
                    description=f"阅读速度过快：{reading_speed:.1f} 字/秒（建议不超过 {self.config.MAX_READING_SPEED}）。"
                               f"字幕 #{sub.index} 有 {sub.word_count} 字，显示时间 {duration_seconds:.2f} 秒。"
                               f"文本：{sub.text[:40]}{'...' if len(sub.text) > 40 else ''}",
                    suggested_fix=f"建议延长显示时间约 {extra_needed:.2f} 秒，或拆分字幕"
                ))
            
            # 检查每行最少显示时间
            lines = sub.text.split('\n')
            min_needed = len(lines) * self.config.MIN_DURATION_PER_LINE
            
            if duration_seconds < min_needed:
                issues.append(Issue(
                    issue_type=IssueType.READING_SPEED_TOO_FAST,
                    subtitle_index=sub.index,
                    start_time=sub.start_time,
                    end_time=sub.end_time,
                    severity=IssueSeverity.MEDIUM,
                    description=f"显示时间不足：{duration_seconds:.2f} 秒（{len(lines)} 行建议至少 {min_needed:.1f} 秒）",
                    suggested_fix=f"建议延长显示时间约 {min_needed - duration_seconds:.2f} 秒"
                ))
        
        return issues
    
    def check_timeline_overlap(self, project: CalibrationProject) -> List[Issue]:
        """检查时间轴重叠"""
        issues = []
        
        subtitles = project.subtitles
        
        # 按开始时间排序
        sorted_subs = sorted(subtitles, key=lambda s: s.start_time)
        
        for i in range(len(sorted_subs) - 1):
            current = sorted_subs[i]
            next_sub = sorted_subs[i + 1]
            
            # 检查是否重叠
            if current.end_time > next_sub.start_time:
                overlap = (current.end_time - next_sub.start_time).total_seconds()
                
                if overlap > self.config.OVERLAP_THRESHOLD:
                    severity = IssueSeverity.LOW
                    if overlap > 0.5:
                        severity = IssueSeverity.MEDIUM
                    if overlap > 1.0:
                        severity = IssueSeverity.HIGH
                    
                    issues.append(Issue(
                        issue_type=IssueType.TIMELINE_OVERLAP,
                        subtitle_index=current.index,
                        start_time=current.start_time,
                        end_time=next_sub.end_time,
                        severity=severity,
                        description=f"时间轴重叠：字幕 #{current.index} 与 #{next_sub.index} 重叠 {overlap:.2f} 秒。"
                                   f"字幕 #{current.index}：{current.start_time} - {current.end_time}"
                                   f"字幕 #{next_sub.index}：{next_sub.start_time} - {next_sub.end_time}",
                        suggested_fix=f"建议调整时间轴，避免重叠。可提前结束前一字幕或延后开始后一字幕"
                    ))
        
        return issues
