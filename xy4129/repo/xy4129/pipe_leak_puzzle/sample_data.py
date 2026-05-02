# -*- coding: utf-8 -*-
"""
示例数据模块 - 生成测试用的示例数据
"""

import json
import csv
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any
import random
import math


def generate_sample_data(output_dir: str):
    """
    生成示例数据（CSV格式）
    
    生成的数据包括：
    1. 压力传感器数据 - 包含正常波动和模拟漏点事件
    2. 听漏仪巡检数据 - 包含正常和异常声纹
    3. 阀门台账数据 - 管网阀门信息
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # 生成压力传感器数据
    print("生成压力传感器数据...")
    pressure_csv = generate_pressure_sample()
    pressure_file = output_path / "pressure_sample.csv"
    with open(pressure_file, "w", encoding="utf-8", newline="") as f:
        f.write(pressure_csv)
    print(f"  已保存: {pressure_file}")
    
    # 生成听漏仪数据
    print("生成听漏仪巡检数据...")
    acoustic_csv = generate_acoustic_sample()
    acoustic_file = output_path / "acoustic_sample.csv"
    with open(acoustic_file, "w", encoding="utf-8", newline="") as f:
        f.write(acoustic_csv)
    print(f"  已保存: {acoustic_file}")
    
    # 生成阀门台账
    print("生成阀门台账数据...")
    valve_csv = generate_valve_sample()
    valve_file = output_path / "valve_sample.csv"
    with open(valve_file, "w", encoding="utf-8", newline="") as f:
        f.write(valve_csv)
    print(f"  已保存: {valve_file}")
    
    print("\n示例数据生成完成！")
    print(f"输出目录: {output_path}")


def generate_sample_project(project_dir: str):
    """
    生成完整的示例项目
    
    创建项目目录结构并生成所有必要的数据文件
    """
    project_path = Path(project_dir)
    
    # 创建目录结构
    subdirs = ["config", "data", "analysis", "reports", "review"]
    for subdir in subdirs:
        (project_path / subdir).mkdir(parents=True, exist_ok=True)
    
    # 创建管网配置
    from .network_model import create_template_network
    network = create_template_network("default")
    network.save(project_path / "config" / "network.json")
    
    # 创建项目元数据
    metadata = {
        "project_name": "示例管网漏点分析项目",
        "created_at": datetime.now().isoformat(),
        "template": "default",
        "version": "1.0.0",
        "nodes_count": len(network.nodes),
        "valves_count": len(network.valves),
        "sensors_count": len(network.sensors)
    }
    
    with open(project_path / "config" / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    
    # 生成并保存示例数据（JSON格式）
    pressure_data = generate_pressure_data_json()
    with open(project_path / "data" / "pressure_data.json", "w", encoding="utf-8") as f:
        json.dump(pressure_data, f, ensure_ascii=False, indent=2, default=str)
    
    acoustic_data = generate_acoustic_data_json()
    with open(project_path / "data" / "acoustic_data.json", "w", encoding="utf-8") as f:
        json.dump(acoustic_data, f, ensure_ascii=False, indent=2, default=str)
    
    valve_data = generate_valve_data_json()
    with open(project_path / "data" / "valve_data.json", "w", encoding="utf-8") as f:
        json.dump(valve_data, f, ensure_ascii=False, indent=2, default=str)
    
    print(f"示例项目已创建: {project_path}")
    print(f"  节点数: {len(network.nodes)}")
    print(f"  阀门数: {len(network.valves)}")
    print(f"  传感器数: {len(network.sensors)}")
    print(f"  压力数据记录: {len(pressure_data)}")
    print(f"  听漏仪数据记录: {len(acoustic_data)}")


def generate_pressure_sample() -> str:
    """生成压力传感器示例CSV数据"""
    lines = ["时间戳,传感器ID,压力(MPa),状态"]
    
    # 从昨晚8点到今天凌晨6点，共10小时
    start_time = datetime.now().replace(hour=20, minute=0, second=0, microsecond=0) - timedelta(days=1)
    
    # 传感器列表
    sensors = ["P001", "P002", "P003", "P004", "P005"]
    
    # 基线压力
    baseline_pressures = {
        "P001": 0.45,  # 水厂出口
        "P002": 0.42,  # 泵站后
        "P003": 0.38,  # 主干1
        "P004": 0.35,  # 主干2
        "P005": 0.32,  # 主干3
    }
    
    # 漏点事件时间（凌晨2:30）
    leak_time = start_time + timedelta(hours=6, minutes=30)
    
    for hour in range(10):  # 10小时
        for minute in range(60):
            current_time = start_time + timedelta(hours=hour, minutes=minute)
            
            for sensor_id in sensors:
                baseline = baseline_pressures[sensor_id]
                
                # 正常波动（±2%）
                fluctuation = random.uniform(-0.02, 0.02) * baseline
                pressure = baseline + fluctuation
                
                # 用水高峰时段（晚上8-10点）压力略有下降
                if 20 <= current_time.hour < 22:
                    pressure *= 0.97
                
                # 模拟漏点事件
                time_since_leak = (current_time - leak_time).total_seconds()
                
                if time_since_leak >= 0:
                    # 漏点发生后，压力逐渐下降
                    # 不同传感器响应时间不同（模拟传播延迟）
                    sensor_delay = {
                        "P001": 120,   # 水厂，响应慢
                        "P002": 90,    # 泵站
                        "P003": 60,    # 主干1
                        "P004": 30,    # 主干2（靠近漏点）
                        "P005": 0,     # 主干3（离漏点最近）
                    }
                    
                    delay = sensor_delay.get(sensor_id, 60)
                    
                    if time_since_leak >= delay:
                        # 压力下降曲线
                        drop_duration = 300  # 5分钟内下降到最低点
                        progress = min((time_since_leak - delay) / drop_duration, 1.0)
                        
                        # 漏点导致的压力下降幅度（15-25%）
                        drop_ratio = 0.15 + (sensor_id == "P005" and 0.1 or 0)  # P005下降更多
                        
                        pressure *= (1 - drop_ratio * progress)
                
                # 状态
                status = "正常"
                if time_since_leak >= 0 and pressure < baseline * 0.85:
                    status = "异常"
                
                lines.append(f"{current_time.strftime('%Y-%m-%d %H:%M:%S')},{sensor_id},{pressure:.4f},{status}")
    
    return "\n".join(lines)


def generate_acoustic_sample() -> str:
    """生成听漏仪巡检示例CSV数据"""
    lines = ["时间戳,位置,声强(dB),主频(Hz),异常评分,设备ID"]
    
    # 巡检路线上的位置
    locations = [
        ("S004", "主干管中段", 45, 50),    # 正常
        ("S005", "主干管东段", 48, 55),    # 正常
        ("S007", "东支管中段", 52, 300),   # 异常（漏点附近）
        ("S006", "东支管入口", 50, 200),   # 异常
        ("S010", "西支管中段", 46, 60),    # 正常
        ("S009", "西支管入口", 47, 55),    # 正常
        ("S012", "中区用户入口", 44, 45),  # 正常
    ]
    
    # 巡检开始时间（凌晨2:00）
    start_time = datetime.now().replace(hour=2, minute=0, second=0, microsecond=0)
    
    # 设备ID
    device_id = "A001"
    
    for i, (section_id, location_desc, base_level, base_freq) in enumerate(locations):
        # 每个位置停留5分钟，每分钟采样一次
        for minute in range(5):
            current_time = start_time + timedelta(minutes=i * 5 + minute)
            
            # 正常波动
            level = base_level + random.uniform(-3, 3)
            freq = base_freq + random.uniform(-20, 20)
            
            # 异常评分
            anomaly_score = random.uniform(0, 0.2)
            
            # 东支管位置（漏点附近）
            if "东支管" in location_desc:
                level += 15  # 声强更高
                freq = 350 + random.uniform(-50, 50)  # 特定频率范围
                anomaly_score = 0.7 + random.uniform(0, 0.25)  # 高异常评分
            
            lines.append(
                f"{current_time.strftime('%Y-%m-%d %H:%M:%S')},"
                f"{location_desc},"
                f"{level:.1f},"
                f"{freq:.0f},"
                f"{anomaly_score:.3f},"
                f"{device_id}"
            )
    
    return "\n".join(lines)


def generate_valve_sample() -> str:
    """生成阀门台账示例CSV数据"""
    lines = ["阀门ID,阀门名称,位置,状态,管径(mm),所在管段,操作优先级,X坐标,Y坐标"]
    
    valves = [
        ("V001", "水厂出口阀", "水厂", "开启", 400, "S001", 1, 75, 100),
        ("V002", "泵站出口阀", "泵站1", "开启", 350, "S002", 1, 175, 100),
        ("V003", "水库出口阀", "水库1", "开启", 300, "S003", 2, 275, 50),
        ("V004", "主干1入口阀", "主干节点1东侧", "开启", 300, "S004", 1, 325, 100),
        ("V005", "主干2入口阀", "主干节点2西侧", "开启", 300, "S004", 1, 425, 100),
        ("V006", "主干3入口阀", "主干节点2东侧", "开启", 250, "S005", 2, 475, 100),
        ("V007", "东支1入口阀", "主干节点2北侧", "开启", 200, "S006", 2, 500, 75),
        ("V008", "东支2入口阀", "东支节点1东侧", "开启", 150, "S007", 3, 525, 50),
        ("V009", "东区用户阀", "东支节点2东侧", "开启", 150, "S008", 3, 625, 50),
        ("V010", "西支1入口阀", "主干节点2南侧", "开启", 200, "S009", 2, 500, 125),
        ("V011", "西支2入口阀", "西支节点1东侧", "开启", 150, "S010", 3, 525, 150),
        ("V012", "西区用户阀", "西支节点2东侧", "开启", 150, "S011", 3, 625, 150),
        ("V013", "中区用户阀", "主干节点3东侧", "开启", 200, "S012", 3, 625, 100),
        ("V014", "消防栓1阀", "主干节点2北侧", "关闭", 100, "S013", 4, 450, 87),
        ("V015", "消防栓2阀", "主干节点2南侧", "关闭", 100, "S014", 4, 450, 112),
    ]
    
    for valve_id, name, location, status, diameter, section, priority, x, y in valves:
        lines.append(f"{valve_id},{name},{location},{status},{diameter},{section},{priority},{x},{y}")
    
    return "\n".join(lines)


def generate_pressure_data_json() -> List[Dict]:
    """生成JSON格式的压力数据"""
    data = []
    
    start_time = datetime.now().replace(hour=20, minute=0, second=0, microsecond=0) - timedelta(days=1)
    leak_time = start_time + timedelta(hours=6, minutes=30)  # 凌晨2:30
    
    sensors = ["P001", "P002", "P003", "P004", "P005"]
    baseline = {
        "P001": 0.45,
        "P002": 0.42,
        "P003": 0.38,
        "P004": 0.35,
        "P005": 0.32,
    }
    
    sensor_delay = {"P001": 120, "P002": 90, "P003": 60, "P004": 30, "P005": 0}
    
    # 生成4小时的数据（每5分钟一个样本，简化版）
    for minute in range(0, 480, 5):
        current_time = start_time + timedelta(minutes=minute)
        
        for sensor_id in sensors:
            base = baseline[sensor_id]
            pressure = base + random.uniform(-0.01, 0.01) * base
            
            # 漏点影响
            time_since_leak = (current_time - leak_time).total_seconds()
            if time_since_leak >= 0:
                delay = sensor_delay.get(sensor_id, 60)
                if time_since_leak >= delay:
                    progress = min((time_since_leak - delay) / 300, 1.0)
                    drop_ratio = 0.18 + (sensor_id == "P005" and 0.08 or 0)
                    pressure *= (1 - drop_ratio * progress)
            
            data.append({
                "timestamp": current_time.isoformat(),
                "sensor_id": sensor_id,
                "pressure": round(pressure, 4),
                "unit": "MPa",
                "raw_data": {}
            })
    
    return data


def generate_acoustic_data_json() -> List[Dict]:
    """生成JSON格式的听漏仪数据"""
    data = []
    
    start_time = datetime.now().replace(hour=2, minute=0, second=0, microsecond=0)
    
    locations = [
        ("主干管中段", 45, 50, 0.1),
        ("主干管东段", 48, 55, 0.15),
        ("东支管中段", 65, 350, 0.85),
        ("东支管入口", 60, 300, 0.75),
        ("西支管中段", 46, 60, 0.12),
        ("西支管入口", 47, 55, 0.1),
    ]
    
    for i, (location, base_level, base_freq, anomaly_base) in enumerate(locations):
        for sample in range(3):
            current_time = start_time + timedelta(minutes=i * 10 + sample * 2)
            
            level = base_level + random.uniform(-2, 2)
            freq = base_freq + random.uniform(-15, 15)
            anomaly_score = anomaly_base + random.uniform(-0.05, 0.1)
            
            data.append({
                "timestamp": current_time.isoformat(),
                "location": location,
                "level": round(level, 1),
                "frequency": round(freq, 0),
                "anomaly_score": round(anomaly_score, 3),
                "device_id": "A001",
                "raw_data": {}
            })
    
    return data


def generate_valve_data_json() -> List[Dict]:
    """生成JSON格式的阀门数据"""
    valves = [
        {
            "valve_id": "V001", "name": "水厂出口阀", "location": "水厂",
            "status": "开启", "diameter": 400, "section_id": "S001",
            "priority": 1, "x": 75, "y": 100
        },
        {
            "valve_id": "V004", "name": "主干1入口阀", "location": "主干节点1东侧",
            "status": "开启", "diameter": 300, "section_id": "S004",
            "priority": 1, "x": 325, "y": 100
        },
        {
            "valve_id": "V005", "name": "主干2入口阀", "location": "主干节点2西侧",
            "status": "开启", "diameter": 300, "section_id": "S004",
            "priority": 1, "x": 425, "y": 100
        },
        {
            "valve_id": "V007", "name": "东支1入口阀", "location": "主干节点2北侧",
            "status": "开启", "diameter": 200, "section_id": "S006",
            "priority": 2, "x": 500, "y": 75
        },
        {
            "valve_id": "V008", "name": "东支2入口阀", "location": "东支节点1东侧",
            "status": "开启", "diameter": 150, "section_id": "S007",
            "priority": 3, "x": 525, "y": 50
        },
    ]
    
    return valves
