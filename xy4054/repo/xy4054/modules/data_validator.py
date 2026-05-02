import re
import pandas as pd
import numpy as np
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple, Any, Callable
from dataclasses import dataclass, field
from pathlib import Path
import io

from config.settings import VALIDATION_RULES, MEAL_TYPES
from models.schemas import (
    OrderRecord,
    ServingRecord,
    WasteRecord,
    ElderlyInfo,
    DishInfo,
    ValidationError
)
from models.enums import ValidationSeverity, DataSource


@dataclass
class ValidationResult:
    is_valid: bool = True
    valid_rows: pd.DataFrame = field(default_factory=pd.DataFrame)
    invalid_rows: pd.DataFrame = field(default_factory=pd.DataFrame)
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)
    stats: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def total_errors(self) -> int:
        return len(self.errors)
    
    @property
    def total_warnings(self) -> int:
        return len(self.warnings)
    
    @property
    def error_rate(self) -> float:
        total = len(self.valid_rows) + len(self.invalid_rows)
        if total == 0:
            return 0.0
        return len(self.invalid_rows) / total * 100


def validate_elderly_id(value: str) -> Tuple[bool, Optional[str]]:
    if not value:
        return False, "老人编号不能为空"
    
    pattern = VALIDATION_RULES["elderly_id"]["pattern"]
    if not re.match(pattern, str(value)):
        return False, f"老人编号格式错误，应为{VALIDATION_RULES['elderly_id']['description']}"
    
    return True, None


def validate_meal_type(value: str) -> Tuple[bool, Optional[str]]:
    if not value:
        return False, "餐次不能为空"
    
    allowed = VALIDATION_RULES["meal_type"]["allowed_values"]
    if str(value) not in allowed:
        return False, f"餐次无效，必须是以下之一：{allowed}"
    
    return True, None


def validate_weight(value: Any) -> Tuple[bool, Optional[str]]:
    if value is None or pd.isna(value):
        return False, "克重不能为空"
    
    try:
        weight = float(value)
        min_val = VALIDATION_RULES["weight"]["min"]
        max_val = VALIDATION_RULES["weight"]["max"]
        
        if weight < min_val or weight > max_val:
            return False, f"克重必须在{min_val}-{max_val}克之间"
        
        return True, None
    except (ValueError, TypeError):
        return False, "克重必须是有效的数字"


def validate_dish_code(value: str) -> Tuple[bool, Optional[str]]:
    if not value:
        return False, "菜品编码不能为空"
    
    pattern = VALIDATION_RULES["dish_code"]["pattern"]
    if not re.match(pattern, str(value)):
        return False, f"菜品编码格式错误，应为{VALIDATION_RULES['dish_code']['description']}"
    
    return True, None


def validate_date(value: Any) -> Tuple[bool, Optional[str]]:
    if value is None or pd.isna(value):
        return False, "日期不能为空"
    
    date_format = VALIDATION_RULES["date"]["format"]
    
    if isinstance(value, date):
        return True, None
    
    try:
        if isinstance(value, str):
            datetime.strptime(value, date_format)
            return True, None
        else:
            pd.to_datetime(value)
            return True, None
    except (ValueError, TypeError):
        return False, f"日期格式错误，应为{date_format}"


