import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable, Tuple

import yaml

from .models import Project, PortConfig, PortStatus


def _parse_int(value: str) -> Tuple[Optional[int], Optional[str]]:
    value = value.strip()
    if not value:
        return None, "端口值为空"
    
    if ':' in value:
        value = value.split(':')[-1]
    
    try:
        port = int(value)
        if 1 <= port <= 65535:
            return port, None
        else:
            return None, f"端口 {value} 超出有效范围 (1-65535)"
    except ValueError:
        return None, f"端口格式错误: '{value}' 不是有效数字"


class BaseParser:
    def __init__(self, file_path: Path, project_name: str):
        self.file_path = file_path
        self.project_name = project_name
        self.source_name = file_path.name

    def parse(self) -> List[PortConfig]:
        raise NotImplementedError


class EnvParser(BaseParser):
    PORT_KEYS = [
        "PORT", "APP_PORT", "API_PORT", "SERVER_PORT", "HTTP_PORT", "HTTPS_PORT",
        "WEB_PORT", "LISTEN_PORT", "BIND_PORT", "HOST_PORT", "CONTAINER_PORT",
        "DB_PORT", "REDIS_PORT", "MYSQL_PORT", "PG_PORT", "POSTGRES_PORT",
        "MONGO_PORT", "ELASTIC_PORT", "KAFKA_PORT", "ZOO_PORT",
    ]

    def parse(self) -> List[PortConfig]:
        ports: List[PortConfig] = []
        try:
            content = self.file_path.read_text(encoding="utf-8")
        except (IOError, UnicodeDecodeError):
            return ports

        lines = content.splitlines()
        for line_no, line in enumerate(lines, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            if "=" not in line:
                continue

            key, _, value = line.partition("=")
            key = key.strip().upper()
            value = value.strip()

            if value.startswith('"') or value.startswith("'"):
                value = value[1:-1]

            if key in self.PORT_KEYS or "PORT" in key:
                port_int, error = _parse_int(value)
                status = PortStatus.AVAILABLE if port_int is not None else PortStatus.INVALID
                port = port_int if port_int is not None else 0

                ports.append(PortConfig(
                    port=port,
                    source=f"{self.source_name}:{line_no}",
                    service=key.lower(),
                    raw_value=value,
                    status=status,
                    error=error,
                ))

        return ports


class YamlParser(BaseParser):
    PORT_KEYS = ["port", "ports", "host_port", "container_port", "listen", "bind"]

    def parse(self) -> List[PortConfig]:
        ports: List[PortConfig] = []
        try:
            content = self.file_path.read_text(encoding="utf-8")
            data = yaml.safe_load(content)
        except (IOError, yaml.YAMLError, UnicodeDecodeError):
            return ports

        if not isinstance(data, dict):
            return ports

        self._extract_ports(data, ports, "root")
        return ports

    def _extract_ports(self, data: Any, ports: List[PortConfig], path: str, line_hint: int = 0) -> None:
        if isinstance(data, dict):
            for key, value in data.items():
                current_path = f"{path}.{key}"
                key_lower = key.lower()

                if key_lower == "ports" and isinstance(value, list):
                    for idx, item in enumerate(value):
                        port_str = str(item)
                        port_int, error = _parse_int(port_str.split(':')[-1])
                        status = PortStatus.AVAILABLE if port_int is not None else PortStatus.INVALID
                        port = port_int if port_int is not None else 0

                        ports.append(PortConfig(
                            port=port,
                            source=f"{self.source_name}",
                            service=f"{current_path}[{idx}]",
                            raw_value=port_str,
                            status=status,
                            error=error,
                        ))
                elif key_lower == "port" or (isinstance(value, (str, int)) and "port" in key_lower):
                    port_str = str(value)
                    port_int, error = _parse_int(port_str)
                    status = PortStatus.AVAILABLE if port_int is not None else PortStatus.INVALID
                    port = port_int if port_int is not None else 0

                    ports.append(PortConfig(
                        port=port,
                        source=f"{self.source_name}",
                        service=current_path,
                        raw_value=port_str,
                        status=status,
                        error=error,
                    ))
                else:
                    self._extract_ports(value, ports, current_path, line_hint)

        elif isinstance(data, list):
            for idx, item in enumerate(data):
                self._extract_ports(item, ports, f"{path}[{idx}]", line_hint)


class JsonParser(BaseParser):
    PORT_KEYS = ["port", "serverPort", "listenPort", "hostPort"]

    def parse(self) -> List[PortConfig]:
        ports: List[PortConfig] = []
        try:
            content = self.file_path.read_text(encoding="utf-8")
            data = json.loads(content)
        except (IOError, json.JSONDecodeError, UnicodeDecodeError):
            return ports

        if not isinstance(data, dict):
            return ports

        self._extract_ports(data, ports, "root")
        return ports

    def _extract_ports(self, data: Any, ports: List[PortConfig], path: str) -> None:
        if isinstance(data, dict):
            for key, value in data.items():
                current_path = f"{path}.{key}"
                key_lower = key.lower()

                if key_lower == "port" or "port" in key_lower:
                    if isinstance(value, (str, int)):
                        port_str = str(value)
                        port_int, error = _parse_int(port_str)
                        status = PortStatus.AVAILABLE if port_int is not None else PortStatus.INVALID
                        port = port_int if port_int is not None else 0

                        ports.append(PortConfig(
                            port=port,
                            source=f"{self.source_name}",
                            service=current_path,
                            raw_value=port_str,
                            status=status,
                            error=error,
                        ))
                elif isinstance(value, dict) or isinstance(value, list):
                    self._extract_ports(value, ports, current_path)

        elif isinstance(data, list):
            for idx, item in enumerate(data):
                self._extract_ports(item, ports, f"{path}[{idx}]")


class PackageJsonParser(JsonParser):
    def parse(self) -> List[PortConfig]:
        ports = super().parse()
        
        try:
            content = self.file_path.read_text(encoding="utf-8")
            data = json.loads(content)
        except (IOError, json.JSONDecodeError, UnicodeDecodeError):
            return ports

        scripts = data.get("scripts", {}) if isinstance(data, dict) else {}
        if not isinstance(scripts, dict):
            return ports

        port_pattern = re.compile(r'(--port\s*|--p\s*|-p\s*|:)(\d{1,5})')
        
        for script_name, command in scripts.items():
            if not isinstance(command, str):
                continue
            matches = port_pattern.findall(command)
            for match in matches:
                port_str = match[1]
                port_int, error = _parse_int(port_str)
                status = PortStatus.AVAILABLE if port_int is not None else PortStatus.INVALID
                port = port_int if port_int is not None else 0

                ports.append(PortConfig(
                    port=port,
                    source=f"{self.source_name}:scripts.{script_name}",
                    service=f"script:{script_name}",
                    raw_value=port_str,
                    status=status,
                    error=error,
                ))

        return ports


class Scanner:
    PARSER_MAPPING: Dict[str, Callable[[Path, str], BaseParser]] = {
        ".env": EnvParser,
        ".env.local": EnvParser,
        ".env.development": EnvParser,
        ".env.test": EnvParser,
        "env": EnvParser,
        ".yaml": YamlParser,
        ".yml": YamlParser,
        ".json": JsonParser,
        "package.json": PackageJsonParser,
        "docker-compose.yml": YamlParser,
        "docker-compose.yaml": YamlParser,
    }

    COMMON_CONFIG_FILES = [
        ".env", ".env.local", ".env.development", ".env.test",
        "package.json",
        "config.json", "appconfig.json", "settings.json",
        "config.yaml", "config.yml",
        "docker-compose.yml", "docker-compose.yaml",
    ]

    def __init__(self, workspace_path: str):
        self.workspace_path = Path(workspace_path).resolve()

    def scan(self) -> List[Project]:
        projects: List[Project] = []

        for item in self.workspace_path.iterdir():
            if item.is_dir() and not item.name.startswith("."):
                project = self._scan_project(item)
                if project and project.ports:
                    projects.append(project)

        return projects

    def _scan_project(self, project_path: Path) -> Optional[Project]:
        project_name = project_path.name
        project = Project(name=project_name, path=str(project_path))

        for config_name in self.COMMON_CONFIG_FILES:
            config_path = project_path / config_name
            if config_path.exists() and config_path.is_file():
                parser = self._get_parser(config_path, project_name)
                if parser:
                    ports = parser.parse()
                    if ports:
                        project.ports.extend(ports)
                        project.config_files.append(str(config_path))

        return project

    def _get_parser(self, file_path: Path, project_name: str) -> Optional[BaseParser]:
        name = file_path.name.lower()

        if name in self.PARSER_MAPPING:
            return self.PARSER_MAPPING[name](file_path, project_name)

        suffix = file_path.suffix.lower()
        if suffix in self.PARSER_MAPPING:
            return self.PARSER_MAPPING[suffix](file_path, project_name)

        return None
