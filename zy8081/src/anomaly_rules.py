import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple

def detect_missing_yield(yield_df: pd.DataFrame) -> pd.DataFrame:
    missing = yield_df[yield_df['yield_kg'].isna()].copy()
    missing['anomaly_type'] = 'missing_yield'
    missing['anomaly_desc'] = '产量数据缺失'
    return missing

def detect_boundary_anomaly(yield_df: pd.DataFrame, design: Dict[str, Any], threshold: float = 2.0) -> pd.DataFrame:
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
    
    yield_df['is_boundary'] = yield_df['plot_id'].isin(boundary_plots)
    
    non_boundary_yield = yield_df[~yield_df['is_boundary'] & ~yield_df['yield_kg'].isna()]['yield_kg']
    if len(non_boundary_yield) == 0:
        return pd.DataFrame()
    
    mean_non_boundary = non_boundary_yield.mean()
    std_non_boundary = non_boundary_yield.std()
    
    boundary_data = yield_df[yield_df['is_boundary'] & ~yield_df['yield_kg'].isna()].copy()
    boundary_data['z_score'] = (boundary_data['yield_kg'] - mean_non_boundary) / std_non_boundary
    
    anomalies = boundary_data[abs(boundary_data['z_score']) > threshold].copy()
    anomalies['anomaly_type'] = 'boundary_anomaly'
    anomalies['anomaly_desc'] = '边界行产量异常'
    return anomalies

def detect_outliers(yield_df: pd.DataFrame, method: str = 'iqr', threshold: float = 1.5) -> pd.DataFrame:
    valid_yield = yield_df[~yield_df['yield_kg'].isna()].copy()
    
    if method == 'iqr':
        q1 = valid_yield['yield_kg'].quantile(0.25)
        q3 = valid_yield['yield_kg'].quantile(0.75)
        iqr = q3 - q1
        lower_bound = q1 - threshold * iqr
        upper_bound = q3 + threshold * iqr
        outliers = valid_yield[(valid_yield['yield_kg'] < lower_bound) | (valid_yield['yield_kg'] > upper_bound)]
    else:
        mean = valid_yield['yield_kg'].mean()
        std = valid_yield['yield_kg'].std()
        outliers = valid_yield[abs((valid_yield['yield_kg'] - mean) / std) > threshold]
    
    outliers['anomaly_type'] = 'outlier'
    outliers['anomaly_desc'] = '产量值异常'
    return outliers

def detect_weather_shocks(weather_df: pd.DataFrame, design: Dict[str, Any]) -> pd.DataFrame:
    shocks = []
    
    temp_threshold = design.get('temperature_threshold', 32)
    rainfall_threshold = design.get('rainfall_threshold', 20)
    wind_threshold = design.get('wind_threshold', 25)
    
    for _, row in weather_df.iterrows():
        date = row['date']
        events = []
        
        if row['temperature_max'] >= temp_threshold:
            events.append(f"高温({row['temperature_max']}°C)")
        if row['rainfall_mm'] >= rainfall_threshold:
            events.append(f"暴雨({row['rainfall_mm']}mm)")
        if row.get('wind_speed_kph', 0) >= wind_threshold:
            events.append(f"大风({row['wind_speed_kph']}km/h)")
        if row.get('event'):
            events.append(row['event'])
        
        if events:
            shocks.append({
                'date': date,
                'shock_type': ', '.join(events),
                'temperature_max': row['temperature_max'],
                'temperature_min': row['temperature_min'],
                'rainfall_mm': row['rainfall_mm'],
                'wind_speed_kph': row.get('wind_speed_kph')
            })
    
    return pd.DataFrame(shocks)

def detect_duplicate_plots(yield_df: pd.DataFrame) -> pd.DataFrame:
    plot_counts = yield_df['plot_id'].value_counts()
    duplicate_plots = plot_counts[plot_counts > 1].index.tolist()
    
    duplicates = yield_df[yield_df['plot_id'].isin(duplicate_plots)].copy()
    duplicates['anomaly_type'] = 'duplicate'
    duplicates['anomaly_desc'] = '重复记录'
    return duplicates

def detect_missing_blocks(yield_df: pd.DataFrame, design: Dict[str, Any]) -> List[Dict[str, Any]]:
    expected_blocks = set(range(1, design.get('total_blocks', 0) + 1))
    actual_blocks = set(yield_df['block'].unique())
    missing_blocks = sorted(expected_blocks - actual_blocks)
    
    return [{'block': block, 'anomaly_type': 'missing_block', 'anomaly_desc': '缺失区组'} for block in missing_blocks]

def detect_missing_reps(yield_df: pd.DataFrame, design: Dict[str, Any]) -> pd.DataFrame:
    expected_reps = set(range(1, design.get('total_reps', 0) + 1))
    
    missing_reps = []
    for block in range(1, design.get('total_blocks', 0) + 1):
        block_data = yield_df[yield_df['block'] == block]
        actual_reps = set(block_data['rep'].unique())
        missing = expected_reps - actual_reps
        for rep in missing:
            missing_reps.append({
                'block': block,
                'rep': rep,
                'anomaly_type': 'missing_rep',
                'anomaly_desc': f'区组{block}缺失重复{rep}'
            })
    
    return pd.DataFrame(missing_reps)

def run_all_anomaly_checks(yield_df: pd.DataFrame, weather_df: pd.DataFrame, design: Dict[str, Any]) -> Tuple[pd.DataFrame, pd.DataFrame]:
    all_anomalies = []
    
    missing_yield = detect_missing_yield(yield_df)
    all_anomalies.append(missing_yield)
    
    boundary_anomaly = detect_boundary_anomaly(yield_df, design)
    all_anomalies.append(boundary_anomaly)
    
    outliers = detect_outliers(yield_df)
    all_anomalies.append(outliers)
    
    duplicates = detect_duplicate_plots(yield_df)
    all_anomalies.append(duplicates)
    
    missing_reps = detect_missing_reps(yield_df, design)
    all_anomalies.append(missing_reps)
    
    anomaly_df = pd.concat(all_anomalies, ignore_index=True)
    
    weather_shocks = detect_weather_shocks(weather_df, design)
    
    return anomaly_df, weather_shocks