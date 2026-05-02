from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
import pandas as pd
import numpy as np
from dateutil import parser as date_parser

from models import (
    NoiseData, NoiseRecord,
    WeatherData, WeatherRecord,
    ComplaintData, ComplaintRecord
)


@dataclass
class ValidationError:
    row_index: int
    column: str
    error_type: str
    message: str
    value: Any = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'row_index': self.row_index,
            'column': self.column,
            'error_type': self.error_type,
            'message': self.message,
            'value': self.value
        }


@dataclass
class ValidationResult:
    is_valid: bool = True
    total_records: int = 0
    valid_records: int = 0
    invalid_records: int = 0
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_error(self, error: ValidationError):
        self.errors.append(error)
        self.is_valid = False
    
    def add_warning(self, warning: ValidationError):
        self.warnings.append(warning)
    
    def get_error_summary(self) -> Dict[str, int]:
        summary = {}
        for error in self.errors:
            etype = error.error_type
            if etype not in summary:
                summary[etype] = 0
            summary[etype] += 1
        return summary
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'is_valid': self.is_valid,
            'total_records': self.total_records,
            'valid_records': self.valid_records,
            'invalid_records': self.invalid_records,
            'errors': [e.to_dict() for e in self.errors],
            'warnings': [w.to_dict() for w in self.warnings],
            'error_summary': self.get_error_summary(),
            'metadata': self.metadata
        }


