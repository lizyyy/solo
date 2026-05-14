import re
from typing import Dict, List, Tuple, Any

class DataValidator:
    def __init__(self):
        self.dirty_patterns = {
            "sql_injection": [
                r"'.*OR.*'1'='1",
                r"DROP TABLE",
                r"UNION SELECT",
                r"--.*$",
                r";.*DELETE",
            ],
            "xss": [
                r"<script.*?>.*?</script>",
                r"javascript:",
                r"on\w+=.*",
            ],
            "invalid_format": [
                r"[^\x00-\x7F]+",
            ],
            "excessive_length": lambda val, max_len=100: len(str(val)) > max_len,
            "negative_value": lambda val: isinstance(val, (int, float)) and val < 0,
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, List[str], Dict[str, Any]]:
        is_dirty = False
        dirty_reasons = []
        corrected_params = params.copy()
        
        for key, value in params.items():
            reasons = self._check_value(key, value)
            if reasons:
                is_dirty = True
                dirty_reasons.extend(reasons)
                corrected_params[key] = self._clean_value(value)
        
        return is_dirty, dirty_reasons, corrected_params
    
    def _check_value(self, key: str, value: Any) -> List[str]:
        reasons = []
        
        if isinstance(value, str):
            for pattern_name, patterns in self.dirty_patterns.items():
                if isinstance(patterns, list):
                    for pattern in patterns:
                        if re.search(pattern, value, re.IGNORECASE):
                            reasons.append(f"{key}: 检测到{pattern_name}风险")
                elif callable(patterns):
                    if patterns(value):
                        reasons.append(f"{key}: 不符合{pattern_name}规则")
        
        if isinstance(value, (int, float)) and value < 0:
            reasons.append(f"{key}: 数值不能为负数")
        
        return reasons
    
    def _clean_value(self, value: Any) -> Any:
        if isinstance(value, str):
            value = re.sub(r"[<>\"']", "", value)
            value = value[:100]
        elif isinstance(value, (int, float)) and value < 0:
            value = 0
        return value
    
    def generate_explanation(self, reasons: List[str]) -> str:
        if not reasons:
            return "参数验证通过"
        
        explanation_parts = [
            "检测到以下问题：",
            *[f"- {reason}" for reason in reasons],
            "",
            "已自动执行以下修正：",
            "- 移除特殊字符防止注入攻击",
            "- 截断超长文本",
            "- 负数修正为0",
        ]
        
        return "\n".join(explanation_parts)
