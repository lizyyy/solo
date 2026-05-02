"""Report export module for mooring quality check."""

import csv
from pathlib import Path
from datetime import datetime
from typing import Any, List, Dict


def export_markdown_report(
    output_path: Path,
    berth_plan: Dict[str, Any],
    peaks: List[Dict[str, Any]],
    overlimits: List[Dict[str, Any]],
    drifts: List[Dict[str, Any]],
    missing: List[Dict[str, Any]],
    aligned_data: List[Dict[str, Any]],
) -> None:
    """Export detailed markdown report."""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("# 靠泊缆绳张力质量报告\n\n")
        f.write(f"**船舶**: {berth_plan['vessel_name']}\n\n")
        f.write(f"**泊位**: {berth_plan['berth_id']}\n\n")
        f.write(f"**靠泊时间**: {berth_plan['arrival_time']} 至 {berth_plan['departure_time']}\n\n")
        f.write(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("---\n\n")

        f.write("## 张力峰值\n\n")
        if peaks:
            f.write("| 开始时间 | 结束时间 | 最大张力(kN) | 持续时间(秒) |\n")
            f.write("|----------|----------|-------------|---------------|\n")
            for p in peaks:
                f.write(f"| {p['start_time']} | {p['end_time']} | {p['max_tension_kn']:.1f} | {p['duration_sec']:.0f} |\n")
        else:
            f.write("未检测到张力峰值。\n\n")

        f.write("\n## 持续超限\n\n")
        if overlimits:
            f.write("| 开始时间 | 结束时间 | 超限阈值(kN) | 持续时间(秒) |\n")
            f.write("|----------|----------|--------------|---------------|\n")
            for o in overlimits:
                f.write(f"| {o['start_time']} | {o['end_time']} | {o['max_tension_kn']:.1f} | {o['duration_sec']:.0f} |\n")
        else:
            f.write("未检测到持续超限。\n\n")

        f.write("\n## 传感器漂移\n\n")
        if drifts:
            f.write("| 传感器ID | 时间 | 漂移量(kN) | 阈值(kN) |\n")
            f.write("|----------|------|------------|----------|\n")
            for d in drifts:
                f.write(f"| {d['sensor_id']} | {d['time']} | {d['drift_kn']:.1f} | {d['threshold_kn']:.1f} |\n")
        else:
            f.write("未检测到传感器漂移。\n\n")

        f.write("\n## 数据缺测区间\n\n")
        if missing:
            f.write("| 开始时间 | 结束时间 | 间隔(秒) |\n")
            f.write("|----------|----------|----------|\n")
            for m in missing:
                f.write(f"| {m['start_time']} | {m['end_time']} | {m['gap_seconds']:.0f} |\n")
        else:
            f.write("未检测到数据缺测。\n\n")

        f.write("\n## 统计摘要\n\n")
        if aligned_data:
            tensions = [r["tension_kn"] for r in aligned_data]
            f.write(f"- 数据点数: {len(tensions)}\n")
            f.write(f"- 平均张力: {sum(tensions)/len(tensions):.1f} kN\n")
            f.write(f"- 最大张力: {max(tensions):.1f} kN\n")
            f.write(f"- 最小张力: {min(tensions):.1f} kN\n")
            sensors = set(r["sensor_id"] for r in aligned_data)
            f.write(f"- 活跃传感器数: {len(sensors)}\n")


def export_alerts_csv(
    output_path: Path,
    peaks: List[Dict[str, Any]],
    overlimits: List[Dict[str, Any]],
    drifts: List[Dict[str, Any]],
    missing: List[Dict[str, Any]],
) -> None:
    """Export alerts summary to CSV."""
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["alert_type", "start_time", "end_time", "sensor_id", "value", "threshold", "duration_sec"])

        for p in peaks:
            writer.writerow([
                "TENSION_PEAK",
                p["start_time"],
                p["end_time"],
                "",
                p["max_tension_kn"],
                "",
                p["duration_sec"],
            ])

        for o in overlimits:
            writer.writerow([
                "OVERLIMIT",
                o["start_time"],
                o["end_time"],
                "",
                o["max_tension_kn"],
                o["max_tension_kn"],
                o["duration_sec"],
            ])

        for d in drifts:
            writer.writerow([
                "SENSOR_DRIFT",
                d["time"],
                d["time"],
                d["sensor_id"],
                d["drift_kn"],
                d["threshold_kn"],
                0,
            ])

        for m in missing:
            writer.writerow([
                "MISSING_DATA",
                m["start_time"],
                m["end_time"],
                "",
                "",
                "",
                m["gap_seconds"],
            ])


