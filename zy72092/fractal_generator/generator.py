import math
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

from .core import FractalPattern, FractalRecord, FractalStatus, UnitType, ValidationIssue
from .validator import FractalValidator, ValidationSeverity


class FractalGenerator:
    FORMULA_DESCRIPTIONS = {
        'fractal_dimension': 'D = log(N) / log(1/r)，其中N为自相似块数量，r为缩放因子',
        'complexity_score': 'C = (iterations * fractal_dimension) / 3 * 100，归一化至0-100区间',
        'boundary_check': '分形维度有效范围 [1.0, 3.0]，低于1为线，高于3空间填充度过高'
    }

    def __init__(self):
        self.validator = FractalValidator()

    def generate_pattern(
        self,
        raw_input: Dict[str, Any],
        source: str = "manual",
        existing_override: Optional[Dict[str, Any]] = None
    ) -> FractalRecord:
        record_id = str(uuid.uuid4())[:8]
        processed_at = datetime.now()

        if raw_input is None:
            raw_input = {}

        if not isinstance(raw_input, dict):
            raw_input = {'_invalid_input': str(raw_input)}

        pattern = self._parse_pattern(raw_input)

        if existing_override and isinstance(existing_override, dict) and existing_override.get('manual_override'):
            pattern = self._apply_override(pattern, existing_override)
            validation_issues = self.validator.validate(pattern, raw_input)
            status = FractalStatus.SUCCESS
        else:
            validation_issues = self.validator.validate(pattern, raw_input)

            has_errors = any(i.severity == ValidationSeverity.ERROR for i in validation_issues)
            has_warnings = any(i.severity == ValidationSeverity.WARNING for i in validation_issues)
            complexity = pattern.complexity_score
            has_unit_issue = self._has_unit_conflict(validation_issues)

            if has_errors:
                status = FractalStatus.NEEDS_REVIEW
            elif has_unit_issue:
                status = FractalStatus.NEEDS_REVIEW
            elif complexity is not None and complexity > 85:
                status = FractalStatus.NEEDS_REVIEW
            elif has_warnings and complexity is not None and complexity > 80:
                status = FractalStatus.NEEDS_REVIEW
            else:
                status = FractalStatus.SUCCESS

        if pattern.complexity_score is None and pattern.fractal_dimension is not None and pattern.iterations is not None:
            pattern.complexity_score = self._calculate_complexity(
                pattern.fractal_dimension,
                pattern.iterations
            )

        record = FractalRecord(
            record_id=record_id,
            pattern=pattern,
            status=status,
            source=source if isinstance(source, str) else str(source),
            processed_at=processed_at,
            validation_issues=validation_issues,
            raw_input=raw_input
        )

        if existing_override and isinstance(existing_override, dict) and existing_override.get('manual_override'):
            record.manual_override = True
            record.override_reason = existing_override.get('override_reason')
            record.override_by = existing_override.get('override_by')
            record.override_at = existing_override.get('override_at')

        return record

    def _parse_pattern(self, raw_input: Dict[str, Any]) -> FractalPattern:
        pattern = FractalPattern()

        unit_str = raw_input.get('unit', 'px')
        if unit_str and isinstance(unit_str, str):
            try:
                pattern.unit = UnitType(unit_str.strip().lower())
            except ValueError:
                pattern.unit = UnitType.PIXEL
        else:
            pattern.unit = UnitType.PIXEL

        for key, value in raw_input.items():
            if key == 'unit':
                continue
            if key == 'fractal_dimension':
                parsed = self._safe_float(value)
                if parsed is not None and not math.isfinite(parsed):
                    parsed = None
                pattern.fractal_dimension = parsed
            elif key == 'iterations':
                parsed = self._safe_int(value)
                pattern.iterations = parsed
            elif key == 'scale_factor':
                parsed = self._safe_float(value)
                if parsed is not None and not math.isfinite(parsed):
                    parsed = None
                pattern.scale_factor = parsed
            elif key == 'rotation_angle':
                parsed = self._safe_float(value)
                if parsed is not None and not math.isfinite(parsed):
                    parsed = None
                pattern.rotation_angle = parsed
            elif key == 'base_shape':
                pattern.base_shape = value if isinstance(value, str) else None
            elif key == 'color_palette':
                pattern.color_palette = value if isinstance(value, str) else None
            elif key == 'complexity_score':
                parsed = self._safe_float(value)
                if parsed is not None and not math.isfinite(parsed):
                    parsed = None
                pattern.complexity_score = parsed

        return pattern

    def _apply_override(self, pattern: FractalPattern, override: Dict[str, Any]) -> FractalPattern:
        override_params = override.get('params', {})
        if not isinstance(override_params, dict):
            return pattern

        numeric_fields = {'fractal_dimension', 'scale_factor', 'rotation_angle', 'complexity_score'}
        int_fields = {'iterations'}
        str_fields = {'base_shape', 'color_palette'}

        for key, value in override_params.items():
            if not hasattr(pattern, key):
                continue
            if key in numeric_fields:
                if isinstance(value, (int, float)) and math.isfinite(value):
                    setattr(pattern, key, float(value))
            elif key in int_fields:
                if isinstance(value, int) and not isinstance(value, bool):
                    setattr(pattern, key, value)
            elif key in str_fields:
                if isinstance(value, str):
                    setattr(pattern, key, value)
            elif key == 'unit':
                if isinstance(value, str):
                    try:
                        setattr(pattern, key, UnitType(value))
                    except ValueError:
                        pass

        return pattern

    def _calculate_complexity(self, fractal_dimension: float, iterations: int) -> float:
        if not math.isfinite(fractal_dimension) or fractal_dimension <= 0:
            return 0.0
        if not isinstance(iterations, int) or iterations <= 0:
            return 0.0
        score = (iterations * fractal_dimension) / 3.0 * 10.0
        if not math.isfinite(score):
            return 100.0
        return round(min(max(score, 0.0), 100.0), 2)

    @staticmethod
    def _has_unit_conflict(issues: List[ValidationIssue]) -> bool:
        for issue in issues:
            if issue.severity == ValidationSeverity.ERROR and '单位' in issue.message:
                return True
            if issue.severity == ValidationSeverity.WARNING and issue.field == 'unit':
                return True
            if issue.severity == ValidationSeverity.WARNING and '单位' in issue.message:
                return True
            if issue.severity == ValidationSeverity.ERROR and '冲突' in issue.message:
                return True
        return False

    @staticmethod
    def _safe_float(value: Any) -> Optional[float]:
        if value is None or (isinstance(value, str) and value.strip() == ''):
            return None
        try:
            if isinstance(value, bool):
                return None
            if isinstance(value, (int, float)):
                return float(value)
            if isinstance(value, str):
                import re
                num_match = re.search(r'[-+]?\d*\.?\d+', value)
                if num_match:
                    return float(num_match.group())
            return None
        except (ValueError, TypeError, OverflowError):
            return None

    @staticmethod
    def _safe_int(value: Any) -> Optional[int]:
        if value is None or (isinstance(value, str) and value.strip() == ''):
            return None
        try:
            if isinstance(value, bool):
                return None
            if isinstance(value, int):
                return value
            if isinstance(value, float):
                if not math.isfinite(value) or value != int(value):
                    return None
                return int(value)
            if isinstance(value, str):
                import re
                num_match = re.search(r'[-+]?\d+', value)
                if num_match:
                    return int(num_match.group())
            return None
        except (ValueError, TypeError, OverflowError):
            return None

    def get_formula_explanation(self) -> Dict[str, str]:
        return self.FORMULA_DESCRIPTIONS

    def generate_report(self, record: FractalRecord) -> Dict[str, Any]:
        errors = [i for i in record.validation_issues if i.severity == ValidationSeverity.ERROR]
        warnings = [i for i in record.validation_issues if i.severity == ValidationSeverity.WARNING]
        infos = [i for i in record.validation_issues if i.severity == ValidationSeverity.INFO]

        return {
            'record_id': record.record_id,
            'status': record.status.value,
            'source': record.source,
            'processed_at': record.processed_at.isoformat(),
            'pattern': record.pattern.to_dict(),
            'summary': {
                'total_issues': len(record.validation_issues),
                'errors': len(errors),
                'warnings': len(warnings),
                'infos': len(infos)
            },
            'issues': {
                'errors': [asdict_safe(i) for i in errors],
                'warnings': [asdict_safe(i) for i in warnings],
                'infos': [asdict_safe(i) for i in infos]
            },
            'formulas': self.FORMULA_DESCRIPTIONS,
            'manual_override': record.manual_override,
            'override_reason': record.override_reason,
            'notes': record.notes
        }


def asdict_safe(issue: ValidationIssue) -> Dict[str, Any]:
    from dataclasses import asdict
    try:
        return asdict(issue)
    except Exception:
        return {'field': issue.field, 'message': issue.message, 'severity': issue.severity}
