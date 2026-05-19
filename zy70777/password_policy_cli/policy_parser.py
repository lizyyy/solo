import json
import yaml
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from pathlib import Path


@dataclass
class CharacterClassRule:
    name: str
    required: bool = False
    min_count: int = 0
    charset: str = ""


@dataclass
class PasswordPolicy:
    min_length: int = 8
    max_length: int = 64
    min_uppercase: int = 0
    min_lowercase: int = 0
    min_digits: int = 0
    min_special: int = 0
    special_chars: str = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    character_classes: List[CharacterClassRule] = field(default_factory=list)
    forbidden_patterns: List[str] = field(default_factory=list)
    forbid_consecutive: bool = False
    forbid_username_similar: bool = False
    history_count: int = 0

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PasswordPolicy':
        policy = cls()
        policy.min_length = data.get('min_length', 8)
        policy.max_length = data.get('max_length', 64)
        policy.min_uppercase = data.get('min_uppercase', 0)
        policy.min_lowercase = data.get('min_lowercase', 0)
        policy.min_digits = data.get('min_digits', 0)
        policy.min_special = data.get('min_special', 0)
        policy.special_chars = data.get('special_chars', "!@#$%^&*()_+-=[]{}|;:,.<>?")
        policy.forbidden_patterns = data.get('forbidden_patterns', [])
        policy.forbid_consecutive = data.get('forbid_consecutive', False)
        policy.forbid_username_similar = data.get('forbid_username_similar', False)
        policy.history_count = data.get('history_count', 0)

        if 'character_classes' in data:
            for cc_data in data['character_classes']:
                policy.character_classes.append(CharacterClassRule(
                    name=cc_data.get('name', ''),
                    required=cc_data.get('required', False),
                    min_count=cc_data.get('min_count', 0),
                    charset=cc_data.get('charset', '')
                ))

        return policy

    def to_dict(self) -> Dict[str, Any]:
        return {
            'min_length': self.min_length,
            'max_length': self.max_length,
            'min_uppercase': self.min_uppercase,
            'min_lowercase': self.min_lowercase,
            'min_digits': self.min_digits,
            'min_special': self.min_special,
            'special_chars': self.special_chars,
            'character_classes': [
                {
                    'name': cc.name,
                    'required': cc.required,
                    'min_count': cc.min_count,
                    'charset': cc.charset
                }
                for cc in self.character_classes
            ],
            'forbidden_patterns': self.forbidden_patterns,
            'forbid_consecutive': self.forbid_consecutive,
            'forbid_username_similar': self.forbid_username_similar,
            'history_count': self.history_count
        }


class PolicyParser:
    @staticmethod
    def parse_json(file_path: str) -> PasswordPolicy:
        path = Path(file_path)
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return PasswordPolicy.from_dict(data)

    @staticmethod
    def parse_yaml(file_path: str) -> PasswordPolicy:
        path = Path(file_path)
        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        return PasswordPolicy.from_dict(data)

    @staticmethod
    def parse(file_path: str) -> PasswordPolicy:
        path = Path(file_path)
        if path.suffix.lower() in ('.json',):
            return PolicyParser.parse_json(file_path)
        elif path.suffix.lower() in ('.yaml', '.yml'):
            return PolicyParser.parse_yaml(file_path)
        else:
            raise ValueError(f"Unsupported file format: {path.suffix}")

    @staticmethod
    def parse_string(content: str, format: str = 'json') -> PasswordPolicy:
        if format == 'json':
            data = json.loads(content)
        elif format in ('yaml', 'yml'):
            data = yaml.safe_load(content)
        else:
            raise ValueError(f"Unsupported format: {format}")
        return PasswordPolicy.from_dict(data)