class NoiseDataValidator:
    """噪声数据导入校验器"""
    
    VALID_NOISE_RANGE = (0, 140)  # 合理的分贝范围
    VALID_SAMPLING_INTERVALS = [1, 5, 10, 60]  # 支持的采样间隔（秒）
    
    def __init__(self, 
                 site_id: Optional[str] = None,
                 expected_sampling_interval: Optional[int] = None,
                 noise_threshold: float = 55.0):
        self.site_id = site_id
        self.expected_sampling_interval = expected_sampling_interval
        self.noise_threshold = noise_threshold
        self.validation_result = ValidationResult()
    
    def validate_timestamp(self, value: Any, row_index: int) -> Tuple[Optional[datetime], bool]:
        """校验并解析时间戳"""
        if pd.isna(value) or value is None:
            self.validation_result.add_error(ValidationError(
                row_index=row_index,
                column='timestamp',
                error_type='missing_timestamp',
                message='时间戳为空',
                value=value
            ))
            return None, False
        
        try:
            if isinstance(value, datetime):
                return value, True
            elif isinstance(value, pd.Timestamp):
                return value.to_pydatetime(), True
            else:
                parsed = date_parser.parse(str(value))
                return parsed, True
        except Exception as e:
            self.validation_result.add_error(ValidationError(
                row_index=row_index,
                column='timestamp',
                error_type='invalid_timestamp',
                message=f'无法解析时间戳: {str(e)}',
                value=value
            ))
            return None, False
    
    def validate_site_id(self, value: Any, row_index: int) -> Tuple[Optional[str], bool]:
        """校验站点编号"""
        if pd.isna(value) or value is None or str(value).strip() == '':
            self.validation_result.add_error(ValidationError(
                row_index=row_index,
                column='site_id',
                error_type='missing_site_id',
                message='站点编号为空',
                value=value
            ))
            return None, False
        
        site_id = str(value).strip()
        
        if self.site_id is not None and site_id != self.site_id:
            self.validation_result.add_warning(ValidationError(
                row_index=row_index,
                column='site_id',
                error_type='site_id_mismatch',
                message=f'站点编号与预期不一致: 预期{self.site_id}, 实际{site_id}',
                value=site_id
            ))
        
        return site_id, True
    
    def validate_noise_value(self, value: Any, column: str, row_index: int) -> Tuple[Optional[float], bool]:
        """校验噪声值"""
        if pd.isna(value) or value is None:
            self.validation_result.add_warning(ValidationError(
                row_index=row_index,
                column=column,
                error_type='missing_noise_value',
                message=f'{column}值为空',
                value=value
            ))
            return None, False
        
        try:
            noise_value = float(value)
            
            if not (self.VALID_NOISE_RANGE[0] <= noise_value <= self.VALID_NOISE_RANGE[1]):
                self.validation_result.add_error(ValidationError(
                    row_index=row_index,
                    column=column,
                    error_type='invalid_noise_range',
                    message=f'{column}值超出合理范围({self.VALID_NOISE_RANGE[0]}-{self.VALID_NOISE_RANGE[1]} dB)',
                    value=noise_value
                ))
                return None, False
            
            return noise_value, True
            
        except (ValueError, TypeError):
            self.validation_result.add_error(ValidationError(
                row_index=row_index,
                column=column,
                error_type='invalid_noise_type',
                message=f'{column}值不是有效的数字',
                value=value
            ))
            return None, False
    
    def detect_sampling_intervals(self, timestamps: List[datetime]) -> Tuple[Optional[int], Dict[str, Any]]:
        """检测采样间隔"""
        if len(timestamps) < 2:
            return None, {'reason': '样本不足'}
        
        intervals = []
        for i in range(1, len(timestamps)):
            delta = timestamps[i] - timestamps[i-1]
            intervals.append(delta.total_seconds())
        
        if not intervals:
            return None, {'reason': '无法计算间隔'}
        
        median_interval = np.median(intervals)
        mean_interval = np.mean(intervals)
        std_interval = np.std(intervals)
        
        detected_interval = int(round(median_interval))
        
        issues = []
        if std_interval > 0.1:
            issues.append(f'采样间隔不一致 (标准差: {std_interval:.2f}秒)')
        
        if self.expected_sampling_interval is not None:
            if abs(detected_interval - self.expected_sampling_interval) > 1:
                issues.append(f'采样间隔与预期不一致: 检测到{detected_interval}秒, 预期{self.expected_sampling_interval}秒')
        
        return detected_interval, {
            'median_interval': median_interval,
            'mean_interval': mean_interval,
            'std_interval': std_interval,
            'issues': issues
        }
    
    def validate_dataframe(self, df: pd.DataFrame) -> ValidationResult:
        """校验整个DataFrame"""
        self.validation_result = ValidationResult()
        self.validation_result.total_records = len(df)
        
        required_columns = ['timestamp', 'laeq']
        
        for col in required_columns:
            if col not in df.columns:
                self.validation_result.add_error(ValidationError(
                    row_index=-1,
                    column=col,
                    error_type='missing_column',
                    message=f'缺少必需列: {col}',
                    value=None
                ))
        
        if not self.validation_result.is_valid:
            return self.validation_result
        
        records = []
        timestamps = []
        valid_count = 0
        
        for idx, row in df.iterrows():
            row_errors = []
            row_warnings = []
            
            timestamp, ts_valid = self.validate_timestamp(row.get('timestamp'), idx)
            site_id, site_valid = self.validate_site_id(row.get('site_id', self.site_id), idx)
            laeq, laeq_valid = self.validate_noise_value(row.get('laeq'), 'laeq', idx)
            
            lmax, _ = self.validate_noise_value(row.get('lmax'), 'lmax', idx)
            lmin, _ = self.validate_noise_value(row.get('lmin'), 'lmin', idx)
            l10, _ = self.validate_noise_value(row.get('l10'), 'l10', idx)
            l50, _ = self.validate_noise_value(row.get('l50'), 'l50', idx)
            l90, _ = self.validate_noise_value(row.get('l90'), 'l90', idx)
            
            is_valid = ts_valid and site_valid and laeq_valid
            is_missing = not laeq_valid
            
            if is_valid:
                valid_count += 1
                if timestamp:
                    timestamps.append(timestamp)
            
            record = NoiseRecord(
                timestamp=timestamp if timestamp else datetime.min,
                site_id=site_id if site_id else '',
                laeq=laeq if laeq_valid else np.nan,
                lmax=lmax,
                lmin=lmin,
                l10=l10,
                l50=l50,
                l90=l90,
                is_missing=is_missing,
                is_valid=is_valid
            )
            records.append(record)
        
        self.validation_result.valid_records = valid_count
        self.validation_result.invalid_records = len(df) - valid_count
        
        if timestamps:
            sampling_interval, interval_info = self.detect_sampling_intervals(timestamps)
            self.validation_result.metadata['sampling_interval'] = sampling_interval
            self.validation_result.metadata['interval_info'] = interval_info
            
            for issue in interval_info.get('issues', []):
                self.validation_result.add_warning(ValidationError(
                    row_index=-1,
                    column='sampling_interval',
                    error_type='sampling_interval_issue',
                    message=issue,
                    value=sampling_interval
                ))
        
        return self.validation_result
    
    def parse_and_validate(self, df: pd.DataFrame) -> Tuple[Optional[NoiseData], ValidationResult]:
        """解析并验证数据，返回NoiseData对象"""
        result = self.validate_dataframe(df)
        
        if not result.errors and result.valid_records > 0:
            site_ids = set()
            for idx, row in df.iterrows():
                site_id = row.get('site_id')
                if site_id is not None and not pd.isna(site_id):
                    site_ids.add(str(site_id).strip())
            
            if self.site_id is None and len(site_ids) == 1:
                self.site_id = site_ids.pop()
            elif self.site_id is None:
                self.site_id = 'UNKNOWN'
            
            sampling_interval = result.metadata.get('sampling_interval', 1) or 1
            
            records = []
            for idx, row in df.iterrows():
                timestamp, _ = self.validate_timestamp(row.get('timestamp'), idx)
                site_id, _ = self.validate_site_id(row.get('site_id', self.site_id), idx)
                laeq, _ = self.validate_noise_value(row.get('laeq'), 'laeq', idx)
                
                lmax = row.get('lmax')
                lmin = row.get('lmin')
                l10 = row.get('l10')
                l50 = row.get('l50')
                l90 = row.get('l90')
                
                if pd.notna(lmax):
                    try:
                        lmax = float(lmax)
                    except:
                        lmax = None
                else:
                    lmax = None
                
                record = NoiseRecord(
                    timestamp=timestamp if timestamp else datetime.min,
                    site_id=site_id if site_id else self.site_id,
                    laeq=laeq if laeq is not None else np.nan,
                    lmax=lmax,
                    lmin=lmin if pd.notna(lmin) else None,
                    l10=l10 if pd.notna(l10) else None,
                    l50=l50 if pd.notna(l50) else None,
                    l90=l90 if pd.notna(l90) else None
                )
                records.append(record)
            
            noise_data = NoiseData(
                site_id=self.site_id,
                records=records,
                sampling_interval_seconds=sampling_interval
            )
            
            return noise_data, result
        
        return None, result


