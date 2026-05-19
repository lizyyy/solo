import re
import hashlib
from typing import Dict, List, Any, Tuple, Set
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class SensitiveMatch:
    field_path: str
    original_value: str
    masked_value: str
    rule_name: str
    location: str


@dataclass
class SanitizationResult:
    matches: List[SensitiveMatch] = field(default_factory=list)
    total_matches: int = 0
    processed_at: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_matches": self.total_matches,
            "processed_at": self.processed_at,
            "matches": [
                {
                    "field_path": m.field_path,
                    "original_value": m.original_value,
                    "masked_value": m.masked_value,
                    "rule_name": m.rule_name,
                    "location": m.location
                }
                for m in self.matches
            ]
        }


class SensitiveRule:
    def __init__(self, name: str, pattern: str, mask_func=None, value_group=None):
        self.name = name
        self.pattern = re.compile(pattern, re.IGNORECASE)
        self.mask_func = mask_func or self.default_mask
        self.value_group = value_group
        
    def default_mask(self, value: str) -> str:
        return "*" * len(value)
        
    def find_matches(self, value: str, path: str, location: str) -> List[SensitiveMatch]:
        matches = []
        if isinstance(value, str):
            for match in self.pattern.finditer(value):
                if self.value_group is not None:
                    original = match.group(self.value_group)
                    full_match = match.group()
                    masked = self.mask_func(original)
                    full_masked = full_match.replace(original, masked)
                    matches.append(SensitiveMatch(
                        field_path=path,
                        original_value=original,
                        masked_value=masked,
                        rule_name=self.name,
                        location=location
                    ))
                else:
                    original = match.group()
                    masked = self.mask_func(original)
                    matches.append(SensitiveMatch(
                        field_path=path,
                        original_value=original,
                        masked_value=masked,
                        rule_name=self.name,
                        location=location
                    ))
        return matches


class StableMasker:
    def __init__(self, salt: str = "apicassette_salt"):
        self.salt = salt
        self.mapping: Dict[str, str] = {}
        
    def mask_phone(self, value: str) -> str:
        if value not in self.mapping:
            digits = re.sub(r'\D', '', value)
            if len(digits) == 11:
                self.mapping[value] = f"PHONE_MASKED_{digits[-4:]}"
            else:
                hash_val = hashlib.md5(f"{self.salt}{value}".encode()).hexdigest()[:8]
                self.mapping[value] = f"PHONE_{hash_val}"
        return self.mapping[value]
        
    def mask_token(self, value: str) -> str:
        if value not in self.mapping:
            hash_val = hashlib.sha256(f"{self.salt}{value}".encode()).hexdigest()[:16]
            self.mapping[value] = f"TOKEN_MASKED_{hash_val}"
        return self.mapping[value]
        
    def mask_email(self, value: str) -> str:
        if value not in self.mapping:
            hash_val = hashlib.md5(f"{self.salt}{value}".encode()).hexdigest()[:6]
            self.mapping[value] = f"EMAIL_MASKED_{hash_val}"
        return self.mapping[value]
        
    def mask_id_card(self, value: str) -> str:
        if value not in self.mapping:
            hash_val = hashlib.md5(f"{self.salt}{value}".encode()).hexdigest()[:6]
            self.mapping[value] = f"ID_MASKED_{hash_val}"
        return self.mapping[value]
        
    def mask_generic(self, value: str) -> str:
        if value not in self.mapping:
            hash_val = hashlib.md5(f"{self.salt}{value}".encode()).hexdigest()[:8]
            self.mapping[value] = f"GENERIC_MASKED_{hash_val}"
        return self.mapping[value]


class RulesEngine:
    def __init__(self, custom_rules: List[Dict] = None):
        self.masker = StableMasker()
        self.rules: List[SensitiveRule] = []
        self._init_default_rules()
        if custom_rules:
            self._load_custom_rules(custom_rules)
            
    def _init_default_rules(self):
        default_rules = [
            (
                "bearer_token",
                r'Bearer\s+[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+',
                self.masker.mask_token
            ),
            (
                "jwt_token",
                r'eyJ[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+',
                self.masker.mask_token
            ),
            (
                "api_key",
                r'(?:sk_|pk_|api[_-]?key|stripe_|live_|test_)[A-Za-z0-9_-]{8,}',
                self.masker.mask_token
            ),
            (
                "phone_number",
                r'(?:\+?86)?1[3-9]\d{9}',
                self.masker.mask_phone
            ),
            (
                "id_card",
                r'[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]',
                self.masker.mask_id_card
            ),
            (
                "email",
                r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}',
                self.masker.mask_email
            ),
            (
                "password",
                r'"password"\s*:\s*"(?!.*_MASKED_)([^"]{4,})"',
                self.masker.mask_generic,
                1
            ),
            (
                "secret",
                r'"secret"\s*:\s*"(?!.*_MASKED_)([^"]{4,})"',
                self.masker.mask_generic,
                1
            ),
        ]
        
        for rule in default_rules:
            if len(rule) == 4:
                name, pattern, mask_func, value_group = rule
                self.rules.append(SensitiveRule(name, pattern, mask_func, value_group))
            else:
                name, pattern, mask_func = rule
                self.rules.append(SensitiveRule(name, pattern, mask_func))
            
    def _load_custom_rules(self, custom_rules: List[Dict]):
        for rule in custom_rules:
            name = rule.get("name", "custom_rule")
            pattern = rule.get("pattern")
            if pattern:
                self.rules.append(SensitiveRule(name, pattern))
                
    def scan_value(self, value: Any, path: str, location: str) -> List[SensitiveMatch]:
        matches = []
        if isinstance(value, str):
            for rule in self.rules:
                matches.extend(rule.find_matches(value, path, location))
        elif isinstance(value, dict):
            for k, v in value.items():
                new_path = f"{path}.{k}" if path else k
                matches.extend(self.scan_value(v, new_path, location))
        elif isinstance(value, list):
            for i, item in enumerate(value):
                new_path = f"{path}[{i}]"
                matches.extend(self.scan_value(item, new_path, location))
        return matches
        
    def apply_masks(self, data: Any, matches: List[SensitiveMatch]) -> Any:
        if isinstance(data, str):
            replacements = {}
            for match in matches:
                if match.original_value not in replacements:
                    replacements[match.original_value] = match.masked_value
            
            sorted_replacements = sorted(
                replacements.items(),
                key=lambda x: len(x[0]),
                reverse=True
            )
            
            for original, masked in sorted_replacements:
                data = data.replace(original, masked)
            return data
        elif isinstance(data, dict):
            return {k: self.apply_masks(v, matches) for k, v in data.items()}
        elif isinstance(data, list):
            return [self.apply_masks(item, matches) for item in data]
        else:
            return data
            
    def verify_clean(self, data: Any) -> Tuple[bool, List[SensitiveMatch]]:
        all_matches = []
        
        def scan(obj: Any, path: str):
            if isinstance(obj, str):
                for rule in self.rules:
                    matches = rule.find_matches(obj, path, "verification")
                    all_matches.extend(matches)
            elif isinstance(obj, dict):
                for k, v in obj.items():
                    scan(v, f"{path}.{k}" if path else k)
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    scan(item, f"{path}[{i}]")
                    
        scan(data, "")
        return len(all_matches) == 0, all_matches
        
    def get_mapping_report(self) -> Dict[str, str]:
        return self.masker.mapping
