import csv
import json
import re
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, TextIO
from dateutil.parser import parse as parse_dateutil

from podcast_checker.models.schemas import (
    Episode,
    LoudnessCheckResult,
    AdAuthorization,
    MusicAuthorization,
    CoverImage,
)


def parse_date(value: str) -> Optional[date]:
    if not value or not value.strip():
        return None
    try:
        return parse_dateutil(value.strip()).date()
    except (ValueError, TypeError):
        return None


def parse_int(value: str, default: Optional[int] = None) -> Optional[int]:
    if not value or not value.strip():
        return default
    try:
        return int(value.strip())
    except (ValueError, TypeError):
        return default


def parse_float(value: str, default: Optional[float] = None) -> Optional[float]:
    if not value or not value.strip():
        return default
    try:
        return float(value.strip())
    except (ValueError, TypeError):
        return default


def parse_list(value: str) -> List[str]:
    if not value or not value.strip():
        return []
    items = [item.strip() for item in value.split(",")]
    return [item for item in items if item]


class EpisodeCSVParser:
    REQUIRED_COLUMNS = {"episode_number", "title"}
    
    COLUMN_MAPPING = {
        "episode_number": ["episode_number", "episode", "集号", "序号", "ep", "ep_number"],
        "title": ["title", "标题", "name", "名称", "episode_title"],
        "publish_date": ["publish_date", "发布日期", "date", "release_date", "上线日期"],
        "audio_file": ["audio_file", "音频文件", "audio", "file_name", "filename"],
        "duration_seconds": ["duration_seconds", "时长", "duration", "秒数", "seconds"],
        "sponsors": ["sponsors", "赞助商", "广告", "ad_sponsors", "ads"],
        "music_tracks": ["music_tracks", "音乐", "背景音乐", "bgm", "music"],
        "cover_file": ["cover_file", "封面", "cover", "cover_image", "封面文件"],
        "description": ["description", "描述", "简介", "description"],
    }
    
    @classmethod
    def detect_columns(cls, header: List[str]) -> Dict[str, str]:
        header_lower = [h.lower().strip() for h in header]
        mapping = {}
        
        for standard_name, alternatives in cls.COLUMN_MAPPING.items():
            for alt in alternatives:
                for i, h in enumerate(header_lower):
                    if alt == h or h.endswith(f"_{alt}") or h.startswith(f"{alt}_"):
                        mapping[standard_name] = header[i]
                        break
                if standard_name in mapping:
                    break
        
        return mapping
    
    @classmethod
    def parse(cls, file_path: Path) -> List[Episode]:
        episodes = []
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames:
                raise ValueError("CSV 文件没有表头")
            
            column_map = cls.detect_columns(list(reader.fieldnames))
            
            missing = cls.REQUIRED_COLUMNS - set(column_map.keys())
            if missing:
                raise ValueError(f"缺少必需的列: {missing}. 表头需要包含: {', '.join(cls.REQUIRED_COLUMNS)}")
            
            for row_num, row in enumerate(reader, start=2):
                try:
                    episode = cls._parse_row(row, column_map)
                    episodes.append(episode)
                except Exception as e:
                    raise ValueError(f"解析第 {row_num} 行失败: {e}")
        
        return episodes
    
    @classmethod
    def _parse_row(cls, row: Dict[str, str], column_map: Dict[str, str]) -> Episode:
        episode_number = parse_int(row.get(column_map.get("episode_number", ""), ""))
        if episode_number is None or episode_number < 1:
            raise ValueError(f"无效的集号: {row.get(column_map.get('episode_number'))}")
        
        title = row.get(column_map.get("title", ""), "").strip()
        if not title:
            raise ValueError("标题不能为空")
        
        return Episode(
            episode_number=episode_number,
            title=title,
            publish_date=parse_date(row.get(column_map.get("publish_date", ""), "")),
            audio_file=row.get(column_map.get("audio_file", ""), "").strip() or None,
            duration_seconds=parse_int(row.get(column_map.get("duration_seconds", ""), "")),
            sponsors=parse_list(row.get(column_map.get("sponsors", ""), "")),
            music_tracks=parse_list(row.get(column_map.get("music_tracks", ""), "")),
            cover_file=row.get(column_map.get("cover_file", ""), "").strip() or None,
            description=row.get(column_map.get("description", ""), "").strip() or None,
        )


