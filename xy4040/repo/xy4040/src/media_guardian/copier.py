import hashlib
import os
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from .config import ConfigManager
from .manifest import Manifest, ManifestManager, CopyProgress
from .scanner import FileInfo
from .validator import CopyPlan, FileMapping


@dataclass
class CopyResult:
    success: bool
    total_files: int
    copied_files: int
    failed_files: int
    skipped_files: int
    total_bytes: int
    copied_bytes: int
    errors: list[str] = field(default_factory=list)
    hash_mismatches: list[str] = field(default_factory=list)

    @property
    def is_complete(self) -> bool:
        return self.copied_files + self.skipped_files == self.total_files and len(self.errors) == 0


class FileCopier:
    def __init__(
        self,
        config: ConfigManager,
        chunk_size: int | None = None,
        progress_callback: Callable[[str, int, int], None] | None = None,
        file_progress_callback: Callable[[str, int, int], None] | None = None,
    ) -> None:
        self.config = config
        self.chunk_size = chunk_size or config.config.hash.chunk_size
        self.progress_callback = progress_callback
        self.file_progress_callback = file_progress_callback
        self._hash_algorithm = config.config.hash.algorithm

    def compute_hash(self, path: Path, callback: Callable[[int], None] | None = None) -> str:
        hash_obj = hashlib.new(self._hash_algorithm)
        total_read = 0

        with open(path, "rb") as f:
            while chunk := f.read(self.chunk_size):
                hash_obj.update(chunk)
                total_read += len(chunk)
                if callback:
                    callback(len(chunk))

        return hash_obj.hexdigest()

    def verify_file(self, source_path: Path, target_path: Path) -> tuple[bool, str, str]:
        source_hash = self.compute_hash(source_path)
        target_hash = self.compute_hash(target_path)

        return source_hash == target_hash, source_hash, target_hash

    def copy_file_with_progress(
        self,
        source_path: Path,
        target_path: Path,
        expected_size: int,
        resume: bool = False,
    ) -> tuple[bool, int]:
        target_dir = target_path.parent
        target_dir.mkdir(parents=True, exist_ok=True)

        temp_path = target_path.with_suffix(".tmp")

        start_offset = 0
        if resume and temp_path.exists():
            temp_stat = temp_path.stat()
            if temp_stat.st_size < expected_size:
                start_offset = temp_stat.st_size

        mode = "ab" if start_offset > 0 else "wb"

        try:
            with open(source_path, "rb") as src:
                if start_offset > 0:
                    src.seek(start_offset)

                with open(temp_path, mode) as dst:
                    total_copied = start_offset

                    while chunk := src.read(self.chunk_size):
                        dst.write(chunk)
                        total_copied += len(chunk)

                        if self.file_progress_callback:
                            self.file_progress_callback(source_path.name, total_copied, expected_size)

            temp_stat = temp_path.stat()
            if temp_stat.st_size != expected_size:
                return False, 0

            shutil.move(temp_path, target_path)

            target_stat = target_path.stat()
            if target_stat.st_size != expected_size:
                return False, target_stat.st_size

            return True, target_stat.st_size

        except Exception:
            if temp_path.exists():
                temp_path.unlink()
            raise

    def should_skip_existing(
        self,
        source_file: FileInfo,
        target_path: Path,
        verify: bool = True,
    ) -> tuple[bool, bool | None]:
        if not target_path.exists():
            return False, None

        target_stat = target_path.stat()

        if target_stat.st_size != source_file.file_size:
            return False, None

        if not verify:
            return True, None

        if source_file.hash_value:
            target_hash = self.compute_hash(target_path)
            hash_matched = source_file.hash_value == target_hash
            return True, hash_matched

        return True, None

    def copy_single(
        self,
        mapping: FileMapping,
        dry_run: bool = False,
        resume: bool = False,
        verify: bool = True,
        overwrite: bool = False,
    ) -> tuple[bool, str | None]:
        source_path = Path(mapping.source_file.source_path)
        target_path = mapping.target_path
        source_file = mapping.source_file

        if not source_path.exists():
            return False, f"源文件不存在: {source_path}"

        if not dry_run:
            should_skip, hash_matched = self.should_skip_existing(
                source_file, target_path, verify=verify
            )

            if should_skip:
                hash_status = "已验证" if hash_matched else "大小匹配"
                return True, f"跳过（{hash_status}）"

            if target_path.exists() and not overwrite:
                if verify and source_file.hash_value:
                    target_hash = self.compute_hash(target_path)
                    if source_file.hash_value == target_hash:
                        return True, "跳过（哈希匹配）"
                    else:
                        return False, "目标文件存在且内容不同，拒绝覆盖"
                else:
                    return False, "目标文件存在，拒绝覆盖"

            if self.progress_callback:
                self.progress_callback(
                    source_file.file_name,
                    0,
                    source_file.file_size,
                )

            success, copied = self.copy_file_with_progress(
                source_path,
                target_path,
                source_file.file_size,
                resume=resume,
            )

            if not success:
                return False, "拷贝失败"

            if verify and source_file.hash_value:
                target_hash = self.compute_hash(target_path)
                if source_file.hash_value != target_hash:
                    return False, f"哈希校验失败（源: {source_file.hash_value[:12]}，目标: {target_hash[:12]}）"

        return True, None


