"""数据清洗模块 - 处理空列、错别字、重复行等脏数据"""

import pandas as pd
import numpy as np
from typing import List, Tuple, Dict, Any, Optional
import re
from difflib import SequenceMatcher

from .types import Issue, IssueType, Severity, Measurement, Formula, ExperimentGroup
from .config import COMMON_TYPOS


class DataCleaner:
    """数据清洗器"""

    def __init__(self):
        self.issues: List[Issue] = []
        self.cleaning_log: List[str] = []

    def clean_dataframe(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[Issue]]:
        """清洗DataFrame数据"""
        self.issues = []
        self.cleaning_log = []

        if df.empty:
            self._add_issue(IssueType.EMPTY_ROW, Severity.CRITICAL, "输入数据为空")
            return df, self.issues

        df = self._remove_empty_columns(df)
        df = self._remove_empty_rows(df)
        df = self._remove_duplicate_rows(df)
        df = self._fix_typos(df)
        df = self._standardize_column_names(df)
        df = self._parse_numeric_values(df)

        return df, self.issues

    def _remove_empty_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """移除空列"""
        empty_cols = df.columns[df.isnull().all()].tolist()
        for col in empty_cols:
            self._add_issue(
                IssueType.EMPTY_COLUMN,
                Severity.WARNING,
                f"列 '{col}' 完全为空，已移除",
                column_name=col
            )
            self.cleaning_log.append(f"移除空列: {col}")
        return df.drop(columns=empty_cols)

    def _remove_empty_rows(self, df: pd.DataFrame) -> pd.DataFrame:
        """移除空行"""
        empty_mask = df.isnull().all(axis=1)
        empty_rows = df.index[empty_mask].tolist()
        for idx in empty_rows:
            self._add_issue(
                IssueType.EMPTY_ROW,
                Severity.WARNING,
                f"第 {idx + 1} 行完全为空，已移除",
                row_index=idx
            )
            self.cleaning_log.append(f"移除空行: 第{idx + 1}行")
        return df.drop(index=empty_rows).reset_index(drop=True)

    def _remove_duplicate_rows(self, df: pd.DataFrame) -> pd.DataFrame:
        """移除重复行"""
        dup_mask = df.duplicated(keep='first')
        dup_indices = df.index[dup_mask].tolist()
        for idx in dup_indices:
            self._add_issue(
                IssueType.DUPLICATE_ROW,
                Severity.WARNING,
                f"第 {idx + 1} 行与其他行重复，已移除",
                row_index=idx,
                details={'duplicate_of': df.index[df.duplicated(keep=False) & (df.index != idx)][0] + 1}
            )
            self.cleaning_log.append(f"移除重复行: 第{idx + 1}行")
        return df.drop_duplicates(keep='first').reset_index(drop=True)

    def _fix_typos(self, df: pd.DataFrame) -> pd.DataFrame:
        """修复常见错别字"""
        for correct, typos in COMMON_TYPOS.items():
            for typo in typos:
                for col in df.columns:
                    if df[col].dtype == 'object':
                        mask = df[col].astype(str).str.strip() == typo
                        if mask.any():
                            df.loc[mask, col] = correct
                            for idx in df.index[mask].tolist():
                                self._add_issue(
                                    IssueType.TYPO,
                                    Severity.INFO,
                                    f"第 {idx + 1} 行列 '{col}' 中 '{typo}' 已修正为 '{correct}'",
                                    row_index=idx,
                                    column_name=col,
                                    details={'old': typo, 'new': correct}
                                )
                            self.cleaning_log.append(f"修正错别字: '{typo}' -> '{correct}'")

        for col in df.columns:
            df[col] = df[col].apply(lambda x: self._fuzzy_correct(str(x)) if pd.notna(x) else x)

        return df

    def _fuzzy_correct(self, text: str) -> str:
        """模糊纠错"""
        text = text.strip()
        if not text:
            return text

        for correct, typos in COMMON_TYPOS.items():
            if text in typos:
                return correct

        for correct, typos in COMMON_TYPOS.items():
            all_variants = typos + [correct]
            for variant in all_variants:
                if len(text) > 2 and len(variant) > 2:
                    ratio = SequenceMatcher(None, text.lower(), variant.lower()).ratio()
                    if ratio > 0.85 and ratio < 1.0:
                        return correct
        return text

    def _standardize_column_names(self, df: pd.DataFrame) -> pd.DataFrame:
        """标准化列名"""
        new_columns = {}
        for col in df.columns:
            new_col = str(col).strip()
            new_col = re.sub(r'\s+', '_', new_col)
            new_col = new_col.lower()
            if new_col != col:
                new_columns[col] = new_col
                self.cleaning_log.append(f"标准化列名: '{col}' -> '{new_col}'")
        return df.rename(columns=new_columns)

    def _parse_numeric_values(self, df: pd.DataFrame) -> pd.DataFrame:
        """解析数值，处理各种格式"""
        for col in df.columns:
            if df[col].dtype == 'object':
                parsed = df[col].apply(self._parse_single_value)
                successful = parsed.apply(lambda x: x[0] is not None)
                if successful.sum() > len(df) * 0.5:
                    df[col] = parsed.apply(lambda x: x[0])
                    for idx in df.index[~successful].tolist():
                        if pd.notna(df.loc[idx, col]):
                            self._add_issue(
                                IssueType.SIGNIFICANT_FIGURES,
                                Severity.WARNING,
                                f"第 {idx + 1} 行列 '{col}' 数值格式异常: {parsed.loc[idx][1]}",
                                row_index=idx,
                                column_name=col
                            )
        return df

    def _parse_single_value(self, value: Any) -> Tuple[Optional[float], Optional[str]]:
        """解析单个值，返回(数值, 原始字符串)"""
        if pd.isna(value):
            return None, None

        s = str(value).strip()
        if not s:
            return None, s

        s = s.replace(',', '')
        s = s.replace('，', '')

        match = re.match(r'^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*([±~]?)\s*([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)?$', s)
        if match:
            main_val = float(match.group(1))
            return main_val, s

        match2 = re.match(r'^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)', s)
        if match2:
            return float(match2.group(1)), s

        return None, s

    def parse_measurements_from_dataframe(
        self,
        df: pd.DataFrame,
        value_col: str = 'value',
        uncertainty_col: str = 'uncertainty',
        unit_col: str = 'unit',
        name_col: str = 'name',
        group_col: Optional[str] = 'group'
    ) -> Dict[str, ExperimentGroup]:
        """从DataFrame解析测量数据"""
        groups: Dict[str, ExperimentGroup] = {}
        default_group = 'default'

        required_cols = [value_col, uncertainty_col, unit_col, name_col]
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            self._add_issue(
                IssueType.INVALID_FORMULA,
                Severity.CRITICAL,
                f"缺少必要列: {missing}"
            )
            return groups

        for idx, row in df.iterrows():
            try:
                name = str(row[name_col]).strip() if pd.notna(row[name_col]) else f'var_{idx}'
                value = float(row[value_col]) if pd.notna(row[value_col]) else 0.0
                uncertainty = float(row[uncertainty_col]) if pd.notna(row[uncertainty_col]) else 0.0
                unit = str(row[unit_col]).strip() if pd.notna(row[unit_col]) else ''
                group = str(row[group_col]).strip() if group_col and pd.notna(row.get(group_col)) else default_group

                if uncertainty == 0 and pd.notna(row.get(uncertainty_col)):
                    self._add_issue(
                        IssueType.MISSING_UNCERTAINTY,
                        Severity.WARNING,
                        f"测量值 '{name}' 的不确定度为0",
                        row_index=idx,
                        column_name=uncertainty_col
                    )

                if not unit:
                    self._add_issue(
                        IssueType.INVALID_UNIT,
                        Severity.WARNING,
                        f"测量值 '{name}' 缺少单位",
                        row_index=idx,
                        column_name=unit_col
                    )

                measurement = Measurement(
                    name=name,
                    value=value,
                    uncertainty=uncertainty,
                    unit=unit,
                    description=row.get('description'),
                    significant_figures=self._count_significant_figures(str(row.get(value_col, ''))),
                    raw_value=str(row.get(value_col, '')),
                    group=group
                )

                if group not in groups:
                    groups[group] = ExperimentGroup(
                        name=group,
                        measurements={},
                        formulas=[],
                        issues=[]
                    )

                groups[group].measurements[name] = measurement

            except (ValueError, TypeError) as e:
                self._add_issue(
                    IssueType.SIGNIFICANT_FIGURES,
                    Severity.ERROR,
                    f"解析第 {idx + 1} 行失败: {str(e)}",
                    row_index=idx
                )

        return groups

    def _count_significant_figures(self, s: str) -> Optional[int]:
        """计算有效数字位数"""
        s = s.strip()
        if not s:
            return None

        s = s.replace(',', '').replace('，', '')

        if 'e' in s.lower():
            mantissa = s.lower().split('e')[0]
            mantissa = mantissa.replace('.', '').lstrip('0').lstrip('+-')
            return len(mantissa) if mantissa else 1

        match = re.match(r'^[+-]?(\d*)\.?(\d+)?$', s)
        if not match:
            return None

        integer_part = match.group(1) or ''
        fractional_part = match.group(2) or ''

        if '.' in s:
            all_digits = integer_part + fractional_part
            all_digits = all_digits.lstrip('0')
            return len(all_digits) if all_digits else 1
        else:
            digits = integer_part.rstrip('0')
            return len(digits) if digits else 1

    def _add_issue(
        self,
        issue_type: IssueType,
        severity: Severity,
        message: str,
        row_index: Optional[int] = None,
        column_name: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """添加问题记录"""
        issue = Issue(
            issue_type=issue_type,
            severity=severity,
            message=message,
            location=f"行{row_index + 1}" if row_index is not None else None,
            details=details or {},
            row_index=row_index,
            column_name=column_name
        )
        self.issues.append(issue)
