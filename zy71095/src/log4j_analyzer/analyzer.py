from pathlib import Path
from typing import List, Optional

from .constants import CONFIG_SOURCE_PRIORITY, ExitCode
from .environment import EnvironmentProcessor
from .matcher import find_matching_rules
from .models import (
    AnalysisResult,
    ChainLink,
    ConfigSource,
    LoggerRule,
    PackageResolution,
)
from .parser import Log4jParser


class Log4jChainAnalyzer:
    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = base_dir or Path.cwd()
        self.parser = Log4jParser(self.base_dir)
        self.env_processor = EnvironmentProcessor()
        self.cli_overrides: List[LoggerRule] = []

    def add_config_file(self, file_path: Path) -> None:
        self.parser.parse_file(file_path)

    def add_env_file(self, file_path: Path) -> None:
        self.env_processor.load_env_file(file_path)

    def add_cli_override(self, package: str, level: str) -> None:
        source = ConfigSource(
            source_type="cli_override",
            path="CLI",
            priority=CONFIG_SOURCE_PRIORITY["cli_override"]
        )
        rule = LoggerRule(
            package_pattern=package,
            level=level.upper(),
            source=source,
            is_wildcard='*' in package or '?' in package
        )
        self.cli_overrides.append(rule)

    def load_system_env(self, prefix: str = "LOG4J_") -> None:
        self.env_processor.load_system_env(prefix)

    def analyze(self, packages: List[str]) -> AnalysisResult:
        result = AnalysisResult()
        result.config_files = self.parser.config_files
        result.env_files = self.env_processor.env_files
        result.environment_vars = self.env_processor.env_vars

        all_rules = self._collect_all_rules()

        result.root_logger = self._get_effective_root_logger(all_rules)
        result.loggers = {r.package_pattern: r for r in all_rules}
        result.appenders = self.parser.appenders
        result.errors = self.parser.errors + self.env_processor.errors
        result.warnings = self.parser.warnings + self.env_processor.warnings

        for package in packages:
            resolution = self._resolve_package(package, result.root_logger, all_rules)
            result.resolutions[package] = resolution

        if result.errors:
            result.exit_code = ExitCode.PARSE_ERROR
        else:
            result.exit_code = ExitCode.SUCCESS

        return result

    def _collect_all_rules(self) -> List[LoggerRule]:
        all_rules = list(self.parser.loggers.values())
        env_rules = self.env_processor.extract_logger_overrides()
        all_rules.extend(env_rules)
        all_rules.extend(self.cli_overrides)
        return all_rules

    def _get_effective_root_logger(self, all_rules: List[LoggerRule]) -> Optional[LoggerRule]:
        cli_root = next((r for r in self.cli_overrides if r.package_pattern == "root"), None)
        if cli_root:
            return cli_root
        
        env_rules = self.env_processor.extract_logger_overrides()
        env_root = next((r for r in env_rules if r.package_pattern == "root"), None)
        if env_root:
            return env_root
        
        return self.parser.root_logger

    def _resolve_package(self, package: str, 
                         root_logger: Optional[LoggerRule],
                         all_rules: List[LoggerRule]) -> PackageResolution:
        matches = find_matching_rules(package, all_rules)
        
        chain: List[ChainLink] = []
        current_level = root_logger.level if root_logger else "INFO"
        matched_patterns = []

        for rule, score in matches:
            matched_patterns.append(rule.package_pattern)
            reason = self._explain_override(rule, score)
            chain.append(ChainLink(
                rule=rule,
                previous_level=current_level,
                reason=reason
            ))
            current_level = rule.level

        if matches:
            final_level = matches[0][0].level
        elif root_logger:
            final_level = root_logger.level
            chain.append(ChainLink(
                rule=root_logger,
                previous_level=None,
                reason="使用 root logger 配置作为默认值"
            ))
        else:
            final_level = "INFO"

        return PackageResolution(
            package_name=package,
            final_level=final_level,
            chain=chain,
            matched_patterns=matched_patterns
        )

    def _explain_override(self, rule: LoggerRule, score: int) -> str:
        source_explain = {
            "file": "配置文件",
            "included_file": "Include 文件",
            "env_file": "环境文件",
            "env_var": "系统环境变量",
            "cli_override": "命令行参数",
        }.get(rule.source.source_type, rule.source.source_type)

        return f"优先级 {score} - 来自 {source_explain}: {rule.source.path}"
