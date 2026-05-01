import json
import os
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from .scanner import FileInfo, ScanResult


@dataclass
class CopyProgress:
    file_id: str
    source_path: str
    target_path: str
    file_name: str
    file_size: int
    bytes_copied: int = 0
    completed: bool = False
    verified: bool = False
    hash_matched: bool | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


@dataclass
class Manifest:
    version: str = "1.0"
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    project_name: str = "Untitled_Project"
    scan_result: ScanResult | None = None

    copy_plan: dict[str, Any] = field(default_factory=dict)
    copy_progress: dict[str, CopyProgress] = field(default_factory=dict)
    copy_complete: bool = False
    copy_errors: list[str] = field(default_factory=list)

    target_directory: str | None = None
    archive_structure: dict[str, str] = field(default_factory=dict)

    validation_issues: list[dict[str, Any]] = field(default_factory=list)
    validation_passed: bool = True

    notes: str = ""
    custom_fields: dict[str, Any] = field(default_factory=dict)

    @property
    def files(self) -> list[FileInfo]:
        if self.scan_result:
            return self.scan_result.all_files
        return []

    @property
    def total_files(self) -> int:
        if self.scan_result:
            return self.scan_result.total_files
        return 0

    @property
    def total_size(self) -> int:
        if self.scan_result:
            return self.scan_result.total_size
        return 0

    @property
    def copied_files(self) -> int:
        return sum(1 for p in self.copy_progress.values() if p.completed)

    @property
    def copied_bytes(self) -> int:
        return sum(p.bytes_copied for p in self.copy_progress.values())

    @property
    def verified_files(self) -> int:
        return sum(1 for p in self.copy_progress.values() if p.verified and p.hash_matched)

    def get_file_by_id(self, file_id: str) -> FileInfo | None:
        if not self.scan_result:
            return None
        for file in self.scan_result.all_files:
            if file.file_id == file_id:
                return file
        return None

    def get_files_by_hash(self, hash_value: str) -> list[FileInfo]:
        results: list[FileInfo] = []
        for file in self.files:
            if file.hash_value == hash_value:
                results.append(file)
        return results

    def get_files_by_category(self, category: str) -> list[FileInfo]:
        return [f for f in self.files if f.file_category == category]

    def get_files_by_card(self, card_id: str) -> list[FileInfo]:
        return [f for f in self.files if f.card_id == card_id]

    def get_duplicate_hashes(self) -> dict[str, list[str]]:
        hash_to_ids: dict[str, list[str]] = {}
        for file in self.files:
            if file.hash_value:
                if file.hash_value not in hash_to_ids:
                    hash_to_ids[file.hash_value] = []
                hash_to_ids[file.hash_value].append(file.file_id)

        return {h: ids for h, ids in hash_to_ids.items() if len(ids) > 1}

    def get_duplicate_filenames(self) -> dict[str, list[str]]:
        name_to_ids: dict[str, list[str]] = {}
        for file in self.files:
            if file.file_name not in name_to_ids:
                name_to_ids[file.file_name] = []
            name_to_ids[file.file_name].append(file.file_id)

        return {n: ids for n, ids in name_to_ids.items() if len(ids) > 1}

    def initialize_copy_progress(self, copy_plan: dict[str, Any]) -> None:
        self.copy_plan = copy_plan
        self.copy_progress.clear()
        self.copy_complete = False
        self.copy_errors.clear()

        file_mappings = copy_plan.get("file_mappings", {})
        for file_id, mapping in file_mappings.items():
            file_info = self.get_file_by_id(file_id)
            if file_info:
                self.copy_progress[file_id] = CopyProgress(
                    file_id=file_id,
                    source_path=file_info.source_path,
                    target_path=mapping.get("target_path", ""),
                    file_name=file_info.file_name,
                    file_size=file_info.file_size,
                )

    def mark_copy_started(self, file_id: str) -> None:
        if file_id in self.copy_progress:
            self.copy_progress[file_id].started_at = datetime.now()

    def update_copy_progress(self, file_id: str, bytes_copied: int) -> None:
        if file_id in self.copy_progress:
            self.copy_progress[file_id].bytes_copied = bytes_copied

    def mark_copy_completed(self, file_id: str, verified: bool = False, hash_matched: bool | None = None) -> None:
        if file_id in self.copy_progress:
            progress = self.copy_progress[file_id]
            progress.completed = True
            progress.bytes_copied = progress.file_size
            progress.verified = verified
            progress.hash_matched = hash_matched
            progress.completed_at = datetime.now()

    def mark_copy_failed(self, file_id: str, error_message: str) -> None:
        if file_id in self.copy_progress:
            progress = self.copy_progress[file_id]
            progress.completed = False
            progress.error_message = error_message
            progress.completed_at = datetime.now()
            self.copy_errors.append(f"{file_id}: {error_message}")

    def is_complete(self) -> bool:
        if not self.copy_progress:
            return False
        return all(p.completed for p in self.copy_progress.values())

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "version": self.version,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "project_name": self.project_name,
            "copy_plan": self.copy_plan,
            "copy_complete": self.copy_complete,
            "copy_errors": self.copy_errors,
            "target_directory": self.target_directory,
            "archive_structure": self.archive_structure,
            "validation_issues": self.validation_issues,
            "validation_passed": self.validation_passed,
            "notes": self.notes,
            "custom_fields": self.custom_fields,
        }

        if self.scan_result:
            data["scan_result"] = self.scan_result.to_dict()

        copy_progress_data: dict[str, dict[str, Any]] = {}
        for file_id, progress in self.copy_progress.items():
            copy_progress_data[file_id] = {
                "file_id": progress.file_id,
                "source_path": progress.source_path,
                "target_path": progress.target_path,
                "file_name": progress.file_name,
                "file_size": progress.file_size,
                "bytes_copied": progress.bytes_copied,
                "completed": progress.completed,
                "verified": progress.verified,
                "hash_matched": progress.hash_matched,
                "error_message": progress.error_message,
                "started_at": progress.started_at.isoformat() if progress.started_at else None,
                "completed_at": progress.completed_at.isoformat() if progress.completed_at else None,
            }
        data["copy_progress"] = copy_progress_data

        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Manifest":
        created_at_str = data.get("created_at")
        updated_at_str = data.get("updated_at")

        created_at = datetime.now()
        if created_at_str:
            try:
                created_at = datetime.fromisoformat(created_at_str)
            except ValueError:
                pass

        updated_at = datetime.now()
        if updated_at_str:
            try:
                updated_at = datetime.fromisoformat(updated_at_str)
            except ValueError:
                pass

        manifest = cls(
            version=data.get("version", "1.0"),
            created_at=created_at,
            updated_at=updated_at,
            project_name=data.get("project_name", "Untitled_Project"),
            copy_plan=data.get("copy_plan", {}),
            copy_complete=data.get("copy_complete", False),
            copy_errors=data.get("copy_errors", []),
            target_directory=data.get("target_directory"),
            archive_structure=data.get("archive_structure", {}),
            validation_issues=data.get("validation_issues", []),
            validation_passed=data.get("validation_passed", True),
            notes=data.get("notes", ""),
            custom_fields=data.get("custom_fields", {}),
        )

        scan_result_data = data.get("scan_result")
        if scan_result_data:
            manifest.scan_result = ScanResult.from_dict(scan_result_data)

        copy_progress_data = data.get("copy_progress", {})
        for file_id, pdata in copy_progress_data.items():
            started_at = None
            started_at_str = pdata.get("started_at")
            if started_at_str:
                try:
                    started_at = datetime.fromisoformat(started_at_str)
                except ValueError:
                    pass

            completed_at = None
            completed_at_str = pdata.get("completed_at")
            if completed_at_str:
                try:
                    completed_at = datetime.fromisoformat(completed_at_str)
                except ValueError:
                    pass

            manifest.copy_progress[file_id] = CopyProgress(
                file_id=pdata.get("file_id", file_id),
                source_path=pdata.get("source_path", ""),
                target_path=pdata.get("target_path", ""),
                file_name=pdata.get("file_name", ""),
                file_size=pdata.get("file_size", 0),
                bytes_copied=pdata.get("bytes_copied", 0),
                completed=pdata.get("completed", False),
                verified=pdata.get("verified", False),
                hash_matched=pdata.get("hash_matched"),
                error_message=pdata.get("error_message"),
                started_at=started_at,
                completed_at=completed_at,
            )

        return manifest


