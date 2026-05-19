from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any
from pathlib import Path


class SourceType(Enum):
    ENV = "env"
    SHELL = "shell"
    COMPOSE = "compose"
    SYSTEM = "system"
    DEFAULT = "default"


class SourceLevel(Enum):
    LOWEST = 0
    DEFAULT = 10
    ENV_GLOBAL = 20
    ENV_LOCAL = 30
    SHELL = 40
    COMPOSE = 50
    SYSTEM = 60
    HIGHEST = 100


@dataclass
class VariableDef:
    name: str
    value: str
    source_type: SourceType
    source_level: SourceLevel
    file_path: str
    line_number: int
    raw_line: str
    is_commented: bool = False
    is_export: bool = False
    
    def __post_init__(self):
        if isinstance(self.source_type, str):
            self.source_type = SourceType(self.source_type)
        if isinstance(self.source_level, int):
            self.source_level = SourceLevel(self.source_level)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "value": self.value,
            "source_type": self.source_type.value,
            "source_level": self.source_level.value,
            "file_path": self.file_path,
            "line_number": self.line_number,
            "raw_line": self.raw_line,
            "is_commented": self.is_commented,
            "is_export": self.is_export,
        }


@dataclass
class OverrideRecord:
    variable_name: str
    old_value: str
    new_value: str
    old_source: VariableDef
    new_source: VariableDef
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "variable_name": self.variable_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "old_source": self.old_source.to_dict(),
            "new_source": self.new_source.to_dict(),
        }


@dataclass
class VariableChain:
    name: str
    definitions: List[VariableDef] = field(default_factory=list)
    override_chain: List[OverrideRecord] = field(default_factory=list)
    final_value: Optional[str] = None
    effective_source: Optional[VariableDef] = None
    is_missing: bool = False
    missing_hint: Optional[str] = None
    
    def sort_definitions(self) -> None:
        self.definitions.sort(key=lambda d: (d.source_level.value, d.file_path, d.line_number))
    
    def build_override_chain(self) -> None:
        self.sort_definitions()
        self.override_chain = []
        
        if not self.definitions:
            self.is_missing = True
            return
        
        active_defs = [d for d in self.definitions if not d.is_commented]
        if not active_defs:
            self.is_missing = True
            self.missing_hint = f"All {len(self.definitions)} definitions are commented out"
            return
        
        active_defs.sort(key=lambda d: (d.source_level.value, d.file_path, d.line_number))
        
        current = active_defs[0]
        self.final_value = current.value
        self.effective_source = current
        
        for next_def in active_defs[1:]:
            if next_def.value != current.value:
                record = OverrideRecord(
                    variable_name=self.name,
                    old_value=current.value,
                    new_value=next_def.value,
                    old_source=current,
                    new_source=next_def,
                )
                self.override_chain.append(record)
                current = next_def
                self.final_value = current.value
                self.effective_source = current


@dataclass
class BadLineInfo:
    file_path: str
    line_number: int
    raw_line: str
    reason: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "line_number": self.line_number,
            "raw_line": self.raw_line,
            "reason": self.reason,
        }


@dataclass
class ShadowReport:
    scan_path: str
    total_files: int
    total_variables: int
    variables_with_overrides: int
    missing_variables: int
    bad_lines_count: int
    variable_chains: Dict[str, VariableChain] = field(default_factory=dict)
    parse_errors: List[str] = field(default_factory=list)
    bad_lines: List[BadLineInfo] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "scan_path": self.scan_path,
            "total_files": self.total_files,
            "total_variables": self.total_variables,
            "variables_with_overrides": self.variables_with_overrides,
            "missing_variables": self.missing_variables,
            "bad_lines_count": self.bad_lines_count,
            "variable_chains": {
                name: {
                    "name": chain.name,
                    "final_value": chain.final_value,
                    "is_missing": chain.is_missing,
                    "missing_hint": chain.missing_hint,
                    "definitions": [d.to_dict() for d in chain.definitions],
                    "override_chain": [r.to_dict() for r in chain.override_chain],
                    "effective_source": chain.effective_source.to_dict() if chain.effective_source else None,
                }
                for name, chain in sorted(self.variable_chains.items())
            },
            "parse_errors": self.parse_errors,
            "bad_lines": [bl.to_dict() for bl in self.bad_lines],
        }
