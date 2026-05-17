import networkx as nx
from typing import Dict, List, Tuple, Optional
from .models import ServiceConfig


class DependencyGraph:
    def __init__(self, services: Dict[str, ServiceConfig]):
        self.services = services
        self.graph = nx.DiGraph()
        self._build_graph()
    
    def _build_graph(self) -> None:
        for name in self.services:
            self.graph.add_node(name)
        
        for name, service in self.services.items():
            for dep in service.dependencies:
                if dep in self.services:
                    self.graph.add_edge(dep, name)
    
    def has_circular_dependencies(self) -> bool:
        try:
            list(nx.topological_sort(self.graph))
            return False
        except nx.NetworkXUnfeasible:
            return True
    
    def find_cycles(self) -> List[List[str]]:
        try:
            cycles = list(nx.simple_cycles(self.graph))
            return [cycle for cycle in cycles if len(cycle) > 1]
        except Exception:
            return []
    
    def get_topological_order(self) -> Tuple[List[str], Optional[List[List[str]]]]:
        try:
            order = list(nx.topological_sort(self.graph))
            return order, None
        except nx.NetworkXUnfeasible:
            cycles = self.find_cycles()
            return [], cycles
    
    def get_dependents(self, service_name: str) -> List[str]:
        if service_name not in self.graph:
            return []
        return list(self.graph.successors(service_name))
    
    def get_dependencies(self, service_name: str) -> List[str]:
        if service_name not in self.graph:
            return []
        return list(self.graph.predecessors(service_name))
    
    def get_levels(self) -> Dict[str, int]:
        levels = {}
        for node in self.graph.nodes():
            pred = list(self.graph.predecessors(node))
            if not pred:
                levels[node] = 0
            else:
                levels[node] = max(levels.get(p, 0) for p in pred) + 1
        return levels
    
    def as_dot(self) -> str:
        lines = ["digraph ServiceDependencies {"]
        lines.append("    rankdir=TB;")
        lines.append("    node [shape=box, style=filled, fillcolor=lightblue];")
        
        for name in self.services:
            service = self.services[name]
            port_str = f":{service.port}" if service.port else ""
            label = f"{name}{port_str}"
            lines.append(f'    "{name}" [label="{label}"];')
        
        for name, service in self.services.items():
            for dep in service.dependencies:
                if dep in self.services:
                    lines.append(f'    "{dep}" -> "{name}";')
        
        lines.append("}")
        return "\n".join(lines)
