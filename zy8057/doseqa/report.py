import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List
import numpy as np


def export_qa_report(report_path: Path, results: Dict, gamma_pass_rate: float,
                     structure_stats: Dict, measurements: List[Dict]):
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("# 放疗剂量QA报告\n\n")
        f.write(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("## 总体结果\n\n")
        overall = "✅ 通过" if results['overall']['passed'] else "❌ 未通过"
        f.write(f"**结论**: {overall}\n\n")
        f.write("## Gamma分析\n\n")
        f.write(f"- {results['gamma']['message']}\n\n")
        f.write("## 器官剂量分析\n\n")
        for name, res in results['structures'].items():
            f.write(f"- {res['message']}\n")
            if name in structure_stats and structure_stats[name]:
                stats = structure_stats[name]
                f.write(f"  - 最大剂量: {stats['max_dose']:.2f}\n")
                f.write(f"  - 平均剂量: {stats['mean_dose']:.2f}\n")
        f.write("\n## 测量点统计\n\n")
        f.write(f"- 总测量点数: {len(measurements)}\n")
        f.write(f"- Gamma通过率: {gamma_pass_rate:.2f}%\n")


def export_failed_points(csv_path: Path, measurements: List[Dict], gamma_values: np.ndarray):
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'x_mm', 'y_mm', 'z_mm', 'measured_dose', 
                                               'plan_dose', 'gamma_value'])
        writer.writeheader()
        for pt, g in zip(measurements, gamma_values):
            if g > 1.0:
                writer.writerow({
                    'id': pt['id'],
                    'x_mm': f"{pt['x']:.2f}",
                    'y_mm': f"{pt['y']:.2f}",
                    'z_mm': f"{pt['z']:.2f}",
                    'measured_dose': f"{pt['measured_dose']:.4f}",
                    'plan_dose': f"{pt.get('plan_dose', 0):.4f}",
                    'gamma_value': f"{g:.4f}"
                })


def export_heatmap(html_path: Path, measurements: List[Dict], gamma_values: np.ndarray):
    data = []
    for pt, g in zip(measurements, gamma_values):
        data.append({
            'x': pt['x'], 'y': pt['y'], 'z': pt['z'],
            'gamma': float(g),
            'measured': pt['measured_dose'],
            'plan': pt.get('plan_dose', 0)
        })
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Gamma Heatmap</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .container {{ display: flex; gap: 20px; }}
        .chart {{ flex: 1; }}
        .legend {{ width: 200px; }}
        .scale {{ background: linear-gradient(to right, #00ff00, #ffff00, #ff0000); height: 20px; border-radius: 4px; }}
        .scale-labels {{ display: flex; justify-content: space-between; margin-top: 5px; }}
    </style>
</head>
<body>
    <h1>Gamma 分析热力图</h1>
    <div class="container">
        <div class="chart">
            <svg width="600" height="400" id="chart">
                <g transform="translate(50, 20)">
                    <text x="250" y="0" text-anchor="middle" font-weight="bold">XY 平面 Gamma 值分布</text>
                    <rect x="0" y="20" width="500" height="300" fill="#f0f0f0" stroke="#ccc"/>
                    {generate_svg_points(data)}
                </g>
            </svg>
        </div>
        <div class="legend">
            <h3>图例 (Gamma值)</h3>
            <div class="scale"></div>
            <div class="scale-labels">
                <span>0.0</span>
                <span>0.5</span>
                <span>1.0</span>
                <span>&gt;1.5</span>
            </div>
            <p style="margin-top: 20px;">
                <span style="color: #00ff00;">● 通过</span><br>
                <span style="color: #ffff00;">● 临界</span><br>
                <span style="color: #ff0000;">● 未通过</span>
            </p>
        </div>
    </div>
    <h3>数据点详情</h3>
    <table border="1" cellpadding="8" cellspacing="0" style="margin-top: 10px;">
        <tr>
            <th>ID</th>
            <th>X (mm)</th>
            <th>Y (mm)</th>
            <th>Z (mm)</th>
            <th>测量剂量</th>
            <th>计划剂量</th>
            <th>Gamma值</th>
            <th>状态</th>
        </tr>
        {generate_table_rows(data)}
    </table>
</body>
</html>
"""
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)


def generate_svg_points(data):
    if not data:
        return ""
    xs = [d['x'] for d in data]
    ys = [d['y'] for d in data]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    w, h = 500, 300
    points = []
    for d in data:
        px = w * (d['x'] - x_min) / (x_max - x_min + 1e-10)
        py = h * (1 - (d['y'] - y_min) / (y_max - y_min + 1e-10))
        g = d['gamma']
        if g <= 1.0:
            color = f"rgb({int(255*g)}, 255, 0)" if g > 0.5 else "#00ff00"
        else:
            color = "#ff0000"
        points.append(f'<circle cx="{px}" cy="{py+20}" r="5" fill="{color}" stroke="#333"/>')
    return "\n".join(points)


def generate_table_rows(data):
    rows = []
    for d in data:
        status = "通过" if d['gamma'] <= 1.0 else "未通过"
        color = "green" if d['gamma'] <= 1.0 else "red"
        rows.append(f"""
        <tr>
            <td>{d.get('id', '-')}</td>
            <td>{d['x']:.2f}</td>
            <td>{d['y']:.2f}</td>
            <td>{d['z']:.2f}</td>
            <td>{d['measured']:.4f}</td>
            <td>{d['plan']:.4f}</td>
            <td>{d['gamma']:.4f}</td>
            <td style="color: {color}; font-weight: bold;">{status}</td>
        </tr>""")
    return "\n".join(rows)
