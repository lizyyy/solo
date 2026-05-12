from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class MaterialType(str, Enum):
    QUOTATION = "quotation"
    QUALIFICATION = "qualification"
    AUTHORIZATION = "authorization"
    SEAL_PAGE = "seal_page"
    VERSION_DOC = "version_doc"
    OTHER = "other"


class CheckStatus(str, Enum):
    PENDING = "pending"
    PASSED = "passed"
    WARNING = "warning"
    FAILED = "failed"
    BLOCKED = "blocked"


class MaterialRequirement(BaseModel):
    name: str
    type: MaterialType
    required: bool = True
    pattern: Optional[str] = None
    description: Optional[str] = None


class MaterialItem(BaseModel):
    id: str
    name: str
    type: MaterialType
    path: str
    version: Optional[str] = None
    is_current: bool = True
    has_seal: bool = False
    amount: Optional[float] = None
    amount_source: Optional[str] = None


class VersionInfo(BaseModel):
    version: str
    date: Optional[str] = None
    changes: List[str] = Field(default_factory=list)
    author: Optional[str] = None


class CheckRule(BaseModel):
    id: str
    name: str
    description: str
    severity: CheckStatus


class CheckResult(BaseModel):
    rule_id: str
    status: CheckStatus
    message: str
    details: Optional[Dict[str, Any]] = None
    material_id: Optional[str] = None


class CheckHistory(BaseModel):
    id: str
    timestamp: datetime
    operator: str
    action: str
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None
    comment: Optional[str] = None


class BidProject(BaseModel):
    id: str
    name: str
    directory: str
    created_at: datetime
    updated_at: datetime
    status: CheckStatus = CheckStatus.PENDING
    materials: List[MaterialItem] = Field(default_factory=list)
    requirements: List[MaterialRequirement] = Field(default_factory=list)
    versions: List[VersionInfo] = Field(default_factory=list)
    check_results: List[CheckResult] = Field(default_factory=list)
    history: List[CheckHistory] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ReportSummary(BaseModel):
    total_checks: int
    passed: int
    warnings: int
    failed: int
    blocked: int
    can_submit: bool
    missing_materials: List[str] = Field(default_factory=list)
    old_versions: List[str] = Field(default_factory=list)
    amount_mismatches: List[str] = Field(default_factory=list)
    missing_seals: List[str] = Field(default_factory=list)
    corrections_needed: List[Dict[str, Any]] = Field(default_factory=list)
