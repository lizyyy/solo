import json
import random
import time
from typing import Any, Dict, List, Optional


class DeviceOfflineError(Exception):
    pass


class ReadOnlyRegisterError(Exception):
    pass


class TypeMismatchError(Exception):
    pass


class MockSerialAdapter:
    def __init__(self, device_id: str, registers_path: Optional[str] = None, offline: bool = False):
        self.device_id = device_id
        self.offline = offline
        self._registers: Dict[int, Dict[str, Any]] = {}
        if registers_path:
            self._load_registers(registers_path)
        else:
            self._init_default_registers()

    def _load_registers(self, path: str):
        with open(path, 'r') as f:
            data = json.load(f)
        for reg in data.get('registers', []):
            self._registers[reg['address']] = reg

    def _init_default_registers(self):
        defaults = [
            {"address": 0x00, "name": "DEVICE_ID", "type": "string", "value": "GW-001", "readonly": True},
            {"address": 0x01, "name": "FW_VERSION", "type": "string", "value": "1.2.3", "readonly": True},
            {"address": 0x10, "name": "SENSOR_INTERVAL", "type": "int", "value": 5000, "readonly": False},
            {"address": 0x11, "name": "SENSOR_ENABLED", "type": "bool", "value": True, "readonly": False},
            {"address": 0x12, "name": "THRESHOLD_TEMP", "type": "float", "value": 25.5, "readonly": False},
            {"address": 0x13, "name": "THRESHOLD_HUM", "type": "float", "value": 70.0, "readonly": False},
            {"address": 0x20, "name": "UART_BAUD", "type": "int", "value": 115200, "readonly": False},
            {"address": 0x21, "name": "UART_BITS", "type": "int", "value": 8, "readonly": False},
            {"address": 0x30, "name": "LED_MODE", "type": "int", "value": 1, "readonly": False},
            {"address": 0x31, "name": "BUZZER_ENABLED", "type": "bool", "value": False, "readonly": False},
        ]
        for reg in defaults:
            self._registers[reg['address']] = reg

    def _check_offline(self):
        if self.offline:
            raise DeviceOfflineError(f"Device {self.device_id} is offline")

    def _validate_type(self, reg: Dict[str, Any], value: Any) -> bool:
        expected_type = reg['type']
        if expected_type == 'int':
            return isinstance(value, int) and not isinstance(value, bool)
        elif expected_type == 'float':
            return isinstance(value, (int, float)) and not isinstance(value, bool)
        elif expected_type == 'bool':
            return isinstance(value, bool)
        elif expected_type == 'string':
            return isinstance(value, str)
        return False

    def read_register(self, address: int) -> Dict[str, Any]:
        self._check_offline()
        if address not in self._registers:
            raise ValueError(f"Register at address 0x{address:02X} not found")
        reg = self._registers[address]
        return {"address": reg['address'], "name": reg['name'], "type": reg['type'],
                "value": reg['value'], "readonly": reg['readonly']}

    def read_all_registers(self) -> List[Dict[str, Any]]:
        self._check_offline()
        return [self.read_register(addr) for addr in sorted(self._registers.keys())]

    def write_register(self, address: int, value: Any) -> bool:
        self._check_offline()
        if address not in self._registers:
            raise ValueError(f"Register at address 0x{address:02X} not found")
        reg = self._registers[address]
        if reg['readonly']:
            raise ReadOnlyRegisterError(f"Register {reg['name']} at 0x{address:02X} is read-only")
        if not self._validate_type(reg, value):
            raise TypeMismatchError(f"Type mismatch for {reg['name']}: expected {reg['type']}, got {type(value).__name__}")
        self._registers[address]['value'] = value
        return True

    def batch_write(self, writes: List[Dict[str, Any]], retry: int = 3, backoff: float = 0.5) -> Dict[str, Any]:
        results = {"success": [], "failed": [], "skipped": []}
        for w in writes:
            addr = w['address']
            val = w['value']
            attempts = 0
            while attempts <= retry:
                try:
                    if addr not in self._registers:
                        results['failed'].append({"address": addr, "error": "Register not found"})
                        break
                    reg = self._registers[addr]
                    if reg['readonly']:
                        results['skipped'].append({"address": addr, "reason": "read-only"})
                        break
                    if not self._validate_type(reg, val):
                        results['skipped'].append({"address": addr, "reason": "type mismatch"})
                        break
                    self._registers[addr]['value'] = val
                    results['success'].append(addr)
                    break
                except DeviceOfflineError:
                    attempts += 1
                    if attempts > retry:
                        results['failed'].append({"address": addr, "error": "device offline after retries"})
                    else:
                        time.sleep(backoff * attempts)
        return results

    def get_snapshot(self) -> Dict[str, Any]:
        return {
            "device_id": self.device_id,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "registers": self.read_all_registers()
        }

    def restore_snapshot(self, snapshot: Dict[str, Any]):
        for reg in snapshot.get('registers', []):
            addr = reg['address']
            if addr in self._registers and not self._registers[addr]['readonly']:
                self._registers[addr]['value'] = reg['value']

    def set_offline(self, offline: bool):
        self.offline = offline

    def reset_to_defaults(self):
        self._init_default_registers()