from pathlib import Path
from typing import Dict, Any, List
from .yaml_parser import parse_yaml


class UpgradePolicy:
    def __init__(self, policy_dict: Dict[str, Any]):
        self.deprecated_fields: List[str] = policy_dict.get('deprecated_fields', [])
        self.risk_thresholds: Dict[str, Any] = policy_dict.get('risk_thresholds', {})
        self.required_manual_confirm: List[str] = policy_dict.get('required_manual_confirm', [])
        self.allowed_changes: List[str] = policy_dict.get('allowed_changes', [])
        self.conflict_resolution: str = policy_dict.get('conflict_resolution', 'manual')


def parse_upgrade_policy(file_path: Path) -> UpgradePolicy:
    """Parse upgrade policy YAML."""
    policy_dict = parse_yaml(file_path)
    return UpgradePolicy(policy_dict)
