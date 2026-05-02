# -*- coding: utf-8 -*-
"""
管网模型模块 - 定义节点、阀门、传感器、管段等核心数据结构
"""

import json
from dataclasses import dataclass, asdict, field
from typing import List, Dict, Optional, Any
from enum import Enum
from uuid import uuid4


class NodeType(Enum):
    """节点类型"""
    SOURCE = "水源"
    RESERVOIR = "水库"
    PUMP = "泵站"
    JUNCTION = "连接点"
    CUSTOMER = "用户"
    HYDRANT = "消防栓"


class ValveStatus(Enum):
    """阀门状态"""
    OPEN = "开启"
    CLOSED = "关闭"
    PARTIAL = "部分开启"
    UNKNOWN = "未知"


class SensorType(Enum):
    """传感器类型"""
    PRESSURE = "压力"
    FLOW = "流量"
    ACOUSTIC = "声学"
    WATER_QUALITY = "水质"


@dataclass
class Node:
    """管网节点"""
    node_id: str
    name: str
    node_type: NodeType
    x: float = 0.0
    y: float = 0.0
    elevation: float = 0.0
    base_demand: float = 0.0
    connected_sections: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        data = asdict(self)
        data["node_type"] = self.node_type.value
        return data
    
    @classmethod
    def from_dict(cls, data: Dict) -> "Node":
        data = data.copy()
        data["node_type"] = NodeType(data.get("node_type", NodeType.JUNCTION.value))
        return cls(**data)


@dataclass
class Valve:
    """阀门"""
    valve_id: str
    name: str
    location: str
    from_node: str
    to_node: str
    section_id: str
    status: ValveStatus = ValveStatus.OPEN
    diameter: float = 0.0
    x: float = 0.0
    y: float = 0.0
    operation_priority: int = 1
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        data = asdict(self)
        data["status"] = self.status.value
        return data
    
    @classmethod
    def from_dict(cls, data: Dict) -> "Valve":
        data = data.copy()
        data["status"] = ValveStatus(data.get("status", ValveStatus.OPEN.value))
        return cls(**data)


@dataclass
class Sensor:
    """传感器"""
    sensor_id: str
    name: str
    sensor_type: SensorType
    location: str
    node_id: str = ""
    section_id: str = ""
    x: float = 0.0
    y: float = 0.0
    sampling_interval: int = 60
    unit: str = ""
    min_value: float = 0.0
    max_value: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        data = asdict(self)
        data["sensor_type"] = self.sensor_type.value
        return data
    
    @classmethod
    def from_dict(cls, data: Dict) -> "Sensor":
        data = data.copy()
        data["sensor_type"] = SensorType(data.get("sensor_type", SensorType.PRESSURE.value))
        return cls(**data)


@dataclass
class PipeSection:
    """管段"""
    section_id: str
    name: str
    from_node: str
    to_node: str
    length: float = 0.0
    diameter: float = 0.0
    material: str = ""
    roughness: float = 0.0
    age: float = 0.0
    wave_speed: float = 1000.0
    valves: List[str] = field(default_factory=list)
    connected_users: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict) -> "PipeSection":
        return cls(**data)


@dataclass
class User:
    """用户"""
    user_id: str
    name: str
    address: str
    node_id: str
    section_id: str
    avg_demand: float = 0.0
    peak_demand: float = 0.0
    user_type: str = "居民"
    x: float = 0.0
    y: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict) -> "User":
        return cls(**data)


