"""志愿者排班导入器"""

import csv
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from .base import BaseImporter


class VolunteerImporter(BaseImporter):
    """志愿者排班 CSV 导入器"""
    
    REQUIRED_FIELDS = ["volunteer_name", "screening_time", "duration"]
    
    def __init__(self, file_path: str | Path):
        super().__init__(file_path)
    
    def parse(self) -> List[Dict[str, Any]]:
        """解析志愿者排班 CSV 文件"""
        schedules = []
        
        with open(self.file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row_num, row in enumerate(reader, start=2):
                schedule = self._parse_row(row, row_num)
                if schedule:
                    schedules.append(schedule)
        
        return schedules
    
    def _parse_row(self, row: Dict[str, str], row_num: int) -> Optional[Dict[str, Any]]:
        """解析单行数据"""
        try:
            volunteer_name = row.get("volunteer_name", "").strip()
            if not volunteer_name:
                return None
            
            screening_time_str = row.get("screening_time", "").strip()
            screening_time = self._parse_datetime(screening_time_str)
            
            duration_str = row.get("duration", "").strip()
            duration = self._parse_duration(duration_str)
            
            movie_name = row.get("movie_name", "").strip() or None
            
            role = row.get("role", "").strip() or None
            
            start_time = screening_time
            end_time = start_time + timedelta(minutes=duration)
            
            return {
                "volunteer_name": volunteer_name,
                "movie_name": movie_name,
                "role": role,
                "start_time": start_time,
                "end_time": end_time,
            }
        except Exception as e:
            print(f"Warning: 第 {row_num} 行解析失败: {e}")
            return None
    
    def _parse_datetime(self, value: str) -> datetime:
        """解析日期时间字符串"""
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        
        raise ValueError(f"无法解析日期时间: {value}")
    
    def _parse_duration(self, value: str) -> float:
        """解析时长（分钟）"""
        value = value.strip()
        
        if value.endswith("分钟"):
            value = value[:-2].strip()
        elif value.endswith("min"):
            value = value[:-3].strip()
        
        return float(value)
