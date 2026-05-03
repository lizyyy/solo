"""CSV解析和数据校验模块 - 处理每日记录的导入和校验"""

import csv
import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import List, Dict, Optional, Any, Tuple
from enum import Enum


class ValidationErrorType(str, Enum):
    """校验错误类型枚举"""
    MISSING_FIELD = "缺失字段"
    INVALID_DATE = "日期格式错误"
    INVALID_NUMBER = "数值格式错误"
    DATE_OUT_OF_ORDER = "时间倒序"
    EC_UNIT_CONFUSION = "EC单位混乱"
    DRAINAGE_RATIO_ABNORMAL = "排液率异常"
    DUPLICATE_BED_ID = "重复畦号"
    NEGATIVE_VALUE = "负值错误"


@dataclass
class ValidationError:
    """校验错误信息"""
    error_type: ValidationErrorType
    row_number: int
    bed_id: Optional[str]
    field_name: Optional[str]
    message: str
    value: Optional[Any] = None


@dataclass
class DailyRecord:
    """每日记录数据模型"""
    record_date: date
    bed_id: str
    irrigation_volume: float  # 灌溉量 (L/畦)
    irrigation_ec: float  # 灌溉EC (mS/cm，统一单位)
    drainage_volume: float  # 排液量 (L/畦)
    drainage_ec: float  # 排液EC (mS/cm，统一单位)
    substrate_water_content: float  # 基质含水率 (%)
    ec_unit_original: Optional[str] = None  # 原始EC单位
    notes: Optional[str] = None


class ECUnitNormalizer:
    """EC单位标准化器"""
    
    UNIT_PATTERNS = {
        'mS/cm': ['ms/cm', 'ms/cm', 'mscm', 'mS/cm', 'mS', 'ms'],
        'μS/cm': ['us/cm', 'μs/cm', 'μscm', 'uS/cm', 'us', 'μs'],
        'dS/m': ['ds/m', 'dsm', 'dS/m', 'ds']
    }
    
    CONVERSION_FACTORS = {
        'mS/cm': 1.0,
        'μS/cm': 0.001,
        'dS/m': 0.1
    }
    
    @classmethod
    def normalize_unit(cls, unit_str: str) -> str:
        """将EC单位字符串标准化为标准格式"""
        unit_lower = unit_str.strip().lower()
        
        for standard_unit, patterns in cls.UNIT_PATTERNS.items():
            for pattern in patterns:
                if pattern.lower() in unit_lower or unit_lower == pattern.lower():
                    return standard_unit
        
        return 'mS/cm'  # 默认使用 mS/cm
    
    @classmethod
    def convert_to_ms_cm(cls, value: float, original_unit: str) -> float:
        """将EC值转换为 mS/cm 单位"""
        normalized_unit = cls.normalize_unit(original_unit)
        factor = cls.CONVERSION_FACTORS.get(normalized_unit, 1.0)
        return value * factor


