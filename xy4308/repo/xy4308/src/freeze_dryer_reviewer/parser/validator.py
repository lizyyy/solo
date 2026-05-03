"""数据验证器"""
from datetime import datetime
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum

from ..models import (
    BatchData, SensorData, TemperatureData, VacuumData, MoistureData
)


class ValidationSeverity(Enum):
    """验证严重程度"""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class ValidationError:
    """验证错误"""
    code: str
    message: str
    severity: ValidationSeverity = ValidationSeverity.ERROR
    location: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "severity": self.severity.value,
            "location": self.location,
            "details": self.details,
        }


@dataclass
class ValidationResult:
    """验证结果"""
    is_valid: bool = True
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)
    infos: List[ValidationError] = field(default_factory=list)
    
    def add_error(self, error: ValidationError):
        """添加错误"""
        self.errors.append(error)
        if error.severity == ValidationSeverity.ERROR:
            self.is_valid = False
    
    def add_warning(self, warning: ValidationError):
        """添加警告"""
        self.warnings.append(warning)
    
    def add_info(self, info: ValidationError):
        """添加信息"""
        self.infos.append(info)
    
    def add(self, error: ValidationError):
        """根据严重程度添加"""
        if error.severity == ValidationSeverity.ERROR:
            self.add_error(error)
        elif error.severity == ValidationSeverity.WARNING:
            self.add_warning(error)
        else:
            self.add_info(error)
    
    def get_all_issues(self) -> List[ValidationError]:
        """获取所有问题"""
        return self.errors + self.warnings + self.infos
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "errors": [e.to_dict() for e in self.errors],
            "warnings": [w.to_dict() for w in self.warnings],
            "infos": [i.to_dict() for i in self.infos],
            "total_issues": len(self.errors) + len(self.warnings) + len(self.infos),
        }


