from datetime import timedelta
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass, field, asdict
from enum import Enum
import copy

from .models import (
    SubtitleItem, Speaker, Chapter,
    ValidationResult, ValidationIssue,
    IssueType, IssueSeverity,
    FixAction
)
from .validator import Validator, ValidatorConfig


class FixStrategy(Enum):
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"


class FixResult:
    def __init__(self):
        self.fixed_subtitles: List[SubtitleItem] = []
        self.actions: List[FixAction] = []
        self.remaining_issues: List[ValidationIssue] = []
        self.warnings: List[str] = []
    
    @property
    def action_count(self) -> int:
        return len(self.actions)
    
    @property
    def auto_fixed_count(self) -> int:
        return sum(1 for a in self.actions if a.auto_applied)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "action_count": self.action_count,
            "auto_fixed_count": self.auto_fixed_count,
            "actions": [asdict(a) for a in self.actions],
            "remaining_issues_count": len(self.remaining_issues),
            "remaining_issues": [i.to_dict() for i in self.remaining_issues],
            "warnings": self.warnings
        }


class Fixer:
    def __init__(
        self,
        strategy: FixStrategy = FixStrategy.MODERATE,
        config: Optional[ValidatorConfig] = None
    ):
        self.strategy = strategy
        self.config = config or ValidatorConfig()
        self.validator = Validator(self.config)
        self.speakers: List[Speaker] = []
        self.chapters: List[Chapter] = []
    
    def set_speakers(self, speakers: List[Speaker]) -> None:
        self.speakers = speakers
        self.validator.set_speakers(speakers)
    
    def set_chapters(self, chapters: List[Chapter]) -> None:
        self.chapters = chapters
    
    def fix(
        self,
        subtitles: List[SubtitleItem],
        validation_result: Optional[ValidationResult] = None
    ) -> FixResult:
        result = FixResult()
        
        working_subs = copy.deepcopy(subtitles)
        
        if validation_result is None:
            validation_result = self.validator.validate_all(
                working_subs, self.chapters
            )
        
        if self.strategy in [FixStrategy.MODERATE, FixStrategy.AGGRESSIVE]:
            self._fix_time_overlaps(working_subs, validation_result, result)
        
        self._fix_invalid_timecodes(working_subs, validation_result, result)
        self._fix_empty_subtitles(working_subs, validation_result, result)
        
        if self.strategy == FixStrategy.AGGRESSIVE:
            self._fix_missing_speakers(working_subs, validation_result, result)
        
        if self.speakers:
            self._normalize_speaker_names(working_subs, result)
        
        self._renumber_indices(working_subs, result)
        
        new_validation = self.validator.validate_all(working_subs, self.chapters)
        result.remaining_issues = new_validation.issues
        result.fixed_subtitles = working_subs
        
        return result
    
    def _fix_time_overlaps(
        self,
        subtitles: List[SubtitleItem],
        validation_result: ValidationResult,
        result: FixResult
    ) -> None:
        if not subtitles:
            return
        
        sorted_subs = sorted(subtitles, key=lambda s: s.start_time)
        
        for i in range(len(sorted_subs) - 1):
            current = sorted_subs[i]
            next_sub = sorted_subs[i + 1]
            
            if current.overlaps_with(next_sub):
                overlap_duration = current.end_time - next_sub.start_time
                if overlap_duration > timedelta(0):
                    before_time = str(current.end_time)
                    
                    current.end_time = next_sub.start_time - timedelta(milliseconds=1)
                    
                    result.actions.append(FixAction(
                        action_type="adjust_overlap",
                        subtitle_index=current.index,
                        before={"end_time": before_time},
                        after={"end_time": str(current.end_time)},
                        reason=f"与字幕 {next_sub.index} 重叠，调整结束时间",
                        auto_applied=True
                    ))
    
    def _fix_invalid_timecodes(
        self,
        subtitles: List[SubtitleItem],
        validation_result: ValidationResult,
        result: FixResult
    ) -> None:
        for sub in subtitles:
            if sub.start_time >= sub.end_time:
                before = {
                    "start_time": str(sub.start_time),
                    "end_time": str(sub.end_time)
                }
                
                if sub.start_time < timedelta(0):
                    sub.start_time = timedelta(0)
                
                if sub.end_time <= sub.start_time:
                    sub.end_time = sub.start_time + timedelta(seconds=2)
                
                result.actions.append(FixAction(
                    action_type="fix_timecode",
                    subtitle_index=sub.index,
                    before=before,
                    after={
                        "start_time": str(sub.start_time),
                        "end_time": str(sub.end_time)
                    },
                    reason="时间码无效，开始时间晚于或等于结束时间",
                    auto_applied=True
                ))
            
            if sub.start_time < timedelta(0):
                before = {"start_time": str(sub.start_time)}
                sub.start_time = timedelta(0)
                
                result.actions.append(FixAction(
                    action_type="fix_negative_time",
                    subtitle_index=sub.index,
                    before=before,
                    after={"start_time": str(sub.start_time)},
                    reason="开始时间为负数，调整为0",
                    auto_applied=True
                ))
    
    def _fix_empty_subtitles(
        self,
        subtitles: List[SubtitleItem],
        validation_result: ValidationResult,
        result: FixResult
    ) -> None:
        to_remove = []
        for idx, sub in enumerate(subtitles):
            if not sub.text or not sub.text.strip():
                to_remove.append((idx, sub))
        
        for idx, sub in reversed(to_remove):
            result.actions.append(FixAction(
                action_type="remove_empty",
                subtitle_index=sub.index,
                before={
                    "text": sub.text,
                    "start_time": str(sub.start_time),
                    "end_time": str(sub.end_time)
                },
                after={"removed": True},
                reason="删除空字幕",
                auto_applied=(self.strategy == FixStrategy.AGGRESSIVE)
            ))
            
            if self.strategy == FixStrategy.AGGRESSIVE:
                del subtitles[idx]
    
    def _fix_missing_speakers(
        self,
        subtitles: List[SubtitleItem],
        validation_result: ValidationResult,
        result: FixResult
    ) -> None:
        if not subtitles:
            return
        
        last_speaker = None
        for sub in subtitles:
            if sub.speaker and sub.speaker.strip():
                last_speaker = sub.speaker
            elif last_speaker:
                before = {"speaker": sub.speaker}
                sub.speaker = last_speaker
                
                result.actions.append(FixAction(
                    action_type="infer_speaker",
                    subtitle_index=sub.index,
                    before=before,
                    after={"speaker": sub.speaker},
                    reason=f"从上一条字幕推断说话人为 '{last_speaker}'",
                    auto_applied=True
                ))
    
    def _normalize_speaker_names(
        self,
        subtitles: List[SubtitleItem],
        result: FixResult
    ) -> None:
        speaker_map: Dict[str, str] = {}
        for speaker in self.speakers:
            canonical_name = speaker.name
            speaker_map[canonical_name.lower()] = canonical_name
            for alias in speaker.alias:
                speaker_map[alias.lower()] = canonical_name
        
        for sub in subtitles:
            if sub.speaker:
                speaker_lower = sub.speaker.lower()
                if speaker_lower in speaker_map:
                    canonical = speaker_map[speaker_lower]
                    if sub.speaker != canonical:
                        before = {"speaker": sub.speaker}
                        sub.speaker = canonical
                        
                        result.actions.append(FixAction(
                            action_type="normalize_speaker",
                            subtitle_index=sub.index,
                            before=before,
                            after={"speaker": sub.speaker},
                            reason=f"标准化说话人名称",
                            auto_applied=True
                        ))
    
    def _renumber_indices(
        self,
        subtitles: List[SubtitleItem],
        result: FixResult
    ) -> None:
        sorted_subs = sorted(subtitles, key=lambda s: s.start_time)
        
        for new_idx, sub in enumerate(sorted_subs, start=1):
            if sub.index != new_idx:
                before = {"index": sub.index}
                sub.index = new_idx
                
                result.actions.append(FixAction(
                    action_type="renumber_index",
                    subtitle_index=sub.index,
                    before=before,
                    after={"index": sub.index},
                    reason="重新编号字幕索引",
                    auto_applied=True
                ))
        
        subtitles[:] = sorted_subs
    
    def get_manual_fix_suggestions(
        self,
        subtitles: List[SubtitleItem],
        validation_result: ValidationResult
    ) -> List[Dict[str, Any]]:
        suggestions = []
        
        for issue in validation_result.issues:
            suggestion = {
                "issue": issue.to_dict(),
                "manual_action_required": True,
                "suggested_actions": []
            }
            
            if issue.issue_type == IssueType.TOO_LONG_SUBTITLE:
                suggestion["suggested_actions"] = [
                    "手动拆分字幕为多条",
                    "调整阅读速度",
                    "缩短字幕文本"
                ]
                suggestions.append(suggestion)
            
            elif issue.issue_type == IssueType.SPEAKER_NOT_FOUND:
                suggestion["suggested_actions"] = [
                    "检查说话人拼写",
                    "添加到嘉宾名单CSV",
                    "手动确认是否为新嘉宾"
                ]
                suggestions.append(suggestion)
            
            elif issue.issue_type == IssueType.CHAPTER_DRIFT:
                suggestion["suggested_actions"] = [
                    "核对章节时间点",
                    "调整字幕时间轴整体偏移",
                    "确认章节是否正确"
                ]
                suggestions.append(suggestion)
            
            elif issue.issue_type == IssueType.GAP_IN_TIMELINE:
                suggestion["suggested_actions"] = [
                    "检查是否有遗漏的字幕",
                    "确认间隙是否为有意留白",
                    "填充沉默内容或音乐说明"
                ]
                suggestions.append(suggestion)
        
        return suggestions
