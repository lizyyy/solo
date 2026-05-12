from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime


@dataclass
class CheckResult:
    check_id: str
    link_id: str
    source_doc_id: str
    target_url: str
    status: str
    error_type: Optional[str]
    error_message: Optional[str]
    redirect_chain: List[str] = field(default_factory=list)
    final_url: Optional[str] = None
    http_status_code: Optional[int] = None
    required_roles: List[str] = field(default_factory=list)
    checked_at: datetime = None

    @classmethod
    def from_dict(cls, data: dict) -> "CheckResult":
        return cls(
            check_id=data["check_id"],
            link_id=data["link_id"],
            source_doc_id=data["source_doc_id"],
            target_url=data["target_url"],
            status=data["status"],
            error_type=data.get("error_type"),
            error_message=data.get("error_message"),
            redirect_chain=data.get("redirect_chain", []),
            final_url=data.get("final_url"),
            http_status_code=data.get("http_status_code"),
            required_roles=data.get("required_roles", []),
            checked_at=datetime.fromisoformat(data["checked_at"]) if data.get("checked_at") else datetime.now(),
        )

    def to_dict(self) -> dict:
        return {
            "check_id": self.check_id,
            "link_id": self.link_id,
            "source_doc_id": self.source_doc_id,
            "target_url": self.target_url,
            "status": self.status,
            "error_type": self.error_type,
            "error_message": self.error_message,
            "redirect_chain": self.redirect_chain,
            "final_url": self.final_url,
            "http_status_code": self.http_status_code,
            "required_roles": self.required_roles,
            "checked_at": self.checked_at.isoformat() if self.checked_at else None,
        }
