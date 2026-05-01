from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
import shutil

from .config import (
    MaterialMetadata,
    ProjectConfig,
    ValidationRule,
    ValidationResult,
    CheckReport,
)
from .log_alignment import LogAligner
from .exceptions import ValidationError


class BaseValidationRule(ABC):
    def __init__(self, rule_name: ValidationRule, config: ProjectConfig) -> None:
        self.rule_name = rule_name
        self.config = config

    @abstractmethod
    def validate(
        self,
        material: MaterialMetadata,
        log_aligner: LogAligner,
        context: Optional[Dict[str, Any]] = None,
    ) -> ValidationResult:
        pass

    @abstractmethod
    def is_enabled(self) -> bool:
        pass


class DeliveryMissingRule(BaseValidationRule):
    def __init__(self, config: ProjectConfig) -> None:
        super().__init__(ValidationRule.DELIVERY_MISSING, config)

    def is_enabled(self) -> bool:
        return self.config.is_rule_enabled(ValidationRule.DELIVERY_MISSING)

    def validate(
        self,
        material: MaterialMetadata,
        log_aligner: LogAligner,
        context: Optional[Dict[str, Any]] = None,
    ) -> ValidationResult:
        delivery_filenames = log_aligner.get_delivery_list_filenames()

        if not delivery_filenames:
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=True,
                message="无交付清单数据，跳过检查",
                severity="info",
            )

        in_delivery_list = material.file_name in delivery_filenames

        if in_delivery_list:
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=True,
                message="素材在交付清单中",
                details={"in_delivery_list": True},
            )
        else:
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=False,
                message="素材不在交付清单中",
                severity="warning",
                details={"in_delivery_list": False},
            )


class TimeMisalignmentRule(BaseValidationRule):
    def __init__(self, config: ProjectConfig) -> None:
        super().__init__(ValidationRule.TIME_MISALIGNMENT, config)

    def is_enabled(self) -> bool:
        return self.config.is_rule_enabled(ValidationRule.TIME_MISALIGNMENT)

    def validate(
        self,
        material: MaterialMetadata,
        log_aligner: LogAligner,
        context: Optional[Dict[str, Any]] = None,
    ) -> ValidationResult:
        if not material.capture_time:
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=False,
                message="素材无拍摄时间，无法进行时间同步校验",
                severity="warning",
                details={"missing_capture_time": True},
            )

        flight_time_range = log_aligner.get_flight_time_range()

        if not flight_time_range:
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=True,
                message="无飞行日志数据，跳过时间同步校验",
                severity="info",
            )

        capture_time = material.capture_time
        flight_start, flight_end = flight_time_range

        if capture_time < flight_start or capture_time > flight_end:
            time_diff_start = abs((capture_time - flight_start).total_seconds())
            time_diff_end = abs((capture_time - flight_end).total_seconds())

            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=False,
                message=f"素材拍摄时间不在飞行日志时间范围内",
                severity="error",
                details={
                    "capture_time": capture_time.isoformat(),
                    "flight_start": flight_start.isoformat(),
                    "flight_end": flight_end.isoformat(),
                    "outside_flight_range": True,
                    "time_diff_seconds": min(time_diff_start, time_diff_end),
                },
            )

        log_match = log_aligner.find_nearest_log_entry(
            capture_time,
            threshold_seconds=self.config.time_sync_threshold_seconds * 2
        )

        if not log_match:
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=False,
                message=f"在阈值范围内未找到匹配的飞行日志记录",
                severity="warning",
                details={
                    "threshold_seconds": self.config.time_sync_threshold_seconds,
                },
            )

        log_entry, time_diff = log_match

        if time_diff > self.config.time_sync_threshold_seconds:
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=False,
                message=f"素材时间与飞行日志时间错位超过阈值",
                severity="error",
                details={
                    "time_diff_seconds": time_diff,
                    "threshold_seconds": self.config.time_sync_threshold_seconds,
                    "nearest_log_time": log_entry.timestamp.isoformat(),
                },
            )

        return ValidationResult(
            material_metadata=material,
            rule_name=self.rule_name,
            is_valid=True,
            message=f"时间同步正常",
            details={
                "time_diff_seconds": time_diff,
                "nearest_log_time": log_entry.timestamp.isoformat(),
            },
        )


