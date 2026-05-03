"""
规则引擎 - 检测异常情况
"""

from dataclasses import dataclass, field
from datetime import datetime, date, timedelta, time
from enum import Enum
from typing import List, Dict, Any, Optional, Set, Tuple
from collections import defaultdict

from config import Config
from parsers.csv_parser import TemperatureCSVParser, TemperatureReading
from parsers.photo_parser import PhotoParser, PhotoInfo
from parsers.log_parser import DoorLogParser, DoorSession


class AlertLevel(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class AnomalyType(Enum):
    TEMP_OVER_THRESHOLD = "temp_over_threshold"
    TEMP_UNDER_THRESHOLD = "temp_under_threshold"
    MISSING_READINGS = "missing_readings"
    PHOTO_MISSING = "photo_missing"
    HANDOVER_TIME_CONFLICT = "handover_time_conflict"
    DOOR_OPENED_LONG = "door_opened_long"
    DOOR_SESSION_INCOMPLETE = "door_session_incomplete"


@dataclass
class Anomaly:
    """
    异常数据类
    """
    anomaly_type: AnomalyType
    alert_level: AlertLevel
    timestamp: Optional[datetime] = None
    date: Optional[date] = None
    shift: Optional[str] = None
    sensor_id: Optional[str] = None
    description: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    source_file: Optional[str] = None
    reading: Optional[TemperatureReading] = None
    photo_info: Optional[PhotoInfo] = None
    door_session: Optional[DoorSession] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "anomaly_type": self.anomaly_type.value,
            "alert_level": self.alert_level.value,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "date": self.date.isoformat() if self.date else None,
            "shift": self.shift,
            "sensor_id": self.sensor_id,
            "description": self.description,
            "details": self.details,
            "source_file": self.source_file,
        }
        
        if self.reading:
            result["reading"] = self.reading.to_dict()
        if self.photo_info:
            result["photo_info"] = self.photo_info.to_dict()
        if self.door_session:
            result["door_session"] = self.door_session.to_dict()
            
        return result

    @property
    def is_critical(self) -> bool:
        return self.alert_level == AlertLevel.CRITICAL

    @property
    def is_high(self) -> bool:
        return self.alert_level == AlertLevel.HIGH

    @property
    def is_medium(self) -> bool:
        return self.alert_level == AlertLevel.MEDIUM


