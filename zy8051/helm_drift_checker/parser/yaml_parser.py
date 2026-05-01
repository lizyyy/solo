import yaml
from pathlib import Path
from typing import Dict, Any


def parse_yaml(file_path: Path) -> Dict[str, Any]:
    """Parse YAML file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f) or {}
    except Exception as e:
        raise ValueError(f"Failed to parse YAML file {file_path}: {e}")


def parse_values(file_path: Path) -> Dict[str, Any]:
    """Parse current values.yaml."""
    return parse_yaml(file_path)


def parse_chart_defaults(file_path: Path) -> Dict[str, Any]:
    """Parse target chart defaults YAML."""
    return parse_yaml(file_path)
