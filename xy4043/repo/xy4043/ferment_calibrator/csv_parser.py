"""
CSV解析和校验模块 - 导入实验CSV、逐行校验数据、隔离坏数据
"""
import csv
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass, asdict
from enum import Enum

from .ferment_config import FermentConfig


class ValidationErrorType(Enum):
    """校验错误类型"""
    MISSING_FIELD = "missing_field"
    INVALID_TIME_FORMAT = "invalid_time_format"
    INVALID_NUMERIC = "invalid_numeric"
    VALUE_OUT_OF_RANGE = "value_out_of_range"
    DUPLICATE_TIME = "duplicate_time"
    INVALID_PHASE = "invalid_phase"
    EMPTY_RECORD = "empty_record"


@dataclass
class ValidationError:
    """校验错误信息"""
    row_number: int
    error_type: ValidationErrorType
    field_name: Optional[str]
    error_message: str
    raw_value: Optional[str] = None


@dataclass
class FermentationRecord:
    """发酵数据记录"""
    time: datetime
    temperature: Optional[float] = None
    ph: Optional[float] = None
    dissolved_oxygen: Optional[float] = None
    stirring_speed: Optional[float] = None
    od600: Optional[float] = None
    feed_amount: Optional[float] = None
    feed_formulation: Optional[str] = None
    phase: Optional[str] = None
    batch_notes: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None


