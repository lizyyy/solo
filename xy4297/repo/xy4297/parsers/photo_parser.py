"""
照片文件名解析器
"""

import re
from datetime import datetime, date
from pathlib import Path
from typing import List, Dict, Any, Optional, Set
from collections import defaultdict

from config import Config


class PhotoInfo:
    """
    照片信息数据类
    """
    
    PHOTO_TYPES = {
        "temperature_1": ["温度1", "冰箱1", "冰柜1", "temp1", "fridge1", "refrigerator1"],
        "temperature_2": ["温度2", "冰箱2", "冰柜2", "temp2", "fridge2", "refrigerator2"],
        "door_check": ["门检查", "门状态", "开门", "门检", "door", "open"],
        "inventory": ["库存", "盘点", "交接", "记录", "inventory", "stock", "check"],
        "other": ["其他", "other"],
    }
    
    SHIFT_KEYWORDS = {
        "morning": ["早班", "上午", "白班", "morning", "am", "8点", "08"],
        "evening": ["晚班", "下午", "夜班", "evening", "pm", "16点", "16"],
    }

    def __init__(
        self,
        file_path: Path,
        timestamp: Optional[datetime] = None,
        photo_type: Optional[str] = None,
        shift: Optional[str] = None,
        sensor_id: Optional[str] = None,
    ):
        self.file_path = file_path
        self.filename = file_path.name
        self.timestamp = timestamp
        self.photo_type = photo_type or "other"
        self.shift = shift
        self.sensor_id = sensor_id

    def to_dict(self) -> Dict[str, Any]:
        return {
            "filename": self.filename,
            "file_path": str(self.file_path),
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "date": self.timestamp.date().isoformat() if self.timestamp else None,
            "photo_type": self.photo_type,
            "shift": self.shift,
            "sensor_id": self.sensor_id,
        }

    @property
    def date(self) -> Optional[date]:
        return self.timestamp.date() if self.timestamp else None


