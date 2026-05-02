from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel, Field


class DeviceType(str, Enum):
    MEETING_SCREEN = "meeting_screen"
    CASTING_BOX = "casting_box"


class RiskLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RiskType(str, Enum):
    VERSION_DRIFT = "version_drift"
    REBOOT_LOOP = "reboot_loop"
    ADDRESS_DUPLICATE = "address_duplicate"
    CONFIG_MISSING = "config_missing"
    ROLLBACK_RISK = "rollback_risk"
    BAUDRATE_ERROR = "baudrate_error"


class BaudRateInfo(BaseModel):
    expected: int
    actual: int
    source: str


class SerialLogEntry(BaseModel):
    timestamp: Optional[str] = None
    level: Optional[str] = None
    module: Optional[str] = None
    message: str
    raw_line: str
    reboot_indicator: bool = False
    version_indicator: Optional[str] = None


class BluetoothDevice(BaseModel):
    address: str
    name: Optional[str] = None
    rssi: Optional[int] = None
    service_data: Optional[str] = None
    manufacturer_data: Optional[str] = None


class BluetoothSnapshot(BaseModel):
    timestamp: datetime
    devices: List[BluetoothDevice] = []
    raw_data: str = ""


class DeviceConfig(BaseModel):
    raw_json: Dict[str, Any]
    version: Optional[str] = None
    device_id: Optional[str] = None
    network_config: Dict[str, Any] = {}
    bluetooth_config: Dict[str, Any] = {}
    other_settings: Dict[str, Any] = {}
    
    @property
    def all_keys(self) -> Set[str]:
        keys = set(self.raw_json.keys())
        return keys


class DeviceIdentity(BaseModel):
    device_type: DeviceType
    device_id: str
    location: Optional[str] = None
    label: Optional[str] = None


class SerialPortInfo(BaseModel):
    baud_rate: int
    data_bits: int = 8
    parity: str = "N"
    stop_bits: int = 1
    detected_baud_rate: Optional[int] = None


class SerialLog(BaseModel):
    filename: str
    raw_content: str
    entries: List[SerialLogEntry] = []
    port_info: Optional[SerialPortInfo] = None
    detected_version: Optional[str] = None
    reboot_count: int = 0
    last_reboot_time: Optional[str] = None


class DeviceInspection(BaseModel):
    identity: DeviceIdentity
    serial_log: Optional[SerialLog] = None
    bluetooth_snapshot: Optional[BluetoothSnapshot] = None
    config: Optional[DeviceConfig] = None
    source_files: List[str] = []
    collected_at: datetime = Field(default_factory=datetime.now)


class Risk(BaseModel):
    risk_type: RiskType
    level: RiskLevel
    description: str
    device_id: str
    device_type: DeviceType
    location: Optional[str] = None
    details: Dict[str, Any] = {}
    suggestion: Optional[str] = None


class DeviceStatus(BaseModel):
    device_id: str
    device_type: DeviceType
    location: Optional[str] = None
    version: Optional[str] = None
    risks: List[Risk] = []
    confirmed: bool = False
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    notes: str = ""
    
    @property
    def has_critical_risk(self) -> bool:
        return any(r.level == RiskLevel.CRITICAL for r in self.risks)
    
    @property
    def risk_count(self) -> int:
        return len(self.risks)


class InspectionSession(BaseModel):
    session_id: str
    name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    devices: List[DeviceInspection] = []
    device_statuses: Dict[str, DeviceStatus] = {}
    summary: Dict[str, Any] = {}
    
    def get_all_versions(self) -> Dict[str, List[str]]:
        versions: Dict[str, List[str]] = {}
        for device in self.devices:
            ver = None
            if device.serial_log and device.serial_log.detected_version:
                ver = device.serial_log.detected_version
            elif device.config and device.config.version:
                ver = device.config.version
            
            if ver:
                dtype = device.identity.device_type.value
                if dtype not in versions:
                    versions[dtype] = []
                versions[dtype].append(ver)
        return versions
    
    def get_all_bluetooth_addresses(self) -> Dict[str, List[str]]:
        addresses: Dict[str, List[str]] = {}
        for device in self.devices:
            if device.bluetooth_snapshot:
                for bt_device in device.bluetooth_snapshot.devices:
                    addr = bt_device.address
                    if addr not in addresses:
                        addresses[addr] = []
                    addresses[addr].append(device.identity.device_id)
        return addresses
