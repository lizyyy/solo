import networkx as nx
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class Node:
    """馈线节点"""
    node_id: str
    node_type: str = 'bus'
    name: str = ''
    voltage_level: float = 10.0
    has_protection: bool = False
    protection_devices: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProtectionDevice:
    """保护装置"""
    device_id: str
    device_name: str
    node_id: str
    protection_type: str = 'overcurrent'
    is_upstream: bool = False
    downstream_devices: List[str] = field(default_factory=list)
    upstream_device: Optional[str] = None


class Topology:
    """馈线拓扑结构"""
    
    def __init__(self):
        self.graph = nx.DiGraph()
        self.root_node: Optional[str] = None
        self.nodes: Dict[str, Node] = {}
        self.protection_devices: Dict[str, ProtectionDevice] = {}
        self._node_to_protection: Dict[str, List[str]] = defaultdict(list)
    
    def add_node(self, node: Node):
        """添加节点"""
        self.nodes[node.node_id] = node
        self.graph.add_node(node.node_id, **node.metadata)
        
        if node.has_protection:
            for device_id in node.protection_devices:
                if device_id not in self.protection_devices:
                    self.protection_devices[device_id] = ProtectionDevice(
                        device_id=device_id,
                        device_name='',
                        node_id=node.node_id
                    )
                self._node_to_protection[node.node_id].append(device_id)
    
    def add_edge(self, from_node: str, to_node: str, **kwargs):
        """添加边"""
        self.graph.add_edge(from_node, to_node, **kwargs)
    
    def get_upstream_protections(self, device_id: str) -> List[str]:
        """获取指定保护装置的所有上级保护"""
        if device_id not in self.protection_devices:
            return []
        
        device = self.protection_devices[device_id]
        node_id = device.node_id
        
        upstream_protections = []
        current_node = node_id
        
        while True:
            predecessors = list(self.graph.predecessors(current_node))
            if not predecessors:
                break
            
            current_node = predecessors[0]
            
            if current_node in self._node_to_protection:
                for dev_id in self._node_to_protection[current_node]:
                    if dev_id != device_id:
                        upstream_protections.append(dev_id)
        
        return upstream_protections
    
    def get_downstream_protections(self, device_id: str) -> List[str]:
        """获取指定保护装置的所有下级保护"""
        if device_id not in self.protection_devices:
            return []
        
        device = self.protection_devices[device_id]
        start_node = device.node_id
        
        downstream_protections = []
        
        for node_id in nx.descendants(self.graph, start_node):
            if node_id in self._node_to_protection:
                for dev_id in self._node_to_protection[node_id]:
                    if dev_id != device_id:
                        downstream_protections.append(dev_id)
        
        return downstream_protections
    
    def get_immediate_upstream(self, device_id: str) -> Optional[str]:
        """获取指定保护装置的直接上级保护"""
        all_upstream = self.get_upstream_protections(device_id)
        return all_upstream[0] if all_upstream else None
    
    def get_immediate_downstream(self, device_id: str) -> List[str]:
        """获取指定保护装置的直接下级保护"""
        if device_id not in self.protection_devices:
            return []
        
        device = self.protection_devices[device_id]
        start_node = device.node_id
        
        immediate_downstream = []
        visited = set()
        queue = list(self.graph.successors(start_node))
        
        while queue:
            node = queue.pop(0)
            if node in visited:
                continue
            visited.add(node)
            
            if node in self._node_to_protection:
                immediate_downstream.extend(self._node_to_protection[node])
            else:
                queue.extend(self.graph.successors(node))
        
        return immediate_downstream
    
    def get_path_to_root(self, node_id: str) -> List[str]:
        """获取从指定节点到根节点的路径"""
        if self.root_node is None:
            return []
        
        try:
            path = nx.shortest_path(self.graph, self.root_node, node_id)
            return path
        except nx.NetworkXNoPath:
            return []
    
    def get_path_from_root(self, node_id: str) -> List[str]:
        """获取从根节点到指定节点的路径"""
        return self.get_path_to_root(node_id)
    
    def get_protections_on_path(self, path: List[str]) -> List[str]:
        """获取路径上的所有保护装置"""
        protections = []
        for node_id in path:
            if node_id in self._node_to_protection:
                protections.extend(self._node_to_protection[node_id])
        return protections
    
    def get_coordination_pairs(self) -> List[Tuple[str, str]]:
        """获取所有需要配合的保护对（上级-下级）"""
        pairs = []
        
        for device_id in self.protection_devices:
            upstream = self.get_immediate_upstream(device_id)
            if upstream:
                pairs.append((upstream, device_id))
        
        return pairs
    
    def get_end_devices(self) -> List[str]:
        """获取末端保护装置（最接近负荷侧）"""
        end_devices = []
        
        for device_id, device in self.protection_devices.items():
            downstream = self.get_downstream_protections(device_id)
            if not downstream:
                end_devices.append(device_id)
        
        return end_devices
    
    def is_protection_at_node(self, node_id: str) -> List[str]:
        """检查节点上的保护装置"""
        return self._node_to_protection.get(node_id, [])
    
    def get_node_by_protection(self, device_id: str) -> Optional[str]:
        """根据保护装置获取节点"""
        if device_id in self.protection_devices:
            return self.protection_devices[device_id].node_id
        return None


class TopologyBuilder:
    """拓扑构建器"""
    
    def __init__(self, feeder_data: Dict[str, Any]):
        self.feeder_data = feeder_data
        self.topology = Topology()
    
    def build(self) -> Topology:
        """构建拓扑"""
        self._build_nodes()
        self._build_edges()
        self._setup_root()
        
        return self.topology
    
    def _build_nodes(self):
        """构建节点"""
        nodes_data = self.feeder_data.get('nodes', [])
        
        for node_data in nodes_data:
            node_id = node_data.get('id')
            if not node_id:
                continue
            
            node = Node(
                node_id=node_id,
                node_type=node_data.get('type', 'bus'),
                name=node_data.get('name', ''),
                voltage_level=node_data.get('voltage_level', 10.0),
                has_protection=node_data.get('has_protection', False),
                protection_devices=node_data.get('protection_devices', []),
                metadata=node_data
            )
            
            self.topology.add_node(node)
    
    def _build_edges(self):
        """构建边"""
        edges_data = self.feeder_data.get('edges', [])
        
        for edge_data in edges_data:
            from_node = edge_data.get('from')
            to_node = edge_data.get('to')
            
            if not from_node or not to_node:
                continue
            
            edge_attrs = {
                'length': edge_data.get('length', 0.0),
                'impedance': edge_data.get('impedance', {}),
                'line_type': edge_data.get('line_type', 'overhead')
            }
            
            self.topology.add_edge(from_node, to_node, **edge_attrs)
    
    def _setup_root(self):
        """设置根节点"""
        root_node = self.feeder_data.get('root_node')
        if root_node:
            self.topology.root_node = root_node
        else:
            roots = [n for n in self.topology.graph.nodes() if self.topology.graph.in_degree(n) == 0]
            if roots:
                self.topology.root_node = roots[0]
    
    def get_topology(self) -> Topology:
        """获取拓扑"""
        return self.topology
