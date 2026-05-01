import os
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Protocol

from .config import ConfigManager
from .manifest import Manifest
from .metadata import timecode_to_seconds
from .scanner import CardScanResult, FileInfo, ScanResult


class Severity(Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class ValidationIssue:
    issue_id: str
    severity: Severity
    category: str
    message: str
    file_id: str | None = None
    file_name: str | None = None
    card_id: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "issue_id": self.issue_id,
            "severity": self.severity.value,
            "category": self.category,
            "message": self.message,
            "file_id": self.file_id,
            "file_name": self.file_name,
            "card_id": self.card_id,
            "details": self.details,
        }


@dataclass
class FileMapping:
    source_file: FileInfo
    target_path: Path
    relative_target_path: str
    conflict: str | None = None


@dataclass
class CopyPlan:
    plan_id: str
    created_at: datetime
    total_files: int
    total_size: int
    file_mappings: dict[str, FileMapping] = field(default_factory=dict)
    issues: list[ValidationIssue] = field(default_factory=list)
    can_proceed: bool = True
    summary: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        mappings_dict: dict[str, dict[str, Any]] = {}
        for fid, mapping in self.file_mappings.items():
            mappings_dict[fid] = {
                "file_id": fid,
                "source_path": mapping.source_file.source_path,
                "target_path": str(mapping.target_path),
                "relative_target_path": mapping.relative_target_path,
                "conflict": mapping.conflict,
            }

        return {
            "plan_id": self.plan_id,
            "created_at": self.created_at.isoformat(),
            "total_files": self.total_files,
            "total_size": self.total_size,
            "file_mappings": mappings_dict,
            "issues": [i.to_dict() for i in self.issues],
            "can_proceed": self.can_proceed,
            "summary": self.summary,
        }


class ValidationRule(Protocol):
    def validate(
        self,
        manifest: Manifest,
        config: ConfigManager,
        target_directory: Path | None = None,
    ) -> list[ValidationIssue]: ...


class DuplicateFilenameRule:
    def validate(
        self,
        manifest: Manifest,
        config: ConfigManager,
        target_directory: Path | None = None,
    ) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []

        duplicates = manifest.get_duplicate_filenames()
        for filename, file_ids in duplicates.items():
            if len(file_ids) <= 1:
                continue

            files = [manifest.get_file_by_id(fid) for fid in file_ids]
            files = [f for f in files if f is not None]

            if len(files) < 2:
                continue

            hashes = {f.hash_value for f in files if f.hash_value}

            if len(hashes) > 1:
                issues.append(ValidationIssue(
                    issue_id=f"dup_name_diff_content_{filename}",
                    severity=Severity.ERROR,
                    category="duplicate",
                    message=f"文件名 '{filename}' 重复但内容不同！涉及 {len(file_ids)} 个文件来自不同卡",
                    file_name=filename,
                    details={
                        "file_ids": file_ids,
                        "cards": [f.card_id for f in files],
                        "hashes": list(hashes),
                    },
                ))
            else:
                issues.append(ValidationIssue(
                    issue_id=f"dup_name_same_content_{filename}",
                    severity=Severity.WARNING,
                    category="duplicate",
                    message=f"文件名 '{filename}' 重复但内容相同，来自 {len(file_ids)} 个卡",
                    file_name=filename,
                    details={
                        "file_ids": file_ids,
                        "cards": [f.card_id for f in files],
                    },
                ))

        return issues


class SequenceGapRule:
    def validate(
        self,
        manifest: Manifest,
        config: ConfigManager,
        target_directory: Path | None = None,
    ) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []

        if not manifest.scan_result:
            return issues

        for card_result in manifest.scan_result.cards:
            video_files = [f for f in card_result.files if f.file_category in ("video", "audio")]
            if not video_files:
                continue

            sequences: dict[str, list[FileInfo]] = {}
            for f in video_files:
                if f.sequence_number is not None and f.clip_name:
                    key = f.clip_name or "default"
                    if key not in sequences:
                        sequences[key] = []
                    sequences[key].append(f)

            for clip_name, files in sequences.items():
                if len(files) < 2:
                    continue

                seq_numbers = sorted([f.sequence_number for f in files if f.sequence_number is not None])
                if len(seq_numbers) < 2:
                    continue

                min_seq = min(seq_numbers)
                max_seq = max(seq_numbers)

                expected = set(range(min_seq, max_seq + 1))
                actual = set(seq_numbers)
                missing = expected - actual

                if missing:
                    issues.append(ValidationIssue(
                        issue_id=f"seq_gap_{card_result.card_id}_{clip_name}",
                        severity=Severity.WARNING,
                        category="sequence",
                        message=f"卡 {card_result.card_id} 的片段 '{clip_name}' 序号断档：缺少 {sorted(missing)}",
                        card_id=card_result.card_id,
                        details={
                            "min_sequence": min_seq,
                            "max_sequence": max_seq,
                            "missing_sequences": sorted(missing),
                            "actual_sequences": sorted(actual),
                        },
                    ))

        return issues


