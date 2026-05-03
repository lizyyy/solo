import json
from dataclasses import asdict, is_dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

from .models import CheckResult, Issue, Severity


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if is_dataclass(obj):
            return asdict(obj)
        if hasattr(obj, "value"):
            return obj.value
        return super().default(obj)


class Reporter:
    def generate_json_report(self, result: CheckResult, output_path: str) -> None:
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        data = self._result_to_dict(result)
        
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)
    
    def generate_markdown_report(self, result: CheckResult, output_path: str) -> None:
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        markdown = self._generate_markdown_content(result)
        
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(markdown)
    
    def _result_to_dict(self, result: CheckResult) -> dict[str, Any]:
        return {
            "summary": {
                "checked_at": result.checked_at.isoformat(),
                "package_path": result.package_path,
                "total_expenses": result.total_expenses,
                "total_attachments": result.total_attachments,
                "total_amount": result.total_amount,
                "error_count": len(result.errors),
                "warning_count": len(result.warnings),
                "has_errors": result.has_errors,
            },
            "errors": [self._issue_to_dict(issue) for issue in result.errors],
            "warnings": [self._issue_to_dict(issue) for issue in result.warnings],
            "issues": [self._issue_to_dict(issue) for issue in result.issues],
            "expenses": [self._expense_to_dict(e) for e in result.expenses],
            "attachments": [self._attachment_to_dict(a) for a in result.attachments],
        }
    
    def _issue_to_dict(self, issue: Issue) -> dict[str, Any]:
        return {
            "issue_type": issue.issue_type.value if hasattr(issue.issue_type, "value") else str(issue.issue_type),
            "severity": issue.severity.value if hasattr(issue.severity, "value") else str(issue.severity),
            "message": issue.message,
            "reference": issue.reference,
            "details": issue.details,
        }
    
    def _expense_to_dict(self, expense: Any) -> dict[str, Any]:
        if is_dataclass(expense):
            data = asdict(expense)
            if "date" in data and data["date"]:
                data["date"] = data["date"].isoformat() if hasattr(data["date"], "isoformat") else str(data["date"])
            return data
        return dict(expense) if hasattr(expense, "__dict__") else {}
    
    def _attachment_to_dict(self, attachment: Any) -> dict[str, Any]:
        if is_dataclass(attachment):
            data = asdict(attachment)
            if "last_modified" in data and data["last_modified"]:
                data["last_modified"] = data["last_modified"].isoformat() if hasattr(data["last_modified"], "isoformat") else str(data["last_modified"])
            return data
        return dict(attachment) if hasattr(attachment, "__dict__") else {}
    
    def _generate_markdown_content(self, result: CheckResult) -> str:
        lines: list[str] = []
        
        lines.append("# 报销材料包体检报告")
        lines.append("")
        
        status_icon = "❌" if result.has_errors else "⚠️" if result.warnings else "✅"
        status_text = "存在错误，需修复" if result.has_errors else "存在警告，建议检查" if result.warnings else "检查通过"
        lines.append(f"## 检查结果: {status_icon} {status_text}")
        lines.append("")
        
        lines.append("### 基本信息")
        lines.append("")
        lines.append(f"- **检查时间**: {result.checked_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"- **报销包路径**: {result.package_path}")
        lines.append(f"- **报销记录数**: {result.total_expenses} 条")
        lines.append(f"- **附件文件数**: {result.total_attachments} 个")
        lines.append(f"- **总金额**: ¥{result.total_amount:,.2f}")
        lines.append(f"- **错误数**: {len(result.errors)} 个")
        lines.append(f"- **警告数**: {len(result.warnings)} 个")
        lines.append("")
        
        if result.errors:
            lines.append("---")
            lines.append("")
            lines.append("## ❌ 错误列表")
            lines.append("")
            lines.append("| 序号 | 问题类型 | 消息 | 参考 |")
            lines.append("|------|----------|------|------|")
            for idx, issue in enumerate(result.errors, 1):
                issue_type = issue.issue_type.value if hasattr(issue.issue_type, "value") else str(issue.issue_type)
                ref = issue.reference or "-"
                lines.append(f"| {idx} | {issue_type} | {issue.message} | {ref} |")
            lines.append("")
        
        if result.warnings:
            lines.append("---")
            lines.append("")
            lines.append("## ⚠️ 警告列表")
            lines.append("")
            lines.append("| 序号 | 问题类型 | 消息 | 参考 |")
            lines.append("|------|----------|------|------|")
            for idx, issue in enumerate(result.warnings, 1):
                issue_type = issue.issue_type.value if hasattr(issue.issue_type, "value") else str(issue.issue_type)
                ref = issue.reference or "-"
                lines.append(f"| {idx} | {issue_type} | {issue.message} | {ref} |")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 📋 报销明细")
        lines.append("")
        lines.append("| 行号 | 报销ID | 发票号 | 金额 | 费用类型 | 日期 | 项目编号 |")
        lines.append("|------|--------|--------|------|----------|------|----------|")
        for expense in result.expenses:
            date_str = expense.date.strftime("%Y-%m-%d") if expense.date else "-"
            project_code = expense.project_code or "-"
            lines.append(
                f"| {expense.line_number} | {expense.expense_id} | {expense.invoice_number} | "
                f"¥{expense.amount:,.2f} | {expense.expense_type} | {date_str} | {project_code} |"
            )
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 📁 附件列表")
        lines.append("")
        lines.append("| 文件名 | 类型 | 大小 | 发票号 | 报销ID |")
        lines.append("|--------|------|------|--------|--------|")
        for att in result.attachments:
            size_kb = att.size / 1024
            inv_num = att.invoice_number or "-"
            exp_id = att.expense_id or "-"
            lines.append(
                f"| {att.filename} | {att.file_type} | {size_kb:.1f}KB | {inv_num} | {exp_id} |"
            )
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 📝 详细问题说明")
        lines.append("")
        
        for idx, issue in enumerate(result.issues, 1):
            severity_icon = "❌" if issue.severity == Severity.ERROR else "⚠️" if issue.severity == Severity.WARNING else "ℹ️"
            severity_text = "错误" if issue.severity == Severity.ERROR else "警告" if issue.severity == Severity.WARNING else "提示"
            issue_type = issue.issue_type.value if hasattr(issue.issue_type, "value") else str(issue.issue_type)
            
            lines.append(f"### {severity_icon} 问题 {idx}: {severity_text}")
            lines.append("")
            lines.append(f"- **类型**: {issue_type}")
            lines.append(f"- **消息**: {issue.message}")
            if issue.reference:
                lines.append(f"- **参考**: {issue.reference}")
            if issue.details:
                lines.append(f"- **详情**:")
                lines.append("  ```json")
                lines.append(f"  {json.dumps(issue.details, ensure_ascii=False, indent=2)}")
                lines.append("  ```")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由 expense-checker 工具自动生成*")
        lines.append(f"*生成时间: {result.checked_at.strftime('%Y-%m-%d %H:%M:%S')}*")
        lines.append("")
        
        return "\n".join(lines)
