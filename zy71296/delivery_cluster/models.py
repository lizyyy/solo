from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class AnomalyType(Enum):
    STRAIGHT_LINE_MISLEADING = "straight_line_misleading"
    ZONE_OVERLOAD = "zone_overload"
    BRIDGE_DETOUR_MISSED = "bridge_detour_missed"
    ISOLATED_ORDER = "isolated_order"
    CAPACITY_VIOLATION = "capacity_violation"


@dataclass
class Order:
    id: str
    lat: float
    lng: float
    timestamp: Optional[str] = None
    weight: float = 1.0
    source_file: Optional[str] = None
    source_line: Optional[int] = None

    def __post_init__(self):
        if self.weight <= 0:
            raise ValueError(
                f"订单 {self.id} 重量 {self.weight} 无效"
                f"（来源: {self.source_file} 第 {self.source_line} 行）"
            )
        if not (-90 <= self.lat <= 90):
            raise ValueError(
                f"订单 {self.id} 纬度 {self.lat} 超出范围"
                f"（来源: {self.source_file} 第 {self.source_line} 行）"
            )
        if not (-180 <= self.lng <= 180):
            raise ValueError(
                f"订单 {self.id} 经度 {self.lng} 超出范围"
                f"（来源: {self.source_file} 第 {self.source_line} 行）"
            )


@dataclass
class Rider:
    id: str
    lat: float
    lng: float
    capacity: float = 50.0
    source_file: Optional[str] = None
    source_line: Optional[int] = None


@dataclass
class RoadEdge:
    from_node: str
    to_node: str
    distance_m: float
    has_bridge: bool = False
    bridge_id: Optional[str] = None
    source_file: Optional[str] = None
    source_line: Optional[int] = None

    def __post_init__(self):
        if self.distance_m < 0:
            raise ValueError(
                f"路段 {self.from_node}->{self.to_node} 距离 {self.distance_m} 为负"
                f"（来源: {self.source_file} 第 {self.source_line} 行）"
            )


@dataclass
class Bridge:
    id: str
    name: str
    lat: float
    lng: float
    detour_penalty_m: float = 0.0
    source_file: Optional[str] = None
    source_line: Optional[int] = None

    def __post_init__(self):
        if self.detour_penalty_m < 0:
            raise ValueError(
                f"桥梁 {self.id} 绕行罚距 {self.detour_penalty_m} 为负"
                f"（来源: {self.source_file} 第 {self.source_line} 行）"
            )


@dataclass
class Node:
    id: str
    lat: float
    lng: float


@dataclass
class CapacityConfig:
    max_orders_per_zone: int = 60
    max_weight_per_zone: float = 300.0
    max_radius_m: float = 3000.0
    straight_line_ratio_threshold: float = 0.65
    min_distance_diff_m: float = 200.0
    bridge_detour_threshold_m: float = 500.0


@dataclass
class Zone:
    id: str
    rider_id: Optional[str] = None
    orders: list = field(default_factory=list)
    center_lat: float = 0.0
    center_lng: float = 0.0
    max_road_distance_m: float = 0.0
    max_straight_distance_m: float = 0.0
    total_weight: float = 0.0
    bridge_crossings: int = 0
    anomalies: list = field(default_factory=list)

    @property
    def order_count(self) -> int:
        return len(self.orders)

    def to_dict(self) -> dict:
        return {
            "zone_id": self.id,
            "rider_id": self.rider_id,
            "order_count": self.order_count,
            "center_lat": round(self.center_lat, 6),
            "center_lng": round(self.center_lng, 6),
            "max_road_distance_m": round(self.max_road_distance_m, 1),
            "max_straight_distance_m": round(self.max_straight_distance_m, 1),
            "total_weight": round(self.total_weight, 2),
            "bridge_crossings": self.bridge_crossings,
            "anomalies": [a.to_dict() for a in self.anomalies],
            "order_ids": [o.id for o in self.orders],
        }


@dataclass
class Anomaly:
    anomaly_type: AnomalyType
    severity: str
    message: str
    details: dict = field(default_factory=dict)
    source_file: Optional[str] = None
    source_line: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            "type": self.anomaly_type.value,
            "severity": self.severity,
            "message": self.message,
            "details": self.details,
            "source_file": self.source_file,
            "source_line": self.source_line,
        }
