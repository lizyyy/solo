from typing import Dict, Any, List, Tuple
from pathlib import Path
from ..parser.yaml_parser import parse_yaml


class Change:
    def __init__(self, type: str, path: str, old_value: Any = None, new_value: Any = None):
        self.type = type
        self.path = path
        self.old_value = old_value
        self.new_value = new_value


class DiffEngine:
    def __init__(self, current_values: Dict[str, Any], target_defaults: Dict[str, Any]):
        self.current = current_values
        self.target = target_defaults
        self.changes: List[Change] = []
        self.deleted_fields: List[str] = []
        self.conflicts: List[Tuple[str, List[Any]]] = []

    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """Get nested value by dot-separated path."""
        parts = path.split('.')
        current = data
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
        return current

    def _compare_dicts(self, current: Dict[str, Any], target: Dict[str, Any], prefix: str = ''):
        """Recursively compare dictionaries."""
        all_keys = set(current.keys()) | set(target.keys())
        
        for key in all_keys:
            full_path = f"{prefix}.{key}" if prefix else key
            
            if key not in target:
                self.deleted_fields.append(full_path)
                self.changes.append(Change('deleted', full_path, old_value=current[key]))
            elif key not in current:
                self.changes.append(Change('added', full_path, new_value=target[key]))
            else:
                current_val = current[key]
                target_val = target[key]
                
                if isinstance(current_val, dict) and isinstance(target_val, dict):
                    self._compare_dicts(current_val, target_val, full_path)
                elif current_val != target_val:
                    self.changes.append(Change('modified', full_path, old_value=current_val, new_value=target_val))

    def _check_deleted_fields(self):
        """Check for fields that exist in current but not in target."""
        self._compare_dicts(self.current, self.target)

    def _check_conflicts(self, env_files: List[Path] = None):
        """Check for conflicts across multiple env override files."""
        if not env_files:
            return
        
        field_values: Dict[str, List[Any]] = {}
        
        for file_path in env_files:
            try:
                data = parse_yaml(file_path)
                self._collect_fields(data, '', field_values, str(file_path))
            except Exception as e:
                continue
        
        for path, values in field_values.items():
            if len(set(values)) > 1:
                self.conflicts.append((path, values))

    def _collect_fields(self, data: Dict[str, Any], prefix: str, field_values: Dict[str, List[Any]], source: str):
        """Collect all fields and their values from a dict."""
        for key, value in data.items():
            full_path = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict):
                self._collect_fields(value, full_path, field_values, source)
            else:
                if full_path not in field_values:
                    field_values[full_path] = []
                field_values[full_path].append(value)

    def analyze(self, env_override_files: List[Path] = None) -> Dict[str, Any]:
        """Run full diff analysis."""
        self.changes = []
        self.deleted_fields = []
        self.conflicts = []
        
        self._check_deleted_fields()
        if env_override_files:
            self._check_conflicts(env_override_files)
        
        return {
            'changes': self.changes,
            'deleted_fields': self.deleted_fields,
            'conflicts': self.conflicts
        }
