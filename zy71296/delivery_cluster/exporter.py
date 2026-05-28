import csv
import json
import os
from pathlib import Path
from typing import Union

from delivery_cluster.cluster import ClusterResult
from delivery_cluster.models import Order, Rider
from delivery_cluster.explainer import Explainer


class Exporter:
    def __init__(self, output_dir: Union[str, Path] = "./output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.explainer = Explainer()

    def export_report(
        self,
        result: ClusterResult,
        orders: list[Order],
        riders: list[Rider],
        format_type: str = "json",
    ) -> str:
        report = self._build_report(result, orders, riders)

        if format_type == "json":
            return self._export_json(report, "zone_report.json")
        elif format_type == "csv":
            return self._export_csv(report, "zone_report.csv")
        else:
            raise ValueError(f"不支持的导出格式: {format_type}")

    def _build_report(
        self,
        result: ClusterResult,
        orders: list[Order],
        riders: list[Rider],
    ) -> dict:
        order_map = {o.id: o for o in orders}
        rider_map = {r.id: r for r in riders}

        zones_detail = []
        for zone in result.zones:
            zone_orders = []
            for o in zone.orders:
                o_data = {
                    "order_id": o.id,
                    "lat": o.lat,
                    "lng": o.lng,
                    "weight": o.weight,
                    "source_file": o.source_file,
                    "source_line": o.source_line,
                }
                zone_orders.append(o_data)

            zone_explanation = self.explainer.explain_zone(zone)

            zones_detail.append(
                {
                    **zone.to_dict(),
                    "orders": zone_orders,
                    "rider_info": rider_map.get(zone.rider_id) and {
                        "id": zone.rider_id,
                        "lat": rider_map[zone.rider_id].lat,
                        "lng": rider_map[zone.rider_id].lng,
                        "capacity": rider_map[zone.rider_id].capacity,
                    },
                    "explanation_summary": zone_explanation["summary"],
                    "anomaly_explanations": zone_explanation["anomaly_explanations"],
                }
            )

        global_explanations = []
        for anomaly in result.anomalies:
            global_explanations.append(
                {
                    **anomaly.to_dict(),
                    "detailed_explanation": self.explainer.explain_anomaly(anomaly),
                }
            )

        return {
            "summary": {
                "total_orders": result.stats.get("total_orders", 0),
                "total_zones": result.stats.get("total_zones", 0),
                "total_riders": result.stats.get("total_riders", 0),
                "avg_orders_per_zone": result.stats.get("avg_orders_per_zone", 0),
                "max_zone_orders": result.stats.get("max_zone_orders", 0),
                "min_zone_orders": result.stats.get("min_zone_orders", 0),
                "total_global_anomalies": len(result.anomalies),
                "total_anomalies": sum(len(z.anomalies) for z in result.zones),
                "critical_anomalies": sum(
                    1
                    for z in result.zones
                    for a in z.anomalies
                    if a.severity == "critical"
                ) + sum(1 for a in result.anomalies if a.severity == "critical"),
                "unassigned_orders": len(result.unassigned_orders),
            },
            "zones": zones_detail,
            "distance_warnings": result.distance_warnings,
            "global_anomalies": global_explanations,
            "unassigned_orders": [
                {
                    "order_id": o.id,
                    "lat": o.lat,
                    "lng": o.lng,
                    "weight": o.weight,
                    "source_file": o.source_file,
                    "source_line": o.source_line,
                }
                for o in result.unassigned_orders
            ],
            "raw_data": {
                "orders": [
                    {
                        "id": o.id,
                        "lat": o.lat,
                        "lng": o.lng,
                        "weight": o.weight,
                        "source_file": o.source_file,
                        "source_line": o.source_line,
                    }
                    for o in orders
                ],
                "riders": [
                    {
                        "id": r.id,
                        "lat": r.lat,
                        "lng": r.lng,
                        "capacity": r.capacity,
                    }
                    for r in riders
                ],
            },
        }

    def _export_json(self, report: dict, filename: str) -> str:
        path = self.output_dir / filename
        with open(path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        return str(path)

    def _export_csv(self, report: dict, filename: str) -> str:
        path = self.output_dir / filename

        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)

            writer.writerow(["=== 片区报告 ==="])
            writer.writerow(
                [
                    "片区ID",
                    "骑手ID",
                    "订单数",
                    "总重量",
                    "中心纬度",
                    "中心经度",
                    "最大路网距离(m)",
                    "最大直线距离(m)",
                    "跨河次数",
                    "异常数",
                    "严重异常数",
                    "说明",
                ]
            )

            for z in report["zones"]:
                critical_count = sum(
                    1
                    for a in z["anomaly_explanations"]
                    if a["severity"] == "critical"
                )
                writer.writerow(
                    [
                        z["zone_id"],
                        z["rider_id"] or "",
                        z["order_count"],
                        z["total_weight"],
                        z["center_lat"],
                        z["center_lng"],
                        z["max_road_distance_m"],
                        z["max_straight_distance_m"],
                        z["bridge_crossings"],
                        len(z["anomaly_explanations"]),
                        critical_count,
                        z.get("explanation_summary", ""),
                    ]
                )

            writer.writerow([])
            writer.writerow(["=== 片区-订单明细 ==="])
            writer.writerow(
                [
                    "片区ID",
                    "订单ID",
                    "纬度",
                    "经度",
                    "重量",
                    "来源文件",
                    "来源行",
                ]
            )
            for z in report["zones"]:
                for o in z["orders"]:
                    writer.writerow(
                        [
                            z["zone_id"],
                            o["order_id"],
                            o["lat"],
                            o["lng"],
                            o["weight"],
                            o.get("source_file", ""),
                            o.get("source_line", ""),
                        ]
                    )

            writer.writerow([])
            writer.writerow(["=== 异常明细 ==="])
            writer.writerow(
                [
                    "关联片区",
                    "异常类型",
                    "严重程度",
                    "消息",
                    "详细说明",
                    "来源文件",
                    "来源行",
                ]
            )

            for a in report["global_anomalies"]:
                details = a.get("details", {})
                writer.writerow(
                    [
                        details.get("zone_id", "全局"),
                        a["type"],
                        a["severity"],
                        a["message"],
                        a.get("detailed_explanation", "").replace("\n", " | "),
                        a.get("source_file", ""),
                        a.get("source_line", ""),
                    ]
                )

            for z in report["zones"]:
                for a in z["anomaly_explanations"]:
                    writer.writerow(
                        [
                            z["zone_id"],
                            a["type"],
                            a["severity"],
                            a.get("explanation", "").split("\n")[0],
                            a.get("explanation", "").replace("\n", " | "),
                            a.get("source", ""),
                            "",
                        ]
                    )

            writer.writerow([])
            writer.writerow(["=== 直线距离误导警告 ==="])
            writer.writerow(
                ["订单1", "订单2", "直线距离(m)", "路网距离(m)", "比值", "差值(m)", "跨桥数", "警告"]
            )
            for w in report["distance_warnings"]:
                pair = w.get("order_pair", ("", ""))
                writer.writerow(
                    [
                        pair[0],
                        pair[1],
                        w["straight_distance_m"],
                        w["road_distance_m"],
                        w["ratio"],
                        w["diff_m"],
                        w["bridge_crossings"],
                        w["message"],
                    ]
                )

        return str(path)

    def export_map(
        self,
        result: ClusterResult,
        orders: list[Order],
        riders: list[Rider],
        filename: str = "delivery_map.html",
    ) -> str:
        path = self.output_dir / filename
        html = self._render_map_html(result, orders, riders)
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        return str(path)

    def _render_map_html(
        self,
        result: ClusterResult,
        orders: list[Order],
        riders: list[Rider],
    ) -> str:
        colors = [
            "#e6194b",
            "#3cb44b",
            "#4363d8",
            "#f58231",
            "#911eb4",
            "#46f0f0",
            "#f032e6",
            "#bcf60c",
            "#fabebe",
            "#008080",
            "#e6beff",
            "#9a6324",
            "#fffac8",
            "#800000",
            "#aaffc3",
            "#808000",
            "#ffd8b1",
            "#000075",
            "#808080",
            "#ffffff",
            "#000000",
        ]

        all_lats = [o.lat for o in orders] + [r.lat for r in riders]
        all_lngs = [o.lng for o in orders] + [r.lng for r in riders]
        center_lat = sum(all_lats) / len(all_lats) if all_lats else 39.9
        center_lng = sum(all_lngs) / len(all_lngs) if all_lngs else 116.4

        zone_markers = []
        for idx, zone in enumerate(result.zones):
            color = colors[idx % len(colors)]

            for o in zone.orders:
                popup = (
                    f"<b>订单 {o.id}</b><br>"
                    f"片区: {zone.id}<br>"
                    f"重量: {o.weight}<br>"
                )
                zone_markers.append(
                    {
                        "lat": o.lat,
                        "lng": o.lng,
                        "color": color,
                        "popup": popup,
                        "type": "order",
                    }
                )

            zone_popup = (
                f"<b>片区 {zone.id}</b><br>"
                f"订单数: {zone.order_count}<br>"
                f"总重: {zone.total_weight:.1f}<br>"
                f"最大路网距离: {zone.max_road_distance_m:.0f}m<br>"
            )
            if zone.center_lat and zone.center_lng:
                zone_markers.append(
                    {
                        "lat": zone.center_lat,
                        "lng": zone.center_lng,
                        "color": color,
                        "popup": zone_popup,
                        "type": "zone_center",
                    }
                )

        rider_markers = []
        for r in riders:
            popup = (
                f"<b>骑手 {r.id}</b><br>"
                f"容量: {r.capacity}<br>"
            )
            rider_markers.append(
                {"lat": r.lat, "lng": r.lng, "popup": popup}
            )

        anomaly_markers = []
        for warning in result.distance_warnings:
            pair = warning["order_pair"]
            o1 = next((o for o in orders if o.id == pair[0]), None)
            o2 = next((o for o in orders if o.id == pair[1]), None)
            if o1 and o2:
                anomaly_markers.append(
                    {
                        "lat1": o1.lat,
                        "lng1": o1.lng,
                        "lat2": o2.lat,
                        "lng2": o2.lng,
                        "message": warning["message"],
                    }
                )

        json_zone_markers = json.dumps(zone_markers, ensure_ascii=False)
        json_rider_markers = json.dumps(rider_markers, ensure_ascii=False)
        json_anomaly_markers = json.dumps(anomaly_markers, ensure_ascii=False)
        json_zones = json.dumps(
            [
                {
                    "id": z.id,
                    "order_ids": [o.id for o in z.orders],
                    "anomalies": [a.to_dict() for a in z.anomalies],
                }
                for z in result.zones
            ],
            ensure_ascii=False,
        )

        stats_html = self._render_stats_panel(result)

        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>配送聚类半径工具 - 地图</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }}
  #container {{ display: flex; height: 100vh; }}
  #sidebar {{ width: 420px; overflow-y: auto; background: #f7f7f7; padding: 16px; border-right: 1px solid #ddd; }}
  #map {{ flex: 1; }}
  h2 {{ font-size: 18px; margin-bottom: 12px; color: #333; }}
  h3 {{ font-size: 14px; margin: 16px 0 8px; color: #555; }}
  .stat-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }}
  .stat-card {{ background: #fff; padding: 10px; border-radius: 6px; border: 1px solid #e0e0e0; }}
  .stat-value {{ font-size: 20px; font-weight: bold; color: #1976d2; }}
  .stat-label {{ font-size: 12px; color: #777; }}
  .zone-card {{ background: #fff; padding: 10px; margin: 8px 0; border-radius: 6px; border-left: 4px solid #1976d2; }}
  .zone-card.anomaly {{ border-left-color: #d32f2f; }}
  .zone-id {{ font-weight: bold; font-size: 14px; }}
  .zone-info {{ font-size: 12px; color: #666; margin-top: 4px; }}
  .anomaly-badge {{ display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-right: 4px; }}
  .severity-critical {{ background: #d32f2f; color: #fff; }}
  .severity-high {{ background: #f57c00; color: #fff; }}
  .severity-medium {{ background: #fbc02d; color: #333; }}
  .severity-warning {{ background: #1976d2; color: #fff; }}
  .anomaly-item {{ padding: 6px; background: #fff8e1; border-radius: 4px; margin: 4px 0; font-size: 12px; }}
  .legend {{ margin-top: 12px; padding: 8px; background: #fff; border-radius: 4px; }}
  .legend-item {{ display: flex; align-items: center; margin: 4px 0; font-size: 12px; }}
  .legend-color {{ width: 16px; height: 16px; border-radius: 50%; margin-right: 8px; }}
</style>
</head>
<body>
<div id="container">
  <div id="sidebar">
    {stats_html}

    <h3>📌 图例</h3>
    <div class="legend">
      <div class="legend-item">
        <span class="legend-color" style="background: #3cb44b; border: 2px solid #000;"></span>
        <span>骑手起点</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: #e6194b;"></span>
        <span>订单点（按片区着色）</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: #000; border: 2px solid #e6194b;"></span>
        <span>片区中心</span>
      </div>
    </div>

    <h3>⚠️ 距离误导警告</h3>
    <div id="warnings"></div>

    <h3>📦 片区列表</h3>
    <div id="zones-list"></div>
  </div>
  <div id="map"></div>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const zoneMarkers = {json_zone_markers};
  const riderMarkers = {json_rider_markers};
  const anomalyMarkers = {json_anomaly_markers};
  const zones = {json_zones};

  const map = L.map('map').setView([{center_lat}, {center_lng}], 13);
  L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }}).addTo(map);

  const zoneLayers = {{}};
  zoneMarkers.forEach(m => {{
    const iconSize = m.type === 'zone_center' ? 12 : 8;
    const fillOpacity = m.type === 'zone_center' ? 1 : 0.8;
    const weight = m.type === 'zone_center' ? 3 : 1;

    const marker = L.circleMarker([m.lat, m.lng], {{
      radius: iconSize,
      fillColor: m.color,
      color: m.type === 'zone_center' ? '#000' : m.color,
      weight: weight,
      fillOpacity: fillOpacity,
    }}).bindPopup(m.popup);

    const zoneId = m.type === 'zone_center' ? 'center' : m.popup.match(/片区: (Z-[\w-]+)/)?.[1];
    if (zoneId && zoneId !== 'center') {{
      if (!zoneLayers[zoneId]) zoneLayers[zoneId] = L.layerGroup();
      marker.addTo(zoneLayers[zoneId]);
    }}
    marker.addTo(map);
  }});

  riderMarkers.forEach(r => {{
    L.circleMarker([r.lat, r.lng], {{
      radius: 10,
      fillColor: '#3cb44b',
      color: '#000',
      weight: 2,
      fillOpacity: 1,
    }}).bindPopup(r.popup).addTo(map);
  }});

  anomalyMarkers.forEach(a => {{
    L.polyline(
      [[a.lat1, a.lng1], [a.lat2, a.lng2]],
      {{ color: '#ff0000', dashArray: '10, 10', weight: 2, opacity: 0.7 }}
    ).bindPopup(a.message).addTo(map);
  }});

  const warningsHtml = anomalyMarkers.map(w =>
    '<div class="anomaly-item">⚠️ ' + w.message.replace(/\n/g, '<br>') + '</div>'
  ).join('');
  document.getElementById('warnings').innerHTML = warningsHtml || '<p style="color:#888;font-size:12px">无</p>';

  const zonesHtml = zones.map(z => {{
    const hasCritical = z.anomalies.some(a => a.severity === 'critical');
    const anomalyBadges = z.anomalies.map(a =>
      '<span class="anomaly-badge severity-' + a.severity + '">' + a.type + '</span>'
    ).join('');
    return '<div class="zone-card ' + (hasCritical ? 'anomaly' : '') + '">' +
           '<div class="zone-id">📦 ' + z.id + '</div>' +
           '<div class="zone-info">订单: ' + z.order_ids.length + anomalyBadges + '</div>' +
           '</div>';
  }}).join('');
  document.getElementById('zones-list').innerHTML = zonesHtml || '<p style="color:#888;font-size:12px">无</p>';
</script>
</body>
</html>
"""
        return html

    def _render_stats_panel(self, result: ClusterResult) -> str:
        stats = result.stats
        critical = sum(
            1 for z in result.zones for a in z.anomalies if a.severity == "critical"
        )
        high = sum(
            1 for z in result.zones for a in z.anomalies if a.severity == "high"
        )
        warnings = len(result.distance_warnings)

        return f"""
    <h2>📊 配送聚类报告</h2>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-value">{stats.get('total_orders', 0)}</div>
        <div class="stat-label">总订单数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{stats.get('total_zones', 0)}</div>
        <div class="stat-label">片区数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{stats.get('total_riders', 0)}</div>
        <div class="stat-label">骑手数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{stats.get('avg_orders_per_zone', 0)}</div>
        <div class="stat-label">平均每区订单</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: {'#d32f2f' if critical > 0 else '#4caf50'};">{critical}</div>
        <div class="stat-label">严重异常</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: {'#f57c00' if high > 0 else '#4caf50'};">{high}</div>
        <div class="stat-label">高优先级异常</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: {'#1976d2' if warnings > 0 else '#4caf50'};">{warnings}</div>
        <div class="stat-label">距离误导警告</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{len(result.unassigned_orders)}</div>
        <div class="stat-label">未分配订单</div>
      </div>
    </div>
"""
