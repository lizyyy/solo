from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any
import json
import hashlib


@dataclass
class GPXPoint:
    lat: float
    lon: float
    elevation: float = 0.0
    distance: float = 0.0


@dataclass
class ClimbSegment:
    start_index: int
    end_index: int
    distance_km: float
    elevation_gain: float
    elevation_loss: float
    avg_gradient: float
    max_gradient: float


@dataclass
class RouteProfile:
    total_distance_km: float = 0.0
    total_elevation_gain: float = 0.0
    total_elevation_loss: float = 0.0
    max_elevation: float = 0.0
    min_elevation: float = 0.0
    climbs: List[ClimbSegment] = field(default_factory=list)


@dataclass
class Weather:
    temperature: float = 20.0
    humidity: float = 60.0
    wind_speed_kmh: float = 10.0
    precipitation: float = 0.0
    uv_index: float = 5.0


@dataclass
class ParticipantGroup:
    level: str = "intermediate"
    count: int = 20
    avg_speed_kmh: float = 20.0
    water_per_person_per_hour: float = 0.75
    food_per_person_per_hour: float = 0.15


@dataclass
class SupplyStation:
    id: str
    name: str
    distance_km: float
    elevation: float
    type: str
    materials: Dict[str, float]
    reason: str


@dataclass
class RunRecord:
    run_id: str
    timestamp: str
    route_name: str
    route_hash: str
    settings: Dict[str, Any]
    profile: Dict[str, Any]
    stations: List[Dict[str, Any]]
    totals: Dict[str, Any]
    status: str = "completed"


def compute_route_hash(points: List[Dict[str, float]]) -> str:
    simplified = []
    step = max(1, len(points) // 100)
    for i in range(0, len(points), step):
        p = points[i]
        simplified.append({
            "lat": round(p.get("lat", 0), 5),
            "lon": round(p.get("lon", 0), 5),
            "ele": round(p.get("elevation", p.get("ele", 0)), 1)
        })
    data = json.dumps(simplified, sort_keys=True)
    return hashlib.sha256(data.encode()).hexdigest()[:16]
