from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import hashlib
import re

from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import piexif

from .config import MaterialMetadata, MaterialType, ProjectConfig
from .exceptions import MetadataExtractionError


class FileHasher:
    @staticmethod
    def calculate_sha256(file_path: Path, chunk_size: int = 8192) -> str:
        sha256_hash = hashlib.sha256()
        try:
            with open(file_path, "rb") as f:
                for byte_block in iter(lambda: f.read(chunk_size), b""):
                    sha256_hash.update(byte_block)
            return sha256_hash.hexdigest()
        except (IOError, OSError) as e:
            raise MetadataExtractionError(f"计算文件哈希失败: {e}", str(file_path))


class EXIFParser:
    GPS_INFO_TAG = 34853
    DATE_TIME_TAG = 36867
    DATE_TIME_ORIGINAL_TAG = 36868
    MAKE_TAG = 271
    MODEL_TAG = 272
    FOCAL_LENGTH_TAG = 37386
    APERTURE_VALUE_TAG = 37378
    ISO_SPEED_RATINGS_TAG = 34855
    EXPOSURE_TIME_TAG = 33434

    @staticmethod
    def _dms_to_decimal(dms: tuple, ref: str) -> Optional[float]:
        if not dms or len(dms) != 3:
            return None

        try:
            degrees = dms[0][0] / dms[0][1] if dms[0][1] != 0 else 0
            minutes = dms[1][0] / dms[1][1] if dms[1][1] != 0 else 0
            seconds = dms[2][0] / dms[2][1] if dms[2][1] != 0 else 0

            decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)

            if ref in ["S", "W"]:
                decimal = -decimal

            return decimal
        except (TypeError, ZeroDivisionError):
            return None

    @staticmethod
    def _parse_gps_info(gps_info: Dict) -> Dict[str, Optional[float]]:
        result = {"latitude": None, "longitude": None, "altitude": None}

        try:
            if 2 in gps_info and 1 in gps_info:
                result["latitude"] = EXIFParser._dms_to_decimal(gps_info[2], gps_info[1])

            if 4 in gps_info and 3 in gps_info:
                result["longitude"] = EXIFParser._dms_to_decimal(gps_info[4], gps_info[3])

            if 6 in gps_info:
                alt_data = gps_info[6]
                if isinstance(alt_data, tuple) and len(alt_data) == 2:
                    result["altitude"] = alt_data[0] / alt_data[1] if alt_data[1] != 0 else 0
                elif isinstance(alt_data, (int, float)):
                    result["altitude"] = float(alt_data)
        except Exception:
            pass

        return result

    @staticmethod
    def _parse_date_time(date_str: bytes) -> Optional[datetime]:
        if not date_str:
            return None

        try:
            date_str = date_str.decode("utf-8", errors="ignore").strip()
            for fmt in ["%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y%m%d_%H%M%S"]:
                try:
                    return datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
        except Exception:
            pass

        return None

    @staticmethod
    def _safe_fraction(value: Any) -> Optional[float]:
        if isinstance(value, tuple) and len(value) == 2:
            if value[1] == 0:
                return None
            return value[0] / value[1]
        if isinstance(value, (int, float)):
            return float(value)
        return None

    @classmethod
    def extract_exif(cls, image_path: Path) -> Dict[str, Any]:
        metadata: Dict[str, Any] = {}

        try:
            with Image.open(image_path) as img:
                raw_exif = img._getexif() if hasattr(img, "_getexif") else None

                if not raw_exif:
                    try:
                        exif_data = piexif.load(str(image_path))
                        raw_exif = {}
                        for ifd_name, ifd_data in exif_data.items():
                            if isinstance(ifd_data, dict):
                                for tag, value in ifd_data.items():
                                    raw_exif[tag] = value
                    except Exception:
                        pass

                if raw_exif:
                    if cls.GPS_INFO_TAG in raw_exif:
                        gps_raw = raw_exif[cls.GPS_INFO_TAG]
                        if isinstance(gps_raw, bytes):
                            try:
                                gps_info = piexif.load(gps_raw)
                                gps_data = cls._parse_gps_info(gps_info.get("GPS", {}))
                            except Exception:
                                gps_data = {"latitude": None, "longitude": None, "altitude": None}
                        elif isinstance(gps_raw, dict):
                            gps_data = cls._parse_gps_info(gps_raw)
                        else:
                            gps_data = {"latitude": None, "longitude": None, "altitude": None}

                        metadata["latitude"] = gps_data["latitude"]
                        metadata["longitude"] = gps_data["longitude"]
                        metadata["altitude_meters"] = gps_data["altitude"]

                    for tag_key in [
                        cls.DATE_TIME_ORIGINAL_TAG,
                        cls.DATE_TIME_TAG,
                    ]:
                        if tag_key in raw_exif:
                            capture_time = cls._parse_date_time(raw_exif[tag_key])
                            if capture_time:
                                metadata["capture_time"] = capture_time
                                break

                    if cls.MAKE_TAG in raw_exif:
                        make = raw_exif[cls.MAKE_TAG]
                        if isinstance(make, bytes):
                            make = make.decode("utf-8", errors="ignore")
                        metadata["device_make"] = str(make).strip()

                    if cls.MODEL_TAG in raw_exif:
                        model = raw_exif[cls.MODEL_TAG]
                        if isinstance(model, bytes):
                            model = model.decode("utf-8", errors="ignore")
                        metadata["device_model"] = str(model).strip()

                    if cls.FOCAL_LENGTH_TAG in raw_exif:
                        focal = cls._safe_fraction(raw_exif[cls.FOCAL_LENGTH_TAG])
                        if focal:
                            metadata["camera_focal_length"] = focal

                    if cls.APERTURE_VALUE_TAG in raw_exif:
                        aperture = cls._safe_fraction(raw_exif[cls.APERTURE_VALUE_TAG])
                        if aperture:
                            metadata["camera_aperture"] = aperture

                    if cls.ISO_SPEED_RATINGS_TAG in raw_exif:
                        iso = raw_exif[cls.ISO_SPEED_RATINGS_TAG]
                        if isinstance(iso, (list, tuple)) and iso:
                            iso = iso[0]
                        if isinstance(iso, (int, float)):
                            metadata["camera_iso"] = int(iso)

                    if cls.EXPOSURE_TIME_TAG in raw_exif:
                        exposure = raw_exif[cls.EXPOSURE_TIME_TAG]
                        if isinstance(exposure, tuple) and len(exposure) == 2:
                            metadata["camera_shutter_speed"] = f"{exposure[0]}/{exposure[1]}"
                        elif isinstance(exposure, (int, float)):
                            metadata["camera_shutter_speed"] = str(exposure)

                    for tag_id, tag_name in TAGS.items():
                        if tag_id in raw_exif:
                            value = raw_exif[tag_id]
                            if isinstance(value, bytes):
                                try:
                                    value = value.decode("utf-8", errors="ignore")
                                except Exception:
                                    continue
                            metadata[f"exif_{tag_name}"] = value

        except Exception as e:
            raise MetadataExtractionError(f"读取EXIF数据失败: {e}", str(image_path))

        return metadata


