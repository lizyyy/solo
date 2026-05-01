from typing import Dict, List, Any, Optional, Tuple, Set
from collections import Counter

import numpy as np

from ..models import (
    CalibrationState,
    ImpulseResponse,
    Speaker,
    MeasurementPoint,
    ClimateData,
    ValidationResult,
    ValidationError,
    UnitSystem,
)


class ValidationRule:
    def __init__(
        self,
        name: str,
        category: str,
        description: str,
    ):
        self.name = name
        self.category = category
        self.description = description

    def check(self, state: CalibrationState) -> Tuple[List[ValidationError], List[ValidationError]]:
        raise NotImplementedError


class SampleRateConsistencyRule(ValidationRule):
    def __init__(self, tolerance_hz: float = 1.0):
        super().__init__(
            name="sample_rate_consistency",
            category="sample_rate",
            description="校验所有脉冲响应的采样率是否一致",
        )
        self.tolerance_hz = tolerance_hz

    def check(self, state: CalibrationState) -> Tuple[List[ValidationError], List[ValidationError]]:
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []

        if not state.impulse_responses:
            return errors, warnings

        sample_rates: Dict[Tuple[str, str], float] = {}

        for spk_id, points in state.impulse_responses.items():
            for pt_id, ir in points.items():
                sample_rates[(spk_id, pt_id)] = ir.sample_rate

        if not sample_rates:
            return errors, warnings

        unique_rates = set(sample_rates.values())

        if len(unique_rates) == 1:
            return errors, warnings

        sorted_rates = sorted(unique_rates)
        groups: List[Set[float]] = []
        current_group: Set[float] = set()

        for rate in sorted_rates:
            if not current_group:
                current_group.add(rate)
            else:
                ref_rate = next(iter(current_group))
                if abs(rate - ref_rate) <= self.tolerance_hz:
                    current_group.add(rate)
                else:
                    groups.append(current_group)
                    current_group = {rate}

        if current_group:
            groups.append(current_group)

        if len(groups) > 1:
            mismatched_pairs = []
            for (spk_id, pt_id), rate in sample_rates.items():
                group_idx = None
                for i, group in enumerate(groups):
                    if any(abs(rate - gr) <= self.tolerance_hz for gr in group):
                        group_idx = i
                        break
                if group_idx is not None and group_idx != 0:
                    mismatched_pairs.append({
                        "speaker": spk_id,
                        "point": pt_id,
                        "sample_rate": rate,
                        "expected_sample_rate": next(iter(groups[0])),
                    })

            if mismatched_pairs:
                errors.append(ValidationError(
                    severity="error",
                    category="sample_rate",
                    message=f"发现 {len(groups)} 组不同的采样率",
                    details={
                        "unique_sample_rates": [float(r) for r in unique_rates],
                        "sample_rate_groups": [[float(r) for r in g] for g in groups],
                        "mismatched_measurements": mismatched_pairs,
                    },
                ))

        return errors, warnings


class TimeZeroRule(ValidationRule):
    def __init__(self, expected_zero_tolerance_samples: int = 5):
        super().__init__(
            name="time_zero",
            category="time_alignment",
            description="校验时间轴是否以零为起点或有合理偏移",
        )
        self.expected_zero_tolerance_samples = expected_zero_tolerance_samples

    def check(self, state: CalibrationState) -> Tuple[List[ValidationError], List[ValidationError]]:
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []

        if not state.impulse_responses:
            return errors, warnings

        for spk_id, points in state.impulse_responses.items():
            for pt_id, ir in points.items():
                if not ir.time_samples:
                    continue

                first_time = ir.time_samples[0]
                dt = np.mean(np.diff(ir.time_samples)) if len(ir.time_samples) > 1 else 0

                if first_time > 0:
                    samples_offset = int(first_time / dt) if dt > 0 else 0

                    if samples_offset > self.expected_zero_tolerance_samples:
                        warnings.append(ValidationError(
                            severity="warning",
                            category="time_alignment",
                            message=f"时间轴起始点不为零 ({spk_id}/{pt_id})",
                            details={
                                "speaker": spk_id,
                                "point": pt_id,
                                "first_time_sec": float(first_time),
                                "samples_offset": samples_offset,
                                "sample_rate": float(ir.sample_rate),
                            },
                        ))

                if first_time < 0:
                    warnings.append(ValidationError(
                        severity="warning",
                        category="time_alignment",
                        message=f"时间轴包含负值 ({spk_id}/{pt_id})",
                        details={
                            "speaker": spk_id,
                            "point": pt_id,
                            "first_time_sec": float(first_time),
                            "sample_rate": float(ir.sample_rate),
                        },
                    ))

        return errors, warnings


