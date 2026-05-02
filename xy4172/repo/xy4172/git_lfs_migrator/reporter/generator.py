"""报告生成器 - 导出 Markdown、CSV 和 JSON 格式"""
import csv
import io
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from git_lfs_migrator.models import (
    CheckResult,
    Issue,
    IssueSeverity,
    LFSMigrationPlan,
    ReportPackage,
    SandboxExecution,
    ScanResult,
)


def _format_size(size: int) -> str:
    """格式化大小"""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} PB"


def _severity_to_emoji(severity: IssueSeverity) -> str:
    """严重程度转换为 emoji"""
    mapping = {
        IssueSeverity.CRITICAL: "🔴",
        IssueSeverity.HIGH: "🟠",
        IssueSeverity.MEDIUM: "🟡",
        IssueSeverity.LOW: "🟢",
    }
    return mapping.get(severity, "⚪")


def _severity_to_string(severity: IssueSeverity) -> str:
    """严重程度转换为字符串"""
    mapping = {
        IssueSeverity.CRITICAL: "CRITICAL",
        IssueSeverity.HIGH: "HIGH",
        IssueSeverity.MEDIUM: "MEDIUM",
        IssueSeverity.LOW: "LOW",
    }
    return mapping.get(severity, "UNKNOWN")


class ReportGenerator:
    """报告生成器"""
    
    def __init__(
        self,
        scan_result: Optional[ScanResult] = None,
        check_result: Optional[CheckResult] = None,
        migration_plan: Optional[LFSMigrationPlan] = None,
        sandbox_execution: Optional[SandboxExecution] = None,
    ):
        self.scan_result = scan_result
        self.check_result = check_result
        self.migration_plan = migration_plan
        self.sandbox_execution = sandbox_execution
    
    def generate_markdown(self) -> str:
        """生成 Markdown 报告"""
        lines: List[str] = []
        
        lines.append("# Git LFS 迁移预检报告")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        if self.scan_result:
            lines.append("## 1. 仓库扫描摘要")
            lines.append("")
            lines.append("| 指标 | 值 |")
            lines.append("|------|-----|")
            lines.append(f"| 总文件数 | {self.scan_result.total_files} |")
            lines.append(f"| 总大小 | {_format_size(self.scan_result.total_size)} |")
            lines.append(f"| 二进制文件数 | {self.scan_result.binary_files} |")
            lines.append(f"| 大文件数 (>100KB) | {self.scan_result.large_files} |")
            lines.append(f"| 提交数 | {len(self.scan_result.rev_list)} |")
            lines.append("")
            
            if self.scan_result.file_sizes:
                lines.append("### 大文件列表 (前 20 个)")
                lines.append("")
                lines.append("| 文件路径 | 大小 | 类型 |")
                lines.append("|----------|------|------|")
                
                large_files = sorted(
                    self.scan_result.file_sizes.values(),
                    key=lambda f: f.size,
                    reverse=True,
                )[:20]
                
                for f in large_files:
                    file_type = "二进制" if f.file_type.value == 2 else "文本" if f.file_type.value == 1 else "未知"
                    lines.append(f"| {f.path} | {_format_size(f.size)} | {file_type} |")
                lines.append("")
        
        if self.check_result and self.check_result.issues:
            lines.append("## 2. 风险检查结果")
            lines.append("")
            
            critical = [i for i in self.check_result.issues if i.severity == IssueSeverity.CRITICAL]
            high = [i for i in self.check_result.issues if i.severity == IssueSeverity.HIGH]
            medium = [i for i in self.check_result.issues if i.severity == IssueSeverity.MEDIUM]
            low = [i for i in self.check_result.issues if i.severity == IssueSeverity.LOW]
            
            lines.append(f"| 严重程度 | 数量 |")
            lines.append(f"|----------|------|")
            lines.append(f"| 🔴 严重 (CRITICAL) | {len(critical)} |")
            lines.append(f"| 🟠 高 (HIGH) | {len(high)} |")
            lines.append(f"| 🟡 中 (MEDIUM) | {len(medium)} |")
            lines.append(f"| 🟢 低 (LOW) | {len(low)} |")
            lines.append("")
            
            lines.append("### 问题详情")
            lines.append("")
            
            for issue in self.check_result.issues:
                emoji = _severity_to_emoji(issue.severity)
                lines.append(f"#### {emoji} {issue.message}")
                lines.append("")
                lines.append(f"- **严重程度**: {_severity_to_string(issue.severity)}")
                lines.append(f"- **问题类型**: {issue.issue_type.name}")
                
                if issue.affected_files:
                    lines.append(f"- **受影响文件**:")
                    for f in issue.affected_files[:10]:
                        lines.append(f"  - `{f}`")
                    if len(issue.affected_files) > 10:
                        lines.append(f"  - ... 等 {len(issue.affected_files)} 个文件")
                
                if issue.suggestion:
                    lines.append(f"- **建议**: {issue.suggestion}")
                
                lines.append("")
        
        if self.migration_plan:
            lines.append("## 3. 迁移计划")
            lines.append("")
            
            lines.append("| 项目 | 值 |")
            lines.append("|------|-----|")
            lines.append(f"| 需要转换的文件数 | {len(self.migration_plan.files_to_convert)} |")
            lines.append(f"| 保持不变的文件数 | {len(self.migration_plan.files_unchanged)} |")
            lines.append(f"| 预计减少的大小 | {_format_size(self.migration_plan.estimated_size_reduction)} |")
            lines.append("")
            
            if self.migration_plan.gitattributes_changes:
                lines.append("### 建议的 .gitattributes 规则")
                lines.append("")
                lines.append("```gitattributes")
                for rule in self.migration_plan.gitattributes_changes:
                    lines.append(rule)
                lines.append("```")
                lines.append("")
            
            if self.migration_plan.warnings:
                lines.append("### 警告")
                lines.append("")
                for warning in self.migration_plan.warnings:
                    lines.append(f"- ⚠️ {warning}")
                lines.append("")
            
            if self.migration_plan.dry_run_output:
                lines.append("### Dry-Run 输出摘要")
                lines.append("")
                lines.append("```json")
                lines.append(json.dumps(self.migration_plan.dry_run_output, indent=2, ensure_ascii=False))
                lines.append("```")
                lines.append("")
        
        if self.sandbox_execution:
            lines.append("## 4. 沙箱演练结果")
            lines.append("")
            
            lines.append("| 项目 | 值 |")
            lines.append("|------|-----|")
            lines.append(f"| 执行 ID | {self.sandbox_execution.execution_id} |")
            lines.append(f"| 沙箱目录 | `{self.sandbox_execution.sandbox_dir}` |")
            lines.append(f"| 源仓库 | `{self.sandbox_execution.source_repo}` |")
            lines.append(f"| 执行状态 | {'✅ 成功' if self.sandbox_execution.success else '❌ 失败'} |")
            lines.append("")
            
            if self.sandbox_execution.errors:
                lines.append("### 错误")
                lines.append("")
                for error in self.sandbox_execution.errors:
                    lines.append(f"```")
                    lines.append(error)
                    lines.append("```")
                lines.append("")
            
            if self.sandbox_execution.git_log_snapshot:
                lines.append("### Git 日志快照 (最近 10 条)")
                lines.append("")
                lines.append("```")
                for log in self.sandbox_execution.git_log_snapshot:
                    lines.append(log)
                lines.append("```")
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由 Git LFS 迁移预检员生成*")
        
        return "\n".join(lines)
    
    def generate_csv_files(self) -> Dict[str, str]:
        """生成 CSV 文件字典"""
        csv_files: Dict[str, str] = {}
        
        if self.scan_result and self.scan_result.file_sizes:
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["path", "size_bytes", "size_human", "file_type", "is_binary", "is_large"])
            
            for file_path, git_file in self.scan_result.file_sizes.items():
                is_binary = git_file.file_type.value == 2
                is_large = git_file.size >= 100 * 1024
                writer.writerow([
                    file_path,
                    git_file.size,
                    _format_size(git_file.size),
                    git_file.file_type.name,
                    is_binary,
                    is_large,
                ])
            
            csv_files["file_sizes.csv"] = output.getvalue()
        
        if self.check_result and self.check_result.issues:
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["severity", "issue_type", "message", "affected_files_count", "suggestion"])
            
            for issue in self.check_result.issues:
                writer.writerow([
                    _severity_to_string(issue.severity),
                    issue.issue_type.name,
                    issue.message,
                    len(issue.affected_files),
                    issue.suggestion or "",
                ])
            
            csv_files["issues.csv"] = output.getvalue()
        
        if self.migration_plan and self.migration_plan.files_to_convert:
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["path", "size_bytes", "size_human", "file_type"])
            
            for git_file in self.migration_plan.files_to_convert:
                writer.writerow([
                    git_file.path,
                    git_file.size,
                    _format_size(git_file.size),
                    git_file.file_type.name,
                ])
            
            csv_files["files_to_convert.csv"] = output.getvalue()
        
        if self.sandbox_execution and self.sandbox_execution.commands_executed:
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["command", "success", "returncode"])
            
            for cmd in self.sandbox_execution.commands_executed:
                writer.writerow([
                    cmd.get("command", ""),
                    cmd.get("success", False),
                    cmd.get("returncode", ""),
                ])
            
            csv_files["commands_executed.csv"] = output.getvalue()
        
        return csv_files
    
    def generate_json(self) -> Dict[str, Any]:
        """生成 JSON 数据"""
        data: Dict[str, Any] = {
            "generated_at": datetime.now().isoformat(),
            "version": "0.1.0",
        }
        
        if self.scan_result:
            data["scan_result"] = {
                "git_dir": str(self.scan_result.git_dir),
                "total_files": self.scan_result.total_files,
                "total_size_bytes": self.scan_result.total_size,
                "total_size_human": _format_size(self.scan_result.total_size),
                "binary_files": self.scan_result.binary_files,
                "large_files": self.scan_result.large_files,
                "commit_count": len(self.scan_result.rev_list),
                "file_sizes": {
                    path: {
                        "size_bytes": f.size,
                        "size_human": _format_size(f.size),
                        "file_type": f.file_type.name,
                        "lfs_status": f.lfs_status.name,
                    }
                    for path, f in self.scan_result.file_sizes.items()
                },
            }
        
        if self.check_result:
            data["check_result"] = {
                "case_conflicts": self.check_result.case_conflicts,
                "hash_conflicts": self.check_result.hash_conflicts,
                "protected_refs_at_risk": self.check_result.protected_refs_at_risk,
                "rollback_scenarios": self.check_result.rollback_scenarios,
                "issues": [
                    {
                        "severity": _severity_to_string(i.severity),
                        "issue_type": i.issue_type.name,
                        "message": i.message,
                        "affected_files": i.affected_files,
                        "details": i.details,
                        "suggestion": i.suggestion,
                    }
                    for i in self.check_result.issues
                ],
            }
        
        if self.migration_plan:
            data["migration_plan"] = {
                "files_to_convert_count": len(self.migration_plan.files_to_convert),
                "files_unchanged_count": len(self.migration_plan.files_unchanged),
                "estimated_size_reduction_bytes": self.migration_plan.estimated_size_reduction,
                "estimated_size_reduction_human": _format_size(self.migration_plan.estimated_size_reduction),
                "gitattributes_changes": self.migration_plan.gitattributes_changes,
                "warnings": self.migration_plan.warnings,
                "dry_run_output": self.migration_plan.dry_run_output,
            }
        
        if self.sandbox_execution:
            data["sandbox_execution"] = {
                "execution_id": self.sandbox_execution.execution_id,
                "timestamp": self.sandbox_execution.timestamp.isoformat(),
                "sandbox_dir": str(self.sandbox_execution.sandbox_dir),
                "source_repo": str(self.sandbox_execution.source_repo),
                "success": self.sandbox_execution.success,
                "errors": self.sandbox_execution.errors,
                "warnings": self.sandbox_execution.warnings,
                "git_log_snapshot": self.sandbox_execution.git_log_snapshot,
                "final_state": self.sandbox_execution.final_state,
            }
        
        return data
    
    def generate_report_package(self) -> ReportPackage:
        """生成完整的报告包"""
        return ReportPackage(
            scan_result=self.scan_result,
            check_result=self.check_result,
            migration_plan=self.migration_plan,
            sandbox_execution=self.sandbox_execution,
            markdown_content=self.generate_markdown(),
            csv_content=self.generate_csv_files(),
            json_data=self.generate_json(),
        )


