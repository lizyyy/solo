"""
管网拓扑图
构建和分析供水管网拓扑结构
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple
from collections import deque

from ..parsers.pipes_parser import PipesParser, Pipe, Valve, Zone
from ..parsers.repair_orders_parser import RepairOrdersParser


@dataclass
class Node:
    """管网节点"""
    id: str
    connected_pipes: List[str] = field(default_factory=list)
    zone_id: Optional[str] = None


@dataclass
class GraphEdge:
    """图的边"""
    pipe_id: str
    from_node: str
    to_node: str
    weight: float
    is_open: bool = True


class NetworkGraph:
    """管网拓扑图"""
    
    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.edges: Dict[str, GraphEdge] = {}
        self.adjacency: Dict[str, List[Tuple[str, str, float]]] = {}
        self.zones: Dict[str, Zone] = {}
        self.pipes: Dict[str, Pipe] = {}
        self.valves: Dict[str, Valve] = {}
        self._closed_pipes: Set[str] = set()
    
    def build_from_parser(self, pipes_parser: PipesParser) -> 'NetworkGraph':
        """从管道解析器构建图"""
        self.zones = pipes_parser.zones.copy()
        self.pipes = pipes_parser.pipes.copy()
        self.valves = pipes_parser.valves.copy()
        
        for node_id in pipes_parser.nodes:
            self.nodes[node_id] = Node(id=node_id)
        
        for pipe_id, pipe in self.pipes.items():
            self._add_pipe_to_graph(pipe)
        
        self._build_adjacency()
        
        return self
    
    def _add_pipe_to_graph(self, pipe: Pipe):
        """添加管道到图"""
        if pipe.start_node not in self.nodes:
            self.nodes[pipe.start_node] = Node(id=pipe.start_node)
        if pipe.end_node not in self.nodes:
            self.nodes[pipe.end_node] = Node(id=pipe.end_node)
        
        self.nodes[pipe.start_node].connected_pipes.append(pipe.id)
        self.nodes[pipe.end_node].connected_pipes.append(pipe.id)
        
        weight = pipe.length / (pipe.diameter ** 2)
        
        edge = GraphEdge(
            pipe_id=pipe.id,
            from_node=pipe.start_node,
            to_node=pipe.end_node,
            weight=weight,
            is_open=pipe.is_open
        )
        self.edges[pipe.id] = edge
    
    def _build_adjacency(self):
        """构建邻接表"""
        self.adjacency = {}
        for node_id in self.nodes:
            self.adjacency[node_id] = []
        
        for pipe_id, edge in self.edges.items():
            if edge.is_open and pipe_id not in self._closed_pipes:
                self.adjacency[edge.from_node].append((edge.to_node, pipe_id, edge.weight))
                self.adjacency[edge.to_node].append((edge.from_node, pipe_id, edge.weight))
    
    def update_valve_status(self, repair_parser: RepairOrdersParser, check_time: datetime):
        """根据维修工单更新阀门状态"""
        self._closed_pipes = set()
        
        for valve_id, valve in self.valves.items():
            if repair_parser.is_valve_closed_at(valve_id, check_time):
                self._closed_pipes.add(valve.pipe_id)
        
        self._build_adjacency()
    
    def get_shortest_path(self, start: str, end: str) -> Optional[List[Tuple[str, str]]]:
        """获取两点之间的最短路径（Dijkstra算法）
        返回: [(节点ID, 管道ID), ...]
        """
        if start not in self.nodes or end not in self.nodes:
            return None
        
        if start == end:
            return []
        
        import heapq
        distances = {node: float('inf') for node in self.nodes}
        distances[start] = 0
        previous = {node: None for node in self.nodes}
        pq = [(0, start)]
        
        while pq:
            current_dist, current_node = heapq.heappop(pq)
            
            if current_node == end:
                break
            
            if current_dist > distances[current_node]:
                continue
            
            for neighbor, pipe_id, weight in self.adjacency.get(current_node, []):
                distance = current_dist + weight
                if distance < distances[neighbor]:
                    distances[neighbor] = distance
                    previous[neighbor] = (current_node, pipe_id)
                    heapq.heappush(pq, (distance, neighbor))
        
        if distances[end] == float('inf'):
            return None
        
        path = []
        current = end
        while current != start:
            if previous[current] is None:
                return None
            prev_node, pipe_id = previous[current]
            path.append((current, pipe_id))
            current = prev_node
        
        path.append((start, None))
        path.reverse()
        
        return path
    
    def get_connected_components(self) -> List[Set[str]]:
        """获取连通分量"""
        visited = set()
        components = []
        
        for node_id in self.nodes:
            if node_id not in visited:
                component = self._bfs(node_id, visited)
                components.append(component)
        
        return components
    
    def _bfs(self, start: str, visited: Set[str]) -> Set[str]:
        """广度优先搜索"""
        component = set()
        queue = deque([start])
        visited.add(start)
        component.add(start)
        
        while queue:
            node = queue.popleft()
            for neighbor, pipe_id, weight in self.adjacency.get(node, []):
                if neighbor not in visited:
                    visited.add(neighbor)
                    component.add(neighbor)
                    queue.append(neighbor)
        
        return component
    
    def get_zone_boundary_pipes(self, zone_id: str) -> List[str]:
        """获取分区边界管道"""
        if zone_id not in self.zones:
            return []
        
        zone = self.zones[zone_id]
        zone_pipes = set(zone.pipe_ids)
        
        boundary_pipes = []
        for pipe_id in zone_pipes:
            if pipe_id not in self.pipes:
                continue
            pipe = self.pipes[pipe_id]
            
            start_in_zone = self._is_node_in_zone(pipe.start_node, zone_id)
            end_in_zone = self._is_node_in_zone(pipe.end_node, zone_id)
            
            if start_in_zone != end_in_zone:
                boundary_pipes.append(pipe_id)
        
        return boundary_pipes
    
    def _is_node_in_zone(self, node_id: str, zone_id: str) -> bool:
        """检查节点是否在分区内"""
        if zone_id not in self.zones:
            return False
        
        zone = self.zones[zone_id]
        for pipe_id in zone.pipe_ids:
            if pipe_id in self.pipes:
                pipe = self.pipes[pipe_id]
                if pipe.start_node == node_id or pipe.end_node == node_id:
                    return True
        return False
    
    def get_upstream_pipes(self, node_id: str, inflow_nodes: List[str]) -> Set[str]:
        """获取指定节点的上游管道"""
        upstream = set()
        
        for inflow_node in inflow_nodes:
            path = self.get_shortest_path(inflow_node, node_id)
            if path:
                for _, pipe_id in path:
                    if pipe_id:
                        upstream.add(pipe_id)
        
        return upstream


class GraphValidator:
    """拓扑图验证器"""
    
    def __init__(self, graph: NetworkGraph):
        self.graph = graph
    
    def validate_connectivity(self) -> List[str]:
        """验证连通性"""
        errors = []
        
        components = self.graph.get_connected_components()
        
        if len(components) > 1:
            errors.append(f"管网存在 {len(components)} 个不连通的区域")
            for i, component in enumerate(components, 1):
                sample_nodes = list(component)[:5]
                errors.append(f"区域 {i}: 包含节点 {', '.join(sample_nodes)}...")
        
        return errors
    
    def validate_zone_structure(self) -> List[str]:
        """验证分区结构"""
        errors = []
        
        for zone_id, zone in self.graph.zones.items():
            if not zone.pipe_ids:
                errors.append(f"分区 {zone.name} ({zone_id}): 没有关联管道")
            
            if not zone.meter_ids:
                errors.append(f"分区 {zone.name} ({zone_id}): 没有关联水表")
        
        return errors
    
    def validate_all(self) -> List[str]:
        """执行所有验证"""
        errors = []
        errors.extend(self.validate_connectivity())
        errors.extend(self.validate_zone_structure())
        return errors
