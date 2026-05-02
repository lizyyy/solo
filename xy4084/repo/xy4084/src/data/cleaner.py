from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import pandas as pd
import numpy as np

from config import config
from src.models import (
    Patient,
    TrainingRecord,
    PainRecord,
    MovementRecord,
    FollowUpRecord,
    SummaryMetrics,
)


class DataCleaner:
    def __init__(self):
        self.cleaned_data: Dict[str, pd.DataFrame] = {}
        self.warnings: List[Dict[str, Any]] = []

    def clean_dataframe(self, df: pd.DataFrame, data_type: str) -> pd.DataFrame:
        df = df.copy()
        df.columns = df.columns.str.lower().str.strip()
        
        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"], errors="coerce")
        
        if data_type == "patient":
            df = self._clean_patient_data(df)
        elif data_type == "training":
            df = self._clean_training_data(df)
        elif data_type == "pain":
            df = self._clean_pain_data(df)
        elif data_type == "movement":
            df = self._clean_movement_data(df)
        elif data_type == "followup":
            df = self._clean_followup_data(df)

        df = self._remove_duplicates(df, data_type)
        return df

    def _clean_patient_data(self, df: pd.DataFrame) -> pd.DataFrame:
        if "age" in df.columns:
            df["age"] = pd.to_numeric(df["age"], errors="coerce")
            invalid_age = df["age"].isna() | (df["age"] < 0) | (df["age"] > 150)
            if invalid_age.any():
                self.warnings.append({
                    "type": "patient",
                    "message": f"发现 {invalid_age.sum()} 条年龄数据异常，已标记为缺失",
                })
                df.loc[invalid_age, "age"] = np.nan

        if "patient_id" in df.columns:
            df["patient_id"] = df["patient_id"].astype(str).str.strip()
            empty_patient_id = df["patient_id"].isna() | (df["patient_id"] == "")
            if empty_patient_id.any():
                self.warnings.append({
                    "type": "patient",
                    "message": f"发现 {empty_patient_id.sum()} 条患者ID为空，已移除",
                })
                df = df[~empty_patient_id]

        return df

    def _clean_training_data(self, df: pd.DataFrame) -> pd.DataFrame:
        if "is_completed" in df.columns:
            df["is_completed"] = df["is_completed"].astype(str).str.lower().str.strip()
            df["is_completed"] = df["is_completed"].isin(
                ["true", "1", "yes", "是", "完成", "已完成", "done", "completed"]
            )

        if "completion_percentage" in df.columns:
            df["completion_percentage"] = pd.to_numeric(df["completion_percentage"], errors="coerce")
            df["completion_percentage"] = df["completion_percentage"].clip(0, 100)

        if "duration_minutes" in df.columns:
            df["duration_minutes"] = pd.to_numeric(df["duration_minutes"], errors="coerce")
            invalid_duration = df["duration_minutes"].isna() | (df["duration_minutes"] < 0) | (df["duration_minutes"] > 480)
            if invalid_duration.any():
                self.warnings.append({
                    "type": "training",
                    "message": f"发现 {invalid_duration.sum()} 条训练时长异常",
                })

        if "patient_id" in df.columns:
            df["patient_id"] = df["patient_id"].astype(str).str.strip()

        return df

    def _clean_pain_data(self, df: pd.DataFrame) -> pd.DataFrame:
        if "pain_score" in df.columns:
            df["pain_score"] = pd.to_numeric(df["pain_score"], errors="coerce")
            invalid_score = df["pain_score"].isna() | (df["pain_score"] < 0) | (df["pain_score"] > 10)
            if invalid_score.any():
                self.warnings.append({
                    "type": "pain",
                    "message": f"发现 {invalid_score.sum()} 条疼痛评分异常（应在0-10之间）",
                })
                df.loc[invalid_score, "pain_score"] = np.nan

        if "patient_id" in df.columns:
            df["patient_id"] = df["patient_id"].astype(str).str.strip()

        return df

    def _clean_movement_data(self, df: pd.DataFrame) -> pd.DataFrame:
        score_columns = ["completion_score", "form_quality", "range_of_motion", "symmetry_score"]
        for col in score_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
                df[col] = df[col].clip(0, 100)

        if "patient_id" in df.columns:
            df["patient_id"] = df["patient_id"].astype(str).str.strip()

        return df

    def _clean_followup_data(self, df: pd.DataFrame) -> pd.DataFrame:
        if "next_follow_up_date" in df.columns:
            df["next_follow_up_date"] = pd.to_datetime(df["next_follow_up_date"], errors="coerce")

        if "patient_id" in df.columns:
            df["patient_id"] = df["patient_id"].astype(str).str.strip()

        return df

    def _remove_duplicates(self, df: pd.DataFrame, data_type: str) -> pd.DataFrame:
        key_columns = {
            "patient": ["patient_id"],
            "training": ["patient_id", "date", "training_program"],
            "pain": ["patient_id", "date", "pain_location"],
            "movement": ["patient_id", "date", "movement_name"],
            "followup": ["patient_id", "date", "follow_up_type"],
        }

        subset = [col for col in key_columns.get(data_type, []) if col in df.columns]
        if subset:
            original_count = len(df)
            df = df.drop_duplicates(subset=subset, keep="last")
            removed_count = original_count - len(df)
            if removed_count > 0:
                self.warnings.append({
                    "type": data_type,
                    "message": f"移除了 {removed_count} 条重复记录",
                })

        return df

    def clean_all_dataframes(self, dataframes: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
        self.cleaned_data.clear()
        self.warnings.clear()

        for data_type, df in dataframes.items():
            cleaned_df = self.clean_dataframe(df, data_type)
            self.cleaned_data[data_type] = cleaned_df

        return self.cleaned_data.copy()

    def merge_patient_data(self, patients_df: pd.DataFrame, training_df: Optional[pd.DataFrame] = None,
                           pain_df: Optional[pd.DataFrame] = None, movement_df: Optional[pd.DataFrame] = None,
                           followup_df: Optional[pd.DataFrame] = None) -> Dict[str, Any]:
        result = {
            "patients": patients_df.to_dict("records") if patients_df is not None else [],
            "patient_count": len(patients_df) if patients_df is not None else 0,
            "training_records": training_df.to_dict("records") if training_df is not None else [],
            "pain_records": pain_df.to_dict("records") if pain_df is not None else [],
            "movement_records": movement_df.to_dict("records") if movement_df is not None else [],
            "followup_records": followup_df.to_dict("records") if followup_df is not None else [],
            "data_by_patient": {},
        }

        patients_list = result["patients"]
        
        for patient in patients_list:
            patient_id = patient.get("patient_id", "")
            result["data_by_patient"][patient_id] = {
                "patient_info": patient,
                "training": [],
                "pain": [],
                "movement": [],
                "followup": [],
            }

        if training_df is not None:
            for _, record in training_df.iterrows():
                patient_id = str(record.get("patient_id", ""))
                if patient_id in result["data_by_patient"]:
                    result["data_by_patient"][patient_id]["training"].append(record.to_dict())

        if pain_df is not None:
            for _, record in pain_df.iterrows():
                patient_id = str(record.get("patient_id", ""))
                if patient_id in result["data_by_patient"]:
                    result["data_by_patient"][patient_id]["pain"].append(record.to_dict())

        if movement_df is not None:
            for _, record in movement_df.iterrows():
                patient_id = str(record.get("patient_id", ""))
                if patient_id in result["data_by_patient"]:
                    result["data_by_patient"][patient_id]["movement"].append(record.to_dict())

        if followup_df is not None:
            for _, record in followup_df.iterrows():
                patient_id = str(record.get("patient_id", ""))
                if patient_id in result["data_by_patient"]:
                    result["data_by_patient"][patient_id]["followup"].append(record.to_dict())

        return result

    def get_cleaned_dataframe(self, data_type: str) -> Optional[pd.DataFrame]:
        return self.cleaned_data.get(data_type)

    def get_all_cleaned_dataframes(self) -> Dict[str, pd.DataFrame]:
        return self.cleaned_data.copy()

    def get_warnings(self) -> List[Dict[str, Any]]:
        return self.warnings.copy()

    def clear_cleaned_data(self):
        self.cleaned_data.clear()
        self.warnings.clear()