class ManifestManager:
    def __init__(self, output_dir: Path | None = None) -> None:
        self.output_dir = output_dir or Path.cwd()

    def generate_filename(self, project_name: str, timestamp: datetime | None = None) -> str:
        ts = timestamp or datetime.now()
        safe_name = "".join(c if c.isalnum() or c in "_-" else "_" for c in project_name)
        return f"manifest_{safe_name}_{ts.strftime('%Y%m%d_%H%M%S')}.json"

    def find_latest_manifest(self, project_name: str | None = None) -> Path | None:
        pattern = "manifest_*.json"
        if project_name:
            safe_name = "".join(c if c.isalnum() or c in "_-" else "_" for c in project_name)
            pattern = f"manifest_{safe_name}_*.json"

        manifests: list[Path] = []
        for file in self.output_dir.glob(pattern):
            if file.is_file():
                manifests.append(file)

        if not manifests:
            return None

        manifests.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        return manifests[0]

    def save(self, manifest: Manifest, filename: str | None = None) -> Path:
        manifest.updated_at = datetime.now()

        if not filename:
            filename = self.generate_filename(manifest.project_name, manifest.created_at)

        path = self.output_dir / filename

        temp_path = path.with_suffix(".tmp")
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(manifest.to_dict(), f, indent=2, ensure_ascii=False, default=str)

        if path.exists():
            backup_path = path.with_suffix(".json.bak")
            shutil.copy2(path, backup_path)

        shutil.move(temp_path, path)

        return path

    def load(self, path: Path) -> Manifest:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        return Manifest.from_dict(data)

    def create_from_scan_result(
        self,
        scan_result: ScanResult,
        target_directory: str | None = None,
    ) -> Manifest:
        manifest = Manifest(
            project_name=scan_result.project_name,
            scan_result=scan_result,
            target_directory=target_directory,
        )
        return manifest

    def merge_manifests(self, manifests: list[Manifest]) -> Manifest:
        if not manifests:
            return Manifest()

        first = manifests[0]
        merged = Manifest(
            version=first.version,
            created_at=min(m.created_at for m in manifests),
            updated_at=datetime.now(),
            project_name=first.project_name,
        )

        all_scan_results: list[ScanResult] = []
        for m in manifests:
            if m.scan_result:
                all_scan_results.append(m.scan_result)

        if all_scan_results:
            merged_scan = ScanResult(
                project_name=first.project_name,
                scan_time=max(r.scan_time for r in all_scan_results),
            )

            for r in all_scan_results:
                merged_scan.cards.extend(r.cards)

            merged.scan_result = merged_scan

        for m in manifests:
            for fid, progress in m.copy_progress.items():
                if fid not in merged.copy_progress:
                    merged.copy_progress[fid] = progress

            merged.copy_errors.extend(m.copy_errors)
            merged.validation_issues.extend(m.validation_issues)

        return merged


def save_manifest(manifest: Manifest, path: Path) -> None:
    manager = ManifestManager(path.parent)
    manager.save(manifest, path.name)


def load_manifest(path: Path) -> Manifest:
    manager = ManifestManager(path.parent)
    return manager.load(path)
