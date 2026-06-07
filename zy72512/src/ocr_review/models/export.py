from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class ExportStatus(str, Enum):
    DRAFT = "draft"
    GENERATED = "generated"
    AUDIT_PASSED = "audit_passed"
    AUDIT_FAILED = "audit_failed"
    DISTRIBUTED = "distributed"


@dataclass
class ExportField:
    field_name: str
    original_value: str
    masked_value: str
    is_masked: bool
    mask_rule_applied: Optional[str] = None
    leak_risk: str = "none"
    explanation: str = ""
    next_step: str = ""
    responsible_role: str = ""


@dataclass
class ExportRecord:
    export_id: str
    ticket_id: str
    generated_at: datetime
    generated_by: str
    fields: List[ExportField]
    status: ExportStatus = ExportStatus.DRAFT
    audit_notes: List[Dict[str, Any]] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    output_paths: Dict[str, str] = field(default_factory=dict)
    mask_version: str = "1.0"
    metadata: Dict[str, Any] = field(default_factory=dict)

    def get_leaking_fields(self) -> List[ExportField]:
        return [f for f in self.fields if f.leak_risk != "none"]

    def has_leaks(self) -> bool:
        return any(f.leak_risk != "none" for f in self.fields)

    def get_fields_needing_algorithm(self) -> List[ExportField]:
        return [f for f in self.fields if f.responsible_role == "algorithm"]

    def get_fields_needing_operation(self) -> List[ExportField]:
        return [f for f in self.fields if f.responsible_role == "operation"]

    def add_audit_note(self, note: str, auditor: str, passed: bool):
        self.audit_notes.append({
            "note": note,
            "auditor": auditor,
            "passed": passed,
            "timestamp": datetime.now().isoformat()
        })
        if passed:
            self.status = ExportStatus.AUDIT_PASSED
        else:
            self.status = ExportStatus.AUDIT_FAILED