class CoordinateUnitsRule(ValidationRule):
    def __init__(
        self,
        min_expected_distance_m: float = 0.1,
        max_expected_distance_m: float = 50.0,
    ):
        super().__init__(
            name="coordinate_units",
            category="coordinates",
            description="校验坐标单位是否合理（通过距离推断）",
        )
        self.min_expected_distance_m = min_expected_distance_m
        self.max_expected_distance_m = max_expected_distance_m

    def check(self, state: CalibrationState) -> Tuple[List[ValidationError], List[ValidationError]]:
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []

        if not state.speakers or not state.points:
            return errors, warnings

        from ..geometry.calculations import calculate_distance

        distances: List[Dict[str, Any]] = []
        min_dist = float('inf')
        max_dist = float('-inf')

        for spk_id, speaker in state.speakers.items():
            for pt_id, point in state.points.items():
                dist = calculate_distance(speaker.position, point.position)
                distances.append({
                    "speaker": spk_id,
                    "point": pt_id,
                    "distance_m": dist,
                })

                if dist < min_dist:
                    min_dist = dist
                if dist > max_dist:
                    max_dist = dist

        unit = state.unit_system.value if hasattr(state, 'unit_system') else 'meters'

        if min_dist < self.min_expected_distance_m:
            warnings.append(ValidationError(
                severity="warning",
                category="coordinates",
                message="检测到极小的距离值，可能单位配置错误",
                details={
                    "current_unit_system": unit,
                    "minimum_distance_m": float(min_dist),
                    "suggestion": (
                        f"如果使用厘米/英尺，请检查配置。"
                        f"最小距离 {min_dist:.4f}m 低于预期 {self.min_expected_distance_m}m"
                    ),
                    "extreme_distances": [
                        d for d in distances
                        if d["distance_m"] < self.min_expected_distance_m
                    ][:10],
                },
            ))

        if max_dist > self.max_expected_distance_m:
            warnings.append(ValidationError(
                severity="warning",
                category="coordinates",
                message="检测到极大的距离值，可能单位配置错误",
                details={
                    "current_unit_system": unit,
                    "maximum_distance_m": float(max_dist),
                    "suggestion": (
                        f"最大距离 {max_dist:.2f}m 超出小剧场常规范围 "
                        f"({self.max_expected_distance_m}m)"
                    ),
                    "extreme_distances": [
                        d for d in distances
                        if d["distance_m"] > self.max_expected_distance_m
                    ][:10],
                },
            ))

        return errors, warnings


