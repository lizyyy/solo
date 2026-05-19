import json
from typing import List
from ..models.role import RoleResult
from .base_parser import CsvParser, JsonParser, ParseResult


class RoleResultParser(CsvParser[RoleResult]):
    def parse(self) -> ParseResult[RoleResult]:
        rows, total_lines = self._read_csv()
        items: List[RoleResult] = []

        for line_num, row in rows:
            try:
                user_id = row.get("user_id") or row.get("id")
                if not user_id:
                    self._add_error(line_num, "missing_id", "缺少用户ID字段", str(row))
                    continue

                actual_roles = []
                if "roles" in row and row["roles"]:
                    actual_roles = [r.strip() for r in row["roles"].split("|") if r.strip()]

                mapped_attributes = {}
                for key, value in row.items():
                    if key.startswith("attr_"):
                        attr_name = key[5:]
                        mapped_attributes[attr_name] = value

                success = row.get("success", "true").lower() != "false"
                error_message = row.get("error_message")

                item = RoleResult(
                    user_id=user_id,
                    actual_roles=actual_roles,
                    mapped_attributes=mapped_attributes,
                    source_file=str(self.file_path),
                    line_number=line_num,
                    timestamp=row.get("timestamp"),
                    success=success,
                    error_message=error_message,
                )
                items.append(item)
            except Exception as e:
                self._add_error(line_num, "parse_error", f"解析失败: {str(e)}", str(row))

        return ParseResult(
            items=items,
            errors=self.errors,
            file_path=str(self.file_path),
            total_lines=total_lines,
        )


class RoleResultJsonParser(JsonParser[RoleResult]):
    def parse(self) -> ParseResult[RoleResult]:
        data, total_lines = self._read_json()
        items: List[RoleResult] = []

        if data is None:
            return ParseResult(items=items, errors=self.errors, file_path=str(self.file_path))

        if not isinstance(data, list):
            self._add_error(0, "format_error", "JSON根节点必须是数组")
            return ParseResult(items=items, errors=self.errors, file_path=str(self.file_path))

        for line_num, row in enumerate(data, start=1):
            try:
                user_id = row.get("user_id") or row.get("id")
                if not user_id:
                    self._add_error(line_num, "missing_id", "缺少用户ID字段", str(row))
                    continue

                item = RoleResult(
                    user_id=user_id,
                    actual_roles=row.get("actual_roles", []),
                    mapped_attributes=row.get("mapped_attributes", {}),
                    source_file=str(self.file_path),
                    line_number=line_num,
                    timestamp=row.get("timestamp"),
                    success=row.get("success", True),
                    error_message=row.get("error_message"),
                )
                items.append(item)
            except Exception as e:
                self._add_error(line_num, "parse_error", f"解析失败: {str(e)}", str(row))

        return ParseResult(
            items=items,
            errors=self.errors,
            file_path=str(self.file_path),
            total_lines=total_lines,
        )
