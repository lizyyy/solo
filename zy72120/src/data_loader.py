import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple
import re
import os


class DataLoader:
    UNIT_CONVERSIONS = {
        'water_velocity': {
            'm/s': 1.0,
            'm/s^1': 1.0,
            'm·s^-1': 1.0,
            'm.s^-1': 1.0,
            'km/h': 1.0 / 3.6,
            'km/hour': 1.0 / 3.6,
            'cm/s': 0.01,
            'm/min': 1.0 / 60.0
        },
        'object_size': {
            'm2': 1.0,
            'm^2': 1.0,
            'm²': 1.0,
            'cm2': 0.0001,
            'cm^2': 0.0001,
            'mm2': 1e-6
        },
        'drift_distance': {
            'm': 1.0,
            'meter': 1.0,
            'meters': 1.0,
            'km': 1000.0,
            'cm': 0.01,
            'mm': 0.001
        }
    }

    def __init__(self, source: str = "未指定"):
        self.source = source
        self.load_time = None
        self.raw_data = None
        self.cleaned_data = None
        self.data_quality_report: Dict[str, Any] = {}
        self.unit_conversions_applied: List[Dict[str, Any]] = []
        self.gaps_detected: List[Dict[str, Any]] = []

    def load_csv(self, file_path: str, encoding: str = 'utf-8') -> pd.DataFrame:
        self.load_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.raw_data = pd.read_csv(file_path, encoding=encoding)
        self._run_quality_checks()
        return self.raw_data

    def load_excel(self, file_path: str, sheet_name: str = 0) -> pd.DataFrame:
        self.load_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.raw_data = pd.read_excel(file_path, sheet_name=sheet_name)
        self._run_quality_checks()
        return self.raw_data

    def _run_quality_checks(self) -> None:
        if self.raw_data is None:
            return

        total_rows = len(self.raw_data)
        missing_values = self.raw_data.isnull().sum().to_dict()

        numeric_cols = self.raw_data.select_dtypes(include=[np.number]).columns
        outliers = {}
        for col in numeric_cols:
            q1 = self.raw_data[col].quantile(0.25)
            q3 = self.raw_data[col].quantile(0.75)
            iqr = q3 - q1
            outlier_mask = (self.raw_data[col] < (q1 - 1.5 * iqr)) | (self.raw_data[col] > (q3 + 1.5 * iqr))
            if outlier_mask.sum() > 0:
                outliers[col] = int(outlier_mask.sum())

        self.data_quality_report = {
            'source': self.source,
            'load_time': self.load_time,
            'total_rows': total_rows,
            'total_columns': len(self.raw_data.columns),
            'columns': list(self.raw_data.columns),
            'missing_values': {k: int(v) for k, v in missing_values.items() if v > 0},
            'outliers': outliers,
            'duplicates': int(self.raw_data.duplicated().sum())
        }

    def clean_data(self) -> pd.DataFrame:
        if self.raw_data is None:
            raise ValueError("请先加载数据")

        df = self.raw_data.copy()

        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
            df = df.sort_values('timestamp').reset_index(drop=True)
            self._detect_time_gaps(df)

        self._normalize_units(df)

        self.cleaned_data = df
        self.data_quality_report['cleaned_rows'] = len(df)
        self.data_quality_report['rows_removed'] = len(self.raw_data) - len(df)

        return df

    def _detect_time_gaps(self, df: pd.DataFrame, max_gap_minutes: int = 10) -> None:
        if 'timestamp' not in df.columns:
            return

        time_diffs = df['timestamp'].diff()
        gap_threshold = timedelta(minutes=max_gap_minutes)
        gap_indices = time_diffs[time_diffs > gap_threshold].index

        for idx in gap_indices:
            if idx > 0:
                gap_start = df.loc[idx - 1, 'timestamp']
                gap_end = df.loc[idx, 'timestamp']
                gap_duration = (gap_end - gap_start).total_seconds() / 60.0
                self.gaps_detected.append({
                    'gap_index': int(idx),
                    'gap_start': gap_start.strftime("%Y-%m-%d %H:%M:%S"),
                    'gap_end': gap_end.strftime("%Y-%m-%d %H:%M:%S"),
                    'gap_duration_min': round(gap_duration, 2),
                    'expected_rows_missing': int(gap_duration / 5) - 1
                })

        self.data_quality_report['time_gaps'] = self.gaps_detected

    def _extract_value_and_unit(self, cell_value: str) -> Tuple[float, str]:
        if pd.isna(cell_value):
            return np.nan, ''

        s = str(cell_value).strip()
        match = re.match(r'^([-+]?\d*\.?\d+)\s*(.*)$', s)
        if match:
            value = float(match.group(1))
            unit = match.group(2).strip()
            return value, unit
        return np.nan, ''

    def _normalize_units(self, df: pd.DataFrame) -> None:
        for field, conversions in self.UNIT_CONVERSIONS.items():
            col_candidates = [c for c in df.columns if field in c.lower()]
            for col in col_candidates:
                if df[col].dtype == 'object':
                    normalized_col = f"{field}_normalized"
                    df[normalized_col] = np.nan
                    df[f"{field}_unit_original"] = ''

                    for idx, val in df[col].items():
                        value, unit = self._extract_value_and_unit(val)
                        if pd.notna(value) and unit:
                            if unit in conversions:
                                normalized_value = value * conversions[unit]
                                df.at[idx, normalized_col] = normalized_value
                                df.at[idx, f"{field}_unit_original"] = unit
                                if unit != list(conversions.keys())[0]:
                                    self.unit_conversions_applied.append({
                                        'row_index': int(idx),
                                        'field': field,
                                        'original_value': value,
                                        'original_unit': unit,
                                        'normalized_value': round(normalized_value, 4),
                                        'target_unit': list(conversions.keys())[0]
                                    })
                            else:
                                df.at[idx, normalized_col] = value
                                df.at[idx, f"{field}_unit_original"] = unit
                        else:
                            try:
                                df.at[idx, normalized_col] = float(val)
                            except (ValueError, TypeError):
                                df.at[idx, normalized_col] = np.nan
                else:
                    df[f"{field}_normalized"] = df[col]
                    df[f"{field}_unit_original"] = 'm/s' if field == 'water_velocity' else ('m2' if field == 'object_size' else 'm')

        self.data_quality_report['unit_conversions'] = self.unit_conversions_applied
        self.data_quality_report['unit_conversion_count'] = len(self.unit_conversions_applied)

    def get_data_quality_report(self) -> Dict[str, Any]:
        return self.data_quality_report

    def get_metadata(self) -> Dict[str, Any]:
        return {
            'source': self.source,
            'load_time': self.load_time,
            'original_rows': len(self.raw_data) if self.raw_data is not None else 0,
            'cleaned_rows': len(self.cleaned_data) if self.cleaned_data is not None else 0,
            'active_params_version': None
        }

    def get_inspection_notes(self) -> List[str]:
        notes = []
        if 'inspection_note' in self.raw_data.columns:
            notes = self.raw_data['inspection_note'].dropna().tolist()
        return notes
