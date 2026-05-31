from enum import Enum


class RecordStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    DUPLICATE = "duplicate"
    LATE_ARRIVAL = "late_arrival"
    MANUAL_CORRECTED = "manual_corrected"


class ProcessingResult:
    def __init__(self, success: bool, message: str, details: dict = None):
        self.success = success
        self.message = message
        self.details = details or {}
        self.evidence_links = []

    def add_evidence(self, evidence_type: str, reference: str, description: str):
        self.evidence_links.append({
            "type": evidence_type,
            "reference": reference,
            "description": description
        })

    def to_dict(self):
        return {
            "success": self.success,
            "message": self.message,
            "details": self.details,
            "evidence_links": self.evidence_links
        }
