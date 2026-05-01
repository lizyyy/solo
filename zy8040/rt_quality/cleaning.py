import pandas as pd
import numpy as np
from typing import Tuple, Dict


def filter_practice_trials(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    practice = df[df['is_practice']].copy()
    experiment = df[~df['is_practice']].copy()
    return experiment, practice


def filter_missing_responses(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    missing = df[df['rt'].isna() | (df['rt'] <= 0)].copy()
    valid = df[~df.index.isin(missing.index)].copy()
    return valid, missing


def filter_extreme_rt(
    df: pd.DataFrame,
    min_rt: float = 100,
    max_rt: float = None,
    sd_threshold: float = 3.0
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    df = df.copy()
    if max_rt is None:
        mean_rt = df['rt'].mean()
        std_rt = df['rt'].std()
        max_rt = mean_rt + sd_threshold * std_rt
    
    extreme = df[(df['rt'] < min_rt) | (df['rt'] > max_rt)].copy()
    valid = df[~df.index.isin(extreme.index)].copy()
    return valid, extreme


def clean_trials(
    trials_df: pd.DataFrame,
    design: Dict
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    cleaning_rules = design.get('cleaning', {})
    min_rt = cleaning_rules.get('min_rt', 100)
    max_rt = cleaning_rules.get('max_rt')
    sd_threshold = cleaning_rules.get('sd_threshold', 3.0)
    
    all_excluded = pd.DataFrame()
    
    df, excluded = filter_practice_trials(trials_df)
    excluded['exclusion_reason'] = 'practice'
    all_excluded = pd.concat([all_excluded, excluded])
    
    df, excluded = filter_missing_responses(df)
    excluded['exclusion_reason'] = 'missing_response'
    all_excluded = pd.concat([all_excluded, excluded])
    
    df, excluded = filter_extreme_rt(df, min_rt, max_rt, sd_threshold)
    excluded['exclusion_reason'] = 'extreme_rt'
    all_excluded = pd.concat([all_excluded, excluded])
    
    return df, all_excluded
