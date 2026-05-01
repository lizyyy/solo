import pandas as pd
import re
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

@dataclass
class FieldValidationError:
    table_name: str
    field_name: str
    row_index: int
    value: Any
    message: str
    error_type: str

def validate_datetime_format(value: str, field_name: str, table_name: str, row_index: int) -> Optional[FieldValidationError]:
    if pd.isna(value) or value == '':
        return FieldValidationError(
            table_name=table_name,
            field_name=field_name,
            row_index=row_index,
            value=value,
            message=f"字段 {field_name} 为空值",
            error_type='missing_value'
        )
    
    value_str = str(value).strip()
    
    datetime_patterns = [
        r'^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$',
        r'^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$',
        r'^\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2}$',
        r'^\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}$',
        r'^\d{4}-\d{2}-\d{2}$',
        r'^\d{4}/\d{2}/\d{2}$',
    ]
    
    matches = False
    for pattern in datetime_patterns:
        if re.match(pattern, value_str):
            matches = True
            break
    
    if not matches:
        return FieldValidationError(
            table_name=table_name,
            field_name=field_name,
            row_index=row_index,
            value=value,
            message=f"时间格式不正确: {value_str}",
            error_type='invalid_format'
        )
    
    return None

def validate_numeric_range(
    value: Any, 
    field_name: str, 
    table_name: str, 
    row_index: int,
    min_value: float = None,
    max_value: float = None
) -> Optional[FieldValidationError]:
    if pd.isna(value):
        return FieldValidationError(
            table_name=table_name,
            field_name=field_name,
            row_index=row_index,
            value=value,
            message=f"字段 {field_name} 为空值",
            error_type='missing_value'
        )
    
    try:
        num_value = float(value)
    except (ValueError, TypeError):
        return FieldValidationError(
            table_name=table_name,
            field_name=field_name,
            row_index=row_index,
            value=value,
            message=f"数值格式不正确: {value}",
            error_type='invalid_format'
        )
    
    if min_value is not None and num_value < min_value:
        return FieldValidationError(
            table_name=table_name,
            field_name=field_name,
            row_index=row_index,
            value=value,
            message=f"数值 {num_value} 小于最小值 {min_value}",
            error_type='out_of_range'
        )
    
    if max_value is not None and num_value > max_value:
        return FieldValidationError(
            table_name=table_name,
            field_name=field_name,
            row_index=row_index,
            value=value,
            message=f"数值 {num_value} 大于最大值 {max_value}",
            error_type='out_of_range'
        )
    
    return None

def validate_required_field(
    value: Any,
    field_name: str,
    table_name: str,
    row_index: int
) -> Optional[FieldValidationError]:
    if pd.isna(value) or value == '' or (isinstance(value, str) and value.strip() == ''):
        return FieldValidationError(
            table_name=table_name,
            field_name=field_name,
            row_index=row_index,
            value=value,
            message=f"必填字段 {field_name} 为空",
            error_type='missing_value'
        )
    return None

def validate_batches_table(df: pd.DataFrame, table_name: str = 'batches') -> List[FieldValidationError]:
    errors = []
    
    required_fields = ['批次号', '菜品', '生产时间']
    datetime_fields = ['生产时间', '出库时间']
    
    for idx, row in df.iterrows():
        for field in required_fields:
            err = validate_required_field(row.get(field), field, table_name, idx)
            if err:
                errors.append(err)
        
        for field in datetime_fields:
            if field in df.columns:
                err = validate_datetime_format(row.get(field), field, table_name, idx)
                if err:
                    errors.append(err)
    
    batch_numbers = df['批次号'].tolist()
    seen = set()
    for idx, batch_no in enumerate(batch_numbers):
        if pd.notna(batch_no):
            if batch_no in seen:
                errors.append(FieldValidationError(
                    table_name=table_name,
                    field_name='批次号',
                    row_index=idx,
                    value=batch_no,
                    message=f"批次号重复: {batch_no}",
                    error_type='duplicate'
                ))
            seen.add(batch_no)
    
    return errors

