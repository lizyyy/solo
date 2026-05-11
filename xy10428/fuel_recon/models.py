from dataclasses import dataclass, field
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from enum import Enum


class FuelType(str, Enum):
    GASOLINE = "汽油"
    DIESEL = "柴油"
    NATURAL_GAS = "天然气"


class AbnormalType(str, Enum):
    NORMAL = "正常"
    OUT_OF_SCHEDULE = "非排班加油"
    FUEL_EXCEED = "油耗超阈值"
    DUPLICATE = "重复流水"
    MILEAGE_BACKWARD = "里程倒退"
    MISSING_MILEAGE = "缺少里程"
    SUSPICIOUS_PRIVATE = "疑似私用"


class ReviewStatus(str, Enum):
    PENDING = "待复核"
    CONFIRMED_NORMAL = "确认正常"
    CONFIRMED_ABNORMAL = "确认异常"
    UNDER_INVESTIGATION = "调查中"


@dataclass
class Vehicle:
    plate_number: str
    standard_fuel_consumption: float
    fuel_type: FuelType
    fuel_tank_capacity: float = 0.0
    driver_name: Optional[str] = None


@dataclass
class FuelRecord:
    id: str
    plate_number: str
    fuel_time: datetime
    fuel_amount: float
    fuel_liters: float
    unit_price: float
    station_name: str
    card_number: str
    odometer: Optional[float] = None
    fuel_type: FuelType = FuelType.GASOLINE


@dataclass
class MileageRecord:
    id: str
    plate_number: str
    record_time: datetime
    odometer: float
    location: str = ""
    operator: str = ""


@dataclass
class ScheduleRecord:
    id: str
    driver_name: str
    plate_number: str
    shift_date: date
    shift_type: str
    start_time: datetime
    end_time: datetime
    route: str = ""


@dataclass
class ReviewNote:
    id: str
    fuel_record_id: str
    reviewer: str
    review_time: datetime
    status: ReviewStatus
    conclusion: str
    remarks: str = ""


@dataclass
class MatchedResult:
    fuel_record: FuelRecord
    schedule: Optional[ScheduleRecord]
    previous_mileage: Optional[MileageRecord]
    next_mileage: Optional[MileageRecord]
    calculated_distance: Optional[float]
    calculated_fuel_consumption: Optional[float]
    abnormal_types: List[AbnormalType]
    is_normal: bool
    driver_name: Optional[str] = None
    review_note: Optional[ReviewNote] = None


@dataclass
class ReconciliationResult:
    total_amount: float
    abnormal_amount: float
    normal_amount: float
    total_records: int
    abnormal_records: int
    normal_records: int
    pending_review_drivers: Dict[str, List[MatchedResult]]
    matched_results: List[MatchedResult]
    summary: Dict[str, Any] = field(default_factory=dict)