class BadRowsRule(ValidationRule):
    def __init__(
        self,
        max_missing_ratio: float = 0.01,
        max_invalid_ratio: float = 0.01,
    ):
        super().__init__(
            name="bad_rows",
            category="data_quality",
            description="校验脉冲响应数据中是否存在坏行（缺失值、异常值等）",
        )
        self.max_missing_ratio = max_missing_ratio
        self.max_invalid_ratio = max_invalid_ratio

    def check(self, state: CalibrationState) -> Tuple[List[ValidationError], List[ValidationError]]:
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []

        if not state.impulse_responses:
            return errors, warnings

        for spk_id, points in state.impulse_responses.items():
            for pt_id, ir in points.items():
                n_samples = len(ir.amplitude)
                if n_samples == 0:
                    errors.append(ValidationError(
                        severity="error",
                        category="data_quality",
                        message=f"脉冲响应数据为空 ({spk_id}/{pt_id})",
                        details={
                            "speaker": spk_id,
                            "point": pt_id,
                        },
                    ))
                    continue

                amplitude = np.array(ir.amplitude)

                invalid_count = int(np.sum(np.isnan(amplitude) | np.isinf(amplitude)))
                invalid_ratio = invalid_count / n_samples

                if invalid_count > 0:
                    detail = {
                        "speaker": spk_id,
                        "point": pt_id,
                        "invalid_samples": invalid_count,
                        "total_samples": n_samples,
                        "invalid_ratio": float(invalid_ratio),
                    }

                    if invalid_ratio > self.max_invalid_ratio:
                        errors.append(ValidationError(
                            severity="error",
                            category="data_quality",
                            message=f"发现大量无效采样值 ({spk_id}/{pt_id})",
                            details=detail,
                        ))
                    else:
                        warnings.append(ValidationError(
                            severity="warning",
                            category="data_quality",
                            message=f"发现少量无效采样值 ({spk_id}/{pt_id})",
                            details=detail,
                        ))

                valid_amp = amplitude[np.isfinite(amplitude)]
                if len(valid_amp) > 0:
                    abs_amp = np.abs(valid_amp)
                    max_amp = np.max(abs_amp)

                    if max_amp == 0:
                        warnings.append(ValidationError(
                            severity="warning",
                            category="data_quality",
                            message=f"脉冲响应幅度全为零 ({spk_id}/{pt_id})",
                            details={
                                "speaker": spk_id,
                                "point": pt_id,
                            },
                        ))
                    elif max_amp < 1e-10:
                        warnings.append(ValidationError(
                            severity="warning",
                            category="data_quality",
                            message=f"脉冲响应幅度极小，可能数据异常 ({spk_id}/{pt_id})",
                            details={
                                "speaker": spk_id,
                                "point": pt_id,
                                "max_amplitude": float(max_amp),
                            },
                        ))

        return errors, warnings


class DuplicatePointsRule(ValidationRule):
    def __init__(self, position_tolerance_m: float = 0.01):
        super().__init__(
            name="duplicate_points",
            category="coordinates",
            description="校验是否存在重复的测点或音箱",
        )
        self.position_tolerance_m = position_tolerance_m

    def check(self, state: CalibrationState) -> Tuple[List[ValidationError], List[ValidationError]]:
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []

        from ..geometry.calculations import calculate_distance

        point_ids = list(state.points.keys())
        for i in range(len(point_ids)):
            pt1_id = point_ids[i]
            pt1 = state.points[pt1_id]

            if pt1_id.lower() in [p.lower() for p in point_ids[:i]]:
                warnings.append(ValidationError(
                    severity="warning",
                    category="coordinates",
                    message=f"测点ID大小写重复: {pt1_id}",
                    details={
                        "point_id": pt1_id,
                        "suggestion": "测点ID区分大小写，可能导致混淆",
                    },
                ))

            for j in range(i + 1, len(point_ids)):
                pt2_id = point_ids[j]
                pt2 = state.points[pt2_id]

                dist = calculate_distance(pt1.position, pt2.position)

                if dist < self.position_tolerance_m:
                    warnings.append(ValidationError(
                        severity="warning",
                        category="coordinates",
                        message=f"发现位置非常接近的测点: {pt1_id} 和 {pt2_id}",
                        details={
                            "point1": pt1_id,
                            "point2": pt2_id,
                            "distance_m": float(dist),
                            "tolerance_m": self.position_tolerance_m,
                            "position1": pt1.position.to_list(),
                            "position2": pt2.position.to_list(),
                        },
                    ))

        speaker_ids = list(state.speakers.keys())
        for i in range(len(speaker_ids)):
            spk1_id = speaker_ids[i]
            spk1 = state.speakers[spk1_id]

            for j in range(i + 1, len(speaker_ids)):
                spk2_id = speaker_ids[j]
                spk2 = state.speakers[spk2_id]

                dist = calculate_distance(spk1.position, spk2.position)

                if dist < self.position_tolerance_m:
                    warnings.append(ValidationError(
                        severity="warning",
                        category="coordinates",
                        message=f"发现位置非常接近的音箱: {spk1_id} 和 {spk2_id}",
                        details={
                            "speaker1": spk1_id,
                            "speaker2": spk2_id,
                            "distance_m": float(dist),
                            "position1": spk1.position.to_list(),
                            "position2": spk2.position.to_list(),
                        },
                    ))

        return errors, warnings


