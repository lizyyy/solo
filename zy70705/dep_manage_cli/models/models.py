from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Optional, Dict, Any, List
from packaging.version import Version


class OpinionType(str, Enum):
    AGREE = "agree"
    DISAGREE = "disagree"
    NEED_EXTENSION = "need_extension"
    PENDING = "pending"


class ExtensionStatus(str, Enum):
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"


class BatchStatus(str, Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"


@dataclass(order=True, frozen=True)
class SourceLocation:
    file_path: str
    sheet_name: Optional[str] = None
    row_number: Optional[int] = None

    def __str__(self) -> str:
        parts = [self.file_path]
        if self.sheet_name:
            parts.append(f"Sheet: {self.sheet_name}")
        if self.row_number is not None:
            parts.append(f"Row: {self.row_number}")
        return " | ".join(parts)


@dataclass
class BadRow:
    source: SourceLocation
    raw_data: Dict[str, Any]
    error_message: str
    error_type: str


@dataclass
class Repository:
    name: str
    owner: str
    current_version: str
    source: SourceLocation = field(default=None, compare=False)
    metadata: Dict[str, Any] = field(default_factory=dict, compare=False)

    def __post_init__(self):
        object.__setattr__(self, 'name', self.name.strip())
        object.__setattr__(self, 'owner', self.owner.strip())


@dataclass
class Dependency:
    package_name: str
    target_version: str
    min_version: Optional[str] = None
    source: Optional[SourceLocation] = field(default=None, compare=False)

    def __post_init__(self):
        object.__setattr__(self, 'package_name', self.package_name.strip())
        object.__setattr__(self, 'target_version', self.target_version.strip())
        if self.min_version:
            object.__setattr__(self, 'min_version', self.min_version.strip())


@dataclass
class OwnerOpinion:
    repo_name: str
    owner: str
    opinion: OpinionType
    comment: Optional[str] = None
    opinion_date: Optional[date] = None
    source: Optional[SourceLocation] = field(default=None, compare=False)

    def __post_init__(self):
        object.__setattr__(self, 'repo_name', self.repo_name.strip())
        object.__setattr__(self, 'owner', self.owner.strip())


@dataclass
class ExtensionRequest:
    repo_name: str
    owner: str
    requested_by: str
    reason: str
    requested_date: date
    new_target_date: date
    status: ExtensionStatus = ExtensionStatus.REQUESTED
    approver: Optional[str] = None
    approval_date: Optional[date] = None
    source: Optional[SourceLocation] = field(default=None, compare=False)

    def __post_init__(self):
        object.__setattr__(self, 'repo_name', self.repo_name.strip())
        object.__setattr__(self, 'owner', self.owner.strip())
        object.__setattr__(self, 'requested_by', self.requested_by.strip())


@dataclass
class UpgradeBatch:
    batch_id: str
    name: str
    target_date: date
    packages: List[str]
    status: BatchStatus = BatchStatus.PLANNED
    description: Optional[str] = None
    source: Optional[SourceLocation] = field(default=None, compare=False)

    def __post_init__(self):
        object.__setattr__(self, 'batch_id', self.batch_id.strip())
        object.__setattr__(self, 'name', self.name.strip())