class CopyExecutor:
    def __init__(
        self,
        config: ConfigManager,
        manifest: Manifest,
        copy_plan: CopyPlan,
        manifest_manager: ManifestManager | None = None,
        progress_callback: Callable[[str, int, int], None] | None = None,
        file_progress_callback: Callable[[str, int, int], None] | None = None,
    ) -> None:
        self.config = config
        self.manifest = manifest
        self.copy_plan = copy_plan
        self.manifest_manager = manifest_manager
        self.progress_callback = progress_callback
        self.file_progress_callback = file_progress_callback

        self.copier = FileCopier(
            config=config,
            progress_callback=progress_callback,
            file_progress_callback=file_progress_callback,
        )

    def execute(
        self,
        dry_run: bool = False,
        resume: bool = False,
        verify: bool = True,
        overwrite: bool = False,
    ) -> CopyResult:
        total_files = len(self.copy_plan.file_mappings)
        total_size = self.copy_plan.total_size

        result = CopyResult(
            success=True,
            total_files=total_files,
            copied_files=0,
            failed_files=0,
            skipped_files=0,
            total_bytes=total_size,
            copied_bytes=0,
        )

        file_ids = list(self.copy_plan.file_mappings.keys())

        for idx, file_id in enumerate(file_ids):
            mapping = self.copy_plan.file_mappings[file_id]
            file_info = mapping.source_file

            if self.progress_callback:
                self.progress_callback(
                    file_info.file_name,
                    idx + 1,
                    total_files,
                )

            self.manifest.mark_copy_started(file_id)

            try:
                success, message = self.copier.copy_single(
                    mapping,
                    dry_run=dry_run,
                    resume=resume,
                    verify=verify,
                    overwrite=overwrite,
                )

                if success:
                    if message and "跳过" in message:
                        result.skipped_files += 1
                        self.manifest.mark_copy_completed(file_id, verified=True, hash_matched=True)
                    else:
                        result.copied_files += 1
                        result.copied_bytes += file_info.file_size
                        self.manifest.mark_copy_completed(file_id, verified=verify, hash_matched=True)
                else:
                    result.failed_files += 1
                    result.success = False
                    if message:
                        result.errors.append(f"{file_info.file_name}: {message}")
                    self.manifest.mark_copy_failed(file_id, message or "未知错误")

            except Exception as e:
                result.failed_files += 1
                result.success = False
                error_msg = f"{file_info.file_name}: {str(e)}"
                result.errors.append(error_msg)
                self.manifest.mark_copy_failed(file_id, str(e))

            if self.manifest_manager:
                try:
                    self.manifest_manager.save(self.manifest)
                except Exception:
                    pass

        if result.is_complete:
            self.manifest.copy_complete = True

        return result

    def resume_from_manifest(
        self,
        dry_run: bool = False,
        verify: bool = True,
    ) -> CopyResult:
        incomplete_files = CopyResult(
            success=True,
            total_files=len(self.manifest.copy_progress),
            copied_files=0,
            failed_files=0,
            skipped_files=0,
            total_bytes=0,
            copied_bytes=0,
        )

        for file_id, progress in self.manifest.copy_progress.items():
            if progress.completed:
                incomplete_files.skipped_files += 1
                incomplete_files.total_bytes += progress.file_size
                continue

            if progress.bytes_copied > 0:
                incomplete_files.total_bytes += progress.file_size

        mapping_dict: dict[str, FileMapping] = {}
        for file_id, mapping_data in self.copy_plan.file_mappings.items():
            progress = self.manifest.copy_progress.get(file_id)
            if progress and progress.completed:
                continue
            mapping_dict[file_id] = mapping_data

        self.copy_plan.file_mappings = mapping_dict
        self.copy_plan.total_files = len(mapping_dict)
        self.copy_plan.total_size = sum(
            m.source_file.file_size for m in mapping_dict.values()
        )

        result = self.execute(
            dry_run=dry_run,
            resume=True,
            verify=verify,
            overwrite=False,
        )

        result.skipped_files += incomplete_files.skipped_files
        result.total_files += incomplete_files.skipped_files
        result.total_bytes += sum(
            p.file_size for p in self.manifest.copy_progress.values()
        )

        return result


def execute_copy(
    config: ConfigManager,
    manifest: Manifest,
    copy_plan: CopyPlan,
    manifest_manager: ManifestManager | None = None,
    dry_run: bool = False,
    resume: bool = False,
    verify: bool = True,
    overwrite: bool = False,
    progress_callback: Callable[[str, int, int], None] | None = None,
    file_progress_callback: Callable[[str, int, int], None] | None = None,
) -> CopyResult:
    executor = CopyExecutor(
        config=config,
        manifest=manifest,
        copy_plan=copy_plan,
        manifest_manager=manifest_manager,
        progress_callback=progress_callback,
        file_progress_callback=file_progress_callback,
    )

    if resume and manifest.copy_progress:
        return executor.resume_from_manifest(
            dry_run=dry_run,
            verify=verify,
        )
    else:
        return executor.execute(
            dry_run=dry_run,
            resume=False,
            verify=verify,
            overwrite=overwrite,
        )
