import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from .config import Config, DEFAULT_CONFIG
import hashlib
import warnings


class SampleProcessor:
    def __init__(self, config: Config = DEFAULT_CONFIG):
        self.config = config
        self.processing_log = []
        self.issues = {
            "empty_values": [],
            "duplicates": [],
            "boundary_records": []
        }

    def load_data(self, file_path: str, source_name: str = "unknown") -> pd.DataFrame:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        elif file_path.endswith('.xlsx'):
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_path}")
        
        df = self._add_metadata(df, source_name)
        self._log(f"Loaded {len(df)} records from {file_path} (source: {source_name})")
        return df

    def _add_metadata(self, df: pd.DataFrame, source_name: str) -> pd.DataFrame:
        df = df.copy()
        if "source" not in df.columns:
            df["source"] = source_name
        if "process_time" not in df.columns:
            df["process_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if "sample_id" not in df.columns:
            df["sample_id"] = df.apply(self._generate_sample_id, axis=1)
        return df

    def _generate_sample_id(self, row) -> str:
        key_parts = []
        for col in self.config.duplicate_detection_cols:
            if col in row and pd.notna(row[col]):
                key_parts.append(str(row[col]))
        key_str = "|".join(key_parts)
        return hashlib.md5(key_str.encode()).hexdigest()[:12]

    def process_samples(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
        self._log("=== 开始样本处理 ===")
        df = df.copy()
        
        df = self._handle_empty_values(df)
        df = self._detect_and_remove_duplicates(df)
        self._detect_boundary_records(df)
        
        summary = self._get_processing_summary(df)
        self._log(f"样本处理完成，保留 {len(df)} 条有效记录")
        
        return df, summary

    def _handle_empty_values(self, df: pd.DataFrame) -> pd.DataFrame:
        empty_issues = []
        
        for col in df.columns:
            if df[col].dtype == 'object':
                for indicator in self.config.empty_value_indicators:
                    mask = df[col] == indicator
                    if mask.any():
                        df.loc[mask, col] = np.nan
        
        for col in df.columns:
            empty_count = df[col].isna().sum()
            if empty_count > 0:
                empty_rows = df[df[col].isna()].index.tolist()
                empty_issues.append({
                    "column": col,
                    "count": empty_count,
                    "ratio": empty_count / len(df),
                    "sample_rows": empty_rows[:5]
                })
                self._log(f"⚠️  列 [{col}] 发现 {empty_count} 个空值 ({empty_count/len(df):.1%})")
        
        self.issues["empty_values"] = empty_issues
        
        important_cols = ["sample_id", "user_id", "apply_time"]
        for col in important_cols:
            if col in df.columns:
                df = df.dropna(subset=[col])
        
        return df

    def _detect_and_remove_duplicates(self, df: pd.DataFrame) -> pd.DataFrame:
        dup_issues = []
        
        df["dup_key"] = df.apply(
            lambda row: "|".join([str(row.get(c, "")) for c in self.config.duplicate_detection_cols if pd.notna(row.get(c, ""))]),
            axis=1
        )
        
        duplicate_groups = df[df.duplicated("dup_key", keep=False)].groupby("dup_key")
        
        for key, group in duplicate_groups:
            if len(group) > 1:
                dup_issues.append({
                    "key": key,
                    "count": len(group),
                    "sample_ids": group["sample_id"].tolist(),
                    "sources": group["source"].unique().tolist(),
                    "apply_times": group["apply_time"].unique().tolist()
                })
                self._log(f"⚠️  发现重复样本 [key={key[:30]}...]: {len(group)} 条记录，来源: {group['source'].unique().tolist()}")
        
        self.issues["duplicates"] = dup_issues
        
        df_clean = df.drop_duplicates("dup_key", keep="first").copy()
        df_clean = df_clean.drop(columns=["dup_key"])
        
        self._log(f"去重完成: 移除 {len(df) - len(df_clean)} 条重复记录")
        return df_clean

    def _detect_boundary_records(self, df: pd.DataFrame):
        boundary_issues = []
        
        if "loan_amount" in df.columns:
            q1 = df["loan_amount"].quantile(0.01)
            q99 = df["loan_amount"].quantile(0.99)
            boundary_low = df[df["loan_amount"] <= q1]
            boundary_high = df[df["loan_amount"] >= q99]
            
            if len(boundary_low) > 0:
                boundary_issues.append({
                    "type": "loan_amount_low",
                    "description": f"贷款金额极低 (<= {q1:.0f})",
                    "count": len(boundary_low),
                    "sample_ids": boundary_low["sample_id"].tolist()[:5]
                })
            
            if len(boundary_high) > 0:
                boundary_issues.append({
                    "type": "loan_amount_high",
                    "description": f"贷款金额极高 (>= {q99:.0f})",
                    "count": len(boundary_high),
                    "sample_ids": boundary_high["sample_id"].tolist()[:5]
                })
        
        if "model_score" in df.columns:
            near_threshold = df[(df["model_score"] >= self.config.fraud_threshold - 0.05) & 
                               (df["model_score"] <= self.config.fraud_threshold + 0.05)]
            if len(near_threshold) > 0:
                boundary_issues.append({
                    "type": "score_near_threshold",
                    "description": f"模型评分接近阈值 ({self.config.fraud_threshold}±0.05)",
                    "count": len(near_threshold),
                    "threshold": self.config.fraud_threshold,
                    "sample_ids": near_threshold["sample_id"].tolist()[:5]
                })
                self._log(f"⚠️  发现 {len(near_threshold)} 条边界样本（评分接近阈值 {self.config.fraud_threshold}）")
        
        self.issues["boundary_records"] = boundary_issues

    def _get_processing_summary(self, df: pd.DataFrame) -> Dict:
        return {
            "total_records": len(df),
            "unique_users": df["user_id"].nunique() if "user_id" in df.columns else 0,
            "fraud_count": df["is_fraud"].sum() if "is_fraud" in df.columns else 0,
            "fraud_ratio": df["is_fraud"].mean() if "is_fraud" in df.columns else 0,
            "empty_value_issues": self.issues["empty_values"],
            "duplicate_issues": self.issues["duplicates"],
            "boundary_issues": self.issues["boundary_records"],
            "sources": df["source"].value_counts().to_dict(),
            "time_range": {
                "earliest": df["apply_time"].min() if "apply_time" in df.columns else None,
                "latest": df["apply_time"].max() if "apply_time" in df.columns else None
            }
        }

    def _log(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_msg = f"[{timestamp}] {message}"
        self.processing_log.append(log_msg)
        print(log_msg)

    def get_issues(self) -> Dict:
        return self.issues

    def get_log(self) -> List[str]:
        return self.processing_log
