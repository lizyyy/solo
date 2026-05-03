from pathlib import Path
from typing import List, Dict, Any, Optional

from .base_parser import BaseParser, ParseResult
from app.models import Prop


class PropParser(BaseParser):

    def get_required_columns(self) -> List[str]:
        return ["name"]

    def get_optional_columns(self) -> List[str]:
        return [
            "prop_id",
            "description",
            "category",
            "danger_level",
            "is_dangerous",
            "danger_description",
            "requires_verification",
            "location",
            "owner",
            "total_quantity",
            "available_quantity",
            "barcode",
            "serial_number",
            "notes",
        ]

    def parse_file(self, file_path: Path) -> ParseResult:
        try:
            rows = self._read_csv_file(file_path)
            return self.parse_rows(rows)
        except Exception as e:
            return ParseResult(
                success=False,
                records=[],
                errors=[f"读取文件失败: {str(e)}"],
                warnings=[],
                row_count=0,
            )

    def parse_rows(self, rows: List[Dict[str, Any]]) -> ParseResult:
        if not rows:
            return ParseResult(
                success=False,
                records=[],
                errors=["CSV文件为空"],
                warnings=[],
                row_count=0,
            )

        errors = []
        warnings = []
        records = []

        headers = list(rows[0].keys()) if rows else []
        missing, extra = self.validate_columns(headers)

        for col in missing:
            errors.append(f"缺少必需列: {col}")

        for col in extra:
            warnings.append(f"未知列将被忽略: {col}")

        if errors:
            return ParseResult(
                success=False,
                records=[],
                errors=errors,
                warnings=warnings,
                row_count=len(rows),
            )

        for index, row in enumerate(rows, start=2):
            try:
                prop = Prop.from_csv_row(row)
                records.append(prop)
            except Exception as e:
                errors.append(f"第{index}行解析失败: {str(e)}")

        return ParseResult(
            success=len(errors) == 0,
            records=records,
            errors=errors,
            warnings=warnings,
            row_count=len(rows),
        )
