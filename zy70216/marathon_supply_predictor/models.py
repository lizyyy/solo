from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime, date
import json


@dataclass
class Weather:
    temperature: float
    humidity: float
    wind_speed: float
    weather_type: str
    precipitation_probability: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Weather':
        return cls(
            temperature=data['temperature'],
            humidity=data['humidity'],
            wind_speed=data['wind_speed'],
            weather_type=data['weather_type'],
            precipitation_probability=data.get('precipitation_probability', 0.0)
        )


@dataclass
class SupplyItem:
    name: str
    supply_type: str
    base_consumption_rate: float
    unit: str = "个"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SupplyItem':
        return cls(
            name=data['name'],
            supply_type=data['supply_type'],
            base_consumption_rate=data['base_consumption_rate'],
            unit=data.get('unit', '个')
        )


@dataclass
class SupplyStation:
    station_id: str
    name: str
    distance_km: float
    segment_id: str
    position: str
    prepared_supplies: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SupplyStation':
        return cls(
            station_id=data['station_id'],
            name=data['name'],
            distance_km=data['distance_km'],
            segment_id=data['segment_id'],
            position=data['position'],
            prepared_supplies=data.get('prepared_supplies', {})
        )


@dataclass
class Segment:
    segment_id: str
    name: str
    start_km: float
    end_km: float
    estimated_runners: int
    difficulty_level: str
    elevation_profile: str = "flat"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Segment':
        return cls(
            segment_id=data['segment_id'],
            name=data['name'],
            start_km=data['start_km'],
            end_km=data['end_km'],
            estimated_runners=data['estimated_runners'],
            difficulty_level=data['difficulty_level'],
            elevation_profile=data.get('elevation_profile', 'flat')
        )


@dataclass
class MarathonEvent:
    event_id: str
    name: str
    event_date: date
    total_distance_km: float
    total_estimated_runners: int
    segments: List[Segment] = field(default_factory=list)
    stations: List[SupplyStation] = field(default_factory=list)
    weather: Optional[Weather] = None
    supply_items: List[SupplyItem] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'event_id': self.event_id,
            'name': self.name,
            'event_date': self.event_date.isoformat() if isinstance(self.event_date, date) else str(self.event_date),
            'total_distance_km': self.total_distance_km,
            'total_estimated_runners': self.total_estimated_runners,
            'segments': [s.to_dict() for s in self.segments],
            'stations': [s.to_dict() for s in self.stations],
            'weather': self.weather.to_dict() if self.weather else None,
            'supply_items': [s.to_dict() for s in self.supply_items]
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'MarathonEvent':
        event_date = data.get('event_date')
        if isinstance(event_date, str):
            try:
                event_date = date.fromisoformat(event_date)
            except:
                event_date = date.today()

        return cls(
            event_id=data['event_id'],
            name=data['name'],
            event_date=event_date,
            total_distance_km=data['total_distance_km'],
            total_estimated_runners=data['total_estimated_runners'],
            segments=[Segment.from_dict(s) for s in data.get('segments', [])],
            stations=[SupplyStation.from_dict(s) for s in data.get('stations', [])],
            weather=Weather.from_dict(data['weather']) if data.get('weather') else None,
            supply_items=[SupplyItem.from_dict(s) for s in data.get('supply_items', [])]
        )


@dataclass
class PredictionResult:
    station_id: str
    station_name: str
    segment_id: str
    runners_in_segment: int
    distance_km: float
    predicted_consumption: Dict[str, float]
    prepared_supplies: Dict[str, int]
    gap: Dict[str, float]
    gap_percentage: Dict[str, float]
    shortage_risk: Dict[str, bool]
    status: str
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ProcessingStatus:
    event_id: str
    timestamp: datetime
    phase: str
    status: str
    needs_review: bool = False
    review_reasons: List[str] = field(default_factory=list)
    blocked_reasons: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'event_id': self.event_id,
            'timestamp': self.timestamp.isoformat(),
            'phase': self.phase,
            'status': self.status,
            'needs_review': self.needs_review,
            'review_reasons': self.review_reasons,
            'blocked_reasons': self.blocked_reasons
        }


class EventDataLoader:
    @staticmethod
    def load_from_json(file_path: str) -> MarathonEvent:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return MarathonEvent.from_dict(data)

    @staticmethod
    def save_to_json(event: MarathonEvent, file_path: str):
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(event.to_dict(), f, ensure_ascii=False, indent=2)
