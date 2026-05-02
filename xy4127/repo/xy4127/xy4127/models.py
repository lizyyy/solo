import os
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Dict, Optional, Any


@dataclass
class Photo:
    """照片文件元数据"""
    file_path: str
    file_name: str
    file_size: int
    timestamp: Optional[datetime] = None
    exif_datetime: Optional[datetime] = None
    file_modified: Optional[datetime] = None
    width: int = 0
    height: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "file_name": self.file_name,
            "file_size": self.file_size,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "exif_datetime": self.exif_datetime.isoformat() if self.exif_datetime else None,
            "file_modified": self.file_modified.isoformat() if self.file_modified else None,
            "width": self.width,
            "height": self.height,
        }


@dataclass
class Remark:
    """客服备注记录"""
    tracking_no: str
    customer_name: str = ""
    contact_phone: str = ""
    issue_type: str = ""
    issue_description: str = ""
    claim_amount: float = 0.0
    remark_date: Optional[datetime] = None
    operator: str = ""
    source_file: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "tracking_no": self.tracking_no,
            "customer_name": self.customer_name,
            "contact_phone": self.contact_phone,
            "issue_type": self.issue_type,
            "issue_description": self.issue_description,
            "claim_amount": self.claim_amount,
            "remark_date": self.remark_date.isoformat() if self.remark_date else None,
            "operator": self.operator,
            "source_file": self.source_file,
        }


@dataclass
class ClaimForm:
    """赔付申请表"""
    tracking_no: str
    claim_amount: float = 0.0
    application_date: Optional[datetime] = None
    applicant: str = ""
    status: str = ""
    source_file: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "tracking_no": self.tracking_no,
            "claim_amount": self.claim_amount,
            "application_date": self.application_date.isoformat() if self.application_date else None,
            "applicant": self.applicant,
            "status": self.status,
            "source_file": self.source_file,
        }


@dataclass
class Package:
    """包裹文件集合"""
    tracking_no: str
    photos: List[Photo] = field(default_factory=list)
    remarks: List[Remark] = field(default_factory=list)
    claim_form: Optional[ClaimForm] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "tracking_no": self.tracking_no,
            "photos": [p.to_dict() for p in self.photos],
            "remarks": [r.to_dict() for r in self.remarks],
            "claim_form": self.claim_form.to_dict() if self.claim_form else None,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Package":
        photos = [
            Photo(
                file_path=p["file_path"],
                file_name=p["file_name"],
                file_size=p["file_size"],
                width=p["width"],
                height=p["height"],
            ) for p in data.get("photos", [])
        ]
        remarks = [
            Remark(
                tracking_no=r["tracking_no"],
                customer_name=r.get("customer_name", ""),
                contact_phone=r.get("contact_phone", ""),
                issue_type=r.get("issue_type", ""),
                issue_description=r.get("issue_description", ""),
                claim_amount=r.get("claim_amount", 0.0),
                operator=r.get("operator", ""),
                source_file=r.get("source_file", ""),
            ) for r in data.get("remarks", [])
        ]
        claim_form = None
        if data.get("claim_form"):
            cf = data["claim_form"]
            claim_form = ClaimForm(
                tracking_no=cf["tracking_no"],
                claim_amount=cf.get("claim_amount", 0.0),
                applicant=cf.get("applicant", ""),
                status=cf.get("status", ""),
                source_file=cf.get("source_file", ""),
            )
        return cls(
            tracking_no=data["tracking_no"],
            photos=photos,
            remarks=remarks,
            claim_form=claim_form,
        )


@dataclass
class Issue:
    """校验发现的问题"""
    tracking_no: str
    issue_type: str
    severity: str
    description: str
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "tracking_no": self.tracking_no,
            "issue_type": self.issue_type,
            "severity": self.severity,
            "description": self.description,
            "details": self.details,
        }


@dataclass
class Review:
    """人工复核记录"""
    tracking_no: str
    status: str
    comment: str
    reviewed_at: datetime = field(default_factory=datetime.now)
    reviewer: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "tracking_no": self.tracking_no,
            "status": self.status,
            "comment": self.comment,
            "reviewed_at": self.reviewed_at.isoformat(),
            "reviewer": self.reviewer,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Review":
        return cls(
            tracking_no=data["tracking_no"],
            status=data["status"],
            comment=data["comment"],
            reviewed_at=datetime.fromisoformat(data["reviewed_at"]) if data.get("reviewed_at") else datetime.now(),
            reviewer=data.get("reviewer", ""),
        )
