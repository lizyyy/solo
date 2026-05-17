import json
import csv
from datetime import datetime
from typing import List, Dict, Any, Optional
import pandas as pd


class DataLoader:
    @staticmethod
    def load_json(file_path: str) -> List[Dict[str, Any]]:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else [data]

    @staticmethod
    def load_csv(file_path: str) -> List[Dict[str, Any]]:
        rows = []
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                processed_row = DataLoader._process_csv_row(row)
                rows.append(processed_row)
        return rows

    @staticmethod
    def load_excel(file_path: str, sheet_name: Optional[str] = None) -> List[Dict[str, Any]]:
        df = pd.read_excel(file_path, sheet_name=sheet_name)
        data = df.to_dict("records")
        return [DataLoader._process_excel_row(row) for row in data]

    @staticmethod
    def _process_csv_row(row: Dict[str, str]) -> Dict[str, Any]:
        result = {}
        for key, value in row.items():
            if value == "" or value is None:
                result[key] = None
            elif key in ["volume", "occupancy_days", "free_rent_days"]:
                try:
                    result[key] = float(value) if key == "volume" else int(value)
                except (ValueError, TypeError):
                    result[key] = value
            elif key in ["checkin_date", "checkout_date"]:
                try:
                    result[key] = datetime.fromisoformat(value)
                except (ValueError, TypeError):
                    result[key] = None
            elif key == "is_checked_out":
                result[key] = value.lower() in ["true", "1", "yes", "是"]
            else:
                result[key] = value
        return result

    @staticmethod
    def _process_excel_row(row: Dict[str, Any]) -> Dict[str, Any]:
        result = {}
        for key, value in row.items():
            if pd.isna(value):
                result[key] = None
            elif key in ["volume", "occupancy_days", "free_rent_days"]:
                result[key] = float(value) if key == "volume" else int(value)
            elif key in ["checkin_date", "checkout_date"]:
                if isinstance(value, datetime):
                    result[key] = value
                else:
                    result[key] = None
            elif key == "is_checked_out":
                if isinstance(value, bool):
                    result[key] = value
                else:
                    result[key] = str(value).lower() in ["true", "1", "yes", "是"]
            else:
                result[key] = str(value) if value is not None else None
        return result

    @staticmethod
    def auto_load(file_path: str) -> List[Dict[str, Any]]:
        if file_path.endswith(".json"):
            return DataLoader.load_json(file_path)
        elif file_path.endswith(".csv"):
            return DataLoader.load_csv(file_path)
        elif file_path.endswith((".xlsx", ".xls")):
            return DataLoader.load_excel(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {file_path}")

    @staticmethod
    def load_default_rules() -> Dict[str, Any]:
        return {
            "rule_id": "RULE_2024_STANDARD",
            "rule_name": "2024年标准仓租计费规则",
            "effective_date": datetime(2024, 1, 1),
            "volume_tiers": [
                {"min_volume": 0, "max_volume": 50, "price_per_cbm": 3.5},
                {"min_volume": 50, "max_volume": 200, "price_per_cbm": 3.0},
                {"min_volume": 200, "max_volume": 500, "price_per_cbm": 2.5},
                {"min_volume": 500, "max_volume": None, "price_per_cbm": 2.0},
            ],
            "days_tiers": [
                {"min_days": 0, "max_days": 7, "discount_rate": 1.0},
                {"min_days": 7, "max_days": 30, "discount_rate": 0.95},
                {"min_days": 30, "max_days": 90, "discount_rate": 0.9},
                {"min_days": 90, "max_days": None, "discount_rate": 0.85},
            ],
            "base_price_per_cbm_per_day": 3.5,
            "checkout_truncation_hours": 12,
        }
