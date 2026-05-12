import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any
from datetime import datetime
from .exceptions import (
    MissingDataError,
    UnitConversionError,
    SampleProcessingError,
)


STANDARD_UNITS = {
    "pH": "pH",
    "temperature": "°C",
    "temperature_celsius": "°C",
    "temperature_fahrenheit": "°F",
    "dissolved_oxygen": "%",
    "time": "hour",
}


UNIT_CONVERSIONS = {
    "pH": {
        "pH": lambda x: x,
    },
    "temperature": {
        "°C": lambda x: x,
        "C": lambda x: x,
        "celsius": lambda x: x,
        "°F": lambda x: (x - 32) * 5 / 9,
        "F": lambda x: (x - 32) * 5 / 9,
        "fahrenheit": lambda x: (x - 32) * 5 / 9,
        "K": lambda x: x - 273.15,
    },
    "dissolved_oxygen": {
        "%": lambda x: x,
        "percent": lambda x: x,
        "mg/L": lambda x: x,
        "ppm": lambda x: x,
    },
    "time": {
        "hour": lambda x: x,
        "h": lambda x: x,
        "hr": lambda x: x,
        "minute": lambda x: x / 60,
        "min": lambda x: x / 60,
        "second": lambda x: x / 3600,
        "sec": lambda x: x / 3600,
        "day": lambda x: x * 24,
        "d": lambda x: x * 24,
    },
}


REQUIRED_COLUMNS = [
    "sample_id",
    "batch_id",
    "time",
    "pH",
    "temperature",
    "dissolved_oxygen",
]


