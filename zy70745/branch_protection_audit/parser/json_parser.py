import json
from typing import Dict, List, Any
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


class JSONParser(BaseParser):
    def parse(self) -> ParseResult:
        result = ParseResult()

        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            if isinstance(data, dict):
                self._parse_dict(data, result)
            elif isinstance(data, list):
                for idx, item in enumerate(data):
                    location = SourceLocation(
                        file_path=self.file_path,
                        line_number=idx + 1,
                        raw_content=json.dumps(item, ensure_ascii=False),
                    )
                    self._parse_item(item, location, result)
        except json.JSONDecodeError as e:
            self._add_error(f"JSON解析失败: {str(e)}", SourceLocation(file_path=self.file_path))
        except Exception as e:
            self._add_error(f"文件解析失败: {str(e)}", SourceLocation(file_path=self.file_path))

        result.parse_errors = self.parse_errors
        return result

    def _parse_dict(self, data: Dict[str, Any], result: ParseResult):
        if "repositories" in data and isinstance(data["repositories"], list):
            for idx, item in enumerate(data["repositories"]):
                location = SourceLocation(
                    file_path=self.file_path,
                    line_number=idx + 1,
                    raw_content=json.dumps(item, ensure_ascii=False),
                )
                self._parse_repository(item, location, result)

        if "branch_rules" in data and isinstance(data["branch_rules"], list):
            for idx, item in enumerate(data["branch_rules"]):
                location = SourceLocation(
                    file_path=self.file_path,
                    line_number=idx + 1,
                    raw_content=json.dumps(item, ensure_ascii=False),
                )
                self._parse_branch_rule(item, location, result)

        if "exceptions" in data and isinstance(data["exceptions"], list):
            for idx, item in enumerate(data["exceptions"]):
                location = SourceLocation(
                    file_path=self.file_path,
                    line_number=idx + 1,
                    raw_content=json.dumps(item, ensure_ascii=False),
                )
                self._parse_exception(item, location, result)

        if "windows" in data and isinstance(data["windows"], list):
            for idx, item in enumerate(data["windows"]):
                location = SourceLocation(
                    file_path=self.file_path,
                    line_number=idx + 1,
                    raw_content=json.dumps(item, ensure_ascii=False),
                )
                self._parse_window(item, location, result)

        if "recoveries" in data and isinstance(data["recoveries"], list):
            for idx, item in enumerate(data["recoveries"]):
                location = SourceLocation(
                    file_path=self.file_path,
                    line_number=idx + 1,
                    raw_content=json.dumps(item, ensure_ascii=False),
                )
                self._parse_recovery(item, location, result)

    def _parse_item(self, item: Dict[str, Any], location: SourceLocation, result: ParseResult):
        try:
            record_type = item.get("record_type", item.get("type", "")).strip().upper()

            if record_type == "REPOSITORY" or "repository_name" in item:
                self._parse_repository(item, location, result)
            elif record_type == "BRANCH_RULE" or "branch_pattern" in item:
                self._parse_branch_rule(item, location, result)
            elif record_type == "EXCEPTION" or "applicant" in item:
                self._parse_exception(item, location, result)
            elif record_type == "WINDOW" or "start_time" in item:
                self._parse_window(item, location, result)
            elif record_type == "RECOVERY" or "recovered_by" in item:
                self._parse_recovery(item, location, result)
        except Exception as e:
            self._add_error(f"数据解析失败: {str(e)}", location, item)

    def _parse_repository(self, item: Dict[str, Any], location: SourceLocation, result: ParseResult):
        repo_id = item.get("repository_id", item.get("id", "")).strip()
        if not repo_id:
            repo_id = self._stable_id(self.file_path, location.line_number, "repo")

        repo = Repository(
            id=repo_id,
            name=item.get("repository_name", item.get("name", "未知仓库")).strip(),
            url=item.get("url"),
            source=location,
        )
        result.repositories.append(repo)

    def _parse_branch_rule(self, item: Dict[str, Any], location: SourceLocation, result: ParseResult):
        rule_id = item.get("rule_id", item.get("id", "")).strip()
        if not rule_id:
            rule_id = self._stable_id(self.file_path, location.line_number, "rule")

        rule = BranchRule(
            id=rule_id,
            repository_id=item.get("repository_id", "").strip(),
            branch_pattern=item.get("branch_pattern", "*").strip(),
            is_protected=self._parse_bool(item.get("is_protected", True)),
            created_at=self._parse_datetime(item.get("created_at")),
            updated_at=self._parse_datetime(item.get("updated_at")),
            source=location,
        )
        result.branch_rules.append(rule)

    def _parse_exception(self, item: Dict[str, Any], location: SourceLocation, result: ParseResult):
        exc_id = item.get("exception_id", item.get("id", "")).strip()
        if not exc_id:
            exc_id = self._stable_id(self.file_path, location.line_number, "exc")

        requested_at = self._parse_datetime(item.get("requested_at"))
        if not requested_at:
            self._add_error("缺少申请时间", location, item)
            return

        exception = ExceptionApplication(
            id=exc_id,
            repository_id=item.get("repository_id", "").strip(),
            branch_pattern=item.get("branch_pattern", "*").strip(),
            applicant=item.get("applicant", "未知申请人").strip(),
            approver=item.get("approver").strip() if item.get("approver") else None,
            reason=item.get("reason", "").strip(),
            requested_at=requested_at,
            status=item.get("status", "PENDING").strip(),
            source=location,
        )
        result.exceptions.append(exception)

    def _parse_window(self, item: Dict[str, Any], location: SourceLocation, result: ParseResult):
        window_id = item.get("window_id", item.get("id", "")).strip()
        if not window_id:
            window_id = self._stable_id(self.file_path, location.line_number, "window")

        start_time = self._parse_datetime(item.get("start_time"))
        end_time = self._parse_datetime(item.get("end_time"))

        if not start_time or not end_time:
            self._add_error("缺少窗口开始或结束时间", location, item)
            return

        window = ProtectionWindow(
            id=window_id,
            exception_id=item.get("exception_id", "").strip(),
            start_time=start_time,
            end_time=end_time,
            actual_end_time=self._parse_datetime(item.get("actual_end_time")),
            is_active=self._parse_bool(item.get("is_active", False)),
            source=location,
        )
        result.windows.append(window)

    def _parse_recovery(self, item: Dict[str, Any], location: SourceLocation, result: ParseResult):
        recovery_id = item.get("recovery_id", item.get("id", "")).strip()
        if not recovery_id:
            recovery_id = self._stable_id(self.file_path, location.line_number, "recovery")

        recovered_at = self._parse_datetime(item.get("recovered_at"))
        if not recovered_at:
            self._add_error("缺少恢复时间", location, item)
            return

        recovery = RecoveryAction(
            id=recovery_id,
            window_id=item.get("window_id", "").strip(),
            recovered_by=item.get("recovered_by", "未知操作人").strip(),
            recovered_at=recovered_at,
            recovery_method=item.get("recovery_method", "手动恢复").strip(),
            is_successful=self._parse_bool(item.get("is_successful", True)),
            source=location,
        )
        result.recoveries.append(recovery)
