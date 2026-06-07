from dataclasses import dataclass, field
from typing import Optional, List
from datetime import datetime
import uuid


@dataclass
class ExtractedClause:
    clause_id: str
    clause_type: str
    content: str
    confidence: float
    start_pos: int
    end_pos: int
    is_correct: Optional[bool] = None


@dataclass
class ContractSample:
    sample_id: str = field(default_factory=lambda: f"S{uuid.uuid4().hex[:8].upper()}")
    contract_name: str = ""
    contract_content: str = ""
    model_version: str = ""
    extracted_clauses: List[ExtractedClause] = field(default_factory=list)
    overall_confidence: float = 0.0
    ticket_id: Optional[str] = None
    desensitization_note: str = ""
    review_status: str = "pending"
    reviewer: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    @property
    def low_confidence_clauses(self) -> List[ExtractedClause]:
        return [c for c in self.extracted_clauses if c.confidence < 0.7]

    @property
    def is_masked_by_avg(self) -> bool:
        if not self.extracted_clauses:
            return False
        low_count = len(self.low_confidence_clauses)
        high_count = len([c for c in self.extracted_clauses if c.confidence >= 0.9])
        return low_count > 0 and self.overall_confidence >= 0.75 and high_count > low_count

    def to_dict(self):
        return {
            "sample_id": self.sample_id,
            "contract_name": self.contract_name,
            "model_version": self.model_version,
            "overall_confidence": self.overall_confidence,
            "ticket_id": self.ticket_id,
            "desensitization_note": self.desensitization_note,
            "review_status": self.review_status,
            "reviewer": self.reviewer,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "is_masked_by_avg": self.is_masked_by_avg,
            "low_confidence_count": len(self.low_confidence_clauses),
            "clause_count": len(self.extracted_clauses),
            "extracted_clauses": [
                {
                    "clause_id": c.clause_id,
                    "clause_type": c.clause_type,
                    "content": c.content,
                    "confidence": c.confidence,
                    "start_pos": c.start_pos,
                    "end_pos": c.end_pos,
                    "is_correct": c.is_correct
                } for c in self.extracted_clauses
            ]
        }
