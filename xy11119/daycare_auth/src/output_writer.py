from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import pandas as pd
import hashlib
import json

from src.config import AppConfig


class OutputWriter:
    def __init__(self, config: AppConfig):
        self.config = config
        self.settings = config.output_settings
        self.columns = config.get_all_columns()

    def _get_run_hash(self, df: pd.DataFrame) -> str:
        content = df.to_csv(index=False)
        return hashlib.md5(content.encode()).hexdigest()[:12]

    def _get_output_dir(self, base_dir: Path) -> Path:
        timestamp = datetime.now().strftime(self.settings.timestamp_format)
        output_dir = base_dir / f"run_{timestamp}"
        output_dir.mkdir(parents=True, exist_ok=True)
        return output_dir

    def _load_processed_records(self, output_dir: Path) -> set:
        processed_file = output_dir.parent / ".processed_records.json"
        if processed_file.exists():
            with open(processed_file, "r", encoding="utf-8") as f:
                return set(json.load(f))
        return set()

    def _save_processed_records(self, output_dir: Path, record_ids: List[str]):
        processed_file = output_dir.parent / ".processed_records.json"
        with open(processed_file, "w", encoding="utf-8") as f:
            json.dump(list(record_ids), f, ensure_ascii=False, indent=2)

    def _generate_record_id(self, row: pd.Series) -> str:
        key_parts = [
            str(row.get("child_name", "")),
            str(row.get("child_id", "")),
            str(row.get("parent_name", "")),
            str(row.get("parent_id_number", ""))
        ]
        key = "|".join(key_parts)
        return hashlib.md5(key.encode()).hexdigest()

    def write_results(self, output_dir: Path, df: pd.DataFrame, 
                      valid_df: pd.DataFrame,
                      expired_df: pd.DataFrame,
                      warning_df: pd.DataFrame,
                      duplicate_df: pd.DataFrame,
                      invalid_df: pd.DataFrame,
                      incremental: bool = False) -> Path:
        run_output_dir = self._get_output_dir(output_dir)
        
        if incremental:
            processed_ids = self._load_processed_records(run_output_dir)
            df["record_id"] = df.apply(self._generate_record_id, axis=1)
            new_records_mask = ~df["record_id"].isin(processed_ids)
            all_record_ids = set(df["record_id"].tolist())
        else:
            new_records_mask = pd.Series([True] * len(df), index=df.index)
            all_record_ids = set()

        self._write_csv(run_output_dir, "all_records.csv", df)
        valid_mask = new_records_mask & valid_df.index.isin(df.index)
        self._write_csv(run_output_dir, "valid_records.csv", valid_df[valid_mask])
        self._write_csv(run_output_dir, "expired_id_records.csv", expired_df)
        self._write_csv(run_output_dir, "warning_id_records.csv", warning_df)
        self._write_csv(run_output_dir, "duplicate_parent_records.csv", duplicate_df)
        self._write_csv(run_output_dir, "invalid_records.csv", invalid_df)

        self._write_summary(run_output_dir, df, valid_df, expired_df, warning_df, duplicate_df, invalid_df)

        if incremental and all_record_ids:
            self._save_processed_records(run_output_dir, all_record_ids)

        return run_output_dir

    def _write_csv(self, output_dir: Path, filename: str, df: pd.DataFrame):
        if len(df) == 0:
            return
        
        output_cols = []
        for eng_col, chi_col in self.columns.items():
            if eng_col in df.columns:
                output_cols.append(eng_col)
        
        extra_cols = ["id_expiry_status", "id_days_until_expiry", "auth_status", 
                      "is_duplicate", "duplicate_note", "validation_errors", "source_file"]
        for col in extra_cols:
            if col in df.columns and col not in output_cols:
                output_cols.append(col)
        
        output_df = df[output_cols].copy()
        
        column_rename = {k: v for k, v in self.columns.items() if k in output_df.columns}
        output_df.rename(columns=column_rename, inplace=True)
        
        output_path = output_dir / filename
        output_df.to_csv(output_path, index=False, encoding=self.settings.encoding)

    def _write_summary(self, output_dir: Path, 
                       all_df: pd.DataFrame,
                       valid_df: pd.DataFrame,
                       expired_df: pd.DataFrame, 
                       warning_df: pd.DataFrame,
                       duplicate_df: pd.DataFrame,
                       invalid_df: pd.DataFrame):
        summary = {
            "处理时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "总记录数": len(all_df),
            "有效记录数": len(valid_df),
            "证件已过期记录数": len(expired_df),
            "证件即将过期记录数": len(warning_df),
            "同名家长记录数": len(duplicate_df),
            "字段验证失败记录数": len(invalid_df),
        }
        
        summary_path = output_dir / "处理总结.txt"
        with open(summary_path, "w", encoding="utf-8") as f:
            f.write("=" * 50 + "\n")
            f.write("儿童托管班接送授权名单处理总结\n")
            f.write("=" * 50 + "\n\n")
            for key, value in summary.items():
                f.write(f"{key}: {value}\n")
            
            f.write("\n" + "=" * 50 + "\n")
            f.write("输出文件说明:\n")
            f.write("- valid_records.csv: 验证通过的正常记录\n")
            f.write("- expired_id_records.csv: 证件已过期的记录（需单独处理）\n")
            f.write("- warning_id_records.csv: 证件即将过期的记录（需提醒）\n")
            f.write("- duplicate_parent_records.csv: 同名家长的记录（需人工复核）\n")
            f.write("- invalid_records.csv: 字段验证失败的记录（需补全信息）\n")
            f.write("- all_records.csv: 所有原始记录（含处理标记）\n")
