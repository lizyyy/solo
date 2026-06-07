import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
from pathlib import Path


@dataclass
class AnalysisResult:
    data: pd.DataFrame
    masked_low_conf: pd.DataFrame
    version_summary: pd.DataFrame
    metrics: Dict


class ColumnAmbiguityAnalyzer:
    CONFIDENCE_THRESHOLD = 0.7
    MASKING_THRESHOLD = 0.85

    def __init__(self):
        self.raw_data = None
        self.analysis_result = None

    def load_manual_review(self, file_path: str) -> pd.DataFrame:
        path = Path(file_path)
        if path.suffix == '.csv':
            df = pd.read_csv(path)
        elif path.suffix in ['.xlsx', '.xls']:
            df = pd.read_excel(path)
        else:
            raise ValueError(f"Unsupported file format: {path.suffix}")
        self.raw_data = df
        return df

    def analyze(self, df: Optional[pd.DataFrame] = None) -> AnalysisResult:
        data = df if df is not None else self.raw_data
        if data is None:
            raise ValueError("No data loaded. Call load_manual_review first or pass df.")

        data = data.copy()
        data['_is_masked'] = False
        data['_mask_reason'] = ''

        if 'confidence' in data.columns:
            data['_is_low_confidence'] = data['confidence'] < self.CONFIDENCE_THRESHOLD
        else:
            data['_is_low_confidence'] = False

        if 'accuracy' in data.columns and 'confidence' in data.columns:
            group_cols = []
            if 'model_version' in data.columns:
                group_cols.append('model_version')
            if 'prompt_version' in data.columns:
                group_cols.append('prompt_version')
                data['prompt_version'] = data['prompt_version'].fillna('未标注')

            if group_cols:
                for group_key, group_df in data.groupby(group_cols, dropna=False):
                    avg_acc = group_df['accuracy'].mean()
                    if avg_acc >= self.MASKING_THRESHOLD:
                        low_conf_mask = group_df['_is_low_confidence']
                        data.loc[group_df[low_conf_mask].index, '_is_masked'] = True
                        data.loc[group_df[low_conf_mask].index, '_mask_reason'] = \
                            f'组准确率{avg_acc:.1%}掩盖低置信度'

        masked_low_conf = data[data['_is_masked']].copy()

        version_summary = self._build_version_summary(data)

        metrics = {
            'total_samples': len(data),
            'low_confidence_count': int(data['_is_low_confidence'].sum()),
            'masked_count': int(data['_is_masked'].sum()),
            'accuracy': data['accuracy'].mean() if 'accuracy' in data.columns else None,
        }

        self.analysis_result = AnalysisResult(
            data=data,
            masked_low_conf=masked_low_conf,
            version_summary=version_summary,
            metrics=metrics
        )
        return self.analysis_result

    def _build_version_summary(self, data: pd.DataFrame) -> pd.DataFrame:
        data = data.copy()
        group_cols = []
        if 'model_version' in data.columns:
            group_cols.append('model_version')
        if 'prompt_version' in data.columns:
            group_cols.append('prompt_version')
            data['prompt_version'] = data['prompt_version'].fillna('未标注')

        if not group_cols:
            return pd.DataFrame()

        agg_dict = {
            'sample_id': 'count' if 'sample_id' in data.columns else ('accuracy', 'count'),
            'accuracy': 'mean',
            'confidence': 'mean',
        }
        if '_is_low_confidence' in data.columns:
            agg_dict['_is_low_confidence'] = 'sum'
        if '_is_masked' in data.columns:
            agg_dict['_is_masked'] = 'sum'

        agg_dict_clean = {}
        for k, v in agg_dict.items():
            if k in data.columns:
                agg_dict_clean[k] = v

        summary = data.groupby(group_cols, dropna=False).agg(agg_dict_clean).reset_index()
        summary.columns = [
            '_'.join(col).strip('_') if isinstance(col, tuple) else col
            for col in summary.columns
        ]

        rename_map = {}
        for col in summary.columns:
            if col == 'sample_id_count':
                rename_map[col] = '样本数'
            elif col == 'accuracy_mean':
                rename_map[col] = '平均准确率'
            elif col == 'confidence_mean':
                rename_map[col] = '平均置信度'
            elif col == '_is_low_confidence_sum':
                rename_map[col] = '低置信度数'
            elif col == '_is_masked_sum':
                rename_map[col] = '被掩盖数'
        summary.rename(columns=rename_map, inplace=True)

        return summary

    def fill_prompt_version(self, data: pd.DataFrame, model_version: str, prompt_version: str) -> pd.DataFrame:
        mask = data['model_version'] == model_version
        data.loc[mask, 'prompt_version'] = prompt_version
        return data

    def get_version_diff(self, data: pd.DataFrame) -> pd.DataFrame:
        return self._build_version_summary(data)
