import pandas as pd
from typing import Dict
from .base_parser import BaseParser
from ..models import (
    ParseResult,
    SourceLocation,
    Repository,
    BranchRule,
    ExceptionApplication,
    ProtectionWindow,
    RecoveryAction,
)


class ExcelParser(BaseParser):
    SHEET_MAPPING = {
        "仓库": "repositories",
        "repositories": "repositories",
        "分支规则": "branch_rules",
        "branch_rules": "branch_rules",
        "例外申请": "exceptions",
        "exceptions": "exceptions",
        "放开窗口": "windows",
        "windows": "windows",
        "恢复动作": "recoveries",
        "recoveries": "recoveries",
    }

    def parse(self) -> ParseResult:
        result = ParseResult()

        try:
            xls = pd.ExcelFile(self.file_path)
            for sheet_name in xls.sheet_names:
                sheet_type = self.SHEET_MAPPING.get(sheet_name.lower(), sheet_name)
                df = pd.read_excel(xls, sheet_name=sheet_name)
                self._parse_sheet(df, sheet_name, sheet_type, result)
        except Exception as e:
            self._add_error(f"Excel文件解析失败: {str(e)}", SourceLocation(file_path=self.file_path))

        result.parse_errors = self.parse_errors
        return result

    def _parse_sheet(self, df: pd.DataFrame, sheet_name: str, sheet_type: str, result: ParseResult):
        for row_idx, (_, row) in enumerate(df.iterrows(), start=2):
            raw_content = row.to_string()
            location = SourceLocation(
                file_path=self.file_path,
                sheet_name=sheet_name,
                row_index=row_idx,
                raw_content=raw_content,
            )

            try:
                row_dict = row.to_dict()
                if sheet_type == "repositories":
                    self._parse_repository(row_dict, location, result)
                elif sheet_type == "branch_rules":
                    self._parse_branch_rule(row_dict, location, result)
                elif sheet_type == "exceptions":
                    self._parse_exception(row_dict, location, result)
                elif sheet_type == "windows":
                    self._parse_window(row_dict, location, result)
                elif sheet_type == "recoveries":
                    self._parse_recovery(row_dict, location, result)
            except Exception as e:
                self._add_error(f"行解析失败: {str(e)}", location, row_dict)

    def _parse_repository(self, row: Dict, location: SourceLocation, result: ParseResult):
        repo_id = str(row.get("repository_id", row.get("id", ""))).strip()
        if not repo_id:
            repo_id = self._stable_id(self.file_path, location.sheet_name, location.row_index, "repo")

        repo = Repository(
            id=repo_id,
            name=str(row.get("repository_name", row.get("name", "未知仓库"))).strip(),
            url=str(row.get("url", "")).strip() if row.get("url") else None,
            source=location,
        )
        result.repositories.append(repo)

    def _parse_branch_rule(self, row: Dict, location: SourceLocation, result: ParseResult):
        rule_id = str(row.get("rule_id", row.get("id", ""))).strip()
        if not rule_id:
            rule_id = self._stable_id(self.file_path, location.sheet_name, location.row_index, "rule")

        rule = BranchRule(
            id=rule_id,
            repository_id=str(row.get("repository_id", "")).strip(),
            branch_pattern=str(row.get("branch_pattern", "*")).strip(),
            is_protected=self._parse_bool(row.get("is_protected", True)),
            created_at=self._parse_datetime(row.get("created_at")),
            updated_at=self._parse_datetime(row.get("updated_at")),
            source=location,
        )
        result.branch_rules.append(rule)

    def _parse_exception(self, row: Dict, location: SourceLocation, result: ParseResult):
        exc_id = str(row.get("exception_id", row.get("id", ""))).strip()
        if not exc_id:
            exc_id = self._stable_id(self.file_path, location.sheet_name, location.row_index, "exc")

        requested_at = self._parse_datetime(row.get("requested_at"))
        if not requested_at:
            self._add_error("缺少申请时间", location, row)
            return

        exception = ExceptionApplication(
            id=exc_id,
            repository_id=str(row.get("repository_id", "")).strip(),
            branch_pattern=str(row.get("branch_pattern", "*")).strip(),
            applicant=str(row.get("applicant", "未知申请人")).strip(),
            approver=str(row.get("approver", "")).strip() if row.get("approver") else None,
            reason=str(row.get("reason", "")).strip(),
            requested_at=requested_at,
            status=str(row.get("status", "PENDING")).strip(),
            source=location,
        )
        result.exceptions.append(exception)

    def _parse_window(self, row: Dict, location: SourceLocation, result: ParseResult):
        window_id = str(row.get("window_id", row.get("id", ""))).strip()
        if not window_id:
            window_id = self._stable_id(self.file_path, location.sheet_name, location.row_index, "window")

        start_time = self._parse_datetime(row.get("start_time"))
        end_time = self._parse_datetime(row.get("end_time"))

        if not start_time or not end_time:
            self._add_error("缺少窗口开始或结束时间", location, row)
            return

        window = ProtectionWindow(
            id=window_id,
            exception_id=str(row.get("exception_id", "")).strip(),
            start_time=start_time,
            end_time=end_time,
            actual_end_time=self._parse_datetime(row.get("actual_end_time")),
            is_active=self._parse_bool(row.get("is_active", False)),
            source=location,
        )
        result.windows.append(window)

    def _parse_recovery(self, row: Dict, location: SourceLocation, result: ParseResult):
        recovery_id = str(row.get("recovery_id", row.get("id", ""))).strip()
        if not recovery_id:
            recovery_id = self._stable_id(self.file_path, location.sheet_name, location.row_index, "recovery")

        recovered_at = self._parse_datetime(row.get("recovered_at"))
        if not recovered_at:
            self._add_error("缺少恢复时间", location, row)
            return

        recovery = RecoveryAction(
            id=recovery_id,
            window_id=str(row.get("window_id", "")).strip(),
            recovered_by=str(row.get("recovered_by", "未知操作人")).strip(),
            recovered_at=recovered_at,
            recovery_method=str(row.get("recovery_method", "手动恢复")).strip(),
            is_successful=self._parse_bool(row.get("is_successful", True)),
            source=location,
        )
        result.recoveries.append(recovery)
