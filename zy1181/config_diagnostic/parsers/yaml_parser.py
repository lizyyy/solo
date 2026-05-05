from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

from .base import ConfigParser, ConfigType, ConfigSource, ParsedConfig, ConfigValue


class YamlParser(ConfigParser):
    def __init__(self):
        super().__init__()
        self._config_type = ConfigType.YAML
    
    def can_parse(self, path: Path) -> bool:
        return self._is_yaml_file(path)
    
    def parse(self, path: Path) -> ParsedConfig:
        parsed = ParsedConfig(
            config_type=self._config_type,
            source_path=str(path),
        )
        
        if not HAS_YAML:
            parsed.errors.append("PyYAML not installed. Install with: pip install pyyaml")
            self._parsed = parsed
            return parsed
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            data = self._parse_yaml(content)
            
            if isinstance(data, dict):
                source = ConfigSource.YAML_CONFIG
                self._flatten_and_add(data, parsed, source, str(path))
            elif data is None:
                pass
            else:
                parsed.errors.append(f"Expected YAML mapping, got {type(data).__name__}")
                
        except yaml.YAMLError as e:
            parsed.errors.append(f"YAML parse error: {str(e)}")
        except Exception as e:
            parsed.errors.append(f"Error reading file: {str(e)}")
        
        self._parsed = parsed
        return parsed
    
    def _parse_yaml(self, content: str) -> Any:
        try:
            return yaml.safe_load(content)
        except yaml.YAMLError:
            return yaml.load(content, Loader=yaml.FullLoader)
    
    def _flatten_and_add(
        self, 
        data: Dict[str, Any], 
        parsed: ParsedConfig, 
        source: ConfigSource,
        source_path: str,
        prefix: str = ""
    ) -> None:
        for key, value in data.items():
            full_key = f"{prefix}.{key}" if prefix else key
            
            if isinstance(value, dict) and self._should_flatten(value):
                self._flatten_and_add(value, parsed, source, source_path, full_key)
            else:
                config_value = ConfigValue(
                    key=full_key,
                    value=value,
                    source=source,
                    source_path=source_path,
                    is_sensitive=self._detect_sensitive_key(full_key),
                )
                parsed.values[full_key] = config_value
    
    def _should_flatten(self, value: Dict[str, Any]) -> bool:
        if not value:
            return False
        
        for k, v in value.items():
            if isinstance(v, (dict, list)):
                return False
        
        return True
