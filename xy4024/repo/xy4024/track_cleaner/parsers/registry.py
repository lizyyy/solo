from pathlib import Path
from typing import Dict, Type, Optional

from track_cleaner.parsers.base import TrackParser
from track_cleaner.parsers.gpx_parser import GPXParser
from track_cleaner.parsers.kml_parser import KMLParser
from track_cleaner.parsers.csv_parser import CSVParser


PARSER_REGISTRY: Dict[str, Type[TrackParser]] = {
    "gpx": GPXParser,
    "kml": KMLParser,
    "kmz": KMLParser,
    "csv": CSVParser,
}


SUPPORTED_FORMATS = list(PARSER_REGISTRY.keys())


def get_parser_for_format(format_name: str) -> Type[TrackParser]:
    format_lower = format_name.lower()
    if format_lower not in PARSER_REGISTRY:
        raise ValueError(f"不支持的格式: {format_name}。支持的格式: {SUPPORTED_FORMATS}")
    return PARSER_REGISTRY[format_lower]


def get_parser_for_file(file_path: Path) -> Type[TrackParser]:
    suffix = file_path.suffix.lower().lstrip(".")
    if suffix not in PARSER_REGISTRY:
        raise ValueError(f"不支持的文件格式: {file_path.suffix}。支持的格式: {SUPPORTED_FORMATS}")
    return PARSER_REGISTRY[suffix]
