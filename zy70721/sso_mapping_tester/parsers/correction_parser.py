import json
from typing import List
from datetime import datetime
from ..models.correction import CorrectionRecord
from .base_parser import CsvParser, JsonParser, ParseResult


class CorrectionParser(CsvParser[CorrectionRecord]):
    def parse(self) -> ParseResult[CorrectionRecord]:
        rows, total_lines = self._read_csv()
        items: List[CorrectionRecord] = []

        for line_num, row in rows:
            try:
                correction_id = row.get("correction_id")
                user_id = row.get("user_id")

                if not correction_id:
                    self._add_error(line_num, "missing_id", "缺少修正ID字段", str(row))
                    continue
                if not user_id:
                    self._add_error(line_num, "missing_user_id", "缺少用户ID字段", str(row))
                    continue

                corrected_at = datetime.now()
                if row.get("corrected_at"):
                    try:
                        corrected_at = datetime.fromisoformat(row["corrected_at"].replace("Z", "+00:00"))
                    except ValueError:
                        pass

                applied = row.get("applied", "false").lower() == "true"

                item = CorrectionRecord(
                    correction_id=correction_id,
                    user_id=user_id,
                    correction_type=row.get("correction_type", "attribute"),
                    field_name=row.get("field_name"),
                    old_value=row.get("old_value"),
                    new_value=row.get("new_value"),
                    reason=row.get("reason", ""),
                    corrected_by=row.get("corrected_by", ""),
                    corrected_at=corrected_at,
                    source_file=str(self.file_path),
                    line_number=line_num,
                    applied=applied,
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


class CorrectionJsonParser(JsonParser[CorrectionRecord]):
    def parse(self) -> ParseResult[CorrectionRecord]:
        data, total_lines = self._read_json()
        items: List[CorrectionRecord] = []

        if data is None:
            return ParseResult(items=items, errors=self.errors, file_path=str(self.file_path))

        if not isinstance(data, list):
            self._add_error(0, "format_error", "JSON根节点必须是数组")
            return ParseResult(items=items, errors=self.errors, file_path=str(self.file_path))

        for line_num, row in enumerate(data, start=1):
            try:
                correction_id = row.get("correction_id")
                user_id = row.get("user_id")

                if not correction_id:
                    self._add_error(line_num, "missing_id", "缺少修正ID字段", str(row))
                    continue
                if not user_id:
                    self._add_error(line_num, "missing_user_id", "缺少用户ID字段", str(row))
                    continue

                corrected_at = datetime.now()
                if row.get("corrected_at"):
                    try:
                        corrected_at = datetime.fromisoformat(row["corrected_at"].replace("Z", "+00:00"))
                    except ValueError:
                        pass

                item = CorrectionRecord(
                    correction_id=correction_id,
                    user_id=user_id,
                    correction_type=row.get("correction_type", "attribute"),
                    field_name=row.get("field_name"),
                    old_value=row.get("old_value"),
                    new_value=row.get("new_value"),
                    reason=row.get("reason", ""),
                    corrected_by=row.get("corrected_by", ""),
                    corrected_at=corrected_at,
                    source_file=str(self.file_path),
                    line_number=line_num,
                    applied=row.get("applied", False),
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
