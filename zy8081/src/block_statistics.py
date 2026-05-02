import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple, List

def calculate_block_stats(yield_df: pd.DataFrame) -> pd.DataFrame:
    stats = yield_df.groupby(['block', 'variety']).agg(
        count=('plot_id', 'count'),
        mean_yield=('yield_kg', 'mean'),
        std_yield=('yield_kg', 'std'),
        min_yield=('yield_kg', 'min'),
        max_yield=('yield_kg', 'max'),
        missing_count=('yield_kg', lambda x: x.isna().sum())
    ).reset_index()
    
    stats['cv'] = (stats['std_yield'] / stats['mean_yield']) * 100
    stats['cv'] = stats['cv'].fillna(0)
    
    return stats

def get_missing_plots(yield_df: pd.DataFrame, design: Dict[str, Any]) -> pd.DataFrame:
    expected_blocks = range(1, design.get('total_blocks', 0) + 1)
    expected_reps = range(1, design.get('total_reps', 0) + 1)
    varieties = [v['name'] for v in design.get('varieties', [])]
    
    expected_combinations = []
    for block in expected_blocks:
        for rep in expected_reps:
            for variety in varieties:
                expected_combinations.append({'block': block, 'rep': rep, 'variety': variety})
    
    expected_df = pd.DataFrame(expected_combinations)
    
    actual_df = yield_df[['block', 'rep', 'variety']].drop_duplicates()
    
    merged = expected_df.merge(
        actual_df,
        on=['block', 'rep', 'variety'],
        how='left',
        indicator=True
    )
    
    missing = merged[merged['_merge'] == 'left_only'].drop('_merge', axis=1)
    return missing

def get_duplicate_records(yield_df: pd.DataFrame) -> pd.DataFrame:
    plot_counts = yield_df['plot_id'].value_counts()
    duplicate_plots = plot_counts[plot_counts > 1].index.tolist()
    duplicates = yield_df[yield_df['plot_id'].isin(duplicate_plots)].sort_values('plot_id')
    return duplicates

def get_boundary_rows(yield_df: pd.DataFrame, design: Dict[str, Any]) -> pd.DataFrame:
    boundary_rows = design.get('boundary_rows', [])
    if not boundary_rows:
        return pd.DataFrame()
    
    plot_prefix = design.get('plot_prefix', 'P')
    rows = design.get('block_dimensions', {}).get('rows', 6)
    cols = design.get('block_dimensions', {}).get('cols', 4)
    
    boundary_plots = []
    for block in yield_df['block'].unique():
        for row in boundary_rows:
            for col in range(1, cols + 1):
                plot_num = (row - 1) * cols + col
                plot_id = f"{plot_prefix}{str(block).zfill(1)}{str(plot_num).zfill(2)}"
                boundary_plots.append(plot_id)
    
    return yield_df[yield_df['plot_id'].isin(boundary_plots)].copy()

def get_variety_rep_summary(yield_df: pd.DataFrame) -> pd.DataFrame:
    summary = yield_df.groupby(['variety', 'rep']).agg(
        count=('plot_id', 'count'),
        mean_yield=('yield_kg', 'mean'),
        std_yield=('yield_kg', 'std')
    ).reset_index()
    
    summary['rep'] = summary['rep'].astype(str)
    return summary

def get_block_rep_distribution(yield_df: pd.DataFrame) -> pd.DataFrame:
    return yield_df.groupby(['block', 'rep']).agg(
        count=('plot_id', 'count'),
        mean_yield=('yield_kg', 'mean'),
        missing=('yield_kg', lambda x: x.isna().sum())
    ).reset_index()

def summarize_weather_events(weather_df: pd.DataFrame) -> pd.DataFrame:
    events = weather_df.dropna(subset=['event']).copy()
    events['event'] = events['event'].str.strip()
    return events[['date', 'temperature_max', 'temperature_min', 'rainfall_mm', 'wind_speed_kph', 'event']]

def get_yield_distribution_by_block(yield_df: pd.DataFrame) -> Dict[int, List[float]]:
    distribution = {}
    for block in yield_df['block'].unique():
        block_data = yield_df[yield_df['block'] == block]['yield_kg'].dropna().tolist()
        distribution[block] = block_data
    return distribution