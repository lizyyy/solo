import json
from typing import List, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, field_validator


class DrugBatchData(BaseModel):
    batch_number: str
    drug_name: str
    drug_id: str = None
    spec: str = None
    total_amount: float
    unit: str = "mg"
    used_amount: float = 0.0
    remaining_amount: float = 0.0
    expire_date: date
    receive_time: datetime = None
    storage_location: str = None
    supplier: str = None
    status: str = "active"

    @field_validator('total_amount', 'used_amount', 'remaining_amount', mode='before')
    def parse_float(cls, v):
        if isinstance(v, str):
            return float(v.strip())
        return v

    @field_validator('expire_date', mode='before')
    def parse_date(cls, v):
        if v is None or v == '':
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            v = v.strip()
            formats = [
                '%Y-%m-%d',
                '%Y/%m/%d',
                '%Y%m%d',
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(v, fmt).date()
                except ValueError:
                    continue
            raise ValueError(f"无法解析日期: {v}")
        return v

    @field_validator('receive_time', mode='before')
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


def parse_drug_batch_json(json_content: str) -> Dict[str, Any]:
    errors = []
    batches = []
    
    try:
        data = json.loads(json_content)
    except json.JSONDecodeError as e:
        return {
            'success': False,
            'batches': [],
            'errors': [{'error': f'JSON解析错误: {str(e)}'}],
            'total': 0
        }
    
    if isinstance(data, dict) and 'batches' in data:
        batch_list = data['batches']
    elif isinstance(data, list):
        batch_list = data
    else:
        batch_list = [data]
    
    for idx, item in enumerate(batch_list):
        try:
            item_data = {
                'batch_number': item.get('batch_number', item.get('批号', '')),
                'drug_name': item.get('drug_name', item.get('药品名称', '')),
                'drug_id': item.get('drug_id', item.get('药品ID')),
                'spec': item.get('spec', item.get('规格')),
                'total_amount': item.get('total_amount', item.get('总数量', 0)),
                'unit': item.get('unit', item.get('单位', 'mg')),
                'used_amount': item.get('used_amount', item.get('已使用数量', 0)),
                'remaining_amount': item.get('remaining_amount', item.get('剩余数量', 0)),
                'expire_date': item.get('expire_date', item.get('有效期', '')),
                'receive_time': item.get('receive_time', item.get('入库时间')),
                'storage_location': item.get('storage_location', item.get('存储位置')),
                'supplier': item.get('supplier', item.get('供应商')),
                'status': item.get('status', item.get('状态', 'active')),
            }
            
            if item_data['remaining_amount'] == 0 and item_data['total_amount'] > 0:
                item_data['remaining_amount'] = item_data['total_amount'] - item_data['used_amount']
            
            validated = DrugBatchData(**item_data)
            batches.append(validated.model_dump())
        except Exception as e:
            errors.append({
                'index': idx,
                'error': str(e),
                'data': item
            })
    
    return {
        'success': len(errors) == 0,
        'batches': batches,
        'errors': errors,
        'total': len(batches) + len(errors)
    }
