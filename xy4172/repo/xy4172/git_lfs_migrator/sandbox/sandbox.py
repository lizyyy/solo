"""演练沙箱实现"""
import json
import shutil
import subprocess
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from git_lfs_migrator.models import (
    AuditLogEntry,
    LFSMigrationPlan,
    SandboxExecution,
)


class AuditLogger:
    """审计日志记录器"""
    
    def __init__(self, log_file: Path):
        self.log_file = log_file
        self._entries: List[AuditLogEntry] = []
    
    def log(
        self,
        action: str,
        details: Optional[Dict[str, Any]] = None,
        success: bool = True,
        error_message: Optional[str] = None,
    ) -> AuditLogEntry:
        """记录审计日志"""
        entry = AuditLogEntry(
            action=action,
            details=details or {},
            success=success,
            error_message=error_message,
        )
        self._entries.append(entry)
        self._flush()
        return entry
    
    def _flush(self) -> None:
        """将日志写入文件"""
        log_data = {
            "generated_at": datetime.now().isoformat(),
            "entries": [
                {
                    "timestamp": entry.timestamp.isoformat(),
                    "action": entry.action,
                    "details": entry.details,
                    "success": entry.success,
                    "error_message": entry.error_message,
                }
                for entry in self._entries
            ],
        }
        
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.log_file, "w", encoding="utf-8") as f:
            json.dump(log_data, f, indent=2, ensure_ascii=False)
    
    def get_entries(self) -> List[AuditLogEntry]:
        """获取所有日志条目"""
        return list(self._entries)
    
    def get_entries_by_action(self, action: str) -> List[AuditLogEntry]:
        """按动作获取日志条目"""
        return [e for e in self._entries if e.action == action]
    
    def get_failed_entries(self) -> List[AuditLogEntry]:
        """获取失败的日志条目"""
        return [e for e in self._entries if not e.success]


