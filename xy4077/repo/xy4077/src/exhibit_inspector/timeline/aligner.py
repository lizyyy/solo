"""时间轴对齐器"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from ..models import SensorRecord, RouteBook, RouteNode


@dataclass
class AlignedRecord:
    """对齐后的记录"""
    record: SensorRecord
    route_node: Optional[RouteNode] = None
    phase: Optional[str] = None


@dataclass
class AlignmentResult:
    """对齐结果"""
    box_id: str
    sensor_id: str
    records: list[AlignedRecord] = field(default_factory=list)
    total_records: int = 0
    aligned_records: int = 0
    unaligned_records: int = 0
    time_range_start: Optional[str] = None
    time_range_end: Optional[str] = None


class TimelineAligner:
    """时间轴对齐器"""
    
    def __init__(self):
        pass
    
    def align_sensor_to_route(
        self,
        records: list[SensorRecord],
        route_book: RouteBook,
    ) -> dict[tuple[str, str], AlignmentResult]:
        """
        将传感器记录对齐到路书时间轴
        
        Args:
            records: 传感器记录列表
            route_book: 路书
            
        Returns:
            按(box_id, sensor_id)分组的对齐结果
        """
        grouped_records = self._group_records(records)
        results = {}
        
        for key, group_records in grouped_records.items():
            box_id, sensor_id = key
            result = self._align_group(group_records, route_book, box_id, sensor_id)
            results[key] = result
        
        return results
    
    def _group_records(
        self,
        records: list[SensorRecord],
    ) -> dict[tuple[str, str], list[SensorRecord]]:
        """按(box_id, sensor_id)分组记录"""
        groups: dict[tuple[str, str], list[SensorRecord]] = {}
        
        for record in records:
            key = (record.box_id, record.sensor_id)
            if key not in groups:
                groups[key] = []
            groups[key].append(record)
        
        for key in groups:
            groups[key].sort(key=lambda r: r.timestamp)
        
        return groups
    
    def _align_group(
        self,
        records: list[SensorRecord],
        route_book: RouteBook,
        box_id: str,
        sensor_id: str,
    ) -> AlignmentResult:
        """对齐单个传感器的记录"""
        result = AlignmentResult(
            box_id=box_id,
            sensor_id=sensor_id,
            total_records=len(records),
        )
        
        if not records:
            return result
        
        result.time_range_start = records[0].timestamp
        result.time_range_end = records[-1].timestamp
        
        for record in records:
            node = self._find_route_node(record, route_book)
            
            aligned = AlignedRecord(
                record=record,
                route_node=node,
                phase=node.phase.value if node else None,
            )
            result.records.append(aligned)
            
            if node:
                result.aligned_records += 1
            else:
                result.unaligned_records += 1
        
        return result
    
    def _find_route_node(
        self,
        record: SensorRecord,
        route_book: RouteBook,
    ) -> Optional[RouteNode]:
        """查找记录所属的路书节点"""
        record_time = self._parse_iso_time(record.timestamp)
        if record_time is None:
            return None
        
        for node in route_book.nodes:
            start_time = self._parse_iso_time(node.planned_start_time)
            end_time = self._parse_iso_time(node.planned_end_time)
            
            if start_time is None or end_time is None:
                continue
            
            if start_time <= record_time <= end_time:
                return node
            
            if node.actual_start_time and node.actual_end_time:
                actual_start = self._parse_iso_time(node.actual_start_time)
                actual_end = self._parse_iso_time(node.actual_end_time)
                if actual_start and actual_end:
                    if actual_start <= record_time <= actual_end:
                        return node
        
        return None
    
    def _parse_iso_time(self, time_str: str) -> Optional[datetime]:
        """解析ISO格式时间字符串"""
        try:
            if "T" in time_str:
                return datetime.fromisoformat(time_str)
            else:
                return datetime.fromisoformat(time_str.replace(" ", "T"))
        except (ValueError, TypeError):
            return None
    
    def get_time_coverage(
        self,
        records: list[SensorRecord],
    ) -> dict[str, tuple[datetime, datetime]]:
        """
        获取每个传感器的时间覆盖范围
        
        Returns:
            以 sensor_id 为键，(start_time, end_time) 为值的字典
        """
        groups = self._group_records(records)
        coverage = {}
        
        for (box_id, sensor_id), group_records in groups.items():
            if group_records:
                start = self._parse_iso_time(group_records[0].timestamp)
                end = self._parse_iso_time(group_records[-1].timestamp)
                if start and end:
                    key = f"{box_id}:{sensor_id}"
                    coverage[key] = (start, end)
        
        return coverage
