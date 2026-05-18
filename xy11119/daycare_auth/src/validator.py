from datetime import datetime, timedelta
from typing import List, Dict, Any
import pandas as pd
import hashlib

from src.config import AppConfig


class AuthValidator:
    def __init__(self, config: AppConfig):
        self.config = config
        self.rules = config.validation_rules

    def check_id_expiry(self, df: pd.DataFrame, reference_date: datetime = None) -> pd.DataFrame:
        if reference_date is None:
            reference_date = datetime.now()
        
        df["id_expiry_status"] = "正常"
        df["id_days_until_expiry"] = None
        
        for idx, row in df.iterrows():
            expiry_date = row.get("id_expiry_date_parsed")
            if expiry_date is None or pd.isna(expiry_date):
                df.at[idx, "id_expiry_status"] = "未提供有效期"
                continue
            
            days_until = (expiry_date - reference_date).days
            df.at[idx, "id_days_until_expiry"] = days_until
            
            if days_until < self.rules.id_expiry_days_error:
                df.at[idx, "id_expiry_status"] = "已过期"
            elif days_until < self.rules.id_expiry_days_warning:
                df.at[idx, "id_expiry_status"] = "即将过期"
        
        return df

    def check_auth_period(self, df: pd.DataFrame, reference_date: datetime = None) -> pd.DataFrame:
        if reference_date is None:
            reference_date = datetime.now()
        
        df["auth_status"] = "有效"
        
        for idx, row in df.iterrows():
            start_date = row.get("auth_start_date_parsed")
            end_date = row.get("auth_end_date_parsed")
            
            if start_date and reference_date < start_date:
                df.at[idx, "auth_status"] = "未开始"
            
            if end_date and reference_date > end_date:
                df.at[idx, "auth_status"] = "已过期"
        
        return df

    def find_duplicate_parents(self, df: pd.DataFrame) -> pd.DataFrame:
        match_columns = self.config.duplicate_handling.match_columns
        
        df["duplicate_group_id"] = None
        df["is_duplicate"] = False
        df["duplicate_note"] = ""
        
        for idx, row in df.iterrows():
            match_key_parts = []
            for col in match_columns:
                val = str(row.get(col, "")).strip()
                match_key_parts.append(val)
            
            match_key = "|".join(match_key_parts)
            group_id = hashlib.md5(match_key.encode()).hexdigest()[:8]
            df.at[idx, "duplicate_group_id"] = group_id
        
        group_counts = df["duplicate_group_id"].value_counts()
        duplicate_groups = group_counts[group_counts > 1].index
        
        for group_id in duplicate_groups:
            group_mask = df["duplicate_group_id"] == group_id
            group_records = df[group_mask]
            
            df.loc[group_mask, "is_duplicate"] = True
            
            child_names = group_records["child_name"].tolist()
            df.loc[group_mask, "duplicate_note"] = f"同名家长涉及儿童: {', '.join(child_names)}"
        
        return df

    def get_expired_records(self, df: pd.DataFrame) -> pd.DataFrame:
        return df[df["id_expiry_status"] == "已过期"].copy()

    def get_warning_records(self, df: pd.DataFrame) -> pd.DataFrame:
        return df[df["id_expiry_status"] == "即将过期"].copy()

    def get_duplicate_records(self, df: pd.DataFrame) -> pd.DataFrame:
        return df[df["is_duplicate"]].copy()

    def get_valid_records(self, df: pd.DataFrame) -> pd.DataFrame:
        valid_mask = (
            (df["id_expiry_status"] == "正常") &
            (~df["is_duplicate"]) &
            (df["validation_errors"] == "")
        )
        return df[valid_mask].copy()
