import yaml
from dataclasses import dataclass
from typing import List, Dict, Any, Optional


@dataclass
class Zone:
    zone_id: str
    zone_name: str
    device_ids: List[str]
    allowed_roles: List[str]
    time_windows: List[Dict[str, str]]
    mutex_zones: List[str]


@dataclass
class Device:
    device_id: str
    device_name: str
    location: str
    hmac_key: str
    clock_drift_threshold_seconds: int


@dataclass
class ZoneRules:
    zones: Dict[str, Zone]
    devices: Dict[str, Device]
    zone_to_devices: Dict[str, List[str]]


def parse_zone_rules_yaml(file_path: str) -> ZoneRules:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    zones_dict = {}
    devices_dict = {}
    zone_to_devices = {}
    
    for zone_data in data.get('zones', []):
        zone = Zone(
            zone_id=zone_data['zone_id'],
            zone_name=zone_data['zone_name'],
            device_ids=zone_data.get('device_ids', []),
            allowed_roles=zone_data.get('allowed_roles', []),
            time_windows=zone_data.get('time_windows', []),
            mutex_zones=zone_data.get('mutex_zones', [])
        )
        zones_dict[zone.zone_id] = zone
        zone_to_devices[zone.zone_id] = zone.device_ids
    
    for device_data in data.get('devices', []):
        device = Device(
            device_id=device_data['device_id'],
            device_name=device_data['device_name'],
            location=device_data['location'],
            hmac_key=device_data['hmac_key'],
            clock_drift_threshold_seconds=device_data.get('clock_drift_threshold_seconds', 300)
        )
        devices_dict[device.device_id] = device
    
    return ZoneRules(
        zones=zones_dict,
        devices=devices_dict,
        zone_to_devices=zone_to_devices
    )
