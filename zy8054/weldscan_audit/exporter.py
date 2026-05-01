import csv
from pathlib import Path
from typing import List, Dict
from datetime import datetime
import jinja2
from .parser import Weld
from .geometry import Defect
from .rules import generate_summary


def export_markdown(
    defects: List[Defect],
    welds: Dict[str, Weld],
    output_path: Path,
) -> None:
    summary = generate_summary(defects)

    content = f"# 焊缝超声探伤缺陷报告\n\n"
    content += f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

    content += "## 摘要\n\n"
    content += f"- 总缺陷数: {summary['total_defects']}\n"
    content += f"- 严重缺陷 (Level ≥3): {summary['critical']}\n"
    content += f"- 主要缺陷 (Level 2): {summary['major']}\n"
    content += f"- 次要缺陷 (Level 1): {summary['minor']}\n"
    content += f"- 可接受缺陷: {summary['acceptable']}\n\n"

    content += "## 缺陷详情\n\n"
    content += "| 缺陷ID | 焊缝ID | 深度(mm) | 水平位置(mm) | 振幅 | 严重等级 | 适用规则 | 回波数 |\n"
    content += "|--------|--------|----------|--------------|------|----------|----------|--------|\n"

    for defect in defects:
        weld = welds.get(defect.weld_id, None)
        content += (
            f"| {defect.defect_id} | {defect.weld_id} | {defect.depth_mm:.2f} | "
            f"{defect.horizontal_position_mm:.2f} | {defect.amplitude:.2f} | "
            f"{defect.severity_level} | {defect.rule_name} | {len(defect.echo_ids)} |\n"
        )

    output_path.write_text(content, encoding="utf-8")


def export_recheck_csv(
    defects: List[Defect],
    welds: Dict[str, Weld],
    output_path: Path,
) -> None:
    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "defect_id",
                "weld_id",
                "depth_mm",
                "horizontal_position_mm",
                "amplitude",
                "severity_level",
                "rule_name",
                "echo_ids",
                "probe_ids",
                "needs_recheck",
            ],
        )
        writer.writeheader()

        for defect in defects:
            needs_recheck = "YES" if defect.severity_level >= 2 else "NO"
            writer.writerow({
                "defect_id": defect.defect_id,
                "weld_id": defect.weld_id,
                "depth_mm": f"{defect.depth_mm:.2f}",
                "horizontal_position_mm": f"{defect.horizontal_position_mm:.2f}",
                "amplitude": f"{defect.amplitude:.2f}",
                "severity_level": defect.severity_level,
                "rule_name": defect.rule_name,
                "echo_ids": ",".join(defect.echo_ids),
                "probe_ids": ",".join(defect.probe_ids),
                "needs_recheck": needs_recheck,
            })


HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>焊缝超声探伤剖面图</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .weld-section { margin-bottom: 40px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .weld-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; }
        .defect { position: absolute; width: 10px; height: 10px; border-radius: 50%; transform: translate(-50%, -50%); cursor: pointer; }
        .defect.critical { background-color: #e74c3c; box-shadow: 0 0 8px #e74c3c; }
        .defect.major { background-color: #f39c12; box-shadow: 0 0 8px #f39c12; }
        .defect.minor { background-color: #f1c40f; box-shadow: 0 0 8px #f1c40f; }
        .defect.acceptable { background-color: #2ecc71; box-shadow: 0 0 8px #2ecc71; }
        .canvas-container { position: relative; background-color: #f8f9fa; border: 2px solid #34495e; height: 400px; }
        .legend { display: flex; gap: 20px; margin-top: 10px; }
        .legend-item { display: flex; align-items: center; gap: 8px; }
        .legend-dot { width: 12px; height: 12px; border-radius: 50%; }
        .tooltip { position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; pointer-events: none; z-index: 1000; }
    </style>
</head>
<body>
    <div class="container">
        <h1>焊缝超声探伤剖面图</h1>
        <p>生成时间: {{ timestamp }}</p>
        <div class="legend">
            <div class="legend-item"><div class="legend-dot" style="background:#e74c3c"></div>严重 (Level ≥3)</div>
            <div class="legend-item"><div class="legend-dot" style="background:#f39c12"></div>主要 (Level 2)</div>
            <div class="legend-item"><div class="legend-dot" style="background:#f1c40f"></div>次要 (Level 1)</div>
            <div class="legend-item"><div class="legend-dot" style="background:#2ecc71"></div>可接受</div>
        </div>
        {% for weld_id, weld_data in weld_data.items() %}
        <div class="weld-section">
            <div class="weld-title">焊缝: {{ weld_id }} (厚度: {{ weld_data.thickness_mm }}mm)</div>
            <div class="canvas-container" id="canvas-{{ weld_id }}">
                {% for defect in weld_data.defects %}
                <div class="defect {{ defect.class }}"
                     style="left: {{ defect.x_pct }}%; top: {{ defect.y_pct }}%;"
                     data-info="{{ defect.info }}"></div>
                {% endfor %}
            </div>
        </div>
        {% endfor %}
    </div>
    <script>
        document.querySelectorAll('.defect').forEach(function(el) {
            el.addEventListener('mouseenter', function(e) {
                const tooltip = document.createElement('div');
                tooltip.className = 'tooltip';
                tooltip.textContent = this.getAttribute('data-info');
                tooltip.style.left = (e.pageX + 10) + 'px';
                tooltip.style.top = (e.pageY + 10) + 'px';
                document.body.appendChild(tooltip);
                this._tooltip = tooltip;
            });
            el.addEventListener('mousemove', function(e) {
                if (this._tooltip) {
                    this._tooltip.style.left = (e.pageX + 10) + 'px';
                    this._tooltip.style.top = (e.pageY + 10) + 'px';
                }
            });
            el.addEventListener('mouseleave', function() {
                if (this._tooltip) {
                    document.body.removeChild(this._tooltip);
                    this._tooltip = null;
                }
            });
        });
    </script>
</body>
</html>
"""


def export_html(
    defects: List[Defect],
    welds: Dict[str, Weld],
    output_path: Path,
) -> None:
    weld_data = {}
    for defect in defects:
        weld_id = defect.weld_id
        if weld_id not in weld_data:
            weld = welds.get(weld_id)
            thickness_mm = weld.thickness if weld else 50.0
            thickness_mm = weld.to_mm(thickness_mm) if weld else thickness_mm
            weld_data[weld_id] = {
                "thickness_mm": thickness_mm,
                "defects": [],
            }

        defect_class = "acceptable"
        if defect.severity_level >= 3:
            defect_class = "critical"
        elif defect.severity_level == 2:
            defect_class = "major"
        elif defect.severity_level == 1:
            defect_class = "minor"

        max_depth = weld_data[weld_id]["thickness_mm"] * 1.5
        max_horz = 2000.0
        x_pct = min(100.0, max(5.0, (defect.horizontal_position_mm / max_horz) * 90.0 + 5.0))
        y_pct = min(95.0, max(5.0, (defect.depth_mm / max_depth) * 90.0 + 5.0))

        info = (
            f"{defect.defect_id} | 深度: {defect.depth_mm:.1f}mm | "
            f"位置: {defect.horizontal_position_mm:.1f}mm | "
            f"振幅: {defect.amplitude:.1f} | 等级: {defect.severity_level}"
        )

        weld_data[weld_id]["defects"].append({
            "class": defect_class,
            "x_pct": x_pct,
            "y_pct": y_pct,
            "info": info,
        })

    template = jinja2.Template(HTML_TEMPLATE)
    html_content = template.render(
        timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        weld_data=weld_data,
    )
    output_path.write_text(html_content, encoding="utf-8")
