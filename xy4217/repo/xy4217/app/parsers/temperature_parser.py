import csv
import json
from typing import Dict, Any
from datetime import datetime
from pydantic import BaseModel, field_validator


class TemperatureData(BaseModel):
    fridge_id: str
    fridge_name: str = None
    temperature: float
    min_temp: float = None
    max_temp: float = None
    log_time: datetime
    status: str = "normal"
    abnormal_reason: str = None

    @field_validator('temperature', 'min_temp', 'max_temp', mode='before')
    def parse_float(cls, v):
        if v is None or v == '':
            return None
        if isinstance(v, str):
            return float(v.strip())
        return v

    @field_validator('log_time', mode='before')
    def parse_datetime(cls, v):
        if v is None or v == '':
            return None
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            v = v.strip()
            formats = [
                '%Y-%m-%d %H:%M:%S',
                '%Y-%m-%d %H:%M',
                '%Y-%m-%d',
                '%Y/%m/%d %H:%M:%S',
                '%Y/%m/%d %H:%M',
                '%Y/%m/%d',
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(v, fmt)
                except ValueError:
                    continue
            raise ValueError(f"无法解析日期时间: {v}")
        return v


def parse_temperature_csv(csv_content: str) -> Dict[str, Any]:
    lines = csv_content.strip().split('\n')
    reader = csv.DictReader(lines)
    
    logs = []
    errors = []
    
    for row_num, row in enumerate(reader, start=2):
        try:
            data = {
                'fridge_id': row.get('冰箱ID', row.get('fridge_id', '')).strip(),
                'fridge_name': row.get('冰箱名称', row.get('fridge_name', '')).strip(),
                'temperature': row.get('温度', row.get('temperature', '0')).strip(),
                'min_temp': row.get('最低温度', row.get('min_temp', '')).strip(),
                'max_temp': row.get('最高温度', row.get('max_temp', '')).strip(),
                'log_time': row.get('记录时间', row.get('log_time', '')).strip(),
                'status': row.get('状态', row.get('status', 'normal')).strip(),
                'abnormal_reason': row.get('异常原因', row.get('abnormal_reason', '')).strip(),
            }
            
            validated = TemperatureData(**data)
            logs.append(validated.model_dump())
        except Exception as e:
            errors.append({
                'row': row_num,
                'error': str(e),
                'data': row
            })
    
    return {
        'success': len(errors) == 0,
        'logs': logs,
        'errors': errors,
        'total': len(logs) + len(errors)
    }


def parse_temperature_json(json_content: str) -> Dict[str, Any]:
    errors = []
    logs = []
    
    try:
        data = json.loads(json_content)
    except json.JSONDecodeError as e:
        return {
            'success': False,
            'logs': [],
            'errors': [{'error': f'JSON解析错误: {str(e)}'}],
            'total': 0
        }
    
    if isinstance(data, dict) and 'logs' in data:
        log_list = data['logs']
    elif isinstance(data, list):
        log_list = data
    else:
        log_list = [data]
    
    for idx, item in enumerate(log_list):
        try:
            item_data = {
                'fridge_id': item.get('fridge_id', item.get('冰箱ID', '')),
                'fridge_name': item.get('fridge_name', item.get('冰箱名称')),
                'temperature': item.get('temperature', item.get('温度', 0)),
                'min_temp': item.get('min_temp', item.get('最低温度')),
                'max_temp': item.get('max_temp', item.get('最高温度')),
                'log_time': item.get('log_time', item.get('记录时间', '')),
                'status': item.get('status', item.get('状态', 'normal')),
                'abnormal_reason': item.get('abnormal_reason', item.get('异常原因')),
            }
            
            validated = TemperatureData(**item_data)
            logs.append(validated.model_dump())
        except Exception as e:
            errors.append({
                'index': idx,
                'error': str(e),
                'data': item
            })
    
    return {
        'success': len(errors) == 0,
        'logs': logs,
        'errors': errors,
        'total': len(logs) + len(errors)
    }
