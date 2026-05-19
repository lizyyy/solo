from typing import List, Dict, Tuple
from collections import defaultdict

from .models import (
    ServiceInfo, PortMapping, Conflict, ConflictType,
    ConflictSeverity, ConflictSource
)


class ConflictDetector:
    def __init__(self):
        pass

    def detect_all(self, services: List[ServiceInfo]) -> List[Conflict]:
        conflicts = []

        conflicts.extend(self.detect_port_conflicts(services))
        conflicts.extend(self.detect_service_name_conflicts(services))
        conflicts.extend(self.detect_env_var_conflicts(services))

        conflicts.sort(key=lambda c: c.priority, reverse=True)

        return conflicts

    def detect_port_conflicts(self, services: List[ServiceInfo]) -> List[Conflict]:
        conflicts = []

        port_map: Dict[Tuple[str, int, str], List[Tuple[ServiceInfo, PortMapping]]] = defaultdict(list)

        for service in services:
            for port in service.ports:
                key = (port.host_ip, port.host_port, port.protocol)
                port_map[key].append((service, port))

        for (host_ip, host_port, protocol), mappings in port_map.items():
            if len(mappings) > 1:
                sources = []
                for service, port in mappings:
                    sources.append(ConflictSource(
                        service_name=service.name,
                        compose_file=service.compose_file,
                        details=f"{host_ip}:{host_port}:{port.container_port}/{protocol}"
                    ))

                port_desc = f"{host_ip}:{host_port}/{protocol}"
                if host_ip == "0.0.0.0":
                    port_desc = f"*:{host_port}/{protocol}"

                conflict = Conflict(
                    conflict_type=ConflictType.PORT,
                    severity=ConflictSeverity.CRITICAL,
                    message=f"端口冲突: {port_desc} 被 {len(mappings)} 个服务占用",
                    sources=sources,
                    suggestion=self._get_port_suggestion(host_port, mappings),
                    priority=100
                )
                conflicts.append(conflict)

        return conflicts

    def detect_service_name_conflicts(self, services: List[ServiceInfo]) -> List[Conflict]:
        conflicts = []

        name_map: Dict[str, List[ServiceInfo]] = defaultdict(list)

        for service in services:
            name_map[service.name].append(service)

        for service_name, service_list in name_map.items():
            if len(service_list) > 1:
                sources = []
                for service in service_list:
                    sources.append(ConflictSource(
                        service_name=service.name,
                        compose_file=service.compose_file,
                        details=f"服务名: {service_name}"
                    ))

                conflict = Conflict(
                    conflict_type=ConflictType.SERVICE_NAME,
                    severity=ConflictSeverity.HIGH,
                    message=f"服务名冲突: '{service_name}' 在 {len(service_list)} 个文件中定义",
                    sources=sources,
                    suggestion=self._get_service_name_suggestion(service_name, service_list),
                    priority=80
                )
                conflicts.append(conflict)

        return conflicts

    def detect_env_var_conflicts(self, services: List[ServiceInfo]) -> List[Conflict]:
        conflicts = []

        var_map: Dict[str, Dict[str, List[Tuple[ServiceInfo, str]]]] = defaultdict(lambda: defaultdict(list))

        for service in services:
            for key, value in service.environment.items():
                var_map[key][value].append((service, value))

        for var_name, value_map in var_map.items():
            for value, service_entries in value_map.items():
                if len(service_entries) > 1:
                    sources = []
                    for service, val in service_entries:
                        sources.append(ConflictSource(
                            service_name=service.name,
                            compose_file=service.compose_file,
                            details=f"{var_name}={val}"
                        ))

                    display_value = value if value else "(空值)"
                    conflict = Conflict(
                        conflict_type=ConflictType.ENV_VAR,
                        severity=ConflictSeverity.MEDIUM,
                        message=f"环境变量潜在冲突: {var_name}={display_value} 在多个服务中使用相同值",
                        sources=sources,
                        suggestion=self._get_env_var_suggestion(var_name, value, service_entries),
                        priority=50
                    )
                    conflicts.append(conflict)

        return conflicts

    def _get_port_suggestion(self, port: int, mappings: List[Tuple[ServiceInfo, PortMapping]]) -> str:
        suggestions = []

        suggestions.append(f"方案1: 将其中一个服务的端口从 {port} 改为 {port + 1}")
        suggestions.append(f"方案2: 使用不同的 host_ip 绑定（如 127.0.0.1 vs 0.0.0.0）")
        suggestions.append("方案3: 检查是否需要同时启动这些冲突的服务")

        return " | ".join(suggestions)

    def _get_service_name_suggestion(self, name: str, services: List[ServiceInfo]) -> str:
        suggestions = []

        suggestions.append(f"方案1: 重命名其中一个服务，如 '{name}_v2' 或添加项目前缀")
        suggestions.append("方案2: 确认是否为重复定义，如果是则删除冗余文件")
        suggestions.append(f"方案3: 使用不同的Compose项目名来隔离")

        return " | ".join(suggestions)

    def _get_env_var_suggestion(self, var_name: str, value: str, entries: List[Tuple[ServiceInfo, str]]) -> str:
        suggestions = []

        if value:
            suggestions.append(f"方案1: 确认 {var_name}={value} 是否需要在所有服务中保持一致")
        else:
            suggestions.append(f"方案1: 检查 {var_name} 是否应该有具体值而不是空值")

        suggestions.append(f"方案2: 如果是数据库连接等关键配置，确保连接池足够")
        suggestions.append("方案3: 考虑使用外部配置中心统一管理")

        return " | ".join(suggestions)
