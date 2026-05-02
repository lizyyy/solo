import yaml
from typing import Dict, Any


class RuleLoader:
    @staticmethod
    def load_rules(file_path: str) -> Dict[str, Any]:
        with open(file_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    @staticmethod
    def validate_rules(rules: Dict[str, Any]) -> bool:
        required_sections = ['opening_rules', 'promise_rules', 'silence_rules']
        return all(section in rules for section in required_sections)