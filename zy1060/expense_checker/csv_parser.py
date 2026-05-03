import csv
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

from .config import CheckerConfig
from .models import ExpenseItem, Issue, IssueType, Severity


class CSVParseError(Exception):
    pass


class CSVParser:
    REQUIRED_FIELDS = [
        "expense_id",
        "invoice_number",
        "amount",
        "expense_type",
    ]
    
    OPTIONAL_FIELDS = [
        "date",
        "project_code",
        "description",
        "attachment_requirements",
    ]
    
    def __init__(self, config: CheckerConfig):
        self.config = config
        self.issues: list[Issue] = []
    
    def parse(self, csv_path: Path) -> list[ExpenseItem]:
        self.issues = []
        
        if not csv_path.exists():
            self.issues.append(Issue(
                issue_type=IssueType.MISSING_CSV,
                severity=Severity.ERROR,
                message=f"找不到报销明细文件: {csv_path}",
                reference=str(csv_path),
            ))
            raise CSVParseError(f"CSV文件不存在: {csv_path}")
        
        try:
            with open(csv_path, "r", encoding="utf-8-sig") as f:
                content = f.read()
        except UnicodeDecodeError:
            try:
                with open(csv_path, "r", encoding="gbk") as f:
                    content = f.read()
            except Exception as e:
                self.issues.append(Issue(
                    issue_type=IssueType.INVALID_CSV,
                    severity=Severity.ERROR,
                    message=f"无法读取CSV文件，请检查编码格式: {e}",
                    reference=str(csv_path),
                ))
                raise CSVParseError(f"无法读取CSV文件: {e}")
        
        lines = content.splitlines()
        if not lines:
            self.issues.append(Issue(
                issue_type=IssueType.INVALID_CSV,
                severity=Severity.ERROR,
                message="CSV文件为空",
                reference=str(csv_path),
            ))
            raise CSVParseError("CSV文件为空")
        
        reader = csv.DictReader(lines)
        headers = reader.fieldnames or []
        
        missing_fields = [f for f in self.REQUIRED_FIELDS if f not in headers]
        if missing_fields:
            self.issues.append(Issue(
                issue_type=IssueType.INVALID_CSV,
                severity=Severity.ERROR,
                message=f"CSV缺少必需字段: {', '.join(missing_fields)}",
                reference=str(csv_path),
                details={"missing_fields": missing_fields, "available_fields": headers},
            ))
            raise CSVParseError(f"CSV缺少必需字段: {missing_fields}")
        
        expenses: list[ExpenseItem] = []
        
        for line_num, row in enumerate(reader, start=2):
            try:
                expense = self._parse_row(row, line_num)
                expenses.append(expense)
            except Exception as e:
                self.issues.append(Issue(
                    issue_type=IssueType.INVALID_CSV,
                    severity=Severity.ERROR,
                    message=f"第{line_num}行解析失败: {e}",
                    reference=str(csv_path),
                    details={"line_number": line_num, "row": row},
                ))
        
        return expenses
    
    def _parse_row(self, row: dict[str, Any], line_num: int) -> ExpenseItem:
        expense_id = str(row.get("expense_id", "")).strip()
        if not expense_id:
            raise ValueError("expense_id 不能为空")
        
        invoice_number = str(row.get("invoice_number", "")).strip()
        if not invoice_number:
            raise ValueError("invoice_number 不能为空")
        
        amount_str = str(row.get("amount", "")).strip()
        try:
            amount = float(amount_str.replace(",", ""))
        except ValueError:
            raise ValueError(f"金额格式无效: {amount_str}")
        
        expense_type = str(row.get("expense_type", "")).strip()
        if not expense_type:
            raise ValueError("expense_type 不能为空")
        
        date_val = self._parse_date(row.get("date"))
        project_code = str(row.get("project_code", "")).strip() or None
        description = str(row.get("description", "")).strip() or None
        
        attachment_requirements = []
        req_str = str(row.get("attachment_requirements", "")).strip()
        if req_str:
            attachment_requirements = [r.strip() for r in req_str.split(";") if r.strip()]
        
        return ExpenseItem(
            line_number=line_num,
            expense_id=expense_id,
            invoice_number=invoice_number,
            amount=amount,
            date=date_val,
            expense_type=expense_type,
            project_code=project_code,
            description=description,
            attachment_requirements=attachment_requirements,
            raw_data=row,
        )
    
    def _parse_date(self, date_str: Any) -> Optional[date]:
        if date_str is None:
            return None
        
        date_str = str(date_str).strip()
        if not date_str:
            return None
        
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y.%m.%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%Y%m%d",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        
        return None
    
    def get_issues(self) -> list[Issue]:
        return self.issues
