import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class AuditAction(Enum):
    INIT = "init"
    SCAN = "scan"
    MERGE_PLAN = "merge_plan"
    RESOLVE_CONFLICT = "resolve_conflict"
    COMMIT = "commit"
    COPY_FILE = "copy_file"
    ISOLATE_FILE = "isolate_file"
    RENAME_FILE = "rename_file"
    SKIP_DUPLICATE = "skip_duplicate"
    EXPORT = "export"
    UPDATE_MANIFEST = "update_manifest"


class AuditLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    SUCCESS = "success"


@dataclass
class AuditEntry:
    timestamp: datetime
    action: AuditAction
    level: AuditLevel
    message: str
    source: str = "system"
    user: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "action": self.action.value,
            "level": self.level.value,
            "message": self.message,
            "source": self.source,
            "user": self.user,
            "details": self.details,
            "error_message": self.error_message,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AuditEntry":
        return cls(
            timestamp=datetime.fromisoformat(data["timestamp"]),
            action=AuditAction(data["action"]),
            level=AuditLevel(data["level"]),
            message=data["message"],
            source=data.get("source", "system"),
            user=data.get("user"),
            details=data.get("details", {}),
            error_message=data.get("error_message"),
        )


@dataclass
class AuditLog:
    task_id: str
    entries: List[AuditEntry] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def log(
        self,
        action: AuditAction,
        message: str,
        level: AuditLevel = AuditLevel.INFO,
        source: str = "system",
        user: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ) -> AuditEntry:
        entry = AuditEntry(
            timestamp=datetime.now(),
            action=action,
            level=level,
            message=message,
            source=source,
            user=user,
            details=details or {},
            error_message=error_message,
        )
        self.entries.append(entry)
        self.updated_at = datetime.now()
        return entry

    def log_init(self, task_name: str, task_id: str) -> AuditEntry:
        return self.log(
            action=AuditAction.INIT,
            message=f"初始化任务: {task_name}",
            level=AuditLevel.SUCCESS,
            details={"task_name": task_name, "task_id": task_id},
        )

    def log_scan(self, source_package: str, files_found: int) -> AuditEntry:
        return self.log(
            action=AuditAction.SCAN,
            message=f"扫描来源包 '{source_package}': 发现 {files_found} 个文件",
            level=AuditLevel.INFO,
            details={"source_package": source_package, "files_found": files_found},
        )

    def log_merge_plan(
        self,
        total_files: int,
        conflicts: int,
        dry_run: bool = True,
    ) -> AuditEntry:
        return self.log(
            action=AuditAction.MERGE_PLAN,
            message=f"生成合并计划: {total_files} 个文件, {conflicts} 个冲突{' (dry-run)' if dry_run else ''}",
            level=AuditLevel.INFO,
            details={"total_files": total_files, "conflicts": conflicts, "dry_run": dry_run},
        )

    def log_resolve_conflict(
        self,
        conflict_id: str,
        conflict_type: str,
        action: str,
        user: Optional[str] = None,
    ) -> AuditEntry:
        return self.log(
            action=AuditAction.RESOLVE_CONFLICT,
            message=f"解决冲突 {conflict_id}: {action}",
            level=AuditLevel.INFO,
            source="user" if user else "system",
            user=user,
            details={"conflict_id": conflict_id, "conflict_type": conflict_type, "action": action},
        )

    def log_commit(self, files_processed: int, errors: int) -> AuditEntry:
        level = AuditLevel.SUCCESS if errors == 0 else AuditLevel.WARNING
        return self.log(
            action=AuditAction.COMMIT,
            message=f"提交合并: 处理 {files_processed} 个文件, {errors} 个错误",
            level=level,
            details={"files_processed": files_processed, "errors": errors},
        )

    def log_copy_file(
        self,
        file_name: str,
        source: str,
        destination: str,
    ) -> AuditEntry:
        return self.log(
            action=AuditAction.COPY_FILE,
            message=f"复制文件: {file_name}",
            level=AuditLevel.INFO,
            details={"file_name": file_name, "source": source, "destination": destination},
        )

    def log_isolate_file(
        self,
        file_name: str,
        source: str,
        quarantine_path: str,
        reason: str,
    ) -> AuditEntry:
        return self.log(
            action=AuditAction.ISOLATE_FILE,
            message=f"隔离文件: {file_name} ({reason})",
            level=AuditLevel.WARNING,
            details={
                "file_name": file_name,
                "source": source,
                "quarantine_path": quarantine_path,
                "reason": reason,
            },
        )

    def log_rename_file(
        self,
        original_name: str,
        new_name: str,
        source: str,
    ) -> AuditEntry:
        return self.log(
            action=AuditAction.RENAME_FILE,
            message=f"重命名文件: {original_name} -> {new_name}",
            level=AuditLevel.INFO,
            details={"original_name": original_name, "new_name": new_name, "source": source},
        )

    def log_skip_duplicate(
        self,
        file_name: str,
        source: str,
        duplicate_of: str,
    ) -> AuditEntry:
        return self.log(
            action=AuditAction.SKIP_DUPLICATE,
            message=f"跳过重复文件: {file_name}",
            level=AuditLevel.INFO,
            details={"file_name": file_name, "source": source, "duplicate_of": duplicate_of},
        )

    def log_export(
        self,
        export_type: str,
        output_path: str,
        items_count: int,
    ) -> AuditEntry:
        return self.log(
            action=AuditAction.EXPORT,
            message=f"导出 {export_type}: {output_path} ({items_count} 项)",
            level=AuditLevel.SUCCESS,
            details={"export_type": export_type, "output_path": output_path, "items_count": items_count},
        )

    def log_error(
        self,
        action: AuditAction,
        message: str,
        error: Exception,
    ) -> AuditEntry:
        return self.log(
            action=action,
            message=message,
            level=AuditLevel.ERROR,
            error_message=str(error),
            details={"error_type": type(error).__name__},
        )

    def get_entries_by_action(self, action: AuditAction) -> List[AuditEntry]:
        return [e for e in self.entries if e.action == action]

    def get_entries_by_level(self, level: AuditLevel) -> List[AuditEntry]:
        return [e for e in self.entries if e.level == level]

    def get_errors(self) -> List[AuditEntry]:
        return self.get_entries_by_level(AuditLevel.ERROR)

    def get_warnings(self) -> List[AuditEntry]:
        return self.get_entries_by_level(AuditLevel.WARNING)

    def to_json_lines(self) -> str:
        lines = []
        for entry in self.entries:
            lines.append(json.dumps(entry.to_dict(), ensure_ascii=False, default=str))
        return "\n".join(lines)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "total_entries": len(self.entries),
            "entries": [e.to_dict() for e in self.entries],
        }

    @classmethod
    def from_json_lines(cls, task_id: str, content: str) -> "AuditLog":
        log = cls(task_id=task_id)
        for line in content.strip().split("\n"):
            if line.strip():
                data = json.loads(line)
                log.entries.append(AuditEntry.from_dict(data))
        if log.entries:
            log.created_at = log.entries[0].timestamp
            log.updated_at = log.entries[-1].timestamp
        return log


def load_audit_log(path: str, task_id: str) -> AuditLog:
    if not os.path.exists(path):
        return AuditLog(task_id=task_id)

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    return AuditLog.from_json_lines(task_id, content)


def save_audit_log(log: AuditLog, path: str, append: bool = True) -> None:
    mode = "a" if append and os.path.exists(path) else "w"
    with open(path, mode, encoding="utf-8") as f:
        f.write(log.to_json_lines())
        f.write("\n")
