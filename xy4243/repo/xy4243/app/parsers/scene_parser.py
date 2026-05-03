from pathlib import Path
from typing import List, Dict, Any, Optional

from .base_parser import BaseParser, ParseResult
from app.models import Scene


class SceneParser(BaseParser):

    def get_required_columns(self) -> List[str]:
        return ["act_number", "scene_number"]

    def get_optional_columns(self) -> List[str]:
        return [
            "scene_id",
            "title",
            "description",
            "location",
            "start_time",
            "end_time",
            "duration_minutes",
            "sort_order",
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
                scene = Scene.from_csv_row(row)
                records.append(scene)
            except Exception as e:
                errors.append(f"第{index}行解析失败: {str(e)}")

        records.sort(key=lambda s: (s.act_number, s.scene_number))

        return ParseResult(
            success=len(errors) == 0,
            records=records,
            errors=errors,
            warnings=warnings,
            row_count=len(rows),
        )
