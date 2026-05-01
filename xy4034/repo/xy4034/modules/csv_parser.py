import pandas as pd
import io
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

@dataclass
class CSVParseResult:
    table_name: str
    df: pd.DataFrame
    file_name: str
    row_count: int
    column_count: int

def detect_table_type(file_name: str, df: pd.DataFrame) -> str:
    file_lower = file_name.lower()
    columns_lower = [str(col).lower() for col in df.columns]
    
    if '批次' in file_lower or 'batch' in file_lower:
        if '菜品' in columns_lower or '生产时间' in columns_lower:
            return 'batches'
    elif '温度' in file_lower or 'temperature' in file_lower:
        if '冷柜' in columns_lower or '温度值' in columns_lower:
            return 'temperatures'
    elif '交接' in file_lower or 'handover' in file_lower:
        if '签收' in columns_lower:
            return 'handover'
    elif '留样' in file_lower or 'sample' in file_lower or '抽检' in file_lower:
        if '抽检结论' in columns_lower or '留样编号' in columns_lower:
            return 'samples'
    
    if '批次号' in columns_lower and '菜品' in columns_lower and '生产时间' in columns_lower:
        return 'batches'
    if '冷柜编号' in columns_lower or '温度值' in columns_lower:
        return 'temperatures'
    if '交接签收时间' in columns_lower:
        return 'handover'
    if '留样编号' in columns_lower or '抽检结论' in columns_lower:
        return 'samples'
    
    return 'unknown'

def validate_csv_structure(df: pd.DataFrame, table_type: str) -> Dict[str, Any]:
    validation_result = {
        'valid': True,
        'errors': [],
        'warnings': []
    }
    
    required_columns = {
        'batches': ['批次号', '菜品', '生产时间'],
        'temperatures': ['批次号', '冷柜编号', '温度读数时间', '温度值'],
        'handover': ['批次号', '交接签收时间'],
        'samples': ['批次号', '留样编号', '抽检结论']
    }
    
    if table_type in required_columns:
        for col in required_columns[table_type]:
            if col not in df.columns:
                validation_result['valid'] = False
                validation_result['errors'].append(f"缺少必需字段: {col}")
    
    if df.empty:
        validation_result['valid'] = False
        validation_result['errors'].append("数据为空")
    
    if '批次号' in df.columns:
        if df['批次号'].isnull().any():
            validation_result['warnings'].append("存在空的批次号")
    
    return validation_result

def parse_csv_file(file_content) -> CSVParseResult:
    if isinstance(file_content, str):
        df = pd.read_csv(file_content, encoding='utf-8-sig')
        file_name = file_content
    else:
        df = pd.read_csv(file_content, encoding='utf-8-sig')
        file_name = file_content.name if hasattr(file_content, 'name') else 'unknown.csv'
    
    return CSVParseResult(
        table_name='unknown',
        df=df,
        file_name=file_name,
        row_count=len(df),
        column_count=len(df.columns)
    )

def parse_all_csv_files(files) -> Dict[str, pd.DataFrame]:
    result = {}
    parse_results = []
    
    for file in files:
        try:
            if isinstance(file, str):
                parse_result = parse_csv_file(file)
            else:
                file.seek(0)
                content = io.StringIO(file.getvalue().decode('utf-8-sig'))
                df = pd.read_csv(content)
                parse_result = CSVParseResult(
                    table_name='unknown',
                    df=df,
                    file_name=file.name,
                    row_count=len(df),
                    column_count=len(df.columns)
                )
            
            table_type = detect_table_type(parse_result.file_name, parse_result.df)
            parse_result.table_name = table_type
            
            if table_type != 'unknown':
                validation = validate_csv_structure(parse_result.df, table_type)
                if validation['valid']:
                    if table_type in result:
                        result[table_type] = pd.concat([result[table_type], parse_result.df], ignore_index=True)
                    else:
                        result[table_type] = parse_result.df
                else:
                    print(f"文件 {parse_result.file_name} 验证失败: {validation['errors']}")
            
            parse_results.append(parse_result)
            
        except Exception as e:
            print(f"解析文件时出错: {str(e)}")
            continue
    
    return result

def normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    column_mapping = {
        'batch_number': '批次号',
        'batch no': '批次号',
        'batch': '批次号',
        'dish': '菜品',
        'product': '菜品',
        'production_time': '生产时间',
        'produce time': '生产时间',
        'outbound_time': '出库时间',
        'out time': '出库时间',
        'store': '门店',
        'shop': '门店',
        'delivery_car': '配送车',
        'car': '配送车',
        'freezer_id': '冷柜编号',
        'freezer': '冷柜编号',
        'temp_time': '温度读数时间',
        'temperature_time': '温度读数时间',
        'temperature': '温度值',
        'temp': '温度值',
        'signoff_time': '交接签收时间',
        'sign time': '交接签收时间',
        'sample_id': '留样编号',
        'sample': '留样编号',
        'inspection_result': '抽检结论',
        'result': '抽检结论'
    }
    
    new_columns = {}
    for col in df.columns:
        col_lower = str(col).lower().strip()
        if col_lower in column_mapping:
            new_columns[col] = column_mapping[col_lower]
    
    if new_columns:
        df = df.rename(columns=new_columns)
    
    return df