def generate_report_package(
    scan_result: Optional[ScanResult] = None,
    check_result: Optional[CheckResult] = None,
    migration_plan: Optional[LFSMigrationPlan] = None,
    sandbox_execution: Optional[SandboxExecution] = None,
) -> ReportPackage:
    """生成报告包的便捷函数"""
    generator = ReportGenerator(
        scan_result=scan_result,
        check_result=check_result,
        migration_plan=migration_plan,
        sandbox_execution=sandbox_execution,
    )
    return generator.generate_report_package()


def generate_markdown_report(
    scan_result: Optional[ScanResult] = None,
    check_result: Optional[CheckResult] = None,
    migration_plan: Optional[LFSMigrationPlan] = None,
    sandbox_execution: Optional[SandboxExecution] = None,
) -> str:
    """生成 Markdown 报告的便捷函数"""
    generator = ReportGenerator(
        scan_result=scan_result,
        check_result=check_result,
        migration_plan=migration_plan,
        sandbox_execution=sandbox_execution,
    )
    return generator.generate_markdown()


def generate_csv_report(
    scan_result: Optional[ScanResult] = None,
    check_result: Optional[CheckResult] = None,
    migration_plan: Optional[LFSMigrationPlan] = None,
    sandbox_execution: Optional[SandboxExecution] = None,
) -> Dict[str, str]:
    """生成 CSV 报告的便捷函数"""
    generator = ReportGenerator(
        scan_result=scan_result,
        check_result=check_result,
        migration_plan=migration_plan,
        sandbox_execution=sandbox_execution,
    )
    return generator.generate_csv_files()


def generate_json_report(
    scan_result: Optional[ScanResult] = None,
    check_result: Optional[CheckResult] = None,
    migration_plan: Optional[LFSMigrationPlan] = None,
    sandbox_execution: Optional[SandboxExecution] = None,
) -> Dict[str, Any]:
    """生成 JSON 报告的便捷函数"""
    generator = ReportGenerator(
        scan_result=scan_result,
        check_result=check_result,
        migration_plan=migration_plan,
        sandbox_execution=sandbox_execution,
    )
    return generator.generate_json()
