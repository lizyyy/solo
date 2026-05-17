import csv
import os
from datetime import datetime
from typing import List, Optional
import pandas as pd

from .models import ScheduleRow, SourceLocation


class ScheduleParser:
    REQUIRED_COLUMNS = {
        "date": ["日期", "date", "排班日期"],
        "start_time": ["开始时间", "start_time", "时间", "开始"],
        "end_time": ["结束时间", "end_time", "结束"],
        "anchor": ["主播", "anchor", "主持人"],
        "account": ["账号", "account", "直播账号"],
        "field_control": ["场控", "field_control", "场控人员"],
        "product_script": ["商品脚本", "product_script", "脚本", "商品"]
    }

    def __init__(self):
        self.column_mapping = {}

    def parse_file(self, file_path: str) -> List[ScheduleRow]:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".csv":
            return self._parse_csv(file_path)
        elif ext in [".xlsx", ".xls"]:
            return self._parse_excel(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

    def _parse_csv(self, file_path: str) -> List[ScheduleRow]:
        rows = []
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            if not header:
                return rows
            self._detect_columns(header)
            for row_idx, row in enumerate(reader, start=2):
                schedule_row = self._parse_row(
                    row,
                    row_idx,
                    file_path,
                    None
                )
                rows.append(schedule_row)
        return rows

    def _parse_excel(self, file_path: str) -> List[ScheduleRow]:
        rows = []
        xl = pd.ExcelFile(file_path)
        for sheet_name in xl.sheet_names:
            df = xl.parse(sheet_name, header=None)
            if df.empty:
                continue
            header = df.iloc[0].fillna("").astype(str).tolist()
            self._detect_columns(header)
            for row_idx in range(1, len(df)):
                row = df.iloc[row_idx].fillna("").astype(str).tolist()
                schedule_row = self._parse_row(
                    row,
                    row_idx + 2,
                    file_path,
                    sheet_name
                )
                rows.append(schedule_row)
        return rows

    def _detect_columns(self, header: List[str]):
        self.column_mapping = {}
        header_lower = [h.strip().lower() for h in header]
        for field, candidates in self.REQUIRED_COLUMNS.items():
            for candidate in candidates:
                candidate_lower = candidate.lower()
                for idx, h in enumerate(header_lower):
                    if candidate_lower in h:
                        self.column_mapping[field] = idx
                        break
                if field in self.column_mapping:
                    break

    def _parse_row(
        self,
        row: List[str],
        row_number: int,
        file_path: str,
        sheet_name: Optional[str]
    ) -> ScheduleRow:
        source = SourceLocation(
            file_path=file_path,
            sheet_name=sheet_name,
            row_number=row_number,
            original_content="|".join(str(cell.strip() if cell is not None else "") for cell in row)
        )
        schedule_row = ScheduleRow(source=source)
        errors = []
        date_val = self._get_field(row, "date")
        if date_val:
            try:
                schedule_row.date = self._parse_date(date_val)
            except ValueError as e:
                errors.append(f"日期格式错误: {date_val}")
        else:
            errors.append("缺少日期")
        schedule_row.start_time = self._get_field(row, "start_time") or ""
        schedule_row.end_time = self._get_field(row, "end_time") or ""
        schedule_row.anchor = (self._get_field(row, "anchor") or "").strip()
        schedule_row.account = (self._get_field(row, "account") or "").strip()
        schedule_row.field_control = (self._get_field(row, "field_control") or "").strip()
        schedule_row.product_script = (self._get_field(row, "product_script") or "").strip()
        if not schedule_row.anchor:
            errors.append("缺少主播")
        if not schedule_row.account:
            errors.append("缺少账号")
        schedule_row.is_valid = len(errors) == 0
        schedule_row.parse_errors = errors
        return schedule_row

    def _get_field(self, row: List[str], field: str) -> Optional[str]:
        if field not in self.column_mapping:
            return None
        idx = self.column_mapping[field]
        if idx >= len(row):
            return None
        val = row[idx]
        return val.strip() if val else None

    @staticmethod
    def _parse_date(date_str: str):
        date_str = date_str.strip()
        for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%m-%d", "%m/%d"]:
            try:
                dt = datetime.strptime(date_str, fmt)
                if fmt in ["%m-%d", "%m/%d"]:
                    dt = dt.replace(year=datetime.now().year)
                return dt.date()
            except ValueError:
                continue
        raise ValueError(f"无法解析日期: {date_str}")
