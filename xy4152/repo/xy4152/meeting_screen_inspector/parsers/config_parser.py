import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from meeting_screen_inspector.models.models import DeviceConfig


class ConfigParser:
    NETWORK_KEYS = {'network', 'wifi', 'ethernet', 'ip', 'dns', 'gateway', 'netmask', 'dhcp', 'static_ip'}
    BLUETOOTH_KEYS = {'bluetooth', 'bt', 'ble', 'bluetooth_config', 'ble_config', 'mac_address', 'bt_mac'}
    
    VERSION_KEYS = {
        'version', 'ver', 'fw_version', 'firmware_version',
        'software_version', 'sw_version', 'app_version',
        '版本', '固件版本', '软件版本'
    }
    
    DEVICE_ID_KEYS = {
        'device_id', 'deviceid', 'id', 'sn', 'serial_number',
        'serial', 'mac', 'mac_address',
        '设备ID', '设备编号', '序列号'
    }

    def __init__(self):
        pass

    def parse_file(self, file_path: Path) -> DeviceConfig:
        content = file_path.read_text(encoding='utf-8', errors='ignore')
        return self.parse_content(content)

    def parse_content(self, content: str) -> DeviceConfig:
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            data = {}
        
        return self._parse_dict(data)

    def _parse_dict(self, data: Dict[str, Any]) -> DeviceConfig:
        version = self._extract_version(data)
        device_id = self._extract_device_id(data)
        network_config = self._extract_by_keys(data, self.NETWORK_KEYS)
        bluetooth_config = self._extract_by_keys(data, self.BLUETOOTH_KEYS)
        
        other_keys = set(data.keys()) - self.NETWORK_KEYS - self.BLUETOOTH_KEYS - self.VERSION_KEYS - self.DEVICE_ID_KEYS
        other_settings = {k: data[k] for k in other_keys if k in data}
        
        return DeviceConfig(
            raw_json=data,
            version=version,
            device_id=device_id,
            network_config=network_config,
            bluetooth_config=bluetooth_config,
            other_settings=other_settings,
        )

    def _extract_version(self, data: Dict[str, Any]) -> Optional[str]:
        for key in self.VERSION_KEYS:
            if key in data:
                value = data[key]
                if isinstance(value, str) and value.strip():
                    return value.strip()
                elif isinstance(value, (int, float)):
                    return str(value)
        
        for key, value in data.items():
            if isinstance(value, dict):
                nested_version = self._extract_version(value)
                if nested_version:
                    return nested_version
            elif 'version' in key.lower() or 'ver' in key.lower():
                if isinstance(value, str) and value.strip():
                    return value.strip()
        
        return None

    def _extract_device_id(self, data: Dict[str, Any]) -> Optional[str]:
        for key in self.DEVICE_ID_KEYS:
            if key in data:
                value = data[key]
                if isinstance(value, str) and value.strip():
                    return value.strip()
                elif isinstance(value, (int, float)):
                    return str(value)
        
        for key, value in data.items():
            if isinstance(value, dict):
                nested_id = self._extract_device_id(value)
                if nested_id:
                    return nested_id
            elif 'id' in key.lower() or 'sn' in key.lower() or 'serial' in key.lower():
                if isinstance(value, str) and value.strip():
                    return value.strip()
        
        return None

    def _extract_by_keys(self, data: Dict[str, Any], target_keys: Set[str]) -> Dict[str, Any]:
        result: Dict[str, Any] = {}
        
        for key in target_keys:
            if key in data:
                value = data[key]
                if isinstance(value, dict):
                    result.update(value)
                else:
                    result[key] = value
        
        for key, value in data.items():
            if isinstance(value, dict) and key not in target_keys:
                for tk in target_keys:
                    if tk in key.lower() or key.lower() in tk:
                        result.update(value)
                        break
        
        return result

    def get_missing_keys(self, config: DeviceConfig, required_keys: List[str]) -> List[str]:
        missing = []
        for key in required_keys:
            if key not in config.all_keys:
                nested_found = False
                for nested_key in config.raw_json:
                    value = config.raw_json[nested_key]
                    if isinstance(value, dict):
                        if key in value:
                            nested_found = True
                            break
                if not nested_found:
                    missing.append(key)
        return missing
