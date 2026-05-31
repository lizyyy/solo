from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class RunStatus(str, Enum):
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"
    DUPLICATE_OVERRIDE = "duplicate_override"
    ROLLED_BACK = "rolled_back"


class EvidenceType(str, Enum):
    ROLLBACK_RECORD = "rollback_record"
    DIRECTORY_SNAPSHOT = "directory_snapshot"
    CONFIG_CHANGE = "config_change"
    SCAN_RESULT = "scan_result"


@dataclass
class EvidenceRef:
    evidence_type: EvidenceType
    record_id: str
    detail: str = ""

    def to_dict(self) -> dict:
        return {
            "evidence_type": self.evidence_type.value,
            "record_id": self.record_id,
            "detail": self.detail,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "EvidenceRef":
        return cls(
            evidence_type=EvidenceType(d["evidence_type"]),
            record_id=d["record_id"],
            detail=d.get("detail", ""),
        )


@dataclass
class LicenseEntry:
    package_name: str
    version: str
    license_type: str
    license_text: str = ""
    source_file: str = ""
    evidence_refs: list[EvidenceRef] = field(default_factory=list)
    entry_id: str = ""

    def __post_init__(self):
        if not self.entry_id:
            raw = f"{self.package_name}@{self.version}"
            self.entry_id = hashlib.sha256(raw.encode()).hexdigest()[:16]

    def to_dict(self) -> dict:
        return {
            "entry_id": self.entry_id,
            "package_name": self.package_name,
            "version": self.version,
            "license_type": self.license_type,
            "license_text": self.license_text,
            "source_file": self.source_file,
            "evidence_refs": [r.to_dict() for r in self.evidence_refs],
        }

    @classmethod
    def from_dict(cls, d: dict) -> "LicenseEntry":
        refs = [EvidenceRef.from_dict(r) for r in d.get("evidence_refs", [])]
        entry = cls(
            package_name=d["package_name"],
            version=d["version"],
            license_type=d["license_type"],
            license_text=d.get("license_text", ""),
            source_file=d.get("source_file", ""),
            evidence_refs=refs,
        )
        entry.entry_id = d.get("entry_id", entry.entry_id)
        return entry


@dataclass
class RollbackRecord:
    record_id: str
    target_package: str
    target_version: str
    previous_version: str = ""
    reason: str = ""
    operator: str = ""
    timestamp: str = ""
    snapshot_id: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()
        if not self.record_id:
            raw = f"rollback:{self.target_package}@{self.timestamp}"
            self.record_id = hashlib.sha256(raw.encode()).hexdigest()[:16]

    def to_dict(self) -> dict:
        return {
            "record_id": self.record_id,
            "target_package": self.target_package,
            "target_version": self.target_version,
            "previous_version": self.previous_version,
            "reason": self.reason,
            "operator": self.operator,
            "timestamp": self.timestamp,
            "snapshot_id": self.snapshot_id,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "RollbackRecord":
        return cls(
            record_id=d.get("record_id", ""),
            target_package=d["target_package"],
            target_version=d["target_version"],
            previous_version=d.get("previous_version", ""),
            reason=d.get("reason", ""),
            operator=d.get("operator", ""),
            timestamp=d.get("timestamp", ""),
            snapshot_id=d.get("snapshot_id", ""),
            metadata=d.get("metadata", {}),
        )


@dataclass
class FileSnapshot:
    path: str
    content_hash: str
    content: str = ""

    def to_dict(self) -> dict:
        return {
            "path": self.path,
            "content_hash": self.content_hash,
            "content": self.content,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "FileSnapshot":
        return cls(
            path=d["path"],
            content_hash=d["content_hash"],
            content=d.get("content", ""),
        )


@dataclass
class DirectorySnapshot:
    snapshot_id: str = ""
    base_path: str = ""
    files: list[FileSnapshot] = field(default_factory=list)
    timestamp: str = ""
    label: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()
        if not self.snapshot_id:
            raw = f"snapshot:{self.base_path}:{self.timestamp}"
            self.snapshot_id = hashlib.sha256(raw.encode()).hexdigest()[:16]

    def to_dict(self) -> dict:
        return {
            "snapshot_id": self.snapshot_id,
            "base_path": self.base_path,
            "files": [f.to_dict() for f in self.files],
            "timestamp": self.timestamp,
            "label": self.label,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "DirectorySnapshot":
        files = [FileSnapshot.from_dict(f) for f in d.get("files", [])]
        snap = cls(
            base_path=d["base_path"],
            files=files,
            timestamp=d.get("timestamp", ""),
            label=d.get("label", ""),
        )
        snap.snapshot_id = d.get("snapshot_id", snap.snapshot_id)
        return snap


@dataclass
class ConfigChangeRecord:
    change_id: str
    file_path: str
    before_hash: str = ""
    after_hash: str = ""
    before_content: str = ""
    after_content: str = ""
    diff: str = ""
    operator: str = ""
    timestamp: str = ""
    run_id: str = ""
    note: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()
        if not self.change_id:
            raw = f"config_change:{self.file_path}:{self.timestamp}"
            self.change_id = hashlib.sha256(raw.encode()).hexdigest()[:16]

    def to_dict(self) -> dict:
        return {
            "change_id": self.change_id,
            "file_path": self.file_path,
            "before_hash": self.before_hash,
            "after_hash": self.after_hash,
            "before_content": self.before_content,
            "after_content": self.after_content,
            "diff": self.diff,
            "operator": self.operator,
            "timestamp": self.timestamp,
            "run_id": self.run_id,
            "note": self.note,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "ConfigChangeRecord":
        return cls(
            change_id=d.get("change_id", ""),
            file_path=d["file_path"],
            before_hash=d.get("before_hash", ""),
            after_hash=d.get("after_hash", ""),
            before_content=d.get("before_content", ""),
            after_content=d.get("after_content", ""),
            diff=d.get("diff", ""),
            operator=d.get("operator", ""),
            timestamp=d.get("timestamp", ""),
            run_id=d.get("run_id", ""),
            note=d.get("note", ""),
        )


@dataclass
class DuplicateExecutionIssue:
    issue_id: str
    package_name: str
    version: str
    previous_entry_id: str
    conflicting_entry_id: str
    evidence_source: EvidenceType
    source_record_id: str
    description: str = ""
    suggested_action: str = ""
    responsible_hint: str = ""

    def to_dict(self) -> dict:
        return {
            "issue_id": self.issue_id,
            "package_name": self.package_name,
            "version": self.version,
            "previous_entry_id": self.previous_entry_id,
            "conflicting_entry_id": self.conflicting_entry_id,
            "evidence_source": self.evidence_source.value,
            "source_record_id": self.source_record_id,
            "description": self.description,
            "suggested_action": self.suggested_action,
            "responsible_hint": self.responsible_hint,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "DuplicateExecutionIssue":
        return cls(
            issue_id=d["issue_id"],
            package_name=d["package_name"],
            version=d["version"],
            previous_entry_id=d["previous_entry_id"],
            conflicting_entry_id=d["conflicting_entry_id"],
            evidence_source=EvidenceType(d["evidence_source"]),
            source_record_id=d["source_record_id"],
            description=d.get("description", ""),
            suggested_action=d.get("suggested_action", ""),
            responsible_hint=d.get("responsible_hint", ""),
        )


@dataclass
class RunRecord:
    run_id: str = ""
    status: RunStatus = RunStatus.SUCCESS
    entries: list[LicenseEntry] = field(default_factory=list)
    issues: list[DuplicateExecutionIssue] = field(default_factory=list)
    snapshot_id: str = ""
    rollback_ids: list[str] = field(default_factory=list)
    config_change_ids: list[str] = field(default_factory=list)
    timestamp: str = ""
    operator: str = ""
    summary: str = ""
    is_historical: bool = False

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()
        if not self.run_id:
            raw = f"run:{self.timestamp}"
            self.run_id = hashlib.sha256(raw.encode()).hexdigest()[:16]

    def to_dict(self) -> dict:
        return {
            "run_id": self.run_id,
            "status": self.status.value,
            "entries": [e.to_dict() for e in self.entries],
            "issues": [i.to_dict() for i in self.issues],
            "snapshot_id": self.snapshot_id,
            "rollback_ids": self.rollback_ids,
            "config_change_ids": self.config_change_ids,
            "timestamp": self.timestamp,
            "operator": self.operator,
            "summary": self.summary,
            "is_historical": self.is_historical,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "RunRecord":
        entries = [LicenseEntry.from_dict(e) for e in d.get("entries", [])]
        issues = [DuplicateExecutionIssue.from_dict(i) for i in d.get("issues", [])]
        rec = cls(
            status=RunStatus(d["status"]),
            entries=entries,
            issues=issues,
            snapshot_id=d.get("snapshot_id", ""),
            rollback_ids=d.get("rollback_ids", []),
            config_change_ids=d.get("config_change_ids", []),
            timestamp=d.get("timestamp", ""),
            operator=d.get("operator", ""),
            summary=d.get("summary", ""),
            is_historical=d.get("is_historical", False),
        )
        rec.run_id = d.get("run_id", rec.run_id)
        return rec
