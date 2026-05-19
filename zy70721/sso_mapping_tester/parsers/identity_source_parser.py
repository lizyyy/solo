from typing import List
from ..models.user import IdentitySourceUser
from .base_parser import CsvParser, JsonParser, ParseResult


class IdentitySourceParser(CsvParser[IdentitySourceUser]):
    def parse(self) -> ParseResult[IdentitySourceUser]:
        rows, total_lines = self._read_csv()
        items: List[IdentitySourceUser] = []

        for line_num, row in rows:
            try:
                source_id = row.get("source_id") or row.get("id") or row.get("user_id")
                if not source_id:
                    self._add_error(line_num, "missing_id", "缺少用户ID字段", str(row))
                    continue

                item = IdentitySourceUser(
                    source_id=source_id,
                    raw_data=dict(row),
                    source_file=str(self.file_path),
                    line_number=line_num,
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


class IdentitySourceJsonParser(JsonParser[IdentitySourceUser]):
    def parse(self) -> ParseResult[IdentitySourceUser]:
        data, total_lines = self._read_json()
        items: List[IdentitySourceUser] = []

        if data is None:
            return ParseResult(items=items, errors=self.errors, file_path=str(self.file_path))

        if not isinstance(data, list):
            self._add_error(0, "format_error", "JSON根节点必须是数组")
            return ParseResult(items=items, errors=self.errors, file_path=str(self.file_path))

        for line_num, row in enumerate(data, start=1):
            try:
                source_id = row.get("source_id") or row.get("id") or row.get("user_id")
                if not source_id:
                    self._add_error(line_num, "missing_id", "缺少用户ID字段", str(row))
                    continue

                item = IdentitySourceUser(
                    source_id=source_id,
                    raw_data=row,
                    source_file=str(self.file_path),
                    line_number=line_num,
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
