import math
from typing import Optional
from collections import defaultdict

from delivery_cluster.models import (
    Order,
    Rider,
    Zone,
    Anomaly,
    AnomalyType,
    CapacityConfig,
)
from delivery_cluster.road_network import RoadNetwork, haversine_m


class ClusterResult:
    def __init__(self):
        self.zones: list[Zone] = []
        self.anomalies: list[Anomaly] = []
        self.unassigned_orders: list[Order] = []
        self.distance_warnings: list[dict] = []
        self.stats: dict = {}

    def to_dict(self) -> dict:
        return {
            "zones": [z.to_dict() for z in self.zones],
            "global_anomalies": [a.to_dict() for a in self.anomalies],
            "unassigned_order_ids": [o.id for o in self.unassigned_orders],
            "distance_warnings": self.distance_warnings,
            "stats": self.stats,
        }


class DeliveryClusterer:
    def __init__(
        self,
        road_network: RoadNetwork,
        config: CapacityConfig = None,
    ):
        self.network = road_network
        self.config = config or CapacityConfig()

    def cluster(
        self,
        orders: list[Order],
        riders: list[Rider],
    ) -> ClusterResult:
        result = ClusterResult()

        if not orders:
            result.anomalies.append(
                Anomaly(
                    anomaly_type=AnomalyType.ISOLATED_ORDER,
                    severity="warning",
                    message="订单列表为空，无法聚类",
                )
            )
            return result

        dist_matrix = self.network.compute_distance_matrix(orders)

        self._check_straight_line_misleading(orders, dist_matrix, result)

        if riders:
            zones = self._cluster_by_riders(orders, riders, dist_matrix)
        else:
            zones = self._cluster_auto(orders, dist_matrix)

        for zone in zones:
            self._enrich_zone(zone, dist_matrix)

        zones = self._enforce_capacity(zones, dist_matrix, result)

        for zone in zones:
            self._check_zone_anomalies(zone, dist_matrix)

        result.zones = zones
        result.stats = {
            "total_orders": len(orders),
            "total_zones": len(zones),
            "total_riders": len(riders),
            "avg_orders_per_zone": round(len(orders) / max(len(zones), 1), 1),
            "max_zone_orders": max((z.order_count for z in zones), default=0),
            "min_zone_orders": min((z.order_count for z in zones), default=0),
        }

        return result

    def _cluster_by_riders(
        self,
        orders: list[Order],
        riders: list[Rider],
        dist_matrix: dict,
    ) -> list[Zone]:
        zones = []
        for rider in riders:
            zone = Zone(id=f"Z-{rider.id}", rider_id=rider.id)
            zones.append(zone)

        order_assignments: dict[str, int] = {}

        for order in orders:
            best_zone_idx = -1
            best_dist = float("inf")

            for idx, rider in enumerate(riders):
                road_dist, straight_dist, crossings = self.network.rider_to_order_distance(
                    rider, order
                )
                if road_dist < best_dist:
                    best_dist = road_dist
                    best_zone_idx = idx

            if best_zone_idx >= 0:
                order_assignments[order.id] = best_zone_idx

        order_map = {o.id: o for o in orders}
        for order_id, zone_idx in order_assignments.items():
            zones[zone_idx].orders.append(order_map[order_id])

        return zones

    def _cluster_auto(
        self,
        orders: list[Order],
        dist_matrix: dict,
    ) -> list[Zone]:
        n = len(orders)
        if n == 0:
            return []

        order_map = {o.id: o for o in orders}
        parent = {o.id: o.id for o in orders}
        rank = defaultdict(int)

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(x, y):
            rx, ry = find(x), find(y)
            if rx == ry:
                return
            if rank[rx] < rank[ry]:
                rx, ry = ry, rx
            parent[ry] = rx
            if rank[rx] == rank[ry]:
                rank[rx] += 1

        edges = []
        for (id1, id2), (road_dist, straight_dist, crossings) in dist_matrix.items():
            if id1 < id2:
                edges.append((road_dist, id1, id2, crossings))

        edges.sort(key=lambda e: e[0])

        for road_dist, id1, id2, crossings in edges:
            if road_dist > self.config.max_radius_m:
                break

            root1, root2 = find(id1), find(id2)
            if root1 == root2:
                continue

            group1_size = sum(1 for o in orders if find(o.id) == root1)
            group2_size = sum(1 for o in orders if find(o.id) == root2)

            if group1_size + group2_size > self.config.max_orders_per_zone:
                continue

            group1_weight = sum(
                order_map[oid].weight
                for oid in parent
                if find(oid) == root1 and oid in order_map
            )
            group2_weight = sum(
                order_map[oid].weight
                for oid in parent
                if find(oid) == root2 and oid in order_map
            )

            if group1_weight + group2_weight > self.config.max_weight_per_zone:
                continue

            union(id1, id2)

        groups: dict[str, list[str]] = defaultdict(list)
        for o in orders:
            groups[find(o.id)].append(o.id)

        zones = []
        for idx, (root, order_ids) in enumerate(
            sorted(groups.items(), key=lambda x: -len(x[1]))
        ):
            zone = Zone(id=f"Z-{idx + 1:03d}")
            for oid in order_ids:
                zone.orders.append(order_map[oid])
            zones.append(zone)

        return zones

    def _enrich_zone(self, zone: Zone, dist_matrix: dict):
        if not zone.orders:
            return

        lats = [o.lat for o in zone.orders]
        lngs = [o.lng for o in zone.orders]
        zone.center_lat = sum(lats) / len(lats)
        zone.center_lng = sum(lngs) / len(lngs)
        zone.total_weight = sum(o.weight for o in zone.orders)

        max_road = 0.0
        max_straight = 0.0
        total_bridge_crossings = 0

        for i, o1 in enumerate(zone.orders):
            for j, o2 in enumerate(zone.orders):
                if i >= j:
                    continue

                key = (o1.id, o2.id)
                if key in dist_matrix:
                    road_dist, straight_dist, crossings = dist_matrix[key]
                    max_road = max(max_road, road_dist)
                    max_straight = max(max_straight, straight_dist)
                    total_bridge_crossings += len(crossings)

        zone.max_road_distance_m = max_road
        zone.max_straight_distance_m = max_straight
        zone.bridge_crossings = total_bridge_crossings

    def _enforce_capacity(
        self,
        zones: list[Zone],
        dist_matrix: dict,
        result: ClusterResult,
    ) -> list[Zone]:
        final_zones = []

        for zone in zones:
            if zone.order_count <= self.config.max_orders_per_zone and zone.total_weight <= self.config.max_weight_per_zone:
                final_zones.append(zone)
                continue

            split_zones = self._split_zone(zone, dist_matrix, result)
            final_zones.extend(split_zones)

        return final_zones

    def _split_zone(
        self,
        zone: Zone,
        dist_matrix: dict,
        result: ClusterResult,
    ) -> list[Zone]:
        if zone.order_count <= 1:
            return [zone]

        reason_parts = []
        if zone.order_count > self.config.max_orders_per_zone:
            reason_parts.append(
                f"订单数 {zone.order_count} 超过上限 {self.config.max_orders_per_zone}"
            )
        if zone.total_weight > self.config.max_weight_per_zone:
            reason_parts.append(
                f"总重量 {zone.total_weight:.1f} 超过上限 {self.config.max_weight_per_zone}"
            )

        anomaly = Anomaly(
            anomaly_type=AnomalyType.ZONE_OVERLOAD,
            severity="critical",
            message=f"片区 {zone.id} 需要拆分：{'；'.join(reason_parts)}",
            details={
                "zone_id": zone.id,
                "order_count": zone.order_count,
                "total_weight": zone.total_weight,
                "max_orders": self.config.max_orders_per_zone,
                "max_weight": self.config.max_weight_per_zone,
                "reason": "；".join(reason_parts),
            },
        )
        zone.anomalies.append(anomaly)
        result.anomalies.append(anomaly)

        order_map = {o.id: o for o in zone.orders}
        parent = {o.id: o.id for o in zone.orders}
        rank = defaultdict(int)

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(x, y):
            rx, ry = find(x), find(y)
            if rx == ry:
                return
            if rank[rx] < rank[ry]:
                rx, ry = ry, rx
            parent[ry] = rx
            if rank[rx] == rank[ry]:
                rank[rx] += 1

        all_edges = []
        for i, o1 in enumerate(zone.orders):
            for j, o2 in enumerate(zone.orders):
                if i >= j:
                    continue
                key = (o1.id, o2.id)
                if key in dist_matrix:
                    road_dist, _, _ = dist_matrix[key]
                    all_edges.append((road_dist, o1.id, o2.id))

        all_edges.sort(key=lambda e: e[0])

        half_capacity = self.config.max_orders_per_zone // 2

        for road_dist, id1, id2 in all_edges:
            root1, root2 = find(id1), find(id2)
            if root1 == root2:
                continue

            group1_size = sum(1 for o in zone.orders if find(o.id) == root1)
            group2_size = sum(1 for o in zone.orders if find(o.id) == root2)

            if group1_size + group2_size > max(half_capacity, 10):
                continue

            union(id1, id2)

        groups: dict[str, list[str]] = defaultdict(list)
        for o in zone.orders:
            groups[find(o.id)].append(o.id)

        if len(groups) == 1:
            mid = len(zone.orders) // 2
            sorted_orders = sorted(zone.orders, key=lambda o: (o.lat, o.lng))
            sub1 = sorted_orders[:mid]
            sub2 = sorted_orders[mid:]

            split_zones = []
            for idx, sub_orders in enumerate([sub1, sub2]):
                sz = Zone(id=f"{zone.id}-{idx + 1}", rider_id=zone.rider_id)
                sz.orders = sub_orders
                self._enrich_zone(sz, dist_matrix)
                split_zones.append(sz)
            return split_zones

        split_zones = []
        for idx, (root, order_ids) in enumerate(
            sorted(groups.items(), key=lambda x: -len(x[1]))
        ):
            sz = Zone(id=f"{zone.id}-{idx + 1}", rider_id=zone.rider_id)
            for oid in order_ids:
                sz.orders.append(order_map[oid])
            self._enrich_zone(sz, dist_matrix)
            split_zones.append(sz)

        for sz in split_zones:
            if sz.order_count > self.config.max_orders_per_zone or sz.total_weight > self.config.max_weight_per_zone:
                further = self._split_zone(sz, dist_matrix, result)
                split_zones.remove(sz)
                split_zones.extend(further)
                break

        return split_zones

    def _check_straight_line_misleading(
        self,
        orders: list[Order],
        dist_matrix: dict,
        result: ClusterResult,
    ):
        for (id1, id2), (road_dist, straight_dist, crossings) in dist_matrix.items():
            if id1 >= id2:
                continue

            if straight_dist < 1:
                continue

            ratio = straight_dist / road_dist
            diff_m = road_dist - straight_dist
            if ratio < self.config.straight_line_ratio_threshold and diff_m > self.config.min_distance_diff_m:
                bridge_info = ""
                if crossings:
                    bridge_names = [
                        c.get("bridge", {}).get("bridge_name", c.get("bridge_id", "未知"))
                        for c in crossings
                    ]
                    bridge_info = f"涉及桥梁: {', '.join(bridge_names)}；"

                warning = {
                    "order_pair": (id1, id2),
                    "straight_distance_m": round(straight_dist, 1),
                    "road_distance_m": round(road_dist, 1),
                    "ratio": round(ratio, 3),
                    "diff_m": round(diff_m, 1),
                    "bridge_crossings": len(crossings),
                    "message": (
                        f"订单 {id1} ↔ {id2}：直线 {straight_dist:.0f}m"
                        f" vs 路网 {road_dist:.0f}m"
                        f"（比值 {ratio:.2f}，差 {diff_m:.0f}m）"
                        f"{bridge_info}直线距离严重低估实际配送距离"
                    ),
                }
                result.distance_warnings.append(warning)

                anomaly = Anomaly(
                    anomaly_type=AnomalyType.STRAIGHT_LINE_MISLEADING,
                    severity="high" if ratio < 0.5 else "medium",
                    message=warning["message"],
                    details={
                        "order_pair": (id1, id2),
                        "straight_distance_m": straight_dist,
                        "road_distance_m": road_dist,
                        "ratio": ratio,
                        "bridge_crossings": len(crossings),
                    },
                )
                result.anomalies.append(anomaly)

    def _check_zone_anomalies(self, zone: Zone, dist_matrix: dict):
        for o in zone.orders:
            if zone.rider_id:
                pass

        if zone.order_count > self.config.max_orders_per_zone:
            anomaly = Anomaly(
                anomaly_type=AnomalyType.CAPACITY_VIOLATION,
                severity="critical",
                message=(
                    f"片区 {zone.id} 订单数 {zone.order_count}"
                    f" 超过上限 {self.config.max_orders_per_zone}"
                ),
                details={
                    "zone_id": zone.id,
                    "order_count": zone.order_count,
                    "max_orders": self.config.max_orders_per_zone,
                },
            )
            zone.anomalies.append(anomaly)

        if zone.total_weight > self.config.max_weight_per_zone:
            anomaly = Anomaly(
                anomaly_type=AnomalyType.CAPACITY_VIOLATION,
                severity="critical",
                message=(
                    f"片区 {zone.id} 总重量 {zone.total_weight:.1f}"
                    f" 超过上限 {self.config.max_weight_per_zone}"
                ),
                details={
                    "zone_id": zone.id,
                    "total_weight": zone.total_weight,
                    "max_weight": self.config.max_weight_per_zone,
                },
            )
            zone.anomalies.append(anomaly)

        if zone.max_road_distance_m > self.config.max_radius_m:
            anomaly = Anomaly(
                anomaly_type=AnomalyType.CAPACITY_VIOLATION,
                severity="high",
                message=(
                    f"片区 {zone.id} 最大路网距离 {zone.max_road_distance_m:.0f}m"
                    f" 超过半径上限 {self.config.max_radius_m:.0f}m"
                ),
                details={
                    "zone_id": zone.id,
                    "max_road_distance_m": zone.max_road_distance_m,
                    "max_radius_m": self.config.max_radius_m,
                },
            )
            zone.anomalies.append(anomaly)

        bridge_crossings = 0
        for i, o1 in enumerate(zone.orders):
            for j, o2 in enumerate(zone.orders):
                if i >= j:
                    continue
                key = (o1.id, o2.id)
                if key in dist_matrix:
                    _, _, crossings = dist_matrix[key]
                    for c in crossings:
                        penalty = c.get("bridge", {}).get("detour_penalty_m", 0)
                        if penalty > self.config.bridge_detour_threshold_m:
                            bridge_crossings += 1
                            anomaly = Anomaly(
                                anomaly_type=AnomalyType.BRIDGE_DETOUR_MISSED,
                                severity="high",
                                message=(
                                    f"片区 {zone.id} 内订单 {o1.id} ↔ {o2.id}"
                                    f" 经过桥梁 {c.get('bridge_id', '未知')}"
                                    f" 绕行罚距 {penalty:.0f}m"
                                    f" 超过阈值 {self.config.bridge_detour_threshold_m:.0f}m"
                                ),
                                details={
                                    "zone_id": zone.id,
                                    "order_pair": (o1.id, o2.id),
                                    "bridge_id": c.get("bridge_id"),
                                    "detour_penalty_m": penalty,
                                    "threshold_m": self.config.bridge_detour_threshold_m,
                                },
                            )
                            zone.anomalies.append(anomaly)

        if bridge_crossings == 0 and zone.bridge_crossings > 0:
            pass
