import csv
import json
import os
from typing import List, Dict, Any, Optional
from ..models.bond import BondRecord


class DataLoader:
    @staticmethod
    def load_csv(file_path: str, source_name: str = "") -> List[BondRecord]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        if not source_name:
            source_name = os.path.basename(file_path)

        records = []
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                record = DataLoader._parse_row(row, source_name, line_num)
                records.append(record)

        return records

    @staticmethod
    def _parse_row(row: Dict[str, str], source_name: str, line_num: int) -> BondRecord:
        raw_data = row.copy()

        def parse_float(key: str) -> Optional[float]:
            value = row.get(key, "").strip()
            if value in ["", "null", "NULL", "None", "NaN", "nan"]:
                return None
            try:
                return float(value.replace(",", ""))
            except (ValueError, TypeError):
                return None

        def parse_str(key: str) -> Optional[str]:
            value = row.get(key, "").strip()
            if value in ["", "null", "NULL", "None"]:
                return None
            return value

        def get_float(keys):
            for key in keys:
                val = parse_float(key)
                if val is not None:
                    return val
            return None

        def get_str(keys, default=None):
            for key in keys:
                val = parse_str(key)
                if val is not None:
                    return val
            return default

        bond_code = get_str(["bond_code", "转债代码"], "")
        bond_name = get_str(["bond_name", "转债名称"], "")

        bond_price = get_float(["bond_price", "转债价格"])
        conversion_price = get_float(["conversion_price", "转股价格"])
        stock_price = get_float(["stock_price", "正股价格"])
        conversion_ratio = get_float(["conversion_ratio", "转股比例"])
        face_value = get_float(["face_value", "面值"])
        if face_value is None:
            face_value = 100.0

        return BondRecord(
            bond_code=bond_code,
            bond_name=bond_name,
            bond_price=bond_price,
            bond_price_unit=get_str(["bond_price_unit", "转债价格单位"]),
            conversion_price=conversion_price,
            conversion_price_unit=get_str(["conversion_price_unit", "转股价格单位"]),
            stock_price=stock_price,
            stock_price_unit=get_str(["stock_price_unit", "正股价格单位"]),
            conversion_ratio=conversion_ratio,
            face_value=face_value,
            face_value_unit=get_str(["face_value_unit", "面值单位"], "元"),
            original_source=source_name,
            raw_data=raw_data,
            remark=get_str(["remark", "备注"], ""),
            line_number=line_num,
        )

    @staticmethod
    def load_json(file_path: str, source_name: str = "") -> List[BondRecord]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        if not source_name:
            source_name = os.path.basename(file_path)

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        records = []
        if isinstance(data, dict):
            data = [data]

        for line_num, item in enumerate(data, start=1):
            row = {str(k): str(v) if v is not None else "" for k, v in item.items()}
            record = DataLoader._parse_row(row, source_name, line_num)
            records.append(record)

        return records
