"""流体力学计算模块 - 微流控芯片核心计算"""

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
import copy

from .units import UnitConverter, convert


class ChannelType(Enum):
    """通道类型"""
    RECTANGULAR = "rectangular"
    CIRCULAR = "circular"
    TRAPEZOIDAL = "trapezoidal"


@dataclass
class Channel:
    """微流控通道"""
    id: str
    name: str
    channel_type: ChannelType = ChannelType.RECTANGULAR
    
    # 几何参数
    width: float = 0.0  # 宽度 (米)
    height: float = 0.0  # 高度/直径 (米)
    length: float = 0.0  # 长度 (米)
    top_width: Optional[float] = None  # 梯形上宽 (米)
    
    # 连接关系
    from_node: str = ""
    to_node: str = ""
    
    # 材质参数
    surface_roughness: float = 0.0  # 表面粗糙度 (米)
    
    # 计算结果缓存
    _hydraulic_diameter: Optional[float] = None
    _cross_sectional_area: Optional[float] = None
    _resistance: Optional[float] = None
    
    @property
    def hydraulic_diameter(self) -> float:
        """计算水力直径 (米)"""
        if self._hydraulic_diameter is not None:
            return self._hydraulic_diameter
        
        if self.channel_type == ChannelType.CIRCULAR:
            self._hydraulic_diameter = self.height
        elif self.channel_type == ChannelType.RECTANGULAR:
            w = self.width
            h = self.height
            self._hydraulic_diameter = 2 * w * h / (w + h)
        elif self.channel_type == ChannelType.TRAPEZOIDAL:
            w1 = self.width
            w2 = self.top_width if self.top_width else self.width
            h = self.height
            area = (w1 + w2) * h / 2
            side_length = math.sqrt(((w2 - w1) / 2) ** 2 + h ** 2)
            wetted_perimeter = w1 + w2 + 2 * side_length
            self._hydraulic_diameter = 4 * area / wetted_perimeter
        else:
            self._hydraulic_diameter = self.height
        
        return self._hydraulic_diameter
    
    @property
    def cross_sectional_area(self) -> float:
        """计算横截面积 (平方米)"""
        if self._cross_sectional_area is not None:
            return self._cross_sectional_area
        
        if self.channel_type == ChannelType.CIRCULAR:
            r = self.height / 2
            self._cross_sectional_area = math.pi * r * r
        elif self.channel_type == ChannelType.RECTANGULAR:
            self._cross_sectional_area = self.width * self.height
        elif self.channel_type == ChannelType.TRAPEZOIDAL:
            w1 = self.width
            w2 = self.top_width if self.top_width else self.width
            h = self.height
            self._cross_sectional_area = (w1 + w2) * h / 2
        else:
            self._cross_sectional_area = self.width * self.height
        
        return self._cross_sectional_area
    
    @property
    def volume(self) -> float:
        """计算通道体积 (立方米)"""
        return self.cross_sectional_area * self.length
    
    def calculate_resistance(self, viscosity: float) -> float:
        """
        计算通道的流体阻力 (基于泊肃叶定律)
        
        Args:
            viscosity: 流体黏度 (Pa·s)
        
        Returns:
            流体阻力 (Pa·s/m³)
        """
        # 矩形通道的泊肃叶阻力公式
        # 对于宽高比 > 5 的矩形，近似为: R = 12 * μ * L / (w * h³)
        # 更精确的公式: R = 12 * μ * L / (w * h³) * [1 - (192 * h / (π^5 * w)) * tanh(π * w / (2 * h))]
        
        if self.channel_type == ChannelType.CIRCULAR:
            # 圆形通道: R = 8 * μ * L / (π * r^4)
            r = self.height / 2
            r4 = r ** 4
            return 8 * viscosity * self.length / (math.pi * r4)
        
        elif self.channel_type == ChannelType.RECTANGULAR:
            w = self.width
            h = self.height
            
            # 基础公式
            base = 12 * viscosity * self.length / (w * (h ** 3))
            
            # 宽高比修正因子
            aspect_ratio = w / h if w > h else h / w
            
            if aspect_ratio >= 10:
                # 宽高比很大时，近似为无限平行板
                correction = 1.0
            else:
                # 使用 Shah & London 近似公式
                alpha = min(w, h) / max(w, h)
                correction = 1.0 - (192 * alpha / (math.pi ** 5)) * math.tanh(math.pi / (2 * alpha))
            
            return base * correction
        
        elif self.channel_type == ChannelType.TRAPEZOIDAL:
            # 梯形通道近似为等效矩形
            w1 = self.width
            w2 = self.top_width if self.top_width else self.width
            avg_width = (w1 + w2) / 2
            h = self.height
            
            base = 12 * viscosity * self.length / (avg_width * (h ** 3))
            return base
        
        else:
            # 默认矩形
            return 12 * viscosity * self.length / (self.width * (self.height ** 3))
    
    def calculate_pressure_drop(
        self,
        flow_rate: float,
        viscosity: float,
    ) -> float:
        """
        计算通道压降
        
        Args:
            flow_rate: 流量 (m³/s)
            viscosity: 流体黏度 (Pa·s)
        
        Returns:
            压降 (Pa)
        """
        resistance = self.calculate_resistance(viscosity)
        return resistance * flow_rate
    
    def calculate_residence_time(self, flow_rate: float) -> float:
        """
        计算流体在通道中的停留时间
        
        Args:
            flow_rate: 流量 (m³/s)
        
        Returns:
            停留时间 (秒)
        """
        if flow_rate <= 0:
            return float('inf')
        return self.volume / flow_rate
    
    def calculate_average_velocity(self, flow_rate: float) -> float:
        """
        计算平均流速
        
        Args:
            flow_rate: 流量 (m³/s)
        
        Returns:
            平均流速 (m/s)
        """
        if self.cross_sectional_area <= 0:
            return 0.0
        return flow_rate / self.cross_sectional_area


