import networkx as nx
from typing import Dict, List, Set, Tuple


class NetworkGraph:
    """燃气管网图模型"""
    
    def __init__(self):
        self.graph = nx.Graph()
        self.valve_edges = {}
    
    def build_graph(self, nodes: Dict[str, Dict], pipes: List[Dict], valves: Dict[str, Dict]) -> None:
        """构建管网图"""
        for node_id, node_info in nodes.items():
            self.graph.add_node(node_id, **node_info)
        
        for pipe in pipes:
            self.graph.add_edge(
                pipe['from_node'],
                pipe['to_node'],
                pipe_id=pipe['id'],
                diameter=pipe['diameter'],
                length=pipe['length'],
                material=pipe['material'],
                island=pipe['island']
            )
        
        for valve_id, valve_info in valves.items():
            if valve_info['node']:
                if valve_info['node'] in self.graph.nodes:
                    self.graph.nodes[valve_info['node']]['valve'] = valve_id
                    self.graph.nodes[valve_info['node']]['valve_status'] = valve_info['status']
            self.valve_edges[valve_id] = valve_info
    
    def get_islands(self) -> List[Set[str]]:
        """获取断开的孤岛"""
        islands = []
        for component in nx.connected_components(self.graph):
            islands.append(component)
        return islands
    
    def get_subgraph(self, nodes: Set[str]) -> 'NetworkGraph':
        """获取子图"""
        sub = NetworkGraph()
        sub.graph = self.graph.subgraph(nodes).copy()
        return sub
    
    def get_neighbors(self, node: str) -> List[str]:
        """获取邻居节点"""
        return list(self.graph.neighbors(node))
    
    def has_path(self, source: str, target: str) -> bool:
        """检查两点间是否有路径"""
        try:
            return nx.has_path(self.graph, source, target)
        except nx.NodeNotFound:
            return False
    
    def shortest_path(self, source: str, target: str) -> List[str]:
        """获取最短路径"""
        try:
            return nx.shortest_path(self.graph, source, target)
        except (nx.NodeNotFound, nx.NetworkXNoPath):
            return []
    
    def get_all_nodes(self) -> List[str]:
        """获取所有节点"""
        return list(self.graph.nodes())
    
    def get_all_edges(self) -> List[Tuple[str, str, Dict]]:
        """获取所有边"""
        return list(self.graph.edges(data=True))
    
    def find_valves_on_path(self, path: List[str]) -> List[str]:
        """查找路径上的阀门"""
        valves = []
        for node in path:
            if 'valve' in self.graph.nodes[node]:
                valves.append(self.graph.nodes[node]['valve'])
        return valves
