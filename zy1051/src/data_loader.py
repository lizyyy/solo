import pandas as pd
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import io

REQUIRED_COLUMNS = [
    '日期', '线路', '站点', '计划发车时间', '实际发车时间',
    '计划到站时间', '实际到站时间', '座位数', '签到人数', '司机备注'
]

TIME_FORMATS = [
    '%H:%M', '%H:%M:%S', '%I:%M %p', '%I:%M:%S %p',
    '%Y-%m-%d %H:%M', '%Y-%m-%d %H:%M:%S'
]

class DataValidationError(Exception):
    pass

def parse_time(time_str: str, date_str: str = None) -> Optional[datetime]:
    if pd.isna(time_str) or str(time_str).strip() == '':
        return None
    
    time_str = str(time_str).strip()
    
    for fmt in TIME_FORMATS:
        try:
            if date_str:
                combined = f"{date_str} {time_str}"
                full_fmt = f"%Y-%m-%d {fmt}" if '%Y' not in fmt else fmt
                try:
                    return datetime.strptime(combined, full_fmt)
                except:
                    pass
            
            dt = datetime.strptime(time_str, fmt)
            return dt
        except:
            continue
    
    return None

def load_csv_from_file(file_path: str) -> pd.DataFrame:
    return pd.read_csv(file_path, encoding='utf-8-sig')

def load_csv_from_upload(uploaded_file) -> pd.DataFrame:
    return pd.read_csv(uploaded_file, encoding='utf-8-sig')

def validate_columns(df: pd.DataFrame) -> Tuple[bool, List[str]]:
    missing_columns = []
    for col in REQUIRED_COLUMNS:
        if col not in df.columns:
            missing_columns.append(col)
    
    return len(missing_columns) == 0, missing_columns

def validate_time_format(df: pd.DataFrame) -> Tuple[bool, Dict[str, List[int]]]:
    time_columns = ['计划发车时间', '实际发车时间', '计划到站时间', '实际到站时间']
    invalid_rows = {}
    
    for col in time_columns:
        if col not in df.columns:
            continue
            
        invalid = []
        for idx, val in enumerate(df[col]):
            if pd.isna(val):
                continue
            if parse_time(str(val)) is None:
                invalid.append(idx)
        
        if invalid:
            invalid_rows[col] = invalid
    
    return len(invalid_rows) == 0, invalid_rows

def validate_numeric_columns(df: pd.DataFrame) -> Tuple[bool, Dict[str, List[int]]]:
    numeric_cols = ['座位数', '签到人数']
    invalid_rows = {}
    
    for col in numeric_cols:
        if col not in df.columns:
            continue
            
        invalid = []
        for idx, val in enumerate(df[col]):
            try:
                float(val)
            except (ValueError, TypeError):
                invalid.append(idx)
        
        if invalid:
            invalid_rows[col] = invalid
    
    return len(invalid_rows) == 0, invalid_rows

def check_overloading(df: pd.DataFrame) -> List[Dict]:
    overload_records = []
    
    if '座位数' not in df.columns or '签到人数' not in df.columns:
        return overload_records
    
    for idx, row in df.iterrows():
        try:
            seats = float(row['座位数'])
            passengers = float(row['签到人数'])
            
            if passengers > seats:
                overload_records.append({
                    '行号': idx + 1,
                    '日期': row.get('日期', ''),
                    '线路': row.get('线路', ''),
                    '站点': row.get('站点', ''),
                    '座位数': seats,
                    '签到人数': passengers,
                    '超载人数': passengers - seats
                })
        except (ValueError, TypeError):
            continue
    
    return overload_records

def validate_data(df: pd.DataFrame) -> Dict:
    result = {
        'valid': True,
        'errors': [],
        'warnings': [],
        'info': []
    }
    
    cols_valid, missing_cols = validate_columns(df)
    if not cols_valid:
        result['valid'] = False
        result['errors'].append({
            'type': '缺失字段',
            'message': f'缺少必要字段: {", ".join(missing_cols)}',
            'details': missing_cols
        })
    
    numeric_valid, invalid_numeric = validate_numeric_columns(df)
    if not numeric_valid:
        result['valid'] = False
        for col, rows in invalid_numeric.items():
            result['errors'].append({
                'type': '数值格式错误',
                'message': f'列 "{col}" 存在无效数值，行号: {[r+1 for r in rows[:5]]}{"..." if len(rows) > 5 else ""}',
                'details': {'列': col, '行号': [r+1 for r in rows]}
            })
    
    time_valid, invalid_time = validate_time_format(df)
    if not time_valid:
        for col, rows in invalid_time.items():
            result['warnings'].append({
                'type': '时间格式警告',
                'message': f'列 "{col}" 存在无法解析的时间格式，行号: {[r+1 for r in rows[:5]]}{"..." if len(rows) > 5 else ""}',
                'details': {'列': col, '行号': [r+1 for r in rows]}
            })
    
    overloads = check_overloading(df)
    if overloads:
        result['warnings'].append({
            'type': '超载警告',
            'message': f'发现 {len(overloads)} 条超载记录',
            'details': overloads[:10]
        })
    
    result['info'].append({
        'type': '数据统计',
        'message': f'共 {len(df)} 条记录',
        'details': {'总行数': len(df)}
    })
    
    return result

def parse_time_columns(df: pd.DataFrame) -> pd.DataFrame:
    result_df = df.copy()
    
    time_columns = [
        ('计划发车时间', '计划发车时间_parsed'),
        ('实际发车时间', '实际发车时间_parsed'),
        ('计划到站时间', '计划到站时间_parsed'),
        ('实际到站时间', '实际到站时间_parsed')
    ]
    
    for input_col, output_col in time_columns:
        if input_col in result_df.columns:
            result_df[output_col] = result_df.apply(
                lambda row: parse_time(str(row[input_col]), str(row.get('日期', '')))
                if pd.notna(row[input_col]) else None,
                axis=1
            )
    
    return result_df

def get_sample_data() -> pd.DataFrame:
    from src.sample_data import generate_sample_data
    return generate_sample_data()
