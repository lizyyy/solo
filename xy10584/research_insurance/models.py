from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class StudentStatus(str, Enum):
    ACTIVE = 'active'
    WITHDRW = 'withdrawn'
    PENDING = 'pending'


class CheckResult(str, Enum):
    CAN_GO = 'can_go'
    CANNOT_GO = 'cannot_go'
    NEED_INFO = 'need_info'


@dataclass
class Student:
    id: str
    name: str
    id_card: str
    school: str
    class_name: str
    guardian_name: str
    guardian_phone: str
    status: StudentStatus = StudentStatus.ACTIVE
    created_at: str = ''
    updated_at: str = ''


@dataclass
class Insurance:
    id: str
    student_name: str
    student_id_card: str
    policy_number: str
    insurance_company: str
    start_date: str
    end_date: str
    amount: float
    status: str = 'valid'
    created_at: str = ''
    updated_at: str = ''


@dataclass
class Authorization:
    id: str
    student_name: str
    student_id_card: str
    guardian_name: str
    guardian_id_card: str
    relation: str
    signature_status: bool
    emergency_contact: str
    emergency_phone: str
    medical_allergy: str = ''
    special_needs: str = ''
    created_at: str = ''


@dataclass
class Vehicle:
    id: str
    plate_number: str
    driver_name: str
    driver_phone: str
    capacity: int
    route: str
    student_ids: List[str] = field(default_factory=list)
    created_at: str = ''
    updated_at: str = ''


@dataclass
class Withdrawal:
    id: str
    student_id: str
    student_name: str
    student_id_card: str
    reason: str
    withdrawal_date: str
    operator: str
    refund_status: str = 'pending'
    insurance_voided: bool = False
    created_at: str = ''


@dataclass
class AuditLog:
    id: str
    operation: str
    entity_type: str
    entity_id: str
    before: Optional[Dict[str, Any]]
    after: Optional[Dict[str, Any]]
    operator: str
    timestamp: str
    reason: str = ''


@dataclass
class CheckReport:
    student_id: str
    student_name: str
    student_id_card: str
    result: CheckResult
    issues: List[str]
    warnings: List[str]
    ok_items: List[str]
    check_time: str
    is_withdrawn: bool
