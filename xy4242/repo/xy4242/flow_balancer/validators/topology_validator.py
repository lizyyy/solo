"""芯片拓扑校验器"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Any, Optional, Set

from ..parsers.topology_parser import TopologyData, ChannelDefinition, NodeDefinition
from ..core.units import is_valid_unit


class ValidationSeverity(Enum):
    """校验严重程度"""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class ValidationIssue:
    """校验问题"""
    code: str
    severity: ValidationSeverity
    message: str
    location: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationResult:
    """校验结果"""
    is_valid: bool = True
    issues: List[ValidationIssue] = field(default_factory=list)
    
    @property
    def errors(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == ValidationSeverity.ERROR]
    
    @property
    def warnings(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == ValidationSeverity.WARNING]
    
    @property
    def infos(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == ValidationSeverity.INFO]
    
    def add_error(self, code: str, message: str, location: Optional[str] = None, **kwargs):
        self.issues.append(ValidationIssue(
            code=code,
            severity=ValidationSeverity.ERROR,
            message=message,
            location=location,
            details=kwargs,
        ))
        self.is_valid = False
    
    def add_warning(self, code: str, message: str, location: Optional[str] = None, **kwargs):
        self.issues.append(ValidationIssue(
            code=code,
            severity=ValidationSeverity.WARNING,
            message=message,
            location=location,
            details=kwargs,
        ))
    
    def add_info(self, code: str, message: str, location: Optional[str] = None, **kwargs):
        self.issues.append(ValidationIssue(
            code=code,
            severity=ValidationSeverity.INFO,
            message=message,
            location=location,
            details=kwargs,
        ))


class TopologyValidator:
    """芯片拓扑校验器"""
    
    @classmethod
    def validate(cls, topology: TopologyData) -> ValidationResult:
        """校验拓扑数据"""
        result = ValidationResult()
        
        # 1. 校验基础结构
        cls._validate_structure(topology, result)
        
        # 2. 校验节点
        cls._validate_nodes(topology, result)
        
        # 3. 校验通道
        cls._validate_channels(topology, result)
        
        # 4. 校验连接关系
        cls._validate_connections(topology, result)
        
        # 5. 校验混合点配置
        cls._validate_mixing_point(topology, result)
        
        return result
    
    @classmethod
    def _validate_structure(cls, topology: TopologyData, result: ValidationResult):
        """校验基础结构"""
        if not topology.name:
            result.add_warning(
                "TOPOLOGY_001",
                "芯片未命名，建议提供名称以便识别",
            )
        
        if not topology.nodes:
            result.add_error(
                "TOPOLOGY_002",
                "拓扑中没有定义任何节点",
            )
        
        if not topology.channels:
            result.add_error(
                "TOPOLOGY_003",
                "拓扑中没有定义任何通道",
            )
    
    @classmethod
    def _validate_nodes(cls, topology: TopologyData, result: ValidationResult):
        """校验节点"""
        node_ids: Set[str] = set()
        
        for node_id, node in topology.nodes.items():
            # 检查重复ID
            if node_id in node_ids:
                result.add_error(
                    "NODE_001",
                    f"节点ID重复: {node_id}",
                    location=f"node.{node_id}",
                )
            node_ids.add(node_id)
            
            # 检查节点类型
            valid_types = {"junction", "inlet", "outlet", "reservoir"}
            if node.type.lower() not in valid_types:
                result.add_warning(
                    "NODE_002",
                    f"未知的节点类型: {node.type}，有效值: {valid_types}",
                    location=f"node.{node_id}",
                )
            
            # 检查坐标单位
            if node.x_unit and not is_valid_unit(node.x_unit, "length"):
                result.add_error(
                    "NODE_003",
                    f"无效的X坐标单位: {node.x_unit}",
                    location=f"node.{node_id}",
                )
            
            if node.y_unit and not is_valid_unit(node.y_unit, "length"):
                result.add_error(
                    "NODE_004",
                    f"无效的Y坐标单位: {node.y_unit}",
                    location=f"node.{node_id}",
                )
        
        # 检查是否有入口和出口节点
        inlet_nodes = [n for n in topology.nodes.values() if n.type.lower() == "inlet"]
        outlet_nodes = [n for n in topology.nodes.values() if n.type.lower() == "outlet"]
        
        if not inlet_nodes:
            result.add_warning(
                "NODE_005",
                "拓扑中没有定义入口节点 (type: inlet)",
            )
        
        if not outlet_nodes:
            result.add_warning(
                "NODE_006",
                "拓扑中没有定义出口节点 (type: outlet)",
            )
    
    @classmethod
    def _validate_channels(cls, topology: TopologyData, result: ValidationResult):
        """校验通道"""
        channel_ids: Set[str] = set()
        
        for ch_id, channel in topology.channels.items():
            # 检查重复ID
            if ch_id in channel_ids:
                result.add_error(
                    "CHANNEL_001",
                    f"通道ID重复: {ch_id}",
                    location=f"channel.{ch_id}",
                )
            channel_ids.add(ch_id)
            
            # 检查通道类型
            valid_types = {"rectangular", "circular", "trapezoidal"}
            if channel.channel_type.lower() not in valid_types:
                result.add_error(
                    "CHANNEL_002",
                    f"未知的通道类型: {channel.channel_type}，有效值: {valid_types}",
                    location=f"channel.{ch_id}",
                )
            
            # 检查几何参数
            if channel.width_value <= 0:
                result.add_error(
                    "CHANNEL_003",
                    f"通道宽度必须大于0: {channel.width_value}",
                    location=f"channel.{ch_id}",
                )
            
            if channel.height_value <= 0:
                result.add_error(
                    "CHANNEL_004",
                    f"通道高度必须大于0: {channel.height_value}",
                    location=f"channel.{ch_id}",
                )
            
            if channel.length_value <= 0:
                result.add_error(
                    "CHANNEL_005",
                    f"通道长度必须大于0: {channel.length_value}",
                    location=f"channel.{ch_id}",
                )
            
            # 检查单位
            if channel.width_unit and not is_valid_unit(channel.width_unit, "length"):
                result.add_error(
                    "CHANNEL_006",
                    f"无效的宽度单位: {channel.width_unit}",
                    location=f"channel.{ch_id}",
                )
            
            if channel.height_unit and not is_valid_unit(channel.height_unit, "length"):
                result.add_error(
                    "CHANNEL_007",
                    f"无效的高度单位: {channel.height_unit}",
                    location=f"channel.{ch_id}",
                )
            
            if channel.length_unit and not is_valid_unit(channel.length_unit, "length"):
                result.add_error(
                    "CHANNEL_008",
                    f"无效的长度单位: {channel.length_unit}",
                    location=f"channel.{ch_id}",
                )
            
            # 检查梯形通道的上宽
            if channel.channel_type.lower() == "trapezoidal":
                if channel.top_width_value is None:
                    result.add_warning(
                        "CHANNEL_009",
                        "梯形通道缺少上宽参数 (top_width)，将使用宽度作为上宽",
                        location=f"channel.{ch_id}",
                    )
                elif channel.top_width_value <= 0:
                    result.add_error(
                        "CHANNEL_010",
                        f"梯形通道上宽必须大于0: {channel.top_width_value}",
                        location=f"channel.{ch_id}",
                    )
            
            # 检查宽高比警告
            aspect_ratio = channel.width_value / channel.height_value if channel.height_value > 0 else 0
            if aspect_ratio > 20 or aspect_ratio < 0.05:
                result.add_warning(
                    "CHANNEL_011",
                    f"通道宽高比 ({aspect_ratio:.2f}) 极端，可能影响计算精度",
                    location=f"channel.{ch_id}",
                    aspect_ratio=aspect_ratio,
                )
    
    @classmethod
    def _validate_connections(cls, topology: TopologyData, result: ValidationResult):
        """校验连接关系"""
        node_ids = set(topology.nodes.keys())
        
        for ch_id, channel in topology.channels.items():
            # 检查 from 节点
            if not channel.from_node:
                result.add_error(
                    "CONN_001",
                    f"通道缺少起始节点 (from)",
                    location=f"channel.{ch_id}",
                )
            elif channel.from_node not in node_ids:
                result.add_error(
                    "CONN_002",
                    f"通道起始节点不存在: {channel.from_node}",
                    location=f"channel.{ch_id}",
                )
            
            # 检查 to 节点
            if not channel.to_node:
                result.add_error(
                    "CONN_003",
                    f"通道缺少目标节点 (to)",
                    location=f"channel.{ch_id}",
                )
            elif channel.to_node not in node_ids:
                result.add_error(
                    "CONN_004",
                    f"通道目标节点不存在: {channel.to_node}",
                    location=f"channel.{ch_id}",
                )
            
            # 检查自连接
            if channel.from_node and channel.to_node and channel.from_node == channel.to_node:
                result.add_error(
                    "CONN_005",
                    f"通道起始节点和目标节点相同",
                    location=f"channel.{ch_id}",
                )
        
        # 检查孤立节点
        connected_nodes: Set[str] = set()
        for channel in topology.channels.values():
            if channel.from_node:
                connected_nodes.add(channel.from_node)
            if channel.to_node:
                connected_nodes.add(channel.to_node)
        
        for node_id in node_ids:
            if node_id not in connected_nodes:
                result.add_warning(
                    "CONN_006",
                    f"节点 {node_id} 是孤立节点，没有连接任何通道",
                    location=f"node.{node_id}",
                )
    
    @classmethod
    def _validate_mixing_point(cls, topology: TopologyData, result: ValidationResult):
        """校验混合点配置"""
        if topology.mixing_node:
            if topology.mixing_node not in topology.nodes:
                result.add_error(
                    "MIX_001",
                    f"混合点节点不存在: {topology.mixing_node}",
                )
            else:
                # 检查混合点的连接
                mixing_node = topology.nodes[topology.mixing_node]
                incoming_count = sum(
                    1 for ch in topology.channels.values()
                    if ch.to_node == topology.mixing_node
                )
                if incoming_count < 2:
                    result.add_warning(
                        "MIX_002",
                        f"混合点只有 {incoming_count} 个输入通道，混合计算可能不准确",
                        location=f"node.{topology.mixing_node}",
                    )
        
        # 校验入口试剂映射
        for node_id, reagent_id in topology.inlet_reagents.items():
            if node_id not in topology.nodes:
                result.add_warning(
                    "MIX_003",
                    f"入口试剂映射中的节点不存在: {node_id}",
                )