class CSVReader:
    REQUIRED_COLUMNS = {
        "order": ["elderly_id", "date", "meal_type", "dish_code", "planned_weight"],
        "serving": ["elderly_id", "date", "meal_type", "dish_code", "actual_weight"],
        "waste": ["elderly_id", "date", "meal_type", "dish_code", "waste_weight"],
        "elderly": ["elderly_id", "chronic_diseases"],
        "dish": ["dish_code", "dish_name", "dish_category"]
    }
    
    COLUMN_MAPPINGS = {
        "老人编号": "elderly_id",
        "日期": "date",
        "餐次": "meal_type",
        "菜品编码": "dish_code",
        "预订克重": "planned_weight",
        "实际克重": "actual_weight",
        "剩余克重": "waste_weight",
        "慢病标签": "chronic_diseases",
        "菜品名称": "dish_name",
        "菜品分类": "dish_category",
        "姓名": "name",
        "年龄": "age",
        "性别": "gender",
        "床位号": "bed_number",
        "能量(kcal/100g)": "energy_per_100g",
        "蛋白质(g/100g)": "protein_per_100g",
        "脂肪(g/100g)": "fat_per_100g",
        "碳水(g/100g)": "carbs_per_100g",
        "钠(mg/100g)": "sodium_per_100g",
        "膳食纤维(g/100g)": "fiber_per_100g",
        "饮食标签": "dietary_tags"
    }
    
    def __init__(self):
        self.last_file_info: Dict[str, Any] = {}
    
    def read_csv(self, file_content: bytes, data_type: str) -> Tuple[pd.DataFrame, List[str]]:
        df = pd.read_csv(io.BytesIO(file_content), encoding='utf-8-sig')
        
        warnings = []
        df.columns = [str(col).strip() for col in df.columns]
        
        df = self._normalize_columns(df, warnings)
        
        required = self.REQUIRED_COLUMNS.get(data_type, [])
        missing = [col for col in required if col not in df.columns]
        
        if missing:
            raise ValueError(f"缺少必要列：{', '.join(missing)}")
        
        return df, warnings
    
    def _normalize_columns(self, df: pd.DataFrame, warnings: List[str]) -> pd.DataFrame:
        new_columns = []
        for col in df.columns:
            normalized = self.COLUMN_MAPPINGS.get(col, col)
            if normalized != col:
                warnings.append(f"列名已转换：'{col}' -> '{normalized}'")
            new_columns.append(normalized)
        
        df.columns = new_columns
        return df
    
    def parse_date_column(self, df: pd.DataFrame, date_col: str = "date") -> pd.DataFrame:
        df[date_col] = pd.to_datetime(df[date_col], errors='coerce').dt.date
        return df
    
    def parse_numeric_column(self, df: pd.DataFrame, col_name: str) -> pd.DataFrame:
        if col_name in df.columns:
            df[col_name] = pd.to_numeric(df[col_name], errors='coerce')
        return df


