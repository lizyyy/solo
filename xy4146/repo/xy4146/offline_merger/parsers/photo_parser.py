import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from PIL import Image
from PIL.ExifTags import GPSTAGS, TAGS

from offline_merger.parsers.base_parser import (
    BaseParser,
    FileType,
    ParseResult,
    WayPoint,
)


class PhotoParser(BaseParser):
    SUPPORTED_EXTENSIONS = ["jpg", "jpeg", "png", "heic"]

    def parse(self, file_path: str, source_package: str) -> ParseResult:
        self.clear_errors()
        photo_metadata = {}
        waypoint: Optional[WayPoint] = None

        try:
            with Image.open(file_path) as img:
                photo_metadata["format"] = img.format
                photo_metadata["size"] = img.size
                photo_metadata["mode"] = img.mode

                exif_data = img._getexif()
                if exif_data:
                    exif_info = {}
                    gps_info = {}

                    for tag_id, value in exif_data.items():
                        tag = TAGS.get(tag_id, tag_id)
                        if tag == "GPSInfo":
                            for gps_tag_id, gps_value in value.items():
                                gps_tag = GPSTAGS.get(gps_tag_id, gps_tag_id)
                                gps_info[gps_tag] = gps_value
                        else:
                            exif_info[tag] = self._convert_exif_value(value)

                    photo_metadata["exif"] = exif_info

                    if "DateTimeOriginal" in exif_info:
                        try:
                            photo_metadata["timestamp"] = datetime.strptime(
                                exif_info["DateTimeOriginal"], "%Y:%m:%d %H:%M:%S"
                            )
                        except (ValueError, TypeError):
                            self.add_warning(f"无法解析拍摄时间: {exif_info.get('DateTimeOriginal')}")

                    if gps_info:
                        lat, lon = self._extract_gps_coordinates(gps_info)
                        if lat is not None and lon is not None:
                            elevation = self._extract_elevation(gps_info)
                            photo_metadata["latitude"] = lat
                            photo_metadata["longitude"] = lon
                            photo_metadata["elevation"] = elevation

                            waypoint = WayPoint(
                                name=Path(file_path).stem,
                                lat=lat,
                                lon=lon,
                                elevation=elevation,
                                timestamp=photo_metadata.get("timestamp"),
                                description=f"照片: {Path(file_path).name}",
                            )

        except Exception as e:
            self.add_error(f"解析照片失败: {str(e)}")

        metadata = self._get_file_metadata(
            file_path=file_path,
            source_package=source_package,
            file_type=FileType.PHOTO,
        )

        result = ParseResult(
            metadata=metadata,
            photo_metadata=photo_metadata,
        )

        if waypoint:
            result.waypoints.append(waypoint)

        return result

    def _convert_exif_value(self, value: Any) -> Any:
        if isinstance(value, bytes):
            try:
                return value.decode("utf-16-le").rstrip("\x00")
            except:
                try:
                    return value.decode("utf-8").rstrip("\x00")
                except:
                    return str(value)
        elif isinstance(value, tuple):
            return tuple(self._convert_exif_value(v) for v in value)
        return value

    def _extract_gps_coordinates(self, gps_info: Dict) -> tuple:
        lat = None
        lon = None

        try:
            if "GPSLatitude" in gps_info and "GPSLatitudeRef" in gps_info:
                lat_values = gps_info["GPSLatitude"]
                lat_ref = gps_info["GPSLatitudeRef"]
                lat = self._convert_to_degrees(lat_values)
                if lat_ref != "N":
                    lat = -lat

            if "GPSLongitude" in gps_info and "GPSLongitudeRef" in gps_info:
                lon_values = gps_info["GPSLongitude"]
                lon_ref = gps_info["GPSLongitudeRef"]
                lon = self._convert_to_degrees(lon_values)
                if lon_ref != "E":
                    lon = -lon

        except Exception as e:
            self.add_warning(f"提取 GPS 坐标失败: {str(e)}")

        return lat, lon

    def _convert_to_degrees(self, value: tuple) -> float:
        if len(value) == 3:
            d, m, s = value
            return d + m / 60.0 + s / 3600.0
        elif len(value) == 2:
            d, m = value
            return d + m / 60.0
        return float(value[0]) if value else 0.0

    def _extract_elevation(self, gps_info: Dict) -> Optional[float]:
        try:
            if "GPSAltitude" in gps_info:
                altitude = gps_info["GPSAltitude"]
                if isinstance(altitude, tuple):
                    altitude = altitude[0]
                if "GPSAltitudeRef" in gps_info and gps_info["GPSAltitudeRef"] == 1:
                    return -float(altitude)
                return float(altitude)
        except Exception:
            pass
        return None