class CoordinateDeviationRule(BaseValidationRule):
    def __init__(self, config: ProjectConfig) -> None:
        super().__init__(ValidationRule.COORDINATE_DEVIATION, config)

    def is_enabled(self) -> bool:
        return self.config.is_rule_enabled(ValidationRule.COORDINATE_DEVIATION)

    def validate(
        self,
        material: MaterialMetadata,
        log_aligner: LogAligner,
        context: Optional[Dict[str, Any]] = None,
    ) -> ValidationResult:
        if not material.is_valid_geolocation():
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=False,
                message="素材无GPS坐标，无法进行坐标偏离校验",
                severity="warning",
                details={"missing_geolocation": True},
            )

        if not log_aligner.waypoint_plans:
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=True,
                message="无航点计划数据，跳过坐标偏离校验",
                severity="info",
            )

        waypoint_match = log_aligner.find_nearest_waypoint(
            material.latitude or 0,
            material.longitude or 0,
            threshold_meters=self.config.coordinate_deviation_threshold_meters * 2
        )

        if not waypoint_match:
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=False,
                message="在扩展阈值范围内未找到匹配的航点",
                severity="warning",
                details={
                    "material_latitude": material.latitude,
                    "material_longitude": material.longitude,
                    "extended_threshold_meters": self.config.coordinate_deviation_threshold_meters * 2,
                },
            )

        waypoint, distance = waypoint_match

        if distance > self.config.coordinate_deviation_threshold_meters:
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=False,
                message=f"实际拍摄坐标与规划航点偏离超过阈值",
                severity="error",
                details={
                    "distance_meters": distance,
                    "threshold_meters": self.config.coordinate_deviation_threshold_meters,
                    "nearest_waypoint_id": waypoint.waypoint_id,
                    "waypoint_latitude": waypoint.latitude,
                    "waypoint_longitude": waypoint.longitude,
                },
            )

        return ValidationResult(
            material_metadata=material,
            rule_name=self.rule_name,
            is_valid=True,
            message=f"坐标偏离正常",
            details={
                "distance_meters": distance,
                "nearest_waypoint_id": waypoint.waypoint_id,
            },
        )


class DuplicateArchiveRule(BaseValidationRule):
    def __init__(self, config: ProjectConfig) -> None:
        super().__init__(ValidationRule.DUPLICATE_ARCHIVE, config)
        self._seen_hashes: Set[str] = set()
        self._seen_filenames: Set[str] = set()
        self._hash_to_materials: Dict[str, List[MaterialMetadata]] = {}

    def is_enabled(self) -> bool:
        return self.config.is_rule_enabled(ValidationRule.DUPLICATE_ARCHIVE)

    def validate(
        self,
        material: MaterialMetadata,
        log_aligner: LogAligner,
        context: Optional[Dict[str, Any]] = None,
    ) -> ValidationResult:
        if material.hash_sha256 in self._hash_to_materials:
            duplicates = [
                m.file_name for m in self._hash_to_materials[material.hash_sha256]
            ]

            self._hash_to_materials[material.hash_sha256].append(material)

            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=False,
                message=f"检测到重复归档（相同文件哈希）",
                severity="error",
                details={
                    "duplicate_files": duplicates + [material.file_name],
                    "hash": material.hash_sha256,
                    "is_duplicate": True,
                },
            )

        if material.file_name in self._seen_filenames:
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=False,
                message=f"检测到重复文件名",
                severity="warning",
                details={
                    "file_name": material.file_name,
                    "is_duplicate_name": True,
                },
            )

        self._seen_hashes.add(material.hash_sha256)
        self._seen_filenames.add(material.file_name)
        self._hash_to_materials[material.hash_sha256] = [material]

        return ValidationResult(
            material_metadata=material,
            rule_name=self.rule_name,
            is_valid=True,
            message="无重复归档",
            details={"is_duplicate": False},
        )

    def reset(self) -> None:
        self._seen_hashes.clear()
        self._seen_filenames.clear()
        self._hash_to_materials.clear()


