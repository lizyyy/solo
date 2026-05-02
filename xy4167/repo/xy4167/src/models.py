from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class FirmwareType(Enum):
    BOOTLOADER = "bootloader"
    APPLICATION = "application"
    FULL = "full"


class UpgradeDirection(Enum):
    UPGRADE = "upgrade"
    DOWNGRADE = "downgrade"
    ROLLBACK = "rollback"


class DeviceStatus(Enum):
    NORMAL = "normal"
    BRICKED = "bricked"
    NEEDS_RECOVERY = "needs_recovery"
    UNKNOWN = "unknown"


@dataclass
class Device:
    device_id: str
    serial_number: str = ""
    model: str = ""
    hardware_version: str = ""
    current_firmware_version: str = ""
    previous_firmware_version: Optional[str] = None
    status: DeviceStatus = DeviceStatus.UNKNOWN
    batch_id: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    upgrade_history: List['UpgradeAttempt'] = field(default_factory=list)
    
    def add_upgrade_attempt(self, attempt: 'UpgradeAttempt'):
        self.upgrade_history.append(attempt)
        if attempt.success:
            self.previous_firmware_version = self.current_firmware_version
            self.current_firmware_version = attempt.target_version
    
    def get_latest_attempt(self) -> Optional['UpgradeAttempt']:
        if not self.upgrade_history:
            return None
        return self.upgrade_history[-1]
    
    def get_failed_attempts(self) -> List['UpgradeAttempt']:
        return [a for a in self.upgrade_history if not a.success]
    
    def has_rollback_attempts(self) -> bool:
        return any(a.direction == UpgradeDirection.ROLLBACK for a in self.upgrade_history)


@dataclass
class FirmwareManifest:
    version: str
    firmware_type: FirmwareType
    file_path: str = ""
    file_name: str = ""
    file_size: int = 0
    crc32: str = ""
    md5: str = ""
    sha256: str = ""
    release_date: Optional[datetime] = None
    compatible_hardware: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    prerequisites: List[str] = field(default_factory=list)
    rollback_allowed: bool = True
    minimum_rollback_version: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    notes: str = ""
    
    def is_compatible_with(self, hardware_version: str) -> bool:
        if not self.compatible_hardware:
            return True
        return hardware_version in self.compatible_hardware
    
    def can_rollback_from(self, current_version: str) -> bool:
        if not self.rollback_allowed:
            return False
        if self.minimum_rollback_version is None:
            return True
        return self._compare_versions(current_version, self.minimum_rollback_version) >= 0
    
    def _compare_versions(self, v1: str, v2: str) -> int:
        parts1 = [int(p) for p in v1.split('.') if p.isdigit()]
        parts2 = [int(p) for p in v2.split('.') if p.isdigit()]
        
        for i in range(max(len(parts1), len(parts2))):
            p1 = parts1[i] if i < len(parts1) else 0
            p2 = parts2[i] if i < len(parts2) else 0
            if p1 > p2:
                return 1
            elif p1 < p2:
                return -1
        return 0


@dataclass
class BatchInfo:
    batch_id: str
    production_date: Optional[datetime] = None
    total_devices: int = 0
    devices: List[Device] = field(default_factory=list)
    target_firmware_version: str = ""
    actual_firmware_versions: Dict[str, int] = field(default_factory=dict)
    upgrade_status: Dict[str, int] = field(default_factory=dict)
    notes: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_device(self, device: Device):
        self.devices.append(device)
        self.total_devices = len(self.devices)
        
        if device.current_firmware_version:
            version = device.current_firmware_version
            self.actual_firmware_versions[version] = self.actual_firmware_versions.get(version, 0) + 1
        
        status = device.status.value
        self.upgrade_status[status] = self.upgrade_status.get(status, 0) + 1
    
    def get_devices_by_status(self, status: DeviceStatus) -> List[Device]:
        return [d for d in self.devices if d.status == status]
    
    def get_upgrade_success_rate(self) -> float:
        if not self.devices:
            return 0.0
        successful = len([d for d in self.devices if d.status == DeviceStatus.NORMAL])
        return successful / len(self.devices)
    
    def get_version_distribution(self) -> Dict[str, int]:
        return dict(self.actual_firmware_versions)


@dataclass
class UpgradeAttempt:
    attempt_id: str
    device_id: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    source_version: str = ""
    target_version: str = ""
    direction: UpgradeDirection = UpgradeDirection.UPGRADE
    success: bool = False
    failure_reason: str = ""
    crc_verified: bool = False
    retry_count: int = 0
    log_entries: List[Any] = field(default_factory=list)
    state_transitions: List['StateTransition'] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def get_duration(self) -> Optional[float]:
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return None
    
    def was_interrupted(self) -> bool:
        return self.start_time is not None and self.end_time is None
    
    def has_crc_issues(self) -> bool:
        return not self.crc_verified and not self.success


@dataclass
class StateTransition:
    from_state: str
    to_state: str
    timestamp: Optional[datetime] = None
    event: str = ""
    log_line_number: int = 0
    details: str = ""
