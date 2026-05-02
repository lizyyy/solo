import csv
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from offline_merger.parsers.base_parser import (
    BaseParser,
    FileType,
    ParseResult,
    PointData,
)


class CSVParser(BaseParser):
    SUPPORTED_EXTENSIONS = ["csv"]

    LAT_COLUMN_NAMES = [
        "latitude", "lat", "纬度", "y坐标", "y", "wgs84_y",
    ]
    LON_COLUMN_NAMES = [
        "longitude", "lon", "lng", "经度", "x坐标", "x", "wgs84_x",
    ]
    ELEVATION_COLUMN_NAMES = [
        "elevation", "elev", "height", "altitude", "海拔", "高程", "h", "z",
    ]
    ID_COLUMN_NAMES = [
        "id", "point_id", "点位编号", "编号", "name", "名称", "point_name",
    ]
    TIME_COLUMN_NAMES = [
        "time", "timestamp", "datetime", "日期时间", "时间", "采集时间",
    ]
    ATTACHMENT_COLUMN_NAMES = [
        "attachment", "attachments", "照片", "图片", "image", "photo",
    ]

    def parse(self, file_path: str, source_package: str) -> ParseResult:
        self.clear_errors()
        points: List[PointData] = []

        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                content = f.read()

            dialect = csv.Sniffer().sniff(content) if content else csv.excel
            lines = content.splitlines()

            if not lines:
                self.add_warning("CSV 文件为空")
                metadata = self._get_file_metadata(file_path, source_package, FileType.CSV)
                return ParseResult(metadata=metadata)

            reader = csv.DictReader(lines, dialect=dialect)
            headers = [h.strip() for h in reader.fieldnames] if reader.fieldnames else []

            column_mapping = self._detect_columns(headers)

            if not column_mapping["lat"] or not column_mapping["lon"]:
                self.add_error("无法找到经纬度列")
                metadata = self._get_file_metadata(file_path, source_package, FileType.CSV)
                return ParseResult(metadata=metadata)

            for row_idx, row in enumerate(reader, start=2):
                try:
                    point = self._parse_row(row, column_mapping, row_idx, file_path, source_package)
                    if point:
                        points.append(point)
                except Exception as e:
                    self.add_warning(f"第 {row_idx} 行解析失败: {str(e)}")

        except Exception as e:
            self.add_error(f"解析 CSV 失败: {str(e)}")

        metadata = self._get_file_metadata(
            file_path=file_path,
            source_package=source_package,
            file_type=FileType.CSV,
        )

        return ParseResult(
            metadata=metadata,
            points=points,
        )

    def _detect_columns(self, headers: List[str]) -> Dict[str, Optional[str]]:
        mapping = {
            "lat": None,
            "lon": None,
            "elevation": None,
            "id": None,
            "time": None,
            "attachments": [],
            "other": [],
        }

        for header in headers:
            header_lower = header.lower().strip()

            if any(name in header_lower for name in self.LAT_COLUMN_NAMES):
                mapping["lat"] = header
            elif any(name in header_lower for name in self.LON_COLUMN_NAMES):
                mapping["lon"] = header
            elif any(name in header_lower for name in self.ELEVATION_COLUMN_NAMES):
                mapping["elevation"] = header
            elif any(name in header_lower for name in self.ID_COLUMN_NAMES) and not mapping["id"]:
                mapping["id"] = header
            elif any(name in header_lower for name in self.TIME_COLUMN_NAMES):
                mapping["time"] = header
            elif any(name in header_lower for name in self.ATTACHMENT_COLUMN_NAMES):
                mapping["attachments"].append(header)
            else:
                mapping["other"].append(header)

        return mapping

    def _parse_row(
        self,
        row: Dict[str, str],
        mapping: Dict[str, Any],
        row_idx: int,
        file_path: str,
        source_package: str,
    ) -> Optional[PointData]:
        lat_str = row.get(mapping["lat"], "").strip()
        lon_str = row.get(mapping["lon"], "").strip()

        if not lat_str or not lon_str:
            return None

        try:
            lat = self._parse_coordinate(lat_str)
            lon = self._parse_coordinate(lon_str)
        except ValueError as e:
            self.add_warning(f"第 {row_idx} 行坐标解析失败: {e}")
            return None

        point_id = row.get(mapping["id"], f"{Path(file_path).stem}_row_{row_idx}")

        elevation = None
        if mapping["elevation"]:
            elev_str = row.get(mapping["elevation"], "").strip()
            if elev_str:
                try:
                    elevation = float(elev_str)
                except ValueError:
                    pass

        timestamp = None
        if mapping["time"]:
            time_str = row.get(mapping["time"], "").strip()
            if time_str:
                timestamp = self._parse_time(time_str)

        attachments = []
        for att_col in mapping["attachments"]:
            att_val = row.get(att_col, "").strip()
            if att_val:
                attachments.append(att_val)

        attributes = {}
        for col in mapping["other"]:
            val = row.get(col, "").strip()
            if val:
                attributes[col] = val

        return PointData(
            point_id=point_id,
            lat=lat,
            lon=lon,
            elevation=elevation,
            timestamp=timestamp,
            attributes=attributes,
            attachments=attachments,
        )

    def _parse_coordinate(self, value: str) -> float:
        value = value.strip()

        if "°" in value or "'" in value or '"' in value:
            return self._dms_to_decimal(value)

        try:
            return float(value)
        except ValueError:
            value = value.replace(",", ".")
            return float(value)

    def _dms_to_decimal(self, value: str) -> float:
        match = re.match(r"(-?\d+(?:\.\d+)?)[°\s]*(?:(\d+(?:\.\d+)?)['′\s]*(?:(\d+(?:\.\d+)?)[\"″\s]*)?)?([NSEW]?)", value)
        if match:
            degrees = float(match.group(1))
            minutes = float(match.group(2)) if match.group(2) else 0.0
            seconds = float(match.group(3)) if match.group(3) else 0.0
            direction = match.group(4)

            decimal = degrees + minutes / 60.0 + seconds / 3600.0

            if direction in ("S", "W"):
                decimal = -decimal

            return decimal

        raise ValueError(f"无法解析坐标格式: {value}")

    def _parse_time(self, time_str: str) -> Optional[datetime]:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y%m%d%H%M%S",
            "%Y-%m-%d",
            "%Y/%m/%d",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(time_str.strip(), fmt)
            except (ValueError, TypeError):
                continue

        return None
