"""
样例数据生成器
用于生成测试用的示例数据
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Any
import json
import random


class SampleDataGenerator:
    """样例数据生成器"""
    
    def __init__(self):
        self.base_date = datetime(2024, 5, 15, 22, 0, 0)
        
        self.zones = [
            {"id": "Z1", "name": "东区", "parent_id": None, "meter_ids": ["M1", "M2", "M3", "M4"], "pipe_ids": ["P1", "P2", "P3", "P4"], "valve_ids": ["V1", "V2"]},
            {"id": "Z2", "name": "西区", "parent_id": None, "meter_ids": ["M5", "M6", "M7", "M8"], "pipe_ids": ["P5", "P6", "P7", "P8"], "valve_ids": ["V3", "V4"]},
            {"id": "Z3", "name": "南区", "parent_id": "Z1", "meter_ids": ["M9", "M10", "M11"], "pipe_ids": ["P9", "P10"], "valve_ids": ["V5"]}
        ]
        
        self.pipes = [
            {"id": "P1", "start_node": "N1", "end_node": "N2", "length": 150, "diameter": 200, "material": "PE", "zone_id": "Z1", "is_open": True},
            {"id": "P2", "start_node": "N2", "end_node": "N3", "length": 200, "diameter": 150, "material": "PE", "zone_id": "Z1", "is_open": True},
            {"id": "P3", "start_node": "N3", "end_node": "N4", "length": 180, "diameter": 150, "material": "铸铁", "zone_id": "Z1", "is_open": True},
            {"id": "P4", "start_node": "N2", "end_node": "N5", "length": 120, "diameter": 100, "material": "PE", "zone_id": "Z1", "is_open": True},
            {"id": "P5", "start_node": "N1", "end_node": "N6", "length": 220, "diameter": 200, "material": "PE", "zone_id": "Z2", "is_open": True},
            {"id": "P6", "start_node": "N6", "end_node": "N7", "length": 160, "diameter": 150, "material": "铸铁", "zone_id": "Z2", "is_open": True},
            {"id": "P7", "start_node": "N7", "end_node": "N8", "length": 140, "diameter": 100, "material": "PE", "zone_id": "Z2", "is_open": True},
            {"id": "P8", "start_node": "N6", "end_node": "N9", "length": 100, "diameter": 100, "material": "PE", "zone_id": "Z2", "is_open": True},
            {"id": "P9", "start_node": "N3", "end_node": "N10", "length": 80, "diameter": 100, "material": "PE", "zone_id": "Z3", "is_open": True},
            {"id": "P10", "start_node": "N10", "end_node": "N11", "length": 90, "diameter": 80, "material": "PE", "zone_id": "Z3", "is_open": True}
        ]
        
        self.valves = [
            {"id": "V1", "name": "东区入口阀门", "pipe_id": "P1", "is_open": True},
            {"id": "V2", "name": "N3节点阀门", "pipe_id": "P3", "is_open": True},
            {"id": "V3", "name": "西区入口阀门", "pipe_id": "P5", "is_open": True},
            {"id": "V4", "name": "N7节点阀门", "pipe_id": "P7", "is_open": True},
            {"id": "V5", "name": "南区入口阀门", "pipe_id": "P9", "is_open": True}
        ]
        
        self.meters = [
            {"id": "M1", "name": "东区总表", "meter_type": "zone", "zone_id": "Z1", "is_inflow": "true"},
            {"id": "M2", "name": "用户表-1号楼", "meter_type": "user", "zone_id": "Z1", "is_inflow": "false"},
            {"id": "M3", "name": "用户表-2号楼", "meter_type": "user", "zone_id": "Z1", "is_inflow": "false"},
            {"id": "M4", "name": "用户表-3号楼", "meter_type": "user", "zone_id": "Z1", "is_inflow": "false"},
            {"id": "M5", "name": "西区总表", "meter_type": "zone", "zone_id": "Z2", "is_inflow": "true"},
            {"id": "M6", "name": "用户表-4号楼", "meter_type": "user", "zone_id": "Z2", "is_inflow": "false"},
            {"id": "M7", "name": "用户表-5号楼", "meter_type": "user", "zone_id": "Z2", "is_inflow": "false"},
            {"id": "M8", "name": "用户表-6号楼", "meter_type": "user", "zone_id": "Z2", "is_inflow": "false"},
            {"id": "M9", "name": "南区总表", "meter_type": "zone", "zone_id": "Z3", "is_inflow": "true"},
            {"id": "M10", "name": "用户表-7号楼", "meter_type": "user", "zone_id": "Z3", "is_inflow": "false"},
            {"id": "M11", "name": "用户表-8号楼", "meter_type": "user", "zone_id": "Z3", "is_inflow": "false"}
        ]
        
        self.pressure_sensors = [
            {"id": "PS1", "node_id": "N1"},
            {"id": "PS2", "node_id": "N2"},
            {"id": "PS3", "node_id": "N3"},
            {"id": "PS4", "node_id": "N6"},
            {"id": "PS5", "node_id": "N7"}
        ]
    
    def generate_pipes_yaml(self) -> str:
        """生成pipes.yaml内容"""
        import yaml
        
        data = {
            "zones": self.zones,
            "pipes": self.pipes,
            "valves": self.valves
        }
        
        return yaml.dump(data, allow_unicode=True, sort_keys=False)
    
    def generate_meters_csv(self) -> str:
        """生成meters.csv内容"""
        lines = []
        
        header = ["meter_id", "meter_name", "meter_type", "zone_id", "is_inflow", "timestamp", "reading", "cumulative"]
        lines.append(",".join(header))
        
        base_readings = {
            "M1": 50000.0, "M2": 12000.0, "M3": 15000.0, "M4": 18000.0,
            "M5": 60000.0, "M6": 20000.0, "M7": 22000.0, "M8": 19000.0,
            "M9": 25000.0, "M10": 8000.0, "M11": 9500.0
        }
        
        hourly_consumption = {
            "M1": 15.0, "M2": 2.0, "M3": 2.5, "M4": 3.0,
            "M5": 12.0, "M6": 3.5, "M7": 4.0, "M8": 3.0,
            "M9": 8.0, "M10": 3.0, "M11": 2.5
        }
        
        for hour in range(8):
            current_time = self.base_date + timedelta(hours=hour)
            
            for meter in self.meters:
                meter_id = meter["id"]
                base = base_readings[meter_id]
                consumption = hourly_consumption[meter_id]
                
                if meter_id == "M1":
                    consumption = 30.0
                
                if meter_id == "M9":
                    if hour >= 3:
                        consumption = 15.0
                
                reading = base + consumption * (hour + 1)
                
                row = [
                    meter_id,
                    meter["name"],
                    meter["meter_type"],
                    meter["zone_id"],
                    meter["is_inflow"],
                    current_time.strftime("%Y-%m-%d %H:%M:%S"),
                    f"{consumption:.2f}",
                    f"{reading:.2f}"
                ]
                lines.append(",".join(row))
        
        return "\n".join(lines)
    
    def generate_pressure_jsonl(self) -> str:
        """生成pressure.jsonl内容"""
        lines = []
        
        base_pressures = {
            "PS1": 0.45, "PS2": 0.42, "PS3": 0.40, "PS4": 0.43, "PS5": 0.41
        }
        
        leak_start_hour = 4
        
        for hour in range(8):
            for minute in range(0, 60, 2):
                current_time = self.base_date + timedelta(hours=hour, minutes=minute)
                
                for sensor in self.pressure_sensors:
                    sensor_id = sensor["id"]
                    base_p = base_pressures[sensor_id]
                    
                    pressure = base_p + random.uniform(-0.01, 0.01)
                    
                    if hour >= leak_start_hour:
                        if sensor_id in ["PS2", "PS3", "PS1"]:
                            drop_factor = (hour - leak_start_hour) * 0.5 + minute / 120.0
                            if sensor_id == "PS2":
                                pressure = base_p - 0.08 * min(drop_factor, 1.0)
                            elif sensor_id == "PS3":
                                pressure = base_p - 0.12 * min(drop_factor, 1.0)
                            elif sensor_id == "PS1":
                                pressure = base_p - 0.03 * min(drop_factor, 1.0)
                    
                    record = {
                        "sensor_id": sensor_id,
                        "node_id": sensor["node_id"],
                        "timestamp": current_time.strftime("%Y-%m-%d %H:%M:%S"),
                        "pressure": round(pressure, 4)
                    }
                    lines.append(json.dumps(record, ensure_ascii=False))
        
        return "\n".join(lines)
    
    def generate_repair_orders_csv(self) -> str:
        """生成repair_orders.csv内容"""
        lines = []
        
        header = [
            "order_id", "order_type", "status", "target_id", "target_type",
            "created_at", "scheduled_start", "scheduled_end",
            "actual_start", "actual_end", "description"
        ]
        lines.append(",".join(header))
        
        orders = [
            {
                "order_id": "RO001",
                "order_type": "inspection",
                "status": "completed",
                "target_id": "V2",
                "target_type": "valve",
                "created_at": (self.base_date - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
                "scheduled_start": (self.base_date - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
                "scheduled_end": (self.base_date - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S"),
                "actual_start": (self.base_date - timedelta(hours=2, minutes=15)).strftime("%Y-%m-%d %H:%M:%S"),
                "actual_end": (self.base_date - timedelta(hours=1, minutes=20)).strftime("%Y-%m-%d %H:%M:%S"),
                "description": "例行阀门检查"
            }
        ]
        
        for order in orders:
            row = [
                order["order_id"],
                order["order_type"],
                order["status"],
                order["target_id"],
                order["target_type"],
                order["created_at"],
                order["scheduled_start"],
                order["scheduled_end"],
                order["actual_start"],
                order["actual_end"],
                order["description"]
            ]
            lines.append(",".join(row))
        
        return "\n".join(lines)
    
    def write_all_files(self, output_dir: str = "."):
        """写入所有样例数据文件"""
        import os
        
        os.makedirs(output_dir, exist_ok=True)
        
        yaml_content = self.generate_pipes_yaml()
        with open(os.path.join(output_dir, "pipes.yaml"), "w", encoding="utf-8") as f:
            f.write(yaml_content)
        
        csv_content = self.generate_meters_csv()
        with open(os.path.join(output_dir, "meters.csv"), "w", encoding="utf-8") as f:
            f.write(csv_content)
        
        jsonl_content = self.generate_pressure_jsonl()
        with open(os.path.join(output_dir, "pressure.jsonl"), "w", encoding="utf-8") as f:
            f.write(jsonl_content)
        
        repair_content = self.generate_repair_orders_csv()
        with open(os.path.join(output_dir, "repair_orders.csv"), "w", encoding="utf-8") as f:
            f.write(repair_content)
        
        print(f"样例数据已生成到: {output_dir}")
