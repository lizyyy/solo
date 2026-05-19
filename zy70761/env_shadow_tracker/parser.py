import re
import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional
import yaml

from .models import VariableDef, SourceType, SourceLevel


@dataclass
class BadLine:
    file_path: str
    line_number: int
    raw_line: str
    reason: str


class BaseParser:
    def __init__(self, file_path: str):
        self.file_path = str(Path(file_path).resolve())
        self.variables: List[VariableDef] = []
        self.errors: List[str] = []
        self.bad_lines: List[BadLine] = []
    
    def parse(self) -> List[VariableDef]:
        raise NotImplementedError
    
    def _read_file(self) -> List[str]:
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                return f.readlines()
        except Exception as e:
            self.errors.append(f"Failed to read {self.file_path}: {str(e)}")
            return []
    
    def _looks_like_var_def(self, line: str) -> bool:
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            return False
        if '=' in stripped:
            return True
        return False


class EnvParser(BaseParser):
    ENV_PATTERN = re.compile(
        r'^\s*(export\s+)?'
        r'([a-zA-Z_][a-zA-Z0-9_]*)'
        r'\s*=\s*'
        r'(.*?)\s*$'
    )
    
    def parse(self) -> List[VariableDef]:
        self.variables = []
        self.bad_lines = []
        lines = self._read_file()
        
        for line_num, raw_line in enumerate(lines, start=1):
            line = raw_line.rstrip('\n')
            is_commented = line.strip().startswith('#')
            
            if is_commented:
                line = line.lstrip('#').strip()
            
            match = self.ENV_PATTERN.match(line)
            if match:
                is_export = bool(match.group(1))
                var_name = match.group(2)
                var_value = match.group(3)
                
                var_value = self._unquote_value(var_value)
                
                source_level = self._determine_level()
                
                var_def = VariableDef(
                    name=var_name,
                    value=var_value,
                    source_type=SourceType.ENV,
                    source_level=source_level,
                    file_path=self.file_path,
                    line_number=line_num,
                    raw_line=raw_line.rstrip('\n'),
                    is_commented=is_commented,
                    is_export=is_export,
                )
                self.variables.append(var_def)
            elif not is_commented and self._looks_like_var_def(line):
                self.bad_lines.append(BadLine(
                    file_path=self.file_path,
                    line_number=line_num,
                    raw_line=raw_line.rstrip('\n'),
                    reason="Invalid variable name or format",
                ))
        
        return self.variables
    
    def _unquote_value(self, value: str) -> str:
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or \
           (value.startswith("'") and value.endswith("'")):
            return value[1:-1]
        return value
    
    def _determine_level(self) -> SourceLevel:
        filename = Path(self.file_path).name
        if filename == '.env.local':
            return SourceLevel.ENV_LOCAL
        elif filename.startswith('.env.'):
            return SourceLevel.ENV_GLOBAL
        return SourceLevel.ENV_GLOBAL


class ShellParser(BaseParser):
    EXPORT_PATTERN = re.compile(
        r'^\s*(export\s+)*'
        r'([a-zA-Z_][a-zA-Z0-9_]*)'
        r'\s*=\s*'
        r'(.*?)\s*$'
    )
    
    def parse(self) -> List[VariableDef]:
        self.variables = []
        self.bad_lines = []
        lines = self._read_file()
        
        for line_num, raw_line in enumerate(lines, start=1):
            line = raw_line.rstrip('\n')
            is_commented = line.strip().startswith('#')
            
            if is_commented:
                line = line.lstrip('#').strip()
            
            match = self.EXPORT_PATTERN.match(line)
            if match:
                is_export = bool(match.group(1))
                var_name = match.group(2)
                var_value = match.group(3)
                
                var_value = self._unquote_value(var_value)
                
                var_def = VariableDef(
                    name=var_name,
                    value=var_value,
                    source_type=SourceType.SHELL,
                    source_level=SourceLevel.SHELL,
                    file_path=self.file_path,
                    line_number=line_num,
                    raw_line=raw_line.rstrip('\n'),
                    is_commented=is_commented,
                    is_export=is_export,
                )
                self.variables.append(var_def)
            elif not is_commented and self._looks_like_var_def(line):
                self.bad_lines.append(BadLine(
                    file_path=self.file_path,
                    line_number=line_num,
                    raw_line=raw_line.rstrip('\n'),
                    reason="Invalid variable name or format",
                ))
        
        return self.variables
    
    def _unquote_value(self, value: str) -> str:
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or \
           (value.startswith("'") and value.endswith("'")):
            return value[1:-1]
        return value


