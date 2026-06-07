import json
import os
from datetime import datetime
from typing import List
from .models import NegotiationPoint, PointStatus


class MapExporter:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.export_dir = os.path.join(data_dir, "exports")
        os.makedirs(self.export_dir, exist_ok=True)

    def export_report(self, points: List[NegotiationPoint], filename: str = None) -> str:
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"电梯加装协商报告_{timestamp}.html"
        
        filepath = os.path.join(self.export_dir, filename)
        
        boundary_points = [p for p in points if p.is_boundary]
        normal_points = [p for p in points if not p.is_boundary]
        
        points_geojson = self._points_to_geojson(points)
        stats = self._calculate_stats(points)
        
        html_content = self._generate_html(points_geojson, stats, boundary_points, normal_points)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html_content)
        
        return filepath

    def _points_to_geojson(self, points: List[NegotiationPoint]) -> dict:
        features = []
        for p in points:
            marker_color = "#ff6b6b" if p.is_boundary else "#4ecdc4"
            if p.status == PointStatus.MANAGER_REVIEWED:
                marker_color = "#ffe66d"
            elif p.status == PointStatus.NOTICE_SUPPLEMENTED:
                marker_color = "#95e1d3"
            
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [p.lng, p.lat]
                },
                "properties": {
                    "point_id": p.point_id,
                    "name": p.name,
                    "address": p.address,
                    "status": p.status.value,
                    "is_boundary": p.is_boundary,
                    "located_streets": "、".join(p.located_streets) if p.located_streets else "未知",
                    "next_action": p.next_action.value,
                    "missing_materials": "、".join(p.missing_materials) if p.missing_materials else "无",
                    "marker-color": marker_color,
                    "support_rate": p.inspection.support_rate if p.inspection else 0,
                    "has_notice": p.notice is not None
                }
            })
        
        return {
            "type": "FeatureCollection",
            "features": features
        }

    def _calculate_stats(self, points: List[NegotiationPoint]) -> dict:
        total = len(points)
        boundary_count = len([p for p in points if p.is_boundary])
        has_notice = len([p for p in points if p.notice])
        reviewed = len([p for p in points if p.status == PointStatus.MANAGER_REVIEWED])
        
        status_counts = {}
        for p in points:
            s = p.status.value
            status_counts[s] = status_counts.get(s, 0) + 1
        
        return {
            "total": total,
            "boundary_count": boundary_count,
            "has_notice": has_notice,
            "reviewed": reviewed,
            "status_counts": status_counts,
            "export_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    def _generate_html(self, geojson: dict, stats: dict, boundary_points: List[NegotiationPoint], normal_points: List[NegotiationPoint]) -> str:
        boundary_details = ""
        for p in boundary_points:
            missing = "、".join(p.missing_materials) if p.missing_materials else "无"
            boundary_details += f"""
            <div class="point-card boundary">
                <h4>🔴 {p.name}</h4>
                <p><strong>地址：</strong>{p.address}</p>
                <p><strong>涉及街道：</strong>{'、'.join(p.located_streets) if p.located_streets else '未知'}</p>
                <p><strong>当前状态：</strong>{p.status.value}</p>
                <p><strong>留下原因：</strong>点位位于两个或多个街道边界上，需项目经理确认归属</p>
                <p><strong>缺少材料：</strong>{missing}</p>
                <p><strong>下一步：</strong>{p.next_action.value}</p>
                <p><strong>复核备注：</strong>{p.review_notes if p.review_notes else '待复核'}</p>
            </div>
            """
        
        normal_details = ""
        for p in normal_points:
            missing = "、".join(p.missing_materials) if p.missing_materials else "无"
            normal_details += f"""
            <div class="point-card">
                <h4>🟢 {p.name}</h4>
                <p><strong>地址：</strong>{p.address}</p>
                <p><strong>所属街道：</strong>{'、'.join(p.located_streets) if p.located_streets else '未知'}</p>
                <p><strong>当前状态：</strong>{p.status.value}</p>
                <p><strong>缺少材料：</strong>{missing}</p>
                <p><strong>下一步：</strong>{p.next_action.value}</p>
            </div>
            """
        
        status_bars = ""
        for status, count in stats["status_counts"].items():
            pct = (count / stats["total"] * 100) if stats["total"] > 0 else 0
            status_bars += f"""
            <div class="status-bar">
                <span class="status-label">{status}</span>
                <div class="bar-container">
                    <div class="bar-fill" style="width: {pct}%"></div>
                </div>
                <span class="status-count">{count}个</span>
            </div>
            """
        
        return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>老旧小区电梯加装协商 - 地图导出报告</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; }}
        .container {{ max-width: 1200px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }}
        .header h1 {{ font-size: 28px; margin-bottom: 10px; }}
        .header p {{ opacity: 0.9; }}
        .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }}
        .stat-card {{ background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }}
        .stat-card .number {{ font-size: 32px; font-weight: bold; color: #667eea; }}
        .stat-card .label {{ color: #666; margin-top: 5px; }}
        .section {{ background: white; padding: 25px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }}
        .section h2 {{ font-size: 20px; margin-bottom: 15px; color: #333; border-left: 4px solid #667eea; padding-left: 12px; }}
        .status-bar {{ display: flex; align-items: center; margin-bottom: 10px; gap: 10px; }}
        .status-label {{ width: 120px; font-size: 14px; }}
        .bar-container {{ flex: 1; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; }}
        .bar-fill {{ height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 10px; transition: width 0.3s; }}
        .status-count {{ width: 60px; text-align: right; font-weight: bold; }}
        .point-card {{ border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; margin-bottom: 12px; background: #fafbfc; }}
        .point-card.boundary {{ border-left: 4px solid #ff6b6b; background: #fff5f5; }}
        .point-card h4 {{ margin-bottom: 8px; color: #333; }}
        .point-card p {{ margin: 4px 0; font-size: 14px; color: #555; }}
        .legend {{ display: flex; gap: 20px; margin-top: 15px; flex-wrap: wrap; }}
        .legend-item {{ display: flex; align-items: center; gap: 8px; }}
        .legend-dot {{ width: 12px; height: 12px; border-radius: 50%; }}
        .chart-container {{ position: relative; height: 300px; margin-top: 20px; }}
        .footer {{ text-align: center; color: #999; padding: 20px; font-size: 13px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏢 老旧小区电梯加装协商报告</h1>
            <p>导出时间：{stats['export_time']} | 本报告说明每条点位为什么被留下、还缺什么材料、下一步该找谁</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="number">{stats['total']}</div>
                <div class="label">总点位数量</div>
            </div>
            <div class="stat-card">
                <div class="number" style="color: #ff6b6b;">{stats['boundary_count']}</div>
                <div class="label">边界待复核</div>
            </div>
            <div class="stat-card">
                <div class="number" style="color: #4ecdc4;">{stats['has_notice']}</div>
                <div class="label">已补录施工告示</div>
            </div>
            <div class="stat-card">
                <div class="number" style="color: #ffe66d;">{stats['reviewed']}</div>
                <div class="label">项目经理已复核</div>
            </div>
        </div>

        <div class="section">
            <h2>📊 状态统计概览</h2>
            {status_bars}
            <div class="chart-container">
                <canvas id="statusChart"></canvas>
            </div>
        </div>

        <div class="section">
            <h2>🔴 边界点位详情（需项目经理复核）</h2>
            <p style="margin-bottom: 15px; color: #666;">这些点位位于两个或多个街道边界上，暂时不归入正常流程，留给项目经理复核确认归属。</p>
            {boundary_details if boundary_details else '<p style="color: #999;">暂无边界点位</p>'}
        </div>

        <div class="section">
            <h2>🟢 正常点位详情</h2>
            {normal_details if normal_details else '<p style="color: #999;">暂无正常点位</p>'}
        </div>

        <div class="section">
            <h2>📋 图例说明</h2>
            <div class="legend">
                <div class="legend-item">
                    <div class="legend-dot" style="background: #ff6b6b;"></div>
                    <span>边界待复核 - 找项目经理</span>
                </div>
                <div class="legend-item">
                    <div class="legend-dot" style="background: #95e1d3;"></div>
                    <span>已补录施工告示 - 街道规划员小姜处理</span>
                </div>
                <div class="legend-item">
                    <div class="legend-dot" style="background: #ffe66d;"></div>
                    <span>项目经理已复核</span>
                </div>
                <div class="legend-item">
                    <div class="legend-dot" style="background: #4ecdc4;"></div>
                    <span>正常流程</span>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>本报告由老旧小区电梯加装协商系统自动生成 | 不是冷冰冰的系统日志，是能干活的工作指引</p>
        </div>
    </div>

    <script>
        const ctx = document.getElementById('statusChart').getContext('2d');
        const statusData = {json.dumps(stats['status_counts'], ensure_ascii=False)};
        new Chart(ctx, {{
            type: 'doughnut',
            data: {{
                labels: Object.keys(statusData),
                datasets: [{{
                    data: Object.values(statusData),
                    backgroundColor: [
                        '#667eea', '#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#764ba2'
                    ],
                    borderWidth: 0
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{
                        position: 'right'
                    }}
                }}
            }}
        }});
    </script>
</body>
</html>
"""
