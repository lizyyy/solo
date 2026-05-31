#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any
from config import ALLOWED_EXTENSIONS, UNIT_MAPPING, DATA_DIR
from fairness_errors import (
    FileFormatError,
    MissingColumnError,
    EmptyDataError,
    UnitMismatchError,
    DataImportError
)


class DataImporter:
    REQUIRED_COLUMNS = [
        '比赛日期', '比赛时间', '主队', '客队', '场地',
        '主队排名', '客队排名'
    ]
    
    STANDARD_UNITS = {
        '休息时间': '分钟',
        '比赛时长': '分钟',
        '赛程间隔': '小时',
        '场地距离': '公里'
    }

    def __init__(self):
        self.warnings: List[Dict[str, Any]] = []
        self.unit_issues: List[Dict[str, Any]] = []

    def import_file(self, file_path: str) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        file_name = os.path.basename(file_path)
        file_ext = os.path.splitext(file_path)[1].lower()

        if file_ext not in ALLOWED_EXTENSIONS:
            raise FileFormatError(
                file_name=file_name,
                file_ext=file_ext,
                allowed_exts=ALLOWED_EXTENSIONS
            )

        try:
            if file_ext in ['.xlsx', '.xls']:
                df = pd.read_excel(file_path)
            else:
                df = pd.read_csv(file_path)
        except Exception as e:
            raise DataImportError(
                user_message=f"读取文件 '{file_name}' 时出错：{str(e)}",
                suggestion="请检查文件是否损坏或被其他程序占用",
                responsible_person="数据采集组 (小李)",
                details={"original_error": str(e)}
            )

        if df.empty:
            raise EmptyDataError(file_name=file_name)

        self._check_required_columns(df, file_name)
        self._detect_unit_issues(df)
        
        return df, self._get_import_summary(file_name, df)

    def _check_required_columns(self, df: pd.DataFrame, file_name: str) -> None:
        missing_cols = []
        for col in self.REQUIRED_COLUMNS:
            if col not in df.columns:
                missing_cols.append(col)

        if missing_cols:
            raise MissingColumnError(
                missing_columns=missing_cols,
                file_name=file_name
            )

    def _detect_unit_issues(self, df: pd.DataFrame) -> None:
        self.unit_issues = []
        
        for col_name, standard_unit in self.STANDARD_UNITS.items():
            if col_name not in df.columns:
                continue

            sample_values = df[col_name].dropna().astype(str).head(10)
            found_units = self._extract_units_from_values(sample_values)
            
            for found_unit in found_units:
                if found_unit and found_unit != standard_unit:
                    unit_type = self._get_unit_type(found_unit)
                    source_type = self._determine_source_type(col_name)
                    
                    issue = UnitMismatchError(
                        column_name=col_name,
                        found_unit=found_unit,
                        expected_unit=standard_unit,
                        source_type=source_type
                    )
                    self.unit_issues.append(issue.to_dict())

    def _extract_units_from_values(self, values: List[str]) -> List[str]:
        units_found = set()
        unit_pattern = r'([\u4e00-\u9fa5a-zA-Z]+)$'
        
        for value in values:
            match = re.search(unit_pattern, value.strip())
            if match:
                unit = match.group(1)
                if self._is_valid_unit(unit):
                    units_found.add(unit)
        
        return list(units_found)

    def _is_valid_unit(self, unit: str) -> bool:
        for unit_type, variants in UNIT_MAPPING.items():
            if unit.lower() in [v.lower() for v in variants]:
                return True
        return False

    def _get_unit_type(self, unit: str) -> str:
        for unit_type, variants in UNIT_MAPPING.items():
            if unit.lower() in [v.lower() for v in variants]:
                return unit_type
        return 'unknown'

    def _determine_source_type(self, col_name: str) -> str:
        experiment_cols = ['休息时间', '比赛时长', '场地距离']
        constraint_cols = ['赛程间隔', '最大连赛场次']
        
        if col_name in experiment_cols:
            return 'experiment_data'
        elif col_name in constraint_cols:
            return 'constraint_spec'
        return 'experiment_data'

    def _get_import_summary(self, file_name: str, df: pd.DataFrame) -> Dict[str, Any]:
        return {
            'file_name': file_name,
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'columns': list(df.columns),
            'warnings': self.warnings,
            'unit_issues': self.unit_issues
        }

    def convert_units(self, df: pd.DataFrame, column_name: str, 
                      from_unit: str, to_unit: str) -> pd.DataFrame:
        conversion_factors = {
            ('分钟', '小时'): 1/60,
            ('小时', '分钟'): 60,
            ('米', '公里'): 1/1000,
            ('公里', '米'): 1000,
        }
        
        key = (from_unit, to_unit)
        if key not in conversion_factors:
            raise DataImportError(
                user_message=f"不支持从 '{from_unit}' 到 '{to_unit}' 的单位转换",
                suggestion="请手动转换数据后重新导入，或联系开发人员添加新的转换规则",
                responsible_person="数据采集组 (小李)"
            )
        
        df = df.copy()
        
        def convert_value(val):
            if pd.isna(val):
                return val
            val_str = str(val).replace(from_unit, '').strip()
            try:
                num_val = float(val_str)
                return num_val * conversion_factors[key]
            except ValueError:
                return val
        
        df[column_name] = df[column_name].apply(convert_value)
        return df

    def list_available_files(self) -> List[str]:
        files = []
        for f in os.listdir(DATA_DIR):
            ext = os.path.splitext(f)[1].lower()
            if ext in ALLOWED_EXTENSIONS:
                files.append(f)
        return sorted(files)
