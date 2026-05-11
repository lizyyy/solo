from dataclasses import dataclass, field
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from enum import Enum


class VehicleType(Enum):
    WASTE_COLLECTOR = "垃圾清运车"
    ROAD_SWEEPER = "道路清扫车"
    SPRINKLER = "洒水车"


class AnomalyType(Enum):
    DUPLICATE_RECORD = "重复数据"
    MISSING_FIELD = "缺失字段"
    FUEL_MISMATCH_MILEAGE = "油耗与里程不匹配"
    FUEL_MISMATCH_LOAD = "油耗与载重不匹配"
    FUEL_MISMATCH_IDLE = "油耗与怠速不匹配"
    MANUAL_ERROR = "人工改错"
    ABNORMAL_FUEL_CONSUMPTION = "油耗异常升高"


@dataclass
class FuelRecord:
    record_id: str
    vehicle_id: str
    vehicle_type: VehicleType
    plate_number: str
    date: date
    fuel_consumption: float
    route_mileage: float
    load_weight: float
    idle_time: float
    driver_name: str
    route_name: str
    notes: str = ""
    is_manual_edit: bool = False
    
    @property
    def fuel_per_km(self) -> float:
        if self.route_mileage > 0:
            return self.fuel_consumption / self.route_mileage
        return 0.0
    
    @property
    def load_factor(self) -> float:
        base_load = {
            VehicleType.WASTE_COLLECTOR: 5000,
            VehicleType.ROAD_SWEEPER: 3000,
            VehicleType.SPRINKLER: 8000,
        }
        return self.load_weight / base_load.get(self.vehicle_type, 5000)


@dataclass
class Anomaly:
    record_id: str
    anomaly_type: AnomalyType
    severity: str
    description: str
    evidence: Dict[str, Any] = field(default_factory=dict)
    suggestion: str = ""
    detected_at: datetime = field(default_factory=datetime.now)


@dataclass
class AnalysisResult:
    total_records: int
    valid_records: int
    anomaly_count: int
    anomalies: List[Anomaly]
    summary: Dict[str, Any]
    analysis_date: datetime = field(default_factory=datetime.now)
    
    @property
    def anomaly_rate(self) -> float:
        if self.total_records > 0:
            return self.anomaly_count / self.total_records
        return 0.0