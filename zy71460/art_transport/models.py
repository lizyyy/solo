from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class DataSource:
    source_name: str
    version: str
    fetched_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> dict:
        return {
            "source_name": self.source_name,
            "version": self.version,
            "fetched_at": self.fetched_at,
        }


@dataclass
class Artwork:
    artwork_id: str
    name: str
    insurance_value_cny: float
    temp_min_c: float
    temp_max_c: float
    max_transit_hours: float
    fragility: float
    destination_city_id: str
    data_source: Optional[DataSource] = None

    def temp_range_c(self) -> tuple[float, float]:
        return (self.temp_min_c, self.temp_max_c)

    def temp_range_overlap(self, other: "Artwork") -> Optional[tuple[float, float]]:
        lo = max(self.temp_min_c, other.temp_min_c)
        hi = min(self.temp_max_c, other.temp_max_c)
        if lo <= hi:
            return (lo, hi)
        return None

    def to_dict(self) -> dict:
        d = {
            "artwork_id": self.artwork_id,
            "name": self.name,
            "insurance_value_cny": self.insurance_value_cny,
            "temp_min_c": self.temp_min_c,
            "temp_max_c": self.temp_max_c,
            "max_transit_hours": self.max_transit_hours,
            "fragility": self.fragility,
            "destination_city_id": self.destination_city_id,
        }
        if self.data_source:
            d["data_source"] = self.data_source.to_dict()
        return d


@dataclass
class City:
    city_id: str
    name: str
    data_source: Optional[DataSource] = None

    def to_dict(self) -> dict:
        d = {"city_id": self.city_id, "name": self.name}
        if self.data_source:
            d["data_source"] = self.data_source.to_dict()
        return d


@dataclass
class Route:
    route_id: str
    from_city_id: str
    to_city_id: str
    distance_km: float
    avg_temp_c: float
    transit_hours: float
    data_source: Optional[DataSource] = None

    def city_pair_key(self) -> str:
        ordered = sorted([self.from_city_id, self.to_city_id])
        return f"{ordered[0]}->{ordered[1]}"

    def to_dict(self) -> dict:
        d = {
            "route_id": self.route_id,
            "from_city_id": self.from_city_id,
            "to_city_id": self.to_city_id,
            "distance_km": self.distance_km,
            "avg_temp_c": self.avg_temp_c,
            "transit_hours": self.transit_hours,
            "city_pair_key": self.city_pair_key(),
        }
        if self.data_source:
            d["data_source"] = self.data_source.to_dict()
        return d


@dataclass
class ConstraintConfig:
    max_insurance_per_batch_cny: float = 5_000_000.0
    high_value_threshold_cny: float = 2_000_000.0
    temp_violation_penalty_per_degree_hour: float = 500.0
    route_duplication_penalty: float = 1000.0
    insurance_risk_weight: float = 0.4
    temp_risk_weight: float = 0.35
    time_risk_weight: float = 0.25
    data_source: Optional[DataSource] = None

    def to_dict(self) -> dict:
        d = {
            "max_insurance_per_batch_cny": self.max_insurance_per_batch_cny,
            "high_value_threshold_cny": self.high_value_threshold_cny,
            "temp_violation_penalty_per_degree_hour": self.temp_violation_penalty_per_degree_hour,
            "route_duplication_penalty": self.route_duplication_penalty,
            "insurance_risk_weight": self.insurance_risk_weight,
            "temp_risk_weight": self.temp_risk_weight,
            "time_risk_weight": self.time_risk_weight,
        }
        if self.data_source:
            d["data_source"] = self.data_source.to_dict()
        return d
