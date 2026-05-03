from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set
import yaml
from pathlib import Path


@dataclass
class Node:
    id: str
    name: str
    node_type: str
    x: float = 0.0
    y: float = 0.0
    is_equipment: bool = False
    equipment_id: Optional[str] = None


@dataclass
class Edge:
    id: str
    from_node: str
    to_node: str
    is_bidirectional: bool = True
    distance: float = 1.0


@dataclass
class Equipment:
    id: str
    name: str
    port_nodes: List[str] = field(default_factory=list)


@dataclass
class Topology:
    nodes: Dict[str, Node] = field(default_factory=dict)
    edges: Dict[str, Edge] = field(default_factory=dict)
    equipments: Dict[str, Equipment] = field(default_factory=dict)
    _adjacency: Dict[str, List[str]] = field(default_factory=dict)
    
    def get_neighbors(self, node_id: str) -> List[str]:
        return self._adjacency.get(node_id, [])
    
    def is_equipment_port(self, node_id: str) -> bool:
        node = self.nodes.get(node_id)
        return node is not None and node.is_equipment
    
    def get_equipment_from_port(self, node_id: str) -> Optional[Equipment]:
        node = self.nodes.get(node_id)
        if node and node.equipment_id:
            return self.equipments.get(node.equipment_id)
        return None
    
    def validate(self) -> List[str]:
        errors = []
        for node_id in self.nodes:
            if node_id not in self._adjacency:
                errors.append(f"Node {node_id} has no connections")
        for edge in self.edges.values():
            if edge.from_node not in self.nodes:
                errors.append(f"Edge {edge.id} references unknown from_node: {edge.from_node}")
            if edge.to_node not in self.nodes:
                errors.append(f"Edge {edge.id} references unknown to_node: {edge.to_node}")
        return errors


def load_topology(yaml_path: Path) -> Topology:
    with open(yaml_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    topology = Topology()
    
    if 'nodes' in data:
        for node_data in data['nodes']:
            node = Node(
                id=node_data['id'],
                name=node_data.get('name', node_data['id']),
                node_type=node_data.get('type', 'regular'),
                x=node_data.get('x', 0.0),
                y=node_data.get('y', 0.0),
                is_equipment=node_data.get('is_equipment', False),
                equipment_id=node_data.get('equipment_id')
            )
            topology.nodes[node.id] = node
            topology._adjacency[node.id] = []
    
    if 'edges' in data:
        for edge_data in data['edges']:
            edge = Edge(
                id=edge_data['id'],
                from_node=edge_data['from'],
                to_node=edge_data['to'],
                is_bidirectional=edge_data.get('bidirectional', True),
                distance=edge_data.get('distance', 1.0)
            )
            topology.edges[edge.id] = edge
            
            if edge.from_node not in topology._adjacency:
                topology._adjacency[edge.from_node] = []
            if edge.to_node not in topology._adjacency:
                topology._adjacency[edge.to_node] = []
            
            topology._adjacency[edge.from_node].append(edge.to_node)
            if edge.is_bidirectional:
                topology._adjacency[edge.to_node].append(edge.from_node)
    
    if 'equipments' in data:
        for eq_data in data['equipments']:
            equipment = Equipment(
                id=eq_data['id'],
                name=eq_data.get('name', eq_data['id']),
                port_nodes=eq_data.get('port_nodes', [])
            )
            topology.equipments[equipment.id] = equipment
    
    return topology
