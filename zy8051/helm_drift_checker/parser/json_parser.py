import json
from pathlib import Path
from typing import Dict, Any


def parse_cluster_snapshot(file_path: Path) -> Dict[str, Any]:
    """Parse cluster resource snapshot JSON."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        raise ValueError(f"Failed to parse JSON file {file_path}: {e}")
