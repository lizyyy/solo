from pathlib import Path
from typing import List, Dict, Optional, Set
from dataclasses import dataclass
import re

from .srt_parser import SubtitleEntry, SRTParser


@dataclass
class CheckIssue:
    issue_id: str
    rule_type: str
    severity: str
    file: str
    subtitle_index: int
    timecode: str
    message: str
    context: str
    review_status: str = "pending"
    review_note: str = ""


class RulesChecker:
    DEFAULT_MAX_LINE_LENGTH = 20
    DEFAULT_MIN_SUBTITLE_GAP = 0.040

    def __init__(self, max_line_length: int = None, min_gap_seconds: float = None):
        self.max_line_length = max_line_length or self.DEFAULT_MAX_LINE_LENGTH
        self.min_gap_seconds = min_gap_seconds or self.DEFAULT_MIN_SUBTITLE_GAP
        self.forbidden_words: Set[str] = set()

    def load_glossary(self, glossary_path: Path) -> Dict:
        result = {
            'loaded': False,
            'forbidden_count': 0,
            'errors': []
        }

        if not glossary_path.exists():
            result['errors'].append(f"术语表文件不存在: {glossary_path}")
            return result

        try:
            if glossary_path.suffix.lower() in {'.csv'}:
                self._load_csv_glossary(glossary_path)
            else:
                self._load_text_glossary(glossary_path)
            result['loaded'] = True
            result['forbidden_count'] = len(self.forbidden_words)
        except Exception as e:
            result['errors'].append(f"加载术语表失败: {e}")

        return result

    def _load_text_glossary(self, path: Path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        for line in content.replace('\r\n', '\n').replace('\r', '\n').split('\n'):
            line = line.strip()
            if line and not line.startswith('#'):
                if '|' in line or ',' in line:
                    parts = line.replace('|', ',').split(',')
                    for part in parts:
                        word = part.strip()
                        if word:
                            self.forbidden_words.add(word)
                else:
                    self.forbidden_words.add(line)

    def _load_csv_glossary(self, path: Path):
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    for word in line.split(','):
                        word = word.strip()
                        if word:
                            self.forbidden_words.add(word)

    def check_all(self, subtitle_entries: List[SubtitleEntry], file_path: Path,
                  video_duration: float = 0.0) -> List[CheckIssue]:
        issues: List[CheckIssue] = []
        file_str = str(file_path)

        for entry in subtitle_entries:
            issues.extend(self._check_single_entry(entry, file_str))

        issues.extend(self._check_overlaps(subtitle_entries, file_str))
        issues.extend(self._check_timing_bounds(subtitle_entries, file_str, video_duration))
        issues.extend(self._check_empty_entries(subtitle_entries, file_str))

        return issues

    def _check_single_entry(self, entry: SubtitleEntry, file_str: str) -> List[CheckIssue]:
        issues: List[CheckIssue] = []
        timecode = f"{SRTParser.seconds_to_timecode(entry.start_time)} --> {SRTParser.seconds_to_timecode(entry.end_time)}"
        issue_id_base = f"{file_str}_{entry.index}"

        text_lines = entry.text.split('\n')
        for line_num, line in enumerate(text_lines, 1):
            if len(line) > self.max_line_length:
                issues.append(CheckIssue(
                    issue_id=f"{issue_id_base}_long_{line_num}",
                    rule_type="超长行",
                    severity="warning",
                    file=file_str,
                    subtitle_index=entry.index,
                    timecode=timecode,
                    message=f"第 {line_num} 行超过 {self.max_line_length} 字: {len(line)} 字",
                    context=line
                ))

        for word in self.forbidden_words:
            if word and word in entry.text:
                issues.append(CheckIssue(
                    issue_id=f"{issue_id_base}_forbidden_{hash(word)}",
                    rule_type="违禁词",
                    severity="error",
                    file=file_str,
                    subtitle_index=entry.index,
                    timecode=timecode,
                    message=f"包含违禁词或不推荐术语: '{word}'",
                    context=entry.text
                ))

        if entry.end_time <= entry.start_time:
            issues.append(CheckIssue(
                issue_id=f"{issue_id_base}_invalid_time",
                rule_type="时间轴无效",
                severity="error",
                file=file_str,
                subtitle_index=entry.index,
                timecode=timecode,
                message=f"结束时间小于等于开始时间",
                context=entry.text
            ))

        duration = entry.end_time - entry.start_time
        if duration < 0.1:
            issues.append(CheckIssue(
                issue_id=f"{issue_id_base}_too_short",
                rule_type="时间轴过短",
                severity="warning",
                file=file_str,
                subtitle_index=entry.index,
                timecode=timecode,
                message=f"字幕时长过短: {duration:.3f} 秒",
                context=entry.text
            ))

        return issues

    def _check_overlaps(self, entries: List[SubtitleEntry], file_str: str) -> List[CheckIssue]:
        issues: List[CheckIssue] = []
        sorted_entries = sorted(entries, key=lambda e: e.start_time)

        for i in range(len(sorted_entries) - 1):
            current = sorted_entries[i]
            next_entry = sorted_entries[i + 1]

            if next_entry.start_time < current.end_time:
                overlap = current.end_time - next_entry.start_time
                timecode = f"{SRTParser.seconds_to_timecode(current.start_time)} --> {SRTParser.seconds_to_timecode(next_entry.end_time)}"
                issues.append(CheckIssue(
                    issue_id=f"{file_str}_overlap_{current.index}_{next_entry.index}",
                    rule_type="字幕重叠",
                    severity="error",
                    file=file_str,
                    subtitle_index=current.index,
                    timecode=timecode,
                    message=f"字幕 {current.index} 和 {next_entry.index} 重叠 {overlap:.3f} 秒",
                    context=f"字幕 {current.index}: {current.text[:50]}...\n字幕 {next_entry.index}: {next_entry.text[:50]}..."
                ))
            elif abs(next_entry.start_time - current.end_time) < self.min_gap_seconds:
                timecode = f"{SRTParser.seconds_to_timecode(current.start_time)} --> {SRTParser.seconds_to_timecode(next_entry.end_time)}"
                gap = next_entry.start_time - current.end_time
                issues.append(CheckIssue(
                    issue_id=f"{file_str}_gap_{current.index}_{next_entry.index}",
                    rule_type="间隔过短",
                    severity="warning",
                    file=file_str,
                    subtitle_index=current.index,
                    timecode=timecode,
                    message=f"字幕 {current.index} 和 {next_entry.index} 间隔仅 {gap:.3f} 秒（建议 {self.min_gap_seconds} 秒）",
                    context=f"字幕 {current.index}: {current.text[:50]}...\n字幕 {next_entry.index}: {next_entry.text[:50]}..."
                ))

        return issues

    def _check_timing_bounds(self, entries: List[SubtitleEntry], file_str: str,
                              video_duration: float) -> List[CheckIssue]:
        issues: List[CheckIssue] = []

        if not entries:
            return issues

        sorted_entries = sorted(entries, key=lambda e: e.start_time)

        if sorted_entries[0].start_time < 0:
            timecode = SRTParser.seconds_to_timecode(sorted_entries[0].start_time)
            issues.append(CheckIssue(
                issue_id=f"{file_str}_negative_start",
                rule_type="时间轴越界",
                severity="error",
                file=file_str,
                subtitle_index=sorted_entries[0].index,
                timecode=timecode,
                message=f"字幕开始时间为负值: {timecode}",
                context=sorted_entries[0].text
            ))

        last_entry = sorted_entries[-1]
        if video_duration > 0:
            if last_entry.end_time > video_duration:
                exceed = last_entry.end_time - video_duration
                timecode = f"{SRTParser.seconds_to_timecode(last_entry.start_time)} --> {SRTParser.seconds_to_timecode(last_entry.end_time)}"
                issues.append(CheckIssue(
                    issue_id=f"{file_str}_exceed_duration",
                    rule_type="时间轴越界",
                    severity="error",
                    file=file_str,
                    subtitle_index=last_entry.index,
                    timecode=timecode,
                    message=f"字幕结束时间超出视频时长 {exceed:.3f} 秒（视频时长: {video_duration:.3f} 秒）",
                    context=last_entry.text
                ))

        return issues

    def _check_empty_entries(self, entries: List[SubtitleEntry], file_str: str) -> List[CheckIssue]:
        issues: List[CheckIssue] = []

        for entry in entries:
            if not entry.text.strip():
                timecode = f"{SRTParser.seconds_to_timecode(entry.start_time)} --> {SRTParser.seconds_to_timecode(entry.end_time)}"
                issues.append(CheckIssue(
                    issue_id=f"{file_str}_empty_{entry.index}",
                    rule_type="空字幕",
                    severity="warning",
                    file=file_str,
                    subtitle_index=entry.index,
                    timecode=timecode,
                    message=f"字幕 {entry.index} 内容为空",
                    context="[空内容]"
                ))

        return issues
