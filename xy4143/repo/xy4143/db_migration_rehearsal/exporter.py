import csv
import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from db_migration_rehearsal.config import Config
from db_migration_rehearsal.schema_diff import SchemaDiffResult


class MarkdownExporter:
    
    def __init__(self, config: Config):
        self.config = config
    
    def export(
        self,
        output_path: Path,
        check_results: Optional[Dict[str, Any]] = None,
        diff_result: Optional[SchemaDiffResult] = None,
        execution_results: Optional[List[Dict[str, Any]]] = None,
        include_details: bool = True,
    ) -> str:
        lines: List[str] = []
        
        lines.append("# 数据库迁移彩排报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        if check_results:
            lines.extend(self._generate_checks_section(check_results, include_details))
        
        if diff_result:
            lines.extend(self._generate_diff_section(diff_result, include_details))
        
        if execution_results:
            lines.extend(self._generate_execution_section(execution_results, include_details))
        
        content = "\n".join(lines)
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        return str(output_path)
    
    def _generate_checks_section(
        self,
        check_results: Dict[str, Any],
        include_details: bool,
    ) -> List[str]:
        lines: List[str] = []
        
        lines.append("## 规则检查结果")
        lines.append("")
        
        summary = check_results.get("summary", {})
        errors = summary.get("errors", 0)
        warnings = summary.get("warnings", 0)
        infos = summary.get("infos", 0)
        
        lines.append("### 摘要")
        lines.append("")
        lines.append("| 严重程度 | 数量 |")
        lines.append("|----------|------|")
        lines.append(f"| 🔴 错误 | {errors} |")
        lines.append(f"| 🟡 警告 | {warnings} |")
        lines.append(f"| ℹ️ 信息 | {infos} |")
        lines.append("")
        
        issues = check_results.get("issues", [])
        
        if issues and include_details:
            lines.append("### 详细问题")
            lines.append("")
            
            for issue in issues:
                severity = issue.get("severity", "unknown")
                severity_icon = {
                    "error": "🔴",
                    "warning": "🟡",
                    "info": "ℹ️",
                }.get(severity, "❓")
                
                lines.append(f"#### {severity_icon} {issue.get('rule_name', '未知规则')}")
                lines.append("")
                lines.append(f"- **迁移文件**: `{issue.get('migration_file', 'N/A')}`")
                lines.append(f"- **版本**: {issue.get('migration_version', 'N/A')}")
                lines.append(f"- **描述**: {issue.get('description', 'N/A')}")
                
                if issue.get("suggestion"):
                    lines.append(f"- **建议**: {issue.get('suggestion')}")
                
                location = issue.get("location")
                if location:
                    lines.append(f"- **位置**: {json.dumps(location, ensure_ascii=False)}")
                
                lines.append("")
        
        return lines
    
    def _generate_diff_section(
        self,
        diff_result: SchemaDiffResult,
        include_details: bool,
    ) -> List[str]:
        lines: List[str] = []
        
        lines.append("## Schema 差异")
        lines.append("")
        
        if not diff_result.has_changes:
            lines.append("✅ 没有检测到 Schema 变更")
            lines.append("")
            return lines
        
        summary = diff_result.get_summary()
        
        lines.append("### 变更摘要")
        lines.append("")
        lines.append("| 变更类型 | 数量 |")
        lines.append("|----------|------|")
        lines.append(f"| 新增表 | {summary.get('tables_added', 0)} |")
        lines.append(f"| 删除表 | {summary.get('tables_removed', 0)} |")
        lines.append(f"| 修改表 | {summary.get('tables_modified', 0)} |")
        lines.append(f"| 新增列 | {summary.get('columns_added', 0)} |")
        lines.append(f"| 删除列 | {summary.get('columns_removed', 0)} |")
        lines.append(f"| 修改列 | {summary.get('columns_modified', 0)} |")
        lines.append(f"| 新增索引 | {summary.get('indexes_added', 0)} |")
        lines.append(f"| 删除索引 | {summary.get('indexes_removed', 0)} |")
        lines.append("")
        
        if include_details:
            if diff_result.tables_added:
                lines.append("### 新增表")
                lines.append("")
                for table in diff_result.tables_added:
                    lines.append(f"- `{table.name}`")
                lines.append("")
            
            if diff_result.tables_removed:
                lines.append("### ⚠️ 删除表")
                lines.append("")
                for table in diff_result.tables_removed:
                    lines.append(f"- `{table.name}`")
                lines.append("")
            
            if diff_result.tables_modified:
                lines.append("### 修改表")
                lines.append("")
                for table in diff_result.tables_modified:
                    lines.append(f"#### `{table.name}`")
                    lines.append("")
                    
                    if table.columns_added:
                        lines.append("**新增列**:")
                        for col in table.columns_added:
                            lines.append(f"- `{col.name}`")
                    
                    if table.columns_removed:
                        lines.append("**删除列**:")
                        for col in table.columns_removed:
                            lines.append(f"- `{col.name}`")
                    
                    if table.columns_modified:
                        lines.append("**修改列**:")
                        for col in table.columns_modified:
                            changes = ", ".join(
                                f"{k}: {v[0]} -> {v[1]}"
                                for k, v in col.properties_changed.items()
                            )
                            lines.append(f"- `{col.name}`: {changes}")
                    
                    lines.append("")
        
        return lines
    
    def _generate_execution_section(
        self,
        execution_results: List[Dict[str, Any]],
        include_details: bool,
    ) -> List[str]:
        lines: List[str] = []
        
        lines.append("## 执行结果")
        lines.append("")
        
        success_count = sum(1 for r in execution_results if r.get("success"))
        total_count = len(execution_results)
        
        lines.append(f"**执行结果**: {success_count}/{total_count} 成功")
        lines.append("")
        
        if include_details:
            lines.append("### 详细执行日志")
            lines.append("")
            lines.append("| 版本 | 文件 | 状态 | 耗时 (ms) |")
            lines.append("|------|------|------|----------|")
            
            for result in execution_results:
                status = "✅ 成功" if result.get("success") else "❌ 失败"
                lines.append(
                    f"| {result.get('migration_version', 'N/A')} | "
                    f"`{result.get('migration_file', 'N/A')}` | "
                    f"{status} | "
                    f"{result.get('execution_time_ms', 0):.2f} |"
                )
            
            lines.append("")
            
            failed_results = [r for r in execution_results if not r.get("success")]
            if failed_results:
                lines.append("### 失败详情")
                lines.append("")
                
                for result in failed_results:
                    lines.append(f"#### `{result.get('migration_file', 'N/A')}`")
                    lines.append("")
                    lines.append(f"**错误**: {result.get('error_message', '未知错误')}")
                    lines.append("")
        
        return lines


class CSVExporter:
    
    def __init__(self, config: Config):
        self.config = config
    
    def export_issues(
        self,
        issues: List[Dict[str, Any]],
        output_path: Path,
    ) -> str:
        if not issues:
            return ""
        
        fieldnames = [
            "severity",
            "rule_id",
            "rule_name",
            "migration_version",
            "migration_file",
            "description",
            "suggestion",
        ]
        
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for issue in issues:
                row = {
                    "severity": issue.get("severity", ""),
                    "rule_id": issue.get("rule_id", ""),
                    "rule_name": issue.get("rule_name", ""),
                    "migration_version": issue.get("migration_version", ""),
                    "migration_file": issue.get("migration_file", ""),
                    "description": issue.get("description", ""),
                    "suggestion": issue.get("suggestion", ""),
                }
                writer.writerow(row)
        
        return str(output_path)
    
    def export_changes(
        self,
        diff_result: SchemaDiffResult,
        output_path: Path,
    ) -> str:
        fieldnames = [
            "change_type",
            "object_type",
            "table_name",
            "name",
            "details",
        ]
        
        rows: List[Dict[str, Any]] = []
        
        for table in diff_result.tables_added:
            rows.append({
                "change_type": "added",
                "object_type": "table",
                "table_name": table.name,
                "name": table.name,
                "details": "新增表",
            })
        
        for table in diff_result.tables_removed:
            rows.append({
                "change_type": "removed",
                "object_type": "table",
                "table_name": table.name,
                "name": table.name,
                "details": "删除表",
            })
        
        for col in diff_result.columns_added:
            rows.append({
                "change_type": "added",
                "object_type": "column",
                "table_name": col.table_name,
                "name": col.name,
                "details": "新增列",
            })
        
        for col in diff_result.columns_removed:
            rows.append({
                "change_type": "removed",
                "object_type": "column",
                "table_name": col.table_name,
                "name": col.name,
                "details": "删除列",
            })
        
        for col in diff_result.columns_modified:
            changes = ", ".join(
                f"{k}: {v[0]}->{v[1]}" for k, v in col.properties_changed.items()
            )
            rows.append({
                "change_type": "modified",
                "object_type": "column",
                "table_name": col.table_name,
                "name": col.name,
                "details": changes,
            })
        
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for row in rows:
                writer.writerow(row)
        
        return str(output_path)


class JSONExporter:
    
    def __init__(self, config: Config):
        self.config = config
    
    def export(
        self,
        output_path: Path,
        check_results: Optional[Dict[str, Any]] = None,
        diff_result: Optional[SchemaDiffResult] = None,
        execution_results: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        data: Dict[str, Any] = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "project_name": self.config.project_name,
            },
        }
        
        if check_results:
            data["check_results"] = check_results
        
        if diff_result:
            data["schema_diff"] = diff_result.to_dict()
        
        if execution_results:
            data["execution_results"] = execution_results
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        
        return str(output_path)


