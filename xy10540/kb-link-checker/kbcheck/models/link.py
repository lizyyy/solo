from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime


@dataclass
class Link:
    link_id: str
    source_doc_id: str
    target_url: str
    link_text: str
    link_type: str
    line_number: int
    extracted_at: datetime = None
    occurrences: List[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict) -> "Link":
        return cls(
            link_id=data["link_id"],
            source_doc_id=data["source_doc_id"],
            target_url=data["target_url"],
            link_text=data["link_text"],
            link_type=data["link_type"],
            line_number=data["line_number"],
            extracted_at=datetime.fromisoformat(data["extracted_at"]) if data.get("extracted_at") else datetime.now(),
            occurrences=data.get("occurrences", []),
        )

    def to_dict(self) -> dict:
        return {
            "link_id": self.link_id,
            "source_doc_id": self.source_doc_id,
            "target_url": self.target_url,
            "link_text": self.link_text,
            "link_type": self.link_type,
            "line_number": self.line_number,
            "extracted_at": self.extracted_at.isoformat() if self.extracted_at else None,
            "occurrences": self.occurrences,
        }