class VideoMetadataExtractor:
    @staticmethod
    def _try_parse_datetime(value: Any) -> Optional[datetime]:
        if not value:
            return None

        value_str = str(value).strip()

        patterns = [
            "%Y-%m-%d %H:%M:%S",
            "%Y:%m:%d %H:%M:%S",
            "%Y%m%d_%H%M%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
        ]

        for pattern in patterns:
            try:
                return datetime.strptime(value_str, pattern)
            except ValueError:
                continue

        return None

    @classmethod
    def extract_metadata(cls, video_path: Path) -> Dict[str, Any]:
        metadata: Dict[str, Any] = {}

        try:
            import ffmpeg

            try:
                probe = ffmpeg.probe(str(video_path))
            except ffmpeg.Error as e:
                raise MetadataExtractionError(
                    f"ffmpeg probe失败: {e.stderr.decode() if e.stderr else str(e)}",
                    str(video_path),
                )

            if "format" in probe:
                format_info = probe["format"]

                if "duration" in format_info:
                    try:
                        metadata["video_duration_seconds"] = float(format_info["duration"])
                    except (TypeError, ValueError):
                        pass

                if "size" in format_info:
                    try:
                        metadata["file_size_bytes"] = int(format_info["size"])
                    except (TypeError, ValueError):
                        pass

                if "tags" in format_info:
                    tags = format_info["tags"]

                    for key in ["creation_time", "date", "DateTimeOriginal", "com.apple.quicktime.creationdate"]:
                        if key in tags:
                            capture_time = cls._try_parse_datetime(tags[key])
                            if capture_time:
                                metadata["capture_time"] = capture_time
                                break

                    for key in ["make", "com.apple.quicktime.make"]:
                        if key in tags:
                            metadata["device_make"] = str(tags[key]).strip()

                    for key in ["model", "com.apple.quicktime.model"]:
                        if key in tags:
                            metadata["device_model"] = str(tags[key]).strip()

                    if "location" in tags:
                        location_str = str(tags["location"])
                        match = re.search(r"([+-]?\d+\.?\d*)[ ,/]+([+-]?\d+\.?\d*)", location_str)
                        if match:
                            try:
                                metadata["latitude"] = float(match.group(1))
                                metadata["longitude"] = float(match.group(2))
                            except ValueError:
                                pass

            if "streams" in probe:
                for stream in probe["streams"]:
                    if stream.get("codec_type") == "video":
                        width = stream.get("width")
                        height = stream.get("height")
                        if width and height:
                            metadata["video_resolution"] = f"{width}x{height}"

                        r_frame_rate = stream.get("r_frame_rate")
                        if r_frame_rate and r_frame_rate != "0/0":
                            try:
                                num, den = map(int, r_frame_rate.split("/"))
                                if den > 0:
                                    metadata["video_frame_rate"] = num / den
                            except (ValueError, ZeroDivisionError):
                                pass

                        if "tags" in stream:
                            stream_tags = stream["tags"]
                            for key in ["creation_time", "date"]:
                                if key in stream_tags and "capture_time" not in metadata:
                                    capture_time = cls._try_parse_datetime(stream_tags[key])
                                    if capture_time:
                                        metadata["capture_time"] = capture_time
                                        break

                        break

        except ImportError:
            raise MetadataExtractionError(
                "ffmpeg-python未安装，无法解析视频元数据",
                str(video_path),
            )
        except Exception as e:
            raise MetadataExtractionError(f"解析视频元数据失败: {e}", str(video_path))

        return metadata


