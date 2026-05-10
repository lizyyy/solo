from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional
from enum import Enum

class PortStatus(Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    CONFLICT = "conflict"
    INVALID = "invalid"
    UNKNOWN_PROCESS = "unknown_process"

@dataclass
class PortConfig:
    port: int
    source: str
    service: str
    raw_value: str
    status: PortStatus = PortStatus.AVAILABLE
    process_name: Optional[str] = None
    process_id: Optional[int] = None
    error: Optional[str] = None

@dataclass
class Project:
    name: str
    path: str
    ports: List[PortConfig] = field(default_factory=list)
    config_files: List[str] = field(default_factory=list)
    last_scanned: Optional[datetime] = None
    last_checked: Optional[datetime] = None

    def has_conflicts(self) -> bool:
        return any(p.status == PortStatus.CONFLICT for p in self.ports)

    def has_invalid(self) -> bool:
        return any(p.status == PortStatus.INVALID for p in self.ports)

    def get_occupied_ports(self) -> List[PortConfig]:
        return [p for p in self.ports if p.status == PortStatus.OCCUPIED]

    def get_available_ports(self) -> List[PortConfig]:
        return [p for p in self.ports if p.status == PortStatus.AVAILABLE]

@dataclass
class ScanResult:
    projects: Dict[str, Project] = field(default_factory=dict)
    scanned_at: Optional[datetime] = None
    checked_at: Optional[datetime] = None

    def get_all_ports(self) -> List[PortConfig]:
        all_ports = []
        for project in self.projects.values():
            all_ports.extend(project.ports)
        return all_ports

    def find_port_conflicts(self) -> Dict[int, List[PortConfig]]:
        port_map: Dict[int, List[PortConfig]] = {}
        for port_config in self.get_all_ports():
            if port_config.status == PortStatus.INVALID:
                continue
            if port_config.port not in port_map:
                port_map[port_config.port] = []
            port_map[port_config.port].append(port_config)
        return {port: configs for port, configs in port_map.items() if len(configs) > 1}
