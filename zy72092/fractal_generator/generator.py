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
        
        pattern = self._parse_pattern(raw_input)
        
        if existing_override and existing_override.get('manual_override'):
            pattern = self._apply_override(pattern, existing_override)
            validation_issues = self.validator.validate(pattern, raw_input)
            status = FractalStatus.SUCCESS
        else:
            validation_issues = self.validator.validate(pattern, raw_input)
            
            has_errors = any(i.severity == ValidationSeverity.ERROR for i in validation_issues)
            has_warnings = any(i.severity == ValidationSeverity.WARNING for i in validation_issues)
            
            if has_errors:
                status = FractalStatus.NEEDS_REVIEW
            elif has_warnings and pattern.complexity_score and pattern.complexity_score > 80:
                status = FractalStatus.NEEDS_REVIEW
            else:
                status = FractalStatus.SUCCESS
        
        if pattern.complexity_score is None and pattern.fractal_dimension and pattern.iterations:
            pattern.complexity_score = self._calculate_complexity(
                pattern.fractal_dimension,
                pattern.iterations
            )
        
        record = FractalRecord(
            record_id=record_id,
            pattern=pattern,
            status=status,
            source=source,
            processed_at=processed_at,
            validation_issues=validation_issues,
            raw_input=raw_input
        )
        
        if existing_override and existing_override.get('manual_override'):
            record.manual_override = True
            record.override_reason = existing_override.get('override_reason')
            record.override_by = existing_override.get('override_by')
            record.override_at = existing_override.get('override_at')
        
        return record
    
    def _parse_pattern(self, raw_input: Dict[str, Any]) -> FractalPattern:
        pattern = FractalPattern()
        
        unit_str = raw_input.get('unit', 'px')
        if unit_str:
            try:
                pattern.unit = UnitType(unit_str)
            except ValueError:
                pattern.unit = UnitType.PIXEL
        
        for key, value in raw_input.items():
            if key == 'unit':
                continue
            if key == 'fractal_dimension':
                pattern.fractal_dimension = self._safe_float(value)
            elif key == 'iterations':
                pattern.iterations = self._safe_int(value)
            elif key == 'scale_factor':
                pattern.scale_factor = self._safe_float(value)
            elif key == 'rotation_angle':
                pattern.rotation_angle = self._safe_float(value)
            elif key == 'base_shape':
                pattern.base_shape = value if isinstance(value, str) else None
            elif key == 'color_palette':
                pattern.color_palette = value if isinstance(value, str) else None
            elif key == 'complexity_score':
                pattern.complexity_score = self._safe_float(value)
        
        return pattern
    
    def _apply_override(self, pattern: FractalPattern, override: Dict[str, Any]) -> FractalPattern:
        override_params = override.get('params', {})
        for key, value in override_params.items():
            if hasattr(pattern, key):
                setattr(pattern, key, value)
        return pattern
    
    def _calculate_complexity(self, fractal_dimension: float, iterations: int) -> float:
        score = (iterations * fractal_dimension) / 3.0 * 10.0
        return round(min(max(score, 0.0), 100.0), 2)
    
    @staticmethod
    def _safe_float(value: Any) -> Optional[float]:
        if value is None or (isinstance(value, str) and value.strip() == ''):
            return None
        try:
            if isinstance(value, str):
                import re
                num_match = re.search(r'[-+]?\d*\.?\d+', value)
                if num_match:
                    return float(num_match.group())
            return float(value)
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def _safe_int(value: Any) -> Optional[int]:
        if value is None or (isinstance(value, str) and value.strip() == ''):
            return None
        try:
            if isinstance(value, str):
                import re
                num_match = re.search(r'[-+]?\d+', value)
                if num_match:
                    return int(num_match.group())
            return int(value)
        except (ValueError, TypeError):
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
                'errors': [i.__dict__ for i in errors],
                'warnings': [i.__dict__ for i in warnings],
                'infos': [i.__dict__ for i in infos]
            },
            'formulas': self.FORMULA_DESCRIPTIONS,
            'manual_override': record.manual_override,
            'override_reason': record.override_reason,
            'notes': record.notes
        }
