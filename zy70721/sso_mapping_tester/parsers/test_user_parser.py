import json
from typing import List
from ..models.user import TestUser
from .base_parser import CsvParser, JsonParser, ParseResult


class TestUserParser(CsvParser[TestUser]):
    def parse(self) -> ParseResult[TestUser]:
        rows, total_lines = self._read_csv()
        items: List[TestUser] = []

        for line_num, row in rows:
            try:
                user_id = row.get("user_id") or row.get("id")
                if not user_id:
                    self._add_error(line_num, "missing_id", "缺少用户ID字段", str(row))
                    continue

                expected_attributes = {}
                expected_roles = []

                for key, value in row.items():
                    if key.startswith("attr_"):
                        attr_name = key[5:]
                        expected_attributes[attr_name] = value
                    elif key == "roles" and value:
                        expected_roles = [r.strip() for r in value.split("|") if r.strip()]

                if "email" in row and row["email"]:
                    expected_attributes["email"] = row["email"]
                if "department" in row and row["department"]:
                    expected_attributes["department"] = row["department"]
                if "username" in row and row["username"]:
                    expected_attributes["username"] = row["username"]

                item = TestUser(
                    user_id=user_id,
                    expected_attributes=expected_attributes,
                    expected_roles=expected_roles,
                    source_file=str(self.file_path),
                    line_number=line_num,
                    description=row.get("description"),
                    tags=[t.strip() for t in row.get("tags", "").split("|") if t.strip()],
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


class TestUserJsonParser(JsonParser[TestUser]):
    def parse(self) -> ParseResult[TestUser]:
        data, total_lines = self._read_json()
        items: List[TestUser] = []

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

                item = TestUser(
                    user_id=user_id,
                    expected_attributes=row.get("expected_attributes", {}),
                    expected_roles=row.get("expected_roles", []),
                    source_file=str(self.file_path),
                    line_number=line_num,
                    description=row.get("description"),
                    tags=row.get("tags", []),
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
