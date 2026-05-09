import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from scipy import stats
from config import AppConfig


@dataclass
class QCIssue:
    row_index: int
    inverter_id: str
    timestamp: Optional[str]
    field: str
    issue_type: str
    description: str
    original_value: Optional[float]
    action: str


@dataclass
class QCResult:
    clean_data: pd.DataFrame
    raw_data: pd.DataFrame
    issues: List[QCIssue]
    summary: Dict[str, int]
    by_inverter: Dict[str, Dict[str, int]]
    statistics: Dict[str, Dict[str, float]]


class QualityControl:
    def __init__(self, config: AppConfig):
        self.config = config
        self.qc_config = config.qc

    def _detect_missing(self, df: pd.DataFrame, issues: List[QCIssue]) -> pd.DataFrame:
        required_cols = ['irradiance', 'temperature', 'generation']
        for col in required_cols:
            mask = df[col].isna()
            for idx in df[mask].index:
                row = df.loc[idx]
                issues.append(QCIssue(
                    row_index=int(idx),
                    inverter_id=str(row.get('inverter_id', 'UNKNOWN')),
                    timestamp=str(row.get('timestamp', '')) if pd.notna(row.get('timestamp')) else None,
                    field=col,
                    issue_type='MISSING_VALUE',
                    description=f'{col} 字段缺失',
                    original_value=None,
                    action='EXCLUDED'
                ))
        return df.dropna(subset=required_cols)

    def _detect_duplicates(self, df: pd.DataFrame, issues: List[QCIssue]) -> pd.DataFrame:
        dup_cols = ['inverter_id', 'timestamp']
        if all(col in df.columns for col in dup_cols):
            mask = df.duplicated(subset=dup_cols, keep='first')
            for idx in df[mask].index:
                row = df.loc[idx]
                issues.append(QCIssue(
                    row_index=int(idx),
                    inverter_id=str(row.get('inverter_id', 'UNKNOWN')),
                    timestamp=str(row.get('timestamp', '')) if pd.notna(row.get('timestamp')) else None,
                    field='timestamp',
                    issue_type='DUPLICATE',
                    description=f'逆变器 {row.get("inverter_id")} 在 {row.get("timestamp")} 有重复记录',
                    original_value=None,
                    action='DEDUPLICATED'
                ))
            return df.drop_duplicates(subset=dup_cols, keep='first')
        return df

    def _detect_range_violations(self, df: pd.DataFrame, issues: List[QCIssue]) -> pd.DataFrame:
        ranges = {
            'irradiance': (self.qc_config.min_irradiance, self.qc_config.max_irradiance),
            'temperature': (self.qc_config.min_temperature, self.qc_config.max_temperature),
            'generation': (self.qc_config.min_generation, self.qc_config.max_generation)
        }

        exclude_mask = pd.Series([False] * len(df), index=df.index)

        for col, (min_val, max_val) in ranges.items():
            below_min = df[col] < min_val
            above_max = df[col] > max_val

            for idx in df[below_min].index:
                row = df.loc[idx]
                issues.append(QCIssue(
                    row_index=int(idx),
                    inverter_id=str(row.get('inverter_id', 'UNKNOWN')),
                    timestamp=str(row.get('timestamp', '')) if pd.notna(row.get('timestamp')) else None,
                    field=col,
                    issue_type='RANGE_VIOLATION',
                    description=f'{col} = {row[col]} 低于最小值 {min_val}',
                    original_value=float(row[col]),
                    action='EXCLUDED'
                ))
                exclude_mask[idx] = True

            for idx in df[above_max].index:
                row = df.loc[idx]
                issues.append(QCIssue(
                    row_index=int(idx),
                    inverter_id=str(row.get('inverter_id', 'UNKNOWN')),
                    timestamp=str(row.get('timestamp', '')) if pd.notna(row.get('timestamp')) else None,
                    field=col,
                    issue_type='RANGE_VIOLATION',
                    description=f'{col} = {row[col]} 高于最大值 {max_val}',
                    original_value=float(row[col]),
                    action='EXCLUDED'
                ))
                exclude_mask[idx] = True

        return df[~exclude_mask]

    def _detect_outliers_zscore(self, df: pd.DataFrame, issues: List[QCIssue]) -> pd.DataFrame:
        cols = ['irradiance', 'temperature', 'generation']
        exclude_mask = pd.Series([False] * len(df), index=df.index)
        threshold = self.qc_config.zscore_threshold

        for col in cols:
            data = df[col].dropna()
            if len(data) < 10:
                continue

            zscores = np.abs(stats.zscore(data))
            outlier_mask = zscores > threshold
            outlier_indices = data.index[outlier_mask]

            for idx in outlier_indices:
                row = df.loc[idx]
                issues.append(QCIssue(
                    row_index=int(idx),
                    inverter_id=str(row.get('inverter_id', 'UNKNOWN')),
                    timestamp=str(row.get('timestamp', '')) if pd.notna(row.get('timestamp')) else None,
                    field=col,
                    issue_type='ZSCORE_OUTLIER',
                    description=f'{col} Z-score 超过阈值 {threshold}',
                    original_value=float(row[col]),
                    action='REVIEWED'
                ))

        return df

    def _detect_outliers_iqr(self, df: pd.DataFrame, issues: List[QCIssue]) -> pd.DataFrame:
        cols = ['irradiance', 'temperature', 'generation']
        multiplier = self.qc_config.iqr_multiplier

        for col in cols:
            q25 = df[col].quantile(0.25)
            q75 = df[col].quantile(0.75)
            iqr = q75 - q25
            lower_bound = q25 - multiplier * iqr
            upper_bound = q75 + multiplier * iqr

            outlier_mask = (df[col] < lower_bound) | (df[col] > upper_bound)
            for idx in df[outlier_mask].index:
                row = df.loc[idx]
                issues.append(QCIssue(
                    row_index=int(idx),
                    inverter_id=str(row.get('inverter_id', 'UNKNOWN')),
                    timestamp=str(row.get('timestamp', '')) if pd.notna(row.get('timestamp')) else None,
                    field=col,
                    issue_type='IQR_OUTLIER',
                    description=f'{col} 超出IQR范围 [{lower_bound:.2f}, {upper_bound:.2f}]',
                    original_value=float(row[col]),
                    action='FLAGGED'
                ))

        return df

    def _validate_inverter_groups(self, df: pd.DataFrame, issues: List[QCIssue]) -> pd.DataFrame:
        if 'inverter_id' not in df.columns:
            return df

        min_rows = 10
        excluded_inv = []
        for inv_id, group in df.groupby('inverter_id'):
            if len(group) < min_rows:
                excluded_inv.append(inv_id)
                for idx in group.index:
                    row = df.loc[idx]
                    issues.append(QCIssue(
                        row_index=int(idx),
                        inverter_id=str(inv_id),
                        timestamp=str(row.get('timestamp', '')) if pd.notna(row.get('timestamp')) else None,
                        field='inverter_id',
                        issue_type='INSUFFICIENT_DATA',
                        description=f'逆变器 {inv_id} 只有 {len(group)} 条记录，少于最少要求 {min_rows} 条',
                        original_value=None,
                        action='EXCLUDED'
                    ))

        return df[~df['inverter_id'].isin(excluded_inv)]

    def _build_summary(self, issues: List[QCIssue], raw_count: int, clean_count: int) -> Dict[str, int]:
        summary = {
            'total_raw_rows': raw_count,
            'total_clean_rows': clean_count,
            'rows_excluded': raw_count - clean_count,
            'exclusion_rate': (raw_count - clean_count) / raw_count if raw_count > 0 else 0.0
        }

        issue_types = {}
        for issue in issues:
            issue_types[issue.issue_type] = issue_types.get(issue.issue_type, 0) + 1

        summary['issues_by_type'] = issue_types
        return summary

    def _build_by_inverter(self, issues: List[QCIssue], df: pd.DataFrame) -> Dict[str, Dict[str, int]]:
        by_inv = {}
        for issue in issues:
            inv_id = issue.inverter_id
            if inv_id not in by_inv:
                by_inv[inv_id] = {'total_issues': 0, 'issues_by_type': {}}
            by_inv[inv_id]['total_issues'] += 1
            by_inv[inv_id]['issues_by_type'][issue.issue_type] = by_inv[inv_id]['issues_by_type'].get(issue.issue_type, 0) + 1

        if 'inverter_id' in df.columns:
            for inv_id in df['inverter_id'].unique():
                if str(inv_id) not in by_inv:
                    by_inv[str(inv_id)] = {'total_issues': 0, 'issues_by_type': {}}

        return by_inv

    def _build_statistics(self, df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
        stats_dict = {}
        cols = ['irradiance', 'temperature', 'generation']
        for col in cols:
            if col in df.columns:
                stats_dict[col] = {
                    'count': int(df[col].count()),
                    'mean': float(df[col].mean()),
                    'std': float(df[col].std()),
                    'min': float(df[col].min()),
                    'q25': float(df[col].quantile(0.25)),
                    'median': float(df[col].median()),
                    'q75': float(df[col].quantile(0.75)),
                    'max': float(df[col].max())
                }
        return stats_dict

    def run(self, df: pd.DataFrame) -> QCResult:
        issues: List[QCIssue] = []
        raw_data = df.copy()
        working_df = df.copy()

        working_df = self._validate_inverter_groups(working_df, issues)
        working_df = self._detect_duplicates(working_df, issues)
        working_df = self._detect_missing(working_df, issues)
        working_df = self._detect_range_violations(working_df, issues)
        working_df = self._detect_outliers_zscore(working_df, issues)
        working_df = self._detect_outliers_iqr(working_df, issues)

        summary = self._build_summary(issues, len(raw_data), len(working_df))
        by_inverter = self._build_by_inverter(issues, working_df)
        statistics = self._build_statistics(working_df)

        return QCResult(
            clean_data=working_df.reset_index(drop=True),
            raw_data=raw_data,
            issues=issues,
            summary=summary,
            by_inverter=by_inverter,
            statistics=statistics
        )
