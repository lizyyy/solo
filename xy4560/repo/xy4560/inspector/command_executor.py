"""安全白名单命令执行器"""

import subprocess
import os
import re
import time
import shlex
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum


class CommandSafetyStatus(Enum):
    """命令安全状态"""
    SAFE = "safe"
    BLOCKED = "blocked"
    WARNING = "warning"


class ExecutionResult(Enum):
    """执行结果"""
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"
    BLOCKED = "blocked"
    SKIPPED = "skipped"


@dataclass
class FileChange:
    """文件变更记录"""
    
    file_path: str
    change_type: str
    size_before: Optional[int] = None
    size_after: Optional[int] = None
    is_new: bool = False


@dataclass
class CommandExecutionRecord:
    """命令执行记录"""
    
    command: str
    safety_status: CommandSafetyStatus
    execution_result: ExecutionResult
    
    exit_code: Optional[int] = None
    stdout: str = ""
    stderr: str = ""
    
    start_time: float = 0.0
    end_time: float = 0.0
    duration: float = 0.0
    
    ports_before: List[int] = field(default_factory=list)
    ports_after: List[int] = field(default_factory=list)
    new_ports: List[int] = field(default_factory=list)
    
    files_before: List[str] = field(default_factory=list)
    files_after: List[str] = field(default_factory=list)
    new_files: List[str] = field(default_factory=list)
    changed_files: List[FileChange] = field(default_factory=list)
    
    warning_messages: List[str] = field(default_factory=list)
    error_messages: List[str] = field(default_factory=list)
    
    raw_output: str = ""
    key_output: List[str] = field(default_factory=list)


@dataclass
class SafetyCheckResult:
    """安全检查结果"""
    
    is_safe: bool
    status: CommandSafetyStatus
    warnings: List[str] = field(default_factory=list)
    blocked_reason: str = ""


