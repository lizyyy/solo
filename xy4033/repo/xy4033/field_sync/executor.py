import os
import shutil
import time
import uuid
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

from .config import SyncConfig
from .models import (
    Journal,
    JournalEntry,
    OperationType,
    PlanStatus,
    SyncOperation,
    SyncPlan,
    compute_sha256,
    generate_timestamp_id,
)


class ExecutionError(Exception):
    pass


class Executor:
    def __init__(self, config: SyncConfig, dry_run: bool = False):
        self.config = config
        self.dry_run = dry_run
        self.journal_dir = Path(config.journal_dir)
        self._ensure_directories()
    
    def _ensure_directories(self) -> None:
        self.journal_dir.mkdir(parents=True, exist_ok=True)
    
    def _generate_backup_path(self, original_path: str, journal_id: str) -> str:
        original = Path(original_path)
        backup_dir = self.journal_dir / journal_id / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        safe_name = original.name.replace('/', '_').replace('\\', '_')
        unique_id = uuid.uuid4().hex[:8]
        backup_name = f"{unique_id}_{safe_name}"
        
        return str(backup_dir / backup_name)
    
    def _backup_file(self, file_path: str, journal_id: str) -> Optional[str]:
        if not os.path.exists(file_path):
            return None
        
        backup_path = self._generate_backup_path(file_path, journal_id)
        try:
            shutil.copy2(file_path, backup_path)
            return backup_path
        except (OSError, IOError) as e:
            raise ExecutionError(f"无法备份文件 {file_path}: {e}")
    
    def _copy_file(
        self,
        source: str,
        target: str,
        source_sha256: str,
        mtime: float,
    ) -> Tuple[bool, str]:
        if self.dry_run:
            return True, ""
        
        target_path = Path(target)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            shutil.copy2(source, target)
            
            if mtime > 0:
                os.utime(target, (mtime, mtime))
            
            actual_sha256 = compute_sha256(target)
            if actual_sha256 != source_sha256:
                return False, f"SHA256校验失败: 期望 {source_sha256[:16]}..., 实际 {actual_sha256[:16]}..."
            
            return True, ""
        except (OSError, IOError) as e:
            return False, str(e)
    
    def _delete_file(self, file_path: str) -> Tuple[bool, str]:
        if self.dry_run:
            return True, ""
        
        try:
            if os.path.isfile(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
            return True, ""
        except (OSError, IOError) as e:
            return False, str(e)
    
    def _rename_file(self, source: str, target: str) -> Tuple[bool, str]:
        if self.dry_run:
            return True, ""
        
        try:
            target_path = Path(target)
            target_path.parent.mkdir(parents=True, exist_ok=True)
            
            os.rename(source, target)
            return True, ""
        except (OSError, IOError) as e:
            return False, str(e)
    
    def _create_journal_entry(
        self,
        operation: SyncOperation,
        entry_id: str,
        backup_path: Optional[str] = None,
    ) -> JournalEntry:
        return JournalEntry(
            id=entry_id,
            timestamp=time.time(),
            operation_type=operation.operation_type,
            source_path=operation.source_path or "",
            target_path=operation.target_path or "",
            source_sha256=operation.source_sha256 or "",
            target_sha256=operation.target_sha256 or "",
            backup_path=backup_path,
            status="pending",
        )
    
    def execute_plan(
        self,
        plan: SyncPlan,
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
    ) -> Tuple[Journal, List[str]]:
        if plan.has_conflicts():
            raise ExecutionError("计划包含冲突，无法执行。请先解决冲突或使用 --force 选项（不推荐）")
        
        journal_id = generate_timestamp_id()
        journal = Journal(
            created_at=time.time(),
            plan_path="",
            entries=[],
            is_applied=False,
        )
        
        errors: List[str] = []
        total_operations = len(plan.operations)
        successful_count = 0
        
        for idx, operation in enumerate(plan.operations):
            entry_id = f"{journal_id}_{idx:04d}"
            backup_path = None
            
            if operation.target_path and os.path.exists(operation.target_path):
                backup_path = self._backup_file(operation.target_path, journal_id)
            
            entry = self._create_journal_entry(operation, entry_id, backup_path)
            journal.entries.append(entry)
            
            if progress_callback:
                progress_callback(idx + 1, total_operations, operation.description or str(operation.operation_type))
            
            try:
                success, error_msg = self._execute_operation(operation, entry, backup_path)
                
                if success:
                    entry.status = "completed"
                    successful_count += 1
                else:
                    entry.status = "failed"
                    entry.error_message = error_msg
                    errors.append(f"操作 {entry_id} 失败: {error_msg}")
            
            except Exception as e:
                entry.status = "failed"
                entry.error_message = str(e)
                errors.append(f"操作 {entry_id} 异常: {e}")
        
        journal.is_applied = successful_count > 0
        journal.applied_at = time.time() if journal.is_applied else None
        
        journal_path = self.journal_dir / f"journal_{journal_id}.json"
        journal.save(str(journal_path))
        
        latest_journal = self.journal_dir / "journal_latest.json"
        if latest_journal.exists():
            latest_journal.unlink()
        try:
            latest_journal.symlink_to(journal_path.name)
        except (OSError, AttributeError):
            shutil.copy2(journal_path, latest_journal)
        
        return journal, errors
    
    def _execute_operation(
        self,
        operation: SyncOperation,
        entry: JournalEntry,
        backup_path: Optional[str],
    ) -> Tuple[bool, str]:
        if operation.operation_type in [OperationType.COPY_LEFT_TO_RIGHT, OperationType.COPY_RIGHT_TO_LEFT]:
            if not operation.source_path or not operation.target_path:
                return False, "源路径或目标路径为空"
            
            return self._copy_file(
                operation.source_path,
                operation.target_path,
                operation.source_sha256 or "",
                operation.mtime,
            )
        
        elif operation.operation_type in [OperationType.DELETE_LEFT, OperationType.DELETE_RIGHT]:
            if not operation.target_path:
                return False, "目标路径为空"
            
            return self._delete_file(operation.target_path)
        
        elif operation.operation_type in [OperationType.RENAME_LEFT, OperationType.RENAME_RIGHT]:
            if not operation.source_path or not operation.target_path:
                return False, "源路径或目标路径为空"
            
            return self._rename_file(operation.source_path, operation.target_path)
        
        elif operation.operation_type == OperationType.SKIP:
            return True, ""
        
        return False, f"未知操作类型: {operation.operation_type}"
    
    def verify_execution(self, journal: Journal) -> List[str]:
        errors: List[str] = []
        
        for entry in journal.entries:
            if entry.status != "completed":
                continue
            
            if entry.operation_type in [OperationType.COPY_LEFT_TO_RIGHT, OperationType.COPY_RIGHT_TO_LEFT]:
                if not os.path.exists(entry.target_path):
                    errors.append(f"目标文件不存在: {entry.target_path}")
                    continue
                
                try:
                    actual_sha256 = compute_sha256(entry.target_path)
                    if actual_sha256 != entry.source_sha256:
                        errors.append(
                            f"SHA256校验失败: {entry.target_path}\n"
                            f"  期望: {entry.source_sha256}\n"
                            f"  实际: {actual_sha256}"
                        )
                except (OSError, IOError) as e:
                    errors.append(f"无法读取目标文件 {entry.target_path}: {e}")
        
        return errors
