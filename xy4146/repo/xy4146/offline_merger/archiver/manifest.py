import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional


class FileStatus(Enum):
    KEPT = "kept"
    ISOLATED = "isolated"
    RENAMED = "kept_renamed"
    DUPLICATE = "duplicate"
    SKIPPED = "skipped"


@dataclass
class ManifestEntry:
    original_path: str
    original_file_name: str
    source_package: str
    output_path: str
    output_file_name: str
    file_size: int
    hash_sha256: str
    hash_md5: str
    file_type: str
    status: FileStatus
    last_modified: datetime
    added_at: datetime
    conflict_id: Optional[str] = None
    original_source: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    coordinate_info: Optional[Dict[str, Any]] = None
    attachments: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "original_path": self.original_path,
            "original_file_name": self.original_file_name,
            "source_package": self.source_package,
            "output_path": self.output_path,
            "output_file_name": self.output_file_name,
            "file_size": self.file_size,
            "hash_sha256": self.hash_sha256,
            "hash_md5": self.hash_md5,
            "file_type": self.file_type,
            "status": self.status.value,
            "last_modified": self.last_modified.isoformat(),
            "added_at": self.added_at.isoformat(),
            "conflict_id": self.conflict_id,
            "original_source": self.original_source,
            "metadata": self.metadata,
            "coordinate_info": self.coordinate_info,
            "attachments": self.attachments,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ManifestEntry":
        return cls(
            original_path=data["original_path"],
            original_file_name=data["original_file_name"],
            source_package=data["source_package"],
            output_path=data["output_path"],
            output_file_name=data["output_file_name"],
            file_size=data["file_size"],
            hash_sha256=data["hash_sha256"],
            hash_md5=data["hash_md5"],
            file_type=data["file_type"],
            status=FileStatus(data["status"]),
            last_modified=datetime.fromisoformat(data["last_modified"]),
            added_at=datetime.fromisoformat(data["added_at"]),
            conflict_id=data.get("conflict_id"),
            original_source=data.get("original_source"),
            metadata=data.get("metadata", {}),
            coordinate_info=data.get("coordinate_info"),
            attachments=data.get("attachments", []),
        )


@dataclass
class Manifest:
    task_id: str
    task_name: str
    created_at: datetime
    updated_at: datetime
    version: str = "1.0"
    entries: List[ManifestEntry] = field(default_factory=list)
    source_packages: List[str] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    coordinate_system: str = "WGS84"

    def to_dict(self) -> Dict[str, Any]:
        by_status: Dict[str, int] = {}
        by_type: Dict[str, int] = {}
        by_source: Dict[str, int] = {}
        total_size = 0

        for entry in self.entries:
            status_key = entry.status.value
            by_status[status_key] = by_status.get(status_key, 0) + 1

            type_key = entry.file_type
            by_type[type_key] = by_type.get(type_key, 0) + 1

            source_key = entry.source_package
            by_source[source_key] = by_source.get(source_key, 0) + 1

            total_size += entry.file_size

        self.summary = {
            "total_files": len(self.entries),
            "total_size_bytes": total_size,
            "by_status": by_status,
            "by_type": by_type,
            "by_source": by_source,
        }

        return {
            "version": self.version,
            "task_id": self.task_id,
            "task_name": self.task_name,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "coordinate_system": self.coordinate_system,
            "source_packages": self.source_packages,
            "summary": self.summary,
            "entries": [e.to_dict() for e in self.entries],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Manifest":
        return cls(
            version=data.get("version", "1.0"),
            task_id=data["task_id"],
            task_name=data["task_name"],
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            coordinate_system=data.get("coordinate_system", "WGS84"),
            source_packages=data.get("source_packages", []),
            summary=data.get("summary", {}),
            entries=[ManifestEntry.from_dict(e) for e in data.get("entries", [])],
        )

    def add_entry(self, entry: ManifestEntry) -> None:
        self.entries.append(entry)
        self.updated_at = datetime.now()

    def get_entries_by_source(self, source_package: str) -> List[ManifestEntry]:
        return [e for e in self.entries if e.source_package == source_package]

    def get_entries_by_status(self, status: FileStatus) -> List[ManifestEntry]:
        return [e for e in self.entries if e.status == status]

    def get_entry_by_hash(self, sha256_hash: str) -> Optional[ManifestEntry]:
        for entry in self.entries:
            if entry.hash_sha256 == sha256_hash:
                return entry
        return None

    def get_entry_by_output_name(self, file_name: str) -> Optional[ManifestEntry]:
        for entry in self.entries:
            if entry.output_file_name == file_name:
                return entry
        return None


def load_manifest(path: str) -> Manifest:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return Manifest.from_dict(data)


def save_manifest(manifest: Manifest, path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(manifest.to_dict(), f, indent=2, ensure_ascii=False, default=str)


def create_manifest(task_id: str, task_name: str) -> Manifest:
    now = datetime.now()
    return Manifest(
        task_id=task_id,
        task_name=task_name,
        created_at=now,
        updated_at=now,
    )