class MaterialScanner:
    def __init__(self, config: ProjectConfig) -> None:
        self.config = config
        self.exif_parser = EXIFParser()
        self.video_extractor = VideoMetadataExtractor()
        self.file_hasher = FileHasher()

    def _get_material_type(self, file_path: Path) -> Optional[MaterialType]:
        extension = file_path.suffix.lower()

        for material_type, extensions in self.config.material_extensions.items():
            if extension in extensions:
                return material_type

        return None

    def scan_file(self, file_path: Path) -> Optional[MaterialMetadata]:
        if not file_path.exists() or not file_path.is_file():
            return None

        material_type = self._get_material_type(file_path)
        if material_type is None:
            return None

        try:
            file_stat = file_path.stat()
            file_hash = self.file_hasher.calculate_sha256(file_path)

            metadata = MaterialMetadata(
                file_path=str(file_path),
                file_name=file_path.name,
                material_type=material_type,
                file_size_bytes=file_stat.st_size,
                hash_sha256=file_hash,
            )

            if material_type == MaterialType.PHOTO:
                exif_data = self.exif_parser.extract_exif(file_path)

                if "latitude" in exif_data:
                    metadata.latitude = exif_data["latitude"]
                if "longitude" in exif_data:
                    metadata.longitude = exif_data["longitude"]
                if "altitude_meters" in exif_data:
                    metadata.altitude_meters = exif_data["altitude_meters"]
                if "capture_time" in exif_data:
                    metadata.capture_time = exif_data["capture_time"]
                if "device_model" in exif_data:
                    metadata.device_model = exif_data["device_model"]
                if "camera_focal_length" in exif_data:
                    metadata.camera_focal_length = exif_data["camera_focal_length"]
                if "camera_aperture" in exif_data:
                    metadata.camera_aperture = exif_data["camera_aperture"]
                if "camera_iso" in exif_data:
                    metadata.camera_iso = exif_data["camera_iso"]
                if "camera_shutter_speed" in exif_data:
                    metadata.camera_shutter_speed = exif_data["camera_shutter_speed"]

                metadata.custom_metadata = {
                    k: v for k, v in exif_data.items() if k.startswith("exif_")
                }

            elif material_type == MaterialType.VIDEO:
                video_data = self.video_extractor.extract_metadata(file_path)

                if "latitude" in video_data:
                    metadata.latitude = video_data["latitude"]
                if "longitude" in video_data:
                    metadata.longitude = video_data["longitude"]
                if "capture_time" in video_data:
                    metadata.capture_time = video_data["capture_time"]
                if "device_model" in video_data:
                    metadata.device_model = video_data["device_model"]
                if "video_resolution" in video_data:
                    metadata.video_resolution = video_data["video_resolution"]
                if "video_frame_rate" in video_data:
                    metadata.video_frame_rate = video_data["video_frame_rate"]
                if "video_duration_seconds" in video_data:
                    metadata.video_duration_seconds = video_data["video_duration_seconds"]

            self._parse_filename_patterns(metadata, file_path)

            return metadata

        except Exception as e:
            raise MetadataExtractionError(f"扫描文件失败: {e}", str(file_path))

    def _parse_filename_patterns(self, metadata: MaterialMetadata, file_path: Path) -> None:
        filename = file_path.stem.lower()

        flight_line_match = re.search(r"[Ll](\d{2,3})", filename)
        if flight_line_match:
            try:
                metadata.flight_line = int(flight_line_match.group(1))
            except ValueError:
                pass

        waypoint_match = re.search(r"[Ww](\d{2,3})", filename)
        if waypoint_match:
            try:
                metadata.waypoint_number = int(waypoint_match.group(1))
            except ValueError:
                pass

        gimbal_match = re.search(r"[Gg]([+-]?\d+)", filename)
        if gimbal_match:
            try:
                metadata.gimbal_pitch = float(gimbal_match.group(1))
            except ValueError:
                pass

    def scan_directory(self, directory_path: Path, recursive: bool = True) -> List[MaterialMetadata]:
        results: List[MaterialMetadata] = []

        if not directory_path.exists():
            return results

        if recursive:
            file_iterator = directory_path.rglob("*")
        else:
            file_iterator = directory_path.glob("*")

        for file_path in file_iterator:
            if file_path.is_file():
                metadata = self.scan_file(file_path)
                if metadata:
                    results.append(metadata)

        return results
