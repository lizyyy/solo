import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from .base import ConfigParser, ConfigType, ConfigSource, ParsedConfig, ConfigValue


class EnvParser(ConfigParser):
    def __init__(self):
        super().__init__()
        self._config_type = ConfigType.ENV
    
    def can_parse(self, path: Path) -> bool:
        return self._is_env_file(path)
    
    def parse(self, path: Path) -> ParsedConfig:
        parsed = ParsedConfig(
            config_type=self._config_type,
            source_path=str(path),
        )
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            for line_num, line in enumerate(lines, 1):
                line = line.strip()
                
                if not line or line.startswith('#'):
                    continue
                
                if '=' in line:
                    key, value = self._parse_line(line, line_num, parsed)
                    if key is not None:
                        config_value = ConfigValue(
                            key=key,
                            value=value,
                            source=ConfigSource.ENV_FILE,
                            source_path=str(path),
                            line_number=line_num,
                            is_sensitive=self._detect_sensitive_key(key),
                        )
                        parsed.values[key] = config_value
                        
        except Exception as e:
            parsed.errors.append(f"Error reading .env file: {str(e)}")
        
        self._parsed = parsed
        return parsed
    
    def _parse_line(
        self, 
        line: str, 
        line_num: int,
        parsed: ParsedConfig
    ) -> tuple[Optional[str], Optional[Any]]:
        comment_pos = self._find_comment_position(line)
        if comment_pos != -1:
            line = line[:comment_pos].strip()
        
        if '=' not in line:
            return None, None
        
        key_part, value_part = line.split('=', 1)
        key = key_part.strip()
        value = value_part.strip()
        
        if not key:
            parsed.errors.append(f"Line {line_num}: Empty key found")
            return None, None
        
        value = self._parse_value(value)
        
        return key, value
    
    def _find_comment_position(self, line: str) -> int:
        in_single_quote = False
        in_double_quote = False
        escaped = False
        
        for i, char in enumerate(line):
            if escaped:
                escaped = False
                continue
            
            if char == '\\':
                escaped = True
                continue
            
            if char == "'" and not in_double_quote:
                in_single_quote = not in_single_quote
            elif char == '"' and not in_single_quote:
                in_double_quote = not in_double_quote
            elif char == '#' and not in_single_quote and not in_double_quote:
                return i
        
        return -1
    
    def _parse_value(self, value: str) -> Any:
        if not value:
            return ""
        
        if (value.startswith('"') and value.endswith('"')) or \
           (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]
            value = value.replace('\\n', '\n').replace('\\t', '\t')
            return value
        
        if value.lower() == 'true':
            return True
        if value.lower() == 'false':
            return False
        if value.lower() == 'null' or value.lower() == 'none':
            return None
        
        try:
            return int(value)
        except ValueError:
            pass
        
        try:
            return float(value)
        except ValueError:
            pass
        
        return value