class DataPreprocessor:
    def __init__(
        self,
        required_columns: Optional[List[str]] = None,
        missing_threshold: float = 0.3,
        duplicate_strategy: str = "keep_first",
        interpolation_method: str = "linear",
    ):
        self.required_columns = required_columns or REQUIRED_COLUMNS
        self.missing_threshold = missing_threshold
        self.duplicate_strategy = duplicate_strategy
        self.interpolation_method = interpolation_method
        self.processing_log = []

    def _log(self, message: str, level: str = "info", sample_id: Optional[str] = None):
        self.processing_log.append(
            {
                "timestamp": datetime.now().isoformat(),
                "level": level,
                "sample_id": sample_id,
                "message": message,
            }
        )

    def load_data(self, file_path: str, sheet_name: Optional[str] = None) -> pd.DataFrame:
        try:
            if file_path.endswith((".xls", ".xlsx")):
                df = pd.read_excel(file_path, sheet_name=sheet_name)
            elif file_path.endswith(".csv"):
                df = pd.read_csv(file_path)
            else:
                raise ValueError(f"不支持的文件格式: {file_path}")
            self._log(f"成功加载文件: {file_path}, {len(df)} 条记录")
            return df
        except Exception as e:
            raise SampleProcessingError(
                f"文件加载失败: {str(e)}",
                stage="load_data",
                original_error=e,
            )

    def validate_columns(self, df: pd.DataFrame) -> List[str]:
        missing_cols = [col for col in self.required_columns if col not in df.columns]
        if missing_cols:
            raise MissingDataError(
                f"缺少必需列: {missing_cols}",
                missing_columns=missing_cols,
            )
        self._log("列验证通过")
        return []

    def _get_unit_from_column(
        self,
        df: pd.DataFrame,
        param: str,
    ) -> Optional[str]:
        unit_col = f"{param}_unit"
        if unit_col not in df.columns:
            return None

        unit_series = df[unit_col]
        if unit_series.empty:
            return None

        if pd.api.types.is_numeric_dtype(unit_series):
            return None

        valid_units = unit_series.dropna()
        if valid_units.empty:
            return None

        unique_units = valid_units.unique()
        if len(unique_units) == 0:
            return None

        if len(unique_units) > 1:
            self._log(
                f"发现混合单位 {param}: {list(unique_units)}，使用多数单位",
                level="warning",
            )
            unit_counts = valid_units.value_counts()
            return str(unit_counts.index[0])

        return str(unique_units[0])

    def convert_units(
        self,
        df: pd.DataFrame,
        unit_info: Optional[Dict[str, str]] = None,
    ) -> pd.DataFrame:
        df = df.copy()
        unit_info = unit_info or {}

        conversions_applied = []

        for param, param_conversions in UNIT_CONVERSIONS.items():
            if param not in df.columns:
                continue

            unit = unit_info.get(param)
            if unit is None:
                unit = self._get_unit_from_column(df, param)
            if unit is None:
                unit = self._detect_unit(df[param], param)

            if not isinstance(unit, str) or unit not in param_conversions:
                raise UnitConversionError(
                    f"参数 {param} 不支持的单位: {unit}",
                    parameter=param,
                    unit=str(unit),
                )

            if param in UNIT_CONVERSIONS and unit != list(UNIT_CONVERSIONS[param].keys())[0]:
                df[param] = param_conversions[unit](df[param])
                conversions_applied.append(f"{param}: {unit} -> 标准单位")

        if conversions_applied:
            self._log(f"单位转换完成: {conversions_applied}")
        return df

    def _detect_unit(self, series: pd.Series, parameter: str) -> str:
        if parameter == "temperature":
            max_val = series.max()
            if max_val > 100:
                return "°F"
            return "°C"
        elif parameter == "time":
            max_val = series.max()
            if max_val > 1000:
                return "second"
            elif max_val > 100:
                return "minute"
            return "hour"
        elif parameter == "dissolved_oxygen":
            max_val = series.max()
            if max_val > 100:
                return "mg/L"
            return "%"
        return list(UNIT_CONVERSIONS[parameter].keys())[0]

    def handle_duplicates(self, df: pd.DataFrame) -> pd.DataFrame:
        original_count = len(df)
        subset = ["sample_id", "batch_id", "time"]
        existing_subset = [col for col in subset if col in df.columns]

        if not existing_subset:
            self._log("无有效键列用于去重，跳过去重", level="warning")
            return df

        if self.duplicate_strategy == "keep_first":
            df_clean = df.drop_duplicates(subset=existing_subset, keep="first")
        elif self.duplicate_strategy == "keep_last":
            df_clean = df.drop_duplicates(subset=existing_subset, keep="last")
        else:
            df_clean = df.drop_duplicates(subset=existing_subset, keep=False)

        removed = original_count - len(df_clean)
        if removed > 0:
            self._log(f"移除重复记录: {removed} 条", level="warning")
        return df_clean

    def handle_missing_values(self, df: pd.DataFrame) -> Dict[str, Any]:
        df = df.copy()
        missing_report = {}

        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                missing_count = df[col].isna().sum()
                total_count = len(df)
                missing_ratio = missing_count / total_count if total_count > 0 else 0

                if missing_count > 0:
                    missing_report[col] = {
                        "total_missing": missing_count,
                        "missing_ratio": round(missing_ratio, 4),
                    }

                    if missing_ratio > self.missing_threshold:
                        missing_report[col]["action"] = "dropped_exceeds_threshold"
                    else:
                        df[col] = df[col].interpolate(method=self.interpolation_method)
                        df[col] = df[col].ffill().bfill()
                        missing_report[col]["action"] = "interpolated"

        self._log(f"缺失值处理完成: {len(missing_report)} 列有缺失")
        return {"dataframe": df, "missing_report": missing_report}

    def process_sample(
        self,
        df: pd.DataFrame,
        sample_id: str,
        unit_info: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        result = {
            "sample_id": sample_id,
            "success": False,
            "errors": [],
            "warnings": [],
            "dataframe": None,
            "processing_steps": [],
        }

        try:
            sample_df = df[df["sample_id"] == sample_id].copy()
            if len(sample_df) == 0:
                raise MissingDataError(f"样本 {sample_id} 无数据记录", sample_id=sample_id)

            result["processing_steps"].append("数据筛选完成")

            missing_cols = [
                col for col in self.required_columns
                if col != "sample_id" and col not in sample_df.columns
            ]
            if missing_cols:
                raise MissingDataError(
                    f"样本 {sample_id} 缺少必需列: {missing_cols}",
                    sample_id=sample_id,
                    missing_columns=missing_cols,
                )

            result["processing_steps"].append("必需列验证完成")

            sample_df = self.handle_duplicates(sample_df)
            result["processing_steps"].append("重复值处理完成")

            sample_df = self.convert_units(sample_df, unit_info)
            result["processing_steps"].append("单位转换完成")

            missing_result = self.handle_missing_values(sample_df)
            sample_df = missing_result["dataframe"]
            result["missing_report"] = missing_result["missing_report"]
            result["processing_steps"].append("缺失值处理完成")

            curve_columns = ["pH", "temperature", "dissolved_oxygen"]
            completely_empty_columns = []
            for col in curve_columns:
                if col in sample_df.columns and sample_df[col].isna().all():
                    completely_empty_columns.append(col)

            if completely_empty_columns:
                raise MissingDataError(
                    f"样本 {sample_id} 的曲线列完全为空: {completely_empty_columns}",
                    sample_id=sample_id,
                    missing_columns=completely_empty_columns,
                )

            result["processing_steps"].append("曲线列完整性验证完成")

            result["dataframe"] = sample_df
            result["success"] = True
            self._log(f"样本 {sample_id} 预处理完成", sample_id=sample_id)

        except Exception as e:
            result["errors"].append({
                "error_type": type(e).__name__,
                "message": str(e),
                "details": getattr(e, "to_dict", lambda: {})(),
            })
            self._log(f"样本 {sample_id} 预处理失败: {str(e)}", level="error", sample_id=sample_id)

        return result

    def process_all_samples(
        self,
        df: pd.DataFrame,
        unit_info: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        if "sample_id" not in df.columns:
            raise MissingDataError("数据缺少 sample_id 列")

        sample_ids = df["sample_id"].unique()
        results = {}
        failed_samples = {}

        for sample_id in sample_ids:
            result = self.process_sample(df, sample_id, unit_info)
            if result["success"]:
                results[sample_id] = result
            else:
                failed_samples[sample_id] = result

        return {
            "processed_samples": results,
            "failed_samples": failed_samples,
            "total_samples": len(sample_ids),
            "success_count": len(results),
            "failed_count": len(failed_samples),
            "processing_log": self.processing_log,
        }