class SidecarMissingRule:
    def validate(
        self,
        manifest: Manifest,
        config: ConfigManager,
        target_directory: Path | None = None,
    ) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []

        video_files = manifest.get_files_by_category("video")
        audio_files = manifest.get_files_by_category("audio")
        sidecar_files = manifest.get_files_by_category("sidecar")

        sidecar_basenames = {Path(f.file_name).stem.lower() for f in sidecar_files}

        all_media_files = video_files + audio_files

        for media_file in all_media_files:
            media_stem = Path(media_file.file_name).stem.lower()

            expected_sidecars = [
                f"{media_stem}.srt",
                f"{media_stem}.json",
                f"{media_stem}.xml",
                f"{media_stem}.csv",
            ]

            found_sidecars = []
            for sc in sidecar_files:
                sc_stem = Path(sc.file_name).stem.lower()
                if sc_stem == media_stem:
                    found_sidecars.append(sc.file_name)

            if not found_sidecars:
                if any(sf in sidecar_basenames for sf in [media_stem]):
                    pass
                else:
                    issues.append(ValidationIssue(
                        issue_id=f"sidecar_missing_{media_file.file_id}",
                        severity=Severity.WARNING,
                        category="sidecar",
                        message=f"媒体文件 '{media_file.file_name}' 没有找到对应的边车文件",
                        file_id=media_file.file_id,
                        file_name=media_file.file_name,
                        card_id=media_file.card_id,
                        details={
                            "expected_extensions": [".srt", ".json", ".xml", ".csv"],
                        },
                    ))

        return issues


class TimecodeOverlapRule:
    def validate(
        self,
        manifest: Manifest,
        config: ConfigManager,
        target_directory: Path | None = None,
    ) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []

        if not manifest.scan_result:
            return issues

        for card_result in manifest.scan_result.cards:
            files_with_tc = []
            for f in card_result.files:
                if f.metadata and f.metadata.start_timecode and f.metadata.duration_seconds:
                    files_with_tc.append(f)

            if len(files_with_tc) < 2:
                continue

            files_with_tc.sort(key=lambda f: f.metadata.timecode_start_seconds if f.metadata else 0)

            for i in range(len(files_with_tc) - 1):
                current = files_with_tc[i]
                next_file = files_with_tc[i + 1]

                if not current.metadata or not next_file.metadata:
                    continue

                current_end = current.metadata.timecode_end_seconds
                next_start = next_file.metadata.timecode_start_seconds

                if current_end is None or next_start is None:
                    continue

                if current_end > next_start:
                    overlap = current_end - next_start
                    issues.append(ValidationIssue(
                        issue_id=f"tc_overlap_{card_result.card_id}_{current.file_id}_{next_file.file_id}",
                        severity=Severity.WARNING,
                        category="timecode",
                        message=f"卡 {card_result.card_id} 中文件 '{current.file_name}' 和 '{next_file.file_name}' 时间码重叠 {overlap:.2f} 秒",
                        card_id=card_result.card_id,
                        details={
                            "file_1": current.file_name,
                            "file_1_start": current.metadata.start_timecode,
                            "file_1_end": current.metadata.end_timecode or f"+{current.metadata.duration_seconds}",
                            "file_2": next_file.file_name,
                            "file_2_start": next_file.metadata.start_timecode,
                            "overlap_seconds": overlap,
                        },
                    ))
                elif current_end < next_start:
                    gap = next_start - current_end
                    if gap > 1.0:
                        issues.append(ValidationIssue(
                            issue_id=f"tc_gap_{card_result.card_id}_{current.file_id}_{next_file.file_id}",
                            severity=Severity.INFO,
                            category="timecode",
                            message=f"卡 {card_result.card_id} 中文件 '{current.file_name}' 和 '{next_file.file_name}' 之间有 {gap:.2f} 秒时间码间隙",
                            card_id=card_result.card_id,
                            details={
                                "file_1": current.file_name,
                                "file_1_end": current.metadata.end_timecode or f"+{current.metadata.duration_seconds}",
                                "file_2": next_file.file_name,
                                "file_2_start": next_file.metadata.start_timecode,
                                "gap_seconds": gap,
                            },
                        ))

        return issues


