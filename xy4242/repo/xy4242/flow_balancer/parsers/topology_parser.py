"""芯片通道拓扑解析器"""

import json
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from pathlib import Path

from ..core.units import UnitConverter, convert
from ..core.fluidics import Channel, Node, FluidNetwork, ChannelType


@dataclass
class ChannelDefinition:
    """通道定义"""
    id: str
    name: str
    channel_type: str = "rectangular"
    
    # 几何参数 (带单位)
    width_value: float = 0.0
    width_unit: str = "μm"
    height_value: float = 0.0
    height_unit: str = "μm"
    length_value: float = 0.0
    length_unit: str = "mm"
    top_width_value: Optional[float] = None
    top_width_unit: str = "μm"
    
    # 连接关系
    from_node: str = ""
    to_node: str = ""


@dataclass
class NodeDefinition:
    """节点定义"""
    id: str
    name: str = ""
    x_value: float = 0.0
    x_unit: str = "mm"
    y_value: float = 0.0
    y_unit: str = "mm"
    type: str = "junction"  # junction, inlet, outlet, reservoir


@dataclass
class TopologyData:
    """解析后的拓扑数据"""
    name: str
    version: str
    description: str
    
    channels: Dict[str, ChannelDefinition] = field(default_factory=dict)
    nodes: Dict[str, NodeDefinition] = field(default_factory=dict)
    
    # 混合点配置
    mixing_node: Optional[str] = None
    
    # 入口配置
    inlet_reagents: Dict[str, str] = field(default_factory=dict)  # node_id -> reagent_id


class TopologyParser:
    """芯片通道拓扑JSON解析器"""
    
    @classmethod
    def parse_file(cls, file_path: str) -> TopologyData:
        """从文件解析拓扑"""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"拓扑文件不存在: {file_path}")
        
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return cls.parse(data)
    
    @classmethod
    def parse(cls, data: Dict[str, Any]) -> TopologyData:
        """从字典解析拓扑"""
        
        name = data.get("name", "未命名芯片")
        version = data.get("version", "1.0")
        description = data.get("description", "")
        
        # 解析节点
        nodes: Dict[str, NodeDefinition] = {}
        node_list = data.get("nodes", [])
        for node_data in node_list:
            node = cls._parse_node(node_data)
            nodes[node.id] = node
        
        # 解析通道
        channels: Dict[str, ChannelDefinition] = {}
        channel_list = data.get("channels", [])
        for ch_data in channel_list:
            channel = cls._parse_channel(ch_data)
            channels[channel.id] = channel
        
        # 解析混合点和入口配置
        mixing_node = data.get("mixing_node")
        
        inlet_reagents: Dict[str, str] = {}
        inlet_config = data.get("inlet_reagents", {})
        for node_id, reagent_id in inlet_config.items():
            inlet_reagents[node_id] = reagent_id
        
        return TopologyData(
            name=name,
            version=version,
            description=description,
            channels=channels,
            nodes=nodes,
            mixing_node=mixing_node,
            inlet_reagents=inlet_reagents,
        )
    
    @classmethod
    def _parse_node(cls, data: Dict[str, Any]) -> NodeDefinition:
        """解析单个节点"""
        node_id = data.get("id")
        if not node_id:
            raise ValueError("节点缺少 id 字段")
        
        return NodeDefinition(
            id=node_id,
            name=data.get("name", node_id),
            x_value=float(data.get("x", 0.0)),
            x_unit=data.get("x_unit", "mm"),
            y_value=float(data.get("y", 0.0)),
            y_unit=data.get("y_unit", "mm"),
            type=data.get("type", "junction"),
        )
    
    @classmethod
    def _parse_channel(cls, data: Dict[str, Any]) -> ChannelDefinition:
        """解析单个通道"""
        ch_id = data.get("id")
        if not ch_id:
            raise ValueError("通道缺少 id 字段")
        
        return ChannelDefinition(
            id=ch_id,
            name=data.get("name", ch_id),
            channel_type=data.get("type", "rectangular"),
            
            width_value=float(data.get("width", 0.0)),
            width_unit=data.get("width_unit", "μm"),
            height_value=float(data.get("height", 0.0)),
            height_unit=data.get("height_unit", "μm"),
            length_value=float(data.get("length", 0.0)),
            length_unit=data.get("length_unit", "mm"),
            top_width_value=data.get("top_width"),
            top_width_unit=data.get("top_width_unit", "μm"),
            
            from_node=data.get("from", ""),
            to_node=data.get("to", ""),
        )


def topology_to_fluid_network(topology: TopologyData) -> FluidNetwork:
    """将解析的拓扑数据转换为流体网络"""
    network = FluidNetwork()
    
    # 添加节点
    for node_id, node_def in topology.nodes.items():
        node = Node(
            id=node_id,
            name=node_def.name,
            x=convert(node_def.x_value, node_def.x_unit, "m", "length"),
            y=convert(node_def.y_value, node_def.y_unit, "m", "length"),
            type=node_def.type,
        )
        network.add_node(node)
    
    # 添加通道
    for ch_id, ch_def in topology.channels.items():
        # 转换通道类型
        channel_type_map = {
            "rectangular": ChannelType.RECTANGULAR,
            "circular": ChannelType.CIRCULAR,
            "trapezoidal": ChannelType.TRAPEZOIDAL,
        }
        channel_type = channel_type_map.get(ch_def.channel_type.lower(), ChannelType.RECTANGULAR)
        
        # 转换几何参数到米
        width = convert(ch_def.width_value, ch_def.width_unit, "m", "length")
        height = convert(ch_def.height_value, ch_def.height_unit, "m", "length")
        length = convert(ch_def.length_value, ch_def.length_unit, "m", "length")
        
        top_width = None
        if ch_def.top_width_value is not None:
            top_width = convert(ch_def.top_width_value, ch_def.top_width_unit, "m", "length")
        
        channel = Channel(
            id=ch_id,
            name=ch_def.name,
            channel_type=channel_type,
            width=width,
            height=height,
            length=length,
            top_width=top_width,
            from_node=ch_def.from_node,
            to_node=ch_def.to_node,
        )
        network.add_channel(channel)
    
    return network
