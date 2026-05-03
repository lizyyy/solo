import json
import csv
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional


class InputParser:
    """输入文件解析器"""
    
    def __init__(self):
        self._parsed_data = {}
    
    def parse_all(self, feeder_path: str, settings_path: str, 
                  fault_cases_path: str, devices_path: str) -> Dict[str, Any]:
        """解析所有输入文件"""
        return {
            'feeder': self.parse_feeder_json(feeder_path),
            'settings': self.parse_settings_csv(settings_path),
            'fault_cases': self.parse_fault_cases_yaml(fault_cases_path),
            'devices': self.parse_devices_csv(devices_path)
        }
    
    def parse_feeder_json(self, path: str) -> Dict[str, Any]:
        """解析馈线拓扑 JSON 文件"""
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        self._validate_feeder_data(data)
        return data
    
    def _validate_feeder_data(self, data: Dict[str, Any]) -> None:
        """验证馈线数据结构"""
        required_keys = ['nodes', 'edges', 'root_node']
        for key in required_keys:
            if key not in data:
                raise ValueError(f"feeder.json 缺少必需字段: {key}")
        
        for node in data.get('nodes', []):
            if 'id' not in node:
                raise ValueError("节点缺少 id 字段")
        
        for edge in data.get('edges', []):
            if 'from' not in edge or 'to' not in edge:
                raise ValueError("边缺少 from 或 to 字段")
    
    def parse_settings_csv(self, path: str) -> List[Dict[str, Any]]:
        """解析保护定值 CSV 文件"""
        settings = []
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                setting = self._parse_setting_row(row)
                settings.append(setting)
        return settings
    
    def _parse_setting_row(self, row: Dict[str, str]) -> Dict[str, Any]:
        """解析单条定值记录"""
        return {
            'device_id': row.get('device_id', '').strip(),
            'device_name': row.get('device_name', '').strip(),
            'node_id': row.get('node_id', '').strip(),
            'protection_type': row.get('protection_type', '').strip(),
            'phase_oc1_current': self._safe_float(row.get('phase_oc1_current')),
            'phase_oc1_time': self._safe_float(row.get('phase_oc1_time')),
            'phase_oc2_current': self._safe_float(row.get('phase_oc2_current')),
            'phase_oc2_time': self._safe_float(row.get('phase_oc2_time')),
            'phase_oc3_current': self._safe_float(row.get('phase_oc3_current')),
            'phase_oc3_time': self._safe_float(row.get('phase_oc3_time')),
            'ground_oc1_current': self._safe_float(row.get('ground_oc1_current')),
            'ground_oc1_time': self._safe_float(row.get('ground_oc1_time')),
            'ground_oc2_current': self._safe_float(row.get('ground_oc2_current')),
            'ground_oc2_time': self._safe_float(row.get('ground_oc2_time')),
            'ct_ratio': self._safe_float(row.get('ct_ratio', '1')),
            'inverse_time_curve': row.get('inverse_time_curve', 'SI'),
            'inverse_time_alpha': self._safe_float(row.get('inverse_time_alpha', '0.14')),
            'inverse_time_p': self._safe_float(row.get('inverse_time_p', '0.02')),
            'notes': row.get('notes', '')
        }
    
    def _safe_float(self, value: Optional[str]) -> Optional[float]:
        """安全转换浮点数"""
        if value is None or value.strip() == '':
            return None
        try:
            return float(value.strip())
        except (ValueError, AttributeError):
            return None
    
    def parse_fault_cases_yaml(self, path: str) -> List[Dict[str, Any]]:
        """解析故障案例 YAML 文件"""
        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        if isinstance(data, dict) and 'cases' in data:
            return data['cases']
        elif isinstance(data, list):
            return data
        else:
            raise ValueError("fault_cases.yaml 格式不正确，应为包含 cases 列表")
    
    def parse_devices_csv(self, path: str) -> List[Dict[str, Any]]:
        """解析设备信息 CSV 文件"""
        devices = []
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                device = self._parse_device_row(row)
                devices.append(device)
        return devices
    
    def _parse_device_row(self, row: Dict[str, str]) -> Dict[str, Any]:
        """解析单条设备记录"""
        return {
            'device_id': row.get('device_id', '').strip(),
            'device_name': row.get('device_name', '').strip(),
            'node_id': row.get('node_id', '').strip(),
            'device_type': row.get('device_type', '').strip(),
            'manufacturer': row.get('manufacturer', '').strip(),
            'model': row.get('model', '').strip(),
            'rated_current': self._safe_float(row.get('rated_current')),
            'ct_ratio_primary': self._safe_float(row.get('ct_ratio_primary')),
            'ct_ratio_secondary': self._safe_float(row.get('ct_ratio_secondary', '5')),
            'installation_date': row.get('installation_date', ''),
            'location': row.get('location', ''),
            'notes': row.get('notes', '')
        }
    
    def get_settings_by_device(self, device_id: str) -> Optional[Dict[str, Any]]:
        """按设备 ID 获取定值"""
        for setting in self._parsed_data.get('settings', []):
            if setting.get('device_id') == device_id:
                return setting
        return None
    
    def get_device_info(self, device_id: str) -> Optional[Dict[str, Any]]:
        """按设备 ID 获取设备信息"""
        for device in self._parsed_data.get('devices', []):
            if device.get('device_id') == device_id:
                return device
        return None
