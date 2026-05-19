import csv
from typing import List
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


class CSVParser(BaseParser):
    def parse(self) -> ParseResult:
        result = ParseResult()

        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row_idx, row in enumerate(reader, start=2):
                    raw_content = ",".join(f"{k}={v}" for k, v in row.items())
                    location = SourceLocation(
                        file_path=self.file_path,
                        line_number=row_idx,
                        raw_content=raw_content,
                    )
                    self._parse_row(row, location, result)
        except Exception as e:
            self._add_error(f"文件解析失败: {str(e)}", SourceLocation(file_path=self.file_path))

        result.parse_errors = self.parse_errors
        return result

    def _parse_row(self, row: dict, location: SourceLocation, result: ParseResult):
        try:
            record_type = row.get("record_type", row.get("type", "")).strip().upper()

            if record_type:
                if record_type == "EXCEPTION":
                    self._parse_exception(row, location, result)
                elif record_type == "REPOSITORY":
                    self._parse_repository(row, location, result)
                elif record_type == "BRANCH_RULE":
                    self._parse_branch_rule(row, location, result)
                elif record_type == "WINDOW":
                    self._parse_window(row, location, result)
                elif record_type == "RECOVERY":
                    self._parse_recovery(row, location, result)
            else:
                if "applicant" in row and row["applicant"]:
                    self._parse_exception(row, location, result)
                elif "recovered_by" in row and row["recovered_by"]:
                    self._parse_recovery(row, location, result)
                elif "start_time" in row and row["start_time"]:
                    self._parse_window(row, location, result)
                elif "branch_pattern" in row and row["branch_pattern"]:
                    self._parse_branch_rule(row, location, result)
                elif "repository_name" in row and row["repository_name"]:
                    self._parse_repository(row, location, result)
        except Exception as e:
            self._add_error(f"行解析失败: {str(e)}", location, row)

    def _parse_repository(self, row: dict, location: SourceLocation, result: ParseResult):
        repo_id = row.get("repository_id", row.get("id", ""))
        if not repo_id:
            repo_id = self._stable_id(self.file_path, location.line_number, "repo")

        repo = Repository(
            id=repo_id,
            name=row.get("repository_name", row.get("name", "未知仓库")),
            url=row.get("url"),
            source=location,
        )
        result.repositories.append(repo)

    def _parse_branch_rule(self, row: dict, location: SourceLocation, result: ParseResult):
        rule_id = row.get("rule_id", row.get("id", ""))
        if not rule_id:
            rule_id = self._stable_id(self.file_path, location.line_number, "rule")

        rule = BranchRule(
            id=rule_id,
            repository_id=row.get("repository_id", ""),
            branch_pattern=row.get("branch_pattern", "*"),
            is_protected=self._parse_bool(row.get("is_protected", True)),
            created_at=self._parse_datetime(row.get("created_at")),
            updated_at=self._parse_datetime(row.get("updated_at")),
            source=location,
        )
        result.branch_rules.append(rule)

    def _parse_exception(self, row: dict, location: SourceLocation, result: ParseResult):
        exc_id = row.get("exception_id", row.get("id", ""))
        if not exc_id:
            exc_id = self._stable_id(self.file_path, location.line_number, "exc")

        requested_at = self._parse_datetime(row.get("requested_at"))
        if not requested_at:
            self._add_error("缺少申请时间", location, row)
            return

        exception = ExceptionApplication(
            id=exc_id,
            repository_id=row.get("repository_id", ""),
            branch_pattern=row.get("branch_pattern", "*"),
            applicant=row.get("applicant", "未知申请人"),
            approver=row.get("approver"),
            reason=row.get("reason", ""),
            requested_at=requested_at,
            status=row.get("status", "PENDING"),
            source=location,
        )
        result.exceptions.append(exception)

    def _parse_window(self, row: dict, location: SourceLocation, result: ParseResult):
        window_id = row.get("window_id", row.get("id", ""))
        if not window_id:
            window_id = self._stable_id(self.file_path, location.line_number, "window")

        start_time = self._parse_datetime(row.get("start_time"))
        end_time = self._parse_datetime(row.get("end_time"))

        if not start_time or not end_time:
            self._add_error("缺少窗口开始或结束时间", location, row)
            return

        window = ProtectionWindow(
            id=window_id,
            exception_id=row.get("exception_id", ""),
            start_time=start_time,
            end_time=end_time,
            actual_end_time=self._parse_datetime(row.get("actual_end_time")),
            is_active=self._parse_bool(row.get("is_active", False)),
            source=location,
        )
        result.windows.append(window)

    def _parse_recovery(self, row: dict, location: SourceLocation, result: ParseResult):
        recovery_id = row.get("recovery_id", row.get("id", ""))
        if not recovery_id:
            recovery_id = self._stable_id(self.file_path, location.line_number, "recovery")

        recovered_at = self._parse_datetime(row.get("recovered_at"))
        if not recovered_at:
            self._add_error("缺少恢复时间", location, row)
            return

        recovery = RecoveryAction(
            id=recovery_id,
            window_id=row.get("window_id", ""),
            recovered_by=row.get("recovered_by", "未知操作人"),
            recovered_at=recovered_at,
            recovery_method=row.get("recovery_method", "手动恢复"),
            is_successful=self._parse_bool(row.get("is_successful", True)),
            source=location,
        )
        result.recoveries.append(recovery)
