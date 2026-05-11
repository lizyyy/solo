import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

from .models import TenantConfig


SENSITIVE_KEYS = [
    "debug_mode",
    "enable_dangerous_ops",
    "allow_external_access",
    "bypass_rate_limit",
    "disable_auth",
    "enable_test_features",
    "auto_approve",
    "skip_validation",
]


def _is_sensitive_key(key: str) -> bool:
    key_lower = key.lower()
    for sk in SENSITIVE_KEYS:
        if sk in key_lower:
            return True
    return False


def load_yaml_file(file_path: Path) -> Dict[str, Any]:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        data = list(yaml.safe_load_all(content))
        if not data or len(data) == 0:
            return {}
        if len(data) == 1:
            return data[0] or {}
        merged = {}
        for doc in data:
            if isinstance(doc, dict):
                merged.update(doc)
        return merged


def load_json_file(file_path: Path) -> Dict[str, Any]:
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_config_file(file_path: Path) -> Dict[str, Any]:
    if not file_path.exists():
        raise FileNotFoundError(f"Config file not found: {file_path}")
    
    suffix = file_path.suffix.lower()
    if suffix in (".yaml", ".yml"):
        return load_yaml_file(file_path)
    elif suffix == ".json":
        return load_json_file(file_path)
    else:
        raise ValueError(f"Unsupported config format: {suffix}. Use .yaml/.yml or .json")


def load_default_config(default_dir: Path) -> Dict[str, Any]:
    config = {}
    errors: List[str] = []
    source_files: Dict[str, str] = {}
    
    yaml_files = list(default_dir.glob("*.yaml")) + list(default_dir.glob("*.yml")) + list(default_dir.glob("*.json"))
    
    for file_path in sorted(yaml_files):
        try:
            data = load_config_file(file_path)
            if not isinstance(data, dict):
                errors.append(f"File {file_path.name} is not a valid config object")
                continue
            
            for key, value in data.items():
                if key in config:
                    errors.append(f"Warning: Key '{key}' defined multiple times in default config (first: {source_files.get(key)}, now: {file_path.name})")
                config[key] = value
                source_files[key] = file_path.name
        except Exception as e:
            errors.append(f"Error loading {file_path.name}: {str(e)}")
    
    return config


def load_tenant_configs(tenants_dir: Path) -> Dict[str, TenantConfig]:
    tenant_configs: Dict[str, TenantConfig] = {}
    
    if not tenants_dir.exists():
        return tenant_configs
    
    for tenant_dir in sorted(tenants_dir.iterdir()):
        if not tenant_dir.is_dir():
            continue
        
        tenant_id = tenant_dir.name
        merged_config: Dict[str, Any] = {}
        source_files: Dict[str, str] = {}
        duplicate_keys: List[str] = []
        parse_errors: List[str] = []
        tier = "standard"
        
        config_files = list(tenant_dir.glob("*.yaml")) + list(tenant_dir.glob("*.yml")) + list(tenant_dir.glob("*.json"))
        
        for file_path in sorted(config_files):
            try:
                data = load_config_file(file_path)
                if not isinstance(data, dict):
                    parse_errors.append(f"File {file_path.name} is not a valid config object")
                    continue
                
                if "tier" in data:
                    tier = str(data["tier"])
                
                for key, value in data.items():
                    if key in merged_config:
                        duplicate_keys.append(f"'{key}' in {source_files[key]} and {file_path.name}")
                    merged_config[key] = value
                    source_files[key] = file_path.name
            except Exception as e:
                parse_errors.append(f"Error loading {file_path.name}: {str(e)}")
        
        tenant_configs[tenant_id] = TenantConfig(
            tenant_id=tenant_id,
            tier=tier,
            config=merged_config,
            source_files=source_files,
            duplicate_keys=duplicate_keys,
            parse_errors=parse_errors,
        )
    
    return tenant_configs


def flatten_config(config: Dict[str, Any], prefix: str = "") -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    
    for key, value in config.items():
        full_key = f"{prefix}.{key}" if prefix else key
        
        if isinstance(value, dict) and value:
            nested = flatten_config(value, full_key)
            result.update(nested)
        else:
            result[full_key] = value
    
    return result