class CSVParser:
    """CSV文件解析器"""
    
    REQUIRED_FIELDS = ['time']
    NUMERIC_FIELDS = [
        'temperature', 'ph', 'dissolved_oxygen', 'stirring_speed',
        'od600', 'feed_amount'
    ]
    
    FIELD_MAPPINGS = {
        'time': ['时间', 'Time', 'timestamp', 'datetime', '时间戳'],
        'temperature': ['温度', 'Temperature', 'temp', 'T'],
        'ph': ['pH', 'ph', '酸碱度'],
        'dissolved_oxygen': ['溶氧', 'DO', 'Dissolved Oxygen', '溶解氧'],
        'stirring_speed': ['搅拌转速', '搅拌', 'rpm', 'RPM', 'Stirring'],
        'od600': ['OD600', 'od600', 'OD', '取样OD600'],
        'feed_amount': ['补料量', 'Feed', 'feed_amount', '补料体积'],
        'feed_formulation': ['补料配方', 'Feed Type', 'feed_type'],
        'phase': ['阶段', 'Phase', '生长阶段'],
        'batch_notes': ['批次备注', 'Notes', '备注', '注释']
    }
    
    TIME_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M",
        "%d-%m-%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%H:%M:%S",
        "%H:%M",
    ]
    
    def __init__(self, config: FermentConfig):
        self.config = config
        self.validation_errors: List[ValidationError] = []
        self.valid_records: List[FermentationRecord] = []
        self.quarantined_records: List[Dict[str, Any]] = []
        self.seen_times: Set[datetime] = set()
    
    def parse_file(self, file_path: str, batch_id: str = "", strain: str = "") -> Tuple[List[FermentationRecord], List[ValidationError]]:
        """
        解析单个CSV文件
        
        Args:
            file_path: CSV文件路径
            batch_id: 批次ID
            strain: 菌株名称
            
        Returns:
            (有效记录列表, 校验错误列表)
        """
        self.validation_errors.clear()
        self.valid_records.clear()
        self.quarantined_records.clear()
        self.seen_times.clear()
        
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        field_mapping = self._detect_fields(path)
        self._parse_records(path, field_mapping, batch_id, strain)
        
        return self.valid_records.copy(), self.validation_errors.copy()
    
    def _detect_fields(self, file_path: Path) -> Dict[str, str]:
        """
        检测CSV文件的字段映射
        
        Args:
            file_path: CSV文件路径
            
        Returns:
            标准字段名到CSV列名的映射
        """
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            header = next(reader, [])
        
        field_mapping = {}
        
        for csv_col in header:
            clean_col = csv_col.strip()
            for standard_field, aliases in self.FIELD_MAPPINGS.items():
                if clean_col.lower() in [alias.lower() for alias in aliases] or clean_col == standard_field:
                    field_mapping[standard_field] = csv_col
                    break
        
        if 'time' not in field_mapping and len(header) > 0:
            field_mapping['time'] = header[0]
        
        return field_mapping
    
    def _parse_records(self, file_path: Path, field_mapping: Dict[str, str], batch_id: str, strain: str) -> None:
        """
        解析并校验所有记录
        
        Args:
            file_path: CSV文件路径
            field_mapping: 字段映射
            batch_id: 批次ID
            strain: 菌株名称
        """
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row_num, row in enumerate(reader, start=2):
                record, errors = self._validate_row(row, field_mapping, row_num)
                
                if errors:
                    self.validation_errors.extend(errors)
                    self._quarantine_row(row, row_num, errors, batch_id, strain)
                elif record:
                    if record.time in self.seen_times:
                        dup_error = ValidationError(
                            row_number=row_num,
                            error_type=ValidationErrorType.DUPLICATE_TIME,
                            field_name='time',
                            error_message=f"重复的时间点: {record.time}",
                            raw_value=str(record.time)
                        )
                        self.validation_errors.append(dup_error)
                        self._quarantine_row(row, row_num, [dup_error], batch_id, strain)
                    else:
                        self.seen_times.add(record.time)
                        self.valid_records.append(record)
    
    def _validate_row(self, row: Dict[str, str], field_mapping: Dict[str, str], row_num: int) -> Tuple[Optional[FermentationRecord], List[ValidationError]]:
        """
        校验单行数据
        
        Args:
            row: CSV行数据
            field_mapping: 字段映射
            row_num: 行号
            
        Returns:
            (记录对象, 错误列表)
        """
        errors: List[ValidationError] = []
        record = FermentationRecord(time=datetime.min)
        has_data = False
        
        time_col = field_mapping.get('time', '')
        if not time_col or time_col not in row or not row[time_col].strip():
            errors.append(ValidationError(
                row_number=row_num,
                error_type=ValidationErrorType.MISSING_FIELD,
                field_name='time',
                error_message="缺少必填的时间字段"
            ))
        else:
            parsed_time = self._parse_time(row[time_col].strip())
            if parsed_time is None:
                errors.append(ValidationError(
                    row_number=row_num,
                    error_type=ValidationErrorType.INVALID_TIME_FORMAT,
                    field_name='time',
                    error_message=f"无效的时间格式: {row[time_col]}",
                    raw_value=row[time_col]
                ))
            else:
                record.time = parsed_time
                has_data = True
        
        numeric_validators = {
            'temperature': self._validate_temperature,
            'ph': self._validate_ph,
            'dissolved_oxygen': self._validate_dissolved_oxygen,
            'stirring_speed': self._validate_stirring_speed,
            'od600': self._validate_od600,
            'feed_amount': self._validate_feed_amount
        }
        
        for field, validator in numeric_validators.items():
            col_name = field_mapping.get(field)
            if col_name and col_name in row and row[col_name].strip():
                value_str = row[col_name].strip()
                try:
                    value = float(value_str.replace(',', ''))
                    error = validator(value, row_num, field)
                    if error:
                        errors.append(error)
                    else:
                        setattr(record, field, value)
                        has_data = True
                except ValueError:
                    errors.append(ValidationError(
                        row_number=row_num,
                        error_type=ValidationErrorType.INVALID_NUMERIC,
                        field_name=field,
                        error_message=f"无效的数值格式: {value_str}",
                        raw_value=value_str
                    ))
        
        phase_col = field_mapping.get('phase')
        if phase_col and phase_col in row and row[phase_col].strip():
            phase = row[phase_col].strip()
            allowed_phases = self.config.get_allowed_phases()
            if phase not in allowed_phases and phase.lower() not in [p.lower() for p in allowed_phases]:
                errors.append(ValidationError(
                    row_number=row_num,
                    error_type=ValidationErrorType.INVALID_PHASE,
                    field_name='phase',
                    error_message=f"无效的实验阶段: {phase}，允许的值: {allowed_phases}",
                    raw_value=phase
                ))
            else:
                record.phase = phase
                has_data = True
        
        feed_form_col = field_mapping.get('feed_formulation')
        if feed_form_col and feed_form_col in row and row[feed_form_col].strip():
            record.feed_formulation = row[feed_form_col].strip()
            has_data = True
        
        notes_col = field_mapping.get('batch_notes')
        if notes_col and notes_col in row and row[notes_col].strip():
            record.batch_notes = row[notes_col].strip()
            has_data = True
        
        record.raw_data = row.copy()
        
        if not has_data and len(errors) == 0:
            errors.append(ValidationError(
                row_number=row_num,
                error_type=ValidationErrorType.EMPTY_RECORD,
                field_name=None,
                error_message="空记录或所有字段都为空"
            ))
        
        if errors:
            return None, errors
        return record, []
    
    def _parse_time(self, time_str: str) -> Optional[datetime]:
        """
        解析时间字符串
        
        Args:
            time_str: 时间字符串
            
        Returns:
            datetime对象或None
        """
        for fmt in self.TIME_FORMATS:
            try:
                parsed = datetime.strptime(time_str, fmt)
                if parsed.year == 1900:
                    today = datetime.today()
                    parsed = parsed.replace(year=today.year, month=today.month, day=today.day)
                return parsed
            except ValueError:
                continue
        
        import re
        patterns = [
            r'(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?',
            r'(\d{4})/(\d{2})/(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?',
        ]
        for pattern in patterns:
            match = re.match(pattern, time_str)
            if match:
                groups = match.groups()
                year, month, day = int(groups[0]), int(groups[1]), int(groups[2])
                hour, minute = int(groups[3]), int(groups[4])
                second = int(groups[5]) if groups[5] else 0
                return datetime(year, month, day, hour, minute, second)
        
        return None
    
    def _validate_temperature(self, value: float, row_num: int, field: str) -> Optional[ValidationError]:
        """校验温度"""
        threshold = self.config.get_anomaly_threshold('temperature')
        if 'min' in threshold and value < threshold['min']:
            return ValidationError(
                row_number=row_num,
                error_type=ValidationErrorType.VALUE_OUT_OF_RANGE,
                field_name=field,
                error_message=f"温度低于最小值: {value} < {threshold['min']}",
                raw_value=str(value)
            )
        if 'max' in threshold and value > threshold['max']:
            return ValidationError(
                row_number=row_num,
                error_type=ValidationErrorType.VALUE_OUT_OF_RANGE,
                field_name=field,
                error_message=f"温度高于最大值: {value} > {threshold['max']}",
                raw_value=str(value)
            )
        return None
    
    def _validate_ph(self, value: float, row_num: int, field: str) -> Optional[ValidationError]:
        """校验pH"""
        threshold = self.config.get_anomaly_threshold('ph')
        if 'min' in threshold and value < threshold['min']:
            return ValidationError(
                row_number=row_num,
                error_type=ValidationErrorType.VALUE_OUT_OF_RANGE,
                field_name=field,
                error_message=f"pH低于最小值: {value} < {threshold['min']}",
                raw_value=str(value)
            )
        if 'max' in threshold and value > threshold['max']:
            return ValidationError(
                row_number=row_num,
                error_type=ValidationErrorType.VALUE_OUT_OF_RANGE,
                field_name=field,
                error_message=f"pH高于最大值: {value} > {threshold['max']}",
                raw_value=str(value)
            )
        return None
    
    def _validate_dissolved_oxygen(self, value: float, row_num: int, field: str) -> Optional[ValidationError]:
        """校验溶氧"""
        threshold = self.config.get_anomaly_threshold('dissolved_oxygen')
        if 'min' in threshold and value < threshold['min']:
            return ValidationError(
                row_number=row_num,
                error_type=ValidationErrorType.VALUE_OUT_OF_RANGE,
                field_name=field,
                error_message=f"溶氧低于最小值: {value} < {threshold['min']}",
                raw_value=str(value)
            )
        if 'max' in threshold and value > threshold['max']:
            return ValidationError(
                row_number=row_num,
                error_type=ValidationErrorType.VALUE_OUT_OF_RANGE,
                field_name=field,
                error_message=f"溶氧高于最大值: {value} > {threshold['max']}",
                raw_value=str(value)
            )
        return None
    
    def _validate_stirring_speed(self, value: float, row_num: int, field: str) -> Optional[ValidationError]:
        """校验搅拌转速"""
        threshold = self.config.get_anomaly_threshold('stirring_speed')
        if 'min' in threshold and value < threshold['min']:
            return ValidationError(
                row_number=row_num,
                error_type=ValidationErrorType.VALUE_OUT_OF_RANGE,
                field_name=field,
                error_message=f"搅拌转速低于最小值: {value} < {threshold['min']}",
                raw_value=str(value)
            )
        if 'max' in threshold and value > threshold['max']:
            return ValidationError(
                row_number=row_num,
                error_type=ValidationErrorType.VALUE_OUT_OF_RANGE,
                field_name=field,
                error_message=f"搅拌转速高于最大值: {value} > {threshold['max']}",
                raw_value=str(value)
            )
        return None
    
    def _validate_od600(self, value: float, row_num: int, field: str) -> Optional[ValidationError]:
        """校验OD600"""
        threshold = self.config.get_anomaly_threshold('od600')
        if 'min' in threshold and value < threshold['min']:
            return ValidationError(
                row_number=row_num,
                error_type=ValidationErrorType.VALUE_OUT_OF_RANGE,
                field_name=field,
                error_message=f"OD600低于最小值: {value} < {threshold['min']}",
                raw_value=str(value)
            )
        if 'max' in threshold and value > threshold['max']:
            return ValidationError(
                row_number=row_num,
                error_type=ValidationErrorType.VALUE_OUT_OF_RANGE,
                field_name=field,
                error_message=f"OD600高于最大值: {value} > {threshold['max']}",
                raw_value=str(value)
            )
        return None
    
    def _validate_feed_amount(self, value: float, row_num: int, field: str) -> Optional[ValidationError]:
        """校验补料量"""
        if value < 0:
            return ValidationError(
                row_number=row_num,
                error_type=ValidationErrorType.VALUE_OUT_OF_RANGE,
                field_name=field,
                error_message=f"补料量不能为负数: {value}",
                raw_value=str(value)
            )
        return None
    
    def _quarantine_row(self, row: Dict[str, str], row_num: int, errors: List[ValidationError], batch_id: str, strain: str) -> None:
        """
        将坏数据隔离
        
        Args:
            row: CSV行数据
            row_num: 行号
            errors: 错误列表
            batch_id: 批次ID
            strain: 菌株名称
        """
        quarantine_entry = {
            'row_number': row_num,
            'batch_id': batch_id,
            'strain': strain,
            'raw_data': row.copy(),
            'errors': [
                {
                    'error_type': e.error_type.value,
                    'field_name': e.field_name,
                    'error_message': e.error_message,
                    'raw_value': e.raw_value
                }
                for e in errors
            ],
            'quarantine_time': datetime.now().isoformat()
        }
        self.quarantined_records.append(quarantine_entry)
    
    def save_quarantine(self, output_path: str) -> int:
        """
        保存隔离数据到JSON文件
        
        Args:
            output_path: 输出文件路径
            
        Returns:
            保存的记录数量
        """
        if not self.quarantined_records:
            return 0
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        existing_data = []
        if output_file.exists():
            with open(output_file, 'r', encoding='utf-8') as f:
                try:
                    existing_data = json.load(f)
                except json.JSONDecodeError:
                    existing_data = []
        
        all_data = existing_data + self.quarantined_records
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, indent=2, ensure_ascii=False)
        
        return len(self.quarantined_records)


