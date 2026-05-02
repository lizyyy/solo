from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class DeviceType(Enum):
    SERVER = "server"
    SWITCH = "switch"
    ROUTER = "router"
    STORAGE = "storage"


class ChangeType(Enum):
    ADD = "add"
    REMOVE = "remove"
    MOVE = "move"


class PowerPhase(Enum):
    A = "A"
    B = "B"


@dataclass
class PDUCircuit:
    circuit_id: str
    pdu_id: str
    phase: PowerPhase
    max_amps: float
    used_amps: float = 0.0

    @property
    def available_amps(self) -> float:
        return self.max_amps - self.used_amps


@dataclass
class PDU:
    pdu_id: str
    rack_id: str
    circuits: list[PDUCircuit] = field(default_factory=list)


@dataclass
class SwitchPort:
    port_id: str
    switch_id: str
    port_name: str
    vlan: str
    status: str = "free"
    connected_device_id: Optional[str] = None


@dataclass
class Device:
    device_id: str
    name: str
    device_type: DeviceType
    rack_id: str
    u_start: int
    u_end: int
    power_circuits: list[str] = field(default_factory=list)
    primary_switch_port: Optional[str] = None
    secondary_switch_port: Optional[str] = None
    status: str = "online"


@dataclass
class Rack:
    rack_id: str
    name: str
    total_u: int = 48
    devices: list[Device] = field(default_factory=list)


@dataclass
class ChangeStep:
    step_id: str
    change_type: ChangeType
    device_id: str
    target_rack_id: Optional[str] = None
    target_u_start: Optional[int] = None
    target_u_end: Optional[int] = None
    target_switch_port: Optional[str] = None
    target_vlan: Optional[str] = None
    notes: str = ""


@dataclass
class ChangePlan:
    plan_id: str
    description: str
    steps: list[ChangeStep] = field(default_factory=list)


@dataclass
class ValidationIssue:
    severity: str
    issue_type: str
    description: str
    device_id: Optional[str] = None
    location: Optional[str] = None
    details: dict = field(default_factory=dict)


@dataclass
class SimulationResult:
    success: bool
    issues: list[ValidationIssue] = field(default_factory=list)
    executed_steps: list[ChangeStep] = field(default_factory=list)
    state_snapshot: dict = field(default_factory=dict)


@dataclass
class RollbackSuggestion:
    step_id: str
    action: str
    target_device_id: str
    description: str