class WeatherDataValidator:
    """天气数据导入校验器"""
    
    VALID_TEMP_RANGE = (-40, 50)
    VALID_HUMIDITY_RANGE = (0, 100)
    VALID_WIND_SPEED_RANGE = (0, 50)
    
    def __init__(self, site_id: Optional[str] = None):
        self.site_id = site_id
        self.validation_result = ValidationResult()
    
    def validate_timestamp(self, value: Any, row_index: int) -> Tuple[Optional[datetime], bool]:
        if pd.isna(value) or value is None:
            self.validation_result.add_error(ValidationError(
                row_index=row_index,
                column='timestamp',
                error_type='missing_timestamp',
                message='时间戳为空',
                value=value
            ))
            return None, False
        
        try:
            if isinstance(value, datetime):
                return value, True
            elif isinstance(value, pd.Timestamp):
                return value.to_pydatetime(), True
            else:
                parsed = date_parser.parse(str(value))
                return parsed, True
        except Exception as e:
            self.validation_result.add_error(ValidationError(
                row_index=row_index,
                column='timestamp',
                error_type='invalid_timestamp',
                message=f'无法解析时间戳: {str(e)}',
                value=value
            ))
            return None, False
    
    def validate_numeric_range(self, value: Any, column: str, 
                                 valid_range: Tuple[float, float], 
                                 row_index: int) -> Tuple[Optional[float], bool]:
        if pd.isna(value) or value is None:
            return None, True
        
        try:
            num_value = float(value)
            
            if not (valid_range[0] <= num_value <= valid_range[1]):
                self.validation_result.add_warning(ValidationError(
                    row_index=row_index,
                    column=column,
                    error_type='value_out_of_range',
                    message=f'{column}值超出合理范围({valid_range[0]}-{valid_range[1]})',
                    value=num_value
                ))
            
            return num_value, True
            
        except (ValueError, TypeError):
            self.validation_result.add_warning(ValidationError(
                row_index=row_index,
                column=column,
                error_type='invalid_type',
                message=f'{column}值不是有效的数字',
                value=value
            ))
            return None, False
    
    def validate_dataframe(self, df: pd.DataFrame) -> ValidationResult:
        self.validation_result = ValidationResult()
        self.validation_result.total_records = len(df)
        
        required_columns = ['timestamp']
        
        for col in required_columns:
            if col not in df.columns:
                self.validation_result.add_error(ValidationError(
                    row_index=-1,
                    column=col,
                    error_type='missing_column',
                    message=f'缺少必需列: {col}',
                    value=None
                ))
        
        return self.validation_result
    
    def parse_and_validate(self, df: pd.DataFrame) -> Tuple[Optional[WeatherData], ValidationResult]:
        result = self.validate_dataframe(df)
        
        records = []
        valid_count = 0
        
        for idx, row in df.iterrows():
            timestamp, ts_valid = self.validate_timestamp(row.get('timestamp'), idx)
            
            site_id = row.get('site_id', self.site_id)
            if site_id is None or pd.isna(site_id):
                site_id = self.site_id or 'DEFAULT'
            else:
                site_id = str(site_id).strip()
            
            temperature, _ = self.validate_numeric_range(
                row.get('temperature'), 'temperature', self.VALID_TEMP_RANGE, idx
            )
            humidity, _ = self.validate_numeric_range(
                row.get('humidity'), 'humidity', self.VALID_HUMIDITY_RANGE, idx
            )
            wind_speed, _ = self.validate_numeric_range(
                row.get('wind_speed'), 'wind_speed', self.VALID_WIND_SPEED_RANGE, idx
            )
            
            wind_direction = row.get('wind_direction')
            if pd.notna(wind_direction):
                try:
                    wind_direction = float(wind_direction)
                except:
                    wind_direction = None
            
            rainfall = row.get('rainfall')
            if pd.notna(rainfall):
                try:
                    rainfall = float(rainfall)
                except:
                    rainfall = None
            
            barometric_pressure = row.get('barometric_pressure')
            if pd.notna(barometric_pressure):
                try:
                    barometric_pressure = float(barometric_pressure)
                except:
                    barometric_pressure = None
            
            if ts_valid:
                valid_count += 1
            
            record = WeatherRecord(
                timestamp=timestamp if timestamp else datetime.min,
                site_id=site_id,
                temperature=temperature,
                humidity=humidity,
                wind_speed=wind_speed,
                wind_direction=wind_direction,
                rainfall=rainfall,
                barometric_pressure=barometric_pressure,
                is_valid=ts_valid
            )
            records.append(record)
        
        result.valid_records = valid_count
        result.invalid_records = len(df) - valid_count
        
        if self.site_id is None and records:
            site_ids = set(r.site_id for r in records if r.site_id)
            if len(site_ids) == 1:
                self.site_id = site_ids.pop()
        
        weather_data = WeatherData(
            site_id=self.site_id or 'DEFAULT',
            records=records
        )
        
        return weather_data, result