class MigrationSandbox:
    """LFS 迁移演练沙箱"""
    
    def __init__(
        self,
        source_repo: Path,
        sandbox_dir: Optional[Path] = None,
        cleanup_on_exit: bool = True,
    ):
        self.source_repo = source_repo
        self.sandbox_dir = sandbox_dir or self._create_temp_dir()
        self.cleanup_on_exit = cleanup_on_exit
        self._created = False
        self._execution_id = str(uuid.uuid4())[:8]
        
        audit_log_path = self.sandbox_dir / "audit_log.json"
        self.audit_logger = AuditLogger(audit_log_path)
    
    def _create_temp_dir(self) -> Path:
        """创建临时目录"""
        return Path(tempfile.mkdtemp(prefix="lfs-migrate-sandbox-"))
    
    def _validate_source_repo(self) -> bool:
        """验证源仓库"""
        git_dir = self.source_repo / ".git"
        if not git_dir.exists():
            return False
        return True
    
    def _run_git_command(
        self,
        args: List[str],
        cwd: Optional[Path] = None,
        capture_output: bool = True,
    ) -> Dict[str, Any]:
        """运行 Git 命令"""
        cmd = ["git"] + args
        working_dir = cwd or self.sandbox_dir
        
        self.audit_logger.log(
            action="git_command",
            details={"command": " ".join(cmd), "cwd": str(working_dir)},
        )
        
        try:
            result = subprocess.run(
                cmd,
                cwd=working_dir,
                capture_output=capture_output,
                text=True,
                check=False,
            )
            
            output = {
                "command": " ".join(cmd),
                "returncode": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "success": result.returncode == 0,
            }
            
            if result.returncode != 0:
                self.audit_logger.log(
                    action="git_command_failed",
                    details=output,
                    success=False,
                    error_message=result.stderr,
                )
            else:
                self.audit_logger.log(
                    action="git_command_success",
                    details={"command": " ".join(cmd)},
                )
            
            return output
            
        except Exception as e:
            error_details = {
                "command": " ".join(cmd),
                "error": str(e),
            }
            self.audit_logger.log(
                action="git_command_exception",
                details=error_details,
                success=False,
                error_message=str(e),
            )
            return {
                "command": " ".join(cmd),
                "returncode": -1,
                "stdout": "",
                "stderr": str(e),
                "success": False,
            }
    
    def create(self) -> bool:
        """创建沙箱（克隆源仓库）"""
        if self._created:
            return True
        
        if not self._validate_source_repo():
            self.audit_logger.log(
                action="sandbox_validate_failed",
                details={"source_repo": str(self.source_repo)},
                success=False,
                error_message="Source repository is not a valid Git repo",
            )
            return False
        
        self.sandbox_dir.mkdir(parents=True, exist_ok=True)
        
        self.audit_logger.log(
            action="sandbox_create_start",
            details={
                "source_repo": str(self.source_repo),
                "sandbox_dir": str(self.sandbox_dir),
                "execution_id": self._execution_id,
            },
        )
        
        clone_result = self._run_git_command(
            ["clone", "--mirror", str(self.source_repo), str(self.sandbox_dir / ".git")],
            cwd=self.sandbox_dir.parent,
        )
        
        if not clone_result["success"]:
            return False
        
        config_result = self._run_git_command(
            ["config", "--bool", "core.bare", "false"],
            cwd=self.sandbox_dir,
        )
        
        if not config_result["success"]:
            return False
        
        checkout_result = self._run_git_command(
            ["checkout", "HEAD"],
            cwd=self.sandbox_dir,
        )
        
        if not checkout_result["success"]:
            pass
        
        lfs_install_result = self._run_git_command(
            ["lfs", "install", "--local"],
            cwd=self.sandbox_dir,
        )
        
        self._created = True
        
        self.audit_logger.log(
            action="sandbox_create_complete",
            details={
                "sandbox_dir": str(self.sandbox_dir),
                "lfs_installed": lfs_install_result["success"],
            },
        )
        
        return True
    
    def run_migration_dry_run(
        self,
        migration_plan: LFSMigrationPlan,
        include_history: bool = True,
        include_tags: bool = False,
    ) -> Dict[str, Any]:
        """运行迁移 dry-run"""
        if not self._created:
            if not self.create():
                return {"success": False, "error": "Failed to create sandbox"}
        
        self.audit_logger.log(
            action="migration_dry_run_start",
            details={
                "include_history": include_history,
                "include_tags": include_tags,
                "files_to_convert": len(migration_plan.files_to_convert),
            },
        )
        
        results: Dict[str, Any] = {
            "commands_executed": [],
            "success": True,
            "errors": [],
            "warnings": [],
        }
        
        if migration_plan.gitattributes_changes:
            gitattributes_path = self.sandbox_dir / ".gitattributes"
            
            existing_content = ""
            if gitattributes_path.exists():
                existing_content = gitattributes_path.read_text(encoding="utf-8")
            
            new_content = existing_content
            if existing_content and not existing_content.endswith("\n"):
                new_content += "\n"
            
            for rule in migration_plan.gitattributes_changes:
                if rule not in existing_content:
                    new_content += rule + "\n"
            
            gitattributes_path.write_text(new_content, encoding="utf-8")
            
            add_result = self._run_git_command(
                ["add", ".gitattributes"],
                cwd=self.sandbox_dir,
            )
            results["commands_executed"].append(add_result)
        
        info_args = ["lfs", "migrate", "info"]
        
        if include_history:
            info_args.append("--everything")
        
        if include_tags:
            info_args.append("--include-tags")
        
        for rule in migration_plan.gitattributes_changes:
            pattern = rule.split()[0] if rule.split() else ""
            if pattern:
                info_args.extend(["--include", pattern])
        
        info_result = self._run_git_command(info_args, cwd=self.sandbox_dir)
        results["commands_executed"].append(info_result)
        
        if not info_result["success"]:
            results["success"] = False
            results["errors"].append(info_result["stderr"])
        
        status_result = self._run_git_command(["status"], cwd=self.sandbox_dir)
        results["commands_executed"].append(status_result)
        
        log_result = self._run_git_command(
            ["log", "--oneline", "-n", "10"],
            cwd=self.sandbox_dir,
        )
        results["git_log_snapshot"] = [
            line.strip() for line in log_result["stdout"].split("\n") if line.strip()
        ]
        
        self.audit_logger.log(
            action="migration_dry_run_complete",
            details={"success": results["success"]},
        )
        
        return results
    
    def run_migration_apply(
        self,
        migration_plan: LFSMigrationPlan,
        include_history: bool = True,
        include_tags: bool = False,
    ) -> Dict[str, Any]:
        """运行实际迁移（仅在沙箱中）"""
        if not self._created:
            if not self.create():
                return {"success": False, "error": "Failed to create sandbox"}
        
        self.audit_logger.log(
            action="migration_apply_start",
            details={
                "include_history": include_history,
                "include_tags": include_tags,
                "files_to_convert": len(migration_plan.files_to_convert),
            },
        )
        
        results: Dict[str, Any] = {
            "commands_executed": [],
            "success": True,
            "errors": [],
            "warnings": [],
            "final_state": {},
        }
        
        if migration_plan.gitattributes_changes:
            gitattributes_path = self.sandbox_dir / ".gitattributes"
            
            existing_content = ""
            if gitattributes_path.exists():
                existing_content = gitattributes_path.read_text(encoding="utf-8")
            
            new_content = existing_content
            if existing_content and not existing_content.endswith("\n"):
                new_content += "\n"
            
            for rule in migration_plan.gitattributes_changes:
                if rule not in existing_content:
                    new_content += rule + "\n"
            
            gitattributes_path.write_text(new_content, encoding="utf-8")
            
            add_result = self._run_git_command(
                ["add", ".gitattributes"],
                cwd=self.sandbox_dir,
            )
            results["commands_executed"].append(add_result)
        
        migrate_args = ["lfs", "migrate", "import"]
        
        if include_history:
            migrate_args.append("--everything")
        
        if include_tags:
            migrate_args.append("--include-tags")
        
        for rule in migration_plan.gitattributes_changes:
            pattern = rule.split()[0] if rule.split() else ""
            if pattern:
                migrate_args.extend(["--include", pattern])
        
        migrate_result = self._run_git_command(migrate_args, cwd=self.sandbox_dir)
        results["commands_executed"].append(migrate_result)
        
        if not migrate_result["success"]:
            results["success"] = False
            results["errors"].append(migrate_result["stderr"])
        
        status_result = self._run_git_command(["status"], cwd=self.sandbox_dir)
        results["commands_executed"].append(status_result)
        
        reflog_result = self._run_git_command(
            ["reflog", "show", "-n", "20"],
            cwd=self.sandbox_dir,
        )
        results["commands_executed"].append(reflog_result)
        
        log_result = self._run_git_command(
            ["log", "--oneline", "-n", "20"],
            cwd=self.sandbox_dir,
        )
        results["git_log_snapshot"] = [
            line.strip() for line in log_result["stdout"].split("\n") if line.strip()
        ]
        
        lfs_ls_result = self._run_git_command(
            ["lfs", "ls-files"],
            cwd=self.sandbox_dir,
        )
        results["final_state"]["lfs_files"] = [
            line.strip() for line in lfs_ls_result["stdout"].split("\n") if line.strip()
        ]
        
        self.audit_logger.log(
            action="migration_apply_complete",
            details={
                "success": results["success"],
                "lfs_files_count": len(results["final_state"]["lfs_files"]),
            },
        )
        
        return results
    
    def get_execution_result(self) -> SandboxExecution:
        """获取执行结果"""
        commands_executed = []
        for entry in self.audit_logger.get_entries():
            if entry.action in ["git_command", "git_command_success", "git_command_failed"]:
                commands_executed.append(entry.details)
        
        return SandboxExecution(
            execution_id=self._execution_id,
            sandbox_dir=self.sandbox_dir,
            source_repo=self.source_repo,
            commands_executed=commands_executed,
            success=len(self.audit_logger.get_failed_entries()) == 0,
        )
    
    def cleanup(self) -> None:
        """清理沙箱"""
        if self.cleanup_on_exit and self.sandbox_dir.exists():
            self.audit_logger.log(
                action="sandbox_cleanup",
                details={"sandbox_dir": str(self.sandbox_dir)},
            )
            try:
                shutil.rmtree(self.sandbox_dir)
            except Exception:
                pass
    
    def __enter__(self) -> "MigrationSandbox":
        self.create()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.cleanup()


