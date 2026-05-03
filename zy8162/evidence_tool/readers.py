import csv
import json
import os
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pathlib import Path

import pynmea2

from .models import VideoSegment, GPSPoint, ClockCalibration


class VideoManifestReader:
    """
    读取 video_manifest.csv 文件，解析视频片段信息
    CSV格式示例：
    filename,start_time,end_time,duration,device_id,file_size,metadata
    """
    
    def __init__(self, time_format: str = "%Y-%m-%d %H:%M:%S"):
        self.time_format = time_format
    
    def read(self, file_path: str) -> List[VideoSegment]:
        segments = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for index, row in enumerate(reader):
                try:
                    segment = self._parse_row(row, index, file_path)
                    segments.append(segment)
                except Exception as e:
                    print(f"Warning: Failed to parse row {index}: {e}")
        return segments
    
    def _parse_row(self, row: Dict[str, str], index: int, manifest_path: str) -> VideoSegment:
        filename = row['filename'].strip()
        manifest_dir = os.path.dirname(manifest_path)
        file_path = os.path.join(manifest_dir, filename)
        
        start_time = self._parse_time(row['start_time'])
        end_time = self._parse_time(row['end_time'])
        
        if 'duration' in row and row['duration']:
            try:
                duration_seconds = float(row['duration'])
                duration = timedelta(seconds=duration_seconds)
            except ValueError:
                duration = end_time - start_time
        else:
            duration = end_time - start_time
        
        device_id = row.get('device_id', 'unknown')
        file_size = int(row.get('file_size', '0'))
        
        metadata = {}
        for key, value in row.items():
            if key not in ['filename', 'start_time', 'end_time', 'duration', 'device_id', 'file_size']:
                if value:
                    metadata[key] = value
        
        return VideoSegment(
            filename=filename,
            file_path=file_path,
            start_time=start_time,
            end_time=end_time,
            duration=duration,
            device_id=device_id,
            file_size=file_size,
            original_index=index,
            metadata=metadata
        )
    
    def _parse_time(self, time_str: str) -> datetime:
        try:
            return datetime.strptime(time_str.strip(), self.time_format)
        except ValueError:
            try:
                return datetime.fromisoformat(time_str.strip())
            except ValueError:
                raise ValueError(f"Cannot parse time: {time_str}")


class NMEAReader:
    """
    读取 NMEA 日志文件，解析 GPS 轨迹数据
    支持 GGA、RMC、GLL 等常见 NMEA 语句
    """
    
    def __init__(self, time_format: str = "%H%M%S.%f", date_format: str = "%d%m%y"):
        self.time_format = time_format
        self.date_format = date_format
    
    def read(self, file_path: str) -> List[GPSPoint]:
        points = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or not line.startswith('$'):
                    continue
                
                try:
                    msg = pynmea2.parse(line)
                    point = self._parse_message(msg, line)
                    if point:
                        points.append(point)
                except Exception as e:
                    pass
        
        return points
    
    def _parse_message(self, msg, raw_line: str) -> Optional[GPSPoint]:
        timestamp = None
        latitude = None
        longitude = None
        altitude = None
        speed = None
        satellites = None
        quality = None
        
        if hasattr(msg, 'timestamp') and msg.timestamp:
            ts = msg.timestamp
            if hasattr(ts, 'tzinfo') and ts.tzinfo is not None:
                ts = ts.replace(tzinfo=None)
            
            if hasattr(msg, 'datestamp') and msg.datestamp:
                ds = msg.datestamp
                timestamp = datetime.combine(ds, ts)
            else:
                today = datetime.now().date()
                timestamp = datetime.combine(today, ts)
        
        if hasattr(msg, 'latitude') and hasattr(msg, 'longitude'):
            try:
                latitude = msg.latitude
                longitude = msg.longitude
            except (ValueError, TypeError):
                pass
        
        if hasattr(msg, 'altitude'):
            altitude = msg.altitude
        
        if hasattr(msg, 'spd_over_grnd'):
            speed = msg.spd_over_grnd
        
        if hasattr(msg, 'num_sats'):
            try:
                satellites = int(msg.num_sats)
            except (ValueError, TypeError):
                pass
        
        if hasattr(msg, 'gps_qual'):
            quality = str(msg.gps_qual)
        
        if timestamp is not None and latitude is not None and longitude is not None:
            return GPSPoint(
                timestamp=timestamp,
                latitude=latitude,
                longitude=longitude,
                altitude=altitude,
                speed=speed,
                satellites=satellites,
                quality=quality,
                raw_data=raw_line
            )
        
        return None