class ComplaintDataValidator:
    """投诉数据导入校验器"""
    
    VALID_STATUSES = ['pending', 'reviewing', 'confirmed', 'dismissed', 'uncertain']
    VALID_SEVERITIES = ['normal', 'high', 'critical']
    
    def __init__(self):
        self.validation_result = ValidationResult()
    
    def validate_timestamp(self, value: Any, row_index: int) -> Tuple[Optional[datetime], bool]:
        if pd.isna(value) or value is None:
            self.validation_result.add_error(ValidationError(
                row_index=row_index,
                column='timestamp',
                error_type='missing_timestamp',
                message='投诉时间为空',
                value=value
            ))
            return None, False
        
        try:
            if isinstance(value, datetime):
                return value, True
            elif isinstance(value, pd.Timestamp):
                return value.to_pydatetime(), True
            else:
                parsed = date_parser.parse(str(value))
                return parsed, True
        except Exception as e:
            self.validation_result.add_error(ValidationError(
                row_index=row_index,
                column='timestamp',
                error_type='invalid_timestamp',
                message=f'无法解析投诉时间: {str(e)}',
                value=value
            ))
            return None, False
    
    def validate_status(self, value: Any, row_index: int) -> str:
        if pd.isna(value) or value is None:
            return 'pending'
        
        status = str(value).strip().lower()
        
        if status not in self.VALID_STATUSES:
            self.validation_result.add_warning(ValidationError(
                row_index=row_index,
                column='review_status',
                error_type='invalid_status',
                message=f'无效的复核状态: {status}, 已设为pending',
                value=value
            ))
            return 'pending'
        
        return status
    
    def validate_severity(self, value: Any, row_index: int) -> str:
        if pd.isna(value) or value is None:
            return 'normal'
        
        severity = str(value).strip().lower()
        
        if severity not in self.VALID_SEVERITIES:
            self.validation_result.add_warning(ValidationError(
                row_index=row_index,
                column='severity',
                error_type='invalid_severity',
                message=f'无效的严重程度: {severity}, 已设为normal',
                value=value
            ))
            return 'normal'
        
        return severity
    
    def validate_dataframe(self, df: pd.DataFrame) -> ValidationResult:
        self.validation_result = ValidationResult()
        self.validation_result.total_records = len(df)
        
        required_columns = ['timestamp', 'site_id']
        
        for col in required_columns:
            if col not in df.columns:
                self.validation_result.add_error(ValidationError(
                    row_index=-1,
                    column=col,
                    error_type='missing_column',
                    message=f'缺少必需列: {col}',
                    value=None
                ))
        
        return self.validation_result
    
    def parse_and_validate(self, df: pd.DataFrame) -> Tuple[Optional[ComplaintData], ValidationResult]:
        result = self.validate_dataframe(df)
        
        records = []
        valid_count = 0
        
        for idx, row in df.iterrows():
            timestamp, ts_valid = self.validate_timestamp(row.get('timestamp'), idx)
            
            complaint_id = row.get('complaint_id', f'CMPL-{idx+1:04d}')
            if pd.isna(complaint_id):
                complaint_id = f'CMPL-{idx+1:04d}'
            
            site_id = row.get('site_id', '')
            if pd.isna(site_id):
                site_id = ''
                self.validation_result.add_warning(ValidationError(
                    row_index=idx,
                    column='site_id',
                    error_type='missing_site_id',
                    message='投诉未指定关联站点',
                    value=None
                ))
            else:
                site_id = str(site_id).strip()
            
            status = self.validate_status(row.get('review_status'), idx)
            severity = self.validate_severity(row.get('severity'), idx)
            
            if ts_valid:
                valid_count += 1
            
            record = ComplaintRecord(
                complaint_id=str(complaint_id),
                timestamp=timestamp if timestamp else datetime.min,
                site_id=site_id,
                complainant_name=row.get('complainant_name') if pd.notna(row.get('complainant_name')) else None,
                complainant_phone=row.get('complainant_phone') if pd.notna(row.get('complainant_phone')) else None,
                complainant_address=row.get('complainant_address') if pd.notna(row.get('complainant_address')) else None,
                complaint_type=str(row.get('complaint_type', 'noise')).strip().lower() if pd.notna(row.get('complaint_type')) else 'noise',
                complaint_content=str(row.get('complaint_content', '')) if pd.notna(row.get('complaint_content')) else '',
                expected_noise_source=str(row.get('expected_noise_source', '')) if pd.notna(row.get('expected_noise_source')) else None,
                review_status=status,
                review_notes=str(row.get('review_notes', '')) if pd.notna(row.get('review_notes')) else '',
                severity=severity
            )
            records.append(record)
        
        result.valid_records = valid_count
        result.invalid_records = len(df) - valid_count
        
        complaint_data = ComplaintData(records=records)
        
        return complaint_data, result


