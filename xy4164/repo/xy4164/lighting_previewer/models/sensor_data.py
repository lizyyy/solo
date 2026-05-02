"""传感器数据模型"""

from dataclasses import dataclass, field
from datetime import datetime, time
from typing import Dict, List, Optional


@dataclass
class SensorReading:
    timestamp: datetime
    ppfd: float
    temp: Optional[float] = None
    humidity: Optional[float] = None
    co2: Optional[float] = None
    
    def to_dict(self) -> Dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "ppfd": self.ppfd,
            "temp": self.temp,
            "humidity": self.humidity,
            "co2": self.co2
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "SensorReading":
        return cls(
            timestamp=datetime.fromisoformat(data["timestamp"]),
            ppfd=data["ppfd"],
            temp=data.get("temp"),
            humidity=data.get("humidity"),
            co2=data.get("co2")
        )
    
    def validate(self) -> List[str]:
        errors = []
        if self.ppfd < 0:
            errors.append(f"时间 {self.timestamp} 的PPFD值不能为负值")
        if self.temp is not None and (self.temp < -40 or self.temp > 60):
            errors.append(f"时间 {self.timestamp} 的温度值超出合理范围")
        if self.humidity is not None and (self.humidity < 0 or self.humidity > 100):
            errors.append(f"时间 {self.timestamp} 的湿度值超出合理范围")
        return errors
    
    @property
    def hour_of_day(self) -> int:
        return self.timestamp.hour
    
    @property
    def is_daylight(self) -> bool:
        return 6 <= self.timestamp.hour < 18


@dataclass
class SensorData:
    sensor_id: str
    sensor_name: str
    location: str
    readings: List[SensorReading] = field(default_factory=list)
    notes: str = ""
    custom_attributes: Dict[str, str] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "sensor_id": self.sensor_id,
            "sensor_name": self.sensor_name,
            "location": self.location,
            "readings": [r.to_dict() for r in self.readings],
            "notes": self.notes,
            "custom_attributes": self.custom_attributes
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "SensorData":
        return cls(
            sensor_id=data["sensor_id"],
            sensor_name=data.get("sensor_name", ""),
            location=data.get("location", ""),
            readings=[SensorReading.from_dict(r) for r in data.get("readings", [])],
            notes=data.get("notes", ""),
            custom_attributes=data.get("custom_attributes", {})
        )
    
    def validate(self) -> List[str]:
        errors = []
        if not self.sensor_id or not self.sensor_id.strip():
            errors.append("传感器ID不能为空")
        
        for reading in self.readings:
            errors.extend(reading.validate())
        
        if len(self.readings) < 24:
            errors.append(f"传感器 {self.sensor_id} 的读数数量 ({len(self.readings)}) 不足24个，可能存在缺测")
        
        return errors
    
    def get_readings_by_hour(self, hour: int) -> List[SensorReading]:
        return [r for r in self.readings if r.hour_of_day == hour]
    
    def get_average_ppfd_by_hour(self, hour: int) -> float:
        hour_readings = self.get_readings_by_hour(hour)
        if not hour_readings:
            return 0.0
        return sum(r.ppfd for r in hour_readings) / len(hour_readings)
    
    def get_daily_ppfd_profile(self) -> Dict[int, float]:
        profile = {}
        for hour in range(24):
            profile[hour] = self.get_average_ppfd_by_hour(hour)
        return profile
    
    def check_gaps(self, max_interval_minutes: int = 60) -> List[tuple]:
        if not self.readings:
            return []
        
        sorted_readings = sorted(self.readings, key=lambda r: r.timestamp)
        gaps = []
        
        for i in range(1, len(sorted_readings)):
            current = sorted_readings[i]
            previous = sorted_readings[i-1]
            delta_minutes = (current.timestamp - previous.timestamp).total_seconds() / 60
            
            if delta_minutes > max_interval_minutes:
                gaps.append((previous.timestamp, current.timestamp, delta_minutes))
        
        return gaps
