from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, List, Dict, Any


@dataclass(frozen=True)
class DeviceId:
    canonical: str

    def __str__(self):
        return self.canonical

    def __hash__(self):
        return hash(self.canonical)

    def to_dict(self):
        return self.canonical


@dataclass
class PhotoEvidence:
    photo_id: str
    filename: str
    photo_time: datetime
    upload_time: datetime
    time_mismatch: bool = False
    mismatch_seconds: int = 0

    def to_dict(self):
        return {
            "photo_id": self.photo_id,
            "filename": self.filename,
            "photo_time": self.photo_time.isoformat(),
            "upload_time": self.upload_time.isoformat(),
            "time_mismatch": self.time_mismatch,
            "mismatch_seconds": self.mismatch_seconds,
        }


@dataclass
class HandoverRecord:
    record_id: str
    source_device_id_raw: str
    normalized_device_id: Optional[DeviceId]
    shift: str
    recorder: str
    record_time: datetime
    on_site_trace: str
    temperature_c: Optional[float]
    spare_part_needed: Optional[str]
    spare_part_quantity: Optional[int]
    photos: List[PhotoEvidence] = field(default_factory=list)
    raw_json: str = ""

    def to_dict(self):
        return {
            "record_id": self.record_id,
            "source_device_id_raw": self.source_device_id_raw,
            "normalized_device_id": (
                self.normalized_device_id.to_dict()
                if self.normalized_device_id
                else None
            ),
            "shift": self.shift,
            "recorder": self.recorder,
            "record_time": self.record_time.isoformat(),
            "on_site_trace": self.on_site_trace,
            "temperature_c": self.temperature_c,
            "spare_part_needed": self.spare_part_needed,
            "spare_part_quantity": self.spare_part_quantity,
            "photos": [p.to_dict() for p in self.photos],
        }


@dataclass
class SchedulerResult:
    result_id: str
    device_id: DeviceId
    scheduled_date: datetime
    spare_part_code: str
    spare_part_name: str
    quantity: int
    priority: str
    handover_record_ids: List[str] = field(default_factory=list)
    manual_remark: str = ""
    is_manual_remark_protected: bool = False
    dedup_key: str = ""
    source_dedup_count: int = 0

    def to_dict(self):
        return {
            "result_id": self.result_id,
            "device_id": self.device_id.to_dict(),
            "scheduled_date": self.scheduled_date.strftime("%Y-%m-%d"),
            "spare_part_code": self.spare_part_code,
            "spare_part_name": self.spare_part_name,
            "quantity": self.quantity,
            "priority": self.priority,
            "handover_record_ids": list(self.handover_record_ids),
            "manual_remark": self.manual_remark,
            "is_manual_remark_protected": self.is_manual_remark_protected,
            "dedup_key": self.dedup_key,
            "source_dedup_count": self.source_dedup_count,
        }


@dataclass
class BadDataTrace:
    trace_id: str
    handover_record_id: str
    source_device_id_raw: str
    error_type: str
    error_message: str
    record_time: datetime
    on_site_trace_hint: str
    raw_snippet: str = ""

    def to_dict(self):
        return {
            "trace_id": self.trace_id,
            "handover_record_id": self.handover_record_id,
            "source_device_id_raw": self.source_device_id_raw,
            "error_type": self.error_type,
            "error_message": self.error_message,
            "record_time": self.record_time.isoformat(),
            "on_site_trace_hint": self.on_site_trace_hint,
            "raw_snippet": self.raw_snippet,
            "navigate_hint": (
                f"请在班组交接记录中查询 record_id="
                f"{self.handover_record_id} 或现场痕迹包含"
                f"「{self.on_site_trace_hint[:20]}」的原始条目。"
            ),
        }


@dataclass
class PhotoMismatchImpact:
    affected_result_ids: List[str]
    affected_device_ids: List[str]
    impact_scope: str
    wrap_up_action: str

    def to_dict(self):
        return {
            "affected_result_ids": list(self.affected_result_ids),
            "affected_device_ids": list(self.affected_device_ids),
            "impact_scope": self.impact_scope,
            "wrap_up_action": self.wrap_up_action,
        }


@dataclass
class ImportReport:
    import_run_id: str
    start_time: datetime
    end_time: Optional[datetime]
    records_read: int
    records_new: int
    records_duplicate_skipped: int
    records_bad_data: int
    bad_data_trace_ids: List[str] = field(default_factory=list)
    preserved_manual_remarks: int = 0
    overwritten_remark_rejected: int = 0
    photo_mismatch_impact: Optional[PhotoMismatchImpact] = None
    failure_code: str = "OK"
    failure_reason: str = ""

    def to_dict(self):
        return {
            "import_run_id": self.import_run_id,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "records_read": self.records_read,
            "records_new": self.records_new,
            "records_duplicate_skipped": self.records_duplicate_skipped,
            "records_bad_data": self.records_bad_data,
            "bad_data_trace_ids": list(self.bad_data_trace_ids),
            "preserved_manual_remarks": self.preserved_manual_remarks,
            "overwritten_remark_rejected": self.overwritten_remark_rejected,
            "photo_mismatch_impact": (
                self.photo_mismatch_impact.to_dict()
                if self.photo_mismatch_impact
                else None
            ),
            "failure_code": self.failure_code,
            "failure_reason": self.failure_reason,
        }


@dataclass
class PageSummary:
    as_of_time: datetime
    total_results: int
    pending_tonight: int
    priority_high_count: int
    priority_medium_count: int
    priority_low_count: int
    last_import_report: Optional[ImportReport]
    active_bad_data_count: int
    changed_since_last_run: List[str] = field(default_factory=list)
    change_description: str = ""
    boundary_samples_added: List[str] = field(default_factory=list)

    def to_dict(self):
        return {
            "as_of_time": self.as_of_time.isoformat(),
            "total_results": self.total_results,
            "pending_tonight": self.pending_tonight,
            "priority_high_count": self.priority_high_count,
            "priority_medium_count": self.priority_medium_count,
            "priority_low_count": self.priority_low_count,
            "last_import_report": (
                self.last_import_report.to_dict()
                if self.last_import_report
                else None
            ),
            "active_bad_data_count": self.active_bad_data_count,
            "changed_since_last_run": list(self.changed_since_last_run),
            "change_description": self.change_description,
            "boundary_samples_added": list(self.boundary_samples_added),
        }
