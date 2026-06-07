import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from ..utils.mask import PHONE_PATTERN, ID_CARD_PATTERN, BANK_CARD_PATTERN, EMAIL_PATTERN


@dataclass
class AuditIssue:
    file_path: str
    line_number: Optional[int]
    issue_type: str
    sensitive_value: str
    masked_value: str
    field_context: str
    severity: str


@dataclass
class AuditResult:
    passed: bool
    file_path: str
    issues: List[AuditIssue] = field(default_factory=list)
    total_checks: int = 0
    issue_count: int = 0
    scan_time: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "file_path": self.file_path,
            "total_checks": self.total_checks,
            "issue_count": self.issue_count,
            "scan_time": self.scan_time,
            "issues": [
                {
                    "file_path": i.file_path,
                    "line_number": i.line_number,
                    "issue_type": i.issue_type,
                    "sensitive_value": i.masked_value,
                    "field_context": i.field_context,
                    "severity": i.severity,
                }
                for i in self.issues
            ],
        }


class AuditChecker:
    def __init__(self):
        self.patterns = {
            "phone": (PHONE_PATTERN, "手机号"),
            "id_card": (ID_CARD_PATTERN, "身份证号"),
            "bank_card": (BANK_CARD_PATTERN, "银行卡号"),
            "email": (EMAIL_PATTERN, "邮箱地址"),
        }

    def audit_file(self, file_path: str) -> AuditResult:
        from datetime import datetime
        path = Path(file_path)
        result = AuditResult(
            passed=True,
            file_path=str(path),
            scan_time=datetime.now().isoformat(),
        )

        if not path.exists():
            result.passed = False
            return result

        suffix = path.suffix.lower()
        if suffix == ".json":
            result = self._audit_json(path, result)
        elif suffix in [".txt", ".log", ".md", ".csv"]:
            result = self._audit_text(path, result)
        else:
            result = self._audit_text(path, result)

        result.issue_count = len(result.issues)
        result.passed = result.issue_count == 0
        return result

    def _audit_json(self, path: Path, result: AuditResult) -> AuditResult:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            result.total_checks += 1
            self._scan_json_value(data, "", result, str(path))
        except json.JSONDecodeError:
            result = self._audit_text(path, result)
        return result

    def _scan_json_value(self, value: Any, path: str, result: AuditResult, file_path: str):
        if isinstance(value, str):
            self._check_text(value, path, result, file_path)
        elif isinstance(value, dict):
            for k, v in value.items():
                new_path = f"{path}.{k}" if path else k
                self._scan_json_value(v, new_path, result, file_path)
        elif isinstance(value, list):
            for idx, item in enumerate(value):
                new_path = f"{path}[{idx}]"
                self._scan_json_value(item, new_path, result, file_path)

    def _audit_text(self, path: Path, result: AuditResult) -> AuditResult:
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        for line_num, line in enumerate(lines, 1):
            result.total_checks += 1
            self._check_text(line, f"line {line_num}", result, str(path), line_num)

        return result

    def _check_text(self, text: str, context: str, result: AuditResult, file_path: str, line_num: Optional[int] = None):
        if not text:
            return

        for pattern_name, (pattern, type_name) in self.patterns.items():
            matches = pattern.findall(text)
            for match in matches:
                if isinstance(match, tuple):
                    match = match[0]
                if not self._is_already_masked(match, pattern_name):
                    masked = self._mask_value(match, pattern_name)
                    issue = AuditIssue(
                        file_path=file_path,
                        line_number=line_num,
                        issue_type=type_name,
                        sensitive_value=match,
                        masked_value=masked,
                        field_context=context,
                        severity="high" if pattern_name in ["phone", "id_card", "bank_card"] else "medium",
                    )
                    result.issues.append(issue)

    def _is_already_masked(self, value: str, pattern_name: str) -> bool:
        if "*" in value or "x" in value.lower() or "X" in value:
            return True
        if pattern_name == "phone" and value.count("*") >= 4:
            return True
        return False

    def _mask_value(self, value: str, pattern_name: str) -> str:
        from ..utils.mask import mask_phone, mask_id_card, mask_bank_card, mask_email
        if pattern_name == "phone":
            return mask_phone(value)
        elif pattern_name == "id_card":
            return mask_id_card(value)
        elif pattern_name == "bank_card":
            return mask_bank_card(value)
        elif pattern_name == "email":
            return mask_email(value)
        return value

    def audit_directory(self, dir_path: str) -> List[AuditResult]:
        results = []
        dir_path = Path(dir_path)
        for path in dir_path.rglob("*"):
            if path.is_file() and path.suffix.lower() in [".json", ".txt", ".log", ".md", ".csv"]:
                result = self.audit_file(str(path))
                results.append(result)
        return results

    def generate_audit_report(self, results: List[AuditResult]) -> str:
        total_files = len(results)
        passed_files = sum(1 for r in results if r.passed)
        total_issues = sum(r.issue_count for r in results)

        lines = []
        lines.append("=" * 70)
        lines.append("脱敏复查审计报告")
        lines.append("=" * 70)
        lines.append("")
        lines.append(f"检查文件数: {total_files}")
        lines.append(f"通过文件数: {passed_files}")
        lines.append(f"未通过文件数: {total_files - passed_files}")
        lines.append(f"总问题数: {total_issues}")
        lines.append("")

        if total_issues > 0:
            lines.append("-" * 70)
            lines.append("问题明细 (原始值已脱敏):")
            lines.append("-" * 70)
            for result in results:
                if result.issues:
                    lines.append("")
                    lines.append(f"📄 {result.file_path}:")
                    for issue in result.issues:
                        loc = f"第{issue.line_number}行" if issue.line_number else issue.field_context
                        lines.append(f"   [{issue.severity.upper()}] {issue.issue_type} @ {loc}")
                        lines.append(f"       发现值: {issue.masked_value}")
        else:
            lines.append("✅ 所有文件脱敏检查通过，未发现原始敏感数据")

        lines.append("")
        lines.append("=" * 70)
        return "\n".join(lines)