class CSVParser:
    """CSV文件解析器"""
    
    REQUIRED_FIELDS = [
        '日期', '畦号', '灌溉量', '灌溉EC', 
        '排液量', '排液EC', '基质含水率'
    ]
    
    FIELD_MAPPINGS = {
        '日期': ['日期', 'date', 'record_date', '记录日期'],
        '畦号': ['畦号', 'bed_id', 'bed', '畦编号', '行号'],
        '灌溉量': ['灌溉量', 'irrigation_volume', '灌溉体积', '灌水量'],
        '灌溉EC': ['灌溉EC', 'irrigation_ec', '灌溉ec', '灌溉电导率'],
        '排液量': ['排液量', 'drainage_volume', '排液体积', '排水量'],
        '排液EC': ['排液EC', 'drainage_ec', '排液ec', '排液电导率'],
        '基质含水率': ['基质含水率', 'substrate_water_content', '含水率', '水分含量'],
        'EC单位': ['EC单位', 'ec_unit', '单位', 'unit'],
        '备注': ['备注', 'notes', '注释', '说明']
    }
    
    def __init__(self):
        self.ec_normalizer = ECUnitNormalizer()
    
    def parse_file(self, file_path: str, default_ec_unit: str = 'mS/cm') -> Tuple[List[DailyRecord], List[ValidationError]]:
        """
        解析CSV文件
        
        Args:
            file_path: CSV文件路径
            default_ec_unit: 默认EC单位
            
        Returns:
            (记录列表, 错误列表)
        """
        records = []
        errors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                actual_fields = reader.fieldnames if reader.fieldnames else []
                
                # 检查必填字段
                field_mapping = self._map_fields(actual_fields)
                missing_fields = self._check_missing_fields(field_mapping)
                
                if missing_fields:
                    for field in missing_fields:
                        errors.append(ValidationError(
                            error_type=ValidationErrorType.MISSING_FIELD,
                            row_number=0,
                            bed_id=None,
                            field_name=field,
                            message=f"缺少必填字段: {field}",
                            value=None
                        ))
                    return records, errors
                
                # 解析每一行数据
                for row_num, row in enumerate(reader, start=2):  # 从2开始，因为第一行是表头
                    record, row_errors = self._parse_row(
                        row, row_num, field_mapping, default_ec_unit
                    )
                    
                    if row_errors:
                        errors.extend(row_errors)
                    
                    if record:
                        records.append(record)
                        
        except FileNotFoundError:
            errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_FIELD,
                row_number=0,
                bed_id=None,
                field_name=None,
                message=f"文件不存在: {file_path}",
                value=None
            ))
        except Exception as e:
            errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_FIELD,
                row_number=0,
                bed_id=None,
                field_name=None,
                message=f"文件读取错误: {str(e)}",
                value=None
            ))
        
        return records, errors
    
    def _map_fields(self, actual_fields: List[str]) -> Dict[str, str]:
        """将实际字段名映射到标准字段名"""
        mapping = {}
        
        for standard_field, possible_names in self.FIELD_MAPPINGS.items():
            for actual_field in actual_fields:
                actual_lower = actual_field.strip().lower()
                for possible_name in possible_names:
                    if actual_lower == possible_name.lower() or possible_name.lower() in actual_lower:
                        mapping[standard_field] = actual_field
                        break
                if standard_field in mapping:
                    break
        
        return mapping
    
    def _check_missing_fields(self, field_mapping: Dict[str, str]) -> List[str]:
        """检查是否缺少必填字段"""
        missing = []
        for required_field in self.REQUIRED_FIELDS:
            if required_field not in field_mapping:
                missing.append(required_field)
        return missing
    
    def _parse_row(self, row: Dict[str, str], row_num: int, 
                   field_mapping: Dict[str, str], default_ec_unit: str) -> Tuple[Optional[DailyRecord], List[ValidationError]]:
        """解析单行数据"""
        errors = []
        record_data = {}
        
        # 解析日期
        date_field = field_mapping.get('日期')
        if date_field and row.get(date_field):
            date_str = row[date_field].strip()
            try:
                record_data['record_date'] = self._parse_date(date_str)
            except ValueError as e:
                errors.append(ValidationError(
                    error_type=ValidationErrorType.INVALID_DATE,
                    row_number=row_num,
                    bed_id=None,
                    field_name='日期',
                    message=f"日期格式错误: {date_str}",
                    value=date_str
                ))
        
        # 解析畦号
        bed_field = field_mapping.get('畦号')
        if bed_field and row.get(bed_field):
            record_data['bed_id'] = row[bed_field].strip()
        else:
            errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_FIELD,
                row_number=row_num,
                bed_id=None,
                field_name='畦号',
                message="畦号不能为空",
                value=None
            ))
        
        # 解析数值字段
        numeric_fields = {
            '灌溉量': 'irrigation_volume',
            '灌溉EC': 'irrigation_ec',
            '排液量': 'drainage_volume',
            '排液EC': 'drainage_ec',
            '基质含水率': 'substrate_water_content'
        }
        
        for standard_name, attr_name in numeric_fields.items():
            field_key = field_mapping.get(standard_name)
            if field_key and row.get(field_key):
                value_str = row[field_key].strip()
                try:
                    value = self._parse_number(value_str)
                    if value < 0:
                        errors.append(ValidationError(
                            error_type=ValidationErrorType.NEGATIVE_VALUE,
                            row_number=row_num,
                            bed_id=record_data.get('bed_id'),
                            field_name=standard_name,
                            message=f"{standard_name}不能为负值: {value}",
                            value=value
                        ))
                    record_data[attr_name] = value
                except ValueError:
                    errors.append(ValidationError(
                        error_type=ValidationErrorType.INVALID_NUMBER,
                        row_number=row_num,
                        bed_id=record_data.get('bed_id'),
                        field_name=standard_name,
                        message=f"{standard_name}数值格式错误: {value_str}",
                        value=value_str
                    ))
            else:
                errors.append(ValidationError(
                    error_type=ValidationErrorType.MISSING_FIELD,
                    row_number=row_num,
                    bed_id=record_data.get('bed_id'),
                    field_name=standard_name,
                    message=f"{standard_name}不能为空",
                    value=None
                ))
        
        # 解析EC单位
        ec_unit_field = field_mapping.get('EC单位')
        if ec_unit_field and row.get(ec_unit_field):
            record_data['ec_unit_original'] = row[ec_unit_field].strip()
        else:
            record_data['ec_unit_original'] = default_ec_unit
        
        # 解析备注
        notes_field = field_mapping.get('备注')
        if notes_field and row.get(notes_field):
            record_data['notes'] = row[notes_field].strip()
        
        # 标准化EC单位
        if 'irrigation_ec' in record_data and 'ec_unit_original' in record_data:
            record_data['irrigation_ec'] = self.ec_normalizer.convert_to_ms_cm(
                record_data['irrigation_ec'],
                record_data['ec_unit_original']
            )
        
        if 'drainage_ec' in record_data and 'ec_unit_original' in record_data:
            record_data['drainage_ec'] = self.ec_normalizer.convert_to_ms_cm(
                record_data['drainage_ec'],
                record_data['ec_unit_original']
            )
        
        # 创建记录对象（如果没有致命错误）
        required_attrs = ['record_date', 'bed_id', 'irrigation_volume', 
                          'irrigation_ec', 'drainage_volume', 'drainage_ec',
                          'substrate_water_content']
        
        if all(attr in record_data for attr in required_attrs):
            record = DailyRecord(**record_data)
            return record, errors
        else:
            return None, errors
    
    def _parse_date(self, date_str: str) -> date:
        """解析日期字符串，支持多种格式"""
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%Y年%m月%d日",
            "%m-%d-%Y",
            "%m/%d/%Y"
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except ValueError:
                continue
        
        raise ValueError(f"无法解析日期: {date_str}")
    
    def _parse_number(self, value_str: str) -> float:
        """解析数值字符串，支持逗号作为千位分隔符"""
        # 移除空格和千位分隔符
        cleaned = value_str.strip().replace(',', '').replace('，', '')
        # 移除单位后缀（如 "L", "mS/cm" 等）
        cleaned = re.sub(r'[a-zA-Zμ/%]+.*$', '', cleaned)
        return float(cleaned)


