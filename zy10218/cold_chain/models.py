from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class TemperatureSeverity(Enum):
    NORMAL = "正常"
    WARNING = "警告"
    CRITICAL = "严重"


class NodeType(Enum):
    START = "起点"
    TRANSIT = "中转"
    END = "终点"


@dataclass
class TemperatureReading:
    sensor_id: str
    vehicle_id: str
    time: datetime
    temperature: float
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if isinstance(self.time, str):
            self.time = datetime.strptime(self.time, "%Y-%m-%d %H:%M:%S")


@dataclass
class VehicleRoute:
    route_id: str
    vehicle_id: str
    start_time: datetime
    end_time: datetime
    start_node: str
    end_node: str
    driver_id: str
    driver_name: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if isinstance(self.start_time, str):
            self.start_time = datetime.strptime(self.start_time, "%Y-%m-%d %H:%M:%S")
        if isinstance(self.end_time, str):
            self.end_time = datetime.strptime(self.end_time, "%Y-%m-%d %H:%M:%S")


@dataclass
class Node:
    node_id: str
    node_name: str
    node_type: NodeType
    address: str
    responsible_party: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if isinstance(self.node_type, str):
            try:
                self.node_type = NodeType(self.node_type)
            except ValueError:
                if self.node_type == "起点":
                    self.node_type = NodeType.START
                elif self.node_type == "中转":
                    self.node_type = NodeType.TRANSIT
                elif self.node_type == "终点":
                    self.node_type = NodeType.END


@dataclass
class SignoffRecord:
    signoff_id: str
    node_id: str
    vehicle_id: str
    batch_id: str
    signoff_time: datetime
    operator: str
    temperature_at_signoff: Optional[float] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if isinstance(self.signoff_time, str):
            self.signoff_time = datetime.strptime(self.signoff_time, "%Y-%m-%d %H:%M:%S")


@dataclass
class Batch:
    batch_id: str
    product_name: str
    product_type: str
    quantity: int
    temperature_min: float
    temperature_max: float
    start_node: str
    end_node: str
    expected_delivery_time: Optional[datetime] = None
    actual_delivery_time: Optional[datetime] = None
    vehicle_ids: List[str] = field(default_factory=list)
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if isinstance(self.expected_delivery_time, str):
            self.expected_delivery_time = datetime.strptime(
                self.expected_delivery_time, "%Y-%m-%d %H:%M:%S"
            )
        if isinstance(self.actual_delivery_time, str):
            self.actual_delivery_time = datetime.strptime(
                self.actual_delivery_time, "%Y-%m-%d %H:%M:%S"
            )


@dataclass
class ThresholdRule:
    rule_id: str
    product_type: str
    warning_min: float
    warning_max: float
    critical_min: float
    critical_max: float
    allowed_duration: int
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TimeDrift:
    sensor_id: str
    vehicle_id: str
    estimated_drift_seconds: float
    confidence: float
    drift_type: str
    reference_event: str
    detected_at: datetime


@dataclass
class TemperatureAnomaly:
    anomaly_id: str
    batch_id: str
    vehicle_id: str
    sensor_id: str
    start_time: datetime
    end_time: datetime
    max_temperature: float
    min_temperature: float
    avg_temperature: float
    severity: TemperatureSeverity
    duration_minutes: float
    temperature_points: List[TemperatureReading] = field(default_factory=list)
    responsible_segments: List[Dict[str, Any]] = field(default_factory=list)
    time_drift_info: Optional[TimeDrift] = None
    data_gaps: List[Dict[str, Any]] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)
    requires_manual_confirmation: bool = False


@dataclass
class DataGap:
    gap_id: str
    vehicle_id: str
    batch_id: str
    gap_type: str
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    description: str
    severity: str


@dataclass
class TraceResult:
    execution_time: datetime
    total_batches: int
    batches_with_anomalies: int
    total_anomalies: int
    anomalies: List[TemperatureAnomaly] = field(default_factory=list)
    data_gaps: List[DataGap] = field(default_factory=list)
    time_drifts: List[TimeDrift] = field(default_factory=list)
    batch_summary: Dict[str, Any] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)


@dataclass
class DataFingerprint:
    source: str
    checksum: str
    record_count: int
    timestamp: datetime
    data_range: Dict[str, datetime]
