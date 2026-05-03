#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
规则引擎模块
实现字幕质量检查规则：
- 重叠时间检查
- 每秒字数过高检查
- 空字幕检查
- 说话人缺失检查
- 敏感词命中检查
"""

import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

from .parser import SubtitleItem, Segment, QAConfig


class IssueType(Enum):
    """问题类型枚举"""
    TIME_OVERLAP = "time_overlap"
    HIGH_CHARS_PER_SECOND = "high_chars_per_second"
    EMPTY_SUBTITLE = "empty_subtitle"
    SPEAKER_MISSING = "speaker_missing"
    SENSITIVE_WORD = "sensitive_word"
    SHORT_DURATION = "short_duration"


class IssueSeverity(Enum):
    """问题严重程度枚举"""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class Issue:
    """问题数据结构"""
    issue_type: IssueType
    severity: IssueSeverity
    subtitle_index: int
    subtitle_text: str
    start_time: float
    end_time: float
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    speaker: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式，用于导出"""
        return {
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "subtitle_index": self.subtitle_index,
            "subtitle_text": self.subtitle_text,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "start_time_str": self._format_time(self.start_time),
            "end_time_str": self._format_time(self.end_time),
            "duration": round(self.end_time - self.start_time, 3),
            "message": self.message,
            "details": self.details,
            "speaker": self.speaker
        }
    
    @staticmethod
    def _format_time(seconds: float) -> str:
        """将秒转换为 HH:MM:SS.mmm 格式"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds * 1000) % 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


class RulesEngine:
    """规则引擎 - 执行所有质检规则"""
    
    def __init__(self, config: QAConfig = None):
        self.config = config or QAConfig()
        self.issues: List[Issue] = []
    
    def check_all(self, subtitles: List[SubtitleItem], 
                  segments: List[Segment] = None) -> List[Issue]:
        """
        执行所有检查规则
        """
        self.issues = []
        
        # 执行各项检查
        self._check_time_overlap(subtitles)
        self._check_chars_per_second(subtitles)
        self._check_empty_subtitles(subtitles)
        self._check_short_duration(subtitles)
        
        # 只有在提供了说话人列表时才检查说话人缺失
        if self.config.speakers:
            self._check_speaker_missing(subtitles, segments)
        
        # 只有在提供了敏感词列表时才检查敏感词
        if self.config.sensitive_words:
            self._check_sensitive_words(subtitles)
        
        # 按时间排序问题
        self.issues.sort(key=lambda x: x.start_time)
        
        return self.issues
    
    def _check_time_overlap(self, subtitles: List[SubtitleItem]):
        """
        检查字幕时间重叠
        检测当前字幕开始时间早于上一个字幕结束时间的情况
        """
        for i in range(1, len(subtitles)):
            current = subtitles[i]
            previous = subtitles[i-1]
            
            # 考虑微小的重叠可能是正常的（例如 10ms 以内）
            overlap_threshold = 0.01  # 10ms
            
            if current.start_time < previous.end_time - overlap_threshold:
                overlap_duration = previous.end_time - current.start_time
                
                issue = Issue(
                    issue_type=IssueType.TIME_OVERLAP,
                    severity=IssueSeverity.ERROR,
                    subtitle_index=current.index,
                    subtitle_text=current.text,
                    start_time=current.start_time,
                    end_time=current.end_time,
                    message=f"与前一字幕（序号 {previous.index}）时间重叠 {overlap_duration:.3f} 秒",
                    details={
                        "overlap_duration": round(overlap_duration, 3),
                        "previous_index": previous.index,
                        "previous_start": previous.start_time,
                        "previous_end": previous.end_time,
                        "current_start": current.start_time,
                        "current_end": current.end_time
                    },
                    speaker=current.speaker
                )
                self.issues.append(issue)
    
    def _check_chars_per_second(self, subtitles: List[SubtitleItem]):
        """
        检查每秒字数过高
        计算字幕的字符数除以时长，如果超过阈值则标记为问题
        """
        max_cps = self.config.max_chars_per_second
        
        for subtitle in subtitles:
            duration = subtitle.end_time - subtitle.start_time
            
            # 跳过非常短的字幕，避免除零或不合理的高 CPS
            if duration < 0.1:
                continue
            
            # 计算有效字符数（去除空格、标点等）
            text = subtitle.text
            # 去除 HTML 标签（如果有）
            text = re.sub(r'<[^>]+>', '', text)
            # 去除空格和换行
            clean_text = re.sub(r'[\s\n\r]+', '', text)
            
            char_count = len(clean_text)
            
            if char_count == 0:
                continue
            
            cps = char_count / duration
            
            if cps > max_cps:
                # 计算建议的最小时长
                suggested_duration = char_count / max_cps
                
                issue = Issue(
                    issue_type=IssueType.HIGH_CHARS_PER_SECOND,
                    severity=IssueSeverity.WARNING,
                    subtitle_index=subtitle.index,
                    subtitle_text=subtitle.text,
                    start_time=subtitle.start_time,
                    end_time=subtitle.end_time,
                    message=f"每秒字符数 {cps:.2f} 超过阈值 {max_cps}，建议时长至少 {suggested_duration:.2f} 秒",
                    details={
                        "char_count": char_count,
                        "duration": round(duration, 3),
                        "cps": round(cps, 2),
                        "max_cps": max_cps,
                        "suggested_duration": round(suggested_duration, 2)
                    },
                    speaker=subtitle.speaker
                )
                self.issues.append(issue)
    
    def _check_empty_subtitles(self, subtitles: List[SubtitleItem]):
        """
        检查空字幕
        检测文本为空或仅包含空格/换行的字幕
        """
        for subtitle in subtitles:
            text = subtitle.text.strip()
            
            # 检查是否为空或仅包含无意义字符
            if not text:
                issue = Issue(
                    issue_type=IssueType.EMPTY_SUBTITLE,
                    severity=IssueSeverity.ERROR,
                    subtitle_index=subtitle.index,
                    subtitle_text=subtitle.text,
                    start_time=subtitle.start_time,
                    end_time=subtitle.end_time,
                    message="字幕文本为空",
                    details={
                        "original_text": subtitle.original_text
                    },
                    speaker=subtitle.speaker
                )
                self.issues.append(issue)
    
    def _check_short_duration(self, subtitles: List[SubtitleItem]):
        """
        检查字幕时长过短
        检测时长小于最小阈值的字幕
        """
        min_duration = self.config.min_subtitle_duration
        
        for subtitle in subtitles:
            duration = subtitle.end_time - subtitle.start_time
            
            if duration < min_duration:
                # 跳过空字幕（已在其他规则中检查）
                if not subtitle.text.strip():
                    continue
                
                issue = Issue(
                    issue_type=IssueType.SHORT_DURATION,
                    severity=IssueSeverity.WARNING,
                    subtitle_index=subtitle.index,
                    subtitle_text=subtitle.text,
                    start_time=subtitle.start_time,
                    end_time=subtitle.end_time,
                    message=f"字幕时长 {duration:.3f} 秒小于最小阈值 {min_duration} 秒",
                    details={
                        "duration": round(duration, 3),
                        "min_duration": min_duration
                    },
                    speaker=subtitle.speaker
                )
                self.issues.append(issue)
    
    def _check_speaker_missing(self, subtitles: List[SubtitleItem], 
                                segments: List[Segment] = None):
        """
        检查说话人缺失
        检测字幕中缺少说话人标签，但片段清单中有说话人信息的情况
        或者检测字幕中的说话人不在配置的说话人列表中
        """
        valid_speakers = set(self.config.speakers) if self.config.speakers else set()
        
        # 创建片段ID到说话人的映射（如果有片段清单）
        segment_speakers = {}
        if segments:
            for segment in segments:
                if segment.speaker:
                    segment_speakers[segment.segment_id] = segment.speaker
        
        for subtitle in subtitles:
            subtitle_speaker = subtitle.speaker.strip()
            
            # 情况1：字幕有说话人，但不在有效说话人列表中
            if subtitle_speaker and valid_speakers:
                if subtitle_speaker not in valid_speakers:
                    issue = Issue(
                        issue_type=IssueType.SPEAKER_MISSING,
                        severity=IssueSeverity.WARNING,
                        subtitle_index=subtitle.index,
                        subtitle_text=subtitle.text,
                        start_time=subtitle.start_time,
                        end_time=subtitle.end_time,
                        message=f"说话人 '{subtitle_speaker}' 不在有效说话人列表中",
                        details={
                            "subtitle_speaker": subtitle_speaker,
                            "valid_speakers": list(valid_speakers)
                        },
                        speaker=subtitle_speaker
                    )
                    self.issues.append(issue)
            
            # 情况2：字幕没有说话人，但片段清单中有说话人
            if not subtitle_speaker and segments:
                # 查找时间重叠的片段
                matching_segment = self._find_matching_segment(subtitle, segments)
                if matching_segment and matching_segment.speaker:
                    issue = Issue(
                        issue_type=IssueType.SPEAKER_MISSING,
                        severity=IssueSeverity.INFO,
                        subtitle_index=subtitle.index,
                        subtitle_text=subtitle.text,
                        start_time=subtitle.start_time,
                        end_time=subtitle.end_time,
                        message=f"字幕缺少说话人标签，片段清单中对应说话人为 '{matching_segment.speaker}'",
                        details={
                            "segment_id": matching_segment.segment_id,
                            "segment_speaker": matching_segment.speaker,
                            "segment_start": matching_segment.start_time,
                            "segment_end": matching_segment.end_time
                        },
                        speaker=""
                    )
                    self.issues.append(issue)
    
    def _check_sensitive_words(self, subtitles: List[SubtitleItem]):
        """
        检查敏感词命中
        检测字幕文本中包含配置的敏感词
        """
        sensitive_words = self.config.sensitive_words
        
        if not sensitive_words:
            return
        
        for subtitle in subtitles:
            text = subtitle.text.lower()
            original_text = subtitle.original_text
            
            for word in sensitive_words:
                word_lower = word.lower()
                # 使用单词边界匹配，避免部分匹配
                # 对于中文，直接包含匹配
                if word_lower in text:
                    # 找到所有匹配位置
                    matches = [m.start() for m in re.finditer(re.escape(word_lower), text)]
                    
                    issue = Issue(
                        issue_type=IssueType.SENSITIVE_WORD,
                        severity=IssueSeverity.ERROR,
                        subtitle_index=subtitle.index,
                        subtitle_text=subtitle.text,
                        start_time=subtitle.start_time,
                        end_time=subtitle.end_time,
                        message=f"包含敏感词 '{word}'，出现 {len(matches)} 次",
                        details={
                            "sensitive_word": word,
                            "match_count": len(matches),
                            "match_positions": matches,
                            "original_text": original_text
                        },
                        speaker=subtitle.speaker
                    )
                    self.issues.append(issue)
    
    def _find_matching_segment(self, subtitle: SubtitleItem, 
                                segments: List[Segment]) -> Optional[Segment]:
        """
        查找与字幕时间重叠的片段
        """
        for segment in segments:
            # 检查时间是否重叠
            if (subtitle.start_time < segment.end_time and 
                subtitle.end_time > segment.start_time):
                # 计算重叠比例
                overlap_start = max(subtitle.start_time, segment.start_time)
                overlap_end = min(subtitle.end_time, segment.end_time)
                overlap_duration = overlap_end - overlap_start
                subtitle_duration = subtitle.end_time - subtitle.start_time
                
                if subtitle_duration > 0:
                    overlap_ratio = overlap_duration / subtitle_duration
                    # 如果重叠超过 50%，认为是匹配的
                    if overlap_ratio > 0.5:
                        return segment
        
        return None
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取检查统计信息
        """
        stats = {
            "total_issues": len(self.issues),
            "by_type": {},
            "by_severity": {
                "error": 0,
                "warning": 0,
                "info": 0
            }
        }
        
        # 按类型统计
        for issue_type in IssueType:
            stats["by_type"][issue_type.value] = 0
        
        for issue in self.issues:
            stats["by_type"][issue.issue_type.value] += 1
            stats["by_severity"][issue.severity.value] += 1
        
        return stats
