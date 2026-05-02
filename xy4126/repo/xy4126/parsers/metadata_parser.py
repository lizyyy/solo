from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
from dataclasses import dataclass


class MetadataParseError(Exception):
    pass


@dataclass
class ImageMetadata:
    file_path: str
    filename: str
    width: int = 0
    height: int = 0
    format: str = ""
    exif_timestamp: Optional[datetime] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    camera_make: str = ""
    camera_model: str = ""
    artist: str = ""
    software: str = ""
    raw_exif: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.raw_exif is None:
            self.raw_exif = {}


class ImageMetadataParser:
    EXIF_TAGS = {
        'DateTimeOriginal': 36867,
        'DateTimeDigitized': 36868,
        'DateTime': 306,
        'Make': 271,
        'Model': 272,
        'Artist': 315,
        'Software': 305,
        'GPSLatitude': 2,
        'GPSLatitudeRef': 1,
        'GPSLongitude': 4,
        'GPSLongitudeRef': 3,
    }
    
    @classmethod
    def parse(cls, file_path: str) -> ImageMetadata:
        path = Path(file_path)
        if not path.exists():
            raise MetadataParseError(f"文件不存在: {file_path}")
        
        try:
            from PIL import Image
            from PIL.ExifTags import TAGS, GPSTAGS
        except ImportError:
            raise MetadataParseError("Pillow 库未安装，请运行: pip install Pillow")
        
        try:
            img = Image.open(path)
        except Exception as e:
            raise MetadataParseError(f"无法打开图片: {str(e)}")
        
        metadata = ImageMetadata(
            file_path=str(path),
            filename=path.name,
            width=img.width,
            height=img.height,
            format=img.format or ""
        )
        
        try:
            exif_data = img._getexif()
            if exif_data:
                metadata.raw_exif = {}
                for tag_id, value in exif_data.items():
                    tag_name = TAGS.get(tag_id, tag_id)
                    metadata.raw_exif[str(tag_name)] = str(value)
                    
                    if tag_name == 'DateTimeOriginal':
                        metadata.exif_timestamp = cls._parse_exif_datetime(value)
                    elif tag_name == 'DateTimeDigitized' and not metadata.exif_timestamp:
                        metadata.exif_timestamp = cls._parse_exif_datetime(value)
                    elif tag_name == 'DateTime' and not metadata.exif_timestamp:
                        metadata.exif_timestamp = cls._parse_exif_datetime(value)
                    elif tag_name == 'Make':
                        metadata.camera_make = str(value).strip() if value else ""
                    elif tag_name == 'Model':
                        metadata.camera_model = str(value).strip() if value else ""
                    elif tag_name == 'Artist':
                        metadata.artist = str(value).strip() if value else ""
                    elif tag_name == 'Software':
                        metadata.software = str(value).strip() if value else ""
                    elif tag_name == 'GPSInfo':
                        gps_data = cls._parse_gps_info(value, GPSTAGS)
                        metadata.gps_latitude = gps_data.get('latitude')
                        metadata.gps_longitude = gps_data.get('longitude')
        except Exception:
            pass
        
        return metadata
    
    @classmethod
    def _parse_exif_datetime(cls, value: Any) -> Optional[datetime]:
        if not value:
            return None
        
        try:
            dt_str = str(value).strip()
            formats = [
                '%Y:%m:%d %H:%M:%S',
                '%Y-%m-%d %H:%M:%S',
                '%Y/%m/%d %H:%M:%S',
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(dt_str, fmt)
                except ValueError:
                    continue
        except Exception:
            pass
        
        return None
    
    @classmethod
    def _parse_gps_info(cls, gps_data: Any, GPSTAGS: Dict) -> Dict[str, Optional[float]]:
        result = {'latitude': None, 'longitude': None}
        
        if not gps_data:
            return result
        
        try:
            lat = gps_data.get(2)
            lat_ref = gps_data.get(1)
            lon = gps_data.get(4)
            lon_ref = gps_data.get(3)
            
            if lat and len(lat) == 3:
                degrees = float(lat[0])
                minutes = float(lat[1])
                seconds = float(lat[2])
                latitude = degrees + (minutes / 60.0) + (seconds / 3600.0)
                if lat_ref and str(lat_ref) == 'S':
                    latitude = -latitude
                result['latitude'] = latitude
            
            if lon and len(lon) == 3:
                degrees = float(lon[0])
                minutes = float(lon[1])
                seconds = float(lon[2])
                longitude = degrees + (minutes / 60.0) + (seconds / 3600.0)
                if lon_ref and str(lon_ref) == 'W':
                    longitude = -longitude
                result['longitude'] = longitude
        except Exception:
            pass
        
        return result
    
    @classmethod
    def extract_timestamp(cls, file_path: str) -> Optional[datetime]:
        try:
            metadata = cls.parse(file_path)
            return metadata.exif_timestamp
        except Exception:
            return None
    
    @classmethod
    def batch_parse(cls, file_paths: List[str]) -> Dict[str, ImageMetadata]:
        results = {}
        for path in file_paths:
            try:
                results[path] = cls.parse(path)
            except Exception:
                continue
        return results
