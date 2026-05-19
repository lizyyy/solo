import os
import re
from typing import Dict, Optional, List, Tuple
from pathlib import Path

from .models import ServiceInfo, PortMapping


class EnvExpander:
    VAR_PATTERN = re.compile(r'\$(\w+)|\$\{(\w+)(?::-[^}]*)?\}')

    def __init__(self):
        self.env_file_cache: Dict[str, Dict[str, str]] = {}

    def load_env_file(self, env_file_path: str) -> Dict[str, str]:
        if env_file_path in self.env_file_cache:
            return self.env_file_cache[env_file_path]

        env_vars = {}
        try:
            path = Path(env_file_path)
            if path.exists():
                with open(path, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith('#'):
                            continue
                        if '=' in line:
                            key, value = line.split('=', 1)
                            key = key.strip()
                            value = value.strip().strip('\'"')
                            env_vars[key] = value
        except Exception:
            pass

        self.env_file_cache[env_file_path] = env_vars
        return env_vars

    def find_env_files(self, compose_file_path: str) -> List[str]:
        compose_dir = Path(compose_file_path).parent
        env_files = []

        default_env = compose_dir / '.env'
        if default_env.exists():
            env_files.append(str(default_env))

        return env_files

    def expand_variables(self, value: str, context: Dict[str, str]) -> Tuple[str, List[str]]:
        if not isinstance(value, str):
            return str(value), []

        warnings = []
        result = value

        pattern = re.compile(r'\$\{(\w+)(?::-(.*?))?\}|\$(\w+)')

        def replace_var(match):
            nonlocal warnings
            if match.group(3):
                var_name = match.group(3)
                default = ''
            else:
                var_name = match.group(1)
                default = match.group(2) or ''

            if var_name in context:
                return context[var_name]
            if var_name in os.environ:
                return os.environ[var_name]
            return default

        result = pattern.sub(replace_var, result)
        return result, warnings

    def expand_service_environment(self, service: ServiceInfo, context: Dict[str, str]) -> Tuple[Dict[str, str], List[str]]:
        expanded = {}
        all_warnings = []

        for key, value in service.environment.items():
            expanded_value, warnings = self.expand_variables(value, context)
            expanded[key] = expanded_value
            all_warnings.extend(warnings)

        return expanded, all_warnings

    def expand_port_mapping(self, port: PortMapping, context: Dict[str, str]) -> Tuple[Optional[PortMapping], List[str]]:
        warnings = []

        host_port_str = str(port.host_port)
        container_port_str = str(port.container_port)

        expanded_host, warnings1 = self.expand_variables(host_port_str, context)
        expanded_container, warnings2 = self.expand_variables(container_port_str, context)

        warnings.extend(warnings1)
        warnings.extend(warnings2)

        try:
            host_port = int(expanded_host) if expanded_host else None
            container_port = int(expanded_container) if expanded_container else None

            if host_port is None or container_port is None:
                return None, warnings

            return PortMapping(
                host_port=host_port,
                container_port=container_port,
                protocol=port.protocol,
                host_ip=port.host_ip
            ), warnings
        except ValueError:
            warnings.append(f"无效的端口值: {expanded_host}:{expanded_container}")
            return None, warnings

    def expand_service_ports(self, service: ServiceInfo, context: Dict[str, str]) -> Tuple[List[PortMapping], List[str]]:
        expanded_ports = []
        all_warnings = []

        for port in service.ports:
            expanded_port, warnings = self.expand_port_mapping(port, context)
            all_warnings.extend(warnings)
            if expanded_port:
                expanded_ports.append(expanded_port)

        return expanded_ports, all_warnings

    def expand_dict_port(self, port_dict: dict, context: Dict[str, str]) -> Tuple[Optional[PortMapping], List[str]]:
        warnings = []

        target = port_dict.get('target')
        published = port_dict.get('published', target)
        protocol = port_dict.get('protocol', 'tcp')
        host_ip = port_dict.get('host_ip', '0.0.0.0')

        if isinstance(target, str):
            expanded_target, tw = self.expand_variables(target, context)
            warnings.extend(tw)
            try:
                target = int(expanded_target) if expanded_target else None
            except ValueError:
                warnings.append(f"无效的target端口值: {expanded_target}")
                target = None

        if isinstance(published, str):
            expanded_published, pw = self.expand_variables(published, context)
            warnings.extend(pw)
            try:
                published = int(expanded_published) if expanded_published else None
            except ValueError:
                warnings.append(f"无效的published端口值: {expanded_published}")
                published = None

        if isinstance(host_ip, str):
            host_ip, _ = self.expand_variables(host_ip, context)

        if target is None or published is None:
            return None, warnings

        return PortMapping(
            host_port=int(published),
            container_port=int(target),
            protocol=protocol,
            host_ip=host_ip
        ), warnings

    def expand_all_services(self, services: List[ServiceInfo], extra_env: Optional[Dict[str, str]] = None) -> Tuple[List[ServiceInfo], List[str]]:
        expanded_services = []
        all_warnings = []

        if extra_env is None:
            extra_env = {}

        for service in services:
            context = {}
            context.update(os.environ)
            context.update(extra_env)

            env_files = self.find_env_files(service.compose_file)
            for env_file in env_files:
                env_vars = self.load_env_file(env_file)
                context.update(env_vars)

            expanded_env, env_warnings = self.expand_service_environment(service, context)
            all_warnings.extend(env_warnings)

            context.update(expanded_env)

            expanded_ports = []
            raw_ports = service.raw_config.get('ports', [])
            for raw_port in raw_ports:
                if isinstance(raw_port, str):
                    expanded_port_str, warnings = self.expand_variables(raw_port, context)
                    all_warnings.extend(warnings)

                    from .parser import ComposeParser
                    parser = ComposeParser()
                    port_mapping = parser._parse_single_port(expanded_port_str)
                    if port_mapping:
                        expanded_ports.append(port_mapping)
                elif isinstance(raw_port, int):
                    expanded_ports.append(PortMapping(
                        host_port=raw_port,
                        container_port=raw_port
                    ))
                elif isinstance(raw_port, dict):
                    port_mapping, warnings = self.expand_dict_port(raw_port, context)
                    all_warnings.extend(warnings)
                    if port_mapping:
                        expanded_ports.append(port_mapping)

            expanded_service = ServiceInfo(
                name=service.name,
                compose_file=service.compose_file,
                ports=expanded_ports,
                environment=expanded_env,
                raw_config=service.raw_config
            )
            expanded_services.append(expanded_service)

        return expanded_services, all_warnings
