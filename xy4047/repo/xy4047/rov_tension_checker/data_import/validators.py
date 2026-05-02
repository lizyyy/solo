"""数据校验模块"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class ValidationErrorType(Enum):
    MISSING_TIMESTAMP = "missing_timestamp"
    INVALID_TIMESTAMP = "invalid_timestamp"
    TIME_OUT_OF_ORDER = "time_out_of_order"
    DUPLICATE_TIMESTAMP = "duplicate_timestamp"
    MISSING_COORDINATES = "missing_coordinates"
    INVALID_LATITUDE = "invalid_latitude"
    INVALID_LONGITUDE = "invalid_longitude"
    DEPTH_SIGN_CONFUSION = "depth_sign_confusion"
    NEGATIVE_DEPTH = "negative_depth"
    NEGATIVE_CABLE_LENGTH = "negative_cable_length"
    INVALID_HEADING = "invalid_heading"
    INVALID_SPEED = "invalid_speed"
    INVALID_THRUST = "invalid_thrust"
    MISSING_REQUIRED_FIELD = "missing_required_field"
    INVALID_VALUE = "invalid_value"


@dataclass
class ValidationError:
    row_index: int
    error_type: ValidationErrorType
    field_name: Optional[str]
    value: Optional[Any]
    message: str


@dataclass
class ValidationResult:
    valid_rows: List[Dict[str, Any]] = field(default_factory=list)
    invalid_rows: List[Dict[str, Any]] = field(default_factory=list)
    errors: List[ValidationError] = field(default_factory=list)
    
    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0
    
    @property
    def valid_count(self) -> int:
        return len(self.valid_rows)
    
    @property
    def invalid_count(self) -> int:
        return len(self.invalid_rows)


class DataValidator:
    TIMESTAMP_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y/%m/%d %H:%M:%S",
        "%Y%m%d %H%M%S",
        "%d-%b-%Y %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
    ]
    
    @staticmethod
    def parse_timestamp(value: Any) -> Optional[datetime]:
        if value is None:
            return None
        
        if isinstance(value, datetime):
            return value
        
        value_str = str(value).strip()
        
        for fmt in DataValidator.TIMESTAMP_FORMATS:
            try:
                return datetime.strptime(value_str, fmt)
            except (ValueError, TypeError):
                continue
        
        try:
            import dateutil.parser
            return dateutil.parser.parse(value_str)
        except (ImportError, ValueError, TypeError):
            pass
        
        return None
    
    @staticmethod
    def validate_track_data(rows: List[Dict[str, Any]]) -> ValidationResult:
        result = ValidationResult()
        seen_timestamps: Dict[datetime, int] = {}
        prev_timestamp: Optional[datetime] = None
        
        for idx, row in enumerate(rows):
            row_errors: List[ValidationError] = []
            
            ts_value = row.get('timestamp')
            if ts_value is None or (isinstance(ts_value, str) and ts_value.strip() == ''):
                row_errors.append(ValidationError(
                    row_index=idx,
                    error_type=ValidationErrorType.MISSING_TIMESTAMP,
                    field_name='timestamp',
                    value=ts_value,
                    message="时间戳缺失"
                ))
                timestamp = None
            else:
                timestamp = DataValidator.parse_timestamp(ts_value)
                if timestamp is None:
                    row_errors.append(ValidationError(
                        row_index=idx,
                        error_type=ValidationErrorType.INVALID_TIMESTAMP,
                        field_name='timestamp',
                        value=ts_value,
                        message=f"无法解析时间戳: {ts_value}"
                    ))
            
            if timestamp is not None:
                if timestamp in seen_timestamps:
                    row_errors.append(ValidationError(
                        row_index=idx,
                        error_type=ValidationErrorType.DUPLICATE_TIMESTAMP,
                        field_name='timestamp',
                        value=timestamp,
                        message=f"重复时间戳，首次出现在行 {seen_timestamps[timestamp]}"
                    ))
                else:
                    seen_timestamps[timestamp] = idx
                
                if prev_timestamp is not None and timestamp < prev_timestamp:
                    row_errors.append(ValidationError(
                        row_index=idx,
                        error_type=ValidationErrorType.TIME_OUT_OF_ORDER,
                        field_name='timestamp',
                        value=timestamp,
                        message=f"时间倒序，前一行时间: {prev_timestamp}"
                    ))
                
                prev_timestamp = timestamp
            
            has_local_coords = 'x' in row and row.get('x') is not None and 'y' in row and row.get('y') is not None
            has_geo_coords = 'latitude' in row and row.get('latitude') is not None and 'longitude' in row and row.get('longitude') is not None
            
            if not has_local_coords and not has_geo_coords:
                row_errors.append(ValidationError(
                    row_index=idx,
                    error_type=ValidationErrorType.MISSING_COORDINATES,
                    field_name='coordinates',
                    value=None,
                    message="缺少坐标数据（需要经纬度或局部坐标）"
                ))
            
            if has_geo_coords:
                try:
                    lat = float(row['latitude'])
                    if lat < -90 or lat > 90:
                        row_errors.append(ValidationError(
                            row_index=idx,
                            error_type=ValidationErrorType.INVALID_LATITUDE,
                            field_name='latitude',
                            value=lat,
                            message=f"纬度超出范围 [-90, 90]: {lat}"
                        ))
                except (ValueError, TypeError):
                    row_errors.append(ValidationError(
                        row_index=idx,
                        error_type=ValidationErrorType.INVALID_LATITUDE,
                        field_name='latitude',
                        value=row.get('latitude'),
                        message=f"纬度值无效: {row.get('latitude')}"
                    ))
                
                try:
                    lon = float(row['longitude'])
                    if lon < -180 or lon > 180:
                        row_errors.append(ValidationError(
                            row_index=idx,
                            error_type=ValidationErrorType.INVALID_LONGITUDE,
                            field_name='longitude',
                            value=lon,
                            message=f"经度超出范围 [-180, 180]: {lon}"
                        ))
                except (ValueError, TypeError):
                    row_errors.append(ValidationError(
                        row_index=idx,
                        error_type=ValidationErrorType.INVALID_LONGITUDE,
                        field_name='longitude',
                        value=row.get('longitude'),
                        message=f"经度值无效: {row.get('longitude')}"
                    ))
            
            heading = row.get('heading')
            if heading is not None:
                try:
                    h = float(heading)
                    if h < 0 or h > 360:
                        row_errors.append(ValidationError(
                            row_index=idx,
                            error_type=ValidationErrorType.INVALID_HEADING,
                            field_name='heading',
                            value=h,
                            message=f"艏向超出范围 [0, 360]: {h}"
                        ))
                except (ValueError, TypeError):
                    row_errors.append(ValidationError(
                        row_index=idx,
                        error_type=ValidationErrorType.INVALID_HEADING,
                        field_name='heading',
                        value=heading,
                        message=f"艏向值无效: {heading}"
                    ))
            
            if row_errors:
                result.invalid_rows.append(row)
                result.errors.extend(row_errors)
            else:
                if timestamp is not None:
                    row['_parsed_timestamp'] = timestamp
                result.valid_rows.append(row)
        
        return result
    
    @staticmethod
    def validate_rov_telemetry(rows: List[Dict[str, Any]]) -> ValidationResult:
        result = ValidationResult()
        seen_timestamps: Dict[datetime, int] = {}
        prev_timestamp: Optional[datetime] = None
        
        for idx, row in enumerate(rows):
            row_errors: List[ValidationError] = []
            
            ts_value = row.get('timestamp')
            if ts_value is None or (isinstance(ts_value, str) and ts_value.strip() == ''):
                row_errors.append(ValidationError(
                    row_index=idx,
                    error_type=ValidationErrorType.MISSING_TIMESTAMP,
                    field_name='timestamp',
                    value=ts_value,
                    message="时间戳缺失"
                ))
                timestamp = None
            else:
                timestamp = DataValidator.parse_timestamp(ts_value)
                if timestamp is None:
                    row_errors.append(ValidationError(
                        row_index=idx,
                        error_type=ValidationErrorType.INVALID_TIMESTAMP,
                        field_name='timestamp',
                        value=ts_value,
                        message=f"无法解析时间戳: {ts_value}"
                    ))
            
            if timestamp is not None:
                if timestamp in seen_timestamps:
                    row_errors.append(ValidationError(
                        row_index=idx,
                        error_type=ValidationErrorType.DUPLICATE_TIMESTAMP,
                        field_name='timestamp',
                        value=timestamp,
                        message=f"重复时间戳，首次出现在行 {seen_timestamps[timestamp]}"
                    ))
                else:
                    seen_timestamps[timestamp] = idx
                
                if prev_timestamp is not None and timestamp < prev_timestamp:
                    row_errors.append(ValidationError(
                        row_index=idx,
                        error_type=ValidationErrorType.TIME_OUT_OF_ORDER,
                        field_name='timestamp',
                        value=timestamp,
                        message=f"时间倒序，前一行时间: {prev_timestamp}"
                    ))
                
                prev_timestamp = timestamp
            
            depth = row.get('depth')
            if depth is not None:
                try:
                    d = float(depth)
                    if d < 0:
                        row_errors.append(ValidationError(
                            row_index=idx,
                            error_type=ValidationErrorType.DEPTH_SIGN_CONFUSION,
                            field_name='depth',
                            value=d,
                            message=f"深度为负值，可能符号混乱: {d}"
                        ))
                except (ValueError, TypeError):
                    pass
            
            cable_length = row.get('cable_length')
            if cable_length is not None:
                try:
                    cl = float(cable_length)
                    if cl < 0:
                        row_errors.append(ValidationError(
                            row_index=idx,
                            error_type=ValidationErrorType.NEGATIVE_CABLE_LENGTH,
                            field_name='cable_length',
                            value=cl,
                            message=f"放缆长度为负值: {cl}"
                        ))
                except (ValueError, TypeError):
                    pass
            
            if row_errors:
                result.invalid_rows.append(row)
                result.errors.extend(row_errors)
            else:
                if timestamp is not None:
                    row['_parsed_timestamp'] = timestamp
                result.valid_rows.append(row)
        
        return result
    
    @staticmethod
    def validate_current_profile(rows: List[Dict[str, Any]]) -> ValidationResult:
        result = ValidationResult()
        
        for idx, row in enumerate(rows):
            row_errors: List[ValidationError] = []
            
            depth_from = row.get('depth_from', 0)
            depth_to = row.get('depth_to')
            
            try:
                df = float(depth_from)
                dt = float(depth_to) if depth_to else None
                
                if df < 0:
                    row_errors.append(ValidationError(
                        row_index=idx,
                        error_type=ValidationErrorType.NEGATIVE_DEPTH,
                        field_name='depth_from',
                        value=df,
                        message=f"起始深度为负值: {df}"
                    ))
                
                if dt is not None:
                    if dt < 0:
                        row_errors.append(ValidationError(
                            row_index=idx,
                            error_type=ValidationErrorType.NEGATIVE_DEPTH,
                            field_name='depth_to',
                            value=dt,
                            message=f"结束深度为负值: {dt}"
                        ))
                    elif dt < df:
                        row_errors.append(ValidationError(
                            row_index=idx,
                            error_type=ValidationErrorType.INVALID_VALUE,
                            field_name='depth',
                            value=(df, dt),
                            message=f"结束深度小于起始深度: {dt} < {df}"
                        ))
            except (ValueError, TypeError):
                pass
            
            speed = row.get('speed')
            if speed is not None:
                try:
                    s = float(speed)
                    if s < 0:
                        row_errors.append(ValidationError(
                            row_index=idx,
                            error_type=ValidationErrorType.INVALID_SPEED,
                            field_name='speed',
                            value=s,
                            message=f"海流速度为负值: {s}"
                        ))
                except (ValueError, TypeError):
                    pass
            
            direction = row.get('direction')
            if direction is not None:
                try:
                    d = float(direction)
                    if d < 0 or d > 360:
                        row_errors.append(ValidationError(
                            row_index=idx,
                            error_type=ValidationErrorType.INVALID_HEADING,
                            field_name='direction',
                            value=d,
                            message=f"海流方向超出范围 [0, 360]: {d}"
                        ))
                except (ValueError, TypeError):
                    pass
            
            if row_errors:
                result.invalid_rows.append(row)
                result.errors.extend(row_errors)
            else:
                result.valid_rows.append(row)
        
        return result
