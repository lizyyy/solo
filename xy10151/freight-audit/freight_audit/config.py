import os
import hashlib
from typing import Dict, Any, Optional


DEFAULT_CONFIG = {
    'import': {
        'required_columns': ['shipment_no', 'version'],
        'optional_columns': [
            'weight', 'original_weight', 'route', 'original_route',
            'freight_fee', 'standard_fee', 'shipper', 'receiver'
        ],
        'encoding': 'utf-8',
        'delimiter': ',',
    },
    'audit': {
        'fee_tolerance_percent': 5.0,
        'fee_tolerance_absolute': 10.0,
        'tracked_fields': ['weight', 'original_weight', 'route', 'original_route', 'freight_fee'],
        'severity_thresholds': {
            'high': 50.0,
            'medium': 20.0,
            'low': 0.0,
        },
    },
    'report': {
        'output_dir': 'reports',
        'default_format': 'markdown',
    },
}


def load_config(project_dir: str) -> Dict[str, Any]:
    config_path = os.path.join(project_dir, 'config.yaml')
    
    if not os.path.exists(config_path):
        return DEFAULT_CONFIG.copy()
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        config = DEFAULT_CONFIG.copy()
        parsed = _parse_simple_yaml(content)
        _deep_update(config, parsed)
        return config
    except Exception:
        return DEFAULT_CONFIG.copy()


def _parse_simple_yaml(content: str) -> Dict[str, Any]:
    result = {}
    stack = [(0, result)]
    current_list = None
    list_indent = -1
    
    for line in content.split('\n'):
        if not line.strip() or line.strip().startswith('#'):
            continue
        
        indent = len(line) - len(line.lstrip())
        stripped = line.strip()
        
        if stripped.startswith('- '):
            if current_list is None or indent != list_indent:
                while stack and stack[-1][0] >= indent:
                    stack.pop()
                if stack:
                    parent_indent, parent_dict = stack[-1]
                    key = None
                    for k in reversed(parent_dict):
                        if isinstance(parent_dict[k], list):
                            current_list = parent_dict[k]
                            list_indent = indent
                            break
                    else:
                        key = f'list_{len(parent_dict)}'
                        parent_dict[key] = []
                        current_list = parent_dict[key]
                        list_indent = indent
            
            value = stripped[2:].strip()
            current_list.append(_parse_value(value))
            continue
        
        if ':' in stripped:
            while stack and stack[-1][0] >= indent:
                stack.pop()
            
            parent_indent, parent_dict = stack[-1]
            key_part, value_part = stripped.split(':', 1)
            key = key_part.strip()
            value = value_part.strip()
            
            if not value:
                new_dict = {}
                parent_dict[key] = new_dict
                stack.append((indent, new_dict))
                current_list = None
            else:
                parent_dict[key] = _parse_value(value)
    
    return result


def _parse_value(value: str):
    value = value.strip()
    if value.lower() == 'true':
        return True
    if value.lower() == 'false':
        return False
    if value.lower() == 'null' or value == '':
        return None
    try:
        if '.' in value:
            return float(value)
        return int(value)
    except ValueError:
        return value


def _deep_update(base: Dict, updates: Dict) -> None:
    for key, value in updates.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            _deep_update(base[key], value)
        else:
            base[key] = value


def save_default_config(project_dir: str) -> str:
    config_path = os.path.join(project_dir, 'config.yaml')
    os.makedirs(project_dir, exist_ok=True)
    
    content = _yaml_dump(DEFAULT_CONFIG)
    with open(config_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return config_path


def _yaml_dump(data: Dict, indent: int = 0) -> str:
    lines = []
    prefix = '  ' * indent
    
    for key, value in data.items():
        if isinstance(value, dict):
            lines.append(f'{prefix}{key}:')
            lines.append(_yaml_dump(value, indent + 1))
        elif isinstance(value, list):
            lines.append(f'{prefix}{key}:')
            for item in value:
                lines.append(f'{prefix}  - {item}')
        else:
            lines.append(f'{prefix}{key}: {value}')
    
    return '\n'.join(lines)


def compute_config_hash(config: Dict) -> str:
    import json
    config_str = json.dumps(config, sort_keys=True, ensure_ascii=False)
    return hashlib.md5(config_str.encode('utf-8')).hexdigest()


def get_output_dir(project_dir: str, config: Dict) -> str:
    report_config = config.get('report', {})
    output_dir = report_config.get('output_dir', 'reports')
    return os.path.join(project_dir, output_dir)
