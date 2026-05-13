import os
import hashlib
from typing import Dict, Any, Optional, Tuple, List

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False


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


def load_config(project_dir: str, verbose: bool = False) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    加载配置文件，返回 (config_dict, error_message)
    如果配置文件不存在或有错误，error_message 不为 None
    """
    config_path = os.path.join(project_dir, 'config.yaml')
    
    if not os.path.exists(config_path):
        return _deep_copy(DEFAULT_CONFIG), f"配置文件不存在: {config_path}，使用默认配置"
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if not HAS_YAML:
            return _deep_copy(DEFAULT_CONFIG), "PyYAML 未安装，使用默认配置。请运行: pip install PyYAML"
        
        parsed = yaml.safe_load(content)
        
        if parsed is None:
            parsed = {}
        
        if not isinstance(parsed, dict):
            return _deep_copy(DEFAULT_CONFIG), "配置文件格式错误：顶层必须是字典"
        
        config = _deep_copy(DEFAULT_CONFIG)
        _deep_update(config, parsed)
        
        return config, None
        
    except yaml.YAMLError as e:
        return _deep_copy(DEFAULT_CONFIG), f"YAML 解析错误: {str(e)}"
    except Exception as e:
        return _deep_copy(DEFAULT_CONFIG), f"配置文件读取失败: {str(e)}"


def _deep_copy(data: Any) -> Any:
    if isinstance(data, dict):
        return {k: _deep_copy(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [_deep_copy(v) for v in data]
    else:
        return data


def _deep_update(base: Dict, updates: Dict) -> None:
    for key, value in updates.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            _deep_update(base[key], value)
        else:
            base[key] = value


def save_default_config(project_dir: str) -> str:
    config_path = os.path.join(project_dir, 'config.yaml')
    os.makedirs(project_dir, exist_ok=True)
    
    if HAS_YAML:
        with open(config_path, 'w', encoding='utf-8') as f:
            yaml.dump(DEFAULT_CONFIG, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
    else:
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


def config_diff(prev: Dict, current: Dict, path: str = '') -> List[str]:
    """
    比较两个配置字典，返回差异列表
    """
    diffs = []
    
    all_keys = set(prev.keys()) | set(current.keys())
    
    for key in all_keys:
        full_path = f"{path}.{key}" if path else key
        
        if key not in prev:
            diffs.append(f"+ {full_path}: {current[key]}")
        elif key not in current:
            diffs.append(f"- {full_path}: {prev[key]}")
        else:
            if isinstance(prev[key], dict) and isinstance(current[key], dict):
                diffs.extend(config_diff(prev[key], current[key], full_path))
            elif isinstance(prev[key], list) and isinstance(current[key], list):
                if prev[key] != current[key]:
                    diffs.append(f"~ {full_path}: {prev[key]} -> {current[key]}")
            elif prev[key] != current[key]:
                diffs.append(f"~ {full_path}: {prev[key]} -> {current[key]}")
    
    return diffs
