from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Type

from ..parsers.base import ConfigParser, ParsedConfig, ConfigType
from ..parsers import JsonParser, EnvParser, YamlParser, SqliteParser
from ..security import SecurityAnalyzer, SecurityResult
from .priority import PriorityAnalyzer, PriorityResult
from .migration import MigrationAnalyzer, MigrationResult
from .defaults import DefaultsAnalyzer, DefaultsResult


@dataclass
class AnalysisResult:
    project_path: str
    parsed_configs: List[ParsedConfig] = field(default_factory=list)
    priority_result: Optional[PriorityResult] = None
    security_result: Optional[SecurityResult] = None
    defaults_result: Optional[DefaultsResult] = None
    migration_result: Optional[MigrationResult] = None
    summary: Dict[str, Any] = field(default_factory=dict)


class ConfigAnalyzer:
    PARSERS: List[Type[ConfigParser]] = [
        JsonParser,
        EnvParser,
        YamlParser,
        SqliteParser,
    ]
    
    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self._parsers: List[ConfigParser] = [P() for P in self.PARSERS]
        self._parsed_configs: List[ParsedConfig] = []
    
    def scan_project(self) -> List[ParsedConfig]:
        self._parsed_configs = []
        
        config_files = self._find_config_files()
        
        for file_path in config_files:
            for parser in self._parsers:
                if parser.can_parse(file_path):
                    parsed = parser.parse(file_path)
                    self._parsed_configs.append(parsed)
                    break
        
        return self._parsed_configs
    
    def _find_config_files(self) -> List[Path]:
        config_files: List[Path] = []
        
        patterns = [
            "**/settings.json",
            "**/settings.local.json",
            "**/config.json",
            "**/.env",
            "**/.env.*",
            "**/config.yaml",
            "**/config.yml",
            "**/settings.yaml",
            "**/settings.yml",
            "**/*.db",
            "**/*.sqlite",
            "**/*.sqlite3",
        ]
        
        for pattern in patterns:
            try:
                matches = list(self.project_path.glob(pattern))
                for match in matches:
                    if match.is_file() and not self._is_ignored(match):
                        config_files.append(match)
            except Exception:
                continue
        
        unique_files = []
        seen = set()
        for f in config_files:
            if str(f) not in seen:
                seen.add(str(f))
                unique_files.append(f)
        
        return unique_files
    
    def _is_ignored(self, path: Path) -> bool:
        ignored_patterns = [
            "__pycache__",
            "node_modules",
            ".git",
            ".venv",
            "venv",
            "env",
            "dist",
            "build",
            ".next",
            ".nuxt",
        ]
        
        path_str = str(path)
        for pattern in ignored_patterns:
            if f"/{pattern}/" in path_str or f"\\{pattern}\\" in path_str:
                return True
        
        return False
    
    def analyze_all(self) -> AnalysisResult:
        if not self._parsed_configs:
            self.scan_project()
        
        result = AnalysisResult(
            project_path=str(self.project_path),
            parsed_configs=self._parsed_configs,
        )
        
        if self._parsed_configs:
            result.priority_result = self._analyze_priority()
            result.security_result = self._analyze_security()
            result.defaults_result = self._analyze_defaults()
        
        result.summary = self._generate_summary(result)
        
        return result
    
    def _analyze_priority(self) -> PriorityResult:
        analyzer = PriorityAnalyzer()
        for config in self._parsed_configs:
            analyzer.add_config(config)
        return analyzer.analyze()
    
    def _analyze_security(self) -> SecurityResult:
        analyzer = SecurityAnalyzer()
        for config in self._parsed_configs:
            analyzer.add_config(config)
        return analyzer.analyze()
    
    def _analyze_defaults(self) -> DefaultsResult:
        analyzer = DefaultsAnalyzer()
        for config in self._parsed_configs:
            analyzer.add_config(config)
        return analyzer.analyze()
    
    def analyze_migration(
        self,
        versions: List[List[ParsedConfig]]
    ) -> MigrationResult:
        analyzer = MigrationAnalyzer()
        
        for i, version_configs in enumerate(versions):
            for config in version_configs:
                analyzer.add_version(config, f"v{i + 1}")
        
        return analyzer.analyze()
    
    def _generate_summary(self, result: AnalysisResult) -> Dict[str, Any]:
        summary = {
            "project_path": str(self.project_path),
            "configs_found": len(self._parsed_configs),
            "config_types": {},
            "total_keys": 0,
            "issues": {
                "security": 0,
                "priority_conflicts": 0,
                "missing_defaults": 0,
            },
        }
        
        for config in self._parsed_configs:
            config_type = config.config_type.value
            if config_type not in summary["config_types"]:
                summary["config_types"][config_type] = 0
            summary["config_types"][config_type] += 1
            summary["total_keys"] += len(config.values)
        
        if result.security_result:
            summary["issues"]["security"] = len(result.security_result.findings)
        
        if result.priority_result:
            summary["issues"]["priority_conflicts"] = result.priority_result.overridden_keys
        
        if result.defaults_result:
            summary["issues"]["missing_defaults"] = result.defaults_result.missing_no_default
        
        return summary
    
    def get_effective_config(self) -> Dict[str, Any]:
        from .priority import PriorityAnalyzer
        
        analyzer = PriorityAnalyzer()
        for config in self._parsed_configs:
            analyzer.add_config(config)
        
        return analyzer.get_effective_config()
    
    def diff(
        self,
        other_project: str,
        include_values: bool = True
    ) -> Dict[str, Any]:
        other_analyzer = ConfigAnalyzer(other_project)
        other_analyzer.scan_project()
        
        self_effective = self.get_effective_config()
        other_effective = other_analyzer.get_effective_config()
        
        self_keys = set(self_effective.keys())
        other_keys = set(other_effective.keys())
        
        added = other_keys - self_keys
        removed = self_keys - other_keys
        common = self_keys & other_keys
        
        modified = []
        for key in common:
            if self_effective[key] != other_effective[key]:
                modified.append({
                    "key": key,
                    "old_value": self_effective[key],
                    "new_value": other_effective[key],
                })
        
        return {
            "left_project": str(self.project_path),
            "right_project": other_project,
            "added_keys": list(added) if include_values else len(added),
            "removed_keys": list(removed) if include_values else len(removed),
            "modified_keys": modified if include_values else len(modified),
            "summary": {
                "added": len(added),
                "removed": len(removed),
                "modified": len(modified),
            },
        }