class PipeNetwork:
    """管网模型"""
    
    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.valves: Dict[str, Valve] = {}
        self.sensors: Dict[str, Sensor] = {}
        self.sections: Dict[str, PipeSection] = {}
        self.users: Dict[str, User] = {}
        self.metadata: Dict[str, Any] = {}
    
    def add_node(self, node: Node):
        self.nodes[node.node_id] = node
    
    def add_valve(self, valve: Valve):
        self.valves[valve.valve_id] = valve
    
    def add_sensor(self, sensor: Sensor):
        self.sensors[sensor.sensor_id] = sensor
    
    def add_section(self, section: PipeSection):
        self.sections[section.section_id] = section
    
    def add_user(self, user: User):
        self.users[user.user_id] = user
    
    def get_adjacent_sections(self, node_id: str) -> List[str]:
        """获取与指定节点相连的管段"""
        if node_id not in self.nodes:
            return []
        return self.nodes[node_id].connected_sections
    
    def get_section_valves(self, section_id: str) -> List[Valve]:
        """获取管段上的所有阀门"""
        if section_id not in self.sections:
            return []
        section = self.sections[section_id]
        return [self.valves[v_id] for v_id in section.valves if v_id in self.valves]
    
    def get_section_users(self, section_id: str) -> List[User]:
        """获取管段上的所有用户"""
        if section_id not in self.sections:
            return []
        section = self.sections[section_id]
        return [self.users[u_id] for u_id in section.connected_users if u_id in self.users]
    
    def get_upstream_valves(self, section_id: str) -> List[Valve]:
        """获取管段上游阀门"""
        if section_id not in self.sections:
            return []
        section = self.sections[section_id]
        valves = []
        
        # 简单实现：返回管段上的阀门
        for v_id in section.valves:
            if v_id in self.valves:
                valves.append(self.valves[v_id])
        
        return valves
    
    def save(self, filepath: str):
        """保存管网配置到JSON文件"""
        data = {
            "metadata": self.metadata,
            "nodes": [n.to_dict() for n in self.nodes.values()],
            "valves": [v.to_dict() for v in self.valves.values()],
            "sensors": [s.to_dict() for s in self.sensors.values()],
            "sections": [s.to_dict() for s in self.sections.values()],
            "users": [u.to_dict() for u in self.users.values()]
        }
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    @classmethod
    def load(cls, filepath: str) -> "PipeNetwork":
        """从JSON文件加载管网配置"""
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        network = cls()
        network.metadata = data.get("metadata", {})
        
        for node_data in data.get("nodes", []):
            network.add_node(Node.from_dict(node_data))
        
        for valve_data in data.get("valves", []):
            network.add_valve(Valve.from_dict(valve_data))
        
        for sensor_data in data.get("sensors", []):
            network.add_sensor(Sensor.from_dict(sensor_data))
        
        for section_data in data.get("sections", []):
            network.add_section(PipeSection.from_dict(section_data))
        
        for user_data in data.get("users", []):
            network.add_user(User.from_dict(user_data))
        
        return network


