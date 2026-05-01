import os
import shutil
import time
from pathlib import Path
from typing import Callable, List, Optional, Tuple

from .config import SyncConfig
from .models import (
    Journal,
    JournalEntry,
    OperationType,
    compute_sha256,
)


class UndoError(Exception):
    pass


class JournalManager:
    def __init__(self, config: SyncConfig):
        self.config = config
        self.journal_dir = Path(config.journal_dir)
    
    def list_journals(self) -> List[Path]:
        if not self.journal_dir.exists():
            return []
        
        journals = []
        for f in self.journal_dir.glob("journal_*.json"):
            if f.name != "journal_latest.json":
                journals.append(f)
        
        journals.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        return journals
    
    def load_journal(self, journal_path: str) -> Journal:
        return Journal.load(journal_path)
    
    def load_latest_journal(self) -> Optional[Journal]:
        latest_file = self.journal_dir / "journal_latest.json"
        if not latest_file.exists():
            return None
        return self.load_journal(str(latest_file))
    
    def _check_file_modified(self, file_path: str, expected_sha256: str) -> Tuple[bool, str]:
        if not os.path.exists(file_path):
            return True, f"文件不存在: {file_path}"
        
        try:
            actual_sha256 = compute_sha256(file_path)
            if actual_sha256 != expected_sha256:
                return True, f"SHA256不匹配:\n  期望: {expected_sha256[:16]}...\n  实际: {actual_sha256[:16]}..."
            return False, ""
        except (OSError, IOError) as e:
            return True, f"无法读取文件: {e}"
    
    def _undo_copy(self, entry: JournalEntry, dry_run: bool = False) -> Tuple[bool, str]:
        if not entry.backup_path:
            if os.path.exists(entry.target_path):
                if not dry_run:
                    try:
                        os.unlink(entry.target_path)
                    except OSError as e:
                        return False, f"无法删除目标文件: {e}"
                return True, f"删除新增文件: {entry.target_path}"
            return True, "目标文件已不存在，无需撤销"
        
        if not os.path.exists(entry.backup_path):
            return False, f"备份文件不存在: {entry.backup_path}"
        
        if os.path.exists(entry.target_path):
            modified, reason = self._check_file_modified(entry.target_path, entry.source_sha256)
            if modified:
                return False, f"目标文件已被修改，无法安全撤销: {reason}"
        
        if not dry_run:
            try:
                target_dir = os.path.dirname(entry.target_path)
                if target_dir and not os.path.exists(target_dir):
                    os.makedirs(target_dir, exist_ok=True)
                
                shutil.copy2(entry.backup_path, entry.target_path)
            except OSError as e:
                return False, f"无法从备份恢复: {e}"
        
        return True, f"从备份恢复: {entry.backup_path} -> {entry.target_path}"
    
    def _undo_delete(self, entry: JournalEntry, dry_run: bool = False) -> Tuple[bool, str]:
        if not entry.backup_path:
            return False, "删除操作没有备份，无法撤销"
        
        if not os.path.exists(entry.backup_path):
            return False, f"备份文件不存在: {entry.backup_path}"
        
        if os.path.exists(entry.target_path):
            return False, f"目标路径已存在，无法恢复: {entry.target_path}"
        
        if not dry_run:
            try:
                target_dir = os.path.dirname(entry.target_path)
                if target_dir and not os.path.exists(target_dir):
                    os.makedirs(target_dir, exist_ok=True)
                
                shutil.copy2(entry.backup_path, entry.target_path)
            except OSError as e:
                return False, f"无法恢复文件: {e}"
        
        return True, f"恢复已删除文件: {entry.backup_path} -> {entry.target_path}"
    
    def _undo_rename(self, entry: JournalEntry, dry_run: bool = False) -> Tuple[bool, str]:
        if not os.path.exists(entry.target_path):
            return True, "目标文件已不存在，撤销重命名无需操作"
        
        if os.path.exists(entry.source_path):
            modified, reason = self._check_file_modified(entry.target_path, entry.source_sha256)
            if modified:
                return False, f"重命名后的文件已被修改: {reason}"
            return False, f"源路径已存在: {entry.source_path}"
        
        if not dry_run:
            try:
                os.rename(entry.target_path, entry.source_path)
            except OSError as e:
                return False, f"无法撤销重命名: {e}"
        
        return True, f"撤销重命名: {entry.target_path} -> {entry.source_path}"
    
    def undo_journal(
        self,
        journal: Journal,
        dry_run: bool = False,
        force: bool = False,
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
    ) -> Tuple[List[str], List[str]]:
        if not journal.is_applied:
            return [], ["journal未执行任何操作，无需撤销"]
        
        entries_to_undo = [e for e in journal.entries if e.status == "completed"]
        entries_to_undo.reverse()
        
        successes: List[str] = []
        failures: List[str] = []
        total = len(entries_to_undo)
        
        for idx, entry in enumerate(entries_to_undo):
            if progress_callback:
                progress_callback(idx + 1, total, f"撤销: {entry.operation_type.value}")
            
            try:
                if entry.operation_type in [OperationType.COPY_LEFT_TO_RIGHT, OperationType.COPY_RIGHT_TO_LEFT]:
                    success, msg = self._undo_copy(entry, dry_run)
                elif entry.operation_type in [OperationType.DELETE_LEFT, OperationType.DELETE_RIGHT]:
                    success, msg = self._undo_delete(entry, dry_run)
                elif entry.operation_type in [OperationType.RENAME_LEFT, OperationType.RENAME_RIGHT]:
                    success, msg = self._undo_rename(entry, dry_run)
                else:
                    success = True
                    msg = f"跳过未知操作类型: {entry.operation_type}"
                
                if success:
                    successes.append(msg)
                else:
                    failures.append(msg)
                    if not force:
                        break
            
            except Exception as e:
                failures.append(f"撤销操作异常: {e}")
                if not force:
                    break
        
        return successes, failures
    
    def undo_latest(
        self,
        dry_run: bool = False,
        force: bool = False,
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
    ) -> Tuple[List[str], List[str]]:
        journal = self.load_latest_journal()
        if not journal:
            return [], ["没有找到可撤销的操作记录"]
        
        return self.undo_journal(journal, dry_run, force, progress_callback)
    
    def mark_journal_undone(self, journal_path: str) -> None:
        journal = self.load_journal(journal_path)
        journal.is_applied = False
        
        journal_path_obj = Path(journal_path)
        done_path = journal_path_obj.parent / f"{journal_path_obj.stem}_undone.json"
        journal.save(str(done_path))
        
        if journal_path_obj.exists():
            journal_path_obj.unlink()
    
    def cleanup_old_journals(self, keep_count: int = 10) -> int:
        journals = self.list_journals()
        removed = 0
        
        for journal in journals[keep_count:]:
            try:
                journal.unlink()
                
                journal_id = journal.stem.replace("journal_", "")
                backup_dir = self.journal_dir / journal_id / "backups"
                if backup_dir.exists():
                    shutil.rmtree(backup_dir.parent, ignore_errors=True)
                
                removed += 1
            except OSError:
                continue
        
        return removed
