"""
Markdown解析器 - 解析庭审笔录Markdown文件
"""

import re
from typing import List, Dict, Any, Tuple, Optional
from pathlib import Path

from ..rules.validation_rules import (
    TranscriptSegment,
    EvidenceAnchor,
    ValidationError,
    ErrorType,
    ValidationRules
)


class TranscriptMarkdownParser:
    SPEAKER_PATTERN = re.compile(r"^【(.+?)】(.+)$", re.MULTILINE)
    TIMESTAMP_PATTERN = re.compile(r"^\[(.+?)\](.+)$", re.MULTILINE)
    EVIDENCE_ANCHOR_PATTERN = re.compile(
        r"[证Z]?\d{1,4}(-\d+)?(?:第(\d+(?:-\d+)?)(?:页|页第\d+页)?)?",
        re.UNICODE
    )
    EVIDENCE_WITH_PAGE_PATTERN = re.compile(
        r"[证Z]?(\d{1,4}(?:-\d+)?)(?:\s*[第页]\s*(\d+(?:-\d+)?)(?:页)?)?",
        re.UNICODE
    )
    PAGE_ONLY_PATTERN = re.compile(r"第(\d+(?:-\d+)?)页", re.UNICODE)

    @classmethod
    def parse(cls, file_path: str) -> Tuple[List[TranscriptSegment], List[ValidationError]]:
        segments = []
        errors = []
        path = Path(file_path)

        if not path.exists():
            errors.append(ValidationError(
                error_type=ErrorType.FIELD_MISSING,
                message=f"文件不存在: {file_path}",
                location="文件系统",
                suggestion="请检查文件路径是否正确"
            ))
            return segments, errors

        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()

        lines = content.split('\n')
        current_timestamp = ""
        current_speaker = ""
        current_content = []
        line_num = 0

        for i, line in enumerate(lines):
            line_num = i + 1
            line = line.rstrip()

            timestamp_match = cls.TIMESTAMP_PATTERN.match(line)
            if timestamp_match:
                if current_content:
                    segment = cls._create_segment(
                        current_timestamp,
                        current_speaker,
                        current_content,
                        line_num - len(current_content)
                    )
                    if segment:
                        segments.append(segment)
                    current_content = []

                current_timestamp = timestamp_match.group(1).strip()
                remaining = timestamp_match.group(2).strip()

                if remaining:
                    speaker_match = cls.SPEAKER_PATTERN.match(remaining)
                    if speaker_match:
                        current_speaker = speaker_match.group(1).strip()
                        current_content = [speaker_match.group(2).strip()]
                    else:
                        current_content = [remaining]
                else:
                    current_content = []
                continue

            speaker_match = cls.SPEAKER_PATTERN.match(line)
            if speaker_match:
                if current_content:
                    segment = cls._create_segment(
                        current_timestamp,
                        current_speaker,
                        current_content,
                        line_num - len(current_content)
                    )
                    if segment:
                        segments.append(segment)
                    current_content = []

                current_speaker = speaker_match.group(1).strip()
                current_content = [speaker_match.group(2).strip()]
                continue

            if line.strip():
                current_content.append(line.strip())

        if current_content:
            segment = cls._create_segment(
                current_timestamp,
                current_speaker,
                current_content,
                line_num - len(current_content) + 1
            )
            if segment:
                segments.append(segment)

        for segment in segments:
            anchors = cls._extract_evidence_anchors(segment)
            segment.anchors = anchors

        return segments, errors

    @classmethod
    def _create_segment(
        cls,
        timestamp: str,
        speaker: str,
        content_lines: List[str],
        start_line: int
    ) -> Optional[TranscriptSegment]:
        if not content_lines and not speaker:
            return None

        return TranscriptSegment(
            timestamp=timestamp,
            speaker=speaker,
            content='\n'.join(content_lines),
            line_number=start_line
        )

    @classmethod
    def _extract_evidence_anchors(cls, segment: TranscriptSegment) -> List[EvidenceAnchor]:
        anchors = []
        content = segment.content

        pattern1 = r"[证Z](\d{1,4}(?:-\d+)?)\s*第(\d+(?:-\d+)?)页"
        for match in re.finditer(pattern1, content):
            evidence_num = match.group(1)
            page_num = match.group(2)
            
            anchor = EvidenceAnchor(
                evidence_number=evidence_num,
                page_numbers=[page_num],
                speaker=segment.speaker,
                timestamp=segment.timestamp,
                transcript_line=segment.line_number,
                raw_text=match.group(0)
            )
            anchors.append(anchor)

        pattern2 = r"[证Z](\d{1,4}(?:-\d+)?)"
        used_positions = set((a.start(), a.end()) for a in re.finditer(pattern1, content))
        
        for match in re.finditer(pattern2, content):
            overlap = False
            for start, end in used_positions:
                if start <= match.start() < end or start < match.end() <= end:
                    overlap = True
                    break
            
            if overlap:
                continue
            
            evidence_num = match.group(1)
            page_numbers = []
            
            after_match = content[match.end():]
            next_match = re.search(r"第(\d+(?:-\d+)?)页", after_match)
            if next_match:
                page_numbers.append(next_match.group(1))
            
            anchor = EvidenceAnchor(
                evidence_number=evidence_num,
                page_numbers=page_numbers,
                speaker=segment.speaker,
                timestamp=segment.timestamp,
                transcript_line=segment.line_number,
                raw_text=match.group(0)
            )
            anchors.append(anchor)

        return anchors

    @classmethod
    def export(cls, segments: List[TranscriptSegment], file_path: str) -> None:
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        lines = []
        for segment in segments:
            if segment.timestamp:
                lines.append(f"[{segment.timestamp}]")
            if segment.speaker:
                lines.append(f"【{segment.speaker}】{segment.content}")
            else:
                lines.append(segment.content)

        with open(path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