class PhotoParser:
    """
    照片文件名解析器
    """

    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.parsed_photos: List[PhotoInfo] = []
        self.photos_by_date: Dict[date, List[PhotoInfo]] = defaultdict(list)
        self.photos_by_type: Dict[str, List[PhotoInfo]] = defaultdict(list)
        self.photos_by_shift: Dict[str, List[PhotoInfo]] = defaultdict(list)

    def parse_file(self, file_path: Path) -> Optional[PhotoInfo]:
        """
        解析单个照片文件
        """
        if file_path.suffix.lower() not in self.config.PHOTO_EXTENSIONS:
            return None

        filename = file_path.stem
        photo_info = PhotoInfo(file_path=file_path)

        timestamp = self._extract_timestamp(filename)
        if not timestamp:
            timestamp = self._extract_timestamp_from_path(file_path)
        photo_info.timestamp = timestamp

        photo_type = self._detect_photo_type(filename)
        photo_info.photo_type = photo_type

        shift = self._detect_shift(filename)
        if not shift and timestamp:
            shift = self._detect_shift_from_time(timestamp)
        photo_info.shift = shift

        sensor_id = self._extract_sensor_id(filename)
        photo_info.sensor_id = sensor_id

        self.parsed_photos.append(photo_info)
        
        if photo_info.date:
            self.photos_by_date[photo_info.date].append(photo_info)
        self.photos_by_type[photo_info.photo_type].append(photo_info)
        if photo_info.shift:
            self.photos_by_shift[photo_info.shift].append(photo_info)

        return photo_info

    def parse_directory(self, directory: Path) -> List[PhotoInfo]:
        """
        解析目录下所有照片文件
        """
        all_photos = []
        
        photo_files = []
        for ext in self.config.PHOTO_EXTENSIONS:
            photo_files.extend(directory.glob(f"**/*{ext}"))
            photo_files.extend(directory.glob(f"**/*{ext.upper()}"))
            
        for file_path in sorted(photo_files):
            photo = self.parse_file(file_path)
            if photo:
                all_photos.append(photo)
                
        return all_photos

    def _extract_timestamp(self, filename: str) -> Optional[datetime]:
        """
        从文件名中提取时间戳
        """
        filename_lower = filename.lower()
        
        for pattern in self.config.PHOTO_DATE_PATTERNS:
            match = re.search(pattern, filename)
            if match:
                date_str = match.group(1)
                timestamp = self._parse_date_string(date_str)
                if timestamp:
                    return timestamp
                    
        return None

    def _extract_timestamp_from_path(self, file_path: Path) -> Optional[datetime]:
        """
        从文件路径中的文件夹名提取时间戳
        """
        for part in file_path.parts:
            timestamp = self._extract_timestamp(part)
            if timestamp:
                return timestamp
        return None

    def _parse_date_string(self, date_str: str) -> Optional[datetime]:
        """
        解析日期字符串
        """
        date_str = date_str.replace("-", "").replace("/", "").replace("_", "")
        
        formats = [
            "%Y%m%d%H%M%S",
            "%Y%m%d_%H%M%S",
            "%Y%m%d-%H%M%S",
            "%Y%m%d",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
                
        if len(date_str) >= 8:
            try:
                year = int(date_str[0:4])
                month = int(date_str[4:6])
                day = int(date_str[6:8])
                
                hour = 0
                minute = 0
                second = 0
                
                if len(date_str) >= 14:
                    hour = int(date_str[8:10])
                    minute = int(date_str[10:12])
                    second = int(date_str[12:14])
                elif len(date_str) >= 12:
                    hour = int(date_str[8:10])
                    minute = int(date_str[10:12])
                elif len(date_str) >= 10:
                    hour = int(date_str[8:10])
                    
                return datetime(year, month, day, hour, minute, second)
            except ValueError:
                pass
                
        return None

    def _detect_photo_type(self, filename: str) -> str:
        """
        检测照片类型
        """
        filename_lower = filename.lower()
        
        for photo_type, keywords in PhotoInfo.PHOTO_TYPES.items():
            if photo_type == "other":
                continue
            for keyword in keywords:
                if keyword.lower() in filename_lower:
                    return photo_type
                    
        return "other"

    def _detect_shift(self, filename: str) -> Optional[str]:
        """
        检测班次
        """
        filename_lower = filename.lower()
        
        for shift, keywords in PhotoInfo.SHIFT_KEYWORDS.items():
            for keyword in keywords:
                if keyword.lower() in filename_lower:
                    return shift
                    
        return None

    def _detect_shift_from_time(self, timestamp: datetime) -> Optional[str]:
        """
        根据时间检测班次
        """
        hour = timestamp.hour
        
        shift_times = self.config.SHIFT_TIMES
        for shift_name, shift_info in shift_times.items():
            start_hour = int(shift_info["start"].split(":")[0])
            end_hour = int(shift_info["end"].split(":")[0])
            
            if start_hour <= hour < end_hour:
                return shift_name
                
        return None

    def _extract_sensor_id(self, filename: str) -> Optional[str]:
        """
        提取传感器ID
        """
        match = re.search(r"(?:传感器|sensor|冰箱|冰柜|fridge|refrigerator)[\s_-]*(\d+)", filename, re.IGNORECASE)
        if match:
            return match.group(1)
            
        match = re.search(r"[#\s_-](\d{1,3})[#\s_-]?", filename)
        if match:
            return match.group(1)
            
        return None

    def get_photos_by_date_and_shift(
        self, 
        target_date: date, 
        shift: Optional[str] = None
    ) -> List[PhotoInfo]:
        """
        获取指定日期和班次的照片
        """
        photos = self.photos_by_date.get(target_date, [])
        
        if shift:
            photos = [p for p in photos if p.shift == shift]
            
        return photos

    def get_photo_types_for_date(
        self, 
        target_date: date, 
        shift: Optional[str] = None
    ) -> Set[str]:
        """
        获取指定日期已有的照片类型
        """
        photos = self.get_photos_by_date_and_shift(target_date, shift)
        return {p.photo_type for p in photos}

    def get_stats(self) -> Dict[str, Any]:
        """
        获取照片解析统计
        """
        return {
            "total_photos": len(self.parsed_photos),
            "dates_with_photos": len(self.photos_by_date),
            "photo_types": {
                ptype: len(photos) 
                for ptype, photos in self.photos_by_type.items()
            },
            "shift_counts": {
                shift: len(photos)
                for shift, photos in self.photos_by_shift.items()
            },
        }