class MissingMetadataRule(BaseValidationRule):
    def __init__(self, config: ProjectConfig) -> None:
        super().__init__(ValidationRule.MISSING_METADATA, config)

    def is_enabled(self) -> bool:
        return self.config.is_rule_enabled(ValidationRule.MISSING_METADATA)

    def validate(
        self,
        material: MaterialMetadata,
        log_aligner: LogAligner,
        context: Optional[Dict[str, Any]] = None,
    ) -> ValidationResult:
        missing_fields: List[str] = []
        warnings: List[str] = []

        for field in self.config.metadata_required_fields:
            value = getattr(material, field, None)
            if value is None:
                missing_fields.append(field)

        if material.is_valid_geolocation():
            pass
        elif "latitude" in self.config.metadata_required_fields:
            if "latitude" not in missing_fields:
                missing_fields.append("latitude")
            if "longitude" not in missing_fields:
                missing_fields.append("longitude")

        if not material.capture_time and "capture_time" in self.config.metadata_required_fields:
            if "capture_time" not in missing_fields:
                missing_fields.append("capture_time")

        if not material.device_model and "device_model" in self.config.metadata_required_fields:
            warnings.append("设备型号信息缺失")

        if missing_fields:
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=False,
                message=f"关键元数据字段缺失",
                severity="error",
                details={
                    "missing_fields": missing_fields,
                    "warnings": warnings,
                },
            )

        if warnings:
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=True,
                message=f"元数据完整（含警告）",
                severity="warning",
                details={
                    "warnings": warnings,
                },
            )

        return ValidationResult(
            material_metadata=material,
            rule_name=self.rule_name,
            is_valid=True,
            message="所有必需元数据字段完整",
        )


class NoFlyZoneRule(BaseValidationRule):
    def __init__(self, config: ProjectConfig) -> None:
        super().__init__(ValidationRule.NO_FLY_ZONE, config)

    def is_enabled(self) -> bool:
        return self.config.is_rule_enabled(ValidationRule.NO_FLY_ZONE)

    @staticmethod
    def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        import math

        R = 6371000

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        lon1_rad = math.radians(lon1)
        lon2_rad = math.radians(lon2)

        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad

        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c

    def validate(
        self,
        material: MaterialMetadata,
        log_aligner: LogAligner,
        context: Optional[Dict[str, Any]] = None,
    ) -> ValidationResult:
        if not self.config.no_fly_zones:
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=True,
                message="无禁飞区配置，跳过检查",
                severity="info",
            )

        if not material.is_valid_geolocation():
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=False,
                message="素材无GPS坐标，无法进行禁飞区校验",
                severity="warning",
                details={"missing_geolocation": True},
            )

        violations: List[Dict[str, Any]] = []

        for no_fly_zone in self.config.no_fly_zones:
            distance = self._haversine_distance(
                material.latitude or 0,
                material.longitude or 0,
                no_fly_zone.center_lat,
                no_fly_zone.center_lon,
            )

            if distance <= no_fly_zone.radius_meters:
                violations.append({
                    "zone_name": no_fly_zone.name,
                    "distance_meters": distance,
                    "zone_radius_meters": no_fly_zone.radius_meters,
                    "zone_center": {
                        "latitude": no_fly_zone.center_lat,
                        "longitude": no_fly_zone.center_lon,
                    },
                })

        if violations:
            return ValidationResult(
                material_metadata=material,
                rule_name=self.rule_name,
                is_valid=False,
                message=f"疑似进入禁飞区（{len(violations)}个区域）",
                severity="error",
                details={
                    "violations": violations,
                    "material_location": {
                        "latitude": material.latitude,
                        "longitude": material.longitude,
                    },
                },
            )

        return ValidationResult(
            material_metadata=material,
            rule_name=self.rule_name,
            is_valid=True,
            message="未进入禁飞区",
        )