class DataValidator:
    def __init__(self):
        self.csv_reader = CSVReader()
        self.known_elderly_ids: set = set()
        self.known_dish_codes: set = set()
    
    def set_reference_data(self, elderly_df: Optional[pd.DataFrame] = None,
                          dish_df: Optional[pd.DataFrame] = None):
        if elderly_df is not None and not elderly_df.empty:
            self.known_elderly_ids = set(elderly_df['elderly_id'].unique())
        
        if dish_df is not None and not dish_df.empty:
            self.known_dish_codes = set(dish_df['dish_code'].unique())
    
    def validate_order_data(self, df: pd.DataFrame) -> ValidationResult:
        return self._validate_dataframe(df, "order", DataSource.ORDER)
    
    def validate_serving_data(self, df: pd.DataFrame) -> ValidationResult:
        return self._validate_dataframe(df, "serving", DataSource.SERVING)
    
    def validate_waste_data(self, df: pd.DataFrame) -> ValidationResult:
        return self._validate_dataframe(df, "waste", DataSource.WASTE)
    
    def validate_elderly_data(self, df: pd.DataFrame) -> ValidationResult:
        return self._validate_dataframe(df, "elderly", DataSource.ELDERLY)
    
    def validate_dish_data(self, df: pd.DataFrame) -> ValidationResult:
        return self._validate_dataframe(df, "dish", DataSource.DISH)
    
    def _validate_dataframe(self, df: pd.DataFrame, data_type: str,
                           data_source: DataSource) -> ValidationResult:
        result = ValidationResult()
        errors = []
        warnings = []
        valid_indices = []
        invalid_indices = []
        
        for idx, row in df.iterrows():
            row_errors = self._validate_row(row, data_type, idx, data_source)
            
            if any(e.severity == ValidationSeverity.ERROR.value for e in row_errors):
                invalid_indices.append(idx)
            else:
                valid_indices.append(idx)
            
            for e in row_errors:
                if e.severity == ValidationSeverity.ERROR.value:
                    errors.append(e)
                else:
                    warnings.append(e)
        
        result.valid_rows = df.loc[valid_indices].copy() if valid_indices else pd.DataFrame()
        result.invalid_rows = df.loc[invalid_indices].copy() if invalid_indices else pd.DataFrame()
        result.errors = errors
        result.warnings = warnings
        result.stats = {
            "total_rows": len(df),
            "valid_rows": len(result.valid_rows),
            "invalid_rows": len(result.invalid_rows),
            "error_count": len(errors),
            "warning_count": len(warnings)
        }
        
        result.is_valid = len(result.invalid_rows) == 0 and len(errors) == 0
        
        return result
    
    def _validate_row(self, row: pd.Series, data_type: str,
                     row_num: int, data_source: DataSource) -> List[ValidationError]:
        errors = []
        error_id_counter = 0
        
        def add_error(col: str, err_type: str, msg: str, val: Any,
                     severity: str = ValidationSeverity.ERROR.value,
                     suggestion: Optional[str] = None):
            nonlocal error_id_counter
            error_id_counter += 1
            errors.append(ValidationError(
                error_id=f"ERR_{data_source.value}_{row_num}_{error_id_counter}",
                row_number=row_num,
                column_name=col,
                error_type=err_type,
                error_message=msg,
                severity=severity,
                field_value=str(val) if val is not None else "",
                suggestion=suggestion,
                data_source=data_source.value
            ))
        
        if 'elderly_id' in row.index:
            is_valid, msg = validate_elderly_id(row['elderly_id'])
            if not is_valid:
                add_error('elderly_id', '格式错误', msg, row['elderly_id'])
            
            elif self.known_elderly_ids and row['elderly_id'] not in self.known_elderly_ids:
                add_error(
                    'elderly_id',
                    '引用错误',
                    f"老人编号 '{row['elderly_id']}' 在老人信息表中不存在",
                    row['elderly_id'],
                    severity=ValidationSeverity.WARNING.value,
                    suggestion="请检查老人信息表是否完整导入"
                )
        
        if 'date' in row.index:
            is_valid, msg = validate_date(row['date'])
            if not is_valid:
                add_error('date', '格式错误', msg, row['date'])
        
        if 'meal_type' in row.index:
            is_valid, msg = validate_meal_type(row['meal_type'])
            if not is_valid:
                add_error('meal_type', '值错误', msg, row['meal_type'],
                         suggestion=f"有效值为：{MEAL_TYPES}")
        
        if 'dish_code' in row.index:
            is_valid, msg = validate_dish_code(row['dish_code'])
            if not is_valid:
                add_error('dish_code', '格式错误', msg, row['dish_code'])
            
            elif self.known_dish_codes and row['dish_code'] not in self.known_dish_codes:
                add_error(
                    'dish_code',
                    '引用错误',
                    f"菜品编码 '{row['dish_code']}' 在菜品信息表中不存在",
                    row['dish_code'],
                    severity=ValidationSeverity.WARNING.value,
                    suggestion="请检查菜品信息表是否完整导入"
                )
        
        weight_cols = ['planned_weight', 'actual_weight', 'waste_weight']
        for col in weight_cols:
            if col in row.index:
                is_valid, msg = validate_weight(row[col])
                if not is_valid:
                    col_name_map = {
                        'planned_weight': '预订克重',
                        'actual_weight': '实际克重',
                        'waste_weight': '剩余克重'
                    }
                    add_error(col, '值错误', msg, row[col],
                             suggestion=f"{col_name_map.get(col, col)}应为有效数值")
        
        return errors
    
    def validate_cross_reference(self, orders: pd.DataFrame, servings: pd.DataFrame,
                                 wastes: pd.DataFrame) -> List[ValidationError]:
        cross_errors = []
        
        if not orders.empty and not servings.empty:
            order_keys = set(zip(orders['elderly_id'], orders['date'],
                                orders['meal_type'], orders['dish_code']))
            serving_keys = set(zip(servings['elderly_id'], servings['date'],
                                  servings['meal_type'], servings['dish_code']))
            
            missing_in_serving = order_keys - serving_keys
            for key in list(missing_in_serving)[:10]:
                cross_errors.append(ValidationError(
                    error_id=f"CROSS_ORDER_{len(cross_errors)}",
                    row_number=0,
                    column_name=None,
                    error_type="数据缺失",
                    error_message=f"订餐记录存在但无对应打餐记录：老人={key[0]}, 日期={key[1]}, 餐次={key[2]}, 菜品={key[3]}",
                    severity=ValidationSeverity.WARNING.value,
                    data_source="交叉校验"
                ))
            
            extra_in_serving = serving_keys - order_keys
            for key in list(extra_in_serving)[:10]:
                cross_errors.append(ValidationError(
                    error_id=f"CROSS_SERVING_{len(cross_errors)}",
                    row_number=0,
                    column_name=None,
                    error_type="多余数据",
                    error_message=f"打餐记录存在但无对应订餐记录：老人={key[0]}, 日期={key[1]}, 餐次={key[2]}, 菜品={key[3]}",
                    severity=ValidationSeverity.WARNING.value,
                    data_source="交叉校验"
                ))
        
        return cross_errors