class RuleEngine:
    """
    规则引擎 - 检测各种异常情况
    """

    DOOR_OPEN_THRESHOLD_SECONDS = 120

    def __init__(
        self,
        config: Optional[Config] = None,
        temp_parser: Optional[TemperatureCSVParser] = None,
        photo_parser: Optional[PhotoParser] = None,
        door_parser: Optional[DoorLogParser] = None,
    ):
        self.config = config or Config()
        self.temp_parser = temp_parser
        self.photo_parser = photo_parser
        self.door_parser = door_parser
        self.anomalies: List[Anomaly] = []
        self.anomalies_by_type: Dict[AnomalyType, List[Anomaly]] = defaultdict(list)
        self.anomalies_by_date: Dict[date, List[Anomaly]] = defaultdict(list)
        self.anomalies_by_level: Dict[AlertLevel, List[Anomaly]] = defaultdict(list)

    def run_all_checks(self) -> List[Anomaly]:
        """
        运行所有检查
        """
        self.anomalies = []
        self.anomalies_by_type.clear()
        self.anomalies_by_date.clear()
        self.anomalies_by_level.clear()

        if self.temp_parser:
            self.check_temperature_thresholds()
            self.check_missing_readings()

        if self.photo_parser:
            self.check_missing_photos()
            self.check_handover_time_conflicts()

        if self.door_parser:
            self.check_long_door_openings()
            self.check_incomplete_sessions()

        return self.anomalies

    def check_temperature_thresholds(self) -> List[Anomaly]:
        """
        检查温度是否超出阈值
        """
        if not self.temp_parser or not self.temp_parser.all_readings:
            return []

        for reading in self.temp_parser.all_readings:
            if reading.is_over_threshold():
                anomaly = Anomaly(
                    anomaly_type=AnomalyType.TEMP_OVER_THRESHOLD,
                    alert_level=AlertLevel.CRITICAL,
                    timestamp=reading.timestamp,
                    date=reading.timestamp.date(),
                    sensor_id=reading.sensor_id,
                    description=f"温度超上限: {reading.temperature:.2f}°C (阈值: {self.config.TEMP_THRESHOLD_MAX}°C)",
                    details={
                        "temperature": reading.temperature,
                        "threshold_max": self.config.TEMP_THRESHOLD_MAX,
                        "deviation": reading.temperature - self.config.TEMP_THRESHOLD_MAX,
                    },
                    reading=reading,
                )
                self._add_anomaly(anomaly)

            if reading.is_under_threshold():
                anomaly = Anomaly(
                    anomaly_type=AnomalyType.TEMP_UNDER_THRESHOLD,
                    alert_level=AlertLevel.CRITICAL,
                    timestamp=reading.timestamp,
                    date=reading.timestamp.date(),
                    sensor_id=reading.sensor_id,
                    description=f"温度超下限: {reading.temperature:.2f}°C (阈值: {self.config.TEMP_THRESHOLD_MIN}°C)",
                    details={
                        "temperature": reading.temperature,
                        "threshold_min": self.config.TEMP_THRESHOLD_MIN,
                        "deviation": self.config.TEMP_THRESHOLD_MIN - reading.temperature,
                    },
                    reading=reading,
                )
                self._add_anomaly(anomaly)

        return self.anomalies_by_type.get(AnomalyType.TEMP_OVER_THRESHOLD, []) + \
               self.anomalies_by_type.get(AnomalyType.TEMP_UNDER_THRESHOLD, [])

    def check_missing_readings(self) -> List[Anomaly]:
        """
        检查缺测情况
        """
        if not self.temp_parser or not self.temp_parser.all_readings:
            return []

        date_range = self.temp_parser.get_date_range()
        if not date_range:
            return []

        start_date = date_range[0].date()
        end_date = date_range[1].date()

        current_date = start_date
        while current_date <= end_date:
            for hour in range(24):
                readings = self.temp_parser.get_readings_by_hour(current_date, hour)
                if len(readings) < self.config.MIN_READINGS_PER_HOUR:
                    anomaly = Anomaly(
                        anomaly_type=AnomalyType.MISSING_READINGS,
                        alert_level=AlertLevel.HIGH,
                        date=current_date,
                        shift=self._get_shift_for_hour(hour),
                        description=f"小时缺测: {current_date.isoformat()} {hour:02d}:00 - 仅有 {len(readings)} 条读数 (期望: {self.config.MIN_READINGS_PER_HOUR})",
                        details={
                            "hour": hour,
                            "actual_count": len(readings),
                            "expected_count": self.config.MIN_READINGS_PER_HOUR,
                            "missing_count": self.config.MIN_READINGS_PER_HOUR - len(readings),
                        },
                    )
                    self._add_anomaly(anomaly)

            current_date += timedelta(days=1)

        return self.anomalies_by_type.get(AnomalyType.MISSING_READINGS, [])

    def check_missing_photos(self) -> List[Anomaly]:
        """
        检查照片缺失
        """
        if not self.photo_parser:
            return []

        all_dates = set()
        
        if self.temp_parser and self.temp_parser.all_readings:
            date_range = self.temp_parser.get_date_range()
            if date_range:
                start_date = date_range[0].date()
                end_date = date_range[1].date()
                current = start_date
                while current <= end_date:
                    all_dates.add(current)
                    current += timedelta(days=1)

        for photo_date in self.photo_parser.photos_by_date.keys():
            all_dates.add(photo_date)

        for target_date in sorted(all_dates):
            for shift in ["morning", "evening"]:
                required_photos = self.config.REQUIRED_PHOTOS_PER_SHIFT.get(shift, [])
                if not required_photos:
                    continue

                existing_types = self.photo_parser.get_photo_types_for_date(target_date, shift)
                missing_types = set(required_photos) - existing_types

                if missing_types:
                    anomaly = Anomaly(
                        anomaly_type=AnomalyType.PHOTO_MISSING,
                        alert_level=AlertLevel.HIGH,
                        date=target_date,
                        shift=shift,
                        description=f"照片缺失: {target_date.isoformat()} {shift} 班次缺少 {len(missing_types)} 种照片",
                        details={
                            "shift": shift,
                            "required": required_photos,
                            "existing": list(existing_types),
                            "missing": list(missing_types),
                        },
                    )
                    self._add_anomaly(anomaly)

        return self.anomalies_by_type.get(AnomalyType.PHOTO_MISSING, [])

    def check_handover_time_conflicts(self) -> List[Anomaly]:
        """
        检查交接时间冲突
        """
        if not self.photo_parser:
            return []

        for target_date, photos in self.photo_parser.photos_by_date.items():
            for shift in ["morning", "evening"]:
                shift_info = self.config.SHIFT_TIMES.get(shift)
                if not shift_info:
                    continue

                handover_start = self._parse_time_str(shift_info["handover_window"][0])
                handover_end = self._parse_time_str(shift_info["handover_window"][1])
                tolerance = timedelta(minutes=self.config.HANDOVER_TIME_TOLERANCE_MINUTES)

                shift_photos = [p for p in photos if p.shift == shift and p.timestamp]
                
                for photo in shift_photos:
                    if not photo.timestamp:
                        continue

                    photo_time = photo.timestamp.time()
                    
                    expected_start = (datetime.combine(target_date, handover_start) - tolerance).time()
                    expected_end = (datetime.combine(target_date, handover_end) + tolerance).time()

                    if photo_time < expected_start or photo_time > expected_end:
                        anomaly = Anomaly(
                            anomaly_type=AnomalyType.HANDOVER_TIME_CONFLICT,
                            alert_level=AlertLevel.MEDIUM,
                            timestamp=photo.timestamp,
                            date=target_date,
                            shift=shift,
                            description=f"交接时间异常: {photo.filename} 拍摄于 {photo.timestamp.strftime('%H:%M')} (期望: {shift_info['handover_window'][0]} - {shift_info['handover_window'][1]})",
                            details={
                                "photo_time": photo.timestamp.isoformat(),
                                "expected_window": shift_info["handover_window"],
                                "tolerance_minutes": self.config.HANDOVER_TIME_TOLERANCE_MINUTES,
                                "filename": photo.filename,
                            },
                            photo_info=photo,
                        )
                        self._add_anomaly(anomaly)

        return self.anomalies_by_type.get(AnomalyType.HANDOVER_TIME_CONFLICT, [])

    def check_long_door_openings(self) -> List[Anomaly]:
        """
        检查长时间开门
        """
        if not self.door_parser:
            return []

        sessions = self.door_parser.build_sessions()

        for session in sessions:
            if session.duration_seconds and session.duration_seconds > self.DOOR_OPEN_THRESHOLD_SECONDS:
                anomaly = Anomaly(
                    anomaly_type=AnomalyType.DOOR_OPENED_LONG,
                    alert_level=AlertLevel.MEDIUM,
                    timestamp=session.open_time,
                    date=session.date,
                    sensor_id=session.door_id,
                    description=f"长时间开门: {session.duration_seconds} 秒 (阈值: {self.DOOR_OPEN_THRESHOLD_SECONDS} 秒)",
                    details={
                        "duration_seconds": session.duration_seconds,
                        "duration_minutes": round(session.duration_seconds / 60, 2),
                        "threshold_seconds": self.DOOR_OPEN_THRESHOLD_SECONDS,
                        "open_time": session.open_time.isoformat(),
                        "close_time": session.close_time.isoformat() if session.close_time else None,
                    },
                    door_session=session,
                )
                self._add_anomaly(anomaly)

        return self.anomalies_by_type.get(AnomalyType.DOOR_OPENED_LONG, [])

    def check_incomplete_sessions(self) -> List[Anomaly]:
        """
        检查未完成的开门会话（开门后没有关门记录）
        """
        if not self.door_parser:
            return []

        sessions = self.door_parser.build_sessions()

        for session in sessions:
            if session.is_open:
                anomaly = Anomaly(
                    anomaly_type=AnomalyType.DOOR_SESSION_INCOMPLETE,
                    alert_level=AlertLevel.MEDIUM,
                    timestamp=session.open_time,
                    date=session.date,
                    sensor_id=session.door_id,
                    description=f"未完成的开门会话: 开门于 {session.open_time.strftime('%Y-%m-%d %H:%M:%S')} 后无关门记录",
                    details={
                        "open_time": session.open_time.isoformat(),
                        "door_id": session.door_id,
                    },
                    door_session=session,
                )
                self._add_anomaly(anomaly)

        return self.anomalies_by_type.get(AnomalyType.DOOR_SESSION_INCOMPLETE, [])

    def _add_anomaly(self, anomaly: Anomaly):
        """
        添加异常到集合
        """
        self.anomalies.append(anomaly)
        self.anomalies_by_type[anomaly.anomaly_type].append(anomaly)
        if anomaly.date:
            self.anomalies_by_date[anomaly.date].append(anomaly)
        self.anomalies_by_level[anomaly.alert_level].append(anomaly)

    def _get_shift_for_hour(self, hour: int) -> Optional[str]:
        """
        根据小时获取班次
        """
        for shift_name, shift_info in self.config.SHIFT_TIMES.items():
            start_hour = int(shift_info["start"].split(":")[0])
            end_hour = int(shift_info["end"].split(":")[0])
            
            if start_hour <= hour < end_hour:
                return shift_name
                
        return None

    def _parse_time_str(self, time_str: str) -> time:
        """
        解析时间字符串
        """
        parts = time_str.split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        return time(hour, minute)

    def get_summary(self) -> Dict[str, Any]:
        """
        获取异常汇总
        """
        return {
            "total_anomalies": len(self.anomalies),
            "by_type": {
                anomaly_type.value: len(anomalies)
                for anomaly_type, anomalies in self.anomalies_by_type.items()
            },
            "by_level": {
                level.value: len(anomalies)
                for level, anomalies in self.anomalies_by_level.items()
            },
            "critical_count": len(self.anomalies_by_level.get(AlertLevel.CRITICAL, [])),
            "high_count": len(self.anomalies_by_level.get(AlertLevel.HIGH, [])),
            "medium_count": len(self.anomalies_by_level.get(AlertLevel.MEDIUM, [])),
            "dates_affected": len(self.anomalies_by_date),
        }

    def get_anomalies_by_date(self, target_date: date) -> List[Anomaly]:
        """
        获取指定日期的所有异常
        """
        return self.anomalies_by_date.get(target_date, [])

    def get_anomalies_by_level(self, level: AlertLevel) -> List[Anomaly]:
        """
        获取指定级别的所有异常
        """
        return self.anomalies_by_level.get(level, [])

    def get_critical_anomalies(self) -> List[Anomaly]:
        """
        获取所有严重异常
        """
        return self.get_anomalies_by_level(AlertLevel.CRITICAL)

    def get_high_anomalies(self) -> List[Anomaly]:
        """
        获取所有高级别异常
        """
        return self.get_anomalies_by_level(AlertLevel.HIGH)

    def all_anomalies_to_list(self) -> List[Dict[str, Any]]:
        """
        将所有异常转换为字典列表
        """
        return [a.to_dict() for a in self.anomalies]
