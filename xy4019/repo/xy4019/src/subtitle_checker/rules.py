import re
from abc import ABC, abstractmethod
from datetime import timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from .models import (
    SubtitleFile, SubtitleItem, Issue, IssueType, IssueSeverity,
    ProjectConfig, Speaker, Term, ForbiddenWord
)


class BaseRule(ABC):
    @abstractmethod
    def check(self, subtitle_file: SubtitleFile, config: ProjectConfig) -> List[Issue]:
        pass
    
    @property
    @abstractmethod
    def issue_type(self) -> IssueType:
        pass
    
    @property
    def rule_name(self) -> str:
        return self.__class__.__name__


class OverlappingTimelineRule(BaseRule):
    @property
    def issue_type(self) -> IssueType:
        return IssueType.OVERLAPPING_TIMELINE
    
    def check(self, subtitle_file: SubtitleFile, config: ProjectConfig) -> List[Issue]:
        issues: List[Issue] = []
        items = subtitle_file.items
        
        for i in range(len(items) - 1):
            current = items[i]
            next_item = items[i + 1]
            
            if current.overlaps_with(next_item):
                overlap_start = max(current.start_time, next_item.start_time)
                overlap_end = min(current.end_time, next_item.end_time)
                overlap_duration = (overlap_end - overlap_start).total_seconds()
                
                issues.append(Issue(
                    type=IssueType.OVERLAPPING_TIMELINE,
                    severity=IssueSeverity.ERROR,
                    message=f"字幕 {current.index} 和 {next_item.index} 时间轴重叠，重叠时长 {overlap_duration:.3f} 秒",
                    file_path=subtitle_file.path,
                    subtitle_index=current.index,
                    original_text=f"{current.text} | {next_item.text}",
                    context={
                        'overlap_duration': overlap_duration,
                        'current_index': current.index,
                        'next_index': next_item.index
                    }
                ))
        
        return issues


class BrokenSequenceRule(BaseRule):
    @property
    def issue_type(self) -> IssueType:
        return IssueType.BROKEN_SEQUENCE
    
    def check(self, subtitle_file: SubtitleFile, config: ProjectConfig) -> List[Issue]:
        issues: List[Issue] = []
        items = subtitle_file.items
        
        if not items:
            return issues
        
        expected_index = 1
        for item in items:
            if item.index != expected_index:
                issues.append(Issue(
                    type=IssueType.BROKEN_SEQUENCE,
                    severity=IssueSeverity.WARNING,
                    message=f"字幕序号断裂，期望 {expected_index}，实际 {item.index}",
                    file_path=subtitle_file.path,
                    subtitle_index=item.index,
                    original_text=item.text,
                    suggestion=f"将序号调整为 {expected_index}",
                    context={
                        'expected_index': expected_index,
                        'actual_index': item.index
                    }
                ))
            expected_index += 1
        
        return issues


class LineTooLongRule(BaseRule):
    @property
    def issue_type(self) -> IssueType:
        return IssueType.LINE_TOO_LONG
    
    def check(self, subtitle_file: SubtitleFile, config: ProjectConfig) -> List[Issue]:
        issues: List[Issue] = []
        max_length = config.max_line_length
        
        for item in subtitle_file.items:
            lines = item.text.split('\n')
            for line_num, line in enumerate(lines, 1):
                line_length = len(line.strip())
                if line_length > max_length:
                    issues.append(Issue(
                        type=IssueType.LINE_TOO_LONG,
                        severity=IssueSeverity.WARNING,
                        message=f"第 {line_num} 行文字过长 ({line_length} 字)，超过限制 {max_length} 字",
                        file_path=subtitle_file.path,
                        subtitle_index=item.index,
                        original_text=line,
                        suggestion=f"建议拆分成多行，每行不超过 {max_length} 字",
                        context={
                            'line_length': line_length,
                            'max_length': max_length,
                            'line_number': line_num
                        }
                    ))
        
        return issues


class ReadingSpeedTooFastRule(BaseRule):
    @property
    def issue_type(self) -> IssueType:
        return IssueType.READING_SPEED_TOO_FAST
    
    def check(self, subtitle_file: SubtitleFile, config: ProjectConfig) -> List[Issue]:
        issues: List[Issue] = []
        max_speed = config.max_reading_speed
        
        for item in subtitle_file.items:
            reading_speed = item.reading_speed
            
            if reading_speed > max_speed and item.text_length > 0:
                issues.append(Issue(
                    type=IssueType.READING_SPEED_TOO_FAST,
                    severity=IssueSeverity.WARNING,
                    message=f"阅读速度过快 ({reading_speed:.1f} 字/分钟)，超过限制 {max_speed} 字/分钟",
                    file_path=subtitle_file.path,
                    subtitle_index=item.index,
                    original_text=item.text,
                    suggestion=f"建议延长显示时间或精简文字",
                    context={
                        'reading_speed': reading_speed,
                        'max_speed': max_speed,
                        'duration_seconds': item.duration_seconds,
                        'text_length': item.text_length
                    }
                ))
        
        return issues


