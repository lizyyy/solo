import re
from typing import Dict, List, Any, Optional, Set, Tuple
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class MaskedItem:
    path: str
    original_value: str
    masked_value: str
    pattern_name: str


class SensitiveDataMasker:
    DEFAULT_PATTERNS = {
        "password": re.compile(r"password|passwd|pwd|secret", re.IGNORECASE),
        "api_key": re.compile(r"api[_-]?key|apikey", re.IGNORECASE),
        "token": re.compile(r"token|bearer|jwt", re.IGNORECASE),
        "certificate": re.compile(r"cert|pem|key|crt", re.IGNORECASE),
        "connection_string": re.compile(r"connection[_-]?string|connstring", re.IGNORECASE),
        "private_key": re.compile(r"private[_-]?key|rsa|dsa", re.IGNORECASE),
        "authorization": re.compile(r"authorization|auth", re.IGNORECASE),
        "credential": re.compile(r"credential|creds", re.IGNORECASE),
    }

    DEFAULT_MASK_VALUE = "[MASKED]"
    DEFAULT_PARTIAL_MASK_LENGTH = 4

    def __init__(
        self,
        patterns: Optional[Dict[str, re.Pattern]] = None,
        mask_value: Optional[str] = None,
        partial_mask: bool = True,
        partial_mask_length: Optional[int] = None
    ):
        self.patterns = patterns or self.DEFAULT_PATTERNS
        self.mask_value = mask_value or self.DEFAULT_MASK_VALUE
        self.partial_mask = partial_mask
        self.partial_mask_length = partial_mask_length or self.DEFAULT_PARTIAL_MASK_LENGTH

    def mask_manifest(self, manifest: Dict[str, Any]) -> Tuple[Dict[str, Any], List[MaskedItem]]:
        masked = manifest.copy()
        masked_items = []
        self._mask_object(masked, "", masked_items)
        return masked, masked_items

    def mask_all(self, manifests: List[Dict]) -> Tuple[List[Dict], List[MaskedItem]]:
        all_masked_items = []
        masked_manifests = []
        
        for manifest in manifests:
            masked, items = self.mask_manifest(manifest)
            masked_manifests.append(masked)
            all_masked_items.extend(items)
        
        return masked_manifests, all_masked_items

    def _mask_object(
        self,
        obj: Any,
        path: str,
        masked_items: List[MaskedItem]
    ) -> None:
        if isinstance(obj, dict):
            for key, value in list(obj.items()):
                current_path = f"{path}.{key}" if path else key
                
                if isinstance(value, (dict, list)):
                    self._mask_object(value, current_path, masked_items)
                elif isinstance(value, (str, int, float)):
                    pattern_name = self._match_pattern(key)
                    if pattern_name:
                        masked_value = self._apply_mask(str(value))
                        obj[key] = masked_value
                        masked_items.append(MaskedItem(
                            path=current_path,
                            original_value=str(value),
                            masked_value=masked_value,
                            pattern_name=pattern_name
                        ))
                        
        elif isinstance(obj, list):
            for idx, item in enumerate(obj):
                current_path = f"{path}[{idx}]"
                if isinstance(item, (dict, list)):
                    self._mask_object(item, current_path, masked_items)

    def _match_pattern(self, key: str) -> Optional[str]:
        for pattern_name, pattern in self.patterns.items():
            if pattern.search(key):
                return pattern_name
        return None

    def _apply_mask(self, value: str) -> str:
        if not self.partial_mask or len(value) <= self.partial_mask_length * 2:
            return self.mask_value
        
        prefix = value[:self.partial_mask_length]
        suffix = value[-self.partial_mask_length:]
        return f"{prefix}{self.mask_value}{suffix}"

    def add_pattern(self, name: str, pattern: re.Pattern) -> None:
        self.patterns[name] = pattern

    def remove_pattern(self, name: str) -> None:
        self.patterns.pop(name, None)

    def get_masked_fields_summary(self, masked_items: List[MaskedItem]) -> Dict[str, Any]:
        by_pattern = {}
        for item in masked_items:
            if item.pattern_name not in by_pattern:
                by_pattern[item.pattern_name] = []
            by_pattern[item.pattern_name].append(item.path)
        
        return {
            "total_masked": len(masked_items),
            "by_pattern": by_pattern,
            "masked_paths": [item.path for item in masked_items]
        }
