"""
管道数据解析器
解析管网拓扑结构
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
import yaml


@dataclass
class Zone:
    """分区信息"""
    id: str
    name: str
    parent_id: Optional[str] = None
    meter_ids: List[str] = field(default_factory=list)
    pipe_ids: List[str] = field(default_factory=list)
    valve_ids: List[str] = field(default_factory=list)


@dataclass
class Pipe:
    """管道信息"""
    id: str
    start_node: str
    end_node: str
    length: float
    diameter: float
    material: str
    zone_id: Optional[str] = None
    is_open: bool = True


@dataclass
class Valve:
    """阀门信息"""
    id: str
    name: str
    pipe_id: str
    is_open: bool = True


class PipesParser:
    """管道拓扑数据解析器"""
    
    def __init__(self):
        self.zones: Dict[str, Zone] = {}
        self.pipes: Dict[str, Pipe] = {}
        self.valves: Dict[str, Valve] = {}
        self.nodes: List[str] = []
    
    def parse(self, file_path: str) -> 'PipesParser':
        """解析YAML文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        self._parse_zones(data.get('zones', []))
        self._parse_pipes(data.get('pipes', []))
        self._parse_valves(data.get('valves', []))
        self._collect_nodes()
        
        return self
    
    def _parse_zones(self, zones_data: List[Dict]):
        """解析分区"""
        for zone_data in zones_data:
            zone = Zone(
                id=str(zone_data['id']),
                name=zone_data.get('name', ''),
                parent_id=zone_data.get('parent_id'),
                meter_ids=zone_data.get('meter_ids', []),
                pipe_ids=zone_data.get('pipe_ids', []),
                valve_ids=zone_data.get('valve_ids', [])
            )
            self.zones[zone.id] = zone
    
    def _parse_pipes(self, pipes_data: List[Dict]):
        """解析管道"""
        for pipe_data in pipes_data:
            pipe = Pipe(
                id=str(pipe_data['id']),
                start_node=str(pipe_data['start_node']),
                end_node=str(pipe_data['end_node']),
                length=float(pipe_data['length']),
                diameter=float(pipe_data['diameter']),
                material=pipe_data.get('material', 'unknown'),
                zone_id=pipe_data.get('zone_id'),
                is_open=pipe_data.get('is_open', True)
            )
            self.pipes[pipe.id] = pipe
    
    def _parse_valves(self, valves_data: List[Dict]):
        """解析阀门"""
        for valve_data in valves_data:
            valve = Valve(
                id=str(valve_data['id']),
                name=valve_data.get('name', ''),
                pipe_id=str(valve_data['pipe_id']),
                is_open=valve_data.get('is_open', True)
            )
            self.valves[valve.id] = valve
    
    def _collect_nodes(self):
        """收集所有节点"""
        nodes = set()
        for pipe in self.pipes.values():
            nodes.add(pipe.start_node)
            nodes.add(pipe.end_node)
        self.nodes = sorted(nodes)
    
    def validate(self) -> List[str]:
        """验证数据完整性"""
        errors = []
        
        for pipe in self.pipes.values():
            if pipe.length <= 0:
                errors.append(f"管道 {pipe.id}: 长度必须为正数")
            if pipe.diameter <= 0:
                errors.append(f"管道 {pipe.id}: 直径必须为正数")
        
        for valve in self.valves.values():
            if valve.pipe_id not in self.pipes:
                errors.append(f"阀门 {valve.id}: 关联的管道 {valve.pipe_id} 不存在")
        
        for zone in self.zones.values():
            for meter_id in zone.meter_ids:
                pass
            for pipe_id in zone.pipe_ids:
                if pipe_id not in self.pipes:
                    errors.append(f"分区 {zone.id}: 管道 {pipe_id} 不存在")
        
        return errors
