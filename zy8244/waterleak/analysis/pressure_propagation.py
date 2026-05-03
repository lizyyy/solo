"""
压力突降传播分析
分析压力传感器数据，识别压力突降事件及其传播路径
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Set
from collections import defaultdict

from ..parsers.pressure_parser import PressureParser, PressureSensor, PressureReading
from ..topology.graph import NetworkGraph
from ..parsers.repair_orders_parser import RepairOrdersParser


@dataclass
class PressureDropEvent:
    """压力突降事件"""
    sensor_id: str
    node_id: str
    event_time: datetime
    start_pressure: float
    end_pressure: float
    drop_magnitude: float
    drop_rate: float
    
    propagation_source: Optional[str] = None
    is_valid: bool = True
    exclusion_reason: Optional[str] = None


@dataclass
class PropagationPath:
    """压力传播路径"""
    source_sensor: str
    affected_sensors: List[Tuple[str, datetime]]
    estimated_leak_location: Optional[str] = None
    confidence: float = 0.0


class PressureDropAnalyzer:
    """压力突降分析器"""
    
    def __init__(
        self,
        pressure_parser: PressureParser,
        network_graph: Optional[NetworkGraph] = None,
        repair_parser: Optional[RepairOrdersParser] = None
    ):
        self.pressure_parser = pressure_parser
        self.network_graph = network_graph
        self.repair_parser = repair_parser
        
        self.drop_threshold = 0.05
        self.drop_rate_threshold = 0.01
        self.propagation_time_window = 300
    
    def analyze_pressure_drops(
        self,
        start_time: datetime,
        end_time: datetime
    ) -> List[PressureDropEvent]:
        """分析指定时间段内的压力突降事件"""
        all_events = []
        
        for sensor_id, sensor in self.pressure_parser.sensors.items():
            events = self._find_sensor_drops(sensor, start_time, end_time)
            all_events.extend(events)
        
        all_events.sort(key=lambda x: x.event_time)
        
        self._validate_events(all_events)
        
        return all_events
    
    def _find_sensor_drops(
        self,
        sensor: PressureSensor,
        start_time: datetime,
        end_time: datetime
    ) -> List[PressureDropEvent]:
        """查找单个传感器的压力突降事件"""
        events = []
        readings = [r for r in sensor.readings if start_time <= r.timestamp <= end_time]
        
        if len(readings) < 2:
            return events
        
        window_size = 5
        
        for i in range(len(readings) - window_size):
            window = readings[i:i + window_size + 1]
            
            avg_start = sum(r.pressure for r in window[:3]) / 3
            avg_end = sum(r.pressure for r in window[-3:]) / 3
            
            drop = avg_start - avg_end
            
            time_diff = (window[-1].timestamp - window[0].timestamp).total_seconds()
            drop_rate = drop / time_diff if time_diff > 0 else 0
            
            if drop >= self.drop_threshold and drop_rate >= self.drop_rate_threshold:
                event = PressureDropEvent(
                    sensor_id=sensor.id,
                    node_id=sensor.node_id,
                    event_time=window[len(window) // 2].timestamp,
                    start_pressure=avg_start,
                    end_pressure=avg_end,
                    drop_magnitude=drop,
                    drop_rate=drop_rate
                )
                events.append(event)
                break
        
        return events
    
    def _validate_events(self, events: List[PressureDropEvent]):
        """验证事件，排除阀门关闭等误判"""
        if not self.repair_parser:
            return
        
        for event in events:
            if not event.is_valid:
                continue
            
            closed_valves = self.repair_parser.get_active_valve_closures(event.event_time)
            
            if closed_valves:
                for valve in closed_valves:
                    if self._is_valve_affecting_node(valve.target_id, event.node_id):
                        event.is_valid = False
                        event.exclusion_reason = (
                            f"阀门 {valve.id} 在此时间点关闭，可能导致压力变化"
                        )
                        break
    
    def _is_valve_affecting_node(self, valve_id: str, node_id: str) -> bool:
        """检查阀门是否影响指定节点"""
        if not self.network_graph:
            return True
        
        if valve_id not in self.network_graph.valves:
            return True
        
        valve = self.network_graph.valves[valve_id]
        
        if valve.pipe_id in self.network_graph.pipes:
            pipe = self.network_graph.pipes[valve.pipe_id]
            if pipe.start_node == node_id or pipe.end_node == node_id:
                return True
        
        return True
    
    def analyze_propagation(
        self,
        events: List[PressureDropEvent]
    ) -> List[PropagationPath]:
        """分析压力突降的传播路径"""
        valid_events = [e for e in events if e.is_valid]
        
        if not valid_events:
            return []
        
        propagation_paths = []
        
        event_groups = self._group_events_by_time(valid_events)
        
        for group in event_groups:
            path = self._analyze_group_propagation(group)
            if path:
                propagation_paths.append(path)
        
        return propagation_paths
    
    def _group_events_by_time(
        self,
        events: List[PressureDropEvent]
    ) -> List[List[PressureDropEvent]]:
        """按时间分组事件"""
        if not events:
            return []
        
        events.sort(key=lambda x: x.event_time)
        
        groups = []
        current_group = [events[0]]
        group_start = events[0].event_time
        
        for event in events[1:]:
            time_diff = (event.event_time - group_start).total_seconds()
            
            if time_diff <= self.propagation_time_window:
                current_group.append(event)
            else:
                groups.append(current_group)
                current_group = [event]
                group_start = event.event_time
        
        if current_group:
            groups.append(current_group)
        
        return groups
    
    def _analyze_group_propagation(
        self,
        events: List[PressureDropEvent]
    ) -> Optional[PropagationPath]:
        """分析一组事件的传播路径"""
        if len(events) < 1:
            return None
        
        events.sort(key=lambda x: x.event_time)
        
        source_event = events[0]
        affected_events = events[1:]
        
        affected = [(e.sensor_id, e.event_time) for e in affected_events]
        
        path = PropagationPath(
            source_sensor=source_event.sensor_id,
            affected_sensors=affected
        )
        
        if self.network_graph:
            estimated_location = self._estimate_leak_location(events)
            path.estimated_leak_location = estimated_location
            path.confidence = 0.7 if estimated_location else 0.4
        
        return path
    
    def _estimate_leak_location(
        self,
        events: List[PressureDropEvent]
    ) -> Optional[str]:
        """估计漏点位置"""
        if not self.network_graph or len(events) < 2:
            return None
        
        events.sort(key=lambda x: x.event_time)
        
        if len(events) >= 3:
            nodes_with_sensors = []
            for event in events:
                if event.node_id:
                    nodes_with_sensors.append(event.node_id)
            
            if len(nodes_with_sensors) >= 2:
                common_area = self._find_common_upstream_area(nodes_with_sensors)
                if common_area:
                    return common_area
        
        return events[0].node_id
    
    def _find_common_upstream_area(self, nodes: List[str]) -> Optional[str]:
        """查找共同上游区域"""
        if len(nodes) < 2:
            return nodes[0] if nodes else None
        
        inflow_nodes = self._find_inflow_nodes()
        
        if not inflow_nodes:
            return nodes[0]
        
        all_upstreams = []
        for node in nodes:
            upstream = self.network_graph.get_upstream_pipes(node, inflow_nodes)
            all_upstreams.append(upstream)
        
        if all_upstreams:
            common = set.intersection(*all_upstreams)
            if common:
                return f"管道: {', '.join(list(common)[:3])}"
        
        return nodes[0]
    
    def _find_inflow_nodes(self) -> List[str]:
        """查找入流节点"""
        inflow_nodes = []
        
        for node_id, node in self.network_graph.nodes.items():
            if len(node.connected_pipes) == 1:
                inflow_nodes.append(node_id)
        
        return inflow_nodes[:3] if inflow_nodes else list(self.network_graph.nodes.keys())[:2]
    
    def detect_data_anomalies(self) -> Dict[str, List[str]]:
        """检测数据异常（断采、异常值等）"""
        anomalies = defaultdict(list)
        
        gaps = self.pressure_parser.detect_data_gaps(max_interval_seconds=120)
        for sensor_id, gap_list in gaps.items():
            for start, end, duration in gap_list:
                anomalies[sensor_id].append(
                    f"数据断采: {start} 至 {end}, 时长 {duration:.0f} 秒"
                )
        
        for sensor_id, sensor in self.pressure_parser.sensors.items():
            for reading in sensor.readings:
                if reading.pressure < 0.1:
                    anomalies[sensor_id].append(
                        f"压力过低: {reading.timestamp} - {reading.pressure:.3f} MPa"
                    )
                elif reading.pressure > 1.0:
                    anomalies[sensor_id].append(
                        f"压力过高: {reading.timestamp} - {reading.pressure:.3f} MPa"
                    )
        
        return dict(anomalies)
