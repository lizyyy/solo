import re
from typing import List, Set, Dict, Any

class PlaceholderExtractor:
    def __init__(self, patterns: List[str] = None):
        self.patterns = patterns or [
            r'\{(\w+)\}',
            r'\{(\d+)\}',
            r'%(\w+)',
            r'%(\d+)',
            r'\{\{(\w+)\}\}',
            r'\$(\w+)',
        ]
        self.compiled_patterns = [re.compile(p) for p in self.patterns]
    
    def extract(self, text: str) -> Set[str]:
        placeholders = set()
        for pattern in self.compiled_patterns:
            matches = pattern.findall(text)
            placeholders.update(matches)
        return placeholders
    
    def extract_all(self, translations: Dict[str, Any]) -> Dict[str, Set[str]]:
        result = {}
        self._extract_recursive(translations, "", result)
        return result
    
    def _extract_recursive(self, data: Any, prefix: str, result: Dict[str, Set[str]]):
        if isinstance(data, dict):
            for key, value in data.items():
                new_prefix = f"{prefix}.{key}" if prefix else key
                self._extract_recursive(value, new_prefix, result)
        elif isinstance(data, str):
            placeholders = self.extract(data)
            if placeholders:
                result[prefix] = placeholders
        elif isinstance(data, list):
            for i, item in enumerate(data):
                new_prefix = f"{prefix}[{i}]"
                self._extract_recursive(item, new_prefix, result)