class ImportValidator:
    """统一导入校验器"""
    
    def __init__(self):
        pass
    
    def validate_noise_csv(self, file_path: str, site_id: Optional[str] = None,
                           expected_sampling_interval: Optional[int] = None) -> Tuple[Optional[NoiseData], ValidationResult]:
        """导入并验证噪声CSV文件"""
        try:
            df = pd.read_csv(file_path)
        except Exception as e:
            result = ValidationResult()
            result.add_error(ValidationError(
                row_index=-1,
                column='file',
                error_type='read_error',
                message=f'无法读取CSV文件: {str(e)}',
                value=file_path
            ))
            return None, result
        
        validator = NoiseDataValidator(
            site_id=site_id,
            expected_sampling_interval=expected_sampling_interval
        )
        return validator.parse_and_validate(df)
    
    def validate_noise_dataframe(self, df: pd.DataFrame, site_id: Optional[str] = None,
                                  expected_sampling_interval: Optional[int] = None) -> Tuple[Optional[NoiseData], ValidationResult]:
        """验证噪声DataFrame"""
        validator = NoiseDataValidator(
            site_id=site_id,
            expected_sampling_interval=expected_sampling_interval
        )
        return validator.parse_and_validate(df)
    
    def validate_weather_csv(self, file_path: str, site_id: Optional[str] = None) -> Tuple[Optional[WeatherData], ValidationResult]:
        """导入并验证天气CSV文件"""
        try:
            df = pd.read_csv(file_path)
        except Exception as e:
            result = ValidationResult()
            result.add_error(ValidationError(
                row_index=-1,
                column='file',
                error_type='read_error',
                message=f'无法读取CSV文件: {str(e)}',
                value=file_path
            ))
            return None, result
        
        validator = WeatherDataValidator(site_id=site_id)
        return validator.parse_and_validate(df)
    
    def validate_weather_dataframe(self, df: pd.DataFrame, site_id: Optional[str] = None) -> Tuple[Optional[WeatherData], ValidationResult]:
        """验证天气DataFrame"""
        validator = WeatherDataValidator(site_id=site_id)
        return validator.parse_and_validate(df)
    
    def validate_complaint_csv(self, file_path: str) -> Tuple[Optional[ComplaintData], ValidationResult]:
        """导入并验证投诉CSV文件"""
        try:
            df = pd.read_csv(file_path)
        except Exception as e:
            result = ValidationResult()
            result.add_error(ValidationError(
                row_index=-1,
                column='file',
                error_type='read_error',
                message=f'无法读取CSV文件: {str(e)}',
                value=file_path
            ))
            return None, result
        
        validator = ComplaintDataValidator()
        return validator.parse_and_validate(df)
    
    def validate_complaint_dataframe(self, df: pd.DataFrame) -> Tuple[Optional[ComplaintData], ValidationResult]:
        """验证投诉DataFrame"""
        validator = ComplaintDataValidator()
        return validator.parse_and_validate(df)