class LoudnessCSVParser:
    REQUIRED_COLUMNS = {"audio_file", "integrated_lufs"}
    
    COLUMN_MAPPING = {
        "audio_file": ["audio_file", "文件名", "file", "文件名", "name"],
        "integrated_lufs": ["integrated_lufs", "lufs", "响度", "integrated", "响度值"],
        "true_peak_dbfs": ["true_peak_dbfs", "peak", "true_peak", "峰值", "peak_dbfs"],
        "loudness_range": ["loudness_range", "range", "响度范围", "lra"],
        "measured_at": ["measured_at", "测量时间", "time", "测量日期"],
    }
    
    @classmethod
    def detect_columns(cls, header: List[str]) -> Dict[str, str]:
        header_lower = [h.lower().strip() for h in header]
        mapping = {}
        
        for standard_name, alternatives in cls.COLUMN_MAPPING.items():
            for alt in alternatives:
                for i, h in enumerate(header_lower):
                    if alt == h or h.endswith(f"_{alt}") or h.startswith(f"{alt}_"):
                        mapping[standard_name] = header[i]
                        break
                if standard_name in mapping:
                    break
        
        return mapping
    
    @classmethod
    def parse(cls, file_path: Path) -> List[LoudnessCheckResult]:
        results = []
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames:
                raise ValueError("响度 CSV 文件没有表头")
            
            column_map = cls.detect_columns(list(reader.fieldnames))
            
            missing = cls.REQUIRED_COLUMNS - set(column_map.keys())
            if missing:
                raise ValueError(f"响度 CSV 缺少必需的列: {missing}")
            
            for row_num, row in enumerate(reader, start=2):
                try:
                    result = cls._parse_row(row, column_map)
                    results.append(result)
                except Exception as e:
                    raise ValueError(f"解析响度数据第 {row_num} 行失败: {e}")
        
        return results
    
    @classmethod
    def _parse_row(cls, row: Dict[str, str], column_map: Dict[str, str]) -> LoudnessCheckResult:
        audio_file = row.get(column_map.get("audio_file", ""), "").strip()
        if not audio_file:
            raise ValueError("音频文件名不能为空")
        
        integrated_lufs = parse_float(row.get(column_map.get("integrated_lufs", ""), ""))
        if integrated_lufs is None:
            raise ValueError(f"无效的响度值: {row.get(column_map.get('integrated_lufs'))}")
        
        measured_at_str = row.get(column_map.get("measured_at", ""), "").strip()
        measured_at = None
        if measured_at_str:
            try:
                measured_at = parse_dateutil(measured_at_str)
            except (ValueError, TypeError):
                measured_at = datetime.now()
        
        return LoudnessCheckResult(
            audio_file=audio_file,
            integrated_lufs=integrated_lufs,
            true_peak_dbfs=parse_float(row.get(column_map.get("true_peak_dbfs", ""), "")),
            loudness_range=parse_float(row.get(column_map.get("loudness_range", ""), "")),
            measured_at=measured_at or datetime.now(),
        )


class AdAuthorizationParser:
    @classmethod
    def parse(cls, file_path: Path) -> List[AdAuthorization]:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        auths = []
        
        if isinstance(data, list):
            for item in data:
                auths.append(cls._parse_item(item))
        elif isinstance(data, dict):
            if "authorizations" in data:
                for item in data["authorizations"]:
                    auths.append(cls._parse_item(item))
            elif "sponsor_id" in data:
                auths.append(cls._parse_item(data))
        
        return auths
    
    @classmethod
    def _parse_item(cls, item: Dict[str, Any]) -> AdAuthorization:
        episode_numbers = item.get("episode_numbers", item.get("episodes", []))
        if isinstance(episode_numbers, str):
            episode_numbers = parse_list(episode_numbers)
        if not isinstance(episode_numbers, list):
            episode_numbers = []
        
        episode_numbers = [
            int(n) for n in episode_numbers 
            if isinstance(n, (int, str)) and str(n).strip().isdigit()
        ]
        
        valid_from = parse_date(str(item.get("valid_from", item.get("start_date", ""))))
        valid_to = parse_date(str(item.get("valid_to", item.get("end_date", ""))))
        
        return AdAuthorization(
            sponsor_id=str(item.get("sponsor_id", item.get("id", item.get("sponsor", "")))).strip(),
            episode_numbers=episode_numbers,
            valid_from=valid_from or date.today(),
            valid_to=valid_to or date(2100, 12, 31),
            is_active=bool(item.get("is_active", item.get("active", True))),
            notes=str(item.get("notes", item.get("description", ""))).strip() or None,
        )


