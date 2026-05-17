import os
import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from dateutil import parser as date_parser

from .models import SampleRecord, RejectionReason, ApprovalStatus


class DataParser:
    DATE_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d",
    ]

    BARCODE_COLUMNS = ["条码", "样本条码", "barcode", "Barcode", "BARCODE", "样品编号"]
    SAMPLING_TIME_COLUMNS = ["采样时间", "sampling_time", "SamplingTime", "采样日期"]
    TRANSPORTER_COLUMNS = ["运输人", "transporter", "Transporter", "配送员", "交接人"]
    TRANSPORT_BATCH_COLUMNS = ["运输批次", "transport_batch", "TransportBatch", "批次号"]
    RECEIVE_TIME_COLUMNS = ["接收时间", "receive_time", "ReceiveTime", "接收日期"]
    RECEIVE_WINDOW_COLUMNS = ["接收窗口", "receive_window", "ReceiveWindow", "窗口"]
    REJECTION_REASON_COLUMNS = ["拒收原因", "rejection_reason", "RejectionReason", "拒收说明"]
    IS_REJECTED_COLUMNS = ["是否拒收", "is_rejected", "IsRejected", "拒收"]

    def __init__(self):
        self.column_mappings = self._build_column_mappings()

    def _build_column_mappings(self) -> Dict[str, List[str]]:
        return {
            "barcode": self.BARCODE_COLUMNS,
            "sampling_time": self.SAMPLING_TIME_COLUMNS,
            "transporter": self.TRANSPORTER_COLUMNS,
            "transport_batch": self.TRANSPORT_BATCH_COLUMNS,
            "receive_time": self.RECEIVE_TIME_COLUMNS,
            "receive_window": self.RECEIVE_WINDOW_COLUMNS,
            "rejection_reason": self.REJECTION_REASON_COLUMNS,
            "is_rejected": self.IS_REJECTED_COLUMNS,
        }

    def parse_file(self, file_path: str) -> List[SampleRecord]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        suffix = path.suffix.lower()
        if suffix in [".csv"]:
            return self._parse_csv(file_path)
        elif suffix in [".xlsx", ".xls"]:
            return self._parse_excel(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")

    def _parse_csv(self, file_path: str) -> List[SampleRecord]:
        records = []
        filename = os.path.basename(file_path)

        with open(file_path, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row_idx, row in enumerate(reader, start=2):
                try:
                    record = self._parse_row(row, filename, row_idx)
                    records.append(record)
                except Exception as e:
                    bad_record = self._create_bad_record(row, filename, row_idx, str(e))
                    records.append(bad_record)

        return records

    def _parse_excel(self, file_path: str) -> List[SampleRecord]:
        records = []
        filename = os.path.basename(file_path)

        df = pd.read_excel(file_path, dtype=str)
        headers = df.columns.tolist()

        for row_idx, (_, row) in enumerate(df.iterrows(), start=2):
            try:
                row_dict = dict(zip(headers, [str(v) if pd.notna(v) else "" for v in row]))
                record = self._parse_row(row_dict, filename, row_idx)
                records.append(record)
            except Exception as e:
                row_dict = dict(zip(headers, [str(v) if pd.notna(v) else "" for v in row]))
                bad_record = self._create_bad_record(row_dict, filename, row_idx, str(e))
                records.append(bad_record)

        return records

    def _parse_row(self, row: Dict[str, Any], source_file: str, row_num: int) -> SampleRecord:
        data = {
            "source_file": source_file,
            "source_row": row_num,
            "raw_data": dict(row),
        }

        for field, possible_columns in self.column_mappings.items():
            value = self._get_value_by_columns(row, possible_columns)
            if value is not None:
                data[field] = value

        barcode = data.get("barcode", "")
        if not barcode:
            raise ValueError("条码字段为空或未找到")

        sampling_time = self._parse_datetime(data.get("sampling_time"))
        receive_time = self._parse_datetime(data.get("receive_time"))

        rejection_reason = self._parse_rejection_reason(data.get("rejection_reason"))
        is_rejected = self._parse_bool(data.get("is_rejected", False)) or rejection_reason is not None

        return SampleRecord(
            barcode=barcode,
            sampling_time=sampling_time,
            transporter=str(data.get("transporter", "")).strip() or None,
            transport_batch=str(data.get("transport_batch", "")).strip() or None,
            receive_time=receive_time,
            receive_window=str(data.get("receive_window", "")).strip() or None,
            rejection_reason=rejection_reason,
            is_rejected=is_rejected,
            source_file=source_file,
            source_row=row_num,
            raw_data=dict(row),
        )

    def _create_bad_record(self, row: Dict[str, Any], source_file: str, row_num: int, error: str) -> SampleRecord:
        barcode = str(self._get_value_by_columns(row, self.BARCODE_COLUMNS) or f"BAD_ROW_{row_num}")
        return SampleRecord(
            barcode=barcode,
            source_file=source_file,
            source_row=row_num,
            raw_data=dict(row),
            is_valid=False,
            errors=[f"解析错误: {error}"],
        )

    def _get_value_by_columns(self, row: Dict[str, Any], columns: List[str]) -> Optional[Any]:
        for col in columns:
            if col in row:
                value = row[col]
                if value is not None and str(value).strip():
                    return value
        return None

    def _parse_datetime(self, value: Any) -> Optional[datetime]:
        if value is None or str(value).strip() == "":
            return None

        value_str = str(value).strip()

        for fmt in self.DATE_FORMATS:
            try:
                return datetime.strptime(value_str, fmt)
            except ValueError:
                continue

        try:
            return date_parser.parse(value_str, fuzzy=True)
        except (ValueError, TypeError):
            return None

    def _parse_rejection_reason(self, value: Any) -> Optional[RejectionReason]:
        if value is None or str(value).strip() == "":
            return None

        value_str = str(value).strip()

        reason_map = {
            "条码重复": RejectionReason.BARCODE_DUPLICATE,
            "条码缺失": RejectionReason.BARCODE_MISSING,
            "条码无效": RejectionReason.BARCODE_INVALID,
            "超时接收": RejectionReason.TIME_EXPIRED,
            "采样时间无效": RejectionReason.TIME_INVALID,
            "运输人缺失": RejectionReason.TRANSPORTER_MISSING,
            "样本破损": RejectionReason.SAMPLE_DAMAGED,
            "样本泄漏": RejectionReason.SAMPLE_LEAKING,
            "单据不全": RejectionReason.DOCUMENT_INCOMPLETE,
            "温度异常": RejectionReason.TEMPERATURE_ABNORMAL,
        }

        for key, reason in reason_map.items():
            if key in value_str or value_str in key:
                return reason

        return RejectionReason.OTHER

    def _parse_bool(self, value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if value is None:
            return False
        value_str = str(value).strip().lower()
        return value_str in ["是", "yes", "true", "1", "拒收", "已拒收"]
