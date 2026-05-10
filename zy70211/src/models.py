from dataclasses import dataclass, field
from datetime import datetime, date
from typing import List, Optional, Dict
from enum import Enum


class BarnStatus(str, Enum):
    IDLE = "空闲"
    PREPARING = "准备中"
    FUMIGATING = "熏蒸中"
    SEALED = "封仓中"
    COMPLETED = "已完成"


class FumigationStatus(str, Enum):
    DRAFT = "草稿"
    SUBMITTED = "已提交"
    APPROVED = "已批准"
    IN_PROGRESS = "进行中"
    COMPLETED = "已完成"
    CANCELLED = "已取消"


class CheckStatus(str, Enum):
    PENDING = "待核对"
    PASSED = "通过"
    FAILED = "不通过"
    NEED_CONFIRM = "需人工确认"
    SKIPPED = "已跳过"


@dataclass
class GrainBarn:
    barn_id: str
    barn_name: str
    location: str
    capacity: float
    current_grain_type: str
    current_grain_quantity: float
    last_fumigation_date: Optional[date]
    status: BarnStatus
    created_at: datetime
    updated_at: datetime

    def to_dict(self) -> Dict:
        return {
            "barn_id": self.barn_id,
            "barn_name": self.barn_name,
            "location": self.location,
            "capacity": self.capacity,
            "current_grain_type": self.current_grain_type,
            "current_grain_quantity": self.current_grain_quantity,
            "last_fumigation_date": self.last_fumigation_date.isoformat() if self.last_fumigation_date else "",
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }


@dataclass
class ChemicalRecord:
    chemical_name: str
    chemical_type: str
    dosage: float
    unit: str
    batch_number: str
    expiration_date: date
    supplier: str


@dataclass
class EvacuationRecord:
    personnel_name: str
    personnel_id: str
    department: str
    evacuation_time: datetime
    check_time: datetime
    check_person: str


@dataclass
class FumigationPlan:
    plan_id: str
    barn_id: str
    plan_date: date
    estimated_duration_hours: float
    target_pests: str
    operator: str
    chemicals: List[ChemicalRecord]
    evacuations: List[EvacuationRecord]
    status: FumigationStatus
    created_at: datetime
    updated_at: datetime
    remarks: str = ""

    def to_dict(self) -> Dict:
        return {
            "plan_id": self.plan_id,
            "barn_id": self.barn_id,
            "plan_date": self.plan_date.isoformat(),
            "estimated_duration_hours": self.estimated_duration_hours,
            "target_pests": self.target_pests,
            "operator": self.operator,
            "status": self.status.value,
            "remarks": self.remarks,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }


@dataclass
class CheckItem:
    check_id: str
    plan_id: str
    check_type: str
    check_description: str
    check_value: Optional[str]
    expected_value: Optional[str]
    status: CheckStatus
    message: str
    checked_at: Optional[datetime]
    checked_by: Optional[str]

    def to_dict(self) -> Dict:
        return {
            "check_id": self.check_id,
            "plan_id": self.plan_id,
            "check_type": self.check_type,
            "check_description": self.check_description,
            "check_value": self.check_value or "",
            "expected_value": self.expected_value or "",
            "status": self.status.value,
            "message": self.message,
            "checked_at": self.checked_at.isoformat() if self.checked_at else "",
            "checked_by": self.checked_by or ""
        }


@dataclass
class FumigationCheck:
    check_id: str
    plan_id: str
    barn_id: str
    barn_name: str
    temperature: float
    humidity: float
    seal_start_time: datetime
    seal_quality_score: float
    overall_status: CheckStatus
    items: List[CheckItem]
    created_at: datetime
    updated_at: datetime

    def to_dict(self) -> Dict:
        return {
            "check_id": self.check_id,
            "plan_id": self.plan_id,
            "barn_id": self.barn_id,
            "barn_name": self.barn_name,
            "temperature": self.temperature,
            "humidity": self.humidity,
            "seal_start_time": self.seal_start_time.isoformat(),
            "seal_quality_score": self.seal_quality_score,
            "overall_status": self.overall_status.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }


@dataclass
class ProcessResult:
    total_rows: int
    processed_rows: int
    skipped_rows: List[Dict]
    success_rows: List[Dict]
    need_confirm_rows: List[Dict]
    failed_rows: List[Dict]
    warnings: List[str]
    errors: List[str]