class ClockCalibrationReader:
    """
    读取设备时钟校准 JSON 文件
    JSON 格式示例：
    {
        "calibrations": [
            {
                "calibration_time": "2024-01-01T00:00:00",
                "device_time": "2024-01-01T00:00:05",
                "reference_time": "2024-01-01T00:00:00",
                "drift_seconds": 5.0,
                "calibration_type": "gps"
            }
        ]
    }
    """
    
    def read(self, file_path: str) -> List[ClockCalibration]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        calibrations = []
        
        if 'calibrations' in data:
            for item in data['calibrations']:
                calibration = self._parse_calibration(item)
                if calibration:
                    calibrations.append(calibration)
        elif isinstance(data, dict) and 'calibration_time' in data:
            calibration = self._parse_calibration(data)
            if calibration:
                calibrations.append(calibration)
        elif isinstance(data, list):
            for item in data:
                calibration = self._parse_calibration(item)
                if calibration:
                    calibrations.append(calibration)
        
        return calibrations
    
    def _parse_calibration(self, item: Dict[str, Any]) -> Optional[ClockCalibration]:
        try:
            calibration_time = self._parse_datetime(item.get('calibration_time'))
            device_time = self._parse_datetime(item.get('device_time'))
            reference_time = self._parse_datetime(item.get('reference_time'))
            drift_seconds = float(item.get('drift_seconds', 0))
            calibration_type = item.get('calibration_type', 'gps')
            
            if calibration_time and device_time and reference_time:
                return ClockCalibration(
                    calibration_time=calibration_time,
                    device_time=device_time,
                    reference_time=reference_time,
                    drift_seconds=drift_seconds,
                    calibration_type=calibration_type,
                    metadata={k: v for k, v in item.items() if k not in 
                              ['calibration_time', 'device_time', 'reference_time', 
                               'drift_seconds', 'calibration_type']}
                )
        except Exception as e:
            print(f"Warning: Failed to parse calibration: {e}")
        
        return None
    
    def _parse_datetime(self, value) -> Optional[datetime]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        try:
            return datetime.fromisoformat(str(value))
        except ValueError:
            try:
                return datetime.strptime(str(value), "%Y-%m-%d %H:%M:%S")
            except ValueError:
                return None


def find_data_files(directory: str) -> Dict[str, List[str]]:
    """
    在目录中查找所有相关数据文件
    返回: {
        'video_manifests': [...],
        'nmea_logs': [...],
        'clock_calibrations': [...]
    }
    """
    path = Path(directory)
    
    result = {
        'video_manifests': [],
        'nmea_logs': [],
        'clock_calibrations': []
    }
    
    for file_path in path.rglob('*'):
        if file_path.is_file():
            filename = file_path.name.lower()
            
            if filename == 'video_manifest.csv' or filename.endswith('_manifest.csv'):
                result['video_manifests'].append(str(file_path))
            elif filename.endswith('.nmea') or filename.endswith('.log') and 'gps' in filename:
                result['nmea_logs'].append(str(file_path))
            elif filename.endswith('.json') and ('clock' in filename or 'calibration' in filename):
                result['clock_calibrations'].append(str(file_path))
    
    return result
