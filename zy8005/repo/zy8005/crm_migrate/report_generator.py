import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from .validators import Severity, ValidationIssue, ValidationResult


class ReportGenerator:
    def __init__(self):
        pass
    
    def generate_json_report(
        self,
        validation_results: Dict[str, ValidationResult],
        table_data: Dict[str, List[Dict[str, Any]]],
        summary: Dict[str, Any],
    ) -> str:
        report_data: Dict[str, Any] = {
            "generated_at": datetime.now().isoformat(),
            "summary": summary,
            "tables": {},
            "issues": [],
        }
        
        for table_name, result in validation_results.items():
            table_info: Dict[str, Any] = {
                "name": table_name,
                "row_count": len(result.rows),
                "error_count": len(result.get_errors()),
                "warning_count": len(result.get_warnings()),
                "columns": list(set(
                    k for r in result.rows for k in r.keys() 
                    if not k.startswith("_")
                )),
            }
            report_data["tables"][table_name] = table_info
            
            for issue in result.issues:
                report_data["issues"].append(issue.to_dict())
        
        report_data["summary"]["total_rows"] = sum(
            len(result.rows) for result in validation_results.values()
        )
        
        return json.dumps(report_data, ensure_ascii=False, indent=2)
    
    def generate_markdown_report(
        self,
        validation_results: Dict[str, ValidationResult],
        table_data: Dict[str, List[Dict[str, Any]]],
        summary: Dict[str, Any],
    ) -> str:
        lines: List[str] = []
        
        lines.append("# CRM 数据迁移预检报告")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 摘要")
        lines.append("")
        
        status = summary.get("status", "unknown")
        status_icon = "✅" if status == "success" else ("⚠️" if status == "warning" else "❌")
        lines.append(f"**整体状态**: {status_icon} {status.upper()}")
        lines.append("")
        
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 处理的表数 | {summary.get('total_tables', 0)} |")
        lines.append(f"| 总记录数 | {summary.get('total_rows', 0)} |")
        lines.append(f"| 错误总数 | {summary.get('total_errors', 0)} |")
        lines.append(f"| 警告总数 | {summary.get('total_warnings', 0)} |")
        lines.append("")
        
        if summary.get("total_errors", 0) > 0:
            lines.append("### ⚠️ 重要提示")
            lines.append("")
            lines.append("> 预检发现 **阻断性错误**，默认情况下将不会生成迁移 SQL。")
            lines.append("> 如需强制生成草稿 SQL，请使用 `--force` 参数。")
            lines.append("")
        
        lines.append("## 各表情况")
        lines.append("")
        
        for table_name, result in validation_results.items():
            lines.append(f"### {table_name}")
            lines.append("")
            
            lines.append("| 项目 | 数值 |")
            lines.append("|------|------|")
            lines.append(f"| 记录数 | {len(result.rows)} |")
            lines.append(f"| 错误数 | {len(result.get_errors())} |")
            lines.append(f"| 警告数 | {len(result.get_warnings())} |")
            lines.append("")
            
            if result.issues:
                lines.append("#### 问题详情")
                lines.append("")
                
                errors = result.get_errors()
                if errors:
                    lines.append("**❌ 错误 (阻断迁移):**")
                    lines.append("")
                    for issue in errors[:20]:
                        lines.append(self._format_issue_md(issue))
                    if len(errors) > 20:
                        lines.append(f"... 还有 {len(errors) - 20} 个错误")
                    lines.append("")
                
                warnings = result.get_warnings()
                if warnings:
                    lines.append("**⚠️ 警告 (需人工确认):**")
                    lines.append("")
                    for issue in warnings[:20]:
                        lines.append(self._format_issue_md(issue))
                    if len(warnings) > 20:
                        lines.append(f"... 还有 {len(warnings) - 20} 个警告")
                    lines.append("")
        
        lines.append("## 规则说明")
        lines.append("")
        lines.append("| 规则 | 严重程度 | 说明 |")
        lines.append("|------|----------|------|")
        lines.append("| missing_mapping | ERROR/WARNING | 目标表字段缺少映射配置 |")
        lines.append("| required_field | ERROR | 必填字段缺失 |")
        lines.append("| type_check | ERROR | 字段类型不匹配 |")
        lines.append("| length_check | ERROR | 字段长度超限 |")
        lines.append("| enum_check | ERROR | 枚举值不在允许列表中 |")
        lines.append("| email_format | WARNING | 邮箱格式可能无效 |")
        lines.append("| phone_format | WARNING | 手机号格式可能无效 |")
        lines.append("| duplicate_natural_key | ERROR | 自然键重复 |")
        lines.append("| foreign_key | ERROR | 外键引用不存在 |")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由 crm-migrate-check 工具自动生成*")
        
        return "\n".join(lines)
    
    def _format_issue_md(self, issue: ValidationIssue) -> str:
        parts = []
        
        if issue.source_file:
            parts.append(f"文件: `{issue.source_file}`")
        if issue.row_num:
            parts.append(f"行号: {issue.row_num}")
        if issue.field_name:
            parts.append(f"字段: `{issue.field_name}`")
        
        location = " | ".join(parts) if parts else "N/A"
        value_str = f" (值: `{issue.value}`)" if issue.value is not None else ""
        
        return f"- {issue.message}{value_str}  \n  位置: {location}"
