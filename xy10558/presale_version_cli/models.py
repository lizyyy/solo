from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4


class DocumentType(str, Enum):
    REQUIREMENTS = "requirements"
    QUOTATION = "quotation"
    ATTACHMENT = "attachment"
    REVIEW = "review"


class ReviewStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    CLOSED = "closed"


class CheckStatus(str, Enum):
    PASS = "pass"
    WARNING = "warning"
    FAIL = "fail"
    OVERRIDDEN = "overridden"


@dataclass
class Document:
    id: str
    type: DocumentType
    name: str
    version: str
    file_path: str
    checksum: str
    created_at: datetime
    updated_at: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)
    is_active: bool = True


@dataclass
class ReviewItem:
    id: str
    document_id: str
    content: str
    status: ReviewStatus
    assignee: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None


@dataclass
class CheckRule:
    id: str
    name: str
    description: str
    severity: CheckStatus
    is_blocking: bool


@dataclass
class CheckResult:
    rule_id: str
    status: CheckStatus
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    is_blocking: bool = False
    is_overridden: bool = False
    overridden_by: Optional[str] = None
    overridden_at: Optional[datetime] = None
    override_reason: Optional[str] = None


@dataclass
class AuditLog:
    id: str
    action: str
    actor: str
    timestamp: datetime
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None
    description: str = ""


@dataclass
class ProjectState:
    project_id: str
    project_name: str
    created_at: datetime
    updated_at: datetime
    documents: List[Document] = field(default_factory=list)
    review_items: List[ReviewItem] = field(default_factory=list)
    check_results: List[CheckResult] = field(default_factory=list)
    audit_logs: List[AuditLog] = field(default_factory=list)
    current_version: str = "v1.0.0"
    version_history: List[Dict[str, Any]] = field(default_factory=list)


CHECK_RULES: List[CheckRule] = [
    CheckRule(
        id="REQ_EXISTS",
        name="需求清单存在性",
        description="检查是否存在需求清单文档",
        severity=CheckStatus.FAIL,
        is_blocking=True,
    ),
    CheckRule(
        id="QUOT_EXISTS",
        name="报价表存在性",
        description="检查是否存在报价表文档",
        severity=CheckStatus.FAIL,
        is_blocking=True,
    ),
    CheckRule(
        id="QUOT_VERSION",
        name="报价表版本一致性",
        description="检查报价表版本是否与方案版本一致",
        severity=CheckStatus.FAIL,
        is_blocking=True,
    ),
    CheckRule(
        id="ATT_REQUIRED",
        name="必要附件完整性",
        description="检查必要技术附件是否缺失",
        severity=CheckStatus.FAIL,
        is_blocking=True,
    ),
    CheckRule(
        id="REV_CLOSED",
        name="评审意见关闭状态",
        description="检查所有评审意见是否已关闭",
        severity=CheckStatus.FAIL,
        is_blocking=True,
    ),
    CheckRule(
        id="MULTI_SCHEME",
        name="方案集唯一性",
        description="检查是否存在多套方案混放",
        severity=CheckStatus.WARNING,
        is_blocking=False,
    ),
    CheckRule(
        id="VERSIONS_CONSISTENT",
        name="所有文档版本一致性",
        description="检查所有文档版本号是否一致",
        severity=CheckStatus.WARNING,
        is_blocking=False,
    ),
]
