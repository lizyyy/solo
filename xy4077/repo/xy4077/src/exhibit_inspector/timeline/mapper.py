"""路书时间映射器"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from ..models import (
    SensorRecord,
    RouteBook,
    RouteNode,
    RoutePhase,
    TransportPhase,
)


@dataclass
class MappedPhase:
    """映射的阶段"""
    route_node: RouteNode
    start_time: str
    end_time: str
    phase: RoutePhase
    sensor_count: int = 0
    records_in_phase: list[SensorRecord] | None = None


class RouteTimeMapper:
    """路书时间映射器"""
    
    def __init__(self):
        self.phase_mapping = {
            RoutePhase.DEPARTURE: TransportPhase.LOADING,
            RoutePhase.TRANSIT: TransportPhase.TRANSPORT,
            RoutePhase.STOPOVER: TransportPhase.TRANSPORT,
            RoutePhase.ARRIVAL: TransportPhase.UNLOADING,
            RoutePhase.CHECKPOINT: TransportPhase.INSPECTION,
        }
    
    def map_records_to_phases(
        self,
        records: list[SensorRecord],
        route_book: RouteBook,
    ) -> list[MappedPhase]:
        """
        将传感器记录映射到路书阶段
        
        Args:
            records: 传感器记录列表
            route_book: 路书
            
        Returns:
            按路书阶段分组的映射结果
        """
        mapped_phases = []
        
        for node in route_book.nodes:
            phase_records = []
            
            for record in records:
                if self._is_record_in_node(record, node):
                    phase_records.append(record)
            
            mapped_phase = MappedPhase(
                route_node=node,
                start_time=node.actual_start_time or node.planned_start_time,
                end_time=node.actual_end_time or node.planned_end_time,
                phase=node.phase,
                sensor_count=len(set(r.sensor_id for r in phase_records)),
                records_in_phase=phase_records,
            )
            mapped_phases.append(mapped_phase)
        
        return mapped_phases
    
    def _is_record_in_node(
        self,
        record: SensorRecord,
        node: RouteNode,
    ) -> bool:
        """检查记录是否属于某个路书节点"""
        record_time = self._parse_iso_time(record.timestamp)
        if record_time is None:
            return False
        
        if node.actual_start_time and node.actual_end_time:
            actual_start = self._parse_iso_time(node.actual_start_time)
            actual_end = self._parse_iso_time(node.actual_end_time)
            if actual_start and actual_end:
                return actual_start <= record_time <= actual_end
        
        planned_start = self._parse_iso_time(node.planned_start_time)
        planned_end = self._parse_iso_time(node.planned_end_time)
        if planned_start and planned_end:
            return planned_start <= record_time <= planned_end
        
        return False
    
    def _parse_iso_time(self, time_str: str) -> Optional[datetime]:
        """解析ISO格式时间字符串"""
        try:
            if "T" in time_str:
                return datetime.fromisoformat(time_str)
            else:
                return datetime.fromisoformat(time_str.replace(" ", "T"))
        except (ValueError, TypeError):
            return None
    
    def get_transport_phase(
        self,
        route_phase: RoutePhase,
    ) -> TransportPhase:
        """将路书阶段转换为运输阶段"""
        return self.phase_mapping.get(route_phase, TransportPhase.TRANSPORT)
    
    def detect_open_box_times(
        self,
        records: list[SensorRecord],
        route_book: RouteBook,
    ) -> list[dict]:
        """
        检测开箱时段（根据温度/湿度突变或路书节点）
        
        Args:
            records: 传感器记录列表
            route_book: 路书
            
        Returns:
            检测到的开箱时段列表
        """
        open_box_events = []
        
        unload_nodes = [
            node for node in route_book.nodes
            if node.phase in [RoutePhase.ARRIVAL, RoutePhase.CHECKPOINT]
        ]
        
        for node in unload_nodes:
            event = {
                "node_id": node.node_id,
                "location": node.location,
                "planned_start": node.planned_start_time,
                "planned_end": node.planned_end_time,
                "actual_start": node.actual_start_time,
                "actual_end": node.actual_end_time,
                "phase": node.phase.value,
                "detected_by": "route_book",
            }
            open_box_events.append(event)
        
        return open_box_events
    
    def validate_open_box_consistency(
        self,
        records: list[SensorRecord],
        route_book: RouteBook,
    ) -> dict:
        """
        验证开箱时段与路书是否一致
        
        Args:
            records: 传感器记录列表
            route_book: 路书
            
        Returns:
            一致性验证结果
        """
        detected_times = self.detect_open_box_times(records, route_book)
        
        result = {
            "consistent": True,
            "mismatches": [],
            "unexpected_openings": [],
            "missing_openings": [],
        }
        
        expected_phases = [RoutePhase.ARRIVAL, RoutePhase.CHECKPOINT]
        expected_nodes = [n for n in route_book.nodes if n.phase in expected_phases]
        
        for node in expected_nodes:
            node_time = self._parse_iso_time(node.planned_start_time)
            
            found_match = False
            for event in detected_times:
                if event["node_id"] == node.node_id:
                    found_match = True
                    break
            
            if not found_match:
                result["missing_openings"].append({
                    "node_id": node.node_id,
                    "location": node.location,
                    "expected_time": node.planned_start_time,
                })
                result["consistent"] = False
        
        return result