class MusicAuthorizationParser:
    @classmethod
    def parse(cls, file_path: Path) -> List[MusicAuthorization]:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        auths = []
        
        if isinstance(data, list):
            for item in data:
                auths.append(cls._parse_item(item))
        elif isinstance(data, dict):
            if "authorizations" in data:
                for item in data["authorizations"]:
                    auths.append(cls._parse_item(item))
            elif "track_id" in data:
                auths.append(cls._parse_item(data))
        
        return auths
    
    @classmethod
    def parse_directory(cls, directory: Path) -> List[MusicAuthorization]:
        auths = []
        for json_file in directory.glob("**/*.json"):
            try:
                auths.extend(cls.parse(json_file))
            except Exception:
                pass
        return auths
    
    @classmethod
    def _parse_item(cls, item: Dict[str, Any]) -> MusicAuthorization:
        episode_numbers = item.get("episode_numbers", item.get("episodes", []))
        if isinstance(episode_numbers, str):
            episode_numbers = parse_list(episode_numbers)
        if not isinstance(episode_numbers, list):
            episode_numbers = []
        
        episode_numbers = [
            int(n) for n in episode_numbers 
            if isinstance(n, (int, str)) and str(n).strip().isdigit()
        ]
        
        valid_from = parse_date(str(item.get("valid_from", item.get("start_date", ""))))
        valid_to = parse_date(str(item.get("valid_to", item.get("end_date", ""))))
        
        return MusicAuthorization(
            track_id=str(item.get("track_id", item.get("id", item.get("track", "")))).strip(),
            episode_numbers=episode_numbers,
            valid_from=valid_from or date.today(),
            valid_to=valid_to or date(2100, 12, 31),
            license_type=str(item.get("license_type", item.get("license", "standard"))).strip(),
            is_active=bool(item.get("is_active", item.get("active", True))),
            notes=str(item.get("notes", item.get("description", ""))).strip() or None,
        )


class CoverDirectoryParser:
    SUPPORTED_FORMATS = {".jpg", ".jpeg", ".png", ".webp"}
    
    EPISODE_PATTERNS = [
        re.compile(r"ep[_\s]?(\d+)", re.IGNORECASE),
        re.compile(r"episode[_\s]?(\d+)", re.IGNORECASE),
        re.compile(r"^(\d+)[_\s-]"),
        re.compile(r"[_\s-](\d+)$"),
        re.compile(r"cover[_\s]?(\d+)", re.IGNORECASE),
        re.compile(r"(\d+)[_\s]?cover", re.IGNORECASE),
    ]
    
    @classmethod
    def parse(cls, directory: Path) -> List[CoverImage]:
        covers = []
        
        if not directory.exists():
            return covers
        
        for file_path in directory.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in cls.SUPPORTED_FORMATS:
                try:
                    cover = cls._parse_file(file_path)
                    covers.append(cover)
                except Exception:
                    continue
        
        return covers
    
    @classmethod
    def _parse_file(cls, file_path: Path) -> CoverImage:
        from PIL import Image
        
        episode_number = cls._extract_episode_number(file_path.stem)
        
        with Image.open(file_path) as img:
            width, height = img.size
            img_format = img.format or file_path.suffix.lstrip(".")
        
        file_size = file_path.stat().st_size
        
        return CoverImage(
            file_name=file_path.name,
            episode_number=episode_number,
            width=width,
            height=height,
            format=img_format.upper(),
            file_size_bytes=file_size,
        )
    
    @classmethod
    def _extract_episode_number(cls, filename: str) -> Optional[int]:
        for pattern in cls.EPISODE_PATTERNS:
            match = pattern.search(filename)
            if match:
                try:
                    return int(match.group(1))
                except (ValueError, IndexError):
                    continue
        
        numbers = re.findall(r"\d+", filename)
        if len(numbers) == 1:
            try:
                return int(numbers[0])
            except ValueError:
                pass
        
        return None