class DiskSpaceRule:
    def __init__(self) -> None:
        pass

    def validate(
        self,
        manifest: Manifest,
        config: ConfigManager,
        target_directory: Path | None = None,
    ) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []

        if not target_directory:
            return issues

        min_free_gb = config.config.validation.min_free_space_gb

        try:
            usage = shutil.disk_usage(str(target_directory))

            free_bytes = usage.free
            free_gb = free_bytes / (1024 ** 3)

            needed_bytes = manifest.total_size
            needed_gb = needed_bytes / (1024 ** 3)

            buffer_gb = 10.0
            required_free = needed_gb + buffer_gb

            if free_gb < required_free:
                issues.append(ValidationIssue(
                    issue_id="disk_space_insufficient",
                    severity=Severity.ERROR,
                    category="disk",
                    message=f"目标磁盘空间不足！需要约 {required_free:.1f} GB，剩余 {free_gb:.1f} GB",
                    details={
                        "free_gb": free_gb,
                        "needed_gb": needed_gb,
                        "buffer_gb": buffer_gb,
                        "required_gb": required_free,
                        "min_required_gb": min_free_gb,
                    },
                ))
            elif free_gb < min_free_gb:
                issues.append(ValidationIssue(
                    issue_id="disk_space_low",
                    severity=Severity.WARNING,
                    category="disk",
                    message=f"目标磁盘剩余空间较低：{free_gb:.1f} GB（建议至少 {min_free_gb} GB）",
                    details={
                        "free_gb": free_gb,
                        "min_required_gb": min_free_gb,
                    },
                ))

        except Exception as e:
            issues.append(ValidationIssue(
                issue_id="disk_space_check_failed",
                severity=Severity.WARNING,
                category="disk",
                message=f"无法检查目标磁盘空间: {e}",
                details={"error": str(e)},
            ))

        return issues


class TargetConflictRule:
    def validate(
        self,
        manifest: Manifest,
        config: ConfigManager,
        target_directory: Path | None = None,
    ) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []

        if not target_directory:
            return issues

        plan = generate_copy_plan(manifest, config, target_directory, dry_run=True)

        target_to_sources: dict[str, list[FileInfo]] = {}
        for file_id, mapping in plan.file_mappings.items():
            target_str = str(mapping.target_path)
            if target_str not in target_to_sources:
                target_to_sources[target_str] = []
            target_to_sources[target_str].append(mapping.source_file)

        for target_path, sources in target_to_sources.items():
            if len(sources) > 1:
                hashes = {f.hash_value for f in sources if f.hash_value}

                if len(hashes) > 1:
                    issues.append(ValidationIssue(
                        issue_id=f"target_conflict_diff_{Path(target_path).name}",
                        severity=Severity.ERROR,
                        category="conflict",
                        message=f"目标路径 '{target_path}' 有多个来源文件且内容不同！",
                        details={
                            "target_path": target_path,
                            "source_files": [
                                {"file_name": f.file_name, "card_id": f.card_id, "hash": f.hash_value}
                                for f in sources
                            ],
                        },
                    ))
                else:
                    issues.append(ValidationIssue(
                        issue_id=f"target_conflict_same_{Path(target_path).name}",
                        severity=Severity.WARNING,
                        category="conflict",
                        message=f"目标路径 '{target_path}' 有多个来源文件但内容相同",
                        details={
                            "target_path": target_path,
                            "source_files": [
                                {"file_name": f.file_name, "card_id": f.card_id}
                                for f in sources
                            ],
                        },
                    ))

        existing_targets = []
        for file_id, mapping in plan.file_mappings.items():
            if mapping.target_path.exists():
                existing_targets.append(mapping)

        for mapping in existing_targets:
            source_file = mapping.source_file
            existing_size = mapping.target_path.stat().st_size

            if existing_size != source_file.file_size:
                issues.append(ValidationIssue(
                    issue_id=f"existing_file_size_mismatch_{source_file.file_id}",
                    severity=Severity.ERROR,
                    category="existing",
                    message=f"目标已存在文件 '{mapping.target_path}' 大小与源文件不同！源 {source_file.file_size} 字节，目标 {existing_size} 字节",
                    file_id=source_file.file_id,
                    file_name=source_file.file_name,
                    details={
                        "source_size": source_file.file_size,
                        "target_size": existing_size,
                        "target_path": str(mapping.target_path),
                    },
                ))
            elif source_file.hash_value:
                pass

        return issues


