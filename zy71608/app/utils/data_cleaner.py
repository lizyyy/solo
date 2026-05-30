import re
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, date
import pandas as pd
from decimal import Decimal, InvalidOperation


class DataCleaner:
    TYPOS_MAPPING = {
        "租户": ["组户", "阻户", "租户"],
        "合同编号": ["合同编好", "合编号", "合同号"],
        "合同号": ["合同编号"],
        "租金": ["组金", "阻金"],
        "面积": ["面積", "面织"],
        "日期": ["曰期", "日期"],
        "减免": ["减兔", "减勉"],
        "闭店": ["闭点", "毕店"],
        "天数": ["天數", "天树"],
        "金额": ["金額", "金颔"],
        "商户名称": ["商户名", "租户名称"],
        "租户名称": ["商户名称", "商户名"],
        "品牌": ["品脾", "品版"],
        "楼层": ["楼層", "搂层"],
        "铺位": ["铺为", "铺位号"],
        "起始日期": ["开始日期", "起始日"],
        "结束日期": ["终止日期", "结束日"],
        "月租金": ["月租", "月租金标准"],
        "物业费": ["物业服务费", "管理费"],
    }

    DATE_FORMATS = [
        "%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d",
        "%Y年%m月%d日", "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S", "%m/%d/%Y", "%d/%m/%Y",
        "%Y%m%d",
    ]

    @classmethod
    def remove_empty_columns(cls, df: pd.DataFrame) -> Tuple[pd.DataFrame, int]:
        initial_cols = len(df.columns)
        df = df.dropna(axis=1, how="all")
        non_empty_mask = df.apply(lambda col: col.astype(str).str.strip().ne("").any(), axis=0)
        df = df.loc[:, non_empty_mask]
        removed = initial_cols - len(df.columns)
        return df, removed

    @classmethod
    def remove_duplicate_rows(cls, df: pd.DataFrame) -> Tuple[pd.DataFrame, int]:
        initial_rows = len(df)
        df = df.drop_duplicates(keep="first")
        removed = initial_rows - len(df)
        return df, removed

    @classmethod
    def normalize_column_names(cls, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        warnings = []
        new_columns = {}

        for col in df.columns:
            original_col = str(col).strip()
            normalized_col = original_col

            for correct_name, typos in cls.TYPOS_MAPPING.items():
                if original_col in typos and original_col != correct_name:
                    if correct_name not in df.columns and correct_name not in new_columns.values():
                        normalized_col = correct_name
                        warnings.append(f"列名纠错: '{original_col}' -> '{correct_name}'")
                    break

            normalized_col = re.sub(r"\s+", "", normalized_col)
            normalized_col = re.sub(r"[（(].*?[）)]", "", normalized_col)
            normalized_col = normalized_col.replace(" ", "")

            new_columns[col] = normalized_col

        df = df.rename(columns=new_columns)

        existing_cols = set()
        final_columns = {}
        for col in df.columns:
            if col in existing_cols:
                i = 1
                new_col = f"{col}_{i}"
                while new_col in existing_cols:
                    i += 1
                    new_col = f"{col}_{i}"
                final_columns[col] = new_col
                warnings.append(f"列名重复，已重命名: '{col}' -> '{new_col}'")
                existing_cols.add(new_col)
            else:
                final_columns[col] = col
                existing_cols.add(col)

        df = df.rename(columns=final_columns)
        return df, warnings

    @classmethod
    def clean_whitespace(cls, df: pd.DataFrame) -> pd.DataFrame:
        for col in df.select_dtypes(include=["object"]).columns:
            df[col] = df[col].astype(str).str.strip()
            df[col] = df[col].replace(["", "nan", "None", "null", "NaN"], None)
        return df

    @classmethod
    def parse_date(cls, value: Any) -> Optional[date]:
        if value is None or pd.isna(value):
            return None

        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value

        value_str = str(value).strip()
        if not value_str or value_str in ["-", "/", "无", "未填写"]:
            return None

        value_str = re.sub(r"[年月]", "-", value_str)
        value_str = re.sub(r"日", "", value_str)
        value_str = re.sub(r"\s+", "", value_str)

        for fmt in cls.DATE_FORMATS:
            try:
                return datetime.strptime(value_str, fmt).date()
            except (ValueError, TypeError):
                continue

        try:
            ts = pd.to_datetime(value_str)
            if pd.notna(ts):
                return ts.date()
        except (ValueError, TypeError):
            pass

        return None

    @classmethod
    def parse_decimal(cls, value: Any) -> Optional[Decimal]:
        if value is None or pd.isna(value):
            return None

        if isinstance(value, Decimal):
            return value

        value_str = str(value).strip()
        if not value_str or value_str in ["-", "/", "无", "未填写"]:
            return None

        value_str = re.sub(r"[,\s￥¥$]", "", value_str)
        value_str = re.sub(r"[元块]$", "", value_str)

        try:
            return Decimal(value_str)
        except (InvalidOperation, ValueError):
            return None

    @classmethod
    def parse_int(cls, value: Any) -> Optional[int]:
        if value is None or pd.isna(value):
            return None

        if isinstance(value, int):
            return value

        value_str = str(value).strip()
        if not value_str or value_str in ["-", "/", "无", "未填写"]:
            return None

        value_str = re.sub(r"[,\s天年月日个]", "", value_str)

        try:
            return int(float(value_str))
        except (ValueError, TypeError):
            return None

    @classmethod
    def find_column(cls, df: pd.DataFrame, possible_names: List[str]) -> Optional[str]:
        columns_lower = {col.lower(): col for col in df.columns}
        for name in possible_names:
            if name in df.columns:
                return name
            if name.lower() in columns_lower:
                return columns_lower[name.lower()]
            for col in df.columns:
                if name in col or col in name:
                    return col
        return None

    @classmethod
    def validate_required_fields(
        cls, row: Dict[str, Any], required_fields: List[str]
    ) -> Tuple[bool, List[str]]:
        errors = []
        for field in required_fields:
            if field not in row or row[field] is None or row[field] == "":
                errors.append(f"缺少必填字段: {field}")
        return len(errors) == 0, errors

    @classmethod
    def clean_dataframe(cls, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        stats = {
            "empty_columns_removed": 0,
            "duplicate_rows_removed": 0,
            "warnings": [],
            "errors": [],
        }

        df, stats["empty_columns_removed"] = cls.remove_empty_columns(df)
        df, stats["duplicate_rows_removed"] = cls.remove_duplicate_rows(df)
        df, col_warnings = cls.normalize_column_names(df)
        stats["warnings"].extend(col_warnings)
        df = cls.clean_whitespace(df)

        return df, stats
