import re
import json
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List, Optional, Pattern
from meeting_screen_inspector.models.models import (
    BluetoothDevice,
    BluetoothSnapshot,
)


class BluetoothParser:
    BT_ADDR_PATTERN = re.compile(
        r'([0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2})'
    )
    
    NAME_PATTERNS: List[Pattern] = [
        re.compile(r'(?:name|Name|NAME)[:=]\s*["\']?([^"\'\s,]+)'),
        re.compile(r'(?:device|Device|DEVICE)[:=]\s*["\']?([^"\'\s,]+)'),
    ]
    
    RSSI_PATTERNS: List[Pattern] = [
        re.compile(r'(?:rssi|RSSI|signal)[:=]\s*(-?\d+)'),
        re.compile(r'(-?\d+)\s*dBm'),
    ]

    def __init__(self):
        pass

    def parse_file(self, file_path: Path) -> BluetoothSnapshot:
        if file_path.suffix == '.json':
            return self._parse_json_file(file_path)
        else:
            return self._parse_text_file(file_path)

    def _parse_json_file(self, file_path: Path) -> BluetoothSnapshot:
        content = file_path.read_text(encoding='utf-8', errors='ignore')
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            return self._parse_text_file(file_path)
        
        devices: List[BluetoothDevice] = []
        
        if isinstance(data, list):
            for item in data:
                device = self._parse_json_device(item)
                if device:
                    devices.append(device)
        elif isinstance(data, dict):
            if 'devices' in data:
                for item in data.get('devices', []):
                    device = self._parse_json_device(item)
                    if device:
                        devices.append(device)
            else:
                device = self._parse_json_device(data)
                if device:
                    devices.append(device)
        
        return BluetoothSnapshot(
            timestamp=datetime.now(),
            devices=devices,
            raw_data=content,
        )

    def _parse_json_device(self, data: Dict[str, Any]) -> Optional[BluetoothDevice]:
        addr = None
        
        for key in ['address', 'mac', 'mac_address', 'bt_addr', 'id']:
            if key in data:
                value = data[key]
                if self.BT_ADDR_PATTERN.match(str(value)):
                    addr = str(value).upper().replace('-', ':')
                    break
        
        if not addr:
            return None
        
        name = None
        for key in ['name', 'device_name', 'local_name']:
            if key in data:
                name = str(data[key])
                break
        
        rssi = None
        for key in ['rssi', 'signal_strength', 'signal']:
            if key in data:
                try:
                    rssi = int(data[key])
                    break
                except (ValueError, TypeError):
                    pass
        
        service_data = None
        for key in ['service_data', 'serviceData', 'data']:
            if key in data:
                service_data = json.dumps(data[key], ensure_ascii=False)
                break
        
        manufacturer_data = None
        for key in ['manufacturer_data', 'manufacturerData', 'manu_data']:
            if key in data:
                manufacturer_data = json.dumps(data[key], ensure_ascii=False)
                break
        
        return BluetoothDevice(
            address=addr,
            name=name,
            rssi=rssi,
            service_data=service_data,
            manufacturer_data=manufacturer_data,
        )

    def _parse_text_file(self, file_path: Path) -> BluetoothSnapshot:
        content = file_path.read_text(encoding='utf-8', errors='ignore')
        return self.parse_content(content)

    def parse_content(self, content: str) -> BluetoothSnapshot:
        lines = content.splitlines()
        devices: List[BluetoothDevice] = []
        current_device: Optional[Dict[str, Any]] = None
        
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            
            addr_match = self.BT_ADDR_PATTERN.search(stripped)
            if addr_match:
                if current_device and 'address' in current_device:
                    devices.append(self._dict_to_device(current_device))
                
                addr = addr_match.group(1).upper().replace('-', ':')
                current_device = {'address': addr}
                
                remaining = stripped[addr_match.end():].strip()
                if remaining:
                    name = self._extract_name(remaining)
                    if name:
                        current_device['name'] = name
                    rssi = self._extract_rssi(remaining)
                    if rssi:
                        current_device['rssi'] = rssi
            
            elif current_device:
                name = self._extract_name(stripped)
                if name and 'name' not in current_device:
                    current_device['name'] = name
                
                rssi = self._extract_rssi(stripped)
                if rssi and 'rssi' not in current_device:
                    current_device['rssi'] = rssi
        
        if current_device and 'address' in current_device:
            devices.append(self._dict_to_device(current_device))
        
        return BluetoothSnapshot(
            timestamp=datetime.now(),
            devices=devices,
            raw_data=content,
        )

    def _extract_name(self, text: str) -> Optional[str]:
        for pattern in self.NAME_PATTERNS:
            match = pattern.search(text)
            if match:
                return match.group(1)
        
        parts = text.split()
        if len(parts) > 0:
            potential = parts[0]
            if not self.BT_ADDR_PATTERN.match(potential) and not potential.lstrip('-').isdigit():
                return potential
        
        return None

    def _extract_rssi(self, text: str) -> Optional[int]:
        for pattern in self.RSSI_PATTERNS:
            match = pattern.search(text)
            if match:
                try:
                    return int(match.group(1))
                except ValueError:
                    pass
        return None

    def _dict_to_device(self, data: Dict[str, Any]) -> BluetoothDevice:
        return BluetoothDevice(
            address=data.get('address', ''),
            name=data.get('name'),
            rssi=data.get('rssi'),
            service_data=data.get('service_data'),
            manufacturer_data=data.get('manufacturer_data'),
        )
