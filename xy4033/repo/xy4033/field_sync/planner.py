import os
from typing import Dict, List, Optional, Set, Tuple

from .config import SyncConfig
from .models import (
    ConflictItem,
    ConflictType,
    FileInfo,
    FileType,
    Manifest,
    OperationType,
    PlanStatus,
    SourceSide,
    SyncOperation,
    SyncPlan,
)


MTIME_DRIFT_THRESHOLD = 2.0


class PlanGenerator:
    def __init__(self, config: SyncConfig):
        self.config = config
        self.mtime_drift_threshold = MTIME_DRIFT_THRESHOLD
    
    def _detect_case_conflicts(
        self,
        left_manifest: Manifest,
        right_manifest: Manifest,
    ) -> List[ConflictItem]:
        conflicts = []
        
        left_normalized: Dict[str, List[FileInfo]] = {}
        for file_info in left_manifest.files.values():
            norm = file_info.get_normalized_path()
            if norm not in left_normalized:
                left_normalized[norm] = []
            left_normalized[norm].append(file_info)
        
        right_normalized: Dict[str, List[FileInfo]] = {}
        for file_info in right_manifest.files.values():
            norm = file_info.get_normalized_path()
            if norm not in right_normalized:
                right_normalized[norm] = []
            right_normalized[norm].append(file_info)
        
        for norm, left_files in left_normalized.items():
            if len(left_files) > 1:
                for i, f1 in enumerate(left_files):
                    for f2 in left_files[i + 1:]:
                        if f1.relative_path != f2.relative_path:
                            conflicts.append(ConflictItem(
                                conflict_type=ConflictType.CASE_ONLY_DIFFERENCE,
                                left_file=f1,
                                right_file=None,
                                details={
                                    "normalized_path": norm,
                                    "left_paths": [f.relative_path for f in left_files],
                                },
                                suggestion="左侧目录存在大小写仅差异的文件，请手动重命名后再同步",
                            ))
        
        for norm, right_files in right_normalized.items():
            if len(right_files) > 1:
                for i, f1 in enumerate(right_files):
                    for f2 in right_files[i + 1:]:
                        if f1.relative_path != f2.relative_path:
                            conflicts.append(ConflictItem(
                                conflict_type=ConflictType.CASE_ONLY_DIFFERENCE,
                                left_file=None,
                                right_file=f1,
                                details={
                                    "normalized_path": norm,
                                    "right_paths": [f.relative_path for f in right_files],
                                },
                                suggestion="右侧目录存在大小写仅差异的文件，请手动重命名后再同步",
                            ))
        
        for norm, left_files in left_normalized.items():
            if norm in right_normalized:
                right_files = right_normalized[norm]
                for left_file in left_files:
                    for right_file in right_files:
                        if left_file.relative_path != right_file.relative_path:
                            conflicts.append(ConflictItem(
                                conflict_type=ConflictType.CASE_ONLY_DIFFERENCE,
                                left_file=left_file,
                                right_file=right_file,
                                details={
                                    "normalized_path": norm,
                                    "left_path": left_file.relative_path,
                                    "right_path": right_file.relative_path,
                                },
                                suggestion=f"左右两侧存在大小写仅差异的路径: {left_file.relative_path} vs {right_file.relative_path}",
                            ))
        
        return conflicts
    
    def _detect_symlink_escapes(
        self,
        left_manifest: Manifest,
        right_manifest: Manifest,
    ) -> List[ConflictItem]:
        conflicts = []
        
        for file_info in left_manifest.files.values():
            if file_info.file_type == FileType.SYMLINK and file_info.symlink_target:
                conflicts.append(ConflictItem(
                    conflict_type=ConflictType.SYMLINK_ESCAPES_ROOT,
                    left_file=file_info,
                    right_file=None,
                    details={
                        "symlink_target": file_info.symlink_target,
                    },
                    suggestion=f"左侧符号链接 {file_info.relative_path} 指向目录外，请检查安全性",
                ))
        
        for file_info in right_manifest.files.values():
            if file_info.file_type == FileType.SYMLINK and file_info.symlink_target:
                conflicts.append(ConflictItem(
                    conflict_type=ConflictType.SYMLINK_ESCAPES_ROOT,
                    left_file=None,
                    right_file=file_info,
                    details={
                        "symlink_target": file_info.symlink_target,
                    },
                    suggestion=f"右侧符号链接 {file_info.relative_path} 指向目录外，请检查安全性",
                ))
        
        return conflicts
    
    def _detect_rename_candidates(
        self,
        left_manifest: Manifest,
        right_manifest: Manifest,
    ) -> Tuple[List[ConflictItem], Dict[str, str]]:
        conflicts = []
        rename_map: Dict[str, str] = {}
        
        left_sha256_map: Dict[str, List[FileInfo]] = {}
        for file_info in left_manifest.files.values():
            if file_info.sha256:
                if file_info.sha256 not in left_sha256_map:
                    left_sha256_map[file_info.sha256] = []
                left_sha256_map[file_info.sha256].append(file_info)
        
        right_sha256_map: Dict[str, List[FileInfo]] = {}
        for file_info in right_manifest.files.values():
            if file_info.sha256:
                if file_info.sha256 not in right_sha256_map:
                    right_sha256_map[file_info.sha256] = []
                right_sha256_map[file_info.sha256].append(file_info)
        
        all_left_paths = set(left_manifest.files.keys())
        all_right_paths = set(right_manifest.files.keys())
        
        for sha256, left_files in left_sha256_map.items():
            if sha256 in right_sha256_map:
                right_files = right_sha256_map[sha256]
                
                left_only_paths = [f for f in left_files if f.relative_path not in all_right_paths]
                right_only_paths = [f for f in right_files if f.relative_path not in all_left_paths]
                
                if left_only_paths and right_only_paths:
                    for left_file in left_only_paths:
                        for right_file in right_only_paths:
                            conflicts.append(ConflictItem(
                                conflict_type=ConflictType.RENAME_CANDIDATE,
                                left_file=left_file,
                                right_file=right_file,
                                details={
                                    "sha256": sha256,
                                    "left_path": left_file.relative_path,
                                    "right_path": right_file.relative_path,
                                    "left_size": left_file.size,
                                    "right_size": right_file.size,
                                },
                                suggestion=f"检测到潜在重命名: {left_file.relative_path} -> {right_file.relative_path} (相同sha256)",
                            ))
        
        return conflicts, rename_map
    
    def _generate_operations(
        self,
        left_manifest: Manifest,
        right_manifest: Manifest,
    ) -> Tuple[List[SyncOperation], List[ConflictItem]]:
        operations = []
        conflicts = []
        
        all_left_paths = set(left_manifest.files.keys())
        all_right_paths = set(right_manifest.files.keys())
        
        common_paths = all_left_paths & all_right_paths
        left_only_paths = all_left_paths - all_right_paths
        right_only_paths = all_right_paths - all_left_paths
        
        for path in common_paths:
            left_file = left_manifest.files[path]
            right_file = right_manifest.files[path]
            
            if left_file.sha256 == right_file.sha256:
                mtime_diff = abs(left_file.mtime - right_file.mtime)
                if mtime_diff > self.mtime_drift_threshold:
                    conflicts.append(ConflictItem(
                        conflict_type=ConflictType.MTIME_DRIFT,
                        left_file=left_file,
                        right_file=right_file,
                        details={
                            "left_mtime": left_file.mtime,
                            "right_mtime": right_file.mtime,
                            "mtime_diff": mtime_diff,
                        },
                        suggestion=f"文件 {path} 内容相同但mtime差异 {mtime_diff:.1f} 秒，可能是不同文件系统时间漂移",
                    ))
                continue
            
            conflicts.append(ConflictItem(
                conflict_type=ConflictType.SAME_PATH_DIFFERENT_CONTENT,
                left_file=left_file,
                right_file=right_file,
                details={
                    "left_sha256": left_file.sha256,
                    "right_sha256": right_file.sha256,
                    "left_size": left_file.size,
                    "right_size": right_file.size,
                    "left_mtime": left_file.mtime,
                    "right_mtime": right_file.mtime,
                },
                suggestion=f"文件 {path} 在两侧内容不同，需要手动处理",
            ))
        
        for path in left_only_paths:
            left_file = left_manifest.files[path]
            operations.append(SyncOperation(
                operation_type=OperationType.COPY_LEFT_TO_RIGHT,
                source_path=left_file.absolute_path,
                target_path=os.path.join(self.config.right_dir, left_file.relative_path),
                source_side=SourceSide.LEFT,
                target_side=SourceSide.RIGHT,
                source_sha256=left_file.sha256,
                size=left_file.size,
                mtime=left_file.mtime,
                description=f"新增: 左侧 {path} 复制到右侧",
            ))
        
        for path in right_only_paths:
            right_file = right_manifest.files[path]
            operations.append(SyncOperation(
                operation_type=OperationType.COPY_RIGHT_TO_LEFT,
                source_path=right_file.absolute_path,
                target_path=os.path.join(self.config.left_dir, right_file.relative_path),
                source_side=SourceSide.RIGHT,
                target_side=SourceSide.LEFT,
                source_sha256=right_file.sha256,
                size=right_file.size,
                mtime=right_file.mtime,
                description=f"新增: 右侧 {path} 复制到左侧",
            ))
        
        return operations, conflicts
    
    def generate_plan(
        self,
        left_manifest: Manifest,
        right_manifest: Manifest,
        left_manifest_path: str = "",
        right_manifest_path: str = "",
    ) -> SyncPlan:
        all_operations: List[SyncOperation] = []
        all_conflicts: List[ConflictItem] = []
        
        case_conflicts = self._detect_case_conflicts(left_manifest, right_manifest)
        all_conflicts.extend(case_conflicts)
        
        symlink_conflicts = self._detect_symlink_escapes(left_manifest, right_manifest)
        all_conflicts.extend(symlink_conflicts)
        
        rename_conflicts, _ = self._detect_rename_candidates(left_manifest, right_manifest)
        all_conflicts.extend(rename_conflicts)
        
        operations, content_conflicts = self._generate_operations(left_manifest, right_manifest)
        all_operations.extend(operations)
        all_conflicts.extend(content_conflicts)
        
        statistics = {
            "left_files": len(left_manifest),
            "right_files": len(right_manifest),
            "operations_count": len(all_operations),
            "conflicts_count": len(all_conflicts),
            "copy_left_to_right": sum(1 for op in all_operations if op.operation_type == OperationType.COPY_LEFT_TO_RIGHT),
            "copy_right_to_left": sum(1 for op in all_operations if op.operation_type == OperationType.COPY_RIGHT_TO_LEFT),
            "case_conflicts": sum(1 for c in all_conflicts if c.conflict_type == ConflictType.CASE_ONLY_DIFFERENCE),
            "content_conflicts": sum(1 for c in all_conflicts if c.conflict_type == ConflictType.SAME_PATH_DIFFERENT_CONTENT),
            "mtime_drift": sum(1 for c in all_conflicts if c.conflict_type == ConflictType.MTIME_DRIFT),
            "symlink_escapes": sum(1 for c in all_conflicts if c.conflict_type == ConflictType.SYMLINK_ESCAPES_ROOT),
            "rename_candidates": sum(1 for c in all_conflicts if c.conflict_type == ConflictType.RENAME_CANDIDATE),
        }
        
        status = PlanStatus.READY if not all_conflicts else PlanStatus.CONFLICT
        
        return SyncPlan(
            status=status,
            operations=all_operations,
            conflicts=all_conflicts,
            statistics=statistics,
            left_manifest_path=left_manifest_path,
            right_manifest_path=right_manifest_path,
        )