def validate_temperatures_table(df: pd.DataFrame, table_name: str = 'temperatures') -> List[FieldValidationError]:
    errors = []
    
    required_fields = ['批次号', '冷柜编号', '温度读数时间', '温度值']
    
    for idx, row in df.iterrows():
        for field in required_fields:
            err = validate_required_field(row.get(field), field, table_name, idx)
            if err:
                errors.append(err)
        
        if '温度读数时间' in df.columns:
            err = validate_datetime_format(row.get('温度读数时间'), '温度读数时间', table_name, idx)
            if err:
                errors.append(err)
        
        if '温度值' in df.columns:
            err = validate_numeric_range(row.get('温度值'), '温度值', table_name, idx, min_value=-30, max_value=50)
            if err:
                errors.append(err)
    
    return errors

def validate_handover_table(df: pd.DataFrame, table_name: str = 'handover') -> List[FieldValidationError]:
    errors = []
    
    required_fields = ['批次号', '交接签收时间']
    
    for idx, row in df.iterrows():
        for field in required_fields:
            err = validate_required_field(row.get(field), field, table_name, idx)
            if err:
                errors.append(err)
        
        if '交接签收时间' in df.columns:
            err = validate_datetime_format(row.get('交接签收时间'), '交接签收时间', table_name, idx)
            if err:
                errors.append(err)
    
    return errors

def validate_samples_table(df: pd.DataFrame, table_name: str = 'samples') -> List[FieldValidationError]:
    errors = []
    
    required_fields = ['批次号', '留样编号', '抽检结论']
    valid_results = ['合格', '不合格', '待检', 'PASS', 'FAIL', 'PENDING', '通过', '不通过']
    
    for idx, row in df.iterrows():
        for field in required_fields:
            err = validate_required_field(row.get(field), field, table_name, idx)
            if err:
                errors.append(err)
        
        if '抽检结论' in df.columns:
            result = row.get('抽检结论')
            if pd.notna(result) and str(result).strip() not in valid_results:
                errors.append(FieldValidationError(
                    table_name=table_name,
                    field_name='抽检结论',
                    row_index=idx,
                    value=result,
                    message=f"抽检结论值不规范: {result}",
                    error_type='invalid_value'
                ))
        
        for time_field in ['留样时间', '抽检时间']:
            if time_field in df.columns:
                err = validate_datetime_format(row.get(time_field), time_field, table_name, idx)
                if err:
                    errors.append(err)
    
    sample_numbers = df['留样编号'].tolist()
    seen = set()
    for idx, sample_no in enumerate(sample_numbers):
        if pd.notna(sample_no):
            if sample_no in seen:
                errors.append(FieldValidationError(
                    table_name=table_name,
                    field_name='留样编号',
                    row_index=idx,
                    value=sample_no,
                    message=f"留样编号重复: {sample_no}",
                    error_type='duplicate'
                ))
            seen.add(sample_no)
    
    return errors

def validate_all_fields(data: Dict[str, pd.DataFrame]) -> List[FieldValidationError]:
    all_errors = []
    
    validators = {
        'batches': validate_batches_table,
        'temperatures': validate_temperatures_table,
        'handover': validate_handover_table,
        'samples': validate_samples_table
    }
    
    for table_name, df in data.items():
        if table_name in validators:
            errors = validators[table_name](df, table_name)
            all_errors.extend(errors)
    
    return all_errors

def get_validation_summary(errors: List[FieldValidationError]) -> Dict[str, Any]:
    summary = {
        'total_errors': len(errors),
        'by_table': {},
        'by_type': {},
        'by_field': {}
    }
    
    for error in errors:
        if error.table_name not in summary['by_table']:
            summary['by_table'][error.table_name] = 0
        summary['by_table'][error.table_name] += 1
        
        if error.error_type not in summary['by_type']:
            summary['by_type'][error.error_type] = 0
        summary['by_type'][error.error_type] += 1
        
        if error.field_name not in summary['by_field']:
            summary['by_field'][error.field_name] = 0
        summary['by_field'][error.field_name] += 1
    
    return summary