@dataclass
class Node:
    """微流控网络节点"""
    id: str
    name: str = ""
    x: float = 0.0
    y: float = 0.0
    type: str = "junction"  # junction, inlet, outlet, reservoir


@dataclass
class FluidNetwork:
    """微流控流体网络"""
    channels: Dict[str, Channel] = field(default_factory=dict)
    nodes: Dict[str, Node] = field(default_factory=dict)
    
    def add_channel(self, channel: Channel) -> None:
        """添加通道"""
        self.channels[channel.id] = channel
    
    def add_node(self, node: Node) -> None:
        """添加节点"""
        self.nodes[node.id] = node
    
    def get_incoming_channels(self, node_id: str) -> List[Channel]:
        """获取进入指定节点的所有通道"""
        return [c for c in self.channels.values() if c.to_node == node_id]
    
    def get_outgoing_channels(self, node_id: str) -> List[Channel]:
        """获取离开指定节点的所有通道"""
        return [c for c in self.channels.values() if c.from_node == node_id]
    
    def get_inlet_nodes(self) -> List[Node]:
        """获取所有入口节点"""
        return [n for n in self.nodes.values() if n.type == "inlet"]
    
    def get_outlet_nodes(self) -> List[Node]:
        """获取所有出口节点"""
        return [n for n in self.nodes.values() if n.type == "outlet"]


@dataclass
class MixingRatio:
    """混合比例"""
    reagent_id: str
    reagent_name: str
    target_ratio: float  # 目标比例 (0-1)
    actual_ratio: float  # 实际比例 (0-1)
    
    @property
    def deviation(self) -> float:
        """比例偏差"""
        return self.actual_ratio - self.target_ratio
    
    @property
    def relative_deviation(self) -> float:
        """相对比例偏差 (%)"""
        if self.target_ratio == 0:
            return 0.0
        return (self.deviation / self.target_ratio) * 100


