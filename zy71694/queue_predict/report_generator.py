from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import asdict

from .models import (
    PipelineContext,
    Registration,
    AnomalyType,
    RecordStatus,
)
from .param_store import ParamStore


class ReportGenerator:
    def __init__(self, output_dir: str = ".reports"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate(self, ctx: PipelineContext, anomaly_explanations: Dict[str, List[str]]) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_id = f"report_{timestamp}"

        param_store = ParamStore(os.path.join(self.output_dir, ".param_store"))
        param_info = param_store.reproduce(ctx.param_snapshot_id) or {}

        normal_count = 0
        anomaly_count = 0
        anomaly_reg_ids: List[str] = []
        for reg in ctx.registrations:
            has_anomaly = (
                len(reg.anomaly_types) > 0
                and AnomalyType.NONE not in reg.anomaly_types
            )
            if has_anomaly:
                anomaly_count += 1
                anomaly_reg_ids.append(reg.reg_id)
            else:
                normal_count += 1

        wait_times = [
            p.predicted_wait_minutes
            for p in ctx.prediction_results.values()
            if p.predicted_wait_minutes >= 0
        ]
        avg_wait = sum(wait_times) / len(wait_times) if wait_times else 0
        max_wait = max(wait_times) if wait_times else 0
        min_wait = min(wait_times) if wait_times else 0

        predictions = []
        for reg in ctx.registrations:
            pred = ctx.prediction_results.get(reg.reg_id)
            sim = ctx.simulation_results.get(reg.reg_id)
            if pred is None:
                continue
            predictions.append({
                "reg_id": reg.reg_id,
                "patient_name": reg.patient_name,
                "queue_number": reg.queue_number,
                "doctor_name": reg.doctor_name,
                "is_addon": reg.is_addon,
                "anomaly_types": [a.value for a in reg.anomaly_types],
                "predicted_wait_minutes": pred.predicted_wait_minutes,
                "confidence_interval": [pred.confidence_low, pred.confidence_high],
                "factors": pred.factors,
                "anomaly_explanations": pred.anomaly_explanations,
                "queue_position": sim.queue_position if sim else None,
                "status": reg.status.value,
            })

        report_data = {
            "report_id": report_id,
            "generated_at": datetime.now().isoformat(),
            "param_snapshot_id": ctx.param_snapshot_id,
            "param_snapshot": param_info,
            "filter_conditions": ctx.filter_conditions,
            "summary": {
                "total_registrations": len(ctx.registrations),
                "normal_count": normal_count,
                "anomaly_count": anomaly_count,
                "anomaly_reg_ids": anomaly_reg_ids,
                "avg_wait_minutes": round(avg_wait, 1),
                "max_wait_minutes": round(max_wait, 1),
                "min_wait_minutes": round(min_wait, 1),
            },
            "anomaly_summary": self._summarize_anomalies(ctx),
            "predictions": predictions,
            "detailed_anomaly_explanations": anomaly_explanations,
        }

        json_path = os.path.join(self.output_dir, f"{report_id}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)

        html_path = os.path.join(self.output_dir, f"{report_id}.html")
        self._generate_html(report_data, html_path)

        return json_path

    def _summarize_anomalies(self, ctx: PipelineContext) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for reg in ctx.registrations:
            for atype in reg.anomaly_types:
                key = atype.value
                counts[key] = counts.get(key, 0) + 1
        return counts

    def _generate_html(self, data: Dict[str, Any], output_path: str) -> None:
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>排队叫号等待预测报告 - {data['report_id']}</title>
<style>
body {{ font-family: -apple-system, "Microsoft YaHei", sans-serif; margin: 20px; background: #f5f5f5; }}
.container {{ max-width: 1200px; margin: 0 auto; }}
h1 {{ color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }}
h2 {{ color: #555; margin-top: 30px; }}
.summary {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }}
.card {{ background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
.card h3 {{ margin: 0 0 10px 0; color: #666; font-size: 14px; }}
.card .value {{ font-size: 24px; font-weight: bold; color: #333; }}
.card.anomaly .value {{ color: #F44336; }}
table {{ width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #eee; }}
th {{ background: #4CAF50; color: white; }}
tr.anomaly {{ background: #FFF3E0; }}
tr:hover {{ background: #f0f0f0; }}
.tag {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 4px; }}
.tag-anomaly {{ background: #FF5722; color: white; }}
.tag-normal {{ background: #4CAF50; color: white; }}
.param-box {{ background: white; padding: 15px; border-radius: 8px; margin: 10px 0; font-family: monospace; font-size: 13px; }}
.explanation {{ background: #FFF8E1; padding: 10px; border-left: 4px solid #FF9800; margin: 5px 0; }}
</style>
</head>
<body>
<div class="container">
<h1>排队叫号等待预测报告</h1>
<p>生成时间: {data['generated_at']} | 参数快照: <code>{data['param_snapshot_id']}</code></p>

<h2>概览</h2>
<div class="summary">
<div class="card"><h3>总挂号数</h3><div class="value">{data['summary']['total_registrations']}</div></div>
<div class="card"><h3>正常记录</h3><div class="value">{data['summary']['normal_count']}</div></div>
<div class="card anomaly"><h3>异常记录</h3><div class="value">{data['summary']['anomaly_count']}</div></div>
<div class="card"><h3>平均等待</h3><div class="value">{data['summary']['avg_wait_minutes']}分钟</div></div>
<div class="card"><h3>最长等待</h3><div class="value">{data['summary']['max_wait_minutes']}分钟</div></div>
<div class="card"><h3>最短等待</h3><div class="value">{data['summary']['min_wait_minutes']}分钟</div></div>
</div>

<h2>异常统计</h2>
<table>
<tr><th>异常类型</th><th>数量</th></tr>
"""

        for atype, count in data.get("anomaly_summary", {}).items():
            html += f"<tr><td>{atype}</td><td>{count}</td></tr>"
        html += "</table>"

        html += """
<h2>参数快照（可复现）</h2>
<div class="param-box">
"""
        param_snapshot = data.get("param_snapshot", {})
        if param_snapshot:
            html += f"<p>筛选条件: <pre>{json.dumps(param_snapshot.get('filter_conditions', {}), ensure_ascii=False, indent=2)}</pre></p>"
            html += f"<p>计算参数: <pre>{json.dumps(param_snapshot.get('calc_params', {}), ensure_ascii=False, indent=2)}</pre></p>"
        else:
            html += "<p>参数快照未找到</p>"
        html += "</div>"

        html += """
<h2>预测详情</h2>
<table>
<tr><th>排队号</th><th>患者</th><th>医生</th><th>队列位置</th><th>预估等待(分钟)</th><th>置信区间</th><th>状态</th><th>异常</th></tr>
"""
        for p in data.get("predictions", []):
            is_anomaly = "none" not in p.get("anomaly_types", ["none"])
            row_class = "anomaly" if is_anomaly else ""
            tag = '<span class="tag tag-anomaly">异常</span>' if is_anomaly else '<span class="tag tag-normal">正常</span>'
            ci = f"[{p['confidence_interval'][0]:.1f}, {p['confidence_interval'][1]:.1f}]"
            html += f'<tr class="{row_class}">'
            html += f"<td>{p['queue_number']}</td>"
            html += f"<td>{p['patient_name']}</td>"
            html += f"<td>{p['doctor_name']}</td>"
            html += f"<td>{p.get('queue_position', '-')}</td>"
            html += f"<td>{p['predicted_wait_minutes']}</td>"
            html += f"<td>{ci}</td>"
            html += f"<td>{tag}</td>"
            html += f"<td>{', '.join(p.get('anomaly_types', []))}</td>"
            html += "</tr>"

        html += "</table>"

        if data.get("detailed_anomaly_explanations"):
            html += "<h2>异常详细解释</h2>"
            for reg_id, exps in data["detailed_anomaly_explanations"].items():
                for exp in exps:
                    html += f'<div class="explanation"><strong>{reg_id}</strong>: {exp}</div>'

        html += """
</div>
</body>
</html>"""

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)
