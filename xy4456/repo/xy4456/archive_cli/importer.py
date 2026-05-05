import os
import json
import uuid
from datetime import datetime, date
from typing import Dict, Any, List, Optional, TypeVar, Type
from pathlib import Path
import pandas as pd
from .models import (
    FilmRoll, Scanner, MaintenanceRecord, TemperatureHumidityLog,
    Reservation, Note
)
from .database import Database
from .exceptions import ImportError, ValidationError


T = TypeVar('T')


class DataImporter:
    """数据导入器 - 支持CSV和JSON格式"""
    
    # 数据类型映射
    DATA_TYPES = {
        'film_rolls': FilmRoll,
        'scanners': Scanner,
        'maintenance_records': MaintenanceRecord,
        'temp_humidity_logs': TemperatureHumidityLog,
        'reservations': Reservation,
        'notes': Note
    }
    
    def __init__(self, db: Database):
        self.db = db
    
    def import_file(self, file_path: str, data_type: str, 
                    overwrite: bool = False) -> Dict[str, Any]:
        """
        导入数据文件
        
        Args:
            file_path: 文件路径
            data_type: 数据类型 (film_rolls, scanners, maintenance_records, 
                      temp_humidity_logs, reservations, notes)
            overwrite: 是否覆盖已有数据
        
        Returns:
            导入统计信息
        """
        if data_type not in self.DATA_TYPES:
            raise ImportError(f"Unknown data type: {data_type}. "
                            f"Supported types: {list(self.DATA_TYPES.keys())}")
        
        file_path = Path(file_path)
        if not file_path.exists():
            raise ImportError(f"File not found: {file_path}")
        
        # 根据文件扩展名选择解析方式
        ext = file_path.suffix.lower()
        
        if ext == '.csv':
            data = self._parse_csv(file_path)
        elif ext == '.json':
            data = self._parse_json(file_path)
        else:
            raise ImportError(f"Unsupported file format: {ext}. "
                            f"Supported formats: .csv, .json")
        
        # 转换为模型对象列表
        model_class = self.DATA_TYPES[data_type]
        models = self._convert_to_models(data, model_class, data_type)
        
        # 导入到数据库
        stats = self._import_to_database(models, data_type, overwrite)
        
        return stats
    
    def _parse_csv(self, file_path: Path) -> List[Dict[str, Any]]:
        """解析CSV文件"""
        try:
            df = pd.read_csv(file_path, encoding='utf-8')
            # 替换NaN为None
            df = df.where(pd.notnull(df), None)
            return df.to_dict('records')
        except Exception as e:
            raise ImportError(f"Failed to parse CSV file: {e}") from e
    
    def _parse_json(self, file_path: Path) -> List[Dict[str, Any]]:
        """解析JSON文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 支持单个对象或数组
            if isinstance(data, dict):
                return [data]
            elif isinstance(data, list):
                return data
            else:
                raise ImportError("JSON file must contain an object or array")
        except json.JSONDecodeError as e:
            raise ImportError(f"Invalid JSON format: {e}") from e
        except Exception as e:
            raise ImportError(f"Failed to parse JSON file: {e}") from e
    
    def _convert_to_models(self, data: List[Dict[str, Any]], 
                           model_class: Type[T],
                           data_type: str) -> List[T]:
        """将原始数据转换为模型对象"""
        models = []
        
        for idx, item in enumerate(data):
            try:
                model = self._create_model(item, model_class, data_type, idx)
                models.append(model)
            except Exception as e:
                raise ImportError(f"Failed to convert record {idx}: {e}") from e
        
        return models
    
    def _create_model(self, item: Dict[str, Any], model_class: Type[T],
                      data_type: str, index: int) -> T:
        """创建单个模型对象"""
        # 标准化字段名（支持驼峰和下划线）
        item = self._normalize_keys(item)
        
        # 生成ID（如果没有提供）
        if 'id' not in item or not item['id']:
            item['id'] = str(uuid.uuid4())
        
        # 根据数据类型进行特殊处理
        if data_type == 'film_rolls':
            return self._create_film_roll(item)
        elif data_type == 'scanners':
            return self._create_scanner(item)
        elif data_type == 'maintenance_records':
            return self._create_maintenance_record(item)
        elif data_type == 'temp_humidity_logs':
            return self._create_temp_humidity_log(item)
        elif data_type == 'reservations':
            return self._create_reservation(item)
        elif data_type == 'notes':
            return self._create_note(item)
        
        raise ImportError(f"Unsupported data type: {data_type}")
    
    def _normalize_keys(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """标准化字典键名（驼峰转下划线）"""
        normalized = {}
        for key, value in item.items():
            # 驼峰转下划线
            new_key = ''.join(['_' + c.lower() if c.isupper() else c for c in key]).lstrip('_')
            normalized[new_key] = value
        return normalized
    
    def _create_film_roll(self, item: Dict[str, Any]) -> FilmRoll:
        """创建FilmRoll对象"""
        now = datetime.now()
        return FilmRoll(
            id=item['id'],
            title=item.get('title', ''),
            description=item.get('description'),
            format=item.get('format'),
            scanner_requirements=item.get('scanner_requirements'),
            location=item.get('location'),
            condition=item.get('condition'),
            metadata=item.get('metadata', {}),
            created_at=self._parse_datetime(item.get('created_at'), default=now),
            updated_at=self._parse_datetime(item.get('updated_at'), default=now)
        )
    
    def _create_scanner(self, item: Dict[str, Any]) -> Scanner:
        """创建Scanner对象"""
        now = datetime.now()
        supported_formats = item.get('supported_formats', [])
        
        # 处理字符串格式的支持列表（如"35mm,16mm"）
        if isinstance(supported_formats, str):
            supported_formats = [f.strip() for f in supported_formats.split(',') if f.strip()]
        
        return Scanner(
            id=item['id'],
            name=item.get('name', ''),
            model=item.get('model', ''),
            supported_formats=supported_formats,
            location=item.get('location'),
            status=item.get('status', 'active'),
            created_at=self._parse_datetime(item.get('created_at'), default=now),
            updated_at=self._parse_datetime(item.get('updated_at'), default=now)
        )
    
    def _create_maintenance_record(self, item: Dict[str, Any]) -> MaintenanceRecord:
        """创建MaintenanceRecord对象"""
        now = datetime.now()
        today = date.today()
        
        return MaintenanceRecord(
            id=item['id'],
            scanner_id=item.get('scanner_id', ''),
            maintenance_date=self._parse_date(item.get('maintenance_date'), default=today),
            next_maintenance_date=self._parse_date(item.get('next_maintenance_date')),
            technician=item.get('technician'),
            description=item.get('description'),
            status=item.get('status', 'completed'),
            created_at=self._parse_datetime(item.get('created_at'), default=now)
        )
    
    def _create_temp_humidity_log(self, item: Dict[str, Any]) -> TemperatureHumidityLog:
        """创建TemperatureHumidityLog对象"""
        now = datetime.now()
        
        return TemperatureHumidityLog(
            id=item['id'],
            location=item.get('location', ''),
            timestamp=self._parse_datetime(item.get('timestamp'), default=now),
            temperature=float(item.get('temperature', 0)),
            humidity=float(item.get('humidity', 0)),
            recorded_by=item.get('recorded_by'),
            notes=item.get('notes'),
            created_at=self._parse_datetime(item.get('created_at'), default=now)
        )
    
    def _create_reservation(self, item: Dict[str, Any]) -> Reservation:
        """创建Reservation对象"""
        now = datetime.now()
        
        return Reservation(
            id=item['id'],
            film_roll_id=item.get('film_roll_id', ''),
            reader_name=item.get('reader_name', ''),
            reader_contact=item.get('reader_contact'),
            start_time=self._parse_datetime(item.get('start_time'), default=now),
            end_time=self._parse_datetime(item.get('end_time'), default=now),
            purpose=item.get('purpose'),
            status=item.get('status', 'active'),
            created_at=self._parse_datetime(item.get('created_at'), default=now),
            updated_at=self._parse_datetime(item.get('updated_at'), default=now)
        )
    
    def _create_note(self, item: Dict[str, Any]) -> Note:
        """创建Note对象"""
        now = datetime.now()
        
        return Note(
            id=item['id'],
            related_type=item.get('related_type', ''),
            related_id=item.get('related_id', ''),
            content=item.get('content', ''),
            created_by=item.get('created_by'),
            created_at=self._parse_datetime(item.get('created_at'), default=now),
            updated_at=self._parse_datetime(item.get('updated_at'), default=now)
        )
    
    def _parse_datetime(self, value: Any, default: Optional[datetime] = None) -> datetime:
        """解析日期时间字符串"""
        if value is None:
            if default is not None:
                return default
            return datetime.now()
        
        if isinstance(value, datetime):
            return value
        
        if isinstance(value, date):
            return datetime.combine(value, datetime.min.time())
        
        # 尝试多种格式解析
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y-%m-%d',
            '%Y/%m/%d %H:%M:%S',
            '%Y/%m/%d',
        ]
        
        value_str = str(value).strip()
        
        # 尝试ISO格式
        try:
            return datetime.fromisoformat(value_str)
        except ValueError:
            pass
        
        # 尝试其他格式
        for fmt in formats:
            try:
                return datetime.strptime(value_str, fmt)
            except ValueError:
                continue
        
        if default is not None:
            return default
        
        raise ValueError(f"Cannot parse datetime: {value}")
    
    def _parse_date(self, value: Any, default: Optional[date] = None) -> Optional[date]:
        """解析日期字符串"""
        if value is None:
            return default
        
        if isinstance(value, date):
            return value
        
        if isinstance(value, datetime):
            return value.date()
        
        # 尝试解析
        try:
            dt = self._parse_datetime(value)
            return dt.date()
        except ValueError:
            if default is not None:
                return default
            raise
    
    def _import_to_database(self, models: List[Any], data_type: str,
                            overwrite: bool) -> Dict[str, Any]:
        """导入数据到数据库"""
        stats = {
            'data_type': data_type,
            'total': len(models),
            'imported': 0,
            'skipped': 0,
            'errors': 0,
            'error_details': []
        }
        
        for idx, model in enumerate(models):
            try:
                # 根据数据类型选择插入方法
                if data_type == 'film_rolls':
                    # 检查是否已存在
                    existing = self.db.get_film_roll(model.id)
                    if existing and not overwrite:
                        stats['skipped'] += 1
                        continue
                    self.db.insert_film_roll(model)
                
                elif data_type == 'scanners':
                    existing = self.db.get_scanner(model.id)
                    if existing and not overwrite:
                        stats['skipped'] += 1
                        continue
                    self.db.insert_scanner(model)
                
                elif data_type == 'maintenance_records':
                    self.db.insert_maintenance_record(model)
                
                elif data_type == 'temp_humidity_logs':
                    self.db.insert_temp_humidity_log(model)
                
                elif data_type == 'reservations':
                    self.db.insert_reservation(model)
                
                elif data_type == 'notes':
                    self.db.insert_note(model)
                
                stats['imported'] += 1
            
            except Exception as e:
                stats['errors'] += 1
                stats['error_details'].append({
                    'index': idx,
                    'id': getattr(model, 'id', None),
                    'error': str(e)
                })
        
        return stats
    
    def import_multiple(self, file_paths: List[str], data_types: List[str],
                        overwrite: bool = False) -> List[Dict[str, Any]]:
        """批量导入多个文件"""
        if len(file_paths) != len(data_types):
            raise ImportError("Number of file paths must match number of data types")
        
        results = []
        for file_path, data_type in zip(file_paths, data_types):
            try:
                result = self.import_file(file_path, data_type, overwrite)
                results.append(result)
            except ImportError as e:
                results.append({
                    'data_type': data_type,
                    'file': file_path,
                    'error': str(e),
                    'imported': 0,
                    'total': 0
                })
        
        return results