class SpeakerInconsistentRule(BaseRule):
    SPEAKER_PATTERN = re.compile(r'^([^：:]+)[：:]\s*(.*)$')
    
    @property
    def issue_type(self) -> IssueType:
        return IssueType.SPEAKER_INCONSISTENT
    
    def check(self, subtitle_file: SubtitleFile, config: ProjectConfig) -> List[Issue]:
        issues: List[Issue] = []
        
        if not config.speakers:
            return issues
        
        speaker_map: Dict[str, Speaker] = {}
        for speaker in config.speakers:
            speaker_map[speaker.name.lower()] = speaker
            for alias in speaker.aliases:
                speaker_map[alias.lower()] = speaker
        
        for item in subtitle_file.items:
            match = self.SPEAKER_PATTERN.match(item.text)
            if match:
                speaker_name = match.group(1).strip()
                rest_text = match.group(2).strip()
                
                speaker_name_lower = speaker_name.lower()
                
                matched_speaker: Optional[Speaker] = None
                for speaker in config.speakers:
                    if speaker.name.lower() == speaker_name_lower:
                        matched_speaker = speaker
                        break
                    for alias in speaker.aliases:
                        if alias.lower() == speaker_name_lower:
                            matched_speaker = speaker
                            break
                
                if matched_speaker:
                    if matched_speaker.name.lower() != speaker_name_lower:
                        issues.append(Issue(
                            type=IssueType.SPEAKER_INCONSISTENT,
                            severity=IssueSeverity.WARNING,
                            message=f"说话人 '{speaker_name}' 应统一为 '{matched_speaker.name}'",
                            file_path=subtitle_file.path,
                            subtitle_index=item.index,
                            original_text=item.text,
                            suggestion=f"将 '{speaker_name}' 替换为 '{matched_speaker.name}'",
                            context={
                                'original_speaker': speaker_name,
                                'correct_speaker': matched_speaker.name
                            }
                        ))
                else:
                    issues.append(Issue(
                        type=IssueType.SPEAKER_INCONSISTENT,
                        severity=IssueSeverity.INFO,
                        message=f"未知说话人 '{speaker_name}'，未在配置中定义",
                        file_path=subtitle_file.path,
                        subtitle_index=item.index,
                        original_text=item.text,
                        suggestion=f"请确认该说话人是否需要添加到配置中",
                        context={
                            'unknown_speaker': speaker_name
                        }
                    ))
        
        return issues


class TermInconsistentRule(BaseRule):
    @property
    def issue_type(self) -> IssueType:
        return IssueType.TERM_INCONSISTENT
    
    def check(self, subtitle_file: SubtitleFile, config: ProjectConfig) -> List[Issue]:
        issues: List[Issue] = []
        
        if not config.terms:
            return issues
        
        for item in subtitle_file.items:
            text_lower = item.text.lower()
            
            for term in config.terms:
                correct_lower = term.correct.lower()
                
                if correct_lower in text_lower:
                    continue
                
                for alt in term.alternatives:
                    alt_lower = alt.lower()
                    if alt_lower in text_lower:
                        issues.append(Issue(
                            type=IssueType.TERM_INCONSISTENT,
                            severity=IssueSeverity.WARNING,
                            message=f"术语 '{alt}' 应统一为 '{term.correct}'",
                            file_path=subtitle_file.path,
                            subtitle_index=item.index,
                            original_text=item.text,
                            suggestion=f"将 '{alt}' 替换为 '{term.correct}'",
                            context={
                                'original_term': alt,
                                'correct_term': term.correct,
                                'category': term.category
                            }
                        ))
        
        return issues


class ForbiddenWordRule(BaseRule):
    @property
    def issue_type(self) -> IssueType:
        return IssueType.FORBIDDEN_WORD
    
    def check(self, subtitle_file: SubtitleFile, config: ProjectConfig) -> List[Issue]:
        issues: List[Issue] = []
        
        if not config.forbidden_words:
            return issues
        
        for item in subtitle_file.items:
            text_lower = item.text.lower()
            
            for fw in config.forbidden_words:
                fw_lower = fw.word.lower()
                if fw_lower in text_lower:
                    issues.append(Issue(
                        type=IssueType.FORBIDDEN_WORD,
                        severity=IssueSeverity.CRITICAL,
                        message=f"发现禁用词 '{fw.word}'",
                        file_path=subtitle_file.path,
                        subtitle_index=item.index,
                        original_text=item.text,
                        suggestion=fw.suggestion or f"请替换或删除禁用词 '{fw.word}'",
                        context={
                            'forbidden_word': fw.word,
                            'category': fw.category
                        }
                    ))
        
        return issues


