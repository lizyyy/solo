from datetime import timedelta
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field

from .models import (
    SubtitleItem, Speaker, Chapter,
    ValidationIssue, ValidationResult,
    IssueType, IssueSeverity
)
from .utils import validate_time_order, format_duration


class ValidatorConfig:
    def __init__(
        self,
        max_subtitle_duration: float = 8.0,
        min_subtitle_duration: float = 0.5,
        max_gap_between_subtitles: float = 5.0,
        max_chapter_drift_seconds: float = 30.0,
        require_speaker_label: bool = True,
        allow_speaker_aliases: bool = True
    ):
        self.max_subtitle_duration = timedelta(seconds=max_subtitle_duration)
        self.min_subtitle_duration = timedelta(seconds=min_subtitle_duration)
        self.max_gap_between_subtitles = timedelta(seconds=max_gap_between_subtitles)
        self.max_chapter_drift_seconds = max_chapter_drift_seconds
        self.require_speaker_label = require_speaker_label
        self.allow_speaker_aliases = allow_speaker_aliases


class Validator:
    def __init__(self, config: Optional[ValidatorConfig] = None):
        self.config = config or ValidatorConfig()
        self.speaker_map: Dict[str, Speaker] = {}
    
    def set_speakers(self, speakers: List[Speaker]) -> None:
        self.speaker_map = {}
        for speaker in speakers:
            self.speaker_map[speaker.name.lower()] = speaker
            if self.config.allow_speaker_aliases:
                for alias in speaker.alias:
                    self.speaker_map[alias.lower()] = speaker
    
    def validate_all(
        self,
        subtitles: List[SubtitleItem],
        chapters: Optional[List[Chapter]] = None
    ) -> ValidationResult:
        result = ValidationResult()
        
        self._validate_timecodes(subtitles, result)
        self._validate_time_overlaps(subtitles, result)
        self._validate_subtitle_duration(subtitles, result)
        self._validate_empty_subtitles(subtitles, result)
        self._validate_speakers(subtitles, result)
        self._validate_timeline_gaps(subtitles, result)
        
        if chapters:
            self._validate_chapters(subtitles, chapters, result)
        
        return result
    
    def _validate_timecodes(
        self,
        subtitles: List[SubtitleItem],
        result: ValidationResult
    ) -> None:
        for sub in subtitles:
            if not validate_time_order(sub.start_time, sub.end_time):
                result.add_issue(ValidationIssue(
                    issue_type=IssueType.INVALID_TIMECODE,
                    severity=IssueSeverity.CRITICAL,
                    message=f"字幕 {sub.index} 的开始时间晚于或等于结束时间",
                    subtitle_index=sub.index,
                    time_position=sub.start_time,
                    suggested_fix=f"调整时间轴，当前: {sub.start_time} -> {sub.end_time}",
                    metadata={
                        "start_time": str(sub.start_time),
                        "end_time": str(sub.end_time)
                    }
                ))
            
            if sub.start_time < timedelta(0):
                result.add_issue(ValidationIssue(
                    issue_type=IssueType.INVALID_TIMECODE,
                    severity=IssueSeverity.CRITICAL,
                    message=f"字幕 {sub.index} 的开始时间为负数",
                    subtitle_index=sub.index,
                    time_position=sub.start_time,
                    suggested_fix="将开始时间调整为 00:00:00,000 或之后",
                    metadata={"start_time": str(sub.start_time)}
                ))
    
    def _validate_time_overlaps(
        self,
        subtitles: List[SubtitleItem],
        result: ValidationResult
    ) -> None:
        sorted_subs = sorted(subtitles, key=lambda s: s.start_time)
        
        for i in range(len(sorted_subs) - 1):
            current = sorted_subs[i]
            next_sub = sorted_subs[i + 1]
            
            if current.overlaps_with(next_sub):
                overlap_duration = current.end_time - next_sub.start_time
                if overlap_duration > timedelta(0):
                    result.add_issue(ValidationIssue(
                        issue_type=IssueType.TIME_OVERLAP,
                        severity=IssueSeverity.HIGH,
                        message=f"字幕 {current.index} 和 {next_sub.index} 时间重叠",
                        subtitle_index=current.index,
                        time_position=next_sub.start_time,
                        suggested_fix=f"重叠 {format_duration(overlap_duration)}，建议调整结束或开始时间",
                        metadata={
                            "overlap_with": next_sub.index,
                            "overlap_duration": str(overlap_duration),
                            "current_end": str(current.end_time),
                            "next_start": str(next_sub.start_time)
                        }
                    ))
    
    def _validate_subtitle_duration(
        self,
        subtitles: List[SubtitleItem],
        result: ValidationResult
    ) -> None:
        for sub in subtitles:
            duration = sub.duration
            
            if duration > self.config.max_subtitle_duration:
                result.add_issue(ValidationIssue(
                    issue_type=IssueType.TOO_LONG_SUBTITLE,
                    severity=IssueSeverity.MEDIUM,
                    message=f"字幕 {sub.index} 持续时间过长: {format_duration(duration)}",
                    subtitle_index=sub.index,
                    time_position=sub.start_time,
                    suggested_fix=f"建议拆分为多条字幕，最大建议时长: {format_duration(self.config.max_subtitle_duration)}",
                    metadata={
                        "duration": str(duration),
                        "max_allowed": str(self.config.max_subtitle_duration)
                    }
                ))
            
            if duration < self.config.min_subtitle_duration:
                result.add_issue(ValidationIssue(
                    issue_type=IssueType.INVALID_TIMECODE,
                    severity=IssueSeverity.LOW,
                    message=f"字幕 {sub.index} 持续时间过短: {format_duration(duration)}",
                    subtitle_index=sub.index,
                    time_position=sub.start_time,
                    suggested_fix=f"建议合并或延长，最小建议时长: {format_duration(self.config.min_subtitle_duration)}",
                    metadata={
                        "duration": str(duration),
                        "min_allowed": str(self.config.min_subtitle_duration)
                    }
                ))
    
    def _validate_empty_subtitles(
        self,
        subtitles: List[SubtitleItem],
        result: ValidationResult
    ) -> None:
        for sub in subtitles:
            if not sub.text or not sub.text.strip():
                result.add_issue(ValidationIssue(
                    issue_type=IssueType.EMPTY_SUBTITLE,
                    severity=IssueSeverity.MEDIUM,
                    message=f"字幕 {sub.index} 内容为空",
                    subtitle_index=sub.index,
                    time_position=sub.start_time,
                    suggested_fix="删除空字幕或填充内容",
                    metadata={}
                ))
    
    def _validate_speakers(
        self,
        subtitles: List[SubtitleItem],
        result: ValidationResult
    ) -> None:
        for sub in subtitles:
            if not sub.speaker or not sub.speaker.strip():
                if self.config.require_speaker_label:
                    result.add_issue(ValidationIssue(
                        issue_type=IssueType.MISSING_SPEAKER,
                        severity=IssueSeverity.MEDIUM,
                        message=f"字幕 {sub.index} 缺少说话人标签",
                        subtitle_index=sub.index,
                        time_position=sub.start_time,
                        suggested_fix="从文本中推断说话人或添加标签",
                        metadata={"text": sub.text[:50] if sub.text else ""}
                    ))
            elif self.speaker_map:
                speaker_lower = sub.speaker.lower()
                if speaker_lower not in self.speaker_map:
                    result.add_issue(ValidationIssue(
                        issue_type=IssueType.SPEAKER_NOT_FOUND,
                        severity=IssueSeverity.HIGH,
                        message=f"字幕 {sub.index} 的说话人 '{sub.speaker}' 不在嘉宾名单中",
                        subtitle_index=sub.index,
                        time_position=sub.start_time,
                        suggested_fix=f"检查是否有拼写错误，或添加到嘉宾名单",
                        metadata={
                            "speaker": sub.speaker,
                            "available_speakers": list(self.speaker_map.keys())
                        }
                    ))
    
    def _validate_timeline_gaps(
        self,
        subtitles: List[SubtitleItem],
        result: ValidationResult
    ) -> None:
        sorted_subs = sorted(subtitles, key=lambda s: s.start_time)
        
        for i in range(len(sorted_subs) - 1):
            current = sorted_subs[i]
            next_sub = sorted_subs[i + 1]
            
            gap = next_sub.gap_after(current)
            if gap and gap > self.config.max_gap_between_subtitles:
                result.add_issue(ValidationIssue(
                    issue_type=IssueType.GAP_IN_TIMELINE,
                    severity=IssueSeverity.LOW,
                    message=f"字幕 {current.index} 和 {next_sub.index} 之间存在较大时间间隙",
                    subtitle_index=current.index,
                    time_position=current.end_time,
                    suggested_fix=f"间隙 {format_duration(gap)}，检查是否有遗漏的字幕",
                    metadata={
                        "gap_duration": str(gap),
                        "current_end": str(current.end_time),
                        "next_start": str(next_sub.start_time)
                    }
                ))
    
    def _validate_chapters(
        self,
        subtitles: List[SubtitleItem],
        chapters: List[Chapter],
        result: ValidationResult
    ) -> None:
        if not subtitles:
            return
        
        first_sub_start = min(s.start_time for s in subtitles)
        last_sub_end = max(s.end_time for s in subtitles)
        total_duration = last_sub_end - first_sub_start
        
        sorted_chapters = sorted(chapters, key=lambda c: c.start_time)
        
        for chapter_idx, chapter in enumerate(sorted_chapters):
            if chapter.start_time < first_sub_start:
                drift = first_sub_start - chapter.start_time
                drift_seconds = drift.total_seconds()
                if drift_seconds > self.config.max_chapter_drift_seconds:
                    result.add_issue(ValidationIssue(
                        issue_type=IssueType.CHAPTER_DRIFT,
                        severity=IssueSeverity.MEDIUM,
                        message=f"章节 '{chapter.title}' 开始时间早于最早字幕 {format_duration(drift)}",
                        chapter_index=chapter_idx,
                        time_position=chapter.start_time,
                        suggested_fix=f"章节漂移超过 {self.config.max_chapter_drift_seconds} 秒，请核对时间",
                        metadata={
                            "chapter_title": chapter.title,
                            "chapter_start": str(chapter.start_time),
                            "first_subtitle_start": str(first_sub_start),
                            "drift_seconds": drift_seconds
                        }
                    ))
            
            if chapter.start_time > last_sub_end:
                drift = chapter.start_time - last_sub_end
                drift_seconds = drift.total_seconds()
                if drift_seconds > self.config.max_chapter_drift_seconds:
                    result.add_issue(ValidationIssue(
                        issue_type=IssueType.CHAPTER_DRIFT,
                        severity=IssueSeverity.MEDIUM,
                        message=f"章节 '{chapter.title}' 开始时间晚于最晚字幕 {format_duration(drift)}",
                        chapter_index=chapter_idx,
                        time_position=chapter.start_time,
                        suggested_fix=f"章节漂移超过 {self.config.max_chapter_drift_seconds} 秒，请核对时间",
                        metadata={
                            "chapter_title": chapter.title,
                            "chapter_start": str(chapter.start_time),
                            "last_subtitle_end": str(last_sub_end),
                            "drift_seconds": drift_seconds
                        }
                    ))
        
        if sorted_chapters:
            first_chapter = sorted_chapters[0]
            if first_chapter.start_time > first_sub_start + timedelta(seconds=5):
                drift = first_chapter.start_time - first_sub_start
                result.add_issue(ValidationIssue(
                    issue_type=IssueType.CHAPTER_DRIFT,
                    severity=IssueSeverity.LOW,
                    message=f"首个章节开始时间晚于字幕开始时间 {format_duration(drift)}",
                    chapter_index=0,
                    time_position=first_chapter.start_time,
                    suggested_fix="考虑在视频开头添加开场章节",
                    metadata={
                        "drift": str(drift)
                    }
                ))
            
            last_chapter = sorted_chapters[-1]
            if last_chapter.end_time and last_chapter.end_time < last_sub_end - timedelta(seconds=5):
                drift = last_sub_end - last_chapter.end_time
                result.add_issue(ValidationIssue(
                    issue_type=IssueType.CHAPTER_DRIFT,
                    severity=IssueSeverity.LOW,
                    message=f"最后一个章节结束时间早于字幕结束时间 {format_duration(drift)}",
                    chapter_index=len(sorted_chapters) - 1,
                    time_position=last_chapter.end_time,
                    suggested_fix="考虑延长最后一个章节或添加结尾章节",
                    metadata={
                        "drift": str(drift)
                    }
                ))
