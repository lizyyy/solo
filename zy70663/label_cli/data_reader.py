import pandas as pd
import re
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class LabelRecord:
    old_label: str = ""
    sku: str = ""
    location: str = ""
    batch: str = ""
    print_status: str = "pending"
    new_label: str = ""
    is_valid: bool = True
    error_messages: List[str] = field(default_factory=list)


class DataReader:
    REQUIRED_COLUMNS = ["old_label", "sku", "location"]
    OPTIONAL_COLUMNS = ["batch", "print_status"]

    def __init__(self):
        self.records: List[LabelRecord] = []
        self.errors: List[str] = []

    def read_csv(self, file_path: str) -> Tuple[List[LabelRecord], List[str]]:
        self.records = []
        self.errors = []

        try:
            df = pd.read_csv(file_path, dtype=str, keep_default_na=False)
            self._validate_columns(df)
            self._parse_records(df)
        except Exception as e:
            self.errors.append(f"文件读取失败: {str(e)}")

        return self.records, self.errors

    def _validate_columns(self, df: pd.DataFrame):
        missing_cols = [col for col in self.REQUIRED_COLUMNS if col not in df.columns]
        if missing_cols:
            self.errors.append(f"缺少必需列: {', '.join(missing_cols)}")

    def _parse_records(self, df: pd.DataFrame):
        for idx, row in df.iterrows():
            record = LabelRecord()
            record.old_label = str(row.get("old_label", "")).strip()
            record.sku = str(row.get("sku", "")).strip()
            record.location = str(row.get("location", "")).strip()
            record.batch = str(row.get("batch", "")).strip()
            record.print_status = str(row.get("print_status", "pending")).strip().lower()

            self._validate_record(record, idx + 2)
            self.records.append(record)

    def _validate_record(self, record: LabelRecord, row_num: int):
        if not record.old_label:
            record.is_valid = False
            record.error_messages.append(f"第{row_num}行: 旧标签不能为空")

        if not record.sku:
            record.is_valid = False
            record.error_messages.append(f"第{row_num}行: SKU不能为空")

        if not record.location:
            record.is_valid = False
            record.error_messages.append(f"第{row_num}行: 库位不能为空")

        if record.print_status not in ["pending", "printed", "failed"]:
            record.print_status = "pending"

        if record.sku and not re.match(r"^[A-Z0-9-]{3,20}$", record.sku):
            record.error_messages.append(f"第{row_num}行: SKU格式可能不正确")

        if record.location and not re.match(r"^[A-Z]-[0-9]{2}-[0-9]{2}$", record.location):
            record.error_messages.append(f"第{row_num}行: 库位格式建议使用A-01-01格式")
