from typing import List, Tuple, Optional, Set, Dict
from enum import Enum
import math
import re

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

LENGTH_UNIT_CONVERSION = {
    (UnitType.INCH, UnitType.MILLIMETER): 25.4,
    (UnitType.INCH, UnitType.CENTIMETER): 2.54,
    (UnitType.MILLIMETER, UnitType.CENTIMETER): 0.1,
    (UnitType.CENTIMETER, UnitType.MILLIMETER): 10.0,
    (UnitType.MILLIMETER, UnitType.INCH): 1 / 25.4,
    (UnitType.CENTIMETER, UnitType.INCH): 1 / 2.54,
}

UNIT_ALIAS_MAP = {
    'px': UnitType.PIXEL,
    'pixel': UnitType.PIXEL,
    'mm': UnitType.MILLIMETER,
    'millimeter': UnitType.MILLIMETER,
    'millimeters': UnitType.MILLIMETER,
    'cm': UnitType.CENTIMETER,
    'centimeter': UnitType.CENTIMETER,
    'centimeters': UnitType.CENTIMETER,
    'in': UnitType.INCH,
    'inch': UnitType.INCH,
    'inches': UnitType.INCH,
    '%': UnitType.PERCENT,
    'percent': UnitType.PERCENT,
    'pct': UnitType.PERCENT,
}

NUMERIC_FIELDS_WITH_UNITS = [
    'fractal_dimension',
    'scale_factor',
    'rotation_angle',
    'complexity_score'
]

FRACTAL_DIMENSION_BOUNDS = (1.0, 3.0)
ITERATIONS_BOUNDS = (1, 20)
SCALE_FACTOR_BOUNDS = (0.1, 2.0)
ROTATION_ANGLE_BOUNDS = (-360.0, 360.0)
COMPLEXITY_SCORE_BOUNDS = (0.0, 100.0)

VALID_BASE_SHAPES = ['triangle', 'square', 'pentagon', 'hexagon', 'circle', 'line']
VALID_COLOR_PALETTES = ['monochrome', 'gradient', 'rainbow', 'earth', 'ocean', 'fire']


def _is_finite_number(value) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return math.isfinite(value)
    return False


def extract_value_and_unit(raw_value) -> Tuple[Optional[float], Optional[UnitType], Optional[str]]:
    if raw_value is None:
        return None, None, None
    if isinstance(raw_value, (int, float)) and not isinstance(raw_value, bool):
        if math.isfinite(raw_value):
            return float(raw_value), None, None
        return None, None, None
    if not isinstance(raw_value, str):
        return None, None, None

    value_str = raw_value.strip()
    if not value_str:
        return None, None, None

    match = re.match(
        r'([-+]?\d*\.?\d+)\s*(px|pixel|mm|millimeter|cm|centimeter|in|inch|%|percent|deg|次)?\b',
        value_str,
        re.IGNORECASE
    )
    if not match:
        num_match = re.search(r'[-+]?\d*\.?\d+', value_str)
        if num_match:
            try:
                return float(num_match.group()), None, value_str
            except ValueError:
                return None, None, value_str
        return None, None, value_str

    numeric_val = float(match.group(1))
    unit_str = match.group(2)

    detected_unit = None
    if unit_str:
        unit_lower = unit_str.lower()
        if unit_lower in UNIT_ALIAS_MAP:
            detected_unit = UNIT_ALIAS_MAP[unit_lower]

    return numeric_val, detected_unit, value_str


def can_convert_length(from_unit: UnitType, to_unit: UnitType) -> bool:
    return (from_unit, to_unit) in LENGTH_UNIT_CONVERSION


def convert_length_value(value: float, from_unit: UnitType, to_unit: UnitType) -> Optional[float]:
    key = (from_unit, to_unit)
    if key in LENGTH_UNIT_CONVERSION:
        return value * LENGTH_UNIT_CONVERSION[key]
    if from_unit == to_unit:
        return value
    return None


