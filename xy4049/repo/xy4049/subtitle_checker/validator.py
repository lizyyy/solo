"""规则校验模块 - 检查字幕的各种问题"""

import re
import uuid
from pathlib import Path
from typing import Optional

from .models import (
    Issue,
    IssueSeverity,
    IssueType,
    Language,
    ManifestFile,
    ProjectConfig,
    Quarantine,
    ScriptFile,
    SubtitleFile,
    Timecode,
)


class Validator:
    CURRENCY_PATTERNS = [
        r"(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:元|人民币|CNY|RMB)",
        r"(?:\$|USD|US\$)\s*(\d+(?:,\d{3})*(?:\.\d+)?)",
        r"(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:\$|USD)",
        r"(?:€|EUR)\s*(\d+(?:,\d{3})*(?:\.\d+)?)",
        r"(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:€|EUR)",
        r"(?:£|GBP)\s*(\d+(?:,\d{3})*(?:\.\d+)?)",
        r"(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:£|GBP)",
        r"(?:¥|JPY|JP¥)\s*(\d+(?:,\d{3})*(?:\.\d+)?)",
        r"(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:¥|JPY)",
        r"(?:₩|KRW)\s*(\d+(?:,\d{3})*(?:\.\d+)?)",
        r"(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:₩|KRW)",
    ]

    PLACEHOLDER_PATTERN = r"(\{[^}]+\}|\[[^\]]+\]|\<[^>]+\>)"

    def __init__(self, config: ProjectConfig):
        self.config = config

    def validate_subtitle_file(
        self, subtitle_file: SubtitleFile
    ) -> list[Issue]:
        issues = []

        issues.extend(self._check_timecode_format(subtitle_file))
        issues.extend(self._check_empty_subtitles(subtitle_file))
        issues.extend(self._check_sequence_gaps(subtitle_file))
        issues.extend(self._check_overlaps(subtitle_file))
        issues.extend(self._check_reading_speed(subtitle_file))
        issues.extend(self._check_gaps(subtitle_file))

        return issues

    def validate_multilingual(
        self,
        subtitle_files: list[SubtitleFile],
        script_files: list[ScriptFile] = None,
    ) -> list[Issue]:
        issues = []

        issues.extend(self._check_missing_segments(subtitle_files, script_files))
        issues.extend(self._check_placeholder_consistency(subtitle_files, script_files))
        issues.extend(self._check_currency_consistency(subtitle_files, script_files))
        issues.extend(self._check_speaker_consistency(subtitle_files))

        return issues

    def validate_manifest(
        self,
        subtitle_files: list[SubtitleFile],
        manifest_file: ManifestFile,
    ) -> list[Issue]:
        issues = []

        for item in manifest_file.items:
            matched = False
            for sub_file in subtitle_files:
                if sub_file.episode == item.episode:
                    matched = True
                    if item.expected_filename and sub_file.filename != item.expected_filename:
                        issues.append(
                            Issue(
                                id=str(uuid.uuid4()),
                                issue_type=IssueType.FILENAME_MISMATCH,
                                severity=IssueSeverity.WARNING,
                                message=f"文件名不匹配: 期望 '{item.expected_filename}', 实际 '{sub_file.filename}'",
                                language=sub_file.language,
                                episode=item.episode,
                                filename=sub_file.filename,
                                details={
                                    "expected": item.expected_filename,
                                    "actual": sub_file.filename,
                                    "platform": item.platform,
                                },
                            )
                        )
            if not matched:
                issues.append(
                    Issue(
                        id=str(uuid.uuid4()),
                        issue_type=IssueType.MISSING_SEGMENT,
                        severity=IssueSeverity.CRITICAL,
                        message=f"清单中第 {item.episode} 集未找到对应字幕文件",
                        episode=item.episode,
                        filename=item.original_filename,
                        details={
                            "expected_filename": item.expected_filename,
                            "languages": [l.value for l in item.languages],
                            "platform": item.platform,
                        },
                    )
                )

        return issues

    def _check_timecode_format(self, subtitle_file: SubtitleFile) -> list[Issue]:
        issues = []

        for entry in subtitle_file.entries:
            start_sec = entry.start.to_seconds()
            end_sec = entry.end.to_seconds()

            if start_sec < 0:
                issues.append(
                    Issue(
                        id=str(uuid.uuid4()),
                        issue_type=IssueType.TIMECODE_FORMAT,
                        severity=IssueSeverity.CRITICAL,
                        message=f"第 {entry.index} 条开始时间码为负数",
                        language=subtitle_file.language,
                        episode=subtitle_file.episode,
                        subtitle_index=entry.index,
                        filename=subtitle_file.filename,
                        details={
                            "start_timecode": entry.start.to_srt_format(),
                            "end_timecode": entry.end.to_srt_format(),
                        },
                    )
                )

            if end_sec <= start_sec:
                issues.append(
                    Issue(
                        id=str(uuid.uuid4()),
                        issue_type=IssueType.TIMECODE_FORMAT,
                        severity=IssueSeverity.CRITICAL,
                        message=f"第 {entry.index} 条结束时间码小于等于开始时间码",
                        language=subtitle_file.language,
                        episode=subtitle_file.episode,
                        subtitle_index=entry.index,
                        filename=subtitle_file.filename,
                        details={
                            "start_timecode": entry.start.to_srt_format(),
                            "end_timecode": entry.end.to_srt_format(),
                        },
                    )
                )

            if entry.start.hours > 23 or entry.start.minutes > 59 or entry.start.seconds > 59:
                issues.append(
                    Issue(
                        id=str(uuid.uuid4()),
                        issue_type=IssueType.TIMECODE_FORMAT,
                        severity=IssueSeverity.WARNING,
                        message=f"第 {entry.index} 条开始时间码格式异常",
                        language=subtitle_file.language,
                        episode=subtitle_file.episode,
                        subtitle_index=entry.index,
                        filename=subtitle_file.filename,
                        details={
                            "timecode": entry.start.to_srt_format(),
                        },
                    )
                )

        return issues

    def _check_empty_subtitles(self, subtitle_file: SubtitleFile) -> list[Issue]:
        issues = []

        for entry in subtitle_file.entries:
            if not entry.text.strip():
                issues.append(
                    Issue(
                        id=str(uuid.uuid4()),
                        issue_type=IssueType.EMPTY_SUBTITLE,
                        severity=IssueSeverity.WARNING,
                        message=f"第 {entry.index} 条字幕为空",
                        language=subtitle_file.language,
                        episode=subtitle_file.episode,
                        subtitle_index=entry.index,
                        filename=subtitle_file.filename,
                        details={
                            "start_timecode": entry.start.to_srt_format(),
                            "end_timecode": entry.end.to_srt_format(),
                        },
                    )
                )

        return issues

    def _check_sequence_gaps(self, subtitle_file: SubtitleFile) -> list[Issue]:
        issues = []

        if not subtitle_file.entries:
            return issues

        expected_index = 1
        for entry in subtitle_file.entries:
            if entry.index != expected_index:
                issues.append(
                    Issue(
                        id=str(uuid.uuid4()),
                        issue_type=IssueType.SEQUENCE_GAP,
                        severity=IssueSeverity.WARNING,
                        message=f"序号断档: 期望 {expected_index}, 实际 {entry.index}",
                        language=subtitle_file.language,
                        episode=subtitle_file.episode,
                        subtitle_index=entry.index,
                        filename=subtitle_file.filename,
                        details={
                            "expected": expected_index,
                            "actual": entry.index,
                        },
                    )
                )
                expected_index = entry.index + 1
            else:
                expected_index += 1

        return issues

    def _check_overlaps(self, subtitle_file: SubtitleFile) -> list[Issue]:
        issues = []

        if len(subtitle_file.entries) < 2:
            return issues

        for i in range(1, len(subtitle_file.entries)):
            prev_entry = subtitle_file.entries[i - 1]
            curr_entry = subtitle_file.entries[i]

            if prev_entry.end.to_seconds() > curr_entry.start.to_seconds():
                overlap_ms = int(
                    (prev_entry.end.to_seconds() - curr_entry.start.to_seconds()) * 1000
                )
                issues.append(
                    Issue(
                        id=str(uuid.uuid4()),
                        issue_type=IssueType.OVERLAP,
                        severity=IssueSeverity.CRITICAL,
                        message=f"第 {prev_entry.index} 条与第 {curr_entry.index} 条重叠 {overlap_ms}ms",
                        language=subtitle_file.language,
                        episode=subtitle_file.episode,
                        subtitle_index=prev_entry.index,
                        filename=subtitle_file.filename,
                        details={
                            "prev_index": prev_entry.index,
                            "curr_index": curr_entry.index,
                            "prev_end": prev_entry.end.to_srt_format(),
                            "curr_start": curr_entry.start.to_srt_format(),
                            "overlap_ms": overlap_ms,
                        },
                    )
                )

        return issues

    def _check_gaps(self, subtitle_file: SubtitleFile) -> list[Issue]:
        issues = []

        if len(subtitle_file.entries) < 2:
            return issues

        min_gap_seconds = self.config.min_subtitle_gap_ms / 1000

        for i in range(1, len(subtitle_file.entries)):
            prev_entry = subtitle_file.entries[i - 1]
            curr_entry = subtitle_file.entries[i]

            gap_seconds = curr_entry.start.to_seconds() - prev_entry.end.to_seconds()

            if 0 < gap_seconds < min_gap_seconds:
                issues.append(
                    Issue(
                        id=str(uuid.uuid4()),
                        issue_type=IssueType.OVERLAP,
                        severity=IssueSeverity.WARNING,
                        message=f"第 {prev_entry.index} 条与第 {curr_entry.index} 条间隔过小: {int(gap_seconds * 1000)}ms",
                        language=subtitle_file.language,
                        episode=subtitle_file.episode,
                        subtitle_index=prev_entry.index,
                        filename=subtitle_file.filename,
                        details={
                            "prev_index": prev_entry.index,
                            "curr_index": curr_entry.index,
                            "gap_ms": int(gap_seconds * 1000),
                            "min_gap_ms": self.config.min_subtitle_gap_ms,
                        },
                    )
                )

        return issues

    def _check_reading_speed(self, subtitle_file: SubtitleFile) -> list[Issue]:
        issues = []

        if subtitle_file.language == Language.ZH:
            max_speed = self.config.max_reading_speed_zh
        else:
            max_speed = self.config.max_reading_speed_en

        for entry in subtitle_file.entries:
            if not entry.text.strip():
                continue

            duration = entry.duration_seconds()
            if duration <= 0:
                continue

            text_length = len(entry.text.strip())
            reading_speed = text_length / duration

            if reading_speed > max_speed:
                issues.append(
                    Issue(
                        id=str(uuid.uuid4()),
                        issue_type=IssueType.READING_SPEED,
                        severity=IssueSeverity.WARNING,
                        message=f"第 {entry.index} 条读速超限: {reading_speed:.1f} 字符/秒 (上限: {max_speed})",
                        language=subtitle_file.language,
                        episode=subtitle_file.episode,
                        subtitle_index=entry.index,
                        filename=subtitle_file.filename,
                        details={
                            "text": entry.text,
                            "text_length": text_length,
                            "duration_seconds": round(duration, 2),
                            "reading_speed": round(reading_speed, 1),
                            "max_speed": max_speed,
                        },
                    )
                )

        return issues

    def _check_missing_segments(
        self,
        subtitle_files: list[SubtitleFile],
        script_files: list[ScriptFile] = None,
    ) -> list[Issue]:
        issues = []

        episodes = set()
        for sub_file in subtitle_files:
            if sub_file.episode:
                episodes.add(sub_file.episode)

        for episode in episodes:
            episode_subs = [s for s in subtitle_files if s.episode == episode]
            languages = set(s.language for s in episode_subs)

            for lang in languages:
                lang_sub = next((s for s in episode_subs if s.language == lang), None)
                if not lang_sub:
                    continue

                for other_lang in languages:
                    if other_lang == lang:
                        continue
                    other_sub = next(
                        (s for s in episode_subs if s.language == other_lang), None
                    )
                    if not other_sub:
                        continue

                    if len(lang_sub.entries) != len(other_sub.entries):
                        issues.append(
                            Issue(
                                id=str(uuid.uuid4()),
                                issue_type=IssueType.MISSING_SEGMENT,
                                severity=IssueSeverity.CRITICAL,
                                message=f"第 {episode} 集 {lang.value} 和 {other_lang.value} 字幕条数不一致",
                                episode=episode,
                                details={
                                    f"{lang.value}_count": len(lang_sub.entries),
                                    f"{other_lang.value}_count": len(other_sub.entries),
                                },
                            )
                        )

            if script_files:
                episode_scripts = [s for s in script_files if s.episode == episode]
                for script in episode_scripts:
                    for sub_file in episode_subs:
                        if len(sub_file.entries) < len(script.entries):
                            issues.append(
                                Issue(
                                    id=str(uuid.uuid4()),
                                    issue_type=IssueType.MISSING_SEGMENT,
                                    severity=IssueSeverity.WARNING,
                                    message=f"第 {episode} 集 {sub_file.language.value} 字幕条数 ({len(sub_file.entries)}) 少于台本条数 ({len(script.entries)})",
                                    language=sub_file.language,
                                    episode=episode,
                                    filename=sub_file.filename,
                                    details={
                                        "subtitle_count": len(sub_file.entries),
                                        "script_count": len(script.entries),
                                    },
                                )
                            )

        return issues

    def _check_placeholder_consistency(
        self,
        subtitle_files: list[SubtitleFile],
        script_files: list[ScriptFile] = None,
    ) -> list[Issue]:
        issues = []

        placeholder_pattern = re.compile(self.PLACEHOLDER_PATTERN)

        for sub_file in subtitle_files:
            for entry in sub_file.entries:
                placeholders = placeholder_pattern.findall(entry.original_text or entry.text)
                if placeholders:
                    translation_placeholders = placeholder_pattern.findall(entry.text)
                    if sorted(placeholders) != sorted(translation_placeholders):
                        issues.append(
                            Issue(
                                id=str(uuid.uuid4()),
                                issue_type=IssueType.PLACEHOLDER_MISSING,
                                severity=IssueSeverity.CRITICAL,
                                message=f"第 {entry.index} 条占位符不匹配",
                                language=sub_file.language,
                                episode=sub_file.episode,
                                subtitle_index=entry.index,
                                filename=sub_file.filename,
                                details={
                                    "original_placeholders": placeholders,
                                    "translation_placeholders": translation_placeholders,
                                    "original_text": entry.original_text or entry.text,
                                    "translation_text": entry.text,
                                },
                            )
                        )

            if script_files:
                episode_scripts = [s for s in script_files if s.episode == sub_file.episode]
                for script in episode_scripts:
                    for script_entry in script.entries:
                        script_placeholders = placeholder_pattern.findall(
                            script_entry.original_text
                        )
                        if script_placeholders:
                            if script_entry.translated_text:
                                trans_placeholders = placeholder_pattern.findall(
                                    script_entry.translated_text
                                )
                                if sorted(script_placeholders) != sorted(trans_placeholders):
                                    issues.append(
                                        Issue(
                                            id=str(uuid.uuid4()),
                                            issue_type=IssueType.PLACEHOLDER_MISSING,
                                            severity=IssueSeverity.CRITICAL,
                                            message=f"台本第 {script_entry.index} 条占位符不匹配",
                                            language=script.language,
                                            episode=script.episode,
                                            details={
                                                "script_placeholders": script_placeholders,
                                                "trans_placeholders": trans_placeholders,
                                                "original": script_entry.original_text,
                                                "translation": script_entry.translated_text,
                                            },
                                        )
                                    )

        return issues

    def _check_currency_consistency(
        self,
        subtitle_files: list[SubtitleFile],
        script_files: list[ScriptFile] = None,
    ) -> list[Issue]:
        issues = []

        for sub_file in subtitle_files:
            for entry in sub_file.entries:
                original_numbers = self._extract_currency_numbers(
                    entry.original_text or entry.text
                )
                translation_numbers = self._extract_currency_numbers(entry.text)

                if original_numbers and sorted(original_numbers) != sorted(translation_numbers):
                    issues.append(
                        Issue(
                            id=str(uuid.uuid4()),
                            issue_type=IssueType.CURRENCY_MISMATCH,
                            severity=IssueSeverity.WARNING,
                            message=f"第 {entry.index} 条金额数字可能不匹配",
                            language=sub_file.language,
                            episode=sub_file.episode,
                            subtitle_index=entry.index,
                            filename=sub_file.filename,
                            details={
                                "original_numbers": original_numbers,
                                "translation_numbers": translation_numbers,
                                "original_text": entry.original_text or entry.text,
                                "translation_text": entry.text,
                            },
                        )
                    )

        return issues

    def _extract_currency_numbers(self, text: str) -> list[float]:
        numbers = []
        for pattern in self.CURRENCY_PATTERNS:
            matches = re.findall(pattern, text)
            for match in matches:
                try:
                    num_str = match.replace(",", "")
                    numbers.append(float(num_str))
                except ValueError:
                    pass

        general_numbers = re.findall(r"(\d+(?:,\d{3})*(?:\.\d+)?)", text)
        for num_str in general_numbers:
            try:
                num = float(num_str.replace(",", ""))
                if num >= 100 and num not in numbers:
                    numbers.append(num)
            except ValueError:
                pass

        return numbers

    def _check_speaker_consistency(
        self, subtitle_files: list[SubtitleFile]
    ) -> list[Issue]:
        issues = []

        episodes = set()
        for sub_file in subtitle_files:
            if sub_file.episode:
                episodes.add(sub_file.episode)

        for episode in episodes:
            episode_subs = [s for s in subtitle_files if s.episode == episode]
            if len(episode_subs) < 2:
                continue

            speaker_map: dict[int, set[str]] = {}

            for sub_file in episode_subs:
                for entry in sub_file.entries:
                    if entry.speaker:
                        if entry.index not in speaker_map:
                            speaker_map[entry.index] = set()
                        speaker_map[entry.index].add(entry.speaker.lower())

            for index, speakers in speaker_map.items():
                if len(speakers) > 1:
                    issues.append(
                        Issue(
                            id=str(uuid.uuid4()),
                            issue_type=IssueType.SPEAKER_TAG_MISMATCH,
                            severity=IssueSeverity.WARNING,
                            message=f"第 {episode} 集第 {index} 条说话人标签不一致",
                            episode=episode,
                            subtitle_index=index,
                            details={
                                "speakers": list(speakers),
                            },
                        )
                    )

        return issues

    def create_quarantine(self, issues: list[Issue]) -> Quarantine:
        return Quarantine(
            issues=issues,
        )
