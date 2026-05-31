from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


class RepoStatus(str, enum.Enum):
    UNKNOWN = "unknown"
    PATH_MISSING = "path_missing"
    NOT_GIT_REPO = "not_git_repo"
    READY = "ready"
    TAGGED = "tagged"
    TAG_CONFLICT = "tag_conflict"
    NEEDS_REVIEW = "needs_review"


class TagAction(str, enum.Enum):
    IMPORT_REPO = "import_repo"
    IMPORT_CHANGE_ORDER = "import_change_order"
    APPLY_TAG = "apply_tag"
    REVIEW_TAG = "review_tag"
    CORRECT_TAG = "correct_tag"
    REUPLOAD_CHANGE_ORDER = "reupload_change_order"
    EXPORT_LEDGER = "export_ledger"


class Repository(BaseModel):
    id: str = Field(default_factory=_new_id)
    path: str
    name: str
    status: RepoStatus = RepoStatus.UNKNOWN
    current_tag: Optional[str] = None
    git_branch: Optional[str] = None
    git_head_short: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    error_detail: Optional[str] = None


class VersionTag(BaseModel):
    id: str = Field(default_factory=_new_id)
    repo_id: str
    tag_name: str
    tag_message: str = ""
    change_order_id: Optional[str] = None
    operator: str = ""
    confirmed: bool = False
    created_at: datetime = Field(default_factory=datetime.now)
    superseded_by: Optional[str] = None


class ChangeOrderEntry(BaseModel):
    repo_path: str
    tag_name: str
    description: str = ""


class ChangeOrder(BaseModel):
    id: str = Field(default_factory=_new_id)
    order_id: str
    entries: list[ChangeOrderEntry] = []
    content_hash: str = ""
    version: int = 1
    operator: str = ""
    uploaded_at: datetime = Field(default_factory=datetime.now)
    superseded: bool = False
    superseded_by_version: Optional[int] = None


class ChangeDiff(BaseModel):
    id: str = Field(default_factory=_new_id)
    order_id: str
    old_version: int
    new_version: int
    old_hash: str = ""
    new_hash: str = ""
    added_entries: list[ChangeOrderEntry] = []
    removed_entries: list[ChangeOrderEntry] = []
    modified_entries: list[tuple[ChangeOrderEntry, ChangeOrderEntry]] = []
    detected_at: datetime = Field(default_factory=datetime.now)
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None


class LedgerEntry(BaseModel):
    id: str = Field(default_factory=_new_id)
    action: TagAction
    repo_id: Optional[str] = None
    tag_id: Optional[str] = None
    change_order_id: Optional[str] = None
    diff_id: Optional[str] = None
    operator: str = ""
    detail: str = ""
    timestamp: datetime = Field(default_factory=datetime.now)


class ServiceError(Exception):
    def __init__(self, code: str, message: str, detail: Optional[Any] = None):
        self.code = code
        self.message = message
        self.detail = detail
        super().__init__(f"[{code}] {message}")


class ChangeOrderUploadResult(BaseModel):
    change_order: ChangeOrder
    is_reupload: bool = False
    diff: Optional[ChangeDiff] = None
    warning: Optional[str] = None
