import io
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import pandas as pd

from config import config, ensure_directories
from src.models import (
    Patient,
    TrainingRecord,
    PainRecord,
    MovementRecord,
    FollowUpRecord,
)


class DataImporter:
    PATIENT_SCHEMA = {
        "patient_id": str,
        "name": str,
        "age": int,
        "gender": str,
        "primary_diagnosis": str,
        "treatment_plan": str,
        "admission_date": str,
        "notes": str,
    }

    TRAINING_SCHEMA = {
        "patient_id": str,
        "date": str,
        "training_program": str,
        "is_completed": str,
        "completion_percentage": float,
        "duration_minutes": int,
        "difficulty_level": str,
        "notes": str,
    }

    PAIN_SCHEMA = {
        "patient_id": str,
        "date": str,
        "pain_location": str,
        "pain_score": int,
        "pain_type": str,
        "notes": str,
    }

    MOVEMENT_SCHEMA = {
        "patient_id": str,
        "date": str,
        "movement_name": str,
        "completion_score": float,
        "form_quality": float,
        "range_of_motion": float,
        "symmetry_score": float,
        "notes": str,
    }

    FOLLOWUP_SCHEMA = {
        "patient_id": str,
        "date": str,
        "therapist_name": str,
        "follow_up_type": str,
        "summary": str,
        "recommendations": str,
        "next_follow_up_date": str,
    }

    SCHEMA_MAPPING = {
        "patient": PATIENT_SCHEMA,
        "training": TRAINING_SCHEMA,
        "pain": PAIN_SCHEMA,
        "movement": MOVEMENT_SCHEMA,
        "followup": FOLLOWUP_SCHEMA,
    }

    DATA_TYPE_INDICATORS = {
        "patient": ["patient_id", "name", "age", "gender"],
        "training": ["patient_id", "date", "training_program", "is_completed"],
        "pain": ["patient_id", "date", "pain_location", "pain_score"],
        "movement": ["patient_id", "date", "movement_name", "completion_score"],
        "followup": ["patient_id", "date", "therapist_name", "follow_up_type"],
    }

    def __init__(self):
        ensure_directories()
        self.raw_data_dir = config.RAW_DATA_DIR
        self.imported_data: Dict[str, pd.DataFrame] = {}
        self.validation_errors: List[Dict[str, Any]] = []

    def detect_data_type(self, df: pd.DataFrame) -> Optional[str]:
        columns = set(df.columns.str.lower())
        for data_type, indicators in self.DATA_TYPE_INDICATORS.items():
            indicators_lower = {ind.lower() for ind in indicators}
            if indicators_lower.issubset(columns):
                return data_type
        return None

    def load_csv_from_file(self, file_path: str) -> pd.DataFrame:
        try:
            df = pd.read_csv(file_path, encoding="utf-8")
            return df
        except UnicodeDecodeError:
            df = pd.read_csv(file_path, encoding="gbk")
            return df
        except Exception as e:
            raise ValueError(f"读取文件失败: {str(e)}")

    def load_csv_from_bytes(self, file_bytes: bytes, file_name: str) -> pd.DataFrame:
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding="utf-8")
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding="gbk")
            except Exception as e:
                raise ValueError(f"读取文件 {file_name} 失败: {str(e)}")
        except Exception as e:
            raise ValueError(f"读取文件 {file_name} 失败: {str(e)}")
        return df

    def validate_columns(self, df: pd.DataFrame, data_type: str) -> Tuple[bool, List[str]]:
        schema = self.SCHEMA_MAPPING.get(data_type)
        if not schema:
            return False, ["未知的数据类型"]

        required_columns = {
            col.lower() for col, dtype in schema.items()
            if data_type == "patient" and col in ["patient_id", "name", "age", "gender"]
            or data_type == "training" and col in ["patient_id", "date", "training_program", "is_completed"]
            or data_type == "pain" and col in ["patient_id", "date", "pain_location", "pain_score"]
            or data_type == "movement" and col in ["patient_id", "date", "movement_name", "completion_score"]
            or data_type == "followup" and col in ["patient_id", "date", "therapist_name", "follow_up_type", "summary"]
        }

        df_columns = {col.lower() for col in df.columns}
        missing_columns = required_columns - df_columns

        if missing_columns:
            return False, [f"缺少必要列: {', '.join(missing_columns)}"]

        return True, []

    def parse_date(self, date_value: Any) -> Optional[date]:
        if pd.isna(date_value):
            return None
        if isinstance(date_value, date):
            return date_value
        if isinstance(date_value, datetime):
            return date_value.date()
        try:
            return pd.to_datetime(date_value).date()
        except:
            return None

    def parse_boolean(self, value: Any) -> bool:
        if pd.isna(value):
            return False
        if isinstance(value, bool):
            return value
        str_value = str(value).lower().strip()
        return str_value in ["true", "1", "yes", "是", "完成", "已完成"]

    def convert_to_model_objects(self, df: pd.DataFrame, data_type: str) -> List[Any]:
        objects = []
        df = df.copy()
        df.columns = df.columns.str.lower()

        if data_type == "patient":
            for _, row in df.iterrows():
                patient = Patient(
                    patient_id=str(row.get("patient_id", "")),
                    name=str(row.get("name", "")),
                    age=int(row.get("age", 0)) if pd.notna(row.get("age")) else 0,
                    gender=str(row.get("gender", "")),
                    primary_diagnosis=str(row.get("primary_diagnosis", "")) if pd.notna(row.get("primary_diagnosis")) else None,
                    treatment_plan=str(row.get("treatment_plan", "")) if pd.notna(row.get("treatment_plan")) else None,
                    admission_date=self.parse_date(row.get("admission_date")),
                    notes=str(row.get("notes", "")) if pd.notna(row.get("notes")) else None,
                )
                objects.append(patient)

        elif data_type == "training":
            for _, row in df.iterrows():
                record = TrainingRecord(
                    record_id=str(uuid.uuid4()),
                    patient_id=str(row.get("patient_id", "")),
                    date=self.parse_date(row.get("date")) or date.today(),
                    training_program=str(row.get("training_program", "")),
                    is_completed=self.parse_boolean(row.get("is_completed", False)),
                    completion_percentage=float(row.get("completion_percentage", 0.0)) if pd.notna(row.get("completion_percentage")) else 0.0,
                    duration_minutes=int(row.get("duration_minutes", 0)) if pd.notna(row.get("duration_minutes")) else 0,
                    difficulty_level=str(row.get("difficulty_level", "")) if pd.notna(row.get("difficulty_level")) else None,
                    notes=str(row.get("notes", "")) if pd.notna(row.get("notes")) else None,
                )
                objects.append(record)

        elif data_type == "pain":
            for _, row in df.iterrows():
                record = PainRecord(
                    record_id=str(uuid.uuid4()),
                    patient_id=str(row.get("patient_id", "")),
                    date=self.parse_date(row.get("date")) or date.today(),
                    pain_location=str(row.get("pain_location", "")),
                    pain_score=int(row.get("pain_score", 0)) if pd.notna(row.get("pain_score")) else 0,
                    pain_type=str(row.get("pain_type", "")) if pd.notna(row.get("pain_type")) else None,
                    notes=str(row.get("notes", "")) if pd.notna(row.get("notes")) else None,
                )
                objects.append(record)

        elif data_type == "movement":
            for _, row in df.iterrows():
                record = MovementRecord(
                    record_id=str(uuid.uuid4()),
                    patient_id=str(row.get("patient_id", "")),
                    date=self.parse_date(row.get("date")) or date.today(),
                    movement_name=str(row.get("movement_name", "")),
                    completion_score=float(row.get("completion_score", 0.0)) if pd.notna(row.get("completion_score")) else 0.0,
                    form_quality=float(row.get("form_quality", 0.0)) if pd.notna(row.get("form_quality")) else None,
                    range_of_motion=float(row.get("range_of_motion", 0.0)) if pd.notna(row.get("range_of_motion")) else None,
                    symmetry_score=float(row.get("symmetry_score", 0.0)) if pd.notna(row.get("symmetry_score")) else None,
                    notes=str(row.get("notes", "")) if pd.notna(row.get("notes")) else None,
                )
                objects.append(record)

        elif data_type == "followup":
            for _, row in df.iterrows():
                record = FollowUpRecord(
                    record_id=str(uuid.uuid4()),
                    patient_id=str(row.get("patient_id", "")),
                    date=self.parse_date(row.get("date")) or date.today(),
                    therapist_name=str(row.get("therapist_name", "")),
                    follow_up_type=str(row.get("follow_up_type", "")),
                    summary=str(row.get("summary", "")),
                    recommendations=str(row.get("recommendations", "")) if pd.notna(row.get("recommendations")) else None,
                    next_follow_up_date=self.parse_date(row.get("next_follow_up_date")),
                )
                objects.append(record)

        return objects

    def import_file(self, file_path: str) -> Tuple[str, int, List[str]]:
        df = self.load_csv_from_file(file_path)
        data_type = self.detect_data_type(df)
        
        if not data_type:
            return "unknown", 0, ["无法识别数据类型，请检查CSV格式"]

        is_valid, errors = self.validate_columns(df, data_type)
        if not is_valid:
            return data_type, 0, errors

        if data_type in self.imported_data:
            existing_df = self.imported_data[data_type]
            merged_df = pd.concat([existing_df, df], ignore_index=True).drop_duplicates()
            self.imported_data[data_type] = merged_df
        else:
            self.imported_data[data_type] = df

        count = len(df)
        return data_type, count, []

    def import_files(self, file_paths: List[str]) -> Dict[str, Any]:
        results = {
            "total_files": len(file_paths),
            "successful_imports": 0,
            "failed_imports": 0,
            "imported_types": {},
            "errors": [],
        }

        for file_path in file_paths:
            try:
                data_type, count, errors = self.import_file(file_path)
                if errors:
                    results["errors"].append({
                        "file": file_path,
                        "errors": errors,
                    })
                    results["failed_imports"] += 1
                else:
                    if data_type not in results["imported_types"]:
                        results["imported_types"][data_type] = 0
                    results["imported_types"][data_type] += count
                    results["successful_imports"] += 1
            except Exception as e:
                results["errors"].append({
                    "file": file_path,
                    "error": str(e),
                })
                results["failed_imports"] += 1

        return results

    def get_dataframe(self, data_type: str) -> Optional[pd.DataFrame]:
        return self.imported_data.get(data_type)

    def get_all_dataframes(self) -> Dict[str, pd.DataFrame]:
        return self.imported_data.copy()

    def clear_imported_data(self):
        self.imported_data.clear()
        self.validation_errors.clear()
