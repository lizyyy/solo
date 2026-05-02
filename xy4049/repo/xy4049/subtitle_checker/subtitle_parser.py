"""字幕解析模块 - 支持 SRT 和 VTT 格式"""

import hashlib
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import (
    Language,
    SubtitleEntry,
    SubtitleFile,
    SubtitleFormat,
    Timecode,
)


class SubtitleParser:
    SRT_TIMECODE_PATTERN = re.compile(
        r"(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})"
    )
    VTT_TIMECODE_PATTERN = re.compile(
        r"(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})"
    )
    VTT_SHORT_TIMECODE_PATTERN = re.compile(
        r"(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2})\.(\d{3})"
    )

    @classmethod
    def parse_file(
        cls,
        filepath: Path,
        language: Optional[Language] = None,
        episode: Optional[int] = None,
    ) -> SubtitleFile:
        format = cls._detect_format(filepath)
        content = cls._read_file(filepath)

        if language is None:
            language = cls._detect_language(filepath)
        if episode is None:
            episode = cls._detect_episode(filepath)

        entries = cls._parse_content(content, format)

        return SubtitleFile(
            filepath=str(filepath),
            filename=filepath.name,
            language=language,
            format=format,
            episode=episode,
            entries=entries,
            sha256=cls._calculate_sha256(content),
            imported_at=datetime.now(),
        )

    @staticmethod
    def _read_file(filepath: Path) -> str:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return f.read()
        except UnicodeDecodeError:
            import chardet

            with open(filepath, "rb") as f:
                raw_data = f.read()
                detected = chardet.detect(raw_data)
                encoding = detected.get("encoding", "utf-8")
                return raw_data.decode(encoding)

    @staticmethod
    def _detect_format(filepath: Path) -> SubtitleFormat:
        suffix = filepath.suffix.lower()
        if suffix == ".srt":
            return SubtitleFormat.SRT
        elif suffix == ".vtt":
            return SubtitleFormat.VTT
        raise ValueError(f"不支持的字幕格式: {suffix}")

    @staticmethod
    def _detect_language(filepath: Path) -> Language:
        filename = filepath.stem.lower()
        language_map = {
            "zh": Language.ZH,
            "cn": Language.ZH,
            "chinese": Language.ZH,
            "en": Language.EN,
            "eng": Language.EN,
            "english": Language.EN,
            "ja": Language.JA,
            "jp": Language.JA,
            "japanese": Language.JA,
            "ko": Language.KO,
            "kr": Language.KO,
            "korean": Language.KO,
            "es": Language.ES,
            "spanish": Language.ES,
            "fr": Language.FR,
            "french": Language.FR,
            "de": Language.DE,
            "german": Language.DE,
            "ru": Language.RU,
            "russian": Language.RU,
        }

        for keyword, lang in language_map.items():
            if keyword in filename:
                return lang

        return Language.ZH

    @staticmethod
    def _detect_episode(filepath: Path) -> Optional[int]:
        filename = filepath.stem.lower()

        patterns = [
            r"ep(\d+)",
            r"episode(\d+)",
            r"_(\d+)_",
            r"-(\d+)-",
            r"第(\d+)集",
            r"(\d+)\.zh",
            r"(\d+)\.en",
        ]

        for pattern in patterns:
            match = re.search(pattern, filename)
            if match:
                return int(match.group(1))

        return None

    @staticmethod
    def _calculate_sha256(content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    @classmethod
    def _parse_content(cls, content: str, format: SubtitleFormat) -> list[SubtitleEntry]:
        entries = []

        if format == SubtitleFormat.SRT:
            entries = cls._parse_srt(content)
        elif format == SubtitleFormat.VTT:
            entries = cls._parse_vtt(content)

        return entries

    @classmethod
    def parse_srt(cls, content: str) -> list[SubtitleEntry]:
        return cls._parse_srt(content)

    @classmethod
    def _parse_srt(cls, content: str) -> list[SubtitleEntry]:
        entries = []
        blocks = re.split(r"\n\n+", content.strip())

        for block in blocks:
            lines = block.strip().split("\n")
            if len(lines) < 3:
                continue

            try:
                index = int(lines[0].strip())
            except ValueError:
                continue

            timecode_match = cls.SRT_TIMECODE_PATTERN.match(lines[1])
            if not timecode_match:
                continue

            start = Timecode(
                hours=int(timecode_match.group(1)),
                minutes=int(timecode_match.group(2)),
                seconds=int(timecode_match.group(3)),
                milliseconds=int(timecode_match.group(4)),
            )
            end = Timecode(
                hours=int(timecode_match.group(5)),
                minutes=int(timecode_match.group(6)),
                seconds=int(timecode_match.group(7)),
                milliseconds=int(timecode_match.group(8)),
            )

            text_lines = lines[2:]
            text = "\n".join(text_lines).strip()

            speaker = cls._extract_speaker(text)
            if speaker:
                text = text.replace(f"[{speaker}]", "").replace(f"【{speaker}】", "").strip()

            entries.append(
                SubtitleEntry(
                    index=index,
                    start=start,
                    end=end,
                    text=text,
                    speaker=speaker,
                    original_text=text,
                )
            )

        return entries

    @classmethod
    def parse_vtt(cls, content: str) -> list[SubtitleEntry]:
        return cls._parse_vtt(content)

    @classmethod
    def _parse_vtt(cls, content: str) -> list[SubtitleEntry]:
        entries = []
        lines = content.split("\n")

        in_header = True
        index = 0
        current_start = None
        current_end = None
        current_text_lines = []
        current_speaker = None

        for line in lines:
            line = line.strip()

            if in_header:
                if line.startswith("WEBVTT") or not line:
                    continue
                in_header = False

            if not line:
                if current_start is not None and current_text_lines:
                    index += 1
                    text = "\n".join(current_text_lines).strip()
                    entries.append(
                        SubtitleEntry(
                            index=index,
                            start=current_start,
                            end=current_end,
                            text=text,
                            speaker=current_speaker,
                            original_text=text,
                        )
                    )
                current_start = None
                current_end = None
                current_text_lines = []
                current_speaker = None
                continue

            timecode_match = cls.VTT_TIMECODE_PATTERN.match(line)
            if not timecode_match:
                timecode_match = cls.VTT_SHORT_TIMECODE_PATTERN.match(line)

            if timecode_match:
                if len(timecode_match.groups()) == 8:
                    current_start = Timecode(
                        hours=int(timecode_match.group(1)),
                        minutes=int(timecode_match.group(2)),
                        seconds=int(timecode_match.group(3)),
                        milliseconds=int(timecode_match.group(4)),
                    )
                    current_end = Timecode(
                        hours=int(timecode_match.group(5)),
                        minutes=int(timecode_match.group(6)),
                        seconds=int(timecode_match.group(7)),
                        milliseconds=int(timecode_match.group(8)),
                    )
                else:
                    current_start = Timecode(
                        hours=0,
                        minutes=int(timecode_match.group(1)),
                        seconds=int(timecode_match.group(2)),
                        milliseconds=int(timecode_match.group(3)),
                    )
                    current_end = Timecode(
                        hours=0,
                        minutes=int(timecode_match.group(4)),
                        seconds=int(timecode_match.group(5)),
                        milliseconds=int(timecode_match.group(6)),
                    )
                continue

            if current_start is not None:
                speaker = cls._extract_speaker(line)
                if speaker and not current_speaker:
                    current_speaker = speaker
                    line = line.replace(f"<v {speaker}>", "").replace("</v>", "").strip()
                    line = line.replace(f"[{speaker}]", "").replace(f"【{speaker}】", "").strip()
                current_text_lines.append(line)

        if current_start is not None and current_text_lines:
            index += 1
            text = "\n".join(current_text_lines).strip()
            entries.append(
                SubtitleEntry(
                    index=index,
                    start=current_start,
                    end=current_end,
                    text=text,
                    speaker=current_speaker,
                    original_text=text,
                )
            )

        return entries

    @staticmethod
    def _extract_speaker(text: str) -> Optional[str]:
        patterns = [
            r"<v\s+([^>]+)>",
            r"\[([^\]]+)\]",
            r"【([^】]+)】",
        ]

        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()

        return None

    @staticmethod
    def to_srt(entries: list[SubtitleEntry]) -> str:
        lines = []
        for i, entry in enumerate(entries, 1):
            lines.append(str(i))
            lines.append(f"{entry.start.to_srt_format()} --> {entry.end.to_srt_format()}")
            if entry.speaker:
                lines.append(f"[{entry.speaker}] {entry.text}")
            else:
                lines.append(entry.text)
            lines.append("")

        return "\n".join(lines)

    @staticmethod
    def to_vtt(entries: list[SubtitleEntry]) -> str:
        lines = ["WEBVTT", ""]
        for i, entry in enumerate(entries, 1):
            lines.append(str(i))
            lines.append(f"{entry.start.to_vtt_format()} --> {entry.end.to_vtt_format()}")
            if entry.speaker:
                lines.append(f"<v {entry.speaker}> {entry.text}")
            else:
                lines.append(entry.text)
            lines.append("")

        return "\n".join(lines)
