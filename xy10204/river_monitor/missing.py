"""缺测标记模块 - 识别和标记缺失数据"""

import pandas as pd
from typing import Tuple, List, Dict
import logging
from .config import MIN_VALID_VALUES

logger = logging.getLogger(__name__)


class MissingDataMarker:
    """缺测数据标记器"""

    def __init__(self):
        self.valid_ranges = MIN_VALID_VALUES

    def mark_missing(self, df: pd.DataFrame) -> pd.DataFrame:
        """标记缺失数据"""
        df = df.copy()

        if df.empty:
            return df

        value_columns = [col for col in df.columns
                       if any(key in col for key in ["water_level", "rainfall", "gate_opening"])]

        for col in value_columns:
            df[f"{col}_missing"] = df[col].isna()

        return df

    def validate_values(self, df: pd.DataFrame) -> pd.DataFrame:
        """验证数值有效性并标记异常值"""
        df = df.copy()

        value_columns = {
            "water_level_m": "water_level",
            "rainfall_mm": "rainfall",
            "gate_opening_m": "gate_opening"
        }

        for col, data_type in value_columns.items():
            if col not in df.columns:
                continue

            valid_range = self.valid_ranges.get(data_type)
            if valid_range:
                min_val, max_val = valid_range
                df[f"{col}_invalid"] = (
                    (df[col] < min_val) | (df[col] > max_val) | df[col].isna()
                )
            else:
                df[f"{col}_invalid"] = df[col].isna()

        return df

    def get_missing_summary(self, df: pd.DataFrame) -> Dict:
        """生成缺失数据汇总"""
        if df.empty:
            return {}

        summary = {
            "total_records": len(df),
            "missing": {},
            "invalid": {},
            "missing_timestamps": []
        }

        missing_cols = [col for col in df.columns if col.endswith("_missing")]
        invalid_cols = [col for col in df.columns if col.endswith("_invalid")]

        for col in missing_cols:
            original_col = col.replace("_missing", "")
            count = df[col].sum()
            percentage = (count / len(df)) * 100
            summary["missing"][original_col] = {
                "count": int(count),
                "percentage": round(percentage, 2)
            }

            if count > 0:
                missing_rows = df[df[col]]["timestamp"].tolist()
                summary["missing_timestamps"].extend([
                    {"column": original_col, "timestamp": ts}
                    for ts in missing_rows
                ])

        for col in invalid_cols:
            original_col = col.replace("_invalid", "")
            count = df[col].sum()
            percentage = (count / len(df)) * 100
            summary["invalid"][original_col] = {
                "count": int(count),
                "percentage": round(percentage, 2)
            }

        return summary

    def generate_report(self, df: pd.DataFrame) -> str:
        """生成缺测报告文本"""
        summary = self.get_missing_summary(df)

        if not summary:
            return "无数据可分析"

        report = []
        report.append(f"总记录数: {summary['total_records']}")
        report.append("")
        report.append("缺失数据统计:")

        for col, stats in summary["missing"].items():
            report.append(f"  {col}:")
            report.append(f"    缺失数量: {stats['count']} ({stats['percentage']}%)")

        report.append("")
        report.append("无效数据统计:")

        for col, stats in summary["invalid"].items():
            report.append(f"  {col}:")
            report.append(f"    无效数量: {stats['count']} ({stats['percentage']}%)")

        return "\n".join(report)