class FractalValidator:
    _seen_patterns: Set[Tuple] = set()

    def __init__(self):
        self.issues: List[ValidationIssue] = []
        self._field_units: Dict[str, UnitType] = {}

    def validate(self, pattern: FractalPattern, raw_input: dict = None) -> List[ValidationIssue]:
        self.issues = []
        self._field_units = {}
        raw = raw_input if raw_input is not None else {}

        self._check_missing_values(pattern, raw)
        self._extract_field_units(raw)
        self._validate_fractal_dimension(pattern.fractal_dimension)
        self._validate_iterations(pattern.iterations)
        self._validate_scale_factor(pattern.scale_factor)
        self._validate_rotation_angle(pattern.rotation_angle)
        self._validate_base_shape(pattern.base_shape)
        self._validate_color_palette(pattern.color_palette)
        self._validate_complexity_score(pattern.complexity_score)
        self._check_unit_consistency(pattern, raw)
        self._check_field_unit_conflicts(pattern)
        self._check_duplicate_pattern(pattern)

        return self.issues

    def _extract_field_units(self, raw: dict):
        for field in NUMERIC_FIELDS_WITH_UNITS:
            if field in raw and raw[field] is not None:
                _, unit, _ = extract_value_and_unit(raw[field])
                if unit is not None:
                    self._field_units[field] = unit

    def get_field_units(self) -> Dict[str, UnitType]:
        return dict(self._field_units)

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
        elif value < 1.2 or value > 2.5:
            severity = ValidationSeverity.WARNING if value > 2.7 else ValidationSeverity.INFO
            self.issues.append(ValidationIssue(
                field='fractal_dimension',
                message=f"分形维度 {value} {'接近上边界' if value > 2.5 else '接近下边界'}，属于高风险范围",
                severity=severity,
                suggestion="高维度样本生成复杂度高，建议人工复核结果合理性"
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
        elif value > 12:
            self.issues.append(ValidationIssue(
                field='iterations',
                message=f"迭代次数 {value} 较高，生成耗时和复杂度将显著增加",
                severity=ValidationSeverity.INFO,
                suggestion="高迭代次数可能导致性能问题，建议确认是否必要"
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
        elif value > 80:
            severity = ValidationSeverity.WARNING if value > 90 else ValidationSeverity.INFO
            self.issues.append(ValidationIssue(
                field='complexity_score',
                message=f"复杂度评分 {value} 较高，生成结果可能不稳定",
                severity=severity,
                suggestion="高复杂度纹样建议人工复核，参考课堂讲义第7章异常样本处理"
            ))

    def _check_unit_consistency(self, pattern: FractalPattern, raw: dict):
        distinct_units = set()
        if pattern.unit is not None:
            distinct_units.add(pattern.unit)
        for field, unit in self._field_units.items():
            distinct_units.add(unit)

        if len(distinct_units) > 1:
            unit_names = sorted([u.value for u in distinct_units])
            self.issues.append(ValidationIssue(
                field='unit',
                message=f"检测到多套单位混用: {', '.join(unit_names)}",
                severity=ValidationSeverity.WARNING,
                suggestion="单位不一致可能导致参数含义模糊，请确认或统一单位"
            ))

    def _check_field_unit_conflicts(self, pattern: FractalPattern):
        global_unit = pattern.unit
        if global_unit is None:
            return

        conflict_fields = []
        convertible_fields = []
        non_dimension_fields = []

        non_dimension_param_names = {
            'fractal_dimension', 'scale_factor', 'complexity_score'
        }

        for field_name, field_unit in self._field_units.items():
            if field_unit == global_unit:
                continue

            if field_name in non_dimension_param_names:
                non_dimension_fields.append((field_name, field_unit))
                continue

            if can_convert_length(field_unit, global_unit):
                convertible_fields.append((field_name, field_unit))
            else:
                conflict_fields.append((field_name, field_unit))

        for field_name, field_unit in non_dimension_fields:
            self.issues.append(ValidationIssue(
                field=field_name,
                message=f"{field_name} 输入值携带单位 {field_unit.value}，但该参数为无量纲值，单位已被忽略",
                severity=ValidationSeverity.WARNING,
                suggestion=f"{field_name} 是无量纲参数，请确认数值 {getattr(pattern, field_name, 'N/A')} 是否正确，无需带单位"
            ))

        for field_name, field_unit in convertible_fields:
            self.issues.append(ValidationIssue(
                field=field_name,
                message=f"{field_name} 单位为 {field_unit.value}，与全局声明 {global_unit.value} 不一致，已自动换算",
                severity=ValidationSeverity.INFO,
                suggestion=f"已将 {field_unit.value} 换算为 {global_unit.value}，换算系数: {LENGTH_UNIT_CONVERSION.get((field_unit, global_unit), 'N/A')}"
            ))

        for field_name, field_unit in conflict_fields:
            self.issues.append(ValidationIssue(
                field=field_name,
                message=f"{field_name} 单位为 {field_unit.value}，与全局声明 {global_unit.value} 冲突，无法自动换算",
                severity=ValidationSeverity.ERROR,
                suggestion="请统一单位后重新生成，或人工确认参数含义"
            ))

    def has_unit_conflict(self) -> bool:
        return any(
            i.severity == ValidationSeverity.WARNING and (
                i.field == 'unit' or '单位' in i.message
            )
            for i in self.issues
        ) or any(
            i.severity == ValidationSeverity.ERROR and '冲突' in i.message
            for i in self.issues
        )

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