def create_sandbox(
    source_repo: Path,
    sandbox_dir: Optional[Path] = None,
) -> MigrationSandbox:
    """创建沙箱的便捷函数"""
    sandbox = MigrationSandbox(
        source_repo=source_repo,
        sandbox_dir=sandbox_dir,
        cleanup_on_exit=False,
    )
    sandbox.create()
    return sandbox


def run_sandbox_migration(
    source_repo: Path,
    migration_plan: LFSMigrationPlan,
    sandbox_dir: Optional[Path] = None,
    dry_run: bool = True,
    include_history: bool = True,
    include_tags: bool = False,
) -> SandboxExecution:
    """
    在沙箱中运行迁移演练
    
    Args:
        source_repo: 源仓库路径
        migration_plan: 迁移计划
        sandbox_dir: 沙箱目录（可选，自动创建临时目录）
        dry_run: 是否为 dry-run 模式
        include_history: 是否包含历史
        include_tags: 是否包含标签
    
    Returns:
        SandboxExecution
    """
    with MigrationSandbox(
        source_repo=source_repo,
        sandbox_dir=sandbox_dir,
        cleanup_on_exit=False,
    ) as sandbox:
        if dry_run:
            result = sandbox.run_migration_dry_run(
                migration_plan=migration_plan,
                include_history=include_history,
                include_tags=include_tags,
            )
        else:
            result = sandbox.run_migration_apply(
                migration_plan=migration_plan,
                include_history=include_history,
                include_tags=include_tags,
            )
        
        execution = sandbox.get_execution_result()
        execution.success = result.get("success", False)
        execution.git_log_snapshot = result.get("git_log_snapshot", [])
        execution.errors = result.get("errors", [])
        execution.warnings = result.get("warnings", [])
        execution.final_state = result.get("final_state", {})
        
        return execution