class EmptySubtitleRule(BaseRule):
    @property
    def issue_type(self) -> IssueType:
        return IssueType.EMPTY_SUBTITLE
    
    def check(self, subtitle_file: SubtitleFile, config: ProjectConfig) -> List[Issue]:
        issues: List[Issue] = []
        
        for item in subtitle_file.items:
            if item.text_length == 0:
                issues.append(Issue(
                    type=IssueType.EMPTY_SUBTITLE,
                    severity=IssueSeverity.WARNING,
                    message=f"字幕 {item.index} 为空",
                    file_path=subtitle_file.path,
                    subtitle_index=item.index,
                    original_text="",
                    suggestion="请删除空字幕或添加内容",
                    context={
                        'index': item.index
                    }
                ))
        
        return issues


class TimecodeErrorRule(BaseRule):
    @property
    def issue_type(self) -> IssueType:
        return IssueType.TIMECODE_ERROR
    
    def check(self, subtitle_file: SubtitleFile, config: ProjectConfig) -> List[Issue]:
        issues: List[Issue] = []
        
        for item in subtitle_file.items:
            if item.start_time >= item.end_time:
                issues.append(Issue(
                    type=IssueType.TIMECODE_ERROR,
                    severity=IssueSeverity.ERROR,
                    message=f"字幕 {item.index} 时间码错误：开始时间 >= 结束时间",
                    file_path=subtitle_file.path,
                    subtitle_index=item.index,
                    original_text=item.text,
                    suggestion="请检查并修正时间码",
                    context={
                        'start_time': str(item.start_time),
                        'end_time': str(item.end_time)
                    }
                ))
        
        return issues


class RuleEngine:
    def __init__(self):
        self.rules: List[BaseRule] = [
            OverlappingTimelineRule(),
            BrokenSequenceRule(),
            LineTooLongRule(),
            ReadingSpeedTooFastRule(),
            SpeakerInconsistentRule(),
            TermInconsistentRule(),
            ForbiddenWordRule(),
            EmptySubtitleRule(),
            TimecodeErrorRule(),
        ]
    
    def check_file(self, subtitle_file: SubtitleFile, config: ProjectConfig) -> List[Issue]:
        all_issues: List[Issue] = []
        
        for rule in self.rules:
            try:
                issues = rule.check(subtitle_file, config)
                all_issues.extend(issues)
            except Exception as e:
                all_issues.append(Issue(
                    type=IssueType.TIMECODE_ERROR,
                    severity=IssueSeverity.ERROR,
                    message=f"规则 {rule.rule_name} 执行错误: {str(e)}",
                    file_path=subtitle_file.path
                ))
        
        return all_issues
    
    def check_files(self, subtitle_files: List[SubtitleFile], config: ProjectConfig) -> Dict[Path, List[Issue]]:
        results: Dict[Path, List[Issue]] = {}
        
        for subtitle_file in subtitle_files:
            issues = self.check_file(subtitle_file, config)
            results[subtitle_file.path] = issues
        
        return results
    
    def get_rule_by_type(self, issue_type: IssueType) -> Optional[BaseRule]:
        for rule in self.rules:
            if rule.issue_type == issue_type:
                return rule
        return None
    
    def list_rules(self) -> List[Dict[str, Any]]:
        return [
            {
                'name': rule.rule_name,
                'issue_type': rule.issue_type.name,
                'description': self._get_rule_description(rule)
            }
            for rule in self.rules
        ]
    
    def _get_rule_description(self, rule: BaseRule) -> str:
        descriptions = {
            'OverlappingTimelineRule': '检查字幕时间轴是否重叠',
            'BrokenSequenceRule': '检查字幕序号是否连续',
            'LineTooLongRule': '检查单行文字是否过长',
            'ReadingSpeedTooFastRule': '检查阅读速度是否过快',
            'SpeakerInconsistentRule': '检查说话人名称是否一致',
            'TermInconsistentRule': '检查术语使用是否一致',
            'ForbiddenWordRule': '检查是否使用了禁用词',
            'EmptySubtitleRule': '检查是否存在空字幕',
            'TimecodeErrorRule': '检查时间码是否合法',
        }
        return descriptions.get(rule.rule_name, '')
