import csv
import json
from typing import List, Dict, Any, Optional, Tuple
from io import StringIO, TextIOWrapper


class ImportParser:
    
    POTTERY_REQUIRED_FIELDS = ['pottery_id', 'trench', 'layer']
    POTTERY_OPTIONAL_FIELDS = [
        'square', 'length', 'width', 'thickness', 'weight',
        'decoration', 'paste_type', 'color', 'photo_path',
        'photo_hash', 'status', 'notes'
    ]
    
    GROUP_REQUIRED_FIELDS = ['group_id']
    GROUP_OPTIONAL_FIELDS = [
        'name', 'description', 'status', 'guess_evidence',
        'pottery_ids', 'notes'
    ]
    
    @classmethod
    def parse_csv(cls, csv_content: str, import_type: str = 'pottery') -> Tuple[List[Dict], List[str]]:
        errors = []
        records = []
        
        try:
            reader = csv.DictReader(StringIO(csv_content))
            fieldnames = reader.fieldnames if reader.fieldnames else []
            
            for row_num, row in enumerate(reader, start=2):
                try:
                    record = cls._parse_row(row, import_type, row_num)
                    if record:
                        records.append(record)
                except ValueError as e:
                    errors.append(f"行 {row_num}: {str(e)}")
        
        except Exception as e:
            errors.append(f"CSV 解析错误: {str(e)}")
        
        return records, errors
    
    @classmethod
    def parse_json(cls, json_content: str, import_type: str = 'pottery') -> Tuple[List[Dict], List[str]]:
        errors = []
        records = []
        
        try:
            data = json.loads(json_content)
            
            if isinstance(data, dict):
                if 'records' in data:
                    records_data = data['records']
                else:
                    records_data = [data]
            elif isinstance(data, list):
                records_data = data
            else:
                errors.append("JSON 格式错误: 期望为对象或数组")
                return [], errors
            
            for idx, item in enumerate(records_data):
                try:
                    record = cls._parse_row(item, import_type, idx + 1)
                    if record:
                        records.append(record)
                except ValueError as e:
                    errors.append(f"记录 {idx + 1}: {str(e)}")
        
        except json.JSONDecodeError as e:
            errors.append(f"JSON 解析错误: {str(e)}")
        except Exception as e:
            errors.append(f"解析错误: {str(e)}")
        
        return records, errors
    
    @classmethod
    def _parse_row(cls, row: Dict, import_type: str, row_num: int) -> Optional[Dict]:
        if import_type == 'pottery':
            return cls._parse_pottery_row(row, row_num)
        elif import_type == 'group':
            return cls._parse_group_row(row, row_num)
        else:
            raise ValueError(f"不支持的导入类型: {import_type}")
    
    @classmethod
    def _parse_pottery_row(cls, row: Dict, row_num: int) -> Dict:
        pottery = {}
        
        for field in cls.POTTERY_REQUIRED_FIELDS:
            value = cls._get_field_value(row, field)
            if value is None or value == '':
                raise ValueError(f"必填字段 '{field}' 为空")
            pottery[field] = value
        
        for field in cls.POTTERY_OPTIONAL_FIELDS:
            value = cls._get_field_value(row, field)
            if value is not None:
                pottery[field] = value
        
        pottery = cls._convert_numeric_fields(pottery, ['length', 'width', 'thickness', 'weight'])
        
        return pottery
    
    @classmethod
    def _parse_group_row(cls, row: Dict, row_num: int) -> Dict:
        group = {}
        
        for field in cls.GROUP_REQUIRED_FIELDS:
            value = cls._get_field_value(row, field)
            if value is None or value == '':
                raise ValueError(f"必填字段 '{field}' 为空")
            group[field] = value
        
        for field in cls.GROUP_OPTIONAL_FIELDS:
            value = cls._get_field_value(row, field)
            if value is not None:
                group[field] = value
        
        if 'pottery_ids' in group:
            pottery_ids = group['pottery_ids']
            if isinstance(pottery_ids, str):
                pottery_ids = [pid.strip() for pid in pottery_ids.split(',') if pid.strip()]
            group['pottery_ids'] = pottery_ids
        
        return group
    
    @staticmethod
    def _get_field_value(row: Dict, field: str) -> Any:
        if field in row:
            value = row[field]
            if isinstance(value, str):
                value = value.strip()
            return value if value != '' else None
        for key in row.keys():
            if key.lower().replace('_', '').replace(' ', '') == field.lower().replace('_', ''):
                value = row[key]
                if isinstance(value, str):
                    value = value.strip()
                return value if value != '' else None
        return None
    
    @staticmethod
    def _convert_numeric_fields(data: Dict, fields: List[str]) -> Dict:
        for field in fields:
            if field in data and data[field] is not None:
                try:
                    if isinstance(data[field], str):
                        data[field] = float(data[field].strip())
                    elif not isinstance(data[field], (int, float)):
                        data[field] = float(data[field])
                except (ValueError, TypeError):
                    pass
        return data
    
    @classmethod
    def detect_format(cls, content: str) -> Optional[str]:
        content = content.strip()
        if content.startswith('{') or content.startswith('['):
            try:
                json.loads(content)
                return 'json'
            except json.JSONDecodeError:
                pass
        
        if ',' in content or '\t' in content or ';' in content:
            lines = content.split('\n')
            if len(lines) >= 2:
                first_line = lines[0]
                if ',' in first_line:
                    return 'csv'
                elif '\t' in first_line:
                    return 'tsv'
        
        return None
