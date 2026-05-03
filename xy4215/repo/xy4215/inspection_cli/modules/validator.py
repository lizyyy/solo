"""
校验模块
负责检查巡检包的数据完整性和连续性：
- 时间戳连续性检查（检测断电导致的时间戳跳变）
- 里程桩号连续性检查（检测里程桩号倒退）
- 坏包识别和分类
"""

from typing import Dict, List, Any, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import math

from .parser import InspectionPackage


class ValidationErrorType(Enum):
    """校验错误类型枚举"""
    TIMESTAMP_JUMP = "timestamp_jump"  # 时间戳跳变
    TIMESTAMP_REVERSE = "timestamp_reverse"  # 时间戳倒退
    MILEAGE_REVERSE = "mileage_reverse"  # 里程桩号倒退
    MILEAGE_JUMP = "mileage_jump"  # 里程桩号跳变
    MISSING_CRITICAL_DATA = "missing_critical_data"  # 缺少关键数据
    INCONSISTENT_DATA = "inconsistent_data"  # 数据不一致
    CORRUPTED_DATA = "corrupted_data"  # 数据损坏


class ValidationSeverity(Enum):
    """校验错误严重程度"""
    CRITICAL = "critical"  # 严重错误，包无法使用
    WARNING = "warning"  # 警告，包可使用但需要注意
    INFO = "info"  # 信息，仅供参考


@dataclass
class ValidationIssue:
    """校验问题详情"""
    error_type: ValidationErrorType
    severity: ValidationSeverity
    message: str
    location: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: Optional[float] = None
    mileage: Optional[float] = None
    index: Optional[int] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "error_type": self.error_type.value,
            "severity": self.severity.value,
            "message": self.message,
            "location": self.location,
            "details": self.details,
            "timestamp": self.timestamp,
            "mileage": self.mileage,
            "index": self.index
        }


@dataclass
class ValidationResult:
    """校验结果"""
    package_name: str
    is_valid: bool = True
    is_critical: bool = False
    issues: List[ValidationIssue] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    
    def add_issue(self, issue: ValidationIssue):
        self.issues.append(issue)
        if issue.severity == ValidationSeverity.CRITICAL:
            self.is_valid = False
            self.is_critical = True
    
    def get_issues_by_type(self, error_type: ValidationErrorType) -> List[ValidationIssue]:
        return [i for i in self.issues if i.error_type == error_type]
    
    def get_issues_by_severity(self, severity: ValidationSeverity) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == severity]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "package_name": self.package_name,
            "is_valid": self.is_valid,
            "is_critical": self.is_critical,
            "issues_count": len(self.issues),
            "critical_count": len(self.get_issues_by_severity(ValidationSeverity.CRITICAL)),
            "warning_count": len(self.get_issues_by_severity(ValidationSeverity.WARNING)),
            "info_count": len(self.get_issues_by_severity(ValidationSeverity.INFO)),
            "issues": [i.to_dict() for i in self.issues],
            "summary": self.summary
        }


