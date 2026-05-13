from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class ArtifactStatus(Enum):
    NORMAL = "normal"
    MISSING_BUILD = "missing_build"
    MISSING_APPROVAL = "missing_approval"
    CONFIG_MISMATCH = "config_mismatch"
    ROLLBACK = "rollback"
    DUPLICATE_BUILD = "duplicate_build"


@dataclass
class BuildMetadata:
    build_number: Optional[str]
    commit_hash: str
    build_time: datetime
    builder: str
    build_machine: str
    config_hash: str
    branch: str
    build_url: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CommitRecord:
    hash: str
    message: str
    author: str
    timestamp: datetime
    branch: str
    parents: List[str] = field(default_factory=list)


@dataclass
class ApprovalRecord:
    id: str
    artifact_version: str
    approver: str
    approval_time: datetime
    status: str
    comments: Optional[str] = None


@dataclass
class ConfigSnapshot:
    config_hash: str
    config_path: str
    content_hash: str
    snapshot_time: datetime
    config_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Artifact:
    artifact_id: str
    name: str
    version: str
    environment: str
    deploy_time: datetime
    status: ArtifactStatus = ArtifactStatus.NORMAL
    build_metadata: Optional[BuildMetadata] = None
    commit_record: Optional[CommitRecord] = None
    approval_record: Optional[ApprovalRecord] = None
    config_snapshot: Optional[ConfigSnapshot] = None
    issues: List[str] = field(default_factory=list)
    is_rollback: bool = False
    rollback_from: Optional[str] = None


@dataclass
class TraceResult:
    environment: str
    artifact: Artifact
    trace_chain: List[Dict[str, Any]]
    risks: List[str]
    summary: str


@dataclass
class CompareResult:
    artifacts: List[Artifact]
    differences: Dict[str, List[Dict[str, Any]]]
    common_attributes: Dict[str, Any]


@dataclass
class VerifyResult:
    artifact: Artifact
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    missing_fields: List[str]


@dataclass
class ReportItem:
    artifact: Artifact
    issues: List[str]
    severity: str
