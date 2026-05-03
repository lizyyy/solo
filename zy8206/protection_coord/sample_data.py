import json
import csv
import yaml
from pathlib import Path
from typing import Dict, Any


class SampleDataGenerator:
    """示例数据生成器"""
    
    def __init__(self):
        pass
    
    def generate_all(self, output_dir: Path) -> Dict[str, Path]:
        """生成所有示例数据文件"""
        files = {}
        
        files['feeder'] = self.generate_feeder_json(output_dir)
        files['settings'] = self.generate_settings_csv(output_dir)
        files['fault_cases'] = self.generate_fault_cases_yaml(output_dir)
        files['devices'] = self.generate_devices_csv(output_dir)
        
        return files
    
    def generate_feeder_json(self, output_dir: Path) -> Path:
        """生成馈线拓扑 JSON"""
        output_file = output_dir / "feeder.json"
        
        feeder_data = {
            "feeder_name": "示例馈线F01",
            "voltage_level": 10.0,
            "root_node": "BUS_SUB",
            "nodes": [
                {
                    "id": "BUS_SUB",
                    "name": "变电站10kV母线",
                    "type": "bus",
                    "voltage_level": 10.0,
                    "has_protection": True,
                    "protection_devices": ["REL_SUB"]
                },
                {
                    "id": "NODE_A",
                    "name": "分段开关A",
                    "type": "switch",
                    "voltage_level": 10.0,
                    "has_protection": True,
                    "protection_devices": ["REL_A"]
                },
                {
                    "id": "NODE_B",
                    "name": "分支开关B",
                    "type": "switch",
                    "voltage_level": 10.0,
                    "has_protection": True,
                    "protection_devices": ["REL_B"]
                },
                {
                    "id": "NODE_C",
                    "name": "分支开关C",
                    "type": "switch",
                    "voltage_level": 10.0,
                    "has_protection": True,
                    "protection_devices": ["REL_C"]
                },
                {
                    "id": "LOAD_D",
                    "name": "负荷D",
                    "type": "load",
                    "voltage_level": 10.0,
                    "has_protection": False,
                    "protection_devices": []
                },
                {
                    "id": "LOAD_E",
                    "name": "负荷E",
                    "type": "load",
                    "voltage_level": 10.0,
                    "has_protection": False,
                    "protection_devices": []
                },
                {
                    "id": "LOAD_F",
                    "name": "负荷F",
                    "type": "load",
                    "voltage_level": 10.0,
                    "has_protection": False,
                    "protection_devices": []
                }
            ],
            "edges": [
                {
                    "from": "BUS_SUB",
                    "to": "NODE_A",
                    "length": 2.5,
                    "line_type": "overhead",
                    "impedance": {
                        "r": 0.35,
                        "x": 0.42
                    }
                },
                {
                    "from": "NODE_A",
                    "to": "NODE_B",
                    "length": 1.8,
                    "line_type": "overhead",
                    "impedance": {
                        "r": 0.25,
                        "x": 0.30
                    }
                },
                {
                    "from": "NODE_A",
                    "to": "NODE_C",
                    "length": 1.2,
                    "line_type": "cable",
                    "impedance": {
                        "r": 0.18,
                        "x": 0.12
                    }
                },
                {
                    "from": "NODE_B",
                    "to": "LOAD_D",
                    "length": 0.5,
                    "line_type": "cable",
                    "impedance": {
                        "r": 0.08,
                        "x": 0.05
                    }
                },
                {
                    "from": "NODE_B",
                    "to": "LOAD_E",
                    "length": 0.8,
                    "line_type": "overhead",
                    "impedance": {
                        "r": 0.12,
                        "x": 0.14
                    }
                },
                {
                    "from": "NODE_C",
                    "to": "LOAD_F",
                    "length": 0.6,
                    "line_type": "cable",
                    "impedance": {
                        "r": 0.09,
                        "x": 0.06
                    }
                }
            ]
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(feeder_data, f, ensure_ascii=False, indent=2)
        
        return output_file
    
    def generate_settings_csv(self, output_dir: Path) -> Path:
        """生成保护定值 CSV"""
        output_file = output_dir / "settings.csv"
        
        rows = [
            {
                "device_id": "REL_SUB",
                "device_name": "变电站出线保护",
                "node_id": "BUS_SUB",
                "protection_type": "overcurrent",
                "phase_oc1_current": 8.0,
                "phase_oc1_time": 0.8,
                "phase_oc2_current": 4.0,
                "phase_oc2_time": 0.7,
                "phase_oc3_current": 2.0,
                "phase_oc3_time": 0.5,
                "ground_oc1_current": 4.0,
                "ground_oc1_time": 0.6,
                "ground_oc2_current": 2.0,
                "ground_oc2_time": 0.4,
                "ct_ratio": 40.0,
                "inverse_time_curve": "SI",
                "inverse_time_alpha": 0.14,
                "inverse_time_p": 0.02,
                "notes": "变电站出线保护，配合下级保护"
            },
            {
                "device_id": "REL_A",
                "device_name": "分段开关A保护",
                "node_id": "NODE_A",
                "protection_type": "overcurrent",
                "phase_oc1_current": 5.0,
                "phase_oc1_time": 0.5,
                "phase_oc2_current": 2.5,
                "phase_oc2_time": 0.4,
                "phase_oc3_current": "",
                "phase_oc3_time": "",
                "ground_oc1_current": 2.5,
                "ground_oc1_time": 0.4,
                "ground_oc2_current": 1.2,
                "ground_oc2_time": 0.2,
                "ct_ratio": 40.0,
                "inverse_time_curve": "SI",
                "inverse_time_alpha": 0.14,
                "inverse_time_p": 0.02,
                "notes": "分段保护，配合下级分支保护"
            },
            {
                "device_id": "REL_B",
                "device_name": "分支开关B保护",
                "node_id": "NODE_B",
                "protection_type": "overcurrent",
                "phase_oc1_current": 3.0,
                "phase_oc1_time": 0.2,
                "phase_oc2_current": 1.5,
                "phase_oc2_time": 0.1,
                "phase_oc3_current": "",
                "phase_oc3_time": "",
                "ground_oc1_current": 1.5,
                "ground_oc1_time": 0.2,
                "ground_oc2_current": 0.8,
                "ground_oc2_time": 0.1,
                "ct_ratio": 40.0,
                "inverse_time_curve": "SI",
                "inverse_time_alpha": 0.14,
                "inverse_time_p": 0.02,
                "notes": "末端分支保护，速动"
            },
            {
                "device_id": "REL_C",
                "device_name": "分支开关C保护",
                "node_id": "NODE_C",
                "protection_type": "overcurrent",
                "phase_oc1_current": 2.5,
                "phase_oc1_time": 0.15,
                "phase_oc2_current": 1.2,
                "phase_oc2_time": 0.1,
                "phase_oc3_current": "",
                "phase_oc3_time": "",
                "ground_oc1_current": 1.2,
                "ground_oc1_time": 0.15,
                "ground_oc2_current": 0.6,
                "ground_oc2_time": 0.1,
                "ct_ratio": 30.0,
                "inverse_time_curve": "SI",
                "inverse_time_alpha": 0.14,
                "inverse_time_p": 0.02,
                "notes": "末端分支保护，CT变比不同"
            }
        ]
        
        with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
            fieldnames = [
                "device_id", "device_name", "node_id", "protection_type",
                "phase_oc1_current", "phase_oc1_time",
                "phase_oc2_current", "phase_oc2_time",
                "phase_oc3_current", "phase_oc3_time",
                "ground_oc1_current", "ground_oc1_time",
                "ground_oc2_current", "ground_oc2_time",
                "ct_ratio", "inverse_time_curve",
                "inverse_time_alpha", "inverse_time_p", "notes"
            ]
            
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for row in rows:
                writer.writerow({k: str(v) if v is not None else "" for k, v in row.items()})
        
        return output_file
    
    def generate_fault_cases_yaml(self, output_dir: Path) -> Path:
        """生成故障案例 YAML"""
        output_file = output_dir / "fault_cases.yaml"
        
        fault_cases = {
            "cases": [
                {
                    "fault_id": "F001",
                    "fault_location": "LOAD_D",
                    "fault_type": "phase",
                    "description": "负荷D处三相短路故障",
                    "phase_fault_current": 150.0,
                    "ground_fault_current": 0.0,
                    "fault_impedance": 0.0,
                    "fault_resistance": 0.0
                },
                {
                    "fault_id": "F002",
                    "fault_location": "LOAD_E",
                    "fault_type": "phase",
                    "description": "负荷E处相间短路故障",
                    "phase_fault_current": 120.0,
                    "ground_fault_current": 0.0,
                    "fault_impedance": 0.0,
                    "fault_resistance": 0.0
                },
                {
                    "fault_id": "F003",
                    "fault_location": "LOAD_F",
                    "fault_type": "phase",
                    "description": "负荷F处三相短路故障",
                    "phase_fault_current": 180.0,
                    "ground_fault_current": 0.0,
                    "fault_impedance": 0.0,
                    "fault_resistance": 0.0
                },
                {
                    "fault_id": "F004",
                    "fault_location": "NODE_B",
                    "fault_type": "phase",
                    "description": "分支开关B处相间短路",
                    "phase_fault_current": 250.0,
                    "ground_fault_current": 0.0,
                    "fault_impedance": 0.0,
                    "fault_resistance": 0.0
                },
                {
                    "fault_id": "F005",
                    "fault_location": "LOAD_D",
                    "fault_type": "ground",
                    "description": "负荷D处单相接地故障",
                    "phase_fault_current": 0.0,
                    "ground_fault_current": 80.0,
                    "fault_impedance": 0.0,
                    "fault_resistance": 10.0
                },
                {
                    "fault_id": "F006",
                    "fault_location": "NODE_C",
                    "fault_type": "phase",
                    "description": "分支开关C处高阻故障",
                    "phase_fault_current": 60.0,
                    "ground_fault_current": 0.0,
                    "fault_impedance": 0.0,
                    "fault_resistance": 50.0
                }
            ]
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            yaml.dump(fault_cases, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        
        return output_file
    
    def generate_devices_csv(self, output_dir: Path) -> Path:
        """生成设备信息 CSV"""
        output_file = output_dir / "devices.csv"
        
        rows = [
            {
                "device_id": "REL_SUB",
                "device_name": "变电站出线保护",
                "node_id": "BUS_SUB",
                "device_type": "protection_relay",
                "manufacturer": "南瑞继保",
                "model": "PCS-9611",
                "rated_current": 5.0,
                "ct_ratio_primary": 400.0,
                "ct_ratio_secondary": 5.0,
                "installation_date": "2022-03-15",
                "location": "变电站10kV开关柜",
                "notes": "出线保护装置"
            },
            {
                "device_id": "REL_A",
                "device_name": "分段开关A保护",
                "node_id": "NODE_A",
                "device_type": "protection_relay",
                "manufacturer": "许继电气",
                "model": "WGB-611",
                "rated_current": 5.0,
                "ct_ratio_primary": 400.0,
                "ct_ratio_secondary": 5.0,
                "installation_date": "2022-04-20",
                "location": "1号环网柜",
                "notes": "分段保护装置"
            },
            {
                "device_id": "REL_B",
                "device_name": "分支开关B保护",
                "node_id": "NODE_B",
                "device_type": "protection_relay",
                "manufacturer": "南瑞继保",
                "model": "PCS-9611",
                "rated_current": 5.0,
                "ct_ratio_primary": 400.0,
                "ct_ratio_secondary": 5.0,
                "installation_date": "2022-05-10",
                "location": "2号环网柜",
                "notes": "分支保护装置"
            },
            {
                "device_id": "REL_C",
                "device_name": "分支开关C保护",
                "node_id": "NODE_C",
                "device_type": "protection_relay",
                "manufacturer": "许继电气",
                "model": "WGB-611",
                "rated_current": 5.0,
                "ct_ratio_primary": 300.0,
                "ct_ratio_secondary": 5.0,
                "installation_date": "2022-06-05",
                "location": "3号环网柜",
                "notes": "分支保护装置，CT变比300/5"
            }
        ]
        
        with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
            fieldnames = [
                "device_id", "device_name", "node_id", "device_type",
                "manufacturer", "model", "rated_current",
                "ct_ratio_primary", "ct_ratio_secondary",
                "installation_date", "location", "notes"
            ]
            
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for row in rows:
                writer.writerow({k: str(v) if v is not None else "" for k, v in row.items()})
        
        return output_file
