import configparser
import os
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from xml.etree import ElementTree as ET

from .constants import CONFIG_SOURCE_PRIORITY, LOG_LEVELS
from .models import AppenderConfig, ConfigSource, LoggerRule


class Log4jParser:
    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = base_dir or Path.cwd()
        self.processed_files: Set[Path] = set()
        self.loggers: Dict[str, LoggerRule] = {}
        self.appenders: Dict[str, AppenderConfig] = {}
        self.root_logger: Optional[LoggerRule] = None
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.config_files: List[Path] = []

    def parse_file(self, file_path: Path, source_type: str = "file",
                   priority_offset: int = 0, error_prefix: str = "PARSE_ERROR") -> None:
        file_path = self.base_dir / file_path
        file_path = file_path.resolve()

        if file_path in self.processed_files:
            return
        self.processed_files.add(file_path)
        self.config_files.append(file_path)

        if not file_path.exists():
            self.errors.append(f"{error_prefix}: 配置文件不存在: {file_path}")
            return

        suffix = file_path.suffix.lower()
        if suffix in ('.xml', '.XML'):
            self._parse_xml(file_path, source_type, priority_offset)
        elif suffix in ('.properties', '.props'):
            self._parse_properties(file_path, source_type, priority_offset)
        else:
            self.warnings.append(f"PARSE_WARNING: 未知的配置文件格式: {file_path.suffix}")

    def _parse_xml(self, file_path: Path, source_type: str, priority_offset: int) -> None:
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
            self._process_includes(root, file_path, source_type, priority_offset)
            self._parse_xml_loggers(root, file_path, source_type, priority_offset)
            self._parse_xml_appenders(root, file_path, source_type, priority_offset)
        except ET.ParseError as e:
            self.errors.append(f"PARSE_ERROR: XML 解析错误 {file_path}: {e}")
        except Exception as e:
            self.errors.append(f"PARSE_ERROR: 处理 XML 文件时出错 {file_path}: {e}")

    def _process_includes(self, root: ET.Element, file_path: Path,
                          source_type: str, priority_offset: int) -> None:
        ns = ''
        if root.tag.startswith('{'):
            ns = root.tag.split('}')[0] + '}'

        include_tags = [
            f'{ns}include',
            f'{ns}Include',
            f'{ns}iNCLUDE',
            '{http://logging.apache.org/log4j/}include',
            '{http://logging.apache.org/log4j/}Include',
            '{http://jakarta.apache.org/log4j/}include',
            '{http://jakarta.apache.org/log4j/}Include',
        ]

        for tag in include_tags:
            for include in root.findall(f'.//{tag}'):
                href = include.get('href') or include.get('file') or include.get('path')
                if href:
                    include_path = Path(href)
                    if not include_path.is_absolute():
                        include_path = file_path.parent / include_path
                    try:
                        self.parse_file(
                            include_path,
                            source_type="included_file",
                            priority_offset=CONFIG_SOURCE_PRIORITY["included_file"] - CONFIG_SOURCE_PRIORITY["file"],
                            error_prefix="INCLUDE_ERROR"
                        )
                    except Exception as e:
                        self.errors.append(f"INCLUDE_ERROR: 处理 include 文件失败 {include_path}: {e}")

    def _parse_xml_loggers(self, root: ET.Element, file_path: Path,
                           source_type: str, priority_offset: int) -> None:
        ns = ''
        if root.tag.startswith('{'):
            ns = root.tag.split('}')[0] + '}'

        for logger_elem in root.findall(f'.//{ns}logger') + root.findall(f'.//{ns}Logger'):
            name = logger_elem.get('name')
            if not name:
                continue
            level = logger_elem.get('level')
            if not level:
                level_elem = logger_elem.find(f'{ns}level') or logger_elem.find(f'{ns}Level')
                level = level_elem.get('value') if level_elem is not None else None
            if level:
                level_upper = level.upper()
                if level_upper in LOG_LEVELS:
                    source = ConfigSource(
                        source_type=source_type,
                        path=str(file_path),
                        priority=CONFIG_SOURCE_PRIORITY[source_type] + priority_offset
                    )
                    rule = LoggerRule(
                        package_pattern=name,
                        level=level_upper,
                        source=source,
                        is_wildcard='*' in name or '?' in name
                    )
                    self._merge_logger_rule(rule)
                else:
                    self.warnings.append(f"PARSE_WARNING: 文件 {file_path} 中包 '{name}' 的日志级别 '{level}' 无效，已忽略")

        root_elem = root.find(f'.//{ns}root') or root.find(f'.//{ns}Root')
        if root_elem is not None:
            level = root_elem.get('level')
            if not level:
                level_elem = root_elem.find(f'{ns}level') or root_elem.find(f'{ns}Level')
                level = level_elem.get('value') if level_elem is not None else "INFO"
            if level:
                level_upper = level.upper()
                if level_upper in LOG_LEVELS:
                    source = ConfigSource(
                        source_type=source_type,
                        path=str(file_path),
                        priority=CONFIG_SOURCE_PRIORITY[source_type] + priority_offset
                    )
                    self.root_logger = LoggerRule(
                        package_pattern="root",
                        level=level_upper,
                        source=source
                    )
                else:
                    self.warnings.append(f"PARSE_WARNING: 文件 {file_path} 中 root logger 的日志级别 '{level}' 无效，使用默认 INFO")

    def _parse_xml_appenders(self, root: ET.Element, file_path: Path,
                             source_type: str, priority_offset: int) -> None:
        ns = ''
        if root.tag.startswith('{'):
            ns = root.tag.split('}')[0] + '}'

        for appender_elem in root.findall(f'.//{ns}appender') + root.findall(f'.//{ns}Appender'):
            name = appender_elem.get('name')
            appender_type = appender_elem.get('class') or appender_elem.get('type')
            if not name:
                continue
            config = {}
            for param in appender_elem.findall(f'{ns}param'):
                pname = param.get('name')
                pvalue = param.get('value')
                if pname:
                    config[pname] = pvalue
            source = ConfigSource(
                source_type=source_type,
                path=str(file_path),
                priority=CONFIG_SOURCE_PRIORITY[source_type] + priority_offset
            )
            self._merge_appender(AppenderConfig(name, appender_type or "", config, source))

    def _parse_properties(self, file_path: Path, source_type: str,
                          priority_offset: int) -> None:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except Exception as e:
            self.errors.append(f"PARSE_ERROR: Properties 文件读取错误 {file_path}: {e}")
            return

        source = ConfigSource(
            source_type=source_type,
            path=str(file_path),
            priority=CONFIG_SOURCE_PRIORITY[source_type] + priority_offset
        )

        for line in lines:
            line = line.strip()
            if not line or line.startswith('#') or line.startswith('!'):
                continue
            
            if '=' not in line:
                continue
            
            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip()

            if key.lower() == 'log4j.rootlogger':
                parts = value.split(',')
                level = parts[0].strip().upper()
                if level in LOG_LEVELS:
                    self.root_logger = LoggerRule("root", level, source)
                else:
                    self.warnings.append(f"PARSE_WARNING: 文件 {file_path} 中 root logger 的日志级别 '{parts[0].strip()}' 无效，已忽略")
            
            elif key.lower().startswith('log4j.logger.'):
                pkg = key[len('log4j.logger.'):]
                parts = value.split(',')
                level = parts[0].strip().upper()
                if level in LOG_LEVELS:
                    rule = LoggerRule(
                        package_pattern=pkg,
                        level=level,
                        source=source,
                        is_wildcard='*' in pkg or '?' in pkg
                    )
                    self._merge_logger_rule(rule)
                else:
                    self.warnings.append(f"PARSE_WARNING: 文件 {file_path} 中包 '{pkg}' 的日志级别 '{parts[0].strip()}' 无效，已忽略")

    def _merge_logger_rule(self, new_rule: LoggerRule) -> None:
        existing = self.loggers.get(new_rule.package_pattern)
        if not existing or new_rule.source.priority >= existing.source.priority:
            self.loggers[new_rule.package_pattern] = new_rule

    def _merge_appender(self, new_appender: AppenderConfig) -> None:
        existing = self.appenders.get(new_appender.name)
        if not existing or new_appender.source.priority >= existing.source.priority:
            self.appenders[new_appender.name] = new_appender