@dataclass
class TimeSegmentResult:
    """单个时间段的仿真结果"""
    time_start: float  # 开始时间 (秒)
    time_end: float  # 结束时间 (秒)
    duration: float  # 持续时间 (秒)
    
    # 各通道的流量
    channel_flow_rates: Dict[str, float]  # channel_id -> flow_rate (m³/s)
    
    # 各通道的压降
    channel_pressure_drops: Dict[str, float]  # channel_id -> pressure_drop (Pa)
    
    # 各节点压力
    node_pressures: Dict[str, float]  # node_id -> pressure (Pa)
    
    # 各试剂的延迟体积 (从入口到混合点的体积)
    delay_volumes: Dict[str, float]  # reagent_id -> volume (m³)
    
    # 混合比例
    mixing_ratios: List[MixingRatio]
    
    # 各试剂的入口流量
    inlet_flow_rates: Dict[str, float]  # reagent_id -> flow_rate (m³/s)


@dataclass
class SimulationResult:
    """完整仿真结果"""
    total_time: float  # 总仿真时间 (秒)
    time_segments: List[TimeSegmentResult]
    
    # 汇总统计
    max_pressure_drop: float  # 最大压降 (Pa)
    max_relative_deviation: float  # 最大相对比例偏差 (%)
    total_dead_volume: float  # 总死体积 (m³)
    
    # 风险标记
    risks: List[Dict[str, Any]] = field(default_factory=list)