class ComposeParser(BaseParser):
    def parse(self) -> List[VariableDef]:
        self.variables = []
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            lines = content.split('\n')
            self._parse_yaml_with_line_numbers(content, lines)
        except yaml.YAMLError as e:
            self.errors.append(f"YAML parse error in {self.file_path}: {str(e)}")
        except Exception as e:
            self.errors.append(f"Failed to parse {self.file_path}: {str(e)}")
        
        return self.variables
    
    def _parse_yaml_with_line_numbers(self, content: str, lines: List[str]) -> None:
        try:
            data = yaml.safe_load(content)
        except:
            return
        
        if not isinstance(data, dict):
            return
        
        services = data.get('services', {})
        
        for service_name, service_config in services.items():
            if not isinstance(service_config, dict):
                continue
            
            environment = service_config.get('environment')
            if environment:
                self._parse_environment_section(environment, lines, service_name)
            
            env_file = service_config.get('env_file')
            if env_file:
                pass
    
    def _parse_environment_section(self, environment, lines: List[str], service_name: str):
        if isinstance(environment, dict):
            self._parse_dict_environment(environment, lines, service_name)
        elif isinstance(environment, list):
            self._parse_list_environment(environment, lines, service_name)
    
    def _parse_dict_environment(self, env_dict: dict, lines: List[str], service_name: str):
        for var_name, var_value in env_dict.items():
            if var_value is None:
                var_value = ''
            
            line_num = self._find_var_line_number(var_name, lines)
            raw_line = lines[line_num - 1].rstrip('\n') if line_num else ''
            
            var_def = VariableDef(
                name=var_name,
                value=str(var_value),
                source_type=SourceType.COMPOSE,
                source_level=SourceLevel.COMPOSE,
                file_path=self.file_path,
                line_number=line_num or 0,
                raw_line=raw_line,
                is_commented=False,
                is_export=False,
            )
            self.variables.append(var_def)
    
    def _parse_list_environment(self, env_list: list, lines: List[str], service_name: str):
        for idx, item in enumerate(env_list):
            if not isinstance(item, str):
                continue
            
            if '=' in item:
                var_name, var_value = item.split('=', 1)
                var_name = var_name.strip()
                var_value = var_value.strip()
                
                var_value = self._unquote_value(var_value)
                
                line_num = self._find_var_line_number(var_name, lines)
                raw_line = lines[line_num - 1].rstrip('\n') if line_num else ''
                
                var_def = VariableDef(
                    name=var_name,
                    value=var_value,
                    source_type=SourceType.COMPOSE,
                    source_level=SourceLevel.COMPOSE,
                    file_path=self.file_path,
                    line_number=line_num or 0,
                    raw_line=raw_line,
                    is_commented=False,
                    is_export=False,
                )
                self.variables.append(var_def)
    
    def _unquote_value(self, value: str) -> str:
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or \
           (value.startswith("'") and value.endswith("'")):
            return value[1:-1]
        return value
    
    def _find_var_line_number(self, var_name: str, lines: List[str]) -> Optional[int]:
        for line_num, line in enumerate(lines, start=1):
            if var_name in line:
                return line_num
        return None


def get_parser_for_file(file_path: str) -> Optional[BaseParser]:
    path = Path(file_path)
    filename = path.name.lower()
    
    if filename.startswith('.env'):
        return EnvParser(file_path)
    elif filename.endswith('.sh'):
        return ShellParser(file_path)
    elif 'docker-compose' in filename and filename.endswith(('.yml', '.yaml')):
        return ComposeParser(file_path)
    
    return None