class DataValidator:
    """
    数据校验器
    负责检查巡检包的数据完整性和连续性
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # 默认配置
        self.max_timestamp_gap = self.config.get("max_timestamp_gap", 300.0)  # 最大时间间隔（秒），超过则认为跳变
        self.max_mileage_gap = self.config.get("max_mileage_gap", 100.0)  # 最大里程间隔（米），超过则认为跳变
        self.allowable_mileage_backtrack = self.config.get("allowable_mileage_backtrack", 0.5)  # 允许的里程倒退（米）
        self.required_fields = self.config.get("required_fields", {
            "video_index": ["timestamp", "mileage"],
            "sensor_data": ["timestamp", "mileage"],
            "defect_annotations": ["mileage"]
        })
    
    def validate_package(self, package: InspectionPackage) -> ValidationResult:
        """
        校验整个巡检包
        """
        result = ValidationResult(package_name=package.package_name)
        
        # 首先检查解析阶段的错误
        if package.errors:
            for error in package.errors:
                result.add_issue(ValidationIssue(
                    error_type=ValidationErrorType.CORRUPTED_DATA,
                    severity=ValidationSeverity.CRITICAL,
                    message=f"解析错误: {error}",
                    location="file_parsing"
                ))
        
        # 检查关键数据是否存在
        self._check_missing_data(package, result)
        
        # 校验视频索引数据
        if package.video_index:
            self._validate_video_index(package.video_index, result)
        
        # 校验传感器数据
        if package.sensor_data:
            self._validate_sensor_data(package.sensor_data, result)
        
        # 校验缺陷标注数据
        if package.defect_annotations:
            self._validate_defect_annotations(package.defect_annotations, result)
        
        # 生成校验摘要
        result.summary = self._generate_summary(package, result)
        
        return result
    
    def _check_missing_data(self, package: InspectionPackage, result: ValidationResult):
        """
        检查是否缺少关键数据
        """
        # 检查是否完全没有数据
        has_video = len(package.video_index) > 0
        has_sensor = len(package.sensor_data) > 0
        has_defect = len(package.defect_annotations) > 0
        
        if not (has_video or has_sensor or has_defect):
            result.add_issue(ValidationIssue(
                error_type=ValidationErrorType.MISSING_CRITICAL_DATA,
                severity=ValidationSeverity.CRITICAL,
                message="巡检包中未找到任何有效数据（视频索引、传感器数据、缺陷标注均为空）",
                location="package"
            ))
            return
        
        # 检查各数据类型的关键字段
        # 视频索引检查
        if has_video:
            sample_video = package.video_index[0]
            missing_fields = []
            for field in self.required_fields["video_index"]:
                if field not in sample_video:
                    missing_fields.append(field)
            
            if missing_fields:
                result.add_issue(ValidationIssue(
                    error_type=ValidationErrorType.MISSING_CRITICAL_DATA,
                    severity=ValidationSeverity.WARNING,
                    message=f"视频索引数据缺少关键字段: {', '.join(missing_fields)}",
                    location="video_index"
                ))
        
        # 传感器数据检查
        if has_sensor:
            sample_sensor = package.sensor_data[0]
            missing_fields = []
            for field in self.required_fields["sensor_data"]:
                if field not in sample_sensor:
                    missing_fields.append(field)
            
            if missing_fields:
                result.add_issue(ValidationIssue(
                    error_type=ValidationErrorType.MISSING_CRITICAL_DATA,
                    severity=ValidationSeverity.WARNING,
                    message=f"传感器数据缺少关键字段: {', '.join(missing_fields)}",
                    location="sensor_data"
                ))
        
        # 缺陷标注检查
        if has_defect:
            # 检查是否有里程信息
            has_mileage = any("mileage" in d for d in package.defect_annotations)
            if not has_mileage:
                result.add_issue(ValidationIssue(
                    error_type=ValidationErrorType.MISSING_CRITICAL_DATA,
                    severity=ValidationSeverity.WARNING,
                    message="缺陷标注数据缺少里程桩号信息",
                    location="defect_annotations"
                ))
    
    def _validate_video_index(self, video_index: List[Dict[str, Any]], result: ValidationResult):
        """
        校验视频索引数据的连续性
        """
        if len(video_index) < 2:
            return
        
        # 按时间戳排序（如果有时间戳）
        sorted_by_time = sorted(
            [i for i in video_index if isinstance(i.get("timestamp"), (int, float))],
            key=lambda x: x["timestamp"]
        )
        
        # 按里程排序（如果有里程）
        sorted_by_mileage = sorted(
            [i for i in video_index if isinstance(i.get("mileage"), (int, float))],
            key=lambda x: x["mileage"]
        )
        
        # 检查时间戳连续性
        if len(sorted_by_time) >= 2:
            for idx, (prev, curr) in enumerate(zip(sorted_by_time[:-1], sorted_by_time[1:]), start=1):
                prev_time = prev["timestamp"]
                curr_time = curr["timestamp"]
                
                # 检查时间戳倒退
                if curr_time < prev_time:
                    time_diff = prev_time - curr_time
                    result.add_issue(ValidationIssue(
                        error_type=ValidationErrorType.TIMESTAMP_REVERSE,
                        severity=ValidationSeverity.WARNING,
                        message=f"时间戳倒退: 第{idx}条记录时间戳从 {self._format_time(prev_time)} 倒退到 {self._format_time(curr_time)}",
                        location="video_index",
                        details={"previous_time": prev_time, "current_time": curr_time, "time_difference": time_diff},
                        timestamp=curr_time,
                        index=idx
                    ))
                
                # 检查时间戳跳变（间隔过大）
                time_gap = curr_time - prev_time
                if time_gap > self.max_timestamp_gap:
                    result.add_issue(ValidationIssue(
                        error_type=ValidationErrorType.TIMESTAMP_JUMP,
                        severity=ValidationSeverity.WARNING,
                        message=f"时间戳跳变: 第{idx}条记录与前一条间隔 {time_gap:.1f} 秒（超过阈值 {self.max_timestamp_gap} 秒）",
                        location="video_index",
                        details={"time_gap": time_gap, "threshold": self.max_timestamp_gap},
                        timestamp=curr_time,
                        index=idx
                    ))
        
        # 检查里程桩号连续性
        if len(sorted_by_mileage) >= 2:
            for idx, (prev, curr) in enumerate(zip(sorted_by_mileage[:-1], sorted_by_mileage[1:]), start=1):
                prev_mile = prev["mileage"]
                curr_mile = curr["mileage"]
                
                # 检查里程倒退
                if curr_mile < prev_mile - self.allowable_mileage_backtrack:
                    mile_diff = prev_mile - curr_mile
                    result.add_issue(ValidationIssue(
                        error_type=ValidationErrorType.MILEAGE_REVERSE,
                        severity=ValidationSeverity.CRITICAL,
                        message=f"里程桩号倒退: 从 {prev_mile:.2f}m 倒退到 {curr_mile:.2f}m，倒退距离 {mile_diff:.2f}m",
                        location="video_index",
                        details={"previous_mileage": prev_mile, "current_mileage": curr_mile, "backtrack_distance": mile_diff},
                        mileage=curr_mile,
                        index=idx
                    ))
                
                # 检查里程跳变
                mile_gap = curr_mile - prev_mile
                if mile_gap > self.max_mileage_gap:
                    result.add_issue(ValidationIssue(
                        error_type=ValidationErrorType.MILEAGE_JUMP,
                        severity=ValidationSeverity.WARNING,
                        message=f"里程桩号跳变: 第{idx}条记录与前一条间隔 {mile_gap:.2f}m（超过阈值 {self.max_mileage_gap}m）",
                        location="video_index",
                        details={"mileage_gap": mile_gap, "threshold": self.max_mileage_gap},
                        mileage=curr_mile,
                        index=idx
                    ))
    
    def _validate_sensor_data(self, sensor_data: List[Dict[str, Any]], result: ValidationResult):
        """
        校验传感器数据的连续性
        """
        if len(sensor_data) < 2:
            return
        
        # 按时间戳排序
        sorted_by_time = sorted(
            [i for i in sensor_data if isinstance(i.get("timestamp"), (int, float))],
            key=lambda x: x["timestamp"]
        )
        
        # 按里程排序
        sorted_by_mileage = sorted(
            [i for i in sensor_data if isinstance(i.get("mileage"), (int, float))],
            key=lambda x: x["mileage"]
        )
        
        # 检查时间戳连续性
        if len(sorted_by_time) >= 2:
            for idx, (prev, curr) in enumerate(zip(sorted_by_time[:-1], sorted_by_time[1:]), start=1):
                prev_time = prev["timestamp"]
                curr_time = curr["timestamp"]
                
                # 检查时间戳倒退
                if curr_time < prev_time:
                    time_diff = prev_time - curr_time
                    result.add_issue(ValidationIssue(
                        error_type=ValidationErrorType.TIMESTAMP_REVERSE,
                        severity=ValidationSeverity.WARNING,
                        message=f"传感器数据时间戳倒退: 第{idx}条记录时间戳从 {self._format_time(prev_time)} 倒退到 {self._format_time(curr_time)}",
                        location="sensor_data",
                        details={"previous_time": prev_time, "current_time": curr_time, "time_difference": time_diff},
                        timestamp=curr_time,
                        index=idx
                    ))
                
                # 检查时间戳跳变
                time_gap = curr_time - prev_time
                if time_gap > self.max_timestamp_gap * 2:  # 传感器数据允许稍大间隔
                    result.add_issue(ValidationIssue(
                        error_type=ValidationErrorType.TIMESTAMP_JUMP,
                        severity=ValidationSeverity.INFO,
                        message=f"传感器数据时间戳跳变: 第{idx}条记录与前一条间隔 {time_gap:.1f} 秒",
                        location="sensor_data",
                        details={"time_gap": time_gap},
                        timestamp=curr_time,
                        index=idx
                    ))
        
        # 检查里程桩号连续性
        if len(sorted_by_mileage) >= 2:
            for idx, (prev, curr) in enumerate(zip(sorted_by_mileage[:-1], sorted_by_mileage[1:]), start=1):
                prev_mile = prev["mileage"]
                curr_mile = curr["mileage"]
                
                # 检查里程倒退
                if curr_mile < prev_mile - self.allowable_mileage_backtrack:
                    mile_diff = prev_mile - curr_mile
                    result.add_issue(ValidationIssue(
                        error_type=ValidationErrorType.MILEAGE_REVERSE,
                        severity=ValidationSeverity.CRITICAL,
                        message=f"传感器数据里程桩号倒退: 从 {prev_mile:.2f}m 倒退到 {curr_mile:.2f}m，倒退距离 {mile_diff:.2f}m",
                        location="sensor_data",
                        details={"previous_mileage": prev_mile, "current_mileage": curr_mile, "backtrack_distance": mile_diff},
                        mileage=curr_mile,
                        index=idx
                    ))
    
    def _validate_defect_annotations(self, defects: List[Dict[str, Any]], result: ValidationResult):
        """
        校验缺陷标注数据
        """
        # 检查是否有重复的缺陷ID
        defect_ids = {}
        for idx, defect in enumerate(defects):
            defect_id = defect.get("defect_id")
            if defect_id:
                if defect_id in defect_ids:
                    first_idx = defect_ids[defect_id]
                    result.add_issue(ValidationIssue(
                        error_type=ValidationErrorType.INCONSISTENT_DATA,
                        severity=ValidationSeverity.WARNING,
                        message=f"发现重复的缺陷ID: '{defect_id}'，出现在第{first_idx+1}条和第{idx+1}条记录",
                        location="defect_annotations",
                        details={"defect_id": defect_id, "first_index": first_idx, "second_index": idx},
                        index=idx
                    ))
                else:
                    defect_ids[defect_id] = idx
        
        # 检查里程桩号是否在合理范围
        for idx, defect in enumerate(defects):
            mileage = defect.get("mileage")
            if mileage is not None and isinstance(mileage, (int, float)):
                # 检查负数里程
                if mileage < 0:
                    result.add_issue(ValidationIssue(
                        error_type=ValidationErrorType.INCONSISTENT_DATA,
                        severity=ValidationSeverity.WARNING,
                        message=f"缺陷标注包含负里程桩号: {mileage}m",
                        location="defect_annotations",
                        details={"defect_id": defect.get("defect_id"), "mileage": mileage},
                        mileage=mileage,
                        index=idx
                    ))
                
                # 检查过大的里程（超过100km）
                if mileage > 100000:
                    result.add_issue(ValidationIssue(
                        error_type=ValidationErrorType.INCONSISTENT_DATA,
                        severity=ValidationSeverity.WARNING,
                        message=f"缺陷标注里程桩号异常大: {mileage}m",
                        location="defect_annotations",
                        details={"defect_id": defect.get("defect_id"), "mileage": mileage},
                        mileage=mileage,
                        index=idx
                    ))
    
    def _format_time(self, timestamp: float) -> str:
        """格式化时间戳为可读字符串"""
        try:
            dt = datetime.fromtimestamp(timestamp)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except (ValueError, OSError):
            return f"{timestamp:.2f}"
    
    def _generate_summary(self, package: InspectionPackage, result: ValidationResult) -> Dict[str, Any]:
        """生成校验摘要"""
        summary = {
            "package_name": package.package_name,
            "data_counts": {
                "video_segments": len(package.video_index),
                "sensor_records": len(package.sensor_data),
                "defect_annotations": len(package.defect_annotations)
            },
            "validation_status": {
                "is_valid": result.is_valid,
                "is_critical": result.is_critical,
                "total_issues": len(result.issues)
            },
            "issues_by_type": {},
            "issues_by_severity": {
                "critical": len(result.get_issues_by_severity(ValidationSeverity.CRITICAL)),
                "warning": len(result.get_issues_by_severity(ValidationSeverity.WARNING)),
                "info": len(result.get_issues_by_severity(ValidationSeverity.INFO))
            }
        }
        
        # 按类型统计问题
        for error_type in ValidationErrorType:
            type_issues = result.get_issues_by_type(error_type)
            if type_issues:
                summary["issues_by_type"][error_type.value] = len(type_issues)
        
        return summary
    
    def validate_multiple_packages(self, packages: List[InspectionPackage]) -> Dict[str, ValidationResult]:
        """
        校验多个巡检包
        返回包名到校验结果的映射
        """
        results = {}
        for package in packages:
            results[package.package_name] = self.validate_package(package)
        return results
