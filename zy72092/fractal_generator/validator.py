from typing import List, Tuple, Optional, Set
from enum import Enum
import math

from .core import FractalPattern, UnitType, ValidationIssue


class ValidationSeverity(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


UNIT_CONVERSION_FACTORS = {
    UnitType.PIXEL: 1.0,
    UnitType.MILLIMETER: 3.77953,
    UnitType.CENTIMETER: 37.7953,
    UnitType.INCH: 96.0,
    UnitType.PERCENT: 1.0
}

FRACTAL_DIMENSION_BOUNDS = (1.0, 3.0)
ITERATIONS_BOUNDS = (1, 20)
SCALE_FACTOR_BOUNDS = (0.1, 2.0)
ROTATION_ANGLE_BOUNDS = (-360.0, 360.0)
COMPLEXITY_SCORE_BOUNDS = (0.0, 100.0)

VALID_BASE_SHAPES = ['triangle', 'square', 'pentagon', 'hexagon', 'circle', 'line']
VALID_COLOR_PALETTES = ['monochrome', 'gradient', 'rainbow', 'earth', 'ocean', 'fire']

UNIT_BOUNDARY_PATTERN = {
    UnitType.PIXEL: r'(\d+)\s*px\b',
    UnitType.MILLIMETER: r'(\d+\.?\d*)\s*mm\b',
    UnitType.CENTIMETER: r'(\d+\.?\d*)\s*cm\b',
    UnitType.INCH: r'(\d+\.?\d*)\s*in\b',
    UnitType.PERCENT: r'(\d+\.?\d*)\s*%\b',
}


def _is_finite_number(value) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return math.isfinite(value)
    return False


class FractalValidator:
    _seen_patterns: Set[Tuple] = set()

    def __init__(self):
        self.issues: List[ValidationIssue] = []

    def validate(self, pattern: FractalPattern, raw_input: dict = None) -> List[ValidationIssue]:
        self.issues = []
        raw = raw_input if raw_input is not None else {}

        self._check_missing_values(pattern, raw)
        self._validate_fractal_dimension(pattern.fractal_dimension)
        self._validate_iterations(pattern.iterations)
        self._validate_scale_factor(pattern.scale_factor)
        self._validate_rotation_angle(pattern.rotation_angle)
        self._validate_base_shape(pattern.base_shape)
        self._validate_color_palette(pattern.color_palette)
        self._validate_complexity_score(pattern.complexity_score)
        self._check_unit_consistency(pattern, raw)
        self._check_duplicate_pattern(pattern)

        return self.issues

    def _check_missing_values(self, pattern: FractalPattern, raw: dict):
        required_fields = ['fractal_dimension', 'iterations', 'scale_factor']
        for field_name in required_fields:
            if getattr(pattern, field_name) is None:
                self.issues.append(ValidationIssue(
                    field=field_name,
                    message=f"缺少必填参数: {field_name}",
                    severity=ValidationSeverity.ERROR,
                    suggestion="请参考课堂讲义第3章补充该参数"
                ))

        for key, value in raw.items():
            if value is None or (isinstance(value, str) and value.strip() == ''):
                if key not in [i.field for i in self.issues]:
                    self.issues.append(ValidationIssue(
                        field=key,
                        message="输入值为空",
                        severity=ValidationSeverity.WARNING,
                        suggestion="如非必填字段可留空，否则请补充数值"
                    ))

    def _validate_fractal_dimension(self, value):
        if value is None:
            return

        if not _is_finite_number(value):
            self.issues.append(ValidationIssue(
                field='fractal_dimension',
                message=f"分形维度值无效: {value}",
                severity=ValidationSeverity.ERROR,
                suggestion="请输入有效数值，范围 [1.0, 3.0]"
            ))
            return

        min_val, max_val = FRACTAL_DIMENSION_BOUNDS
        if value < min_val or value > max_val:
            self.issues.append(ValidationIssue(
                field='fractal_dimension',
                message=f"分形维度 {value} 超出有效范围 [{min_val}, {max_val}]",
                severity=ValidationSeverity.ERROR,
                suggestion=f"请调整至 {min_val}-{max_val} 之间，典型值如 1.26（科赫曲线）、1.89（曼德博集合）"
            ))
        elif value < 1.1 or value > 2.9:
            self.issues.append(ValidationIssue(
                field='fractal_dimension',
                message=f"分形维度 {value} 接近边界值",
                severity=ValidationSeverity.WARNING,
                suggestion="边界样本请特别注意验证结果合理性"
            ))

    def _validate_iterations(self, value):
        if value is None:
            return

        if not isinstance(value, int) or isinstance(value, bool):
            self.issues.append(ValidationIssue(
                field='iterations',
                message=f"迭代次数值类型无效: {value}",
                severity=ValidationSeverity.ERROR,
                suggestion="请输入整数，范围 [1, 20]"
            ))
            return

        min_val, max_val = ITERATIONS_BOUNDS
        if value < min_val or value > max_val:
            self.issues.append(ValidationIssue(
                field='iterations',
                message=f"迭代次数 {value} 超出有效范围 [{min_val}, {max_val}]",
                severity=ValidationSeverity.ERROR,
                suggestion=f"请调整至 {min_val}-{max_val} 次之间，推荐值为 5-10 次"
            ))

    def _validate_scale_factor(self, value):
        if value is None:
            return

        if not _is_finite_number(value):
            self.issues.append(ValidationIssue(
                field='scale_factor',
                message=f"缩放因子值无效: {value}",
                severity=ValidationSeverity.ERROR,
                suggestion="请输入有效数值，范围 [0.1, 2.0]"
            ))
            return

        min_val, max_val = SCALE_FACTOR_BOUNDS
        if value < min_val or value > max_val:
            self.issues.append(ValidationIssue(
                field='scale_factor',
                message=f"缩放因子 {value} 超出有效范围 [{min_val}, {max_val}]",
                severity=ValidationSeverity.ERROR,
                suggestion=f"请调整至 {min_val}-{max_val} 之间"
            ))

        if math.isclose(value, 0.5, rel_tol=1e-9) or math.isclose(value, 1.0, rel_tol=1e-9):
            self.issues.append(ValidationIssue(
                field='scale_factor',
                message=f"缩放因子 {value} 为常见特殊值",
                severity=ValidationSeverity.INFO,
                suggestion="此值常用于经典分形图案，请确认是否为预期值"
            ))

    def _validate_rotation_angle(self, value):
        if value is None:
            return

        if not _is_finite_number(value):
            self.issues.append(ValidationIssue(
                field='rotation_angle',
                message=f"旋转角度值无效: {value}",
                severity=ValidationSeverity.WARNING,
                suggestion="请输入有效数值"
            ))
            return

        min_val, max_val = ROTATION_ANGLE_BOUNDS
        if value < min_val or value > max_val:
            normalized = value % 360
            self.issues.append(ValidationIssue(
                field='rotation_angle',
                message=f"旋转角度 {value}° 已标准化为 {normalized}°",
                severity=ValidationSeverity.WARNING,
                suggestion=f"角度范围应为 [{min_val}°, {max_val}°]"
            ))

    def _validate_base_shape(self, value):
        if value is None:
            return

        if not isinstance(value, str):
            self.issues.append(ValidationIssue(
                field='base_shape',
                message=f"基础形状值类型无效: {value}",
                severity=ValidationSeverity.ERROR,
                suggestion=f"请输入字符串，有效形状包括: {', '.join(VALID_BASE_SHAPES)}"
            ))
            return

        if value not in VALID_BASE_SHAPES:
            self.issues.append(ValidationIssue(
                field='base_shape',
                message=f"未知基础形状: {value}",
                severity=ValidationSeverity.ERROR,
                suggestion=f"有效形状包括: {', '.join(VALID_BASE_SHAPES)}"
            ))

    def _validate_color_palette(self, value):
        if value is None:
            return

        if not isinstance(value, str):
            self.issues.append(ValidationIssue(
                field='color_palette',
                message=f"配色方案值类型无效: {value}",
                severity=ValidationSeverity.WARNING,
                suggestion=f"请输入字符串，推荐方案包括: {', '.join(VALID_COLOR_PALETTES)}"
            ))
            return

        if value not in VALID_COLOR_PALETTES:
            self.issues.append(ValidationIssue(
                field='color_palette',
                message=f"未知配色方案: {value}",
                severity=ValidationSeverity.WARNING,
                suggestion=f"推荐方案包括: {', '.join(VALID_COLOR_PALETTES)}"
            ))

    def _validate_complexity_score(self, value):
        if value is None:
            return

        if not _is_finite_number(value):
            self.issues.append(ValidationIssue(
                field='complexity_score',
                message=f"复杂度评分值无效: {value}",
                severity=ValidationSeverity.WARNING,
                suggestion="请输入有效数值，范围 [0.0, 100.0]"
            ))
            return

        min_val, max_val = COMPLEXITY_SCORE_BOUNDS
        if value < min_val or value > max_val:
            self.issues.append(ValidationIssue(
                field='complexity_score',
                message=f"复杂度评分 {value} 超出有效范围 [{min_val}, {max_val}]",
                severity=ValidationSeverity.WARNING,
                suggestion="评分将被截断至有效范围"
            ))

    def _check_unit_consistency(self, pattern: FractalPattern, raw: dict):
        import re
        units_in_input = []

        for key, value in raw.items():
            if isinstance(value, str):
                for unit_type, pattern_re in UNIT_BOUNDARY_PATTERN.items():
                    if re.search(pattern_re, value, re.IGNORECASE):
                        units_in_input.append(unit_type)

        if len(units_in_input) > 1 and len(set(units_in_input)) > 1:
            unit_names = [u.value for u in set(units_in_input)]
            self.issues.append(ValidationIssue(
                field='unit',
                message=f"检测到单位混用: {', '.join(unit_names)}",
                severity=ValidationSeverity.WARNING,
                suggestion=f"已统一转换为 {pattern.unit.value if pattern.unit else 'px'}"
            ))

    def _check_duplicate_pattern(self, pattern: FractalPattern):
        sig = (
            pattern.fractal_dimension,
            pattern.iterations,
            pattern.scale_factor,
            pattern.rotation_angle,
            pattern.base_shape,
            pattern.unit.value if pattern.unit else None,
            pattern.color_palette,
        )
        if sig in self._seen_patterns:
            self.issues.append(ValidationIssue(
                field='_duplicate',
                message="检测到与已有记录完全重复的参数组合",
                severity=ValidationSeverity.WARNING,
                suggestion="请确认是否为重复提交，如为不同场景请添加备注区分"
            ))
        else:
            self._seen_patterns.add(sig)

    @staticmethod
    def convert_to_pixels(value: float, from_unit: UnitType) -> float:
        if not _is_finite_number(value):
            return 0.0
        return value * UNIT_CONVERSION_FACTORS[from_unit]

    @staticmethod
    def normalize_angle(angle: float) -> float:
        if not _is_finite_number(angle):
            return 0.0
        return ((angle + 180) % 360) - 180

    @classmethod
    def reset_duplicate_tracker(cls):
        cls._seen_patterns.clear()
