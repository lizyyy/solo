import re
from typing import List, Tuple
from schemas import PlaceholderValidationResult


class PlaceholderValidator:
    DEFAULT_PATTERN = r'\{[\w]+\}'

    @classmethod
    def extract_placeholders(cls, text: str, pattern: str = None) -> List[str]:
        if not text:
            return []
        use_pattern = pattern or cls.DEFAULT_PATTERN
        return re.findall(use_pattern, text)

    @classmethod
    def validate(cls, source_text: str, translated_text: str, 
                 placeholder_pattern: str = None) -> PlaceholderValidationResult:
        errors = []
        source_placeholders = set(cls.extract_placeholders(source_text, placeholder_pattern))
        translated_placeholders = set(cls.extract_placeholders(translated_text, placeholder_pattern))
        
        missing = sorted(list(source_placeholders - translated_placeholders))
        extra = sorted(list(translated_placeholders - source_placeholders))
        
        if missing:
            errors.append(f"缺失占位符: {', '.join(missing)}")
        
        if extra:
            errors.append(f"多余占位符: {', '.join(extra)}")
        
        return PlaceholderValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            missing_placeholders=missing,
            extra_placeholders=extra
        )