class DataValidator:
    """数据验证器"""
    
    def __init__(self):
        self.rules: Dict[str, Callable] = {}
        self._register_default_rules()
    
    def _register_default_rules(self):
        """注册默认验证规则"""
        self.rules = {
            "non_empty": self._validate_non_empty,
            "time_sorted": self._validate_time_sorted,
            "valid_range": self._validate_valid_range,
            "no_duplicate_times": self._validate_no_duplicate_times,
            "sufficient_data_points": self._validate_sufficient_data_points,
        }
    
    def validate_batch(self, batch: BatchData) -> ValidationResult:
        """验证批次数据"""
        result = ValidationResult()
        
        if not batch.has_valid_data():
            result.add_error(ValidationError(
                code="NO_VALID_DATA",
                message="批次数据中没有有效的传感器数据",
                severity=ValidationSeverity.ERROR,
                location="batch",
            ))
            return result
        
        if batch.shelf_temp:
            sensor_result = self.validate_sensor_data(batch.shelf_temp, "shelf_temp")
            for issue in sensor_result.get_all_issues():
                result.add(issue)
        
        if batch.product_temp:
            sensor_result = self.validate_sensor_data(batch.product_temp, "product_temp")
            for issue in sensor_result.get_all_issues():
                result.add(issue)
        
        if batch.vacuum:
            sensor_result = self.validate_sensor_data(batch.vacuum, "vacuum")
            for issue in sensor_result.get_all_issues():
                result.add(issue)
        
        if batch.recipe:
            if batch.recipe.collapse_temp_c is None:
                result.add_warning(ValidationError(
                    code="MISSING_COLLAPSE_TEMP",
                    message="配方中缺少塌陷温度设置，温度越界检查可能不准确",
                    severity=ValidationSeverity.WARNING,
                    location="recipe",
                ))
        
        result = self._validate_time_sync(batch, result)
        
        for error_str in batch.validation_errors:
            result.add_warning(ValidationError(
                code="IMPORT_WARNING",
                message=error_str,
                severity=ValidationSeverity.WARNING,
                location="import",
            ))
        
        return result
    
    def validate_sensor_data(self, sensor: SensorData, sensor_name: str) -> ValidationResult:
        """验证传感器数据"""
        result = ValidationResult()
        
        consistency_errors = sensor.validate_consistency()
        for error in consistency_errors:
            result.add_error(ValidationError(
                code="DATA_CONSISTENCY_ERROR",
                message=error,
                severity=ValidationSeverity.ERROR,
                location=sensor_name,
            ))
        
        if len(sensor) < 10:
            result.add_warning(ValidationError(
                code="INSUFFICIENT_DATA",
                message=f"传感器数据点较少({len(sensor)}个)，分析结果可能不准确",
                severity=ValidationSeverity.WARNING,
                location=sensor_name,
                details={"data_points": len(sensor)},
            ))
        
        if not self._validate_time_sorted(sensor):
            result.add_error(ValidationError(
                code="TIME_NOT_SORTED",
                message="时间戳未按升序排列",
                severity=ValidationSeverity.ERROR,
                location=sensor_name,
            ))
        
        duplicate_count = self._count_duplicate_times(sensor)
        if duplicate_count > 0:
            result.add_warning(ValidationError(
                code="DUPLICATE_TIMESTAMPS",
                message=f"发现{duplicate_count}个重复的时间戳",
                severity=ValidationSeverity.WARNING,
                location=sensor_name,
                details={"duplicate_count": duplicate_count},
            ))
        
        if isinstance(sensor, TemperatureData):
            temp_result = self._validate_temperature_range(sensor)
            for issue in temp_result.get_all_issues():
                issue.location = sensor_name
                result.add(issue)
        
        if isinstance(sensor, VacuumData):
            vac_result = self._validate_vacuum_range(sensor)
            for issue in vac_result.get_all_issues():
                issue.location = sensor_name
                result.add(issue)
        
        return result
    
    def _validate_non_empty(self, sensor: SensorData) -> bool:
        """验证非空"""
        return len(sensor) > 0
    
    def _validate_time_sorted(self, sensor: SensorData) -> bool:
        """验证时间排序"""
        if len(sensor) < 2:
            return True
        
        for i in range(1, len(sensor.timestamps)):
            if sensor.timestamps[i] < sensor.timestamps[i-1]:
                return False
        return True
    
    def _validate_valid_range(self, sensor: SensorData, min_val: float, max_val: float) -> bool:
        """验证数值范围"""
        if not sensor.values:
            return True
        
        val_range = sensor.get_value_range()
        if val_range is None:
            return True
        
        return val_range[0] >= min_val and val_range[1] <= max_val
    
    def _validate_no_duplicate_times(self, sensor: SensorData) -> bool:
        """验证无重复时间戳"""
        if len(sensor) < 2:
            return True
        
        return len(sensor.timestamps) == len(set(sensor.timestamps))
    
    def _count_duplicate_times(self, sensor: SensorData) -> int:
        """计算重复时间戳数量"""
        if len(sensor) < 2:
            return 0
        
        from collections import Counter
        counts = Counter(sensor.timestamps)
        return sum(1 for c in counts.values() if c > 1)
    
    def _validate_sufficient_data_points(self, sensor: SensorData, min_points: int = 10) -> bool:
        """验证足够的数据点"""
        return len(sensor) >= min_points
    
    def _validate_temperature_range(self, temp_data: TemperatureData) -> ValidationResult:
        """验证温度范围"""
        result = ValidationResult()
        
        if not temp_data.values:
            return result
        
        val_range = temp_data.get_value_range()
        if val_range:
            min_temp, max_temp = val_range
            
            if min_temp < -80:
                result.add_warning(ValidationError(
                    code="TEMP_TOO_LOW",
                    message=f"温度过低({min_temp}°C)，超出正常冻干工艺范围",
                    severity=ValidationSeverity.WARNING,
                ))
            
            if max_temp > 50:
                result.add_warning(ValidationError(
                    code="TEMP_TOO_HIGH",
                    message=f"温度过高({max_temp}°C)，超出正常冻干工艺范围",
                    severity=ValidationSeverity.WARNING,
                ))
        
        return result
    
    def _validate_vacuum_range(self, vac_data: VacuumData) -> ValidationResult:
        """验证真空范围"""
        result = ValidationResult()
        
        if not vac_data.values:
            return result
        
        val_range = vac_data.get_value_range()
        if val_range:
            min_vac, max_vac = val_range
            
            if max_vac > 1000:
                result.add_warning(ValidationError(
                    code="VACUUM_TOO_HIGH",
                    message=f"真空度过高({max_vac} mTorr)，可能影响干燥效果",
                    severity=ValidationSeverity.WARNING,
                ))
            
            if min_vac < 0:
                result.add_error(ValidationError(
                    code="NEGATIVE_VACUUM",
                    message="检测到负值真空度，数据可能有误",
                    severity=ValidationSeverity.ERROR,
                ))
        
        return result
    
    def _validate_time_sync(self, batch: BatchData, result: ValidationResult) -> ValidationResult:
        """验证时间同步"""
        time_ranges = []
        
        if batch.shelf_temp and batch.shelf_temp.get_time_range():
            time_ranges.append(("shelf_temp", batch.shelf_temp.get_time_range()))
        
        if batch.product_temp and batch.product_temp.get_time_range():
            time_ranges.append(("product_temp", batch.product_temp.get_time_range()))
        
        if batch.vacuum and batch.vacuum.get_time_range():
            time_ranges.append(("vacuum", batch.vacuum.get_time_range()))
        
        if len(time_ranges) >= 2:
            all_starts = [tr[1][0] for tr in time_ranges]
            all_ends = [tr[1][1] for tr in time_ranges]
            
            latest_start = max(all_starts)
            earliest_end = min(all_ends)
            
            if latest_start > earliest_end:
                result.add_warning(ValidationError(
                    code="TIME_RANGE_MISMATCH",
                    message="各传感器数据的时间范围没有重叠，部分对比分析可能不准确",
                    severity=ValidationSeverity.WARNING,
                    location="time_sync",
                    details={
                        "sensors": [tr[0] for tr in time_ranges],
                        "time_ranges": {
                            tr[0]: {
                                "start": tr[1][0].isoformat(),
                                "end": tr[1][1].isoformat()
                            }
                            for tr in time_ranges
                        }
                    },
                ))
        
        return result
