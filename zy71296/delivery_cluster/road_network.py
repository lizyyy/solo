import math
from collections import defaultdict
from typing import Optional

import networkx as nx

from delivery_cluster.models import RoadEdge, Bridge, Node, Order, Rider


EARTH_RADIUS_M = 6371000.0


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _nearest_node_id(lat: float, lng: float, nodes: dict) -> Optional[str]:
    best_id = None
    best_dist = float("inf")
    for nid, n in nodes.items():
        d = haversine_m(lat, lng, n.lat, n.lng)
        if d < best_dist:
            best_dist = d
            best_id = nid
    return best_id


class RoadNetwork:
    def __init__(self):
        self.graph = nx.Graph()
        self.nodes: dict[str, Node] = {}
        self.bridges: dict[str, Bridge] = {}
        self._bridge_penalty_map: dict[str, float] = {}

    def build(
        self,
        edges: list[RoadEdge],
        nodes: list[Node] = None,
        bridges: list[Bridge] = None,
    ):
        if nodes:
            for n in nodes:
                self.nodes[n.id] = n
                self.graph.add_node(n.id, lat=n.lat, lng=n.lng)

        if bridges:
            for b in bridges:
                self.bridges[b.id] = b
                self._bridge_penalty_map[b.id] = b.detour_penalty_m

        for edge in edges:
            if edge.from_node not in self.nodes:
                self.graph.add_node(edge.from_node)
            if edge.to_node not in self.nodes:
                self.graph.add_node(edge.to_node)

            weight = edge.distance_m
            bridge_id = edge.bridge_id

            if edge.has_bridge and bridge_id and bridge_id in self._bridge_penalty_map:
                weight += self._bridge_penalty_map[bridge_id]

            self.graph.add_edge(
                edge.from_node,
                edge.to_node,
                weight=weight,
                base_distance=edge.distance_m,
                has_bridge=edge.has_bridge,
                bridge_id=bridge_id,
            )

        self._ensure_connected()

    def _ensure_connected(self):
        if self.graph.number_of_nodes() == 0:
            return

        components = list(nx.connected_components(self.graph))
        if len(components) <= 1:
            return

        component_centers = []
        for comp in components:
            lats = []
            lngs = []
            for nid in comp:
                n = self.nodes.get(nid)
                if n:
                    lats.append(n.lat)
                    lngs.append(n.lng)
                elif "lat" in self.graph.nodes[nid]:
                    lats.append(self.graph.nodes[nid]["lat"])
                    lngs.append(self.graph.nodes[nid]["lng"])
            if lats:
                component_centers.append(
                    (sum(lats) / len(lats), sum(lngs) / len(lngs), comp)
                )

        if len(component_centers) < 2:
            return

        sorted_comps = sorted(component_centers, key=lambda c: (c[0], c[1]))
        primary = sorted_comps[0][2]

        for i in range(1, len(sorted_comps)):
            secondary = sorted_comps[i][2]
            best_pair = None
            best_dist = float("inf")

            p_list = list(primary)[:20]
            s_list = list(secondary)[:20]

            for pn in p_list:
                n1 = self.nodes.get(pn)
                if not n1:
                    continue
                for sn in s_list:
                    n2 = self.nodes.get(sn)
                    if not n2:
                        continue
                    d = haversine_m(n1.lat, n1.lng, n2.lat, n2.lng)
                    if d < best_dist:
                        best_dist = d
                        best_pair = (pn, sn)

            if best_pair:
                self.graph.add_edge(
                    best_pair[0],
                    best_pair[1],
                    weight=best_dist,
                    base_distance=best_dist,
                    has_bridge=False,
                    bridge_id=None,
                    virtual=True,
                )
                primary = primary | secondary

    def shortest_path_distance(self, from_node: str, to_node: str) -> Optional[float]:
        if from_node == to_node:
            return 0.0
        try:
            return nx.dijkstra_path_length(self.graph, from_node, to_node, weight="weight")
        except nx.NetworkXNoPath:
            return None

    def shortest_path(self, from_node: str, to_node: str) -> Optional[list[str]]:
        try:
            return nx.dijkstra_path(self.graph, from_node, to_node, weight="weight")
        except nx.NetworkXNoPath:
            return None

    def path_bridge_crossings(self, path: list[str]) -> list[dict]:
        crossings = []
        if not path or len(path) < 2:
            return crossings

        for i in range(len(path) - 1):
            edge_data = self.graph.get_edge_data(path[i], path[i + 1])
            if edge_data and edge_data.get("has_bridge"):
                bridge_id = edge_data.get("bridge_id")
                bridge_info = None
                if bridge_id and bridge_id in self.bridges:
                    b = self.bridges[bridge_id]
                    bridge_info = {
                        "bridge_id": b.id,
                        "bridge_name": b.name,
                        "detour_penalty_m": b.detour_penalty_m,
                    }
                crossings.append(
                    {
                        "from_node": path[i],
                        "to_node": path[i + 1],
                        "bridge_id": bridge_id,
                        "bridge": bridge_info,
                        "edge_distance_m": edge_data.get("base_distance", 0),
                        "total_weight_m": edge_data.get("weight", 0),
                    }
                )

        return crossings

    def order_to_order_distance(
        self, order1: Order, order2: Order
    ) -> tuple[float, float, Optional[list[dict]]]:
        n1 = _nearest_node_id(order1.lat, order1.lng, self.nodes)
        n2 = _nearest_node_id(order2.lat, order2.lng, self.nodes)

        if n1 is None or n2 is None:
            straight = haversine_m(order1.lat, order1.lng, order2.lat, order2.lng)
            return straight, straight, []

        if n1 == n2:
            straight = haversine_m(order1.lat, order1.lng, order2.lat, order2.lng)
            return straight, straight, []

        road_dist = self.shortest_path_distance(n1, n2)
        path = self.shortest_path(n1, n2)

        straight = haversine_m(order1.lat, order1.lng, order2.lat, order2.lng)

        if road_dist is None:
            return straight, straight, []

        crossings = self.path_bridge_crossings(path) if path else []

        return road_dist, straight, crossings

    def rider_to_order_distance(
        self, rider: Rider, order: Order
    ) -> tuple[float, float, Optional[list[dict]]]:
        nr = _nearest_node_id(rider.lat, rider.lng, self.nodes)
        no = _nearest_node_id(order.lat, order.lng, self.nodes)

        straight = haversine_m(rider.lat, rider.lng, order.lat, order.lng)

        if nr is None or no is None:
            return straight, straight, []

        if nr == no:
            return straight, straight, []

        road_dist = self.shortest_path_distance(nr, no)
        path = self.shortest_path(nr, no)

        if road_dist is None:
            return straight, straight, []

        crossings = self.path_bridge_crossings(path) if path else []

        return road_dist, straight, crossings

    def compute_distance_matrix(
        self, orders: list[Order]
    ) -> dict[tuple[str, str], tuple[float, float, list[dict]]]:
        result = {}
        node_cache: dict[str, Optional[str]] = {}

        for o in orders:
            if o.id not in node_cache:
                node_cache[o.id] = _nearest_node_id(o.lat, o.lng, self.nodes)

        for i, o1 in enumerate(orders):
            for j, o2 in enumerate(orders):
                if i >= j:
                    continue

                n1 = node_cache[o1.id]
                n2 = node_cache[o2.id]

                if n1 is None or n2 is None:
                    straight = haversine_m(o1.lat, o1.lng, o2.lat, o2.lng)
                    result[(o1.id, o2.id)] = (straight, straight, [])
                    result[(o2.id, o1.id)] = (straight, straight, [])
                    continue

                if n1 == n2:
                    straight = haversine_m(o1.lat, o1.lng, o2.lat, o2.lng)
                    result[(o1.id, o2.id)] = (straight, straight, [])
                    result[(o2.id, o1.id)] = (straight, straight, [])
                    continue

                road_dist = self.shortest_path_distance(n1, n2)
                path = self.shortest_path(n1, n2)
                straight = haversine_m(o1.lat, o1.lng, o2.lat, o2.lng)

                if road_dist is None:
                    result[(o1.id, o2.id)] = (straight, straight, [])
                    result[(o2.id, o1.id)] = (straight, straight, [])
                    continue

                crossings = self.path_bridge_crossings(path) if path else []

                result[(o1.id, o2.id)] = (road_dist, straight, crossings)
                result[(o2.id, o1.id)] = (road_dist, straight, crossings)

        return result

    def get_node_position(self, node_id: str) -> Optional[tuple[float, float]]:
        n = self.nodes.get(node_id)
        if n:
            return n.lat, n.lng
        node_data = self.graph.nodes.get(node_id, {})
        if "lat" in node_data:
            return node_data["lat"], node_data["lng"]
        return None