class Exporter:
    
    def __init__(self, config: Config):
        self.config = config
        self.markdown_exporter = MarkdownExporter(config)
        self.csv_exporter = CSVExporter(config)
        self.json_exporter = JSONExporter(config)
    
    def _load_latest_results(self) -> Dict[str, Any]:
        output_dir = Path(self.config.output_dir)
        
        results: Dict[str, Any] = {}
        
        quarantine_file = output_dir / "quarantine.json"
        if quarantine_file.exists():
            with open(quarantine_file, "r", encoding="utf-8") as f:
                results["check_results"] = json.load(f)
        
        dry_run_files = sorted(output_dir.glob("dry_run_*.json"))
        if dry_run_files:
            latest = dry_run_files[-1]
            with open(latest, "r", encoding="utf-8") as f:
                dry_run_data = json.load(f)
                results["execution_results"] = dry_run_data.get("execution_results")
        
        return results
    
    def export_markdown(
        self,
        output_dir: str,
        include_details: bool = True,
    ) -> str:
        output_path = Path(output_dir) / "migration_report.md"
        
        results = self._load_latest_results()
        
        return self.markdown_exporter.export(
            output_path=output_path,
            check_results=results.get("check_results"),
            execution_results=results.get("execution_results"),
            include_details=include_details,
        )
    
    def export_csv(
        self,
        output_dir: str,
    ) -> List[str]:
        generated: List[str] = []
        
        output_path = Path(output_dir)
        
        results = self._load_latest_results()
        
        check_results = results.get("check_results")
        if check_results and check_results.get("issues"):
            issues_path = output_path / "issues.csv"
            path = self.csv_exporter.export_issues(
                issues=check_results["issues"],
                output_path=issues_path,
            )
            if path:
                generated.append(path)
        
        return generated
    
    def export_json(
        self,
        output_dir: str,
    ) -> str:
        output_path = Path(output_dir) / "audit_package.json"
        
        results = self._load_latest_results()
        
        return self.json_exporter.export(
            output_path=output_path,
            check_results=results.get("check_results"),
            execution_results=results.get("execution_results"),
        )