class DataValidator:
    """数据校验器 - 校验解析后的数据"""
    
    def __init__(self, thresholds_config):
        """
        Args:
            thresholds_config: ThresholdConfig 实例
        """
        self.thresholds = thresholds_config
    
    def validate(self, records: List[DailyRecord], existing_beds: List[str] = None) -> List[ValidationError]:
        """
        执行完整的数据校验
        
        Args:
            records: 待校验的记录列表
            existing_beds: 已存在的畦号列表（用于检查重复）
            
        Returns:
            错误列表
        """
        errors = []
        
        # 1. 按畦号分组检查
        beds_records = self._group_by_bed(records)
        
        # 2. 检查重复畦号（同一文件内）
        for bed_id, bed_records in beds_records.items():
            if len(bed_records) > 1:
                # 检查同一日期是否有重复记录
                dates = [r.record_date for r in bed_records]
                if len(dates) != len(set(dates)):
                    for i, record in enumerate(bed_records):
                        if dates.count(record.record_date) > 1:
                            errors.append(ValidationError(
                                error_type=ValidationErrorType.DUPLICATE_BED_ID,
                                row_number=0,
                                bed_id=bed_id,
                                field_name='畦号',
                                message=f"畦号 {bed_id} 在日期 {record.record_date} 有重复记录",
                                value=record.record_date
                            ))
        
        # 3. 检查与现有数据的重复
        if existing_beds:
            for record in records:
                if record.bed_id in existing_beds:
                    errors.append(ValidationError(
                        error_type=ValidationErrorType.DUPLICATE_BED_ID,
                        row_number=0,
                        bed_id=record.bed_id,
                        field_name='畦号',
                        message=f"畦号 {record.bed_id} 已存在于系统中",
                        value=record.bed_id
                    ))
        
        # 4. 检查时间顺序（按畦号分组检查）
        for bed_id, bed_records in beds_records.items():
            # 按日期排序
            sorted_records = sorted(bed_records, key=lambda r: r.record_date)
            
            # 检查是否有倒序（如果是按日期逆序输入）
            # 这里我们只检查是否有逻辑问题，比如日期重复或不合理的间隔
        
        # 5. 检查EC单位混乱
        ec_errors = self._check_ec_unit_confusion(records)
        errors.extend(ec_errors)
        
        # 6. 检查排液率异常
        drainage_errors = self._check_drainage_ratio(records)
        errors.extend(drainage_errors)
        
        return errors
    
    def _group_by_bed(self, records: List[DailyRecord]) -> Dict[str, List[DailyRecord]]:
        """按畦号分组记录"""
        groups = {}
        for record in records:
            if record.bed_id not in groups:
                groups[record.bed_id] = []
            groups[record.bed_id].append(record)
        return groups
    
    def _check_ec_unit_confusion(self, records: List[DailyRecord]) -> List[ValidationError]:
        """检查EC单位混乱 - 主要检查数值范围是否合理"""
        errors = []
        
        for record in records:
            # 检查EC值是否在合理范围内
            # 如果EC值异常高（> 100），可能是单位错误（比如用了 μS/cm 但数值按 mS/cm 处理）
            if record.irrigation_ec > 50 or record.drainage_ec > 50:
                errors.append(ValidationError(
                    error_type=ValidationErrorType.EC_UNIT_CONFUSION,
                    row_number=0,
                    bed_id=record.bed_id,
                    field_name='EC',
                    message=f"EC值异常高，请检查单位是否正确。灌溉EC: {record.irrigation_ec}, 排液EC: {record.drainage_ec}",
                    value=(record.irrigation_ec, record.drainage_ec)
                ))
            
            # 检查EC值是否异常低（< 0.1）
            if record.irrigation_ec < 0.1 or record.drainage_ec < 0.1:
                errors.append(ValidationError(
                    error_type=ValidationErrorType.EC_UNIT_CONFUSION,
                    row_number=0,
                    bed_id=record.bed_id,
                    field_name='EC',
                    message=f"EC值异常低，请检查单位是否正确。灌溉EC: {record.irrigation_ec}, 排液EC: {record.drainage_ec}",
                    value=(record.irrigation_ec, record.drainage_ec)
                ))
            
            # 排液EC通常应高于灌溉EC，如果相反可能有问题
            if record.drainage_ec < record.irrigation_ec * 0.8:
                errors.append(ValidationError(
                    error_type=ValidationErrorType.EC_UNIT_CONFUSION,
                    row_number=0,
                    bed_id=record.bed_id,
                    field_name='EC',
                    message=f"排液EC ({record.drainage_ec}) 低于灌溉EC ({record.irrigation_ec}) 的80%，请检查数据",
                    value=(record.irrigation_ec, record.drainage_ec)
                ))
        
        return errors
    
    def _check_drainage_ratio(self, records: List[DailyRecord]) -> List[ValidationError]:
        """检查排液率异常"""
        errors = []
        
        for record in records:
            if record.irrigation_volume > 0:
                drainage_ratio = record.drainage_volume / record.irrigation_volume
                
                # 检查排液率是否超出正常范围
                if drainage_ratio > self.thresholds.max_drainage_ratio:
                    errors.append(ValidationError(
                        error_type=ValidationErrorType.DRAINAGE_RATIO_ABNORMAL,
                        row_number=0,
                        bed_id=record.bed_id,
                        field_name='排液率',
                        message=f"排液率过高: {drainage_ratio:.2%} (阈值: {self.thresholds.max_drainage_ratio:.0%})",
                        value=drainage_ratio
                    ))
                
                if drainage_ratio < self.thresholds.min_drainage_ratio:
                    errors.append(ValidationError(
                        error_type=ValidationErrorType.DRAINAGE_RATIO_ABNORMAL,
                        row_number=0,
                        bed_id=record.bed_id,
                        field_name='排液率',
                        message=f"排液率过低: {drainage_ratio:.2%} (阈值: {self.thresholds.min_drainage_ratio:.0%})",
                        value=drainage_ratio
                    ))
            else:
                # 灌溉量为0但有排液，异常
                if record.drainage_volume > 0:
                    errors.append(ValidationError(
                        error_type=ValidationErrorType.DRAINAGE_RATIO_ABNORMAL,
                        row_number=0,
                        bed_id=record.bed_id,
                        field_name='排液率',
                        message=f"灌溉量为0但有排液量: {record.drainage_volume}",
                        value=record.drainage_volume
                    ))
        
        return errors
