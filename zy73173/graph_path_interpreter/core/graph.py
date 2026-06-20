from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
import heapq

from .validator import InputValidator, ValidationResult, ValidationIssue


@dataclass
class PathResult:
    source: str
    target: str
    path: List[str]
    distance: float
    unit: str
    node_count: int
    edge_count: int
    is_valid: bool
    has_missing_unit: bool = False
    missing_unit_edges: List[str] = field(default_factory=list)
    intermediate_nodes: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "target": self.target,
            "path": self.path,
            "distance": self.distance,
            "unit": self.unit,
            "node_count": self.node_count,
            "edge_count": self.edge_count,
            "is_valid": self.is_valid,
            "has_missing_unit": self.has_missing_unit,
            "missing_unit_edges": self.missing_unit_edges,
            "intermediate_nodes": self.intermediate_nodes,
        }


class GraphPathCalculator:
    def __init__(self):
        self.nodes: List[str] = []
        self.edges: List[dict] = []
        self.adjacency: Dict[str, List[Tuple[str, float, str]]] = defaultdict(list)
        self.missing_unit_edges: List[dict] = []
        self.validation_result: Optional[ValidationResult] = None

    def load_graph(self, graph_data: dict) -> ValidationResult:
        self.nodes = graph_data.get("nodes", [])
        self.edges = graph_data.get("edges", [])
        self.adjacency = defaultdict(list)
        self.missing_unit_edges = []

        node_result = InputValidator.validate_nodes(self.nodes)
        edge_result = InputValidator.validate_edges(self.edges)

        combined = ValidationResult(is_valid=node_result.is_valid and edge_result.is_valid)
        combined.issues = node_result.issues + edge_result.issues
        combined.warnings = node_result.warnings + edge_result.warnings
        combined.details = {**node_result.details, **edge_result.details}
        self.validation_result = combined

        for edge in self.edges:
            source = edge.get("source")
            target = edge.get("target")
            weight = float(edge.get("weight", 1))
            unit = edge.get("unit", "")

            if not unit or unit == "":
                edge_id = f"{source}->{target}"
                self.missing_unit_edges.append({**edge, "edge_id": edge_id})
                continue

            if source and target:
                self.adjacency[source].append((target, weight, unit))
                self.adjacency[target].append((source, weight, unit))

        return combined

    def shortest_path(self, source: str, target: str) -> PathResult:
        if self.validation_result and self.validation_result.has_issue(ValidationIssue.EMPTY_COLLECTION):
            return PathResult(
                source=source,
                target=target,
                path=[],
                distance=0,
                unit="",
                node_count=0,
                edge_count=0,
                is_valid=False,
            )

        path_input_validation = InputValidator.validate_path_input(source, target, {"nodes": self.nodes})
        if not path_input_validation.is_valid:
            return PathResult(
                source=source,
                target=target,
                path=[],
                distance=0,
                unit="",
                node_count=0,
                edge_count=0,
                is_valid=False,
            )

        distances = {node: float("inf") for node in self.nodes}
        distances[source] = 0
        previous = {node: None for node in self.nodes}
        units = {node: "" for node in self.nodes}
        priority_queue = [(0, source)]

        while priority_queue:
            current_distance, current_node = heapq.heappop(priority_queue)

            if current_node == target:
                break

            if current_distance > distances[current_node]:
                continue

            for neighbor, weight, unit in self.adjacency.get(current_node, []):
                distance = current_distance + weight
                if distance < distances[neighbor]:
                    distances[neighbor] = distance
                    previous[neighbor] = current_node
                    units[neighbor] = unit
                    heapq.heappush(priority_queue, (distance, neighbor))

        if distances[target] == float("inf"):
            return PathResult(
                source=source,
                target=target,
                path=[],
                distance=0,
                unit="",
                node_count=0,
                edge_count=0,
                is_valid=False,
            )

        path = []
        current = target
        while current is not None:
            path.append(current)
            current = previous[current]
        path.reverse()

        intermediate_nodes = path[1:-1] if len(path) > 2 else []

        missing_unit_edge_ids = [e["edge_id"] for e in self.missing_unit_edges]

        return PathResult(
            source=source,
            target=target,
            path=path,
            distance=distances[target],
            unit=units.get(target, ""),
            node_count=len(self.nodes),
            edge_count=len(self.adjacency),
            is_valid=True,
            has_missing_unit=len(self.missing_unit_edges) > 0,
            missing_unit_edges=missing_unit_edge_ids,
            intermediate_nodes=intermediate_nodes,
        )

    def all_pairs_shortest_paths(self) -> Dict[str, Dict[str, PathResult]]:
        results: Dict[str, Dict[str, PathResult]] = {}
        for source in self.nodes:
            results[source] = {}
            for target in self.nodes:
                if source != target:
                    results[source][target] = self.shortest_path(source, target)
        return results

    def get_missing_unit_records(self) -> List[dict]:
        return list(self.missing_unit_edges)

    def get_statistics(self) -> dict:
        return {
            "total_nodes": len(self.nodes),
            "total_edges": len(self.edges),
            "valid_edges": len(self.edges) - len(self.missing_unit_edges),
            "missing_unit_edges": len(self.missing_unit_edges),
        }