def import_multiple_files(
    config: FermentConfig,
    file_paths: List[str],
    batch_id: str = "",
    strain: str = ""
) -> Tuple[List[FermentationRecord], Dict[str, Any]]:
    """
    导入多个CSV文件
    
    Args:
        config: 配置对象
        file_paths: 文件路径列表
        batch_id: 批次ID
        strain: 菌株名称
        
    Returns:
        (所有有效记录, 汇总信息)
    """
    all_records: List[FermentationRecord] = []
    all_errors: List[ValidationError] = []
    all_quarantined: List[Dict[str, Any]] = []
    file_stats: Dict[str, Dict] = {}
    
    for file_path in file_paths:
        parser = CSVParser(config)
        records, errors = parser.parse_file(file_path, batch_id, strain)
        
        all_records.extend(records)
        all_errors.extend(errors)
        all_quarantined.extend(parser.quarantined_records)
        
        file_stats[file_path] = {
            'total_rows': len(records) + len(parser.quarantined_records),
            'valid_rows': len(records),
            'quarantined_rows': len(parser.quarantined_records),
            'errors': [e.error_message for e in errors]
        }
    
    all_records.sort(key=lambda r: r.time)
    
    summary = {
        'batch_id': batch_id,
        'strain': strain,
        'files_processed': len(file_paths),
        'file_stats': file_stats,
        'total_valid_records': len(all_records),
        'total_quarantined': len(all_quarantined),
        'total_errors': len(all_errors),
        'time_range': {
            'start': all_records[0].time.isoformat() if all_records else None,
            'end': all_records[-1].time.isoformat() if all_records else None
        }
    }
    
    return all_records, summary