class Validator:
    def __init__(self, config: ConfigManager) -> None:
        self.config = config
        self.rules: list[ValidationRule] = [
            DuplicateFilenameRule(),
            SequenceGapRule(),
            SidecarMissingRule(),
            TimecodeOverlapRule(),
            DiskSpaceRule(),
            TargetConflictRule(),
        ]

    def validate(
        self,
        manifest: Manifest,
        target_directory: Path | None = None,
    ) -> list[ValidationIssue]:
        all_issues: list[ValidationIssue] = []

        for rule in self.rules:
            try:
                issues = rule.validate(manifest, self.config, target_directory)
                all_issues.extend(issues)
            except Exception as e:
                all_issues.append(ValidationIssue(
                    issue_id=f"rule_error_{rule.__class__.__name__}",
                    severity=Severity.WARNING,
                    category="internal",
                    message=f"校验规则 {rule.__class__.__name__} 执行出错: {e}",
                    details={"error": str(e)},
                ))

        return all_issues

    def has_blocking_issues(self, issues: list[ValidationIssue]) -> bool:
        return any(i.severity == Severity.ERROR for i in issues)

    def get_errors(self, issues: list[ValidationIssue]) -> list[ValidationIssue]:
        return [i for i in issues if i.severity == Severity.ERROR]

    def get_warnings(self, issues: list[ValidationIssue]) -> list[ValidationIssue]:
        return [i for i in issues if i.severity == Severity.WARNING]


def generate_copy_plan(
    manifest: Manifest,
    config: ConfigManager,
    target_directory: Path,
    dry_run: bool = False,
) -> CopyPlan:
    import hashlib

    plan_id = hashlib.md5(f"{manifest.project_name}:{datetime.now().isoformat()}".encode()).hexdigest()[:12]

    file_mappings: dict[str, FileMapping] = {}
    total_size = manifest.total_size
    total_files = manifest.total_files

    for file_info in manifest.files:
        shoot_date = file_info.shoot_date or config.get_shoot_date()
        camera = file_info.camera_id or config.config.default_camera
        card = file_info.card_id or "UNKNOWN"

        archive_path = config.generate_archive_path(
            base_path=target_directory,
            shoot_date=shoot_date,
            camera=camera,
            card_number=card,
        )

        if file_info.relative_path:
            relative_parts = Path(file_info.relative_path).parts
            if len(relative_parts) > 1:
                subdirs = relative_parts[:-1]
                archive_path = archive_path.joinpath(*subdirs)

        target_file = archive_path / file_info.file_name
        relative_target = str(target_file.relative_to(target_directory))

        mapping = FileMapping(
            source_file=file_info,
            target_path=target_file,
            relative_target_path=relative_target,
        )
        file_mappings[file_info.file_id] = mapping

    validator = Validator(config)
    issues = validator.validate(manifest, target_directory)

    can_proceed = not validator.has_blocking_issues(issues)

    video_count = len(manifest.get_files_by_category("video"))
    audio_count = len(manifest.get_files_by_category("audio"))
    proxy_count = len(manifest.get_files_by_category("proxy"))
    sidecar_count = len(manifest.get_files_by_category("sidecar"))

    summary = {
        "total_files": total_files,
        "total_size_bytes": total_size,
        "total_size_gb": total_size / (1024 ** 3),
        "video_files": video_count,
        "audio_files": audio_count,
        "proxy_files": proxy_count,
        "sidecar_files": sidecar_count,
        "cards_count": len(manifest.scan_result.cards) if manifest.scan_result else 0,
        "errors": len(validator.get_errors(issues)),
        "warnings": len(validator.get_warnings(issues)),
    }

    return CopyPlan(
        plan_id=plan_id,
        created_at=datetime.now(),
        total_files=total_files,
        total_size=total_size,
        file_mappings=file_mappings,
        issues=issues,
        can_proceed=can_proceed,
        summary=summary,
    )


def validate_manifest(
    manifest: Manifest,
    config: ConfigManager,
    target_directory: Path | None = None,
) -> list[ValidationIssue]:
    validator = Validator(config)
    return validator.validate(manifest, target_directory)
