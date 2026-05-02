import os
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from offline_merger.archiver.audit_log import AuditAction, AuditLog, AuditLevel
from offline_merger.archiver.manifest import (
    FileStatus,
    Manifest,
    ManifestEntry,
    save_manifest,
)
from offline_merger.conflict.conflict_manager import (
    ConflictItem,
    MergePlan,
    ResolutionAction,
)


@dataclass
class ArchiveResult:
    success: bool
    files_copied: int = 0
    files_isolated: int = 0
    files_renamed: int = 0
    files_skipped: int = 0
    errors: List[Dict[str, Any]] = field(default_factory=list)
    output_path: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "files_copied": self.files_copied,
            "files_isolated": self.files_isolated,
            "files_renamed": self.files_renamed,
            "files_skipped": self.files_skipped,
            "errors": self.errors,
            "output_path": self.output_path,
        }


class FileArchiver:
    def __init__(
        self,
        output_directory: str,
        quarantine_directory: str,
        manifest: Manifest,
        audit_log: AuditLog,
    ):
        self.output_dir = Path(output_directory)
        self.quarantine_dir = Path(quarantine_directory)
        self.manifest = manifest
        self.audit_log = audit_log
        self._existing_hashes: Dict[str, ManifestEntry] = {}
        self._existing_names: Dict[str, ManifestEntry] = {}

        for entry in manifest.entries:
            self._existing_hashes[entry.hash_sha256] = entry
            self._existing_names[entry.output_file_name] = entry

    def ensure_directories(self) -> None:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.quarantine_dir.mkdir(parents=True, exist_ok=True)

        (self.output_dir / "photos").mkdir(exist_ok=True)
        (self.output_dir / "tracks").mkdir(exist_ok=True)
        (self.output_dir / "points").mkdir(exist_ok=True)
        (self.output_dir / "notes").mkdir(exist_ok=True)

    def _get_subdirectory(self, file_type: str) -> Path:
        type_map = {
            "photo": "photos",
            "gpx": "tracks",
            "csv": "points",
            "json": "notes",
        }
        subdir = type_map.get(file_type, "other")
        return self.output_dir / subdir

    def _generate_unique_name(
        self,
        original_name: str,
        source_package: str,
        conflict_index: int = 1,
    ) -> str:
        path = Path(original_name)
        stem = path.stem
        suffix = path.suffix

        candidate = f"{stem}_{source_package}_{conflict_index:02d}{suffix}"
        if candidate not in self._existing_names:
            return candidate

        return f"{stem}_{source_package}_{datetime.now().strftime('%Y%m%d%H%M%S')}{suffix}"

    def copy_file(
        self,
        source_path: str,
        source_package: str,
        file_type: str,
        hash_sha256: str,
        hash_md5: str,
        conflict_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        coordinate_info: Optional[Dict[str, Any]] = None,
        attachments: Optional[List[str]] = None,
    ) -> Tuple[bool, Optional[str]]:
        source = Path(source_path)
        if not source.exists():
            self.audit_log.log_error(
                AuditAction.COPY_FILE,
                f"源文件不存在: {source_path}",
                FileNotFoundError(source_path),
            )
            return False, None

        file_name = source.name
        file_size = source.stat().st_size
        last_modified = datetime.fromtimestamp(source.stat().st_mtime)

        if hash_sha256 in self._existing_hashes:
            existing = self._existing_hashes[hash_sha256]
            self.audit_log.log_skip_duplicate(
                file_name=file_name,
                source=source_package,
                duplicate_of=existing.original_path,
            )
            return True, None

        subdir = self._get_subdirectory(file_type)
        dest_path = subdir / file_name

        if file_name in self._existing_names:
            new_name = self._generate_unique_name(file_name, source_package)
            dest_path = subdir / new_name
            self.audit_log.log_rename_file(
                original_name=file_name,
                new_name=new_name,
                source=source_package,
            )
            final_name = new_name
            status = FileStatus.RENAMED
        else:
            final_name = file_name
            status = FileStatus.KEPT

        try:
            shutil.copy2(source, dest_path)

            entry = ManifestEntry(
                original_path=str(source),
                original_file_name=file_name,
                source_package=source_package,
                output_path=str(dest_path),
                output_file_name=final_name,
                file_size=file_size,
                hash_sha256=hash_sha256,
                hash_md5=hash_md5,
                file_type=file_type,
                status=status,
                last_modified=last_modified,
                added_at=datetime.now(),
                conflict_id=conflict_id,
                metadata=metadata or {},
                coordinate_info=coordinate_info,
                attachments=attachments or [],
            )

            self.manifest.add_entry(entry)
            self._existing_hashes[hash_sha256] = entry
            self._existing_names[final_name] = entry

            self.audit_log.log_copy_file(
                file_name=final_name,
                source=str(source),
                destination=str(dest_path),
            )

            return True, str(dest_path)

        except Exception as e:
            self.audit_log.log_error(
                AuditAction.COPY_FILE,
                f"复制文件失败: {source_path}",
                e,
            )
            return False, None

    def isolate_file(
        self,
        source_path: str,
        source_package: str,
        reason: str,
        conflict_id: Optional[str] = None,
    ) -> Tuple[bool, Optional[str]]:
        source = Path(source_path)
        if not source.exists():
            return False, None

        file_name = source.name
        dest_name = f"{source_package}_{file_name}"
        dest_path = self.quarantine_dir / dest_name

        try:
            shutil.copy2(source, dest_path)

            self.audit_log.log_isolate_file(
                file_name=file_name,
                source=source_package,
                quarantine_path=str(dest_path),
                reason=reason,
            )

            return True, str(dest_path)

        except Exception as e:
            self.audit_log.log_error(
                AuditAction.ISOLATE_FILE,
                f"隔离文件失败: {source_path}",
                e,
            )
            return False, None

    def execute_merge_plan(
        self,
        merge_plan: MergePlan,
        dry_run: bool = True,
    ) -> ArchiveResult:
        result = ArchiveResult(success=True)

        if dry_run:
            result.files_copied = len(merge_plan.files_to_copy)
            result.files_isolated = len(merge_plan.files_to_isolate)
            result.files_renamed = len(merge_plan.files_to_rename)
            result.files_skipped = 0
            return result

        self.ensure_directories()

        for file_info in merge_plan.files_to_copy:
            success, dest = self.copy_file(
                source_path=file_info["source_path"],
                source_package=file_info["source_package"],
                file_type=file_info["file_type"],
                hash_sha256=file_info["hash_sha256"],
                hash_md5=file_info["hash_md5"],
                conflict_id=file_info.get("conflict_id"),
                metadata=file_info.get("metadata"),
                coordinate_info=file_info.get("coordinate_info"),
                attachments=file_info.get("attachments"),
            )
            if success and dest:
                result.files_copied += 1
            elif not success:
                result.success = False
                result.errors.append({
                    "action": "copy",
                    "file": file_info["source_path"],
                    "reason": "复制失败",
                })

        for file_info in merge_plan.files_to_isolate:
            success, dest = self.isolate_file(
                source_path=file_info["source_path"],
                source_package=file_info["source_package"],
                reason=file_info.get("reason", "冲突隔离"),
                conflict_id=file_info.get("conflict_id"),
            )
            if success:
                result.files_isolated += 1
            else:
                result.success = False
                result.errors.append({
                    "action": "isolate",
                    "file": file_info["source_path"],
                    "reason": "隔离失败",
                })

        result.output_path = str(self.output_dir)
        return result

    def save_state(self, manifest_path: str, audit_log_path: str) -> None:
        save_manifest(self.manifest, manifest_path)
