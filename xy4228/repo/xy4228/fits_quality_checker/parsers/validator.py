"""元数据校验器。"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

from fits_quality_checker.models.models import FITSMetadata, FileType, ObservationConfig


class ValidationSeverity(str, Enum):
    """校验严重程度。"""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class ValidationIssue:
    """校验问题。"""
    file_name: str
    field: Optional[str]
    message: str
    severity: ValidationSeverity
    details: Dict[str, Any]


class MetadataValidator:
    """元数据校验器。

    校验FITS元数据的完整性和一致性。
    """

    def __init__(self, config: Optional[ObservationConfig] = None):
        """初始化校验器。

        Args:
            config: 可选的观测配置，用于更严格的校验
        """
        self.config = config

    def validate_single(self, metadata: FITSMetadata) -> List[ValidationIssue]:
        """校验单个元数据对象。

        Args:
            metadata: FITSMetadata对象

        Returns:
            校验问题列表
        """
        issues = []

        # 基础完整性校验
        issues.extend(self._validate_integrity(metadata))

        # 类型特定校验
        issues.extend(self._validate_by_type(metadata))

        # 如果有配置，进行一致性校验
        if self.config:
            issues.extend(self._validate_consistency(metadata))

        return issues

    def validate_batch(
        self,
        metadatas: List[FITSMetadata],
    ) -> Tuple[List[ValidationIssue], Dict[str, Any]]:
        """批量校验元数据列表。

        Args:
            metadatas: FITSMetadata对象列表

        Returns:
            (问题列表, 统计信息)
        """
        all_issues = []
        stats = {
            "total": len(metadatas),
            "by_type": {},
            "errors": 0,
            "warnings": 0,
            "infos": 0,
        }

        # 统计各类型文件数量
        for mt in metadatas:
            file_type = mt.file_type.value
            stats["by_type"][file_type] = stats["by_type"].get(file_type, 0) + 1

        # 单个文件校验
        for metadata in metadatas:
            issues = self.validate_single(metadata)
            all_issues.extend(issues)

            for issue in issues:
                if issue.severity == ValidationSeverity.ERROR:
                    stats["errors"] += 1
                elif issue.severity == ValidationSeverity.WARNING:
                    stats["warnings"] += 1
                else:
                    stats["infos"] += 1

        # 批处理一致性校验
        all_issues.extend(self._validate_batch_consistency(metadatas))

        return all_issues, stats

    def _validate_integrity(self, metadata: FITSMetadata) -> List[ValidationIssue]:
        """校验元数据完整性。

        Args:
            metadata: FITSMetadata对象

        Returns:
            校验问题列表
        """
        issues = []

        # 校验必需字段
        if not metadata.file_path:
            issues.append(ValidationIssue(
                file_name=metadata.file_name,
                field="file_path",
                message="缺少文件路径",
                severity=ValidationSeverity.ERROR,
                details={},
            ))

        if not metadata.file_name:
            issues.append(ValidationIssue(
                file_name=metadata.file_path if metadata.file_path else "unknown",
                field="file_name",
                message="缺少文件名",
                severity=ValidationSeverity.ERROR,
                details={},
            ))

        # 校验曝光时间（所有类型都应该有）
        if metadata.exposure_time is None:
            issues.append(ValidationIssue(
                file_name=metadata.file_name,
                field="exposure_time",
                message="缺少曝光时间",
                severity=ValidationSeverity.WARNING,
                details={},
            ))
        elif metadata.exposure_time <= 0:
            issues.append(ValidationIssue(
                file_name=metadata.file_name,
                field="exposure_time",
                message=f"曝光时间无效: {metadata.exposure_time}",
                severity=ValidationSeverity.ERROR,
                details={"exposure_time": metadata.exposure_time},
            ))

        return issues

    def _validate_by_type(self, metadata: FITSMetadata) -> List[ValidationIssue]:
        """根据文件类型进行特定校验。

        Args:
            metadata: FITSMetadata对象

        Returns:
            校验问题列表
        """
        issues = []

        if metadata.file_type == FileType.LIGHT:
            # 光场文件校验
            if not metadata.filter_name:
                issues.append(ValidationIssue(
                    file_name=metadata.file_name,
                    field="filter_name",
                    message="光场文件缺少滤镜信息",
                    severity=ValidationSeverity.WARNING,
                    details={},
                ))

        elif metadata.file_type == FileType.DARK:
            # 暗场文件校验
            if metadata.temperature is None:
                issues.append(ValidationIssue(
                    file_name=metadata.file_name,
                    field="temperature",
                    message="暗场文件缺少温度信息",
                    severity=ValidationSeverity.WARNING,
                    details={},
                ))

            if not metadata.filter_name:
                issues.append(ValidationIssue(
                    file_name=metadata.file_name,
                    field="filter_name",
                    message="暗场文件通常应指定滤镜",
                    severity=ValidationSeverity.INFO,
                    details={},
                ))

        elif metadata.file_type == FileType.FLAT:
            # 平场文件校验
            if not metadata.filter_name:
                issues.append(ValidationIssue(
                    file_name=metadata.file_name,
                    field="filter_name",
                    message="平场文件缺少滤镜信息",
                    severity=ValidationSeverity.WARNING,
                    details={},
                ))

        return issues

    def _validate_consistency(self, metadata: FITSMetadata) -> List[ValidationIssue]:
        """与观测配置的一致性校验。

        Args:
            metadata: FITSMetadata对象

        Returns:
            校验问题列表
        """
        issues = []
        if not self.config:
            return issues

        # 校验滤镜（仅光场）
        if metadata.file_type == FileType.LIGHT and metadata.filter_name:
            if self.config.expected_exposures:
                expected_filters = set(self.config.expected_exposures.keys())
                if metadata.filter_name not in expected_filters:
                    issues.append(ValidationIssue(
                        file_name=metadata.file_name,
                        field="filter_name",
                        message=f"滤镜 '{metadata.filter_name}' 不在预期滤镜列表中",
                        severity=ValidationSeverity.WARNING,
                        details={
                            "actual": metadata.filter_name,
                            "expected": list(expected_filters),
                        },
                    ))

        # 校验温度（主要是暗场）
        if (
            metadata.file_type == FileType.DARK
            and metadata.temperature is not None
            and self.config.expected_temperature is not None
        ):
            diff = abs(metadata.temperature - self.config.expected_temperature)
            if diff > self.config.temperature_tolerance:
                issues.append(ValidationIssue(
                    file_name=metadata.file_name,
                    field="temperature",
                    message=f"温度偏差超过容差: {diff:.2f}°C",
                    severity=ValidationSeverity.WARNING,
                    details={
                        "actual": metadata.temperature,
                        "expected": self.config.expected_temperature,
                        "tolerance": self.config.temperature_tolerance,
                        "deviation": diff,
                    },
                ))

        return issues

    def _validate_batch_consistency(self, metadatas: List[FITSMetadata]) -> List[ValidationIssue]:
        """批处理一致性校验。

        Args:
            metadatas: FITSMetadata对象列表

        Returns:
            校验问题列表
        """
        issues = []

        # 按文件类型分组
        by_type: Dict[FileType, List[FITSMetadata]] = {}
        for mt in metadatas:
            if mt.file_type not in by_type:
                by_type[mt.file_type] = []
            by_type[mt.file_type].append(mt)

        # 检查暗场文件的温度一致性
        if FileType.DARK in by_type:
            darks = by_type[FileType.DARK]
            temps = [d.temperature for d in darks if d.temperature is not None]

            if len(temps) >= 2:
                min_temp = min(temps)
                max_temp = max(temps)
                temp_range = max_temp - min_temp

                if temp_range > 1.0:
                    for dark in darks:
                        if dark.temperature is not None:
                            issues.append(ValidationIssue(
                                file_name=dark.file_name,
                                field="temperature",
                                message=f"暗场温度不一致，范围: {min_temp:.1f} 到 {max_temp:.1f}°C",
                                severity=ValidationSeverity.WARNING,
                                details={
                                    "current_temp": dark.temperature,
                                    "min_temp": min_temp,
                                    "max_temp": max_temp,
                                    "range": temp_range,
                                },
                            ))

        # 检查光场文件的曝光时间一致性（按滤镜分组）
        if FileType.LIGHT in by_type:
            lights = by_type[FileType.LIGHT]

            # 按滤镜分组
            by_filter: Dict[str, List[FITSMetadata]] = {}
            for light in lights:
                flt = light.filter_name or "unknown"
                if flt not in by_filter:
                    by_filter[flt] = []
                by_filter[flt].append(light)

            # 检查每个滤镜组内的曝光时间
            for flt, group in by_filter.items():
                exps = [l.exposure_time for l in group if l.exposure_time is not None]

                if len(exps) >= 2:
                    # 检查是否所有曝光时间相同
                    if len(set(exps)) > 1:
                        for light in group:
                            issues.append(ValidationIssue(
                                file_name=light.file_name,
                                field="exposure_time",
                                message=f"滤镜 '{flt}' 组内曝光时间不一致",
                                severity=ValidationSeverity.WARNING,
                                details={
                                    "filter": flt,
                                    "current_exp": light.exposure_time,
                                    "all_exps": sorted(list(set(exps))),
                                },
                            ))

        return issues
