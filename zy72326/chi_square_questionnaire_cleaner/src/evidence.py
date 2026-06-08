from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
import json
import copy


class ProcessingStatus(Enum):
    PENDING_REVIEW = "pending_review"
    CONFIRMED_ANOMALY = "confirmed_anomaly"
    CONFIRMED_NORMAL = "confirmed_normal"
    SUPPLEMENTED = "supplemented"
    AUTO_FLAGGED = "auto_flagged"


@dataclass
class EvidenceRecord:
    evidence_id: str
    original_row: int
    field_name: str
    original_value: Any
    manual_change: Optional[str]
    current_status: ProcessingStatus
    anomaly_type: str
    timestamp: str
    detail: str = ""
    original_statement: Optional[str] = None
    corrected_value: Optional[Any] = None
    review_reason: Optional[str] = None
    next_step: Optional[str] = None
    reviewer: Optional[str] = None
    supplemented_by: Optional[str] = None
    supplemented_values: Optional[dict] = None

    def to_dict(self) -> dict:
        return {
            "evidence_id": self.evidence_id,
            "original_row": self.original_row,
            "field_name": self.field_name,
            "original_value": self.original_value,
            "manual_change": self.manual_change,
            "current_status": self.current_status.value,
            "anomaly_type": self.anomaly_type,
            "timestamp": self.timestamp,
            "detail": self.detail,
            "original_statement": self.original_statement,
            "corrected_value": self.corrected_value,
            "review_reason": self.review_reason,
            "next_step": self.next_step,
            "reviewer": self.reviewer,
            "supplemented_by": self.supplemented_by,
            "supplemented_values": self.supplemented_values,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "EvidenceRecord":
        d = copy.deepcopy(d)
        d["current_status"] = ProcessingStatus(d["current_status"])
        return cls(**d)


class EvidenceChain:
    def __init__(self):
        self._records: list[EvidenceRecord] = []
        self._counter: int = 0

    def _next_id(self) -> str:
        self._counter += 1
        return f"EVD-{self._counter:04d}"

    def add(
        self,
        original_row: int,
        field_name: str,
        original_value: Any,
        anomaly_type: str,
        detail: str = "",
        manual_change: Optional[str] = None,
        status: ProcessingStatus = ProcessingStatus.AUTO_FLAGGED,
        original_statement: Optional[str] = None,
        corrected_value: Optional[Any] = None,
        review_reason: Optional[str] = None,
        next_step: Optional[str] = None,
        reviewer: Optional[str] = None,
        supplemented_by: Optional[str] = None,
        supplemented_values: Optional[dict] = None,
    ) -> EvidenceRecord:
        rec = EvidenceRecord(
            evidence_id=self._next_id(),
            original_row=original_row,
            field_name=field_name,
            original_value=original_value,
            manual_change=manual_change,
            current_status=status,
            anomaly_type=anomaly_type,
            timestamp=datetime.now().isoformat(),
            detail=detail,
            original_statement=original_statement,
            corrected_value=corrected_value,
            review_reason=review_reason,
            next_step=next_step,
            reviewer=reviewer,
            supplemented_by=supplemented_by,
            supplemented_values=supplemented_values,
        )
        self._records.append(rec)
        return rec

    def update_status(
        self,
        evidence_id: str,
        new_status: ProcessingStatus,
        manual_change: Optional[str] = None,
        review_reason: Optional[str] = None,
        next_step: Optional[str] = None,
        reviewer: Optional[str] = None,
        corrected_value: Optional[Any] = None,
        supplemented_by: Optional[str] = None,
        supplemented_values: Optional[dict] = None,
        original_statement: Optional[str] = None,
    ) -> Optional[EvidenceRecord]:
        for rec in self._records:
            if rec.evidence_id == evidence_id:
                rec.current_status = new_status
                rec.timestamp = datetime.now().isoformat()
                if manual_change is not None:
                    rec.manual_change = manual_change
                if review_reason is not None:
                    rec.review_reason = review_reason
                if next_step is not None:
                    rec.next_step = next_step
                if reviewer is not None:
                    rec.reviewer = reviewer
                if corrected_value is not None:
                    rec.corrected_value = corrected_value
                if supplemented_by is not None:
                    rec.supplemented_by = supplemented_by
                if supplemented_values is not None:
                    rec.supplemented_values = supplemented_values
                if original_statement is not None:
                    rec.original_statement = original_statement
                return rec
        return None

    def get_by_row(self, original_row: int) -> list[EvidenceRecord]:
        return [r for r in self._records if r.original_row == original_row]

    def get_by_status(self, status: ProcessingStatus) -> list[EvidenceRecord]:
        return [r for r in self._records if r.current_status == status]

    def get_by_anomaly_type(self, anomaly_type: str) -> list[EvidenceRecord]:
        return [r for r in self._records if r.anomaly_type == anomaly_type]

    def get_by_id(self, evidence_id: str) -> Optional[EvidenceRecord]:
        for r in self._records:
            if r.evidence_id == evidence_id:
                return r
        return None

    def all_records(self) -> list[EvidenceRecord]:
        return list(self._records)

    def pending_review_records(self) -> list[EvidenceRecord]:
        return self.get_by_status(ProcessingStatus.PENDING_REVIEW) + self.get_by_status(ProcessingStatus.AUTO_FLAGGED)

    def to_json(self) -> str:
        return json.dumps([r.to_dict() for r in self._records], ensure_ascii=False, indent=2)

    def from_json(self, json_str: str):
        data = json.loads(json_str)
        self._records = [EvidenceRecord.from_dict(d) for d in data]
        if self._records:
            max_id = max(int(r.evidence_id.split("-")[1]) for r in self._records)
            self._counter = max_id
