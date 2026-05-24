from typing import Dict, List, Set, Optional, Tuple, Any
from collections import defaultdict

import networkx as nx

from .parser import DBTArtifactsParser
from .models import (
    DependencyIssue,
    ReportIssue,
    DBTResourceType,
)


class DependencyGraph:
    def __init__(self, parser: DBTArtifactsParser):
        self.parser = parser
        self.graph = nx.DiGraph()
        self._build_graph()

    def _build_graph(self) -> None:
        for uid, resource in self.parser.all_resources():
            self.graph.add_node(uid)

        for uid, node in self.parser.nodes.items():
            for dep in node.dependencies:
                if dep in self.graph.nodes:
                    self.graph.add_edge(dep, uid)
                else:
                    pass

    def has_node(self, unique_id: str) -> bool:
        return unique_id in self.graph.nodes

    def get_upstream(self, unique_id: str, max_depth: Optional[int] = None) -> List[str]:
        if not self.has_node(unique_id):
            return []

        upstream = []
        visited = set()
        queue = [(unique_id, 0)]

        while queue:
            node, depth = queue.pop(0)
            if node in visited:
                continue
            visited.add(node)

            if max_depth is not None and depth > max_depth:
                continue

            predecessors = list(self.graph.predecessors(node))
            for pred in predecessors:
                if pred != unique_id:
                    upstream.append(pred)
                    queue.append((pred, depth + 1))

        return list(dict.fromkeys(upstream))

    def get_upstream_direct(self, unique_id: str) -> List[str]:
        if not self.has_node(unique_id):
            return []
        return list(self.graph.predecessors(unique_id))

    def get_downstream(self, unique_id: str, max_depth: Optional[int] = None) -> List[str]:
        if not self.has_node(unique_id):
            return []

        downstream = []
        visited = set()
        queue = [(unique_id, 0)]

        while queue:
            node, depth = queue.pop(0)
            if node in visited:
                continue
            visited.add(node)

            if max_depth is not None and depth > max_depth:
                continue

            successors = list(self.graph.successors(node))
            for succ in successors:
                if succ != unique_id:
                    downstream.append(succ)
                    queue.append((succ, depth + 1))

        return list(dict.fromkeys(downstream))

    def get_downstream_direct(self, unique_id: str) -> List[str]:
        if not self.has_node(unique_id):
            return []
        return list(self.graph.successors(unique_id))

    def find_missing_dependencies(self) -> List[DependencyIssue]:
        issues: List[DependencyIssue] = []
        missing_sources = set()

        for uid, node in self.parser.nodes.items():
            for dep in node.dependencies:
                if not self.has_node(dep):
                    if dep.startswith("source."):
                        missing_sources.add(dep)
                        issues.append(DependencyIssue(
                            type=ReportIssue.SOURCE_MISSING,
                            from_node=uid,
                            to_node=dep,
                            message=f"Source '{dep}' referenced by '{uid}' is missing from manifest"
                        ))
                    else:
                        issues.append(DependencyIssue(
                            type=ReportIssue.DEPENDENCY_BROKEN,
                            from_node=uid,
                            to_node=dep,
                            message=f"Dependency '{dep}' referenced by '{uid}' not found in graph"
                        ))

        return issues

    def get_all_paths(self, from_node: str, to_node: str) -> List[List[str]]:
        if not self.has_node(from_node) or not self.has_node(to_node):
            return []
        try:
            return list(nx.all_simple_paths(self.graph, from_node, to_node))
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return []

    def get_impacted_report_tables(
        self,
        problematic_node: str,
        report_tables: Dict[str, str]
    ) -> List[Tuple[str, str]]:
        impacted = []
        downstream = self.get_downstream(problematic_node)

        for table_name, unique_id in report_tables.items():
            if unique_id in downstream or unique_id == problematic_node:
                impacted.append((table_name, unique_id))

        return impacted

    def find_cycles(self) -> List[List[str]]:
        try:
            cycles = list(nx.simple_cycles(self.graph))
            return [cycle for cycle in cycles if len(cycle) > 1]
        except nx.NetworkXException:
            return []

    def topological_sort(self) -> List[str]:
        try:
            return list(nx.topological_sort(self.graph))
        except nx.NetworkXUnfeasible:
            return []

    def is_reachable(self, from_node: str, to_node: str) -> bool:
        if not self.has_node(from_node) or not self.has_node(to_node):
            return False
        return nx.has_path(self.graph, from_node, to_node)

    def get_node_level(self, unique_id: str) -> int:
        if not self.has_node(unique_id):
            return -1

        max_level = 0
        for pred in self.graph.predecessors(unique_id):
            pred_level = self.get_node_level(pred)
            max_level = max(max_level, pred_level + 1)

        return max_level
