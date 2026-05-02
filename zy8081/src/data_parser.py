import pandas as pd
import yaml
import os
from typing import Tuple, Dict, Any, Optional

def load_plot_yield(file_path: str) -> Tuple[pd.DataFrame, list]:
    errors = []
    try:
        df = pd.read_csv(file_path)
        required_columns = ['plot_id', 'block', 'rep', 'variety', 'yield_kg', 'harvest_date']
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            errors.append(f"缺失必需列: {', '.join(missing_cols)}")
            return df, errors
        
        df['block'] = df['block'].astype(int)
        df['rep'] = df['rep'].astype(int)
        df['yield_kg'] = pd.to_numeric(df['yield_kg'], errors='coerce')
        df['harvest_date'] = pd.to_datetime(df['harvest_date'], errors='coerce')
        
        if df['harvest_date'].isna().any():
            errors.append(f"存在无效的收获日期格式，共 {df['harvest_date'].isna().sum()} 条")
        
        return df, errors
    except Exception as e:
        errors.append(f"读取产量文件失败: {str(e)}")
        return pd.DataFrame(), errors

def load_weather(file_path: str) -> Tuple[pd.DataFrame, list]:
    errors = []
    try:
        df = pd.read_csv(file_path)
        required_columns = ['date', 'temperature_max', 'temperature_min', 'rainfall_mm']
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            errors.append(f"缺失必需列: {', '.join(missing_cols)}")
            return df, errors
        
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df['temperature_max'] = pd.to_numeric(df['temperature_max'], errors='coerce')
        df['temperature_min'] = pd.to_numeric(df['temperature_min'], errors='coerce')
        df['rainfall_mm'] = pd.to_numeric(df['rainfall_mm'], errors='coerce')
        
        if df['date'].isna().any():
            errors.append(f"存在无效的日期格式，共 {df['date'].isna().sum()} 条")
        
        return df, errors
    except Exception as e:
        errors.append(f"读取天气文件失败: {str(e)}")
        return pd.DataFrame(), errors

def load_trial_design(file_path: str) -> Tuple[Dict[str, Any], list]:
    errors = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            design = yaml.safe_load(f)
        
        required_fields = ['trial_name', 'location', 'year', 'design_type', 'total_blocks', 'total_reps', 'varieties']
        missing_fields = [field for field in required_fields if field not in design]
        if missing_fields:
            errors.append(f"试验设计文件缺失必需字段: {', '.join(missing_fields)}")
        
        return design, errors
    except Exception as e:
        errors.append(f"读取试验设计文件失败: {str(e)}")
        return {}, errors

def validate_data(yield_df: pd.DataFrame, weather_df: pd.DataFrame, design: Dict[str, Any]) -> list:
    errors = []
    
    expected_blocks = set(range(1, design.get('total_blocks', 0) + 1))
    actual_blocks = set(yield_df['block'].unique())
    missing_blocks = expected_blocks - actual_blocks
    if missing_blocks:
        errors.append(f"缺失区组: {', '.join(map(str, sorted(missing_blocks)))}")
    
    expected_reps = set(range(1, design.get('total_reps', 0) + 1))
    for block in actual_blocks:
        block_reps = set(yield_df[yield_df['block'] == block]['rep'].unique())
        missing_reps = expected_reps - block_reps
        if missing_reps:
            errors.append(f"区组 {block} 缺失重复: {', '.join(map(str, sorted(missing_reps)))}")
    
    plot_counts = yield_df['plot_id'].value_counts()
    duplicate_plots = plot_counts[plot_counts > 1].index.tolist()
    if duplicate_plots:
        errors.append(f"同一地块多次记录: {', '.join(duplicate_plots)}")
    
    design_varieties = {v['name'] for v in design.get('varieties', [])}
    data_varieties = set(yield_df['variety'].unique())
    unknown_varieties = data_varieties - design_varieties
    if unknown_varieties:
        errors.append(f"未知品种: {', '.join(unknown_varieties)}")
    
    return errors

def parse_all_data(yield_path: str, weather_path: str, design_path: str) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, Any], list]:
    all_errors = []
    
    yield_df, yield_errors = load_plot_yield(yield_path)
    all_errors.extend(yield_errors)
    
    weather_df, weather_errors = load_weather(weather_path)
    all_errors.extend(weather_errors)
    
    design, design_errors = load_trial_design(design_path)
    all_errors.extend(design_errors)
    
    if not yield_df.empty and not weather_df.empty and design:
        validation_errors = validate_data(yield_df, weather_df, design)
        all_errors.extend(validation_errors)
    
    return yield_df, weather_df, design, all_errors