"""核心巡检器模块"""

import os
import time
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from inspector.config import InspectorConfig
from inspector.readme_parser import ReadmeParser
from inspector.config_checker import ConfigChecker
from inspector.port_checker import PortChecker
from inspector.command_executor import SafeCommandExecutor, ExecutionResult
from inspector.database import DatabaseManager
from inspector.reporter import ReportExporter


@dataclass
class InspectionResult:
    """检查结果汇总"""
    
    run_id: int
    status: str
    summary: Dict[str, Any]
    markdown_path: str = ""
    json_path: str = ""


class DeliveryInspector:
    """交付验收巡检器主类"""
    
    def __init__(self, project_dir: str, config: InspectorConfig = None):
        self.project_dir = os.path.abspath(project_dir)
        
        if config is None:
            config = InspectorConfig(project_dir=self.project_dir)
        
        self.config = config
        self.output_dir = config.output_dir
        self.db_path = config.db_path
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        self.db = DatabaseManager(self.db_path)
    
    def run_inspection(self, execute_commands: bool = True) -> InspectionResult:
        """执行完整的检查流程"""
        start_time = time.time()
        
        run_id = self.db.create_inspection_run(
            project_dir=self.project_dir,
            status="running"
        )
        
        try:
            total_issues = 0
            success_commands = 0
            failed_commands = 0
            blocked_commands = 0
            
            parsed_readme = self._parse_readme()
            config_check_result = self._check_config(parsed_readme, run_id)
            port_check_result = self._check_ports(parsed_readme, run_id)
            
            for issue in config_check_result.issues:
                total_issues += 1
                self.db.add_issue(
                    run_id=run_id,
                    issue_type=issue.get("type", "config_error"),
                    category="配置核对",
                    command=issue.get("command", ""),
                    description=issue.get("description", ""),
                    suggestion=issue.get("suggestion", ""),
                    severity="high"
                )
            
            for mismatch in port_check_result.mismatches:
                total_issues += 1
                self.db.add_issue(
                    run_id=run_id,
                    issue_type=mismatch.get("type", "port_error"),
                    category="端口检查",
                    description=mismatch.get("description", ""),
                    suggestion=mismatch.get("suggestion", ""),
                    severity="medium"
                )
            
            if execute_commands and parsed_readme.commands:
                executor = SafeCommandExecutor(
                    project_dir=self.project_dir,
                    allowed_commands=self.config.security.allowed_commands,
                    allowed_subcommands=self.config.security.allowed_subcommands,
                    blocked_patterns=self.config.security.blocked_patterns,
                    max_execution_time=self.config.security.max_execution_time
                )
                
                expected_output_files = [
                    f.file_path for f in parsed_readme.files if f.is_output
                ]
                
                for cmd in parsed_readme.commands:
                    result = executor.execute(
                        command=cmd.command,
                        expected_output_files=expected_output_files
                    )
                    
                    self.db.add_command_record(
                        run_id=run_id,
                        command=cmd.command,
                        command_type=cmd.command_type,
                        safety_status=result.safety_status.value,
                        execution_result=result.execution_result.value,
                        exit_code=result.exit_code,
                        stdout=result.stdout,
                        stderr=result.stderr,
                        duration=result.duration,
                        new_ports=result.new_ports,
                        new_files=result.new_files,
                        key_output=result.key_output
                    )
                    
                    if result.execution_result == ExecutionResult.SUCCESS:
                        success_commands += 1
                    elif result.execution_result == ExecutionResult.FAILED:
                        failed_commands += 1
                        self.db.add_issue(
                            run_id=run_id,
                            issue_type="command_failed",
                            category="命令执行",
                            command=cmd.command,
                            description=f"命令执行失败，退出码: {result.exit_code}",
                            actual=result.stderr[:200] if result.stderr else "无错误输出",
                            severity="high"
                        )
                        total_issues += 1
                    elif result.execution_result == ExecutionResult.BLOCKED:
                        blocked_commands += 1
                        self.db.add_issue(
                            run_id=run_id,
                            issue_type="command_blocked",
                            category="安全检查",
                            command=cmd.command,
                            description="命令因安全规则被阻止",
                            actual=result.error_messages[0] if result.error_messages else "未知原因",
                            severity="medium"
                        )
                        total_issues += 1
                
                actual_files = set()
                for expected_file in parsed_readme.files:
                    if expected_file.is_output:
                        full_path = os.path.join(self.project_dir, expected_file.file_path)
                        if os.path.exists(full_path):
                            actual_files.add(expected_file.file_path)
                        else:
                            total_issues += 1
                            self.db.add_issue(
                                run_id=run_id,
                                issue_type="file_missing",
                                category="文件检查",
                                description=f"预期输出文件不存在: {expected_file.file_path}",
                                expected=f"文件 {expected_file.file_path} 应存在",
                                severity="medium"
                            )
            
            end_time = time.time()
            duration = end_time - start_time
            
            total_commands = success_commands + failed_commands + blocked_commands
            status = "completed" if failed_commands == 0 and blocked_commands == 0 else "partial"
            
            self.db.update_inspection_run(
                run_id=run_id,
                status=status,
                duration=duration,
                total_commands=total_commands,
                success_commands=success_commands,
                failed_commands=failed_commands,
                blocked_commands=blocked_commands,
                total_issues=total_issues
            )
            
            markdown_path = os.path.join(self.output_dir, f"report_{run_id}.md")
            json_path = os.path.join(self.output_dir, f"report_{run_id}.json")
            
            reporter = ReportExporter(self.db)
            reporter.export_markdown(run_id, markdown_path)
            reporter.export_json(run_id, json_path)
            
            summary = {
                "run_id": run_id,
                "status": status,
                "duration": duration,
                "commands": {
                    "total": total_commands,
                    "success": success_commands,
                    "failed": failed_commands,
                    "blocked": blocked_commands
                },
                "issues": total_issues,
                "markdown_report": markdown_path,
                "json_report": json_path
            }
            
            return InspectionResult(
                run_id=run_id,
                status=status,
                summary=summary,
                markdown_path=markdown_path,
                json_path=json_path
            )
            
        except Exception as e:
            self.db.update_inspection_run(
                run_id=run_id,
                status="failed",
                notes=str(e)
            )
            raise
    
    def _parse_readme(self):
        """解析 README"""
        parser = ReadmeParser(self.project_dir)
        return parser.parse()
    
    def _check_config(self, parsed_readme, run_id: int):
        """核对配置文件"""
        checker = ConfigChecker(self.project_dir)
        return checker.check_commands(parsed_readme.commands)
    
    def _check_ports(self, parsed_readme, run_id: int):
        """检查端口"""
        checker = PortChecker()
        documented_ports = [p.port for p in parsed_readme.ports]
        
        if not documented_ports:
            documented_ports = self.config.check_port_list
        
        return checker.compare_ports(documented_ports)
    
    def mark_false_positive(self, issue_id: int, reason: str, marked_by: str = "user") -> bool:
        """标记问题为误报"""
        return self.db.mark_false_positive(issue_id, reason, marked_by)
    
    def get_run_summary(self, run_id: int) -> Dict[str, Any]:
        """获取运行摘要"""
        return self.db.get_run_summary(run_id)
    
    def list_runs(self, limit: int = 100) -> List[Dict[str, Any]]:
        """列出所有运行记录"""
        return self.db.get_all_runs(self.project_dir, limit)
    
    def export_report(self, run_id: int, output_dir: str = None) -> Dict[str, str]:
        """导出报告"""
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            markdown_path = os.path.join(output_dir, f"report_{run_id}.md")
            json_path = os.path.join(output_dir, f"report_{run_id}.json")
        else:
            markdown_path = os.path.join(self.output_dir, f"report_{run_id}.md")
            json_path = os.path.join(self.output_dir, f"report_{run_id}.json")
        
        reporter = ReportExporter(self.db)
        reporter.export_markdown(run_id, markdown_path)
        reporter.export_json(run_id, json_path)
        
        return {
            "markdown": markdown_path,
            "json": json_path
        }
