import csv
import json
from pathlib import Path
from typing import List, Dict, Any, Tuple
from datetime import datetime


class ParseError(Exception):
    pass


class PetCareRecord:
    def __init__(self, data: Dict[str, Any]):
        self.raw_data = data
        self.record_id = data.get('record_id', '')
        self.date = data.get('date', '')
        self.cage_number = data.get('cage_number', '')
        self.pet_names = self._parse_pet_names(data.get('pet_names', ''))
        self.pet_count = len(self.pet_names)
        self.photos = self._parse_photos(data.get('photos', ''))
        self.feeding_status = data.get('feeding_status', '')
        self.health_status = data.get('health_status', '')
        self.notes = data.get('notes', '')
        self.source_file = ''

    def _parse_pet_names(self, names_str: str) -> List[str]:
        if not names_str:
            return []
        return [name.strip() for name in names_str.split('、') if name.strip()]

    def _parse_photos(self, photos_str: str) -> List[Dict[str, str]]:
        if not photos_str:
            return []
        photos = []
        for photo_info in photos_str.split(';'):
            if not photo_info.strip():
                continue
            parts = photo_info.split('|')
            photo = {'filename': parts[0].strip() if len(parts) > 0 else ''}
            if len(parts) > 1:
                photo['timestamp'] = parts[1].strip()
            photos.append(photo)
        return photos

    def to_dict(self) -> Dict[str, Any]:
        return {
            'record_id': self.record_id,
            'date': self.date,
            'cage_number': self.cage_number,
            'pet_names': self.pet_names,
            'pet_count': self.pet_count,
            'photos': self.photos,
            'feeding_status': self.feeding_status,
            'health_status': self.health_status,
            'notes': self.notes,
            'source_file': self.source_file
        }


class ReportParser:
    def parse_file(self, file_path: Path) -> Tuple[List[PetCareRecord], List[str]]:
        records = []
        errors = []
        
        if not file_path.exists():
            errors.append(f"文件不存在: {file_path}")
            return records, errors
        
        try:
            if file_path.suffix.lower() == '.csv':
                return self._parse_csv(file_path)
            elif file_path.suffix.lower() == '.json':
                return self._parse_json(file_path)
            else:
                errors.append(f"不支持的文件格式: {file_path.suffix}")
                return records, errors
        except Exception as e:
            errors.append(f"文件解析失败: {file_path}, 错误: {str(e)}")
            return records, errors

    def _parse_csv(self, file_path: Path) -> Tuple[List[PetCareRecord], List[str]]:
        records = []
        errors = []
        required_fields = {'record_id', 'date', 'cage_number'}
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                if reader.fieldnames is None:
                    errors.append(f"CSV文件为空或没有表头: {file_path.name}")
                    return records, errors
                
                missing_fields = required_fields - set(reader.fieldnames)
                if missing_fields:
                    errors.append(f"CSV缺少必要字段: {', '.join(missing_fields)}")
                    return records, errors
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        record = PetCareRecord(row)
                        record.source_file = file_path.name
                        records.append(record)
                    except Exception as e:
                        errors.append(f"行 {row_num} 解析失败: {str(e)}")
        except UnicodeDecodeError:
            errors.append(f"文件编码错误，不是有效的UTF-8编码: {file_path.name}")
        except csv.Error as e:
            errors.append(f"CSV格式错误: {str(e)}")
        
        if not records and not errors:
            errors.append(f"文件没有有效数据记录: {file_path.name}")
        
        return records, errors

    def _parse_json(self, file_path: Path) -> Tuple[List[PetCareRecord], List[str]]:
        records = []
        errors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    for idx, item in enumerate(data):
                        try:
                            record = PetCareRecord(item)
                            record.source_file = file_path.name
                            records.append(record)
                        except Exception as e:
                            errors.append(f"记录 {idx} 解析失败: {str(e)}")
                else:
                    errors.append("JSON文件必须是数组格式")
        except json.JSONDecodeError as e:
            errors.append(f"JSON格式错误: {str(e)}")
        
        return records, errors
