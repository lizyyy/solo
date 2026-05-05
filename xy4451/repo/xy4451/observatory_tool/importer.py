import json
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from .database import (
    Database, MaintenanceSchedule, ObservationTarget, 
    WeatherForecast, DarkFrame
)


class Importer:
    def __init__(self, db: Database):
        self.db = db

    def import_maintenance_schedule(self, json_path: str) -> int:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        count = 0
        for item in data.get('maintenance', []):
            start_time = self._parse_datetime(item['start_time'])
            end_time = self._parse_datetime(item['end_time'])
            
            maintenance = MaintenanceSchedule(
                id=None,
                telescope_id=item.get('telescope_id', 'main'),
                start_time=start_time,
                end_time=end_time,
                description=item.get('description', '')
            )
            self.db.add_maintenance(maintenance)
            count += 1

        return count

    def import_target_list(self, json_path: str) -> int:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        count = 0
        for item in data.get('targets', []):
            ra = self._parse_ra(item['ra'])
            dec = self._parse_dec(item['dec'])
            
            target = ObservationTarget(
                id=None,
                target_name=item['name'],
                ra=ra,
                dec=dec,
                priority=item.get('priority', 1),
                min_moon_angle=item.get('min_moon_angle', 30.0),
                max_cloud_cover=item.get('max_cloud_cover', 0.3),
                required_exposure=item.get('required_exposure', 300),
                required_binning=item.get('required_binning', 1),
                required_gain=item.get('required_gain', 0)
            )
            self.db.add_target(target)
            count += 1

        return count

    def import_weather_forecast(self, json_path: str) -> int:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        count = 0
        for item in data.get('forecasts', []):
            time = self._parse_datetime(item['time'])
            
            weather = WeatherForecast(
                id=None,
                time=time,
                cloud_cover=item.get('cloud_cover', 0.0),
                seeing=item.get('seeing'),
                temperature=item.get('temperature'),
                wind_speed=item.get('wind_speed')
            )
            self.db.add_weather(weather)
            count += 1

        return count

    def import_dark_frames_from_directory(self, directory_path: str) -> Tuple[int, List[str]]:
        dir_path = Path(directory_path)
        if not dir_path.exists():
            return 0, [f"目录不存在: {directory_path}"]

        dark_frames: Dict[Tuple[int, int, int], int] = {}
        errors = []

        for file_path in dir_path.rglob('*'):
            if file_path.is_file():
                result = self._parse_dark_frame_filename(file_path.name)
                if result:
                    exposure, binning, gain = result
                    key = (exposure, binning, gain)
                    dark_frames[key] = dark_frames.get(key, 0) + 1

        count = 0
        for (exposure, binning, gain), count_files in dark_frames.items():
            dark = DarkFrame(
                id=None,
                exposure=exposure,
                binning=binning,
                gain=gain,
                count=count_files,
                file_path=str(dir_path)
            )
            self.db.add_dark_frame(dark)
            count += 1

        return count, errors

    def _parse_dark_frame_filename(self, filename: str) -> Optional[Tuple[int, int, int]]:
        patterns = [
            r'dark[_-]?(\d+)[sS]?[_-]?bin(\d+)[_-]?g(\d+)',
            r'(\d+)s[_-]?bin(\d+)[_-]?g(\d+)[_-]?dark',
            r'dark[_-]?(\d+)[_-]?bin(\d+)[_-]?gain(\d+)',
            r'(\d+)sec[_-]?bin(\d+)[_-]?(\d+)gain',
        ]

        for pattern in patterns:
            match = re.search(pattern, filename, re.IGNORECASE)
            if match:
                exposure = int(match.group(1))
                binning = int(match.group(2))
                gain = int(match.group(3))
                return (exposure, binning, gain)

        return None

    def _parse_datetime(self, datetime_str: str) -> datetime:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%dT%H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(datetime_str, fmt)
            except ValueError:
                continue

        raise ValueError(f"无法解析时间格式: {datetime_str}")

    def _parse_ra(self, ra_str: str) -> float:
        if isinstance(ra_str, (int, float)):
            return float(ra_str)

        ra_str = ra_str.strip()
        
        if 'h' in ra_str or 'm' in ra_str or 's' in ra_str:
            match = re.match(r'(\d+\.?\d*)[hH]\s*(\d+\.?\d*)[mM]?\s*(\d+\.?\d*)[sS]?', ra_str)
            if match:
                hours = float(match.group(1))
                minutes = float(match.group(2))
                seconds = float(match.group(3))
                return hours + minutes / 60 + seconds / 3600
            
            match = re.match(r'(\d+\.?\d*)[:\s](\d+\.?\d*)[:\s](\d+\.?\d*)', ra_str)
            if match:
                hours = float(match.group(1))
                minutes = float(match.group(2))
                seconds = float(match.group(3))
                return hours + minutes / 60 + seconds / 3600

        try:
            return float(ra_str)
        except ValueError:
            raise ValueError(f"无法解析赤经格式: {ra_str}")

    def _parse_dec(self, dec_str: str) -> float:
        if isinstance(dec_str, (int, float)):
            return float(dec_str)

        dec_str = dec_str.strip()
        sign = 1
        if dec_str.startswith('-'):
            sign = -1
            dec_str = dec_str[1:]
        elif dec_str.startswith('+'):
            dec_str = dec_str[1:]

        if 'd' in dec_str or 'm' in dec_str or 's' in dec_str:
            match = re.match(r'(\d+\.?\d*)[dD°]?\s*(\d+\.?\d*)[mM'']?\s*(\d+\.?\d*)[sS"']?', dec_str)
            if match:
                degrees = float(match.group(1))
                minutes = float(match.group(2))
                seconds = float(match.group(3))
                return sign * (degrees + minutes / 60 + seconds / 3600)
            
            match = re.match(r'(\d+\.?\d*)[:\s](\d+\.?\d*)[:\s](\d+\.?\d*)', dec_str)
            if match:
                degrees = float(match.group(1))
                minutes = float(match.group(2))
                seconds = float(match.group(3))
                return sign * (degrees + minutes / 60 + seconds / 3600)

        try:
            return sign * float(dec_str)
        except ValueError:
            raise ValueError(f"无法解析赤纬格式: {dec_str}")
