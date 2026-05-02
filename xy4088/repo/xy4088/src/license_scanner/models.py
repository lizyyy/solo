from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pathlib import Path


class AssetType(Enum):
    IMAGE = "image"
    FONT = "font"
    AUDIO = "audio"
    VIDEO = "video"
    DOCUMENT = "document"
    OTHER = "other"


class RiskLevel(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RiskType(Enum):
    MISSING_LICENSE = "missing_license"
    EXPIRED = "expired"
    USAGE_MISMATCH = "usage_mismatch"
    INSUFFICIENT_SEATS = "insufficient_seats"
    NAME_HASH_MISMATCH = "name_hash_mismatch"
    DUPLICATE_ASSET = "duplicate_asset"
    RENAMED_ASSET = "renamed_asset"


@dataclass
class Asset:
    file_path: str
    file_name: str
    file_size: int
    file_hash: str
    asset_type: AssetType
    extension: str
    modified_time: datetime
    created_time: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    matched_licenses: List["License"] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "file_name": self.file_name,
            "file_size": self.file_size,
            "file_hash": self.file_hash,
            "asset_type": self.asset_type.value,
            "extension": self.extension,
            "modified_time": self.modified_time.isoformat() if self.modified_time else None,
            "created_time": self.created_time.isoformat() if self.created_time else None,
            "metadata": self.metadata,
            "matched_license_ids": [lic.license_id for lic in self.matched_licenses]
        }


@dataclass
class License:
    license_id: str
    asset_name: str
    asset_type: Optional[AssetType] = None
    vendor: Optional[str] = None
    license_type: Optional[str] = None
    purchase_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    seats: Optional[int] = None
    allowed_usage: List[str] = field(default_factory=list)
    restrictions: List[str] = field(default_factory=list)
    original_file: Optional[str] = None
    asset_hash: Optional[str] = None
    notes: Optional[str] = None
    source: str = "imported"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "license_id": self.license_id,
            "asset_name": self.asset_name,
            "asset_type": self.asset_type.value if self.asset_type else None,
            "vendor": self.vendor,
            "license_type": self.license_type,
            "purchase_date": self.purchase_date.isoformat() if self.purchase_date else None,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "seats": self.seats,
            "allowed_usage": self.allowed_usage,
            "restrictions": self.restrictions,
            "original_file": self.original_file,
            "asset_hash": self.asset_hash,
            "notes": self.notes,
            "source": self.source
        }


@dataclass
class Risk:
    risk_id: str
    risk_type: RiskType
    risk_level: RiskLevel
    asset: Optional[Asset] = None
    license: Optional[License] = None
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "risk_id": self.risk_id,
            "risk_type": self.risk_type.value,
            "risk_level": self.risk_level.value,
            "asset_file": self.asset.file_path if self.asset else None,
            "license_id": self.license.license_id if self.license else None,
            "message": self.message,
            "details": self.details
        }


@dataclass
class ProjectState:
    project_name: str
    scan_date: datetime
    assets: List[Asset] = field(default_factory=list)
    licenses: List[License] = field(default_factory=list)
    risks: List[Risk] = field(default_factory=list)
    matches: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "project_name": self.project_name,
            "scan_date": self.scan_date.isoformat(),
            "assets": [asset.to_dict() for asset in self.assets],
            "licenses": [lic.to_dict() for lic in self.licenses],
            "risks": [risk.to_dict() for risk in self.risks],
            "matches": self.matches,
            "summary": {
                "total_assets": len(self.assets),
                "total_licenses": len(self.licenses),
                "total_risks": len(self.risks),
                "risk_counts": self._get_risk_count_by_level()
            }
        }

    def _get_risk_count_by_level(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for risk in self.risks:
            level = risk.risk_level.value
            counts[level] = counts.get(level, 0) + 1
        return counts
