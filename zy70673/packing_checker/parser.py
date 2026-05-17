import csv
from typing import List, Tuple
from pathlib import Path
from .models import MaterialItem


class MaterialParser:
    REQUIRED_COLUMNS = ["城市", "物料名称", "数量"]
    OPTIONAL_COLUMNS = ["箱号", "分类"]

    def __init__(self, encoding: str = "utf-8"):
        self.encoding = encoding

    def parse_file(self, file_path: str) -> Tuple[List[MaterialItem], List[MaterialItem]]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        materials = []
        invalid_rows = []
        column_mapping = {}

        with open(path, "r", encoding=self.encoding, newline="") as f:
            lines = f.readlines()

        if not lines:
            return materials, invalid_rows

        header_line = lines[0].strip()
        column_mapping = self._parse_header(header_line)

        for line_num, line in enumerate(lines[1:], start=2):
            raw_line = line.rstrip("\n")
            if not raw_line.strip():
                continue

            item = self._parse_row(raw_line, line_num, column_mapping)
            if item.is_valid:
                materials.append(item)
            else:
                invalid_rows.append(item)

        materials.sort(key=lambda x: x.sort_index)
        return materials, invalid_rows

    def _parse_header(self, header_line: str) -> dict:
        headers = self._split_csv_row(header_line)
        mapping = {}
        for idx, header in enumerate(headers):
            header = header.strip()
            if header in self.REQUIRED_COLUMNS or header in self.OPTIONAL_COLUMNS:
                mapping[header] = idx
        return mapping

    def _split_csv_row(self, row: str) -> List[str]:
        result = []
        current = []
        in_quotes = False
        quote_char = None

        for char in row:
            if char in ('"', "'"):
                if not in_quotes:
                    in_quotes = True
                    quote_char = char
                elif char == quote_char:
                    in_quotes = False
                    quote_char = None
                else:
                    current.append(char)
            elif char == "," and not in_quotes:
                result.append("".join(current).strip())
                current = []
            else:
                current.append(char)

        result.append("".join(current).strip())
        return result

    def _parse_row(self, row: str, line_num: int, column_mapping: dict) -> MaterialItem:
        columns = self._split_csv_row(row)

        city = self._get_column_value(columns, column_mapping, "城市")
        material_name = self._get_column_value(columns, column_mapping, "物料名称")
        quantity_str = self._get_column_value(columns, column_mapping, "数量")
        box_number = self._get_column_value(columns, column_mapping, "箱号", "")
        category = self._get_column_value(columns, column_mapping, "分类", "")

        is_valid = True
        error_message = ""

        if not city:
            is_valid = False
            error_message += "城市不能为空; "
        if not material_name:
            is_valid = False
            error_message += "物料名称不能为空; "

        quantity = 0
        if quantity_str:
            try:
                quantity = int(quantity_str)
                if quantity < 0:
                    is_valid = False
                    error_message += "数量不能为负数; "
            except ValueError:
                is_valid = False
                error_message += f"数量格式错误: {quantity_str}; "
        else:
            is_valid = False
            error_message += "数量不能为空; "

        return MaterialItem(
            city=city,
            material_name=material_name,
            quantity=quantity,
            box_number=box_number,
            category=category,
            line_number=line_num,
            is_valid=is_valid,
            error_message=error_message.strip(),
            raw_data=row,
        )

    def _get_column_value(
        self, columns: List[str], mapping: dict, column_name: str, default: str = ""
    ) -> str:
        if column_name in mapping:
            idx = mapping[column_name]
            if idx < len(columns):
                return columns[idx]
        return default
