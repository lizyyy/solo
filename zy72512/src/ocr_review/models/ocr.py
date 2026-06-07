from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class OCRConfidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNCERTAIN = "uncertain"


@dataclass
class OCRFieldResult:
    field_name: str
    recognized_value: str
    confidence: float
    bounding_box: Optional[List[float]] = None
    is_corrected: bool = False
    correction_note: Optional[str] = None


@dataclass
class OCRRecord:
    record_id: str
    ticket_id: str
    image_path: str
    ocr_engine: str
    overall_confidence: float
    fields: List[OCRFieldResult]
    processed_at: datetime = field(default_factory=datetime.now)
    review_status: str = "pending"
    reviewer: Optional[str] = None
    review_notes: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def get_confidence_level(self) -> OCRConfidence:
        if self.overall_confidence >= 0.9:
            return OCRConfidence.HIGH
        elif self.overall_confidence >= 0.7:
            return OCRConfidence.MEDIUM
        elif self.overall_confidence >= 0.5:
            return OCRConfidence.LOW
        else:
            return OCRConfidence.UNCERTAIN

    def get_low_confidence_fields(self, threshold: float = 0.7) -> List[OCRFieldResult]:
        return [f for f in self.fields if f.confidence < threshold]

    def needs_review(self, threshold: float = 0.7) -> bool:
        return len(self.get_low_confidence_fields(threshold)) > 0

    def add_review_note(self, note: str, reviewer: str, field_name: Optional[str] = None):
        self.review_notes.append({
            "note": note,
            "reviewer": reviewer,
            "field_name": field_name,
            "timestamp": datetime.now().isoformat()
        })
