from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from .config import CheckerConfig
from .csv_parser import CSVParser
from .file_scanner import FileScanner
from .models import (
    AttachmentFile,
    CheckResult,
    ExpenseItem,
    Issue,
    IssueType,
    Severity,
)


class Validator:
    def __init__(self, config: CheckerConfig):
        self.config = config
    
    def validate(
        self,
        expenses: list[ExpenseItem],
        attachments: list[AttachmentFile],
        package_path: str = "",
    ) -> CheckResult:
        result = CheckResult(
            total_expenses=len(expenses),
            total_attachments=len(attachments),
            total_amount=sum(e.amount for e in expenses),
            expenses=expenses,
            attachments=attachments,
            package_path=package_path,
        )
        
        issues: list[Issue] = []
        
        if self.config.is_rule_enabled("invalid_expense_type"):
            issues.extend(self._check_expense_types(expenses))
        
        if self.config.is_rule_enabled("duplicate_invoice"):
            issues.extend(self._check_duplicate_invoices(expenses))
        
        if self.config.is_rule_enabled("amount_exceed_limit"):
            issues.extend(self._check_amount_limits(expenses))
        
        if self.config.is_rule_enabled("date_expired"):
            issues.extend(self._check_expired_dates(expenses))
        
        if self.config.is_rule_enabled("missing_attachment"):
            issues.extend(self._check_missing_attachments(expenses, attachments))
        
        if self.config.is_rule_enabled("missing_contract"):
            issues.extend(self._check_required_attachments(expenses, attachments, "合同"))
        
        if self.config.is_rule_enabled("missing_acceptance"):
            issues.extend(self._check_required_attachments(expenses, attachments, "验收单"))
        
        if self.config.is_rule_enabled("invalid_filename"):
            issues.extend(self._check_filenames(attachments))
        
        result.issues = issues
        return result
    
    def _check_expense_types(self, expenses: list[ExpenseItem]) -> list[Issue]:
        issues: list[Issue] = []
        allowed_types = set(self.config.allowed_expense_types)
        
        for expense in expenses:
            if expense.expense_type not in allowed_types:
                severity = self.config.get_rule_severity("invalid_expense_type")
                issues.append(Issue(
                    issue_type=IssueType.INVALID_EXPENSE_TYPE,
                    severity=severity,
                    message=f"费用类型不合法: '{expense.expense_type}'，不在允许列表中",
                    reference=expense.expense_id,
                    details={
                        "expense_id": expense.expense_id,
                        "expense_type": expense.expense_type,
                        "allowed_types": list(allowed_types),
                        "line_number": expense.line_number,
                    },
                ))
        
        return issues
    
    def _check_duplicate_invoices(self, expenses: list[ExpenseItem]) -> list[Issue]:
        issues: list[Issue] = []
        invoice_map: dict[str, list[ExpenseItem]] = defaultdict(list)
        
        for expense in expenses:
            if expense.invoice_number:
                invoice_map[expense.invoice_number].append(expense)
        
        for invoice_num, expense_list in invoice_map.items():
            if len(expense_list) > 1:
                severity = self.config.get_rule_severity("duplicate_invoice")
                expense_ids = [e.expense_id for e in expense_list]
                amounts = [e.amount for e in expense_list]
                issues.append(Issue(
                    issue_type=IssueType.DUPLICATE_INVOICE,
                    severity=severity,
                    message=f"发票号重复: {invoice_num}，出现在 {len(expense_list)} 条记录中",
                    reference=invoice_num,
                    details={
                        "invoice_number": invoice_num,
                        "expense_ids": expense_ids,
                        "amounts": amounts,
                        "line_numbers": [e.line_number for e in expense_list],
                    },
                ))
        
        return issues
    
    def _check_amount_limits(self, expenses: list[ExpenseItem]) -> list[Issue]:
        issues: list[Issue] = []
        max_amount = self.config.max_single_amount
        
        for expense in expenses:
            if expense.amount > max_amount:
                severity = self.config.get_rule_severity("amount_exceed_limit")
                issues.append(Issue(
                    issue_type=IssueType.AMOUNT_EXCEED_LIMIT,
                    severity=severity,
                    message=f"单笔金额超限: {expense.amount} 元，超过上限 {max_amount} 元",
                    reference=expense.expense_id,
                    details={
                        "expense_id": expense.expense_id,
                        "amount": expense.amount,
                        "max_amount": max_amount,
                        "line_number": expense.line_number,
                    },
                ))
        
        return issues
    
    def _check_expired_dates(self, expenses: list[ExpenseItem]) -> list[Issue]:
        issues: list[Issue] = []
        max_days = self.config.reimbursement_days
        today = date.today()
        
        for expense in expenses:
            if expense.date:
                days_diff = (today - expense.date).days
                if days_diff > max_days:
                    severity = self.config.get_rule_severity("date_expired")
                    issues.append(Issue(
                        issue_type=IssueType.DATE_EXPIRED,
                        severity=severity,
                        message=f"发票日期超期: {expense.date}，距今天 {days_diff} 天，超过允许的 {max_days} 天",
                        reference=expense.expense_id,
                        details={
                            "expense_id": expense.expense_id,
                            "invoice_date": expense.date.isoformat(),
                            "days_since": days_diff,
                            "max_days": max_days,
                            "line_number": expense.line_number,
                        },
                    ))
        
        return issues
    
    def _check_missing_attachments(self, expenses: list[ExpenseItem], attachments: list[AttachmentFile]) -> list[Issue]:
        issues: list[Issue] = []
        
        invoice_to_attachments: dict[str, list[AttachmentFile]] = defaultdict(list)
        for att in attachments:
            if att.invoice_number:
                invoice_to_attachments[att.invoice_number].append(att)
        
        for expense in expenses:
            found_attachments = invoice_to_attachments.get(expense.invoice_number, [])
            
            if not found_attachments:
                severity = self.config.get_rule_severity("missing_attachment")
                issues.append(Issue(
                    issue_type=IssueType.MISSING_ATTACHMENT,
                    severity=severity,
                    message=f"缺少附件: 发票号 {expense.invoice_number} 未找到对应的附件文件",
                    reference=expense.expense_id,
                    details={
                        "expense_id": expense.expense_id,
                        "invoice_number": expense.invoice_number,
                        "amount": expense.amount,
                        "line_number": expense.line_number,
                    },
                ))
        
        return issues
    
    def _check_required_attachments(
        self,
        expenses: list[ExpenseItem],
        attachments: list[AttachmentFile],
        required_type: str,
    ) -> list[Issue]:
        issues: list[Issue] = []
        
        required_config = self.config.required_attachment_types
        invoice_to_attachments: dict[str, list[AttachmentFile]] = defaultdict(list)
        for att in attachments:
            if att.invoice_number:
                invoice_to_attachments[att.invoice_number].append(att)
        
        for expense in expenses:
            expense_types = [expense.expense_type]
            if expense.attachment_requirements:
                expense_types = expense.attachment_requirements
            
            needs_required = False
            for et in expense_types:
                if et in required_config and required_type in required_config[et]:
                    needs_required = True
                    break
            
            if not needs_required:
                continue
            
            found_attachments = invoice_to_attachments.get(expense.invoice_number, [])
            
            has_required = False
            for att in found_attachments:
                filename_lower = att.filename.lower()
                if required_type == "合同":
                    if "合同" in att.filename or "contract" in filename_lower or "ht_" in filename_lower:
                        has_required = True
                        break
                elif required_type == "验收单":
                    if "验收" in att.filename or "acceptance" in filename_lower or "ys_" in filename_lower:
                        has_required = True
                        break
            
            if not has_required:
                issue_type = IssueType.MISSING_CONTRACT if required_type == "合同" else IssueType.MISSING_ACCEPTANCE
                severity = self.config.get_rule_severity(issue_type.value)
                issues.append(Issue(
                    issue_type=issue_type,
                    severity=severity,
                    message=f"缺少{required_type}: 费用类型 '{expense.expense_type}' 需要{required_type}附件",
                    reference=expense.expense_id,
                    details={
                        "expense_id": expense.expense_id,
                        "invoice_number": expense.invoice_number,
                        "expense_type": expense.expense_type,
                        "required_type": required_type,
                        "line_number": expense.line_number,
                    },
                ))
        
        return issues
    
    def _check_filenames(self, attachments: list[AttachmentFile]) -> list[Issue]:
        issues: list[Issue] = []
        patterns = self.config.filename_patterns
        
        for att in attachments:
            if att.filename.lower() == "expenses.csv":
                continue
            
            matches_any = False
            for pattern_name, pattern in patterns.items():
                import re
                if re.search(pattern, att.filename, re.IGNORECASE):
                    matches_any = True
                    break
            
            if not matches_any and not att.invoice_number:
                severity = self.config.get_rule_severity("invalid_filename")
                issues.append(Issue(
                    issue_type=IssueType.INVALID_FILENAME,
                    severity=severity,
                    message=f"文件名不规范: '{att.filename}' 未识别出发票号或报销单号",
                    reference=att.filename,
                    details={
                        "filename": att.filename,
                        "full_path": att.full_path,
                        "size": att.size,
                    },
                ))
        
        return issues
