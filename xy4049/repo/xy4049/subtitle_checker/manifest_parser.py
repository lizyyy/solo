"""清单解析模块 - 解析台本 CSV 和交付清单 CSV"""

import csv
import hashlib
import re
from datetime import datetime
from io import StringIO
from pathlib import Path
from typing import Optional

from .models import (
    Language,
    ManifestFile,
    ManifestItem,
    ScriptEntry,
    ScriptFile,
)


class ScriptParser:
    @classmethod
    def parse_file(
        cls,
        filepath: Path,
        language: Optional[Language] = None,
        episode: Optional[int] = None,
    ) -> ScriptFile:
        content = cls._read_file(filepath)

        if language is None:
            language = cls._detect_language(filepath)
        if episode is None:
            episode = cls._detect_episode(filepath)

        entries = cls._parse_csv(content)

        return ScriptFile(
            filepath=str(filepath),
            filename=filepath.name,
            language=language,
            episode=episode,
            entries=entries,
            sha256=cls._calculate_sha256(content),
            imported_at=datetime.now(),
        )

    @staticmethod
    def _read_file(filepath: Path) -> str:
        try:
            with open(filepath, "r", encoding="utf-8-sig") as f:
                return f.read()
        except UnicodeDecodeError:
            import chardet

            with open(filepath, "rb") as f:
                raw_data = f.read()
                detected = chardet.detect(raw_data)
                encoding = detected.get("encoding", "utf-8")
                return raw_data.decode(encoding)

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
            "script": Language.ZH,
            "dialogue": Language.EN,
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
            r"(\d+)\.script",
            r"script_(\d+)",
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
    def _parse_csv(cls, content: str) -> list[ScriptEntry]:
        entries = []

        f = StringIO(content)
        reader = csv.DictReader(f)

        for row_idx, row in enumerate(reader, 1):
            index = cls._get_int_value(row, ["index", "序号", "id", "no", "num"], row_idx)
            original_text = cls._get_value(
                row, ["original_text", "原文", "source", "src", "text"]
            )
            translated_text = cls._get_value(
                row, ["translated_text", "译文", "target", "tgt", "translation"]
            )
            speaker = cls._get_value(row, ["speaker", "说话人", "角色", "role", "character"])
            start_timecode = cls._get_value(
                row, ["start_timecode", "start", "开始时间", "in", "tc_in"]
            )
            end_timecode = cls._get_value(
                row, ["end_timecode", "end", "结束时间", "out", "tc_out"]
            )

            if original_text:
                entries.append(
                    ScriptEntry(
                        index=index,
                        original_text=original_text.strip(),
                        translated_text=translated_text.strip() if translated_text else None,
                        speaker=speaker.strip() if speaker else None,
                        start_timecode=start_timecode.strip() if start_timecode else None,
                        end_timecode=end_timecode.strip() if end_timecode else None,
                    )
                )

        if not entries:
            entries = cls._try_simple_parse(content)

        return entries

    @classmethod
    def _try_simple_parse(cls, content: str) -> list[ScriptEntry]:
        entries = []
        lines = content.strip().split("\n")

        if len(lines) < 2:
            return entries

        header = lines[0].lower()
        if "text" in header or "原文" in header:
            return cls._parse_csv(content)

        for idx, line in enumerate(lines, 1):
            if not line.strip():
                continue
            entries.append(
                ScriptEntry(
                    index=idx,
                    original_text=line.strip(),
                    translated_text=None,
                    speaker=None,
                )
            )

        return entries

    @staticmethod
    def _get_value(row: dict, keys: list[str], default: str = "") -> str:
        for key in keys:
            if key in row and row[key]:
                return row[key]
            for row_key in row.keys():
                if key.lower() in row_key.lower() and row[row_key]:
                    return row[row_key]
        return default

    @staticmethod
    def _get_int_value(row: dict, keys: list[str], default: int) -> int:
        value_str = ScriptParser._get_value(row, keys, "")
        if value_str:
            try:
                return int(value_str)
            except ValueError:
                pass
        return default


class ManifestParser:
    @classmethod
    def parse_file(cls, filepath: Path) -> ManifestFile:
        content = cls._read_file(filepath)
        items = cls._parse_csv(content)

        return ManifestFile(
            filepath=str(filepath),
            filename=filepath.name,
            items=items,
            sha256=cls._calculate_sha256(content),
            imported_at=datetime.now(),
        )

    @staticmethod
    def _read_file(filepath: Path) -> str:
        try:
            with open(filepath, "r", encoding="utf-8-sig") as f:
                return f.read()
        except UnicodeDecodeError:
            import chardet

            with open(filepath, "rb") as f:
                raw_data = f.read()
                detected = chardet.detect(raw_data)
                encoding = detected.get("encoding", "utf-8")
                return raw_data.decode(encoding)

    @staticmethod
    def _calculate_sha256(content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    @classmethod
    def _parse_csv(cls, content: str) -> list[ManifestItem]:
        items = []

        f = StringIO(content)
        reader = csv.DictReader(f)

        for row in reader:
            episode = cls._get_int_value(row, ["episode", "集数", "ep", "no"], 0)
            original_filename = cls._get_value(
                row, ["original_filename", "原文件名", "original", "filename"]
            )
            expected_filename = cls._get_value(
                row, ["expected_filename", "期望文件名", "target", "output", "交付文件名"]
            )
            languages_str = cls._get_value(row, ["languages", "语言", "langs"])
            platform = cls._get_value(row, ["platform", "平台", "target_platform"])

            languages = cls._parse_languages(languages_str)

            if episode > 0 and original_filename:
                items.append(
                    ManifestItem(
                        episode=episode,
                        original_filename=original_filename.strip(),
                        expected_filename=expected_filename.strip() if expected_filename else "",
                        languages=languages,
                        platform=platform.strip() if platform else "",
                    )
                )

        return items

    @staticmethod
    def _parse_languages(languages_str: str) -> list[Language]:
        if not languages_str:
            return [Language.ZH, Language.EN]

        languages_str = languages_str.lower()
        result = []

        language_map = {
            "zh": Language.ZH,
            "cn": Language.ZH,
            "chinese": Language.ZH,
            "中文": Language.ZH,
            "en": Language.EN,
            "eng": Language.EN,
            "english": Language.EN,
            "英文": Language.EN,
            "ja": Language.JA,
            "jp": Language.JA,
            "japanese": Language.JA,
            "日文": Language.JA,
            "ko": Language.KO,
            "kr": Language.KO,
            "korean": Language.KO,
            "韩文": Language.KO,
        }

        separators = [",", ";", "|", "/", "、"]
        parts = [languages_str]
        for sep in separators:
            if sep in languages_str:
                parts = [p.strip() for p in languages_str.split(sep)]
                break

        for part in parts:
            for keyword, lang in language_map.items():
                if keyword in part and lang not in result:
                    result.append(lang)
                    break

        if not result:
            result = [Language.ZH, Language.EN]

        return result

    @staticmethod
    def _get_value(row: dict, keys: list[str], default: str = "") -> str:
        for key in keys:
            if key in row and row[key]:
                return row[key]
            for row_key in row.keys():
                if key.lower() in row_key.lower() and row[row_key]:
                    return row[row_key]
        return default

    @staticmethod
    def _get_int_value(row: dict, keys: list[str], default: int) -> int:
        value_str = ManifestParser._get_value(row, keys, "")
        if value_str:
            try:
                return int(value_str)
            except ValueError:
                pass
        return default
