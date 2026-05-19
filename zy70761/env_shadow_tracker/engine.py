import os
from pathlib import Path
from typing import List, Dict, Optional, Set

from .models import VariableDef, VariableChain, ShadowReport, SourceType, SourceLevel, BadLineInfo
from .parser import get_parser_for_file, BaseParser, BadLine


class OverrideEngine:
    def __init__(self, scan_path: str, file_patterns: Optional[List[str]] = None):
        self.scan_path = str(Path(scan_path).resolve())
        self.file_patterns = file_patterns or ['.env*', '*.sh', 'docker-compose*.yml', 'docker-compose*.yaml']
        self.all_definitions: List[VariableDef] = []
        self._default_definitions: List[VariableDef] = []
        self._system_definitions: List[VariableDef] = []
        self.parsed_files: Set[str] = set()
        self.parse_errors: List[str] = []
        self.bad_lines: List[BadLine] = []
    
    def scan(self, variable_filter: Optional[List[str]] = None) -> ShadowReport:
        self._find_and_parse_files()
        self.all_definitions.extend(self._default_definitions)
        self.all_definitions.extend(self._system_definitions)
        self._build_variable_chains(variable_filter)
        
        bad_line_infos = [
            BadLineInfo(
                file_path=bl.file_path,
                line_number=bl.line_number,
                raw_line=bl.raw_line,
                reason=bl.reason,
            )
            for bl in self.bad_lines
        ]
        
        report = ShadowReport(
            scan_path=self.scan_path,
            total_files=len(self.parsed_files),
            total_variables=len(self.variable_chains),
            variables_with_overrides=sum(1 for c in self.variable_chains.values() if c.override_chain),
            missing_variables=sum(1 for c in self.variable_chains.values() if c.is_missing),
            bad_lines_count=len(bad_line_infos),
            variable_chains=self.variable_chains,
            parse_errors=self.parse_errors,
            bad_lines=bad_line_infos,
        )
        
        return report
    
    def _find_and_parse_files(self) -> None:
        self.all_definitions = []
        self.parsed_files = set()
        self.parse_errors = []
        self.bad_lines = []
        
        base_path = Path(self.scan_path)
        
        if base_path.is_file():
            self._parse_file(str(base_path))
            return
        
        for pattern in self.file_patterns:
            for file_path in base_path.rglob(pattern):
                if file_path.is_file():
                    self._parse_file(str(file_path))
    
    def _parse_file(self, file_path: str) -> None:
        if file_path in self.parsed_files:
            return
        
        parser = get_parser_for_file(file_path)
        if parser:
            try:
                variables = parser.parse()
                self.all_definitions.extend(variables)
                self.parsed_files.add(file_path)
                self.parse_errors.extend(parser.errors)
                if hasattr(parser, 'bad_lines'):
                    self.bad_lines.extend(parser.bad_lines)
            except Exception as e:
                self.parse_errors.append(f"Error parsing {file_path}: {str(e)}")
    
    def _build_variable_chains(self, variable_filter: Optional[List[str]] = None) -> None:
        self.variable_chains: Dict[str, VariableChain] = {}
        
        if variable_filter:
            for var_name in sorted(variable_filter):
                if var_name not in self.variable_chains:
                    self.variable_chains[var_name] = VariableChain(name=var_name)
        
        for var_def in self.all_definitions:
            if variable_filter and var_def.name not in variable_filter:
                continue
            
            if var_def.name not in self.variable_chains:
                self.variable_chains[var_def.name] = VariableChain(name=var_def.name)
            
            self.variable_chains[var_def.name].definitions.append(var_def)
        
        for var_name, chain in sorted(self.variable_chains.items()):
            chain.build_override_chain()
    
    def add_defaults(self, defaults: Dict[str, str]) -> None:
        for var_name, var_value in sorted(defaults.items()):
            var_def = VariableDef(
                name=var_name,
                value=var_value,
                source_type=SourceType.DEFAULT,
                source_level=SourceLevel.DEFAULT,
                file_path='<default>',
                line_number=0,
                raw_line=f'{var_name}={var_value}',
                is_commented=False,
                is_export=False,
            )
            self._default_definitions.append(var_def)
    
    def add_system_env(self, include_patterns: Optional[List[str]] = None) -> None:
        for var_name, var_value in sorted(os.environ.items()):
            if include_patterns:
                if not any(pattern in var_name for pattern in include_patterns):
                    continue
            
            var_def = VariableDef(
                name=var_name,
                value=var_value,
                source_type=SourceType.SYSTEM,
                source_level=SourceLevel.SYSTEM,
                file_path='<system>',
                line_number=0,
                raw_line=f'{var_name}=...',
                is_commented=False,
                is_export=True,
            )
            self._system_definitions.append(var_def)
