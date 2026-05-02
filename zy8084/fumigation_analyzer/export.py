"""
Export module for fumigation analysis reports.
Generates Markdown summary, CSV risk events log, and HTML interactive timeline.
"""

from datetime import datetime
from pathlib import Path
from typing import Any


class MarkdownExporter:
    def __init__(self, output_path: Path):
        self.output_path = output_path

    def export(
        self,
        timeline: list[dict[str, Any]],
        risk_events: list[dict[str, Any]],
        warehouses: list[dict[str, Any]],
        sensor_data: list[dict[str, Any]]
    ):
        lines = []
        lines.append("# 筒仓熏蒸作业安全复核报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 1. 概览")
        lines.append("")
        wh_ids = set(e["warehouse_id"] for e in timeline)
        lines.append(f"- 分析仓房数: {len(wh_ids)}")
        lines.append(f"- 传感器记录数: {len(sensor_data)}")
        lines.append(f"- 时间线事件数: {len(timeline)}")
        lines.append(f"- 风险事件数: {len(risk_events)}")
        lines.append("")

        lines.append("## 2. 仓房信息")
        lines.append("")
        lines.append("| 仓房ID | 名称 | 体积(m³) | 通风率(m³/h) |")
        lines.append("|--------|------|---------|------------|")
        for w in warehouses:
            lines.append(
                f"| {w['warehouse_id']} | {w['name']} | "
                f"{w['volume_m3']:.1f} | {w['ventilation_rate']:.1f} |"
            )
        lines.append("")

        safe_events = [e for e in risk_events if e.get("risk_level") == "safe"]
        danger_events = [e for e in risk_events if e.get("risk_level") in ("high", "critical")]

        lines.append("## 3. 风险事件汇总")
        lines.append("")
        lines.append(f"- 安全进入时机: {len(safe_events)} 次")
        lines.append(f"- 危险/禁止进入: {len(danger_events)} 次")
        lines.append("")

        if danger_events:
            lines.append("### 3.1 危险事件 (需关注)")
            lines.append("")
            lines.append("| 时间 | 仓房 | 传感器 | 浓度(ppm) | 风险等级 | 建议 |")
            lines.append("|------|------|--------|----------|----------|------|")
            for e in danger_events[:20]:
                lines.append(
                    f"| {e['timestamp'].strftime('%Y-%m-%d %H:%M')} | "
                    f"{e['warehouse_id']} | {e['sensor_id']} | "
                    f"{e.get('concentration_ppm', 0):.1f} | "
                    f"{e.get('risk_level', 'unknown')} | "
                    f"{e.get('message', '')} |"
                )
            lines.append("")

        lines.append("## 4. 安全进入时机建议")
        lines.append("")
        if safe_events:
            lines.append("以下时刻建议为安全进入时机:")
            lines.append("")
            for e in safe_events[:10]:
                lines.append(
                    f"- **{e['timestamp'].strftime('%Y-%m-%d %H:%M')}** - "
                    f"仓房 {e['warehouse_id']}: {e.get('message', '')}"
                )
        else:
            lines.append("未检测到满足安全进入条件的时刻。")
        lines.append("")

        lines.append("## 5. 时间线摘要")
        lines.append("")
        if timeline:
            start = timeline[0]["timestamp"]
            end = timeline[-1]["timestamp"]
            duration = (end - start).total_seconds() / 3600
            lines.append(f"- 起始时间: {start.strftime('%Y-%m-%d %H:%M')}")
            lines.append(f"- 结束时间: {end.strftime('%Y-%m-%d %H:%M')}")
            lines.append(f"- 总时长: {duration:.1f} 小时")
        lines.append("")

        self.output_path.write_text("\n".join(lines), encoding="utf-8")


class CSVExporter:
    def __init__(self, output_path: Path):
        self.output_path = output_path

    def export(self, risk_events: list[dict[str, Any]]):
        lines = []
        lines.append("timestamp,warehouse_id,sensor_id,concentration_ppm,risk_level,action,message,ventilation_active")

        for e in risk_events:
            ts = e.get("timestamp", "")
            if hasattr(ts, "strftime"):
                ts = ts.strftime("%Y-%m-%d %H:%M:%S")
            lines.append(
                f'{ts},{e.get("warehouse_id","")},{e.get("sensor_id","")},'
                f'{e.get("concentration_ppm", 0):.1f},{e.get("risk_level","")},'
                f'{e.get("action","")},"{e.get("message","")}",{e.get("ventilation_active", False)}'
            )

        self.output_path.write_text("\n".join(lines), encoding="utf-8")


