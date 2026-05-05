import json
from pathlib import Path
from typing import Any, Dict, List

from .base import ConfigParser, ConfigType, ConfigSource, ParsedConfig, ConfigValue


class JsonParser(ConfigParser):
    def __init__(self):
        super().__init__()
        self._config_type = ConfigType.JSON
    
    def can_parse(self, path: Path) -> bool:
        return self._is_json_file(path)
    
    def parse(self, path: Path) -> ParsedConfig:
        parsed = ParsedConfig(
            config_type=self._config_type,
            source_path=str(path),
        )
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            data = self._parse_json(content)
            
            if isinstance(data, dict):
                source = self._determine_source(path)
                self._flatten_and_add(data, parsed, source, str(path))
            else:
                parsed.errors.append(f"Expected JSON object, got {type(data).__name__}")
                
        except json.JSONDecodeError as e:
            parsed.errors.append(f"JSON parse error at line {e.lineno}, column {e.colno}: {e.msg}")
        except Exception as e:
            parsed.errors.append(f"Error reading file: {str(e)}")
        
        self._parsed = parsed
        return parsed
    
    def _parse_json(self, content: str) -> Any:
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            import re
            content_clean = re.sub(r'//.*$', '', content, flags=re.MULTILINE)
            content_clean = re.sub(r'/\*.*?\*/', '', content_clean, flags=re.DOTALL)
            return json.loads(content_clean)
    
    def _determine_source(self, path: Path) -> ConfigSource:
        name_lower = path.name.lower()
        if "local" in name_lower:
            return ConfigSource.LOCAL_JSON
        return ConfigSource.GLOBAL_JSON
    
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
