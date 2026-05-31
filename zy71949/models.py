from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import hashlib
import json


class VerificationStatus(Enum):
    PASSED = "PASSED"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"
    PENDING = "PENDING"


class FaultSeverity(Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


@dataclass
class OrbitElements:
    orbit_id: str
    semi_major_axis: float
    eccentricity: float
    inclination: float
    raan: float
    argument_of_perigee: float
    true_anomaly: float
    epoch: str
    source: str
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "orbit_id": self.orbit_id,
            "semi_major_axis": self.semi_major_axis,
            "eccentricity": self.eccentricity,
            "inclination": self.inclination,
            "raan": self.raan,
            "argument_of_perigee": self.argument_of_perigee,
            "true_anomaly": self.true_anomaly,
            "epoch": self.epoch,
            "source": self.source,
            "created_at": self.created_at.isoformat()
        }


@dataclass
class VersionEntry:
    version: int
    modified_by: str
    modified_at: datetime
    change_summary: str
    diff: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "modified_by": self.modified_by,
            "modified_at": self.modified_at.isoformat(),
            "change_summary": self.change_summary,
            "diff": self.diff
        }


@dataclass
class FaultRecord:
    fault_id: str
    fault_type: str
    description: str
    severity: FaultSeverity
    telemetry_segment_id: str
    orbit_id: Optional[str]
    antenna_pointing_error: Optional[float]
    detected_at: str
    reported_by: str
    confirmed: bool = False
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    versions: List[VersionEntry] = field(default_factory=list)
    current_version: int = 1
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "fault_id": self.fault_id,
            "fault_type": self.fault_type,
            "description": self.description,
            "severity": self.severity.value,
            "telemetry_segment_id": self.telemetry_segment_id,
            "orbit_id": self.orbit_id,
            "antenna_pointing_error": self.antenna_pointing_error,
            "detected_at": self.detected_at,
            "reported_by": self.reported_by,
            "confirmed": self.confirmed,
            "confirmed_by": self.confirmed_by,
            "confirmed_at": self.confirmed_at.isoformat() if self.confirmed_at else None,
            "current_version": self.current_version,
            "versions": [v.to_dict() for v in self.versions],
            "created_at": self.created_at.isoformat()
        }

    def _serialize_value(self, value: Any) -> Any:
        if isinstance(value, datetime):
            return value.isoformat()
        return value

    def update(self, changes: Dict[str, Any], modified_by: str, change_summary: str) -> None:
        old_values = {}
        new_values = {}
        for key, new_value in changes.items():
            if hasattr(self, key):
                old_values[key] = self._serialize_value(getattr(self, key))
                new_values[key] = self._serialize_value(new_value)
                setattr(self, key, new_value)

        self.current_version += 1
        self.versions.append(VersionEntry(
            version=self.current_version,
            modified_by=modified_by,
            modified_at=datetime.now(),
            change_summary=change_summary,
            diff={"old": old_values, "new": new_values}
        ))

    def confirm(self, confirmed_by: str) -> None:
        self.confirmed = True
        self.confirmed_by = confirmed_by
        self.confirmed_at = datetime.now()
        self.update(
            {"confirmed": True, "confirmed_by": confirmed_by, "confirmed_at": self.confirmed_at},
            confirmed_by,
            "人工确认故障记录"
        )

    def compute_content_hash(self) -> str:
        content = json.dumps({
            "fault_type": self.fault_type,
            "description": self.description,
            "severity": self.severity.value,
            "telemetry_segment_id": self.telemetry_segment_id,
            "orbit_id": self.orbit_id,
            "antenna_pointing_error": self.antenna_pointing_error,
            "detected_at": self.detected_at
        }, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()


@dataclass
class EvidenceLink:
    from_type: str
    from_id: str
    to_type: str
    to_id: str
    relationship: str
    description: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "from_type": self.from_type,
            "from_id": self.from_id,
            "to_type": self.to_type,
            "to_id": self.to_id,
            "relationship": self.relationship,
            "description": self.description
        }


@dataclass
class VerificationItem:
    fault_id: str
    orbit_id: Optional[str]
    status: VerificationStatus
    error_details: Optional[str]
    pointing_accuracy: Optional[float]
    expected_accuracy: float
    evidence: List[EvidenceLink]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "fault_id": self.fault_id,
            "orbit_id": self.orbit_id,
            "status": self.status.value,
            "error_details": self.error_details,
            "pointing_accuracy": self.pointing_accuracy,
            "expected_accuracy": self.expected_accuracy,
            "evidence": [e.to_dict() for e in self.evidence]
        }


@dataclass
class VerificationRecord:
    verification_id: str
    material_batch_id: str
    material_content_hash: str
    status: VerificationStatus
    items: List[VerificationItem]
    started_at: datetime
    completed_at: Optional[datetime]
    summary: str
    is_re_run: bool = False
    previous_verification_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "verification_id": self.verification_id,
            "material_batch_id": self.material_batch_id,
            "material_content_hash": self.material_content_hash,
            "status": self.status.value,
            "is_re_run": self.is_re_run,
            "previous_verification_id": self.previous_verification_id,
            "items": [item.to_dict() for item in self.items],
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "summary": self.summary
        }


@dataclass
class TaskBriefing:
    briefing_id: str
    verification_id: str
    material_batch_id: str
    generated_at: datetime
    generated_by: str
    overall_status: VerificationStatus
    total_faults: int
    passed_count: int
    failed_count: int
    pending_count: int
    critical_issues: List[str]
    warnings: List[str]
    evidence_summary: List[Dict[str, Any]]
    recommendations: List[str]
    raw_data_path: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "briefing_id": self.briefing_id,
            "verification_id": self.verification_id,
            "material_batch_id": self.material_batch_id,
            "generated_at": self.generated_at.isoformat(),
            "generated_by": self.generated_by,
            "overall_status": self.overall_status.value,
            "total_faults": self.total_faults,
            "passed_count": self.passed_count,
            "failed_count": self.failed_count,
            "pending_count": self.pending_count,
            "critical_issues": self.critical_issues,
            "warnings": self.warnings,
            "evidence_summary": self.evidence_summary,
            "recommendations": self.recommendations,
            "raw_data_path": self.raw_data_path
        }


@dataclass
class MaterialBatch:
    batch_id: str
    faults: List[FaultRecord]
    orbits: List[OrbitElements]
    received_at: datetime = field(default_factory=datetime.now)

    def compute_content_hash(self) -> str:
        content = json.dumps({
            "faults": [f.compute_content_hash() for f in sorted(self.faults, key=lambda x: x.fault_id)],
            "orbits": [o.to_dict() for o in sorted(self.orbits, key=lambda x: x.orbit_id)]
        }, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "content_hash": self.compute_content_hash(),
            "faults": [f.to_dict() for f in self.faults],
            "orbits": [o.to_dict() for o in self.orbits],
            "received_at": self.received_at.isoformat()
        }