class SafeCommandExecutor:
    """安全命令执行器"""
    
    def __init__(
        self, 
        project_dir: str,
        allowed_commands: List[str],
        allowed_subcommands: Dict[str, List[str]],
        blocked_patterns: List[str],
        max_execution_time: int = 60
    ):
        self.project_dir = project_dir
        self.allowed_commands = allowed_commands
        self.allowed_subcommands = allowed_subcommands
        self.blocked_patterns = blocked_patterns
        self.max_execution_time = max_execution_time
        
        self.port_checker = self._lazy_import_port_checker()
    
    def _lazy_import_port_checker(self):
        """延迟导入端口检查器"""
        try:
            from inspector.port_checker import PortChecker
            return PortChecker()
        except ImportError:
            return None
    
    def check_safety(self, command: str) -> SafetyCheckResult:
        """检查命令安全性"""
        result = SafetyCheckResult(is_safe=True, status=CommandSafetyStatus.SAFE)
        
        for pattern in self.blocked_patterns:
            if pattern.lower() in command.lower():
                result.is_safe = False
                result.status = CommandSafetyStatus.BLOCKED
                result.blocked_reason = f"命令包含危险模式: {pattern}"
                return result
        
        parts = command.split()
        if not parts:
            result.is_safe = False
            result.status = CommandSafetyStatus.BLOCKED
            result.blocked_reason = "空命令"
            return result
        
        base_command = parts[0]
        
        if base_command not in self.allowed_commands:
            result.is_safe = False
            result.status = CommandSafetyStatus.BLOCKED
            result.blocked_reason = f"命令 '{base_command}' 不在白名单中"
            return result
        
        if len(parts) >= 2:
            subcommand = parts[1]
            
            allowed_subs = self.allowed_subcommands.get(base_command, [])
            if allowed_subs and subcommand not in allowed_subs:
                if not subcommand.startswith("-"):
                    result.status = CommandSafetyStatus.WARNING
                    result.warnings.append(
                        f"子命令 '{subcommand}' 不在允许列表中，将谨慎执行"
                    )
        
        return result
    
    def execute(
        self, 
        command: str, 
        capture_output: bool = True,
        check_ports: bool = True,
        check_files: bool = True,
        expected_output_files: List[str] = None
    ) -> CommandExecutionRecord:
        """执行命令（带安全检查）"""
        record = CommandExecutionRecord(
            command=command,
            safety_status=CommandSafetyStatus.SAFE,
            execution_result=ExecutionResult.SKIPPED
        )
        
        safety_result = self.check_safety(command)
        record.safety_status = safety_result.status
        record.warning_messages = safety_result.warnings
        
        if not safety_result.is_safe:
            record.execution_result = ExecutionResult.BLOCKED
            record.error_messages.append(safety_result.blocked_reason)
            return record
        
        ports_before = []
        files_before = []
        
        if check_ports and self.port_checker:
            all_listening = self.port_checker.check_all_listening_ports()
            ports_before = [p.port for p in all_listening]
            record.ports_before = ports_before
        
        if check_files:
            files_before = self._list_all_files()
            record.files_before = files_before
        
        record.start_time = time.time()
        
        try:
            if capture_output:
                process = subprocess.Popen(
                    command,
                    shell=True,
                    cwd=self.project_dir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    executable="/bin/bash"
                )
                
                try:
                    stdout, stderr = process.communicate(timeout=self.max_execution_time)
                    record.exit_code = process.returncode
                    record.stdout = stdout
                    record.stderr = stderr
                    record.raw_output = stdout + stderr
                    
                    record.key_output = self._extract_key_output(record.raw_output)
                    
                    if process.returncode == 0:
                        record.execution_result = ExecutionResult.SUCCESS
                    else:
                        record.execution_result = ExecutionResult.FAILED
                        record.error_messages.append(f"命令返回非零退出码: {process.returncode}")
                        
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                    record.execution_result = ExecutionResult.TIMEOUT
                    record.error_messages.append(f"命令执行超时（超过 {self.max_execution_time} 秒）")
                    
            else:
                exit_code = subprocess.call(
                    command,
                    shell=True,
                    cwd=self.project_dir,
                    executable="/bin/bash"
                )
                record.exit_code = exit_code
                record.execution_result = (
                    ExecutionResult.SUCCESS if exit_code == 0 
                    else ExecutionResult.FAILED
                )
                
        except Exception as e:
            record.execution_result = ExecutionResult.FAILED
            record.error_messages.append(f"执行异常: {str(e)}")
        
        record.end_time = time.time()
        record.duration = record.end_time - record.start_time
        
        if check_ports and self.port_checker:
            all_listening_after = self.port_checker.check_all_listening_ports()
            ports_after = [p.port for p in all_listening_after]
            record.ports_after = ports_after
            
            new_ports = [p for p in ports_after if p not in ports_before]
            record.new_ports = new_ports
        
        if check_files:
            files_after = self._list_all_files()
            record.files_after = files_after
            
            new_files = [f for f in files_after if f not in files_before]
            record.new_files = new_files
            
            if expected_output_files:
                for expected_file in expected_output_files:
                    full_path = os.path.join(self.project_dir, expected_file)
                    if os.path.exists(full_path):
                        if expected_file not in record.new_files:
                            if expected_file not in files_before:
                                record.new_files.append(expected_file)
        
        return record
    
    def execute_batch(
        self,
        commands: List[str],
        capture_output: bool = True,
        check_ports: bool = True,
        check_files: bool = True
    ) -> List[CommandExecutionRecord]:
        """批量执行命令"""
        results = []
        
        for command in commands:
            result = self.execute(
                command,
                capture_output=capture_output,
                check_ports=check_ports,
                check_files=check_files
            )
            results.append(result)
        
        return results
    
    def _list_all_files(self) -> List[str]:
        """列出项目目录下的所有文件"""
        files = []
        
        for root, dirs, filenames in os.walk(self.project_dir):
            rel_root = os.path.relpath(root, self.project_dir)
            
            if rel_root.startswith(".") and rel_root != ".":
                continue
            
            for filename in filenames:
                if filename.startswith("."):
                    continue
                
                full_path = os.path.join(root, filename)
                rel_path = os.path.relpath(full_path, self.project_dir)
                files.append(rel_path)
        
        return files
    
    def _extract_key_output(self, output: str) -> List[str]:
        """从输出中提取关键信息"""
        key_lines = []
        
        keywords = [
            "error", "Error", "ERROR",
            "warning", "Warning", "WARNING",
            "success", "Success", "SUCCESS",
            "failed", "Failed", "FAILED",
            "passed", "Passed", "PASSED",
            "端口", "监听", "启动", "完成",
            "port", "listen", "started", "complete",
            "生成", "创建", "保存",
            "generated", "created", "saved"
        ]
        
        lines = output.split("\n")
        for line in lines:
            for keyword in keywords:
                if keyword in line:
                    key_lines.append(line.strip())
                    break
        
        return key_lines[:20]
    
    def get_execution_summary(
        self, records: List[CommandExecutionRecord]
    ) -> Dict[str, Any]:
        """获取执行摘要"""
        success_count = sum(1 for r in records if r.execution_result == ExecutionResult.SUCCESS)
        failed_count = sum(1 for r in records if r.execution_result == ExecutionResult.FAILED)
        blocked_count = sum(1 for r in records if r.execution_result == ExecutionResult.BLOCKED)
        timeout_count = sum(1 for r in records if r.execution_result == ExecutionResult.TIMEOUT)
        skipped_count = sum(1 for r in records if r.execution_result == ExecutionResult.SKIPPED)
        
        all_new_files = set()
        all_new_ports = set()
        
        for record in records:
            for f in record.new_files:
                all_new_files.add(f)
            for p in record.new_ports:
                all_new_ports.add(p)
        
        return {
            "total": len(records),
            "success": success_count,
            "failed": failed_count,
            "blocked": blocked_count,
            "timeout": timeout_count,
            "skipped": skipped_count,
            "new_files": list(all_new_files),
            "new_ports": list(all_new_ports),
            "total_duration": sum(r.duration for r in records)
        }
