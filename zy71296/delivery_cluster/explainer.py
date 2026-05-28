from delivery_cluster.models import Anomaly, AnomalyType, Zone


class Explainer:
    def __init__(self):
        self.templates = {
            AnomalyType.STRAIGHT_LINE_MISLEADING: self._explain_straight_line,
            AnomalyType.ZONE_OVERLOAD: self._explain_zone_overload,
            AnomalyType.BRIDGE_DETOUR_MISSED: self._explain_bridge_detour,
            AnomalyType.ISOLATED_ORDER: self._explain_isolated,
            AnomalyType.CAPACITY_VIOLATION: self._explain_capacity,
        }

    def explain_anomaly(self, anomaly: Anomaly) -> str:
        handler = self.templates.get(anomaly.anomaly_type)
        if handler:
            return handler(anomaly)
        return f"[{anomaly.anomaly_type.value}] {anomaly.message}"

    def explain_zone(self, zone: Zone) -> dict:
        explanations = []
        for anomaly in zone.anomalies:
            explanations.append(
                {
                    "type": anomaly.anomaly_type.value,
                    "severity": anomaly.severity,
                    "explanation": self.explain_anomaly(anomaly),
                    "details": anomaly.details,
                    "source": (
                        f"{anomaly.source_file}:{anomaly.source_line}"
                        if anomaly.source_file
                        else None
                    ),
                }
            )

        summary = self._zone_summary(zone)

        return {
            "zone_id": zone.id,
            "summary": summary,
            "anomaly_explanations": explanations,
            "has_critical": any(
                a.severity == "critical" for a in zone.anomalies
            ),
        }

    def _zone_summary(self, zone: Zone) -> str:
        parts = [
            f"片区 {zone.id}",
            f"共 {zone.order_count} 单",
            f"总重 {zone.total_weight:.1f}",
        ]
        if zone.rider_id:
            parts.append(f"骑手 {zone.rider_id}")
        if zone.max_road_distance_m > 0:
            parts.append(f"最大路网距离 {zone.max_road_distance_m:.0f}m")
        if zone.max_straight_distance_m > 0:
            parts.append(f"最大直线距离 {zone.max_straight_distance_m:.0f}m")
        if zone.bridge_crossings > 0:
            parts.append(f"跨河 {zone.bridge_crossings} 次")

        if zone.anomalies:
            critical = sum(1 for a in zone.anomalies if a.severity == "critical")
            high = sum(1 for a in zone.anomalies if a.severity == "high")
            medium = sum(1 for a in zone.anomalies if a.severity == "medium")
            alert_parts = []
            if critical:
                alert_parts.append(f"{critical} 个严重")
            if high:
                alert_parts.append(f"{high} 个高")
            if medium:
                alert_parts.append(f"{medium} 个中")
            if alert_parts:
                parts.append(f"⚠ {', '.join(alert_parts)} 异常")

        return " | ".join(parts)

    def _explain_straight_line(self, anomaly: Anomaly) -> str:
        d = anomaly.details
        ratio = d.get("ratio", 0)
        straight = d.get("straight_distance_m", 0)
        road = d.get("road_distance_m", 0)
        crossings = d.get("bridge_crossings", 0)
        pair = d.get("order_pair", ("?", "?"))

        lines = [
            f"【直线距离误导】订单 {pair[0]} ↔ {pair[1]}",
            f"  直线距离: {straight:.0f}m",
            f"  路网距离: {road:.0f}m",
            f"  比值: {ratio:.2f}（直线仅为路网的 {ratio * 100:.0f}%）",
            f"  差值: {road - straight:.0f}m",
        ]

        if crossings > 0:
            lines.append(f"  原因: 跨河路段 {crossings} 处，需绕行桥梁")
            lines.append(f"  影响: 若按直线距离划片，骑手实际配送距离被低估，导致片区半径虚小")
            lines.append(f"  建议: 将该订单对拆分到不同片区，或调整片区半径以路网距离为准")
        else:
            lines.append(f"  原因: 路网结构不直达，需绕路")
            lines.append(f"  建议: 使用路网距离替代直线距离进行片区划分")

        return "\n".join(lines)

    def _explain_zone_overload(self, anomaly: Anomaly) -> str:
        d = anomaly.details
        lines = [
            f"【片区超载】片区 {d.get('zone_id', '?')}",
            f"  订单数: {d.get('order_count', '?')}（上限 {d.get('max_orders', '?')}）",
            f"  总重量: {d.get('total_weight', 0):.1f}（上限 {d.get('max_weight', '?')}）",
            f"  原因: {d.get('reason', '未明确')}",
            f"  影响: 骑手无法在合理时间内完成配送，延误率升高",
            f"  建议: 已自动拆分该片区，请检查拆分后的片区是否合理",
            f"  追溯: 检查订单密度是否在局部过高，考虑增加骑手数量",
        ]
        return "\n".join(lines)

    def _explain_bridge_detour(self, anomaly: Anomaly) -> str:
        d = anomaly.details
        lines = [
            f"【桥梁绕行漏算】片区 {d.get('zone_id', '?')}",
            f"  订单对: {d.get('order_pair', ('?', '?'))}",
            f"  经过桥梁: {d.get('bridge_id', '未知')}",
            f"  绕行罚距: {d.get('detour_penalty_m', 0):.0f}m",
            f"  阈值: {d.get('threshold_m', 0):.0f}m",
            f"  影响: 该桥梁绕行距离显著增加配送时间，若未纳入计算会低估片区半径",
            f"  建议: 考虑将该订单对拆分到河两侧的不同片区，减少跨河配送",
        ]
        return "\n".join(lines)

    def _explain_isolated(self, anomaly: Anomaly) -> str:
        return (
            f"【孤立订单】{anomaly.message}\n"
            f"  影响: 无法归入任何片区\n"
            f"  建议: 检查订单坐标是否正确，或增加骑手覆盖范围"
        )

    def _explain_capacity(self, anomaly: Anomaly) -> str:
        d = anomaly.details
        lines = [
            f"【容量违规】片区 {d.get('zone_id', '?')}",
        ]
        if "order_count" in d:
            lines.append(
                f"  订单数: {d['order_count']}（上限 {d.get('max_orders', '?')}）"
            )
        if "total_weight" in d:
            lines.append(
                f"  总重量: {d['total_weight']:.1f}（上限 {d.get('max_weight', '?')}）"
            )
        if "max_road_distance_m" in d:
            lines.append(
                f"  最大路网距离: {d['max_road_distance_m']:.0f}m"
                f"（上限 {d.get('max_radius_m', 0):.0f}m）"
            )
        lines.append(f"  建议: 调整片区划分或增加骑手")
        return "\n".join(lines)