class MeasurementCoverageRule(ValidationRule):
    def __init__(self):
        super().__init__(
            name="measurement_coverage",
            category="data_completeness",
            description="校验每个音箱和测点是否都有测量数据",
        )

    def check(self, state: CalibrationState) -> Tuple[List[ValidationError], List[ValidationError]]:
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []

        measured_speakers: Set[str] = set(state.impulse_responses.keys())
        all_speakers: Set[str] = set(state.speakers.keys())

        missing_speakers = all_speakers - measured_speakers
        if missing_speakers:
            warnings.append(ValidationError(
                severity="warning",
                category="data_completeness",
                message=f"部分音箱缺少测量数据",
                details={
                    "total_speakers": len(all_speakers),
                    "measured_speakers": len(measured_speakers),
                    "missing_speakers": list(missing_speakers),
                },
            ))

        extra_speakers = measured_speakers - all_speakers
        if extra_speakers:
            warnings.append(ValidationError(
                severity="warning",
                category="data_completeness",
                message=f"测量数据中存在未配置的音箱",
                details={
                    "extra_speakers": list(extra_speakers),
                    "suggestion": "请检查音箱配置或测量数据文件名",
                },
            ))

        all_points: Set[str] = set(state.points.keys())
        for spk_id, points in state.impulse_responses.items():
            measured_points: Set[str] = set(points.keys())
            missing_points = all_points - measured_points

            if missing_points and spk_id in all_speakers:
                warnings.append(ValidationError(
                    severity="warning",
                    category="data_completeness",
                    message=f"音箱 {spk_id} 缺少部分测点数据",
                    details={
                        "speaker": spk_id,
                        "total_points": len(all_points),
                        "measured_points": len(measured_points),
                        "missing_points": list(missing_points),
                    },
                ))

            extra_points = measured_points - all_points
            if extra_points:
                warnings.append(ValidationError(
                    severity="warning",
                    category="data_completeness",
                    message=f"音箱 {spk_id} 存在未配置的测点数据",
                    details={
                        "speaker": spk_id,
                        "extra_points": list(extra_points),
                    },
                ))

        return errors, warnings


def validate_sample_rate(state: CalibrationState) -> Tuple[List[ValidationError], List[ValidationError]]:
    return SampleRateConsistencyRule().check(state)


def validate_time_zero(state: CalibrationState) -> Tuple[List[ValidationError], List[ValidationError]]:
    return TimeZeroRule().check(state)


def validate_coordinate_units(state: CalibrationState) -> Tuple[List[ValidationError], List[ValidationError]]:
    return CoordinateUnitsRule().check(state)


def validate_no_bad_rows(state: CalibrationState) -> Tuple[List[ValidationError], List[ValidationError]]:
    return BadRowsRule().check(state)


def validate_no_duplicate_points(state: CalibrationState) -> Tuple[List[ValidationError], List[ValidationError]]:
    return DuplicatePointsRule().check(state)


def validate_measurement_coverage(state: CalibrationState) -> Tuple[List[ValidationError], List[ValidationError]]:
    return MeasurementCoverageRule().check(state)


def run_all_validations(state: CalibrationState) -> ValidationResult:
    all_errors: List[ValidationError] = []
    all_warnings: List[ValidationError] = []

    rules = [
        SampleRateConsistencyRule(),
        TimeZeroRule(),
        CoordinateUnitsRule(),
        BadRowsRule(),
        DuplicatePointsRule(),
        MeasurementCoverageRule(),
    ]

    for rule in rules:
        errors, warnings = rule.check(state)
        all_errors.extend(errors)
        all_warnings.extend(warnings)

    return ValidationResult(
        valid=len(all_errors) == 0,
        errors=all_errors,
        warnings=all_warnings,
    )