class FluidicsSimulator:
    """微流控仿真器"""
    
    def __init__(self, network: FluidNetwork):
        self.network = network
    
    def calculate_flow_distribution(
        self,
        inlet_flows: Dict[str, float],
        viscosity: float,
    ) -> Tuple[Dict[str, float], Dict[str, float]]:
        """
        计算网络中的流量分配
        
        使用简单的流量守恒和阻力分压方法
        
        Args:
            inlet_flows: 入口流量字典 {node_id: flow_rate (m³/s)}
            viscosity: 流体黏度 (Pa·s)
        
        Returns:
            (channel_flow_rates, node_pressures)
        """
        channel_flows: Dict[str, float] = {}
        node_pressures: Dict[str, float] = {}
        
        # 初始化所有通道流量为0
        for ch_id in self.network.channels:
            channel_flows[ch_id] = 0.0
        
        # 简单的图遍历方法
        # 这是一个简化版本，实际复杂网络可能需要更复杂的求解器
        
        # 记录每个节点的总流入和流出
        node_inflow: Dict[str, float] = {n_id: 0.0 for n_id in self.network.nodes}
        node_outflow: Dict[str, float] = {n_id: 0.0 for n_id in self.network.nodes}
        
        # 设置入口流量
        for node_id, flow in inlet_flows.items():
            node_inflow[node_id] = flow
        
        # 找到从入口到出口的路径并分配流量
        # 这是简化的方法，假设网络是树状结构
        
        # 首先计算所有通道的阻力
        channel_resistances: Dict[str, float] = {}
        for ch_id, channel in self.network.channels.items():
            channel_resistances[ch_id] = channel.calculate_resistance(viscosity)
        
        # 简单的比例分配算法
        # 对于每个节点，根据下游阻力分配流量
        
        # 从入口开始进行流量分配
        visited = set()
        queue = list(inlet_flows.keys())
        
        while queue:
            current_node = queue.pop(0)
            if current_node in visited:
                continue
            visited.add(current_node)
            
            outgoing = self.network.get_outgoing_channels(current_node)
            
            if not outgoing:
                continue
            
            # 计算各分支的总阻力
            branch_resistances: Dict[str, float] = {}
            for ch in outgoing:
                # 简化: 只考虑直接阻力
                branch_resistances[ch.id] = channel_resistances[ch.id]
            
            total_resistance_inv = sum(1.0 / r for r in branch_resistances.values())
            
            # 获取当前节点的可用流量
            available_flow = node_inflow[current_node] - node_outflow[current_node]
            
            # 根据阻力比例分配流量
            for ch in outgoing:
                # 流量与阻力成反比
                flow_share = (1.0 / branch_resistances[ch.id]) / total_resistance_inv if total_resistance_inv > 0 else 1.0 / len(outgoing)
                channel_flow = available_flow * flow_share
                
                channel_flows[ch.id] = channel_flow
                
                # 更新下游节点的流入
                downstream_node = ch.to_node
                node_inflow[downstream_node] += channel_flow
                
                if downstream_node not in visited:
                    queue.append(downstream_node)
            
            node_outflow[current_node] = available_flow
        
        # 简化的压力计算 (假设出口压力为0)
        outlet_nodes = self.network.get_outlet_nodes()
        for node in outlet_nodes:
            node_pressures[node.id] = 0.0
        
        # 从出口反推压力
        # 简化版本
        for ch_id, channel in self.network.channels.items():
            flow = channel_flows.get(ch_id, 0.0)
            resistance = channel_resistances[ch_id]
            pressure_drop = flow * resistance
            
            # 设置节点压力 (简化处理)
            if channel.to_node not in node_pressures:
                node_pressures[channel.to_node] = 0.0
            node_pressures[channel.from_node] = node_pressures[channel.to_node] + pressure_drop
        
        return channel_flows, node_pressures
    
    def calculate_channel_pressure_drops(
        self,
        channel_flows: Dict[str, float],
        viscosity: float,
    ) -> Dict[str, float]:
        """计算各通道的压降"""
        pressure_drops: Dict[str, float] = {}
        
        for ch_id, flow_rate in channel_flows.items():
            channel = self.network.channels.get(ch_id)
            if channel:
                pressure_drops[ch_id] = channel.calculate_pressure_drop(flow_rate, viscosity)
        
        return pressure_drops
    
    def calculate_delay_volume(
        self,
        inlet_node_id: str,
        outlet_node_id: str,
    ) -> float:
        """
        计算从入口到出口的延迟体积
        
        这是简化版本，假设只有一条路径
        """
        # 简单的 BFS 找路径
        from collections import deque
        
        queue = deque([(inlet_node_id, 0.0)])
        visited = {inlet_node_id: 0.0}
        
        while queue:
            current, volume = queue.popleft()
            
            if current == outlet_node_id:
                return volume
            
            outgoing = self.network.get_outgoing_channels(current)
            for ch in outgoing:
                next_node = ch.to_node
                new_volume = volume + ch.volume
                
                if next_node not in visited or new_volume < visited[next_node]:
                    visited[next_node] = new_volume
                    queue.append((next_node, new_volume))
        
        return 0.0
    
    def calculate_mixing_ratios(
        self,
        inlet_flows: Dict[str, float],
        target_ratios: Dict[str, float],
        reagent_names: Optional[Dict[str, str]] = None,
    ) -> List[MixingRatio]:
        """
        计算混合比例
        
        Args:
            inlet_flows: 入口流量 {node_id/reagent_id: flow_rate}
            target_ratios: 目标比例 {reagent_id: ratio}
            reagent_names: 试剂名称 {reagent_id: name}
        
        Returns:
            混合比例列表
        """
        if reagent_names is None:
            reagent_names = {}
        
        total_flow = sum(inlet_flows.values())
        
        ratios: List[MixingRatio] = []
        
        for reagent_id, flow in inlet_flows.items():
            actual_ratio = flow / total_flow if total_flow > 0 else 0.0
            target_ratio = target_ratios.get(reagent_id, 0.0)
            
            ratios.append(MixingRatio(
                reagent_id=reagent_id,
                reagent_name=reagent_names.get(reagent_id, reagent_id),
                target_ratio=target_ratio,
                actual_ratio=actual_ratio,
            ))
        
        return ratios
    
    def simulate(
        self,
        program_segments: List[Dict[str, Any]],
        viscosity: float,
        target_ratios: Dict[str, float],
        reagent_names: Optional[Dict[str, str]] = None,
        mixing_node_id: Optional[str] = None,
    ) -> SimulationResult:
        """
        执行完整仿真
        
        Args:
            program_segments: 程序时间段列表
                每个元素: {
                    "duration": 持续时间(秒),
                    "inlet_flows": {node_id: flow_rate (m³/s)},
                }
            viscosity: 流体黏度 (Pa·s)
            target_ratios: 目标混合比例 {reagent_id: ratio}
            reagent_names: 试剂名称 {reagent_id: name}
            mixing_node_id: 混合节点ID
        
        Returns:
            仿真结果
        """
        if reagent_names is None:
            reagent_names = {}
        
        time_segments: List[TimeSegmentResult] = []
        current_time = 0.0
        
        max_pressure_drop = 0.0
        max_relative_deviation = 0.0
        total_dead_volume = sum(ch.volume for ch in self.network.channels.values())
        
        for segment in program_segments:
            duration = segment.get("duration", 0.0)
            inlet_flows = segment.get("inlet_flows", {})
            
            # 计算流量分配
            channel_flows, node_pressures = self.calculate_flow_distribution(
                inlet_flows, viscosity
            )
            
            # 计算压降
            pressure_drops = self.calculate_channel_pressure_drops(channel_flows, viscosity)
            
            # 计算延迟体积
            delay_volumes: Dict[str, float] = {}
            if mixing_node_id:
                for reagent_id in inlet_flows.keys():
                    # 假设 reagent_id 对应入口节点
                    delay_volumes[reagent_id] = self.calculate_delay_volume(
                        reagent_id, mixing_node_id
                    )
            
            # 计算混合比例
            mixing_ratios = self.calculate_mixing_ratios(
                inlet_flows, target_ratios, reagent_names
            )
            
            # 更新统计值
            if pressure_drops:
                current_max_p = max(pressure_drops.values())
                max_pressure_drop = max(max_pressure_drop, current_max_p)
            
            for ratio in mixing_ratios:
                abs_deviation = abs(ratio.relative_deviation)
                max_relative_deviation = max(max_relative_deviation, abs_deviation)
            
            # 创建时间段结果
            time_segments.append(TimeSegmentResult(
                time_start=current_time,
                time_end=current_time + duration,
                duration=duration,
                channel_flow_rates=channel_flows,
                channel_pressure_drops=pressure_drops,
                node_pressures=node_pressures,
                delay_volumes=delay_volumes,
                mixing_ratios=mixing_ratios,
                inlet_flow_rates=inlet_flows.copy(),
            ))
            
            current_time += duration
        
        # 风险评估
        risks = []
        
        # 高压降风险
        if max_pressure_drop > 1e5:  # > 1 bar
            risks.append({
                "type": "high_pressure",
                "severity": "high",
                "message": f"检测到高压降 ({max_pressure_drop:.2e} Pa)，可能导致芯片破裂或泄漏",
                "value": max_pressure_drop,
                "unit": "Pa",
                "threshold": 1e5,
            })
        
        # 比例偏差风险
        if max_relative_deviation > 5.0:  # > 5%
            risks.append({
                "type": "ratio_deviation",
                "severity": "medium",
                "message": f"混合比例偏差过大 ({max_relative_deviation:.2f}%)，可能影响实验结果",
                "value": max_relative_deviation,
                "unit": "%",
                "threshold": 5.0,
            })
        
        # 死体积风险
        dead_volume_uL = convert(total_dead_volume, "m3", "uL", "volume")
        if dead_volume_uL > 10.0:  # > 10 μL
            risks.append({
                "type": "dead_volume",
                "severity": "medium",
                "message": f"系统死体积较大 ({dead_volume_uL:.2f} μL)，可能导致试剂残留和切换延迟",
                "value": dead_volume_uL,
                "unit": "μL",
                "threshold": 10.0,
            })
        
        return SimulationResult(
            total_time=current_time,
            time_segments=time_segments,
            max_pressure_drop=max_pressure_drop,
            max_relative_deviation=max_relative_deviation,
            total_dead_volume=total_dead_volume,
            risks=risks,
        )
