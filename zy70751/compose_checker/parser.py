import os
import re
import yaml
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

from .models import ServiceInfo, PortMapping


class ComposeParser:
    def __init__(self):
        self.supported_versions = ["3", "3.0", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9"]

    def parse_compose_file(self, file_path: str) -> Tuple[List[ServiceInfo], List[str], List[str]]:
        services = []
        errors = []
        warnings = []

        try:
            path = Path(file_path)
            if not path.exists():
                errors.append(f"文件不存在: {file_path}")
                return services, errors, warnings

            with open(path, 'r', encoding='utf-8') as f:
                try:
                    content = yaml.safe_load(f)
                except yaml.YAMLError as e:
                    errors.append(f"YAML解析错误: {file_path} - {str(e)}")
                    return services, errors, warnings

            if not isinstance(content, dict):
                errors.append(f"无效的Compose文件格式: {file_path}")
                return services, errors, warnings

            version = content.get("version")
            if version:
                version_str = str(version)
                if not any(version_str.startswith(v) for v in self.supported_versions):
                    warnings.append(f"Compose版本 '{version}'可能不完全兼容")

            services_config = content.get("services", {})
            if not services_config:
                warnings.append(f"未找到服务定义: {file_path}")

            for service_name, service_config in services_config.items():
                if not isinstance(service_config, dict):
                    warnings.append(f"服务 '{service_name}' 配置格式无效")
                    continue

                service = ServiceInfo(
                    name=service_name,
                    compose_file=str(path.absolute()),
                    raw_config=service_config
                )

                service.ports = self._parse_ports(service_config.get("ports", []), service_name)

                service.environment = self._parse_environment(service_config.get("environment", {}))

                services.append(service)

        except Exception as e:
            errors.append(f"解析文件时发生错误: {file_path} - {str(e)}")

        return services, errors, warnings

    def _parse_ports(self, ports_config: List[Any], service_name: str) -> List[PortMapping]:
        ports = []
        for port_entry in ports_config:
            try:
                port_mapping = self._parse_single_port(port_entry)
                if port_mapping:
                    ports.append(port_mapping)
            except Exception as e:
                continue
        return ports

    def _parse_single_port(self, port_entry: Any) -> Optional[PortMapping]:
        if isinstance(port_entry, int):
            return PortMapping(
                host_port=port_entry,
                container_port=port_entry
            )

        if isinstance(port_entry, str):
            return self._parse_port_string(port_entry)

        if isinstance(port_entry, dict):
            return self._parse_port_dict(port_entry)

        return None

    def _safe_int(self, value: str) -> int:
        try:
            return int(value)
        except ValueError:
            return -1

    def _parse_port_string(self, port_str: str) -> Optional[PortMapping]:
        protocol = "tcp"
        if "/" in port_str:
            port_str, protocol = port_str.rsplit("/", 1)

        host_ip = "0.0.0.0"
        parts = port_str.split(":")

        if len(parts) == 1:
            port = parts[0]
            host_port = self._safe_int(port)
            return PortMapping(
                host_port=host_port,
                container_port=host_port,
                protocol=protocol,
                host_ip=host_ip
            )

        if len(parts) == 2:
            if "." in parts[0]:
                host_ip = parts[0]
                port = parts[1]
                host_port = self._safe_int(port)
                return PortMapping(
                    host_port=host_port,
                    container_port=host_port,
                    protocol=protocol,
                    host_ip=host_ip
                )
            else:
                host_port = self._safe_int(parts[0])
                container_port = self._safe_int(parts[1])
                return PortMapping(
                    host_port=host_port,
                    container_port=container_port,
                    protocol=protocol,
                    host_ip=host_ip
                )

        if len(parts) == 3:
            host_ip = parts[0]
            host_port = self._safe_int(parts[1])
            container_port = self._safe_int(parts[2])
            return PortMapping(
                host_port=host_port,
                container_port=container_port,
                protocol=protocol,
                host_ip=host_ip
            )

        return None

    def _parse_port_dict(self, port_dict: Dict[str, Any]) -> Optional[PortMapping]:
        try:
            target = port_dict.get("target")
            published = port_dict.get("published")
            protocol = port_dict.get("protocol", "tcp")
            host_ip = port_dict.get("host_ip", "0.0.0.0")

            if published is None:
                published = target

            if target is None:
                return None

            return PortMapping(
                host_port=int(published),
                container_port=int(target),
                protocol=protocol,
                host_ip=host_ip
            )
        except (ValueError, TypeError):
            return None

    def _parse_environment(self, env_config: Any) -> Dict[str, str]:
        env_vars = {}

        if isinstance(env_config, dict):
            for key, value in env_config.items():
                if value is None:
                    env_vars[str(key)] = ""
                else:
                    env_vars[str(key)] = str(value)

        elif isinstance(env_config, list):
            for item in env_config:
                if isinstance(item, str):
                    if "=" in item:
                        key, value = item.split("=", 1)
                        env_vars[key] = value
                    else:
                        env_vars[item] = os.environ.get(item, "")

        return env_vars

    def parse_multiple_files(self, file_paths: List[str]) -> Tuple[List[ServiceInfo], List[str], List[str]]:
        all_services = []
        all_errors = []
        all_warnings = []

        for file_path in file_paths:
            services, errors, warnings = self.parse_compose_file(file_path)
            all_services.extend(services)
            all_errors.extend(errors)
            all_warnings.extend(warnings)

        return all_services, all_errors, all_warnings