class HTMLExporter:
    def __init__(self, output_path: Path):
        self.output_path = output_path

    def export(
        self,
        timeline: list[dict[str, Any]],
        risk_events: list[dict[str, Any]],
        warehouses: list[dict[str, Any]]
    ):
        html_parts = []
        html_parts.append("<!DOCTYPE html>")
        html_parts.append("<html lang='zh-CN'>")
        html_parts.append("<head>")
        html_parts.append("<meta charset='UTF-8'>")
        html_parts.append("<meta name='viewport' content='width=device-width, initial-scale=1.0'>")
        html_parts.append("<title>筒仓熏蒸作业时间线</title>")
        html_parts.append("<style>")
        html_parts.append(self._css_styles())
        html_parts.append("</style>")
        html_parts.append("</head>")
        html_parts.append("<body>")
        html_parts.append("<h1>筒仓熏蒸作业安全时间线</h1>")

        html_parts.append('<div id="controls">')
        html_parts.append('<label>筛选仓房: <select id="warehouse-filter"><option value="">全部</option>')
        wh_ids = sorted(set(e["warehouse_id"] for e in timeline))
        for wid in wh_ids:
            html_parts.append(f'<option value="{wid}">{wid}</option>')
        html_parts.append('</select></label>')
        html_parts.append('<label>筛选风险等级: <select id="risk-filter"><option value="">全部</option>')
        html_parts.append('<option value="safe">安全</option>')
        html_parts.append('<option value="medium">中等</option>')
        html_parts.append('<option value="high">高危</option>')
        html_parts.append('<option value="critical">危险</option>')
        html_parts.append('</select></label>')
        html_parts.append('</div>')

        html_parts.append('<div id="summary">')
        html_parts.append(f'<span>总事件: {len(timeline)}</span>')
        html_parts.append(f'<span>风险事件: {len(risk_events)}</span>')
        html_parts.append(f'<span>仓房: {len(wh_ids)}</span>')
        html_parts.append('</div>')

        html_parts.append('<div id="timeline">')
        for event in timeline:
            ts = event.get("timestamp")
            ts_str = ts.strftime("%Y-%m-%d %H:%M:%S") if hasattr(ts, "strftime") else str(ts)
            wh_id = event.get("warehouse_id", "")
            sensor = event.get("sensor_id", "")
            conc = event.get("concentration_ppm", 0)
            vent = event.get("ventilation_active", False)
            risk = "unknown"
            for re in risk_events:
                if re.get("timestamp") == ts and re.get("warehouse_id") == wh_id:
                    risk = re.get("risk_level", "unknown")
                    break

            html_parts.append(f'<div class="event {risk}">')
            html_parts.append(f'<div class="event-time">{ts_str}</div>')
            html_parts.append(f'<div class="event-wh">{wh_id}</div>')
            html_parts.append(f'<div class="event-sensor">{sensor}</div>')
            html_parts.append(f'<div class="event-conc">{conc:.1f} ppm</div>')
            html_parts.append(f'<div class="event-vent">{"运行" if vent else "停止"}</div>')
            html_parts.append(f'<div class="event-risk">{risk}</div>')
            html_parts.append('</div>')
        html_parts.append('</div>')

        html_parts.append("<script>")
        html_parts.append(self._javascript_code())
        html_parts.append("</script>")
        html_parts.append("</body>")
        html_parts.append("</html>")

        self.output_path.write_text("\n".join(html_parts), encoding="utf-8")

    def _css_styles(self) -> str:
        return """
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
               padding: 20px; background: #f5f5f5; }
        h1 { margin-bottom: 20px; color: #333; }
        #controls { margin-bottom: 15px; padding: 15px; background: #fff;
                    border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        #controls label { margin-right: 20px; }
        #summary { margin-bottom: 15px; padding: 10px 15px; background: #e8f4f8;
                   border-radius: 8px; display: flex; gap: 30px; }
        #timeline { display: flex; flex-direction: column; gap: 8px; }
        .event { display: grid; grid-template-columns: 180px 100px 100px 120px 80px 80px;
                 padding: 12px 15px; background: #fff; border-radius: 6px;
                 box-shadow: 0 1px 3px rgba(0,0,0,0.1); align-items: center; }
        .event.safe { border-left: 4px solid #4caf50; }
        .event.medium { border-left: 4px solid #ff9800; }
        .event.high { border-left: 4px solid #f44336; }
        .event.critical { border-left: 4px solid #9c27b0; }
        .event.unknown { border-left: 4px solid #9e9e9e; }
        .event-time { font-weight: 600; color: #333; }
        .event-conc { font-weight: 700; }
        .event-risk { padding: 4px 8px; border-radius: 4px; text-align: center;
                      font-size: 12px; color: #fff; }
        .safe .event-risk { background: #4caf50; }
        .medium .event-risk { background: #ff9800; }
        .high .event-risk { background: #f44336; }
        .critical .event-risk { background: #9c27b0; }
        .unknown .event-risk { background: #9e9e9e; }
        """

    def _javascript_code(self) -> str:
        return """
        document.getElementById('warehouse-filter').addEventListener('change', filterEvents);
        document.getElementById('risk-filter').addEventListener('change', filterEvents);
        function filterEvents() {
            var wh = document.getElementById('warehouse-filter').value;
            var risk = document.getElementById('risk-filter').value;
            var events = document.querySelectorAll('.event');
            events.forEach(function(e) {
                var show = true;
                if (wh && e.querySelector('.event-wh').textContent !== wh) show = false;
                if (risk && !e.classList.contains(risk)) show = false;
                e.style.display = show ? '' : 'none';
            });
        }
        """
