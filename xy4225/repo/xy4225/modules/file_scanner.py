import os
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import re


@dataclass
class MediaPair:
    name_base: str
    video_path: Optional[Path] = None
    srt_path: Optional[Path] = None
    video_duration: float = 0.0


@dataclass
class ScanResult:
    media_pairs: List[MediaPair]
    glossary_path: Optional[Path]
    errors: List[Dict]


class FileScanner:
    VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv'}
    SRT_EXTENSIONS = {'.srt'}
    GLOSSARY_PATTERNS = [
        re.compile(r'术语表', re.IGNORECASE),
        re.compile(r'glossary', re.IGNORECASE),
        re.compile(r'违禁词', re.IGNORECASE),
        re.compile(r'forbidden', re.IGNORECASE),
    ]

    def __init__(self, project_dir: str):
        self.project_dir = Path(project_dir)
        if not self.project_dir.exists():
            raise ValueError(f"目录不存在: {project_dir}")

    def scan(self) -> ScanResult:
        media_files: Dict[str, MediaPair] = {}
        glossary_path: Optional[Path] = None
        errors: List[Dict] = []

        for file_path in self.project_dir.rglob('*'):
            if not file_path.is_file():
                continue

            suffix = file_path.suffix.lower()
            name_base = file_path.stem

            if self._is_glossary_file(file_path):
                if glossary_path is None:
                    glossary_path = file_path
                continue

            if suffix in self.VIDEO_EXTENSIONS:
                if name_base not in media_files:
                    media_files[name_base] = MediaPair(name_base=name_base)
                if media_files[name_base].video_path is not None:
                    errors.append({
                        'type': 'naming',
                        'file': str(file_path),
                        'message': f"重复的视频文件: {name_base}，已存在: {media_files[name_base].video_path}"
                    })
                media_files[name_base].video_path = file_path

            elif suffix in self.SRT_EXTENSIONS:
                if name_base not in media_files:
                    media_files[name_base] = MediaPair(name_base=name_base)
                if media_files[name_base].srt_path is not None:
                    errors.append({
                        'type': 'naming',
                        'file': str(file_path),
                        'message': f"重复的字幕文件: {name_base}，已存在: {media_files[name_base].srt_path}"
                    })
                media_files[name_base].srt_path = file_path

        for name_base, pair in media_files.items():
            if pair.video_path is None:
                errors.append({
                    'type': 'naming',
                    'file': str(pair.srt_path) if pair.srt_path else name_base,
                    'message': f"字幕文件缺少对应的视频: {name_base}"
                })
            if pair.srt_path is None:
                errors.append({
                    'type': 'naming',
                    'file': str(pair.video_path) if pair.video_path else name_base,
                    'message': f"视频文件缺少对应的字幕: {name_base}"
                })

        return ScanResult(
            media_pairs=list(media_files.values()),
            glossary_path=glossary_path,
            errors=errors
        )

    def _is_glossary_file(self, file_path: Path) -> bool:
        if file_path.suffix.lower() not in {'.txt', '.csv', '.xlsx', '.xls'}:
            return False
        for pattern in self.GLOSSARY_PATTERNS:
            if pattern.search(file_path.name):
                return True
        return False
