import csv
import json
from typing import Dict, Any
from datetime import datetime
from pydantic import BaseModel, field_validator


class WasteData(BaseModel):
    waste_id: str
    prescription_id: str = None
    batch_number: str
    drug_name: str
    waste_amount: float
    unit: str = "mg"
    waste_reason: str
    waste_time: datetime
    operator: str = None
    waste_method: str = None
    closed: int = 0
    close_time: datetime = None
    closer: str = None
    remarks: str = None

    @field_validator('waste_amount', mode='before')
    def parse_float(cls, v):
        if isinstance(v, str):
            return float(v.strip())
        return v

    @field_validator('closed', mode='before')
    def parse_closed(cls, v):
        if isinstance(v, bool):
            return 1 if v else 0
        if isinstance(v, str):
            v_lower = v.strip().lower()
            if v_lower in ['true', 'yes', '是', '1', '已闭环']:
                return 1
            return 0
        return int(v) if v is not None else 0

    @field_validator('waste_time', 'close_time', mode='before')
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


def parse_waste_csv(csv_content: str) -> Dict[str, Any]:
    lines = csv_content.strip().split('\n')
    reader = csv.DictReader(lines)
    
    records = []
    errors = []
    
    for row_num, row in enumerate(reader, start=2):
        try:
            data = {
                'waste_id': row.get('废弃ID', row.get('waste_id', '')).strip(),
                'prescription_id': row.get('处方编号', row.get('prescription_id', '')).strip(),
                'batch_number': row.get('批号', row.get('batch_number', '')).strip(),
                'drug_name': row.get('药品名称', row.get('drug_name', '')).strip(),
                'waste_amount': row.get('废弃数量', row.get('waste_amount', '0')).strip(),
                'unit': row.get('单位', row.get('unit', 'mg')).strip(),
                'waste_reason': row.get('废弃原因', row.get('waste_reason', '')).strip(),
                'waste_time': row.get('废弃时间', row.get('waste_time', '')).strip(),
                'operator': row.get('操作人', row.get('operator', '')).strip(),
                'waste_method': row.get('废弃方式', row.get('waste_method', '')).strip(),
                'closed': row.get('是否闭环', row.get('closed', '0')).strip(),
                'close_time': row.get('闭环时间', row.get('close_time', '')).strip(),
                'closer': row.get('闭环人', row.get('closer', '')).strip(),
                'remarks': row.get('备注', row.get('remarks', '')).strip(),
            }
            
            validated = WasteData(**data)
            records.append(validated.model_dump())
        except Exception as e:
            errors.append({
                'row': row_num,
                'error': str(e),
                'data': row
            })
    
    return {
        'success': len(errors) == 0,
        'records': records,
        'errors': errors,
        'total': len(records) + len(errors)
    }


def parse_waste_json(json_content: str) -> Dict[str, Any]:
    errors = []
    records = []
    
    try:
        data = json.loads(json_content)
    except json.JSONDecodeError as e:
        return {
            'success': False,
            'records': [],
            'errors': [{'error': f'JSON解析错误: {str(e)}'}],
            'total': 0
        }
    
    if isinstance(data, dict) and 'records' in data:
        record_list = data['records']
    elif isinstance(data, list):
        record_list = data
    else:
        record_list = [data]
    
    for idx, item in enumerate(record_list):
        try:
            item_data = {
                'waste_id': item.get('waste_id', item.get('废弃ID', '')),
                'prescription_id': item.get('prescription_id', item.get('处方编号')),
                'batch_number': item.get('batch_number', item.get('批号', '')),
                'drug_name': item.get('drug_name', item.get('药品名称', '')),
                'waste_amount': item.get('waste_amount', item.get('废弃数量', 0)),
                'unit': item.get('unit', item.get('单位', 'mg')),
                'waste_reason': item.get('waste_reason', item.get('废弃原因', '')),
                'waste_time': item.get('waste_time', item.get('废弃时间', '')),
                'operator': item.get('operator', item.get('操作人')),
                'waste_method': item.get('waste_method', item.get('废弃方式')),
                'closed': item.get('closed', item.get('是否闭环', 0)),
                'close_time': item.get('close_time', item.get('闭环时间')),
                'closer': item.get('closer', item.get('闭环人')),
                'remarks': item.get('remarks', item.get('备注')),
            }
            
            validated = WasteData(**item_data)
            records.append(validated.model_dump())
        except Exception as e:
            errors.append({
                'index': idx,
                'error': str(e),
                'data': item
            })
    
    return {
        'success': len(errors) == 0,
        'records': records,
        'errors': errors,
        'total': len(records) + len(errors)
    }
