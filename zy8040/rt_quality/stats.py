import pandas as pd
import numpy as np
from typing import Dict


def compute_subject_stats(df: pd.DataFrame) -> pd.DataFrame:
    grouped = df.groupby('subject_id').agg(
        total_trials=('rt', 'count'),
        mean_rt=('rt', 'mean'),
        median_rt=('rt', 'median'),
        std_rt=('rt', 'std'),
        accuracy=('accuracy', 'mean')
    ).reset_index()
    grouped['accuracy'] = grouped['accuracy'] * 100
    return grouped


def compute_condition_stats(df: pd.DataFrame) -> pd.DataFrame:
    grouped = df.groupby(['subject_id', 'condition']).agg(
        trials=('rt', 'count'),
        mean_rt=('rt', 'mean'),
        median_rt=('rt', 'median'),
        accuracy=('accuracy', 'mean')
    ).reset_index()
    grouped['accuracy'] = grouped['accuracy'] * 100
    return grouped


def compute_condition_summary(df: pd.DataFrame) -> pd.DataFrame:
    grouped = df.groupby('condition').agg(
        n_subjects=('subject_id', 'nunique'),
        total_trials=('rt', 'count'),
        mean_rt=('rt', 'mean'),
        median_rt=('rt', 'median'),
        se_rt=('rt', lambda x: x.std() / np.sqrt(len(x))),
        mean_accuracy=('accuracy', 'mean'),
        se_accuracy=('accuracy', lambda x: (x.std() / np.sqrt(len(x))) * 100)
    ).reset_index()
    grouped['mean_accuracy'] = grouped['mean_accuracy'] * 100
    return grouped


def compute_exclusion_rates(
    original_trials: pd.DataFrame,
    cleaned_trials: pd.DataFrame,
    excluded_trials: pd.DataFrame
) -> Dict:
    total_original = len(original_trials)
    total_cleaned = len(cleaned_trials)
    total_excluded = len(excluded_trials)
    
    by_reason = excluded_trials['exclusion_reason'].value_counts().to_dict()
    
    return {
        'total_original': total_original,
        'total_cleaned': total_cleaned,
        'total_excluded': total_excluded,
        'exclusion_rate': (total_excluded / total_original) * 100,
        'by_reason': by_reason
    }