class ValidationEngine:
    def __init__(self, config: ProjectConfig, log_aligner: LogAligner) -> None:
        self.config = config
        self.log_aligner = log_aligner
        self._rules: List[BaseValidationRule] = self._create_rules()

    def _create_rules(self) -> List[BaseValidationRule]:
        return [
            DeliveryMissingRule(self.config),
            TimeMisalignmentRule(self.config),
            CoordinateDeviationRule(self.config),
            DuplicateArchiveRule(self.config),
            MissingMetadataRule(self.config),
            NoFlyZoneRule(self.config),
        ]

    def reset_duplicate_checker(self) -> None:
        for rule in self._rules:
            if isinstance(rule, DuplicateArchiveRule):
                rule.reset()

    def validate_material(
        self,
        material: MaterialMetadata,
        context: Optional[Dict[str, Any]] = None,
    ) -> List[ValidationResult]:
        results: List[ValidationResult] = []

        for rule in self._rules:
            if rule.is_enabled():
                result = rule.validate(material, self.log_aligner, context)
                results.append(result)

        return results

    def validate_all(
        self,
        materials: List[MaterialMetadata],
        project_id: str,
        report_id: Optional[str] = None,
    ) -> CheckReport:
        import uuid

        if report_id is None:
            report_id = str(uuid.uuid4())

        self.reset_duplicate_checker()

        all_results: List[ValidationResult] = []
        valid_materials: Set[str] = set()
        invalid_materials: Set[str] = set()

        stats_by_rule: Dict[ValidationRule, Dict[str, int]] = {
            rule: {"valid": 0, "invalid": 0, "total": 0}
            for rule in ValidationRule
        }

        for material in materials:
            material_results = self.validate_material(material)
            all_results.extend(material_results)

            material_valid = True
            for result in material_results:
                stats_by_rule[result.rule_name]["total"] += 1
                if result.is_valid:
                    stats_by_rule[result.rule_name]["valid"] += 1
                else:
                    stats_by_rule[result.rule_name]["invalid"] += 1
                    if result.severity == "error":
                        material_valid = False

            if material_valid:
                valid_materials.add(material.file_path)
            else:
                invalid_materials.add(material.file_path)

        report = CheckReport(
            project_id=project_id,
            report_id=report_id,
            total_materials=len(materials),
            valid_materials=len(valid_materials),
            invalid_materials=len(invalid_materials),
            quarantined_materials=0,
            validation_results=all_results,
            stats_by_rule=stats_by_rule,
        )

        return report


class QuarantineManager:
    def __init__(self, quarantine_dir: Path) -> None:
        self.quarantine_dir = quarantine_dir
        self.quarantine_dir.mkdir(parents=True, exist_ok=True)
        self._quarantined_files: List[Path] = []

    def move_to_quarantine(
        self,
        source_path: Path,
        reason: str,
        validation_results: List[ValidationResult],
    ) -> Path:
        if not source_path.exists():
            raise FileNotFoundError(f"源文件不存在: {source_path}")

        dest_path = self.quarantine_dir / source_path.name

        counter = 1
        while dest_path.exists():
            name_parts = source_path.stem.rsplit("_", 1)
            if len(name_parts) == 2 and name_parts[1].isdigit():
                base_name = name_parts[0]
                counter = int(name_parts[1]) + 1
            else:
                base_name = source_path.stem

            dest_path = self.quarantine_dir / f"{base_name}_{counter}{source_path.suffix}"
            counter += 1

        shutil.move(str(source_path), str(dest_path))

        meta_path = dest_path.with_suffix(dest_path.suffix + ".meta")
        import json

        meta_data = {
            "original_path": str(source_path),
            "moved_at": datetime.now().isoformat(),
            "reason": reason,
            "validation_errors": [
                {
                    "rule_name": str(result.rule_name),
                    "message": result.message,
                    "severity": result.severity,
                }
                for result in validation_results
                if not result.is_valid
            ],
        }

        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta_data, f, indent=2, ensure_ascii=False)

        self._quarantined_files.append(dest_path)
        return dest_path

    def list_quarantined(self) -> List[Path]:
        return [
            f for f in self.quarantine_dir.iterdir()
            if f.is_file() and not f.name.endswith(".meta")
        ]

    def get_quarantine_count(self) -> int:
        return len(self._quarantined_files)
