import yaml
from typing import Any, Dict, List


class ConfigValidationError(Exception):
    pass


class YamlConfigParser:
    VALID_TYPES = ('int', 'float', 'bool', 'string')

    def __init__(self, yaml_path: str = None):
        self.yaml_path = yaml_path
        self._config: Dict[str, Any] = {}

    def load(self, yaml_path: str) -> Dict[str, Any]:
        try:
            with open(yaml_path, 'r', encoding='utf-8') as f:
                self._config = yaml.safe_load(f)
            return self._config
        except FileNotFoundError:
            raise ConfigValidationError(f"YAML file not found: {yaml_path}")
        except yaml.YAMLError as e:
            raise ConfigValidationError(f"Failed to parse YAML: {e}")

    def validate(self, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        registers = []
        device_id = config.get('device_id', 'UNKNOWN')
        device_name = config.get('name', device_id)
        regs = config.get('registers', [])

        if not isinstance(regs, list):
            raise ConfigValidationError("'registers' must be a list")

        for idx, reg in enumerate(regs):
            try:
                validated = self._validate_register(reg, idx)
                registers.append(validated)
            except ConfigValidationError as e:
                raise ConfigValidationError(f"Register[{idx}]: {e}")

        return registers

    def _validate_register(self, reg: Dict[str, Any], idx: int) -> Dict[str, Any]:
        if 'address' not in reg:
            raise ConfigValidationError("missing 'address'")
        if 'name' not in reg:
            raise ConfigValidationError("missing 'name'")
        if 'type' not in reg:
            raise ConfigValidationError("missing 'type'")
        if 'value' not in reg:
            raise ConfigValidationError("missing 'value'")

        addr = reg['address']
        if not isinstance(addr, int) or addr < 0 or addr > 0xFF:
            raise ConfigValidationError(f"invalid address: must be 0x00-0xFF")

        name = str(reg['name']).strip()
        if not name:
            raise ConfigValidationError("name cannot be empty")

        reg_type = reg['type']
        if reg_type not in self.VALID_TYPES:
            raise ConfigValidationError(f"invalid type: must be one of {self.VALID_TYPES}")

        value = reg['value']
        if reg_type == 'int':
            if not isinstance(value, int) or isinstance(value, bool):
                raise ConfigValidationError(f"value must be int for type 'int'")
        elif reg_type == 'float':
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                raise ConfigValidationError(f"value must be float for type 'float'")
        elif reg_type == 'bool':
            if not isinstance(value, bool):
                raise ConfigValidationError(f"value must be bool for type 'bool'")
        elif reg_type == 'string':
            if not isinstance(value, str):
                raise ConfigValidationError(f"value must be str for type 'string'")

        readonly = bool(reg.get('readonly', False))

        return {
            "address": addr,
            "name": name,
            "type": reg_type,
            "value": value,
            "readonly": readonly
        }

    def parse(self, yaml_path: str = None) -> Dict[str, Any]:
        path = yaml_path or self.yaml_path
        if not path:
            raise ConfigValidationError("No YAML path provided")
        raw = self.load(path)
        registers = self.validate(raw)
        return {
            "device_id": raw.get('device_id', 'UNKNOWN'),
            "name": raw.get('name', raw.get('device_id', 'UNKNOWN')),
            "description": raw.get('description', ''),
            "registers": registers,
            "raw_yaml": raw
        }