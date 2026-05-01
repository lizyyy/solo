"""
数据模型模块 - 定义核心数据结构
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from uuid import uuid4


class OrderStatus(str, Enum):
    PENDING = "pending"
    SCANNED = "scanned"
    CHECKED = "checked"
    PASSED = "passed"
    QUARANTINED = "quarantined"
    PACKED = "packed"


class MaterialType(str, Enum):
    RESIN = "resin"
    CERAMIC = "ceramic"
    METAL = "metal"
    COMPOSITE = "composite"


@dataclass
class PatientInfo:
    patient_id: str
    patient_name: str = ""
    gender: str = ""
    age: int = 0


@dataclass
class ToothPosition:
    raw_position: str
    teeth: List[str] = field(default_factory=list)
    is_valid: bool = False
    validation_errors: List[str] = field(default_factory=list)


@dataclass
class MaterialInfo:
    material_type: MaterialType
    color_shade: str
    brand: str = ""
    model: str = ""


@dataclass
class ResinBatch:
    batch_number: str
    expiration_date: datetime
    manufacturer: str = ""
    material_name: str = ""
    
    @property
    def is_expired(self) -> bool:
        return datetime.now() > self.expiration_date


@dataclass
class PostProcessingRecord:
    case_id: str
    processing_type: str
    start_time: datetime
    end_time: datetime
    duration_minutes: int = 0
    operator: str = ""
    notes: str = ""
    
    def calculate_duration(self) -> int:
        if self.start_time and self.end_time:
            delta = self.end_time - self.start_time
            self.duration_minutes = int(delta.total_seconds() / 60)
        return self.duration_minutes


@dataclass
class ModelFile:
    file_path: str
    file_name: str
    file_type: str
    file_size: int
    hash_sha256: str
    creation_time: datetime
    modification_time: datetime
    associated_case_id: Optional[str] = None
    extracted_patient_id: Optional[str] = None
    extracted_tooth_position: Optional[str] = None


@dataclass
class ValidationIssue:
    rule_name: str
    severity: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule_name": self.rule_name,
            "severity": self.severity,
            "message": self.message,
            "details": self.details
        }


@dataclass
class OrderCase:
    case_id: str
    patient: PatientInfo
    tooth_position: ToothPosition
    material: MaterialInfo
    resin_batch: Optional[ResinBatch] = None
    post_processing: Optional[PostProcessingRecord] = None
    model_files: List[ModelFile] = field(default_factory=list)
    status: OrderStatus = OrderStatus.PENDING
    validation_issues: List[ValidationIssue] = field(default_factory=list)
    creation_time: datetime = field(default_factory=datetime.now)
    update_time: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_validation_issue(self, issue: ValidationIssue):
        self.validation_issues.append(issue)
        self.update_time = datetime.now()
    
    def has_critical_issues(self) -> bool:
        return any(issue.severity == "critical" for issue in self.validation_issues)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "case_id": self.case_id,
            "patient": {
                "patient_id": self.patient.patient_id,
                "patient_name": self.patient.patient_name,
                "gender": self.patient.gender,
                "age": self.patient.age
            },
            "tooth_position": {
                "raw_position": self.tooth_position.raw_position,
                "teeth": self.tooth_position.teeth,
                "is_valid": self.tooth_position.is_valid,
                "validation_errors": self.tooth_position.validation_errors
            },
            "material": {
                "material_type": self.material.material_type.value if self.material.material_type else None,
                "color_shade": self.material.color_shade,
                "brand": self.material.brand,
                "model": self.material.model
            },
            "resin_batch": {
                "batch_number": self.resin_batch.batch_number,
                "expiration_date": self.resin_batch.expiration_date.isoformat() if self.resin_batch else None,
                "manufacturer": self.resin_batch.manufacturer if self.resin_batch else None,
                "material_name": self.resin_batch.material_name if self.resin_batch else None,
                "is_expired": self.resin_batch.is_expired if self.resin_batch else None
            } if self.resin_batch else None,
            "post_processing": {
                "case_id": self.post_processing.case_id,
                "processing_type": self.post_processing.processing_type,
                "start_time": self.post_processing.start_time.isoformat() if self.post_processing.start_time else None,
                "end_time": self.post_processing.end_time.isoformat() if self.post_processing.end_time else None,
                "duration_minutes": self.post_processing.duration_minutes,
                "operator": self.post_processing.operator,
                "notes": self.post_processing.notes
            } if self.post_processing else None,
            "model_files": [
                {
                    "file_path": mf.file_path,
                    "file_name": mf.file_name,
                    "file_type": mf.file_type,
                    "file_size": mf.file_size,
                    "hash_sha256": mf.hash_sha256,
                    "creation_time": mf.creation_time.isoformat() if mf.creation_time else None,
                    "modification_time": mf.modification_time.isoformat() if mf.modification_time else None,
                    "associated_case_id": mf.associated_case_id,
                    "extracted_patient_id": mf.extracted_patient_id,
                    "extracted_tooth_position": mf.extracted_tooth_position
                }
                for mf in self.model_files
            ],
            "status": self.status.value,
            "validation_issues": [issue.to_dict() for issue in self.validation_issues],
            "creation_time": self.creation_time.isoformat(),
            "update_time": self.update_time.isoformat(),
            "metadata": self.metadata
        }


@dataclass
class Workspace:
    root_path: str
    creation_date: datetime
    workspace_id: str = field(default_factory=lambda: str(uuid4()))
    
    # 标准目录结构
    @property
    def orders_dir(self) -> str:
        import os
        return os.path.join(self.root_path, "orders")
    
    @property
    def models_dir(self) -> str:
        import os
        return os.path.join(self.root_path, "models")
    
    @property
    def records_dir(self) -> str:
        import os
        return os.path.join(self.root_path, "records")
    
    @property
    def quarantine_dir(self) -> str:
        import os
        return os.path.join(self.root_path, "quarantine")
    
    @property
    def output_dir(self) -> str:
        import os
        return os.path.join(self.root_path, "output")
    
    @property
    def reports_dir(self) -> str:
        import os
        return os.path.join(self.root_path, "reports")
    
    @property
    def config_file(self) -> str:
        import os
        return os.path.join(self.root_path, ".denture_checker_config.json")


@dataclass
class ValidationResult:
    total_cases: int
    passed_cases: int
    quarantined_cases: int
    issues_by_severity: Dict[str, int] = field(default_factory=lambda: {"critical": 0, "warning": 0, "info": 0})
    issues_by_rule: Dict[str, int] = field(default_factory=dict)
    validation_time: datetime = field(default_factory=datetime.now)
    
    def add_issue(self, issue: ValidationIssue):
        if issue.severity in self.issues_by_severity:
            self.issues_by_severity[issue.severity] += 1
        if issue.rule_name in self.issues_by_rule:
            self.issues_by_rule[issue.rule_name] += 1
        else:
            self.issues_by_rule[issue.rule_name] = 1
