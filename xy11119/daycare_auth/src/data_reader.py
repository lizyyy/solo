from pathlib import Path
from typing import List, Dict, Any, Optional
import pandas as pd
from datetime import datetime
import re

from src.config import AppConfig


class DataReader:
    def __init__(self, config: AppConfig):
        self.config = config
        self.columns = config.get_all_columns()

    def read_csv_file(self, file_path: Path) -> pd.DataFrame:
        encodings = ["utf-8-sig", "gbk", "gb2312", "utf-8"]
        for encoding in encodings:
            try:
                df = pd.read_csv(file_path, encoding=encoding, dtype=str)
                df = self._normalize_columns(df)
                return df
            except (UnicodeDecodeError, Exception):
                continue
        raise ValueError(f"无法读取文件: {file_path}")

    def _normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        column_mapping = {v: k for k, v in self.columns.items()}
        df.rename(columns=column_mapping, inplace=True)
        for col in self.columns.keys():
            if col not in df.columns:
                df[col] = ""
        df = df.fillna("")
        return df

    def read_directory(self, input_dir: Path) -> pd.DataFrame:
        all_data = []
        csv_files = list(input_dir.glob("*.csv"))
        
        for file_path in csv_files:
            df = self.read_csv_file(file_path)
            df["source_file"] = file_path.name
            all_data.append(df)
        
        if not all_data:
            return pd.DataFrame(columns=list(self.columns.keys()) + ["source_file"])
        
        result = pd.concat(all_data, ignore_index=True)
        return result

    def parse_dates(self, df: pd.DataFrame) -> pd.DataFrame:
        date_columns = ["auth_start_date", "auth_end_date", "id_expiry_date", "timestamp"]
        for col in date_columns:
            if col in df.columns:
                df[f"{col}_parsed"] = df[col].apply(self._parse_date)
        return df

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        if pd.isna(date_str) or str(date_str).strip() == "":
            return None
        
        date_str = str(date_str).strip()
        
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y%m%d",
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%d-%m-%Y",
            "%d/%m/%Y",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        return None

    def validate_required_fields(self, df: pd.DataFrame) -> pd.DataFrame:
        errors = []
        rules = self.config.validation_rules
        
        for idx, row in df.iterrows():
            row_errors = []
            
            if rules.require_child_id and not str(row.get("child_id", "")).strip():
                row_errors.append("缺少儿童证件号")
            
            if rules.require_parent_id and not str(row.get("parent_id_number", "")).strip():
                row_errors.append("缺少家长证件号")
            
            if rules.require_relationship and not str(row.get("relationship", "")).strip():
                row_errors.append("缺少与儿童关系")
            
            if row_errors:
                errors.append({
                    "row_index": idx,
                    "errors": "; ".join(row_errors),
                    "record": row.to_dict()
                })
        
        df["validation_errors"] = ""
        for error in errors:
            df.at[error["row_index"], "validation_errors"] = error["errors"]
        
        return df
