import networkx as nx
from typing import Dict, List, Set, Tuple
from .graph_model import NetworkGraph


class IsolationSolver:
    """隔离分析求解器"""
    
    def __init__(self, graph: NetworkGraph, valves: Dict[str, Dict], customers: Dict[str, Dict]):
        self.graph = graph
        self.valves = valves
        self.customers = customers
    
    def find_min_valve_set(self, repair_point: Dict) -> Dict:
        """查找最小阀门隔离集合"""
        repair_nodes = self._get_repair_nodes(repair_point)
        if not repair_nodes:
            return {'valves_to_close': [], 'affected_nodes': set()}
        
        temp_graph = self.graph.graph.copy()
        valves_candidates = self._find_adjacent_valves(repair_nodes, temp_graph)
        
        min_set = []
        min_affected = set()
        
        for valve_set in self._generate_valve_combinations(valves_candidates):
            test_graph = temp_graph.copy()
            self._close_valves_in_graph(test_graph, valve_set)
            
            if self._check_isolation(test_graph, repair_nodes):
                affected = self._find_affected_nodes(test_graph, repair_nodes)
                if not min_set or len(valve_set) < len(min_set):
                    min_set = valve_set
                    min_affected = affected
                elif len(valve_set) == len(min_set) and len(affected) < len(min_affected):
                    min_set = valve_set
                    min_affected = affected
        
        if not min_set:
            min_set, min_affected = self._fallback_isolation(repair_nodes, temp_graph)
        
        return {
            'valves_to_close': min_set,
            'affected_nodes': min_affected
        }
    
    def _get_repair_nodes(self, repair_point: Dict) -> Set[str]:
        """获取抢修点涉及的节点"""
        nodes = set()
        if 'nodes' in repair_point:
            nodes.update(repair_point['nodes'])
        if 'pipe' in repair_point:
            for edge in self.graph.get_all_edges():
                if edge[2].get('pipe_id') == repair_point['pipe']:
                    nodes.add(edge[0])
                    nodes.add(edge[1])
        return nodes
    
    def _find_adjacent_valves(self, repair_nodes: Set[str], graph) -> List[str]:
        """查找相邻的可用阀门"""
        valves = []
        for node in repair_nodes:
            if node not in graph:
                continue
            for neighbor in graph.neighbors(node):
                if 'valve' in graph.nodes[neighbor]:
                    valve_id = graph.nodes[neighbor]['valve']
                    if valve_id not in valves:
                        valve_status = self.valves.get(valve_id, {}).get('status', 'unknown')
                        if valve_status in ['open', 'unknown']:
                            valves.append(valve_id)
        return valves
    
    def _generate_valve_combinations(self, valves: List[str]) -> List[List[str]]:
        """生成阀门组合"""
        from itertools import combinations
        all_combinations = []
        for r in range(1, len(valves) + 1):
            all_combinations.extend(combinations(valves, r))
        return [list(comb) for comb in all_combinations]
    
    def _close_valves_in_graph(self, graph, valve_set: List[str]) -> None:
        """在图中关闭阀门"""
        for valve_id in valve_set:
            valve_info = self.valves.get(valve_id, {})
            valve_node = valve_info.get('node')
            if valve_node and valve_node in graph:
                neighbors = list(graph.neighbors(valve_node))
                for neighbor in neighbors:
                    graph.remove_edge(valve_node, neighbor)
    
    def _check_isolation(self, graph, repair_nodes: Set[str]) -> bool:
        """检查是否成功隔离"""
        remaining_nodes = set(graph.nodes()) - repair_nodes
        if not remaining_nodes:
            return True
        
        for repair_node in repair_nodes:
            if repair_node not in graph:
                continue
            for other_node in remaining_nodes:
                if other_node in graph and nx.has_path(graph, repair_node, other_node):
                    return False
        return True
    
    def _find_affected_nodes(self, graph, repair_nodes: Set[str]) -> Set[str]:
        """找出受影响的节点"""
        affected = set(repair_nodes)
        for node in repair_nodes:
            if node in graph:
                try:
                    component = nx.node_connected_component(graph, node)
                    affected.update(component)
                except nx.NodeNotFound:
                    pass
        return affected
    
    def _fallback_isolation(self, repair_nodes: Set[str], graph) -> Tuple[List[str], Set[str]]:
        """备用隔离策略"""
        all_valves = []
        for node in graph.nodes():
            if 'valve' in graph.nodes[node]:
                valve_id = graph.nodes[node]['valve']
                valve_status = self.valves.get(valve_id, {}).get('status', 'unknown')
                if valve_status in ['open', 'unknown']:
                    all_valves.append(valve_id)
        
        test_graph = graph.copy()
        self._close_valves_in_graph(test_graph, all_valves)
        affected = self._find_affected_nodes(test_graph, repair_nodes)
        
        return all_valves, affected
    
    def find_affected_customers(self, affected_nodes: Set[str]) -> List[Dict]:
        """查找受影响用户"""
        affected = []
        for customer_id, customer in self.customers.items():
            if customer['node'] in affected_nodes:
                affected.append(customer)
        return sorted(affected, key=lambda x: x['priority'])
    
    def find_bypass_paths(self, source: str, target: str, closed_valves: List[str]) -> List[List[str]]:
        """查找旁通路径"""
        temp_graph = self.graph.graph.copy()
        self._close_valves_in_graph(temp_graph, closed_valves)
        
        paths = []
        try:
            all_paths = nx.all_simple_paths(temp_graph, source, target, cutoff=10)
            paths = list(all_paths)[:5]
        except (nx.NodeNotFound, nx.NetworkXNoPath):
            pass
        
        return paths