def export_html_timeline(
    output_path: Path,
    berth_plan: Dict[str, Any],
    aligned_data: List[Dict[str, Any]],
    peaks: List[Dict[str, Any]],
    overlimits: List[Dict[str, Any]],
) -> None:
    """Export interactive HTML timeline."""
    tensions_js = [[
        r["timestamp"].isoformat(),
        r["tension_kn"],
        r["sensor_id"],
        r.get("tide_m", 0),
        r.get("wind_speed_kn", 0),
    ] for r in aligned_data]

    peaks_js = [[
        p["start_time"].isoformat(),
        p["end_time"].isoformat(),
        p["max_tension_kn"],
    ] for p in peaks]

    overlimits_js = [[
        o["start_time"].isoformat(),
        o["end_time"].isoformat(),
        o["max_tension_kn"],
    ] for o in overlimits]

    html_content = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>缆绳张力时间线 - """ + berth_plan['vessel_name'] + """</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .summary-card { background: #f8f9fa; padding: 15px; border-radius: 4px; flex: 1; }
        .summary-card h3 { margin-top: 0; color: #666; }
        .summary-card .value { font-size: 24px; font-weight: bold; color: #333; }
        #timelineChart { width: 100%; height: 400px; }
        .legend { margin: 10px 0; }
        .legend span { margin-right: 20px; }
        .peak { color: #ff6b6b; }
        .overlimit { color: #ffa500; }
        .normal { color: #4ecdc4; }
    </style>
</head>
<body>
    <div class="container">
        <h1>缆绳张力时间线</h1>
        <p><strong>船舶:</strong> """ + berth_plan['vessel_name'] + """ | <strong>泊位:</strong> """ + berth_plan['berth_id'] + """</p>
        <p><strong>靠泊时间:</strong> """ + str(berth_plan['arrival_time']) + """ 至 """ + str(berth_plan['departure_time']) + """</p>

        <div class="summary">
            <div class="summary-card">
                <h3>数据点数</h3>
                <div class="value" id="dataCount">-</div>
            </div>
            <div class="summary-card">
                <h3>峰值事件</h3>
                <div class="value" id="peakCount">-</div>
            </div>
            <div class="summary-card">
                <h3>超限事件</h3>
                <div class="value" id="overlimitCount">-</div>
            </div>
        </div>

        <div class="legend">
            <span class="normal">● 正常</span>
            <span class="peak">● 张力峰值</span>
            <span class="overlimit">● 超限</span>
        </div>

        <canvas id="timelineChart"></canvas>
    </div>

    <script>
        const tensionData = """ + str(tensions_js) + """;
        const peaksData = """ + str(peaks_js) + """;
        const overlimitsData = """ + str(overlimits_js) + """;

        document.getElementById('dataCount').textContent = tensionData.length;
        document.getElementById('peakCount').textContent = peaksData.length;
        document.getElementById('overlimitCount').textContent = overlimitsData.length;

        const datasets = [];

        const sensors = [...new Set(tensionData.map(d => d[2]))];
        const colors = ['#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe', '#6c5ce7'];

        sensors.forEach((sensor, idx) => {
            const sensorData = tensionData
                .filter(d => d[2] === sensor)
                .map(d => ({ x: d[0], y: d[1] }));
            datasets.push({
                label: sensor,
                data: sensorData,
                borderColor: colors[idx % colors.length],
                backgroundColor: 'transparent',
                tension: 0.1,
            });
        });

        const ctx = document.getElementById('timelineChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + ' kN';
                            }
                        }
                    }
                },
                scales: {
                    x: { type: 'time', time: { unit: 'minute' } },
                    y: { title: { display: true, text: '张力 (kN)' } }
                }
            }
        });
    </script>
</body>
</html>"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)
