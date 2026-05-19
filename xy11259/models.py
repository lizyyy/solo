from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any

@dataclass
class HiddenDanger:
    """隐患记录"""
    id: Optional[int]
    hazard_id: str
    description: str
    location: str
    person_in_charge: str
    status: str
    exception_type: str
    discovered_date: str
    deadline: str
    created_at: str
    updated_at: str

@dataclass
class PhotoRecord:
    """照片记录"""
    id: Optional[int]
    photo_id: str
    hazard_id: str
    file_path: str
    photo_type: str
    uploaded_at: str
    uploaded_by: str

@dataclass
class ReviewRecord:
    """复查记录"""
    id: Optional[int]
    review_id: str
    hazard_id: str
    reviewer: str
    review_date: str
    result: str
    remarks: str
    created_at: str

@dataclass
class BadRecord:
    """坏记录"""
    id: Optional[int]
    source_type: str
    source_file: str
    line_number: int
    raw_data: str
    failure_reason: str
    suggestion: str
    created_at: str
