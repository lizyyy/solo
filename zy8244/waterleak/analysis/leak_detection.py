"""
漏点定位分析
综合水量平衡和压力突降分析结果，定位可疑漏点
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Set
from collections import defaultdict

from .water_balance import ZoneBalanceResult
from .pressure_propagation import PressureDropEvent, PropagationPath
from ..topology.graph import NetworkGraph
from ..parsers.pipes_parser import Zone, Pipe


@dataclass
class SuspectedLeak:
    """可疑漏点"""
    leak_id: str
    location_description: str
    confidence: float
    
    zone_id: Optional[str] = None
    pipe_id: Optional[str] = None
    node_id: Optional[str] = None
    
    evidence_types: List[str] = field(default_factory=list)
    evidence_details: Dict[str, str] = field(default_factory=dict)
    
    estimated_time: Optional[datetime] = None
    estimated_water_loss: float = 0.0
    
    priority: str = "medium"
    is_false_positive: bool = False
    false_positive_reason: Optional[str] = None


@dataclass
class IsolationStep:
    """隔离步骤"""
    step_number: int
    action: str
    target_id: str
    target_type: str
    description: str
    
    expected_outcome: str = ""
    safety_notes: str = ""


class LeakLocator:
    """漏点定位器"""
    
    def __init__(self, network_graph: Optional[NetworkGraph] = None):
        self.network_graph = network_graph
        self.suspected_leaks: List[SuspectedLeak] = []
        self._leak_counter = 0
    
    def locate_leaks(
        self,
        balance_results: List[ZoneBalanceResult],
        pressure_events: List[PressureDropEvent],
        propagation_paths: List[PropagationPath]
    ) -> List[SuspectedLeak]:
        """综合分析定位漏点"""
        self.suspected_leaks = []
        
        self._analyze_zone_imbalance(balance_results)
        
        self._analyze_pressure_events(pressure_events, propagation_paths)
        
        self._correlate_findings()
        
        self._calculate_priorities()
        
        return self.suspected_leaks
    
    def _analyze_zone_imbalance(self, balance_results: List[ZoneBalanceResult]):
        """分析分区水量不平衡"""
        for result in balance_results:
            if not result.is_suspicious:
                continue
            
            if result.excluded_reasons:
                continue
            
            if result.unaccounted_water <= 0:
                continue
            
            self._leak_counter += 1
            leak = SuspectedLeak(
                leak_id=f"LEAK-{self._leak_counter:03d}",
                location_description=f"分区 {result.zone_name} ({result.zone_id})",
                confidence=0.6,
                zone_id=result.zone_id,
                evidence_types=["水量不平衡"],
                estimated_water_loss=result.unaccounted_water
            )
            
            leak.evidence_details["水量不平衡"] = (
                f"入流量: {result.total_inflow:.2f} m³, "
                f"用户用量: {result.total_user_consumption:.2f} m³, "
                f"漏损率: {result.loss_rate:.1%}"
            )
            
            self.suspected_leaks.append(leak)
    
    def _analyze_pressure_events(
        self,
        events: List[PressureDropEvent],
        paths: List[PropagationPath]
    ):
        """分析压力突降事件"""
        valid_events = [e for e in events if e.is_valid]
        
        for event in valid_events:
            self._leak_counter += 1
            leak = SuspectedLeak(
                leak_id=f"LEAK-{self._leak_counter:03d}",
                location_description=f"节点 {event.node_id or event.sensor_id} 附近",
                confidence=0.5,
                node_id=event.node_id,
                evidence_types=["压力突降"],
                estimated_time=event.event_time
            )
            
            leak.evidence_details["压力突降"] = (
                f"传感器 {event.sensor_id}, "
                f"时间 {event.event_time}, "
                f"压降 {event.drop_magnitude:.3f} MPa"
            )
            
            self.suspected_leaks.append(leak)
        
        for path in paths:
            if not path.estimated_leak_location:
                continue
            
            existing = [l for l in self.suspected_leaks 
                       if l.location_description in path.estimated_leak_location]
            
            if existing:
                for leak in existing:
                    if "压力传播" not in leak.evidence_types:
                        leak.evidence_types.append("压力传播")
                    leak.evidence_details["压力传播"] = (
                        f"源传感器: {path.source_sensor}, "
                        f"影响传感器: {len(path.affected_sensors)} 个, "
                        f"置信度: {path.confidence:.0%}"
                    )
                    leak.confidence = max(leak.confidence, path.confidence)
    
    def _correlate_findings(self):
        """关联不同来源的发现"""
        if not self.network_graph:
            return
        
        zone_leaks = [l for l in self.suspected_leaks if l.zone_id]
        node_leaks = [l for l in self.suspected_leaks if l.node_id]
        
        for zone_leak in zone_leaks:
            zone = self.network_graph.zones.get(zone_leak.zone_id)
            if not zone:
                continue
            
            for node_leak in node_leaks:
                if self._is_node_in_zone(node_leak.node_id, zone):
                    zone_leak.evidence_types.extend(node_leak.evidence_types)
                    zone_leak.evidence_details.update(node_leak.evidence_details)
                    zone_leak.node_id = node_leak.node_id
                    zone_leak.confidence = min(0.95, zone_leak.confidence + 0.2)
                    
                    node_leak.is_false_positive = True
                    node_leak.false_positive_reason = f"已合并到分区漏点 {zone_leak.leak_id}"
        
        self.suspected_leaks = [l for l in self.suspected_leaks if not l.is_false_positive]
    
    def _is_node_in_zone(self, node_id: Optional[str], zone: Zone) -> bool:
        """检查节点是否在分区内"""
        if not node_id:
            return False
        
        for pipe_id in zone.pipe_ids:
            if pipe_id in self.network_graph.pipes:
                pipe = self.network_graph.pipes[pipe_id]
                if pipe.start_node == node_id or pipe.end_node == node_id:
                    return True
        return False
    
    def _calculate_priorities(self):
        """计算优先级"""
        for leak in self.suspected_leaks:
            if leak.estimated_water_loss > 50:
                leak.priority = "high"
            elif leak.estimated_water_loss > 20:
                leak.priority = "medium"
            elif leak.confidence > 0.8:
                leak.priority = "medium"
            else:
                leak.priority = "low"
    
    def generate_isolation_plan(
        self,
        leaks: List[SuspectedLeak]
    ) -> List[IsolationStep]:
        """生成隔离计划"""
        steps = []
        step_num = 0
        
        high_priority = [l for l in leaks if l.priority == "high"]
        medium_priority = [l for l in leaks if l.priority == "medium"]
        low_priority = [l for l in leaks if l.priority == "low"]
        
        sorted_leaks = high_priority + medium_priority + low_priority
        
        for leak in sorted_leaks:
            step_num += 1
            step = self._create_isolation_step(leak, step_num)
            if step:
                steps.append(step)
        
        return steps
    
    def _create_isolation_step(
        self,
        leak: SuspectedLeak,
        step_num: int
    ) -> Optional[IsolationStep]:
        """创建单个隔离步骤"""
        if not self.network_graph:
            return IsolationStep(
                step_number=step_num,
                action="检查",
                target_id=leak.leak_id,
                target_type="leak",
                description=f"检查可疑漏点位置: {leak.location_description}",
                expected_outcome="确认漏点位置",
                safety_notes=f"置信度: {leak.confidence:.0%}"
            )
        
        target_pipes = []
        
        if leak.pipe_id and leak.pipe_id in self.network_graph.pipes:
            target_pipes.append(leak.pipe_id)
        
        if leak.zone_id and leak.zone_id in self.network_graph.zones:
            zone = self.network_graph.zones[leak.zone_id]
            boundary_pipes = self.network_graph.get_zone_boundary_pipes(leak.zone_id)
            target_pipes.extend(boundary_pipes)
        
        if not target_pipes:
            return IsolationStep(
                step_number=step_num,
                action="检查",
                target_id=leak.leak_id,
                target_type="area",
                description=f"检查区域: {leak.location_description}",
                expected_outcome="查找漏点迹象",
                safety_notes=f"证据: {', '.join(leak.evidence_types)}"
            )
        
        valve_to_close = None
        for valve_id, valve in self.network_graph.valves.items():
            if valve.pipe_id in target_pipes:
                valve_to_close = valve_id
                break
        
        if valve_to_close:
            return IsolationStep(
                step_number=step_num,
                action="关闭阀门",
                target_id=valve_to_close,
                target_type="valve",
                description=f"关闭阀门 {valve_to_close} 以隔离可疑漏点区域",
                expected_outcome=f"隔离区域: {leak.location_description}",
                safety_notes=f"优先级: {leak.priority}, 置信度: {leak.confidence:.0%}"
            )
        
        return IsolationStep(
            step_number=step_num,
            action="检查管道",
            target_id=target_pipes[0] if target_pipes else leak.leak_id,
            target_type="pipe",
            description=f"检查管道 {', '.join(target_pipes[:3])} 是否存在漏损",
            expected_outcome="确认漏点位置",
            safety_notes=f"预计漏损: {leak.estimated_water_loss:.1f} m³"
        )