def create_template_network(template_type: str = "default") -> PipeNetwork:
    """
    创建模板管网
    
    Args:
        template_type: 模板类型
            - "small": 小型管网（约5个节点）
            - "default": 标准管网（约15个节点）
            - "large": 大型管网（约30个节点）
    
    Returns:
        PipeNetwork: 管网模型
    """
    network = PipeNetwork()
    network.metadata["template_type"] = template_type
    network.metadata["created_at"] = None
    
    if template_type == "small":
        # 小型管网：简单的分支网络
        nodes = [
            Node(node_id="N001", name="水源", node_type=NodeType.SOURCE, x=100, y=100),
            Node(node_id="N002", name="连接点1", node_type=NodeType.JUNCTION, x=200, y=100),
            Node(node_id="N003", name="连接点2", node_type=NodeType.JUNCTION, x=300, y=100),
            Node(node_id="N004", name="用户区1", node_type=NodeType.CUSTOMER, x=400, y=50),
            Node(node_id="N005", name="用户区2", node_type=NodeType.CUSTOMER, x=400, y=150),
        ]
        
        sections = [
            PipeSection(section_id="S001", name="干管1", from_node="N001", to_node="N002", 
                       length=500, diameter=300, material="铸铁", wave_speed=1200,
                       valves=["V001"], connected_users=[]),
            PipeSection(section_id="S002", name="干管2", from_node="N002", to_node="N003",
                       length=600, diameter=250, material="铸铁", wave_speed=1200,
                       valves=["V002"], connected_users=[]),
            PipeSection(section_id="S003", name="支管1", from_node="N003", to_node="N004",
                       length=300, diameter=150, material="PE", wave_speed=400,
                       valves=["V003"], connected_users=["U001", "U002"]),
            PipeSection(section_id="S004", name="支管2", from_node="N003", to_node="N005",
                       length=350, diameter=150, material="PE", wave_speed=400,
                       valves=["V004"], connected_users=["U003", "U004"]),
        ]
        
        valves = [
            Valve(valve_id="V001", name="水源阀门", location="水源出口", 
                  from_node="N001", to_node="N002", section_id="S001", diameter=300),
            Valve(valve_id="V002", name="干管阀门", location="干管中间", 
                  from_node="N002", to_node="N003", section_id="S002", diameter=250),
            Valve(valve_id="V003", name="支管1阀门", location="支管1入口", 
                  from_node="N003", to_node="N004", section_id="S003", diameter=150),
            Valve(valve_id="V004", name="支管2阀门", location="支管2入口", 
                  from_node="N003", to_node="N005", section_id="S004", diameter=150),
        ]
        
        sensors = [
            Sensor(sensor_id="P001", name="压力传感器1", sensor_type=SensorType.PRESSURE,
                   location="水源出口", node_id="N001", section_id="S001",
                   unit="MPa", min_value=0, max_value=1.0),
            Sensor(sensor_id="P002", name="压力传感器2", sensor_type=SensorType.PRESSURE,
                   location="连接点2", node_id="N003", section_id="S002",
                   unit="MPa", min_value=0, max_value=1.0),
            Sensor(sensor_id="A001", name="听漏仪1", sensor_type=SensorType.ACOUSTIC,
                   location="干管中间", section_id="S002", unit="dB"),
        ]
        
        users = [
            User(user_id="U001", name="张三", address="幸福路1号", node_id="N004", section_id="S003",
                 avg_demand=0.5, peak_demand=1.2),
            User(user_id="U002", name="李四", address="幸福路2号", node_id="N004", section_id="S003",
                 avg_demand=0.6, peak_demand=1.5),
            User(user_id="U003", name="王五", address="安康路1号", node_id="N005", section_id="S004",
                 avg_demand=0.4, peak_demand=1.0),
            User(user_id="U004", name="赵六", address="安康路2号", node_id="N005", section_id="S004",
                 avg_demand=0.5, peak_demand=1.3),
        ]
    
    elif template_type == "large":
        # 大型管网：更复杂的环状网络
        nodes = []
        sections = []
        valves = []
        sensors = []
        users = []
        
        # 创建3x10网格节点
        for row in range(3):
            for col in range(10):
                node_id = f"N{row*10+col+1:03d}"
                node_type = NodeType.CUSTOMER if (row > 0 and col > 0) else (NodeType.SOURCE if (row == 0 and col == 0) else NodeType.JUNCTION)
                nodes.append(Node(
                    node_id=node_id,
                    name=f"节点{row*10+col+1}",
                    node_type=node_type,
                    x=100 + col * 150,
                    y=100 + row * 150
                ))
        
        # 创建水平管段
        for row in range(3):
            for col in range(9):
                from_idx = row * 10 + col
                to_idx = row * 10 + col + 1
                section_id = f"S{row*10+col+1:03d}"
                sections.append(PipeSection(
                    section_id=section_id,
                    name=f"水平管段{row}-{col}",
                    from_node=nodes[from_idx].node_id,
                    to_node=nodes[to_idx].node_id,
                    length=150,
                    diameter=200 if row == 0 else 150,
                    material="铸铁" if row == 0 else "PE",
                    wave_speed=1200 if row == 0 else 400
                ))
        
        # 创建垂直管段
        for row in range(2):
            for col in range(10):
                from_idx = row * 10 + col
                to_idx = (row + 1) * 10 + col
                section_id = f"V{row*10+col+1:03d}"
                sections.append(PipeSection(
                    section_id=section_id,
                    name=f"垂直管段{row}-{col}",
                    from_node=nodes[from_idx].node_id,
                    to_node=nodes[to_idx].node_id,
                    length=150,
                    diameter=150,
                    material="PE",
                    wave_speed=400
                ))
        
        # 创建阀门（每个管段两端）
        valve_idx = 1
        for section in sections:
            valves.append(Valve(
                valve_id=f"V{valve_idx:03d}",
                name=f"阀门{valve_idx}",
                location=f"{section.name}入口",
                from_node=section.from_node,
                to_node=section.to_node,
                section_id=section.section_id,
                diameter=section.diameter
            ))
            valve_idx += 1
            section.valves.append(valves[-1].valve_id)
        
        # 创建传感器
        sensors.append(Sensor(
            sensor_id="P001", name="主压力传感器", sensor_type=SensorType.PRESSURE,
            location="水源出口", node_id="N001", section_id="S001",
            unit="MPa", min_value=0, max_value=1.0
        ))
        
        for i in range(5):
            sensors.append(Sensor(
                sensor_id=f"P{i+2:03d}",
                name=f"压力传感器{i+2}",
                sensor_type=SensorType.PRESSURE,
                location=f"管网监测点{i+1}",
                node_id=f"N{ (i + 1) * 2 :03d}",
                unit="MPa", min_value=0, max_value=1.0
            ))
        
        # 创建用户
        user_idx = 1
        for row in range(1, 3):
            for col in range(1, 10):
                node_idx = row * 10 + col
                for _ in range(2):
                    users.append(User(
                        user_id=f"U{user_idx:03d}",
                        name=f"用户{user_idx}",
                        address=f"区域{row}-{col}号",
                        node_id=nodes[node_idx].node_id,
                        section_id=sections[row * 9 + col - 1].section_id if col < 9 else sections[row * 9 + col - 2].section_id,
                        avg_demand=0.4 + (user_idx % 5) * 0.1,
                        peak_demand=1.0 + (user_idx % 3) * 0.3
                    ))
                    user_idx += 1
    
    else:  # default
        # 标准管网：包含水源、干管、支管、用户的完整网络
        nodes = [
            Node(node_id="N001", name="水厂", node_type=NodeType.SOURCE, x=50, y=100, elevation=50.0),
            Node(node_id="N002", name="泵站1", node_type=NodeType.PUMP, x=150, y=100, elevation=45.0),
            Node(node_id="N003", name="水库1", node_type=NodeType.RESERVOIR, x=250, y=50, elevation=80.0),
            Node(node_id="N004", name="主干节点1", node_type=NodeType.JUNCTION, x=300, y=100),
            Node(node_id="N005", name="主干节点2", node_type=NodeType.JUNCTION, x=450, y=100),
            Node(node_id="N006", name="主干节点3", node_type=NodeType.JUNCTION, x=600, y=100),
            Node(node_id="N007", name="东区节点1", node_type=NodeType.JUNCTION, x=500, y=50),
            Node(node_id="N008", name="东区节点2", node_type=NodeType.JUNCTION, x=600, y=50),
            Node(node_id="N009", name="西区节点1", node_type=NodeType.JUNCTION, x=500, y=150),
            Node(node_id="N010", name="西区节点2", node_type=NodeType.JUNCTION, x=600, y=150),
            Node(node_id="N011", name="东区用户区", node_type=NodeType.CUSTOMER, x=700, y=50),
            Node(node_id="N012", name="西区用户区", node_type=NodeType.CUSTOMER, x=700, y=150),
            Node(node_id="N013", name="中区用户区", node_type=NodeType.CUSTOMER, x=700, y=100),
            Node(node_id="N014", name="消防栓1", node_type=NodeType.HYDRANT, x=450, y=75),
            Node(node_id="N015", name="消防栓2", node_type=NodeType.HYDRANT, x=450, y=125),
        ]
        
        sections = [
            PipeSection(section_id="S001", name="水厂-泵站", from_node="N001", to_node="N002",
                       length=500, diameter=400, material="钢管", roughness=0.01, age=5.0, wave_speed=1400,
                       valves=["V001"], connected_users=[]),
            PipeSection(section_id="S002", name="泵站-主干1", from_node="N002", to_node="N004",
                       length=800, diameter=350, material="铸铁", roughness=0.015, age=15.0, wave_speed=1200,
                       valves=["V002"], connected_users=[]),
            PipeSection(section_id="S003", name="水库-主干1", from_node="N003", to_node="N004",
                       length=600, diameter=300, material="铸铁", roughness=0.015, age=12.0, wave_speed=1200,
                       valves=["V003"], connected_users=[]),
            PipeSection(section_id="S004", name="主干1-主干2", from_node="N004", to_node="N005",
                       length=1000, diameter=300, material="铸铁", roughness=0.015, age=18.0, wave_speed=1200,
                       valves=["V004", "V005"], connected_users=[]),
            PipeSection(section_id="S005", name="主干2-主干3", from_node="N005", to_node="N006",
                       length=1000, diameter=250, material="球墨铸铁", roughness=0.012, age=8.0, wave_speed=1300,
                       valves=["V006"], connected_users=[]),
            PipeSection(section_id="S006", name="主干2-东支1", from_node="N005", to_node="N007",
                       length=400, diameter=200, material="PE", roughness=0.008, age=3.0, wave_speed=400,
                       valves=["V007"], connected_users=[]),
            PipeSection(section_id="S007", name="东支1-东支2", from_node="N007", to_node="N008",
                       length=500, diameter=150, material="PE", roughness=0.008, age=3.0, wave_speed=400,
                       valves=["V008"], connected_users=["U001", "U002", "U003"]),
            PipeSection(section_id="S008", name="东支2-东区用户", from_node="N008", to_node="N011",
                       length=300, diameter=150, material="PE", roughness=0.008, age=3.0, wave_speed=400,
                       valves=["V009"], connected_users=["U004", "U005"]),
            PipeSection(section_id="S009", name="主干2-西支1", from_node="N005", to_node="N009",
                       length=400, diameter=200, material="PE", roughness=0.008, age=3.0, wave_speed=400,
                       valves=["V010"], connected_users=[]),
            PipeSection(section_id="S010", name="西支1-西支2", from_node="N009", to_node="N010",
                       length=500, diameter=150, material="PE", roughness=0.008, age=3.0, wave_speed=400,
                       valves=["V011"], connected_users=["U006", "U007"]),
            PipeSection(section_id="S011", name="西支2-西区用户", from_node="N010", to_node="N012",
                       length=300, diameter=150, material="PE", roughness=0.008, age=3.0, wave_speed=400,
                       valves=["V012"], connected_users=["U008", "U009"]),
            PipeSection(section_id="S012", name="主干3-中区用户", from_node="N006", to_node="N013",
                       length=400, diameter=200, material="铸铁", roughness=0.015, age=10.0, wave_speed=1200,
                       valves=["V013"], connected_users=["U010", "U011", "U012"]),
            PipeSection(section_id="S013", name="主干2-消防栓1", from_node="N005", to_node="N014",
                       length=200, diameter=100, material="镀锌钢管", roughness=0.01, age=5.0, wave_speed=1400,
                       valves=["V014"], connected_users=[]),
            PipeSection(section_id="S014", name="主干2-消防栓2", from_node="N005", to_node="N015",
                       length=200, diameter=100, material="镀锌钢管", roughness=0.01, age=5.0, wave_speed=1400,
                       valves=["V015"], connected_users=[]),
        ]
        
        valves = [
            Valve(valve_id="V001", name="水厂出口阀", location="水厂", 
                  from_node="N001", to_node="N002", section_id="S001", 
                  status=ValveStatus.OPEN, diameter=400, x=75, y=100, operation_priority=1),
            Valve(valve_id="V002", name="泵站出口阀", location="泵站1", 
                  from_node="N002", to_node="N004", section_id="S002", 
                  status=ValveStatus.OPEN, diameter=350, x=175, y=100, operation_priority=1),
            Valve(valve_id="V003", name="水库出口阀", location="水库1", 
                  from_node="N003", to_node="N004", section_id="S003", 
                  status=ValveStatus.OPEN, diameter=300, x=275, y=50, operation_priority=2),
            Valve(valve_id="V004", name="主干1入口阀", location="主干节点1东侧", 
                  from_node="N004", to_node="N005", section_id="S004", 
                  status=ValveStatus.OPEN, diameter=300, x=325, y=100, operation_priority=1),
            Valve(valve_id="V005", name="主干2入口阀", location="主干节点2西侧", 
                  from_node="N004", to_node="N005", section_id="S004", 
                  status=ValveStatus.OPEN, diameter=300, x=425, y=100, operation_priority=1),
            Valve(valve_id="V006", name="主干3入口阀", location="主干节点2东侧", 
                  from_node="N005", to_node="N006", section_id="S005", 
                  status=ValveStatus.OPEN, diameter=250, x=475, y=100, operation_priority=2),
            Valve(valve_id="V007", name="东支1入口阀", location="主干节点2北侧", 
                  from_node="N005", to_node="N007", section_id="S006", 
                  status=ValveStatus.OPEN, diameter=200, x=500, y=75, operation_priority=2),
            Valve(valve_id="V008", name="东支2入口阀", location="东支节点1东侧", 
                  from_node="N007", to_node="N008", section_id="S007", 
                  status=ValveStatus.OPEN, diameter=150, x=525, y=50, operation_priority=3),
            Valve(valve_id="V009", name="东区用户阀", location="东支节点2东侧", 
                  from_node="N008", to_node="N011", section_id="S008", 
                  status=ValveStatus.OPEN, diameter=150, x=625, y=50, operation_priority=3),
            Valve(valve_id="V010", name="西支1入口阀", location="主干节点2南侧", 
                  from_node="N005", to_node="N009", section_id="S009", 
                  status=ValveStatus.OPEN, diameter=200, x=500, y=125, operation_priority=2),
            Valve(valve_id="V011", name="西支2入口阀", location="西支节点1东侧", 
                  from_node="N009", to_node="N010", section_id="S010", 
                  status=ValveStatus.OPEN, diameter=150, x=525, y=150, operation_priority=3),
            Valve(valve_id="V012", name="西区用户阀", location="西支节点2东侧", 
                  from_node="N010", to_node="N012", section_id="S011", 
                  status=ValveStatus.OPEN, diameter=150, x=625, y=150, operation_priority=3),
            Valve(valve_id="V013", name="中区用户阀", location="主干节点3东侧", 
                  from_node="N006", to_node="N013", section_id="S012", 
                  status=ValveStatus.OPEN, diameter=200, x=625, y=100, operation_priority=3),
            Valve(valve_id="V014", name="消防栓1阀", location="主干节点2北侧", 
                  from_node="N005", to_node="N014", section_id="S013", 
                  status=ValveStatus.CLOSED, diameter=100, x=450, y=87, operation_priority=4),
            Valve(valve_id="V015", name="消防栓2阀", location="主干节点2南侧", 
                  from_node="N005", to_node="N015", section_id="S014", 
                  status=ValveStatus.CLOSED, diameter=100, x=450, y=112, operation_priority=4),
        ]
        
        sensors = [
            Sensor(sensor_id="P001", name="水厂压力", sensor_type=SensorType.PRESSURE,
                   location="水厂出口", node_id="N001", section_id="S001",
                   x=75, y=100, sampling_interval=60, unit="MPa", min_value=0, max_value=1.0),
            Sensor(sensor_id="P002", name="泵站压力", sensor_type=SensorType.PRESSURE,
                   location="泵站出口", node_id="N002", section_id="S002",
                   x=175, y=100, sampling_interval=60, unit="MPa", min_value=0, max_value=1.2),
            Sensor(sensor_id="P003", name="主干1压力", sensor_type=SensorType.PRESSURE,
                   location="主干节点1", node_id="N004", section_id="S004",
                   x=300, y=100, sampling_interval=60, unit="MPa", min_value=0, max_value=1.0),
            Sensor(sensor_id="P004", name="主干2压力", sensor_type=SensorType.PRESSURE,
                   location="主干节点2", node_id="N005", section_id="S005",
                   x=450, y=100, sampling_interval=60, unit="MPa", min_value=0, max_value=1.0),
            Sensor(sensor_id="P005", name="主干3压力", sensor_type=SensorType.PRESSURE,
                   location="主干节点3", node_id="N006", section_id="S012",
                   x=600, y=100, sampling_interval=60, unit="MPa", min_value=0, max_value=0.8),
            Sensor(sensor_id="F001", name="水厂流量", sensor_type=SensorType.FLOW,
                   location="水厂出口", node_id="N001", section_id="S001",
                   x=75, y=100, sampling_interval=300, unit="m³/h", min_value=0, max_value=500),
            Sensor(sensor_id="A001", name="听漏仪1", sensor_type=SensorType.ACOUSTIC,
                   location="主干管中段", section_id="S004",
                   x=375, y=100, sampling_interval=300, unit="dB"),
            Sensor(sensor_id="A002", name="听漏仪2", sensor_type=SensorType.ACOUSTIC,
                   location="东支管", section_id="S007",
                   x=550, y=50, sampling_interval=300, unit="dB"),
            Sensor(sensor_id="A003", name="听漏仪3", sensor_type=SensorType.ACOUSTIC,
                   location="西支管", section_id="S010",
                   x=550, y=150, sampling_interval=300, unit="dB"),
        ]
        
        users = [
            User(user_id="U001", name="阳光小区1号楼", address="阳光路1号", 
                 node_id="N008", section_id="S007", avg_demand=2.5, peak_demand=6.0, user_type="居民"),
            User(user_id="U002", name="阳光小区2号楼", address="阳光路2号", 
                 node_id="N008", section_id="S007", avg_demand=2.8, peak_demand=6.5, user_type="居民"),
            User(user_id="U003", name="阳光小区3号楼", address="阳光路3号", 
                 node_id="N008", section_id="S007", avg_demand=2.3, peak_demand=5.8, user_type="居民"),
            User(user_id="U004", name="幸福花园A栋", address="幸福街1号", 
                 node_id="N011", section_id="S008", avg_demand=3.0, peak_demand=7.0, user_type="居民"),
            User(user_id="U005", name="幸福花园B栋", address="幸福街2号", 
                 node_id="N011", section_id="S008", avg_demand=3.2, peak_demand=7.5, user_type="居民"),
            User(user_id="U006", name="安康社区1号", address="安康路1号", 
                 node_id="N010", section_id="S010", avg_demand=2.0, peak_demand=5.0, user_type="居民"),
            User(user_id="U007", name="安康社区2号", address="安康路2号", 
                 node_id="N010", section_id="S010", avg_demand=2.2, peak_demand=5.5, user_type="居民"),
            User(user_id="U008", name="祥和苑1栋", address="祥和路1号", 
                 node_id="N012", section_id="S011", avg_demand=2.7, peak_demand=6.2, user_type="居民"),
            User(user_id="U009", name="祥和苑2栋", address="祥和路2号", 
                 node_id="N012", section_id="S011", avg_demand=2.9, peak_demand=6.8, user_type="居民"),
            User(user_id="U010", name="中心商场", address="中心大道1号", 
                 node_id="N013", section_id="S012", avg_demand=8.0, peak_demand=20.0, user_type="商业"),
            User(user_id="U011", name="第一小学", address="教育路1号", 
                 node_id="N013", section_id="S012", avg_demand=5.0, peak_demand=12.0, user_type="公共"),
            User(user_id="U012", name="社区医院", address="健康路1号", 
                 node_id="N013", section_id="S012", avg_demand=4.0, peak_demand=10.0, user_type="公共"),
        ]
    
    # 添加到网络
    for node in nodes:
        network.add_node(node)
    
    for section in sections:
        network.add_section(section)
    
    for valve in valves:
        network.add_valve(valve)
    
    for sensor in sensors:
        network.add_sensor(sensor)
    
    for user in users:
        network.add_user(user)
    
    # 更新节点的连接管段信息
    for section in network.sections.values():
        if section.from_node in network.nodes:
            network.nodes[section.from_node].connected_sections.append(section.section_id)
        if section.to_node in network.nodes:
            network.nodes[section.to_node].connected_sections.append(section.section_id)
    
    return network
