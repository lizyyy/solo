"""报告生成模块 - 面向非技术用户，报告与明细一致，可从图表点回明细"""
import json
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from copy import deepcopy

from .config import REPORTS_DIR, EXPORTS_DIR
from .database import get_db, RAW_RECORDS_TABLE, CALCULATIONS_TABLE, CALC_STEPS_TABLE
from .charts import ChartGenerator


class ReportGenerator:
    """报告生成器 - 报告和明细保持一致，收尾时不会两套说法"""

    def __init__(self, batch_id: str):
        self.db = get_db()
        self.batch_id = batch_id
        self.chart_generator = ChartGenerator(batch_id)

    def _format_value(self, value: Any, digits: int = 2) -> str:
        """格式化数值显示"""
        if pd.isna(value):
            return "-"
        if isinstance(value, float):
            return f"{value:.{digits}f}"
        return str(value)

    def _severity_color(self, severity: str) -> str:
        """严重程度对应颜色"""
        return {
            "high": "#e74c3c",
            "medium": "#f39c12",
            "low": "#2ecc71"
        }.get(severity, "#333333")

    def _priority_color(self, priority: str) -> str:
        """排练优先级对应颜色"""
        return {
            "优先排练": "#e74c3c",
            "加强排练": "#f39c12",
            "正常排练": "#3498db",
            "保持状态": "#2ecc71"
        }.get(priority, "#333333")

    def generate_text_report(self, calc_results: Dict[str, Any],
                            anomaly_summary: Dict,
                            conflict_summary: Dict,
                            supplement_summary: Dict,
                            sources: List[Dict],
                            param_diff: Dict) -> str:
        """生成文本格式报告 - 给不看代码的人用"""
        lines = []
        lines.append("=" * 70)
        lines.append("  合唱声部排练优化分析报告")
        lines.append(f"  批次号: {self.batch_id}")
        lines.append(f"  生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 70)
        lines.append("")
        lines.append("【一、总体概览】")
        lines.append("-" * 50)
        personal_df = calc_results.get("personal_scores", pd.DataFrame())
        section_metrics = calc_results.get("section_metrics", pd.DataFrame())
        total_people = len(personal_df)
        avg_score = personal_df["个人综合分"].mean() if "个人综合分" in personal_df.columns else 0
        pass_rate = (personal_df["个人综合分"] >= 80).mean() * 100 if "个人综合分" in personal_df.columns else 0
        lines.append(f"  总参与人数: {total_people} 人")
        lines.append(f"  整体平均分: {self._format_value(avg_score)} 分")
        lines.append(f"  整体达标率: {self._format_value(pass_rate)} %")
        lines.append(f"  涉及声部数: {len(section_metrics)} 个")
        lines.append(f"  数据源数量: {len(sources)} 个")
        for s in sources:
            lines.append(f"    - [{s['source_type']}] {s['source_name']} ({s['record_count']}条记录)")
        lines.append("")
        param_override_count = len(param_diff) if param_diff else 0
        if param_override_count > 0:
            lines.append(f"  ⚠️  本批次使用了 {param_override_count} 个人工调优参数（非默认值）")
            for key, diff in param_diff.items():
                lines.append(f"    - {key}: {diff.get('default')} → {diff.get('current')}")
        lines.append("")
        lines.append("【二、各声部排练安排建议】")
        lines.append("-" * 50)
        priority_order = ["优先排练", "加强排练", "正常排练", "保持状态"]
        if not section_metrics.empty:
            sorted_sections = section_metrics.sort_values(
                "排练优先级",
                key=lambda x: x.map(lambda p: priority_order.index(p))
            )
            for _, row in sorted_sections.iterrows():
                color = self._priority_color(row["排练优先级"])
                priority_display = row["排练优先级"]
                if row["排练优先级"] in ["优先排练", "加强排练"]:
                    priority_display = "⚠️ " + priority_display
                lines.append(f"  ■ {row['声部']}: {priority_display}")
                lines.append(f"    平均分: {self._format_value(row['声部平均分'])} 分 | "
                           f"达标率: {self._format_value(row['声部达标率'])}% | "
                           f"优秀率: {self._format_value(row['声部优秀率'])}%")
                lines.append(f"    人数: {row['声部人数']} 人 | "
                           f"最高分: {self._format_value(row['声部最高分'])} | "
                           f"最低分: {self._format_value(row['声部最低分'])} | "
                           f"标准差: {self._format_value(row['声部标准差'])}")
                lines.append("")
        lines.append("")
        lines.append("【三、异常检测结果】")
        lines.append("-" * 50)
        anomaly_total = anomaly_summary.get("total", 0)
        if anomaly_total == 0:
            lines.append("  ✅ 未检测到异常")
        else:
            high = anomaly_summary.get("by_severity", {}).get("high", 0)
            medium = anomaly_summary.get("by_severity", {}).get("medium", 0)
            low = anomaly_summary.get("by_severity", {}).get("low", 0)
            lines.append(f"  共检测到 {anomaly_total} 个异常: 高{high}个, 中{medium}个, 低{low}个")
            lines.append("")
            for a in anomaly_summary.get("details", []):
                sev_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(a["severity"], "⚪")
                lines.append(f"  {sev_icon} [{a['anomaly_name']}] {a['description']}")
                if a["severity"] != "low":
                    lines.append(f"      相关数值: {json.dumps(a['values'], ensure_ascii=False)}")
                lines.append(f"      异常ID: {a['id']}")
            lines.append("")
        lines.append("【四、数据冲突检测】")
        lines.append("-" * 50)
        conflict_total = conflict_summary.get("total", 0)
        if conflict_total == 0:
            lines.append("  ✅ 未检测到数据冲突")
        else:
            unresolved = conflict_summary.get("unresolved", 0)
            lines.append(f"  共检测到 {conflict_total} 个冲突，其中 {unresolved} 个待解决")
            lines.append("")
            for c in conflict_summary.get("details", []):
                status = "✅ 已解决" if c.get("is_resolved") else "⚠️ 待决策"
                lines.append(f"  {status} 字段[{c['field_name']}]")
                lines.append(f"    来源A [{c['source_a']}]: {c['value_a']}")
                lines.append(f"    来源B [{c['source_b']}]: {c['value_b']}")
                lines.append(f"    建议: {c['suggested_action']}")
                if c.get("is_resolved"):
                    lines.append(f"    解决: {c.get('resolution')}")
                lines.append(f"    冲突ID: {c['id']}")
            lines.append("")
        lines.append("【五、补录记录】")
        lines.append("-" * 50)
        supplement_total = supplement_summary.get("total", 0)
        if supplement_total == 0:
            lines.append("  本批次无补录记录")
        else:
            lines.append(f"  共 {supplement_total} 条补录记录:")
            lines.append("")
            for s in supplement_summary.get("diff_summary", []):
                lines.append(f"  [{s['type']}] {s['field']}")
                if s['old']:
                    lines.append(f"    原值: {s['old']}")
                lines.append(f"    新值: {s['new']}")
                lines.append(f"    备注: {s['remark']} (操作人: {s['operator']})")
            lines.append("")
        supplement_compare = supplement_summary.get("comparison", {})
        if supplement_compare:
            lines.append("  补录前后指标对比:")
            comp_table = supplement_compare.get("comparison_table")
            if comp_table is not None and not comp_table.empty:
                for _, row in comp_table.iterrows():
                    if row.get("人数变化") or row.get("平均分变化") or row.get("达标率变化"):
                        changes = []
                        if row.get("人数变化"):
                            changes.append(f"人数{row['人数变化']:+d}")
                        if row.get("平均分变化") and abs(row["平均分变化"]) > 0.1:
                            changes.append(f"平均分{row['平均分变化']:+.1f}")
                        if row.get("达标率变化") and abs(row["达标率变化"]) > 0.1:
                            changes.append(f"达标率{row['达标率变化']:+.1f}%")
                        if changes:
                            lines.append(f"    {row['声部']}: {', '.join(changes)}")
            lines.append("")
        lines.append("【六、可复查链接】")
        lines.append("-" * 50)
        lines.append(f"  计算审计: 可通过 record_id 查询每条记录的计算步骤")
        lines.append(f"  参数版本: {calc_results.get('param_version', 'default_v1')}")
        lines.append(f"  权重配置: {json.dumps(calc_results.get('weights_used', {}), ensure_ascii=False)}")
        lines.append(f"  阈值配置: {json.dumps(calc_results.get('thresholds_used', {}), ensure_ascii=False)}")
        lines.append("")
        lines.append("【七、图表索引（可点击查看明细）】")
        lines.append("-" * 50)
        for chart in self.chart_generator.charts:
            drilldown = chart["drilldown_config"]
            lines.append(f"  📊 {chart['chart_title']}")
            lines.append(f"     文件: {Path(chart['file_path']).name}")
            lines.append(f"     下钻: 点击{drilldown.get('click_field', '')}可查看对应明细")
            lines.append(f"     图表ID: {chart['id']}")
        lines.append("")
        lines.append("=" * 70)
        lines.append("  报告生成完毕。所有数据、计算过程、异常样本均可复查。")
        lines.append("  如需复核计算过程，请提供 record_id 查询详细步骤。")
        lines.append("=" * 70)
        return "\n".join(lines)

    def generate_html_report(self, calc_results: Dict[str, Any],
                            anomaly_summary: Dict,
                            conflict_summary: Dict,
                            supplement_summary: Dict,
                            sources: List[Dict],
                            param_diff: Dict) -> str:
        """生成HTML交互式报告 - 图表可点击查看明细"""
        personal_df = calc_results.get("personal_scores", pd.DataFrame())
        section_metrics = calc_results.get("section_metrics", pd.DataFrame())
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>合唱声部排练优化分析报告</title>
    <style>
        body {{ font-family: "Microsoft YaHei", Arial, sans-serif; margin: 20px; color: #333; }}
        h1 {{ color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }}
        h2 {{ color: #2c3e50; margin-top: 30px; border-left: 5px solid #3498db; padding-left: 10px; }}
        h3 {{ color: #34495e; }}
        .summary-box {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }}
        .priority-highlight {{ font-weight: bold; }}
        .priority-优先排练 {{ color: #e74c3c; }}
        .priority-加强排练 {{ color: #f39c12; }}
        .priority-正常排练 {{ color: #3498db; }}
        .priority-保持状态 {{ color: #2ecc71; }}
        .severity-high {{ color: #e74c3c; }}
        .severity-medium {{ color: #f39c12; }}
        .severity-low {{ color: #2ecc71; }}
        table {{ border-collapse: collapse; width: 100%; margin: 15px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 10px; text-align: left; }}
        th {{ background: #3498db; color: white; }}
        tr:nth-child(even) {{ background: #f8f9fa; }}
        .chart-container {{ margin: 20px 0; text-align: center; }}
        .chart-container img {{ max-width: 100%; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; }}
        .chart-container img:hover {{ box-shadow: 0 0 10px rgba(52, 152, 219, 0.5); }}
        .anomaly-card {{ border-left: 4px solid; margin: 10px 0; padding: 10px; background: #f8f9fa; }}
        .conflict-card {{ border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 8px; }}
        .supplement-diff {{ background: #fff3cd; padding: 10px; border-radius: 4px; margin: 5px 0; }}
        .drilldown-link {{ color: #3498db; cursor: pointer; text-decoration: underline; }}
        .detail-section {{ display: none; margin-top: 10px; padding: 15px; background: #f0f8ff; border-radius: 8px; }}
        .metadata {{ font-size: 12px; color: #7f8c8d; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; }}
        .warning {{ background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 10px 0; }}
        .success {{ background: #d4edda; border-left: 4px solid #28a745; padding: 10px; margin: 10px 0; }}
        .record-id {{ font-family: monospace; background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }}
    </style>
    <script>
        function toggleDetail(id) {{
            var elem = document.getElementById(id);
            if (elem.style.display === 'none' || elem.style.display === '') {{
                elem.style.display = 'block';
            }} else {{
                elem.style.display = 'none';
            }}
        }}
    </script>
</head>
<body>
    <h1>🎵 合唱声部排练优化分析报告</h1>
    <div class="metadata">
        <p><strong>批次号:</strong> <span class="record-id">{self.batch_id}</span></p>
        <p><strong>生成时间:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        <p><strong>参数版本:</strong> {calc_results.get('param_version', 'default_v1')}</p>
    </div>
"""
        avg_score = personal_df["个人综合分"].mean() if "个人综合分" in personal_df.columns else 0
        pass_rate = (personal_df["个人综合分"] >= 80).mean() * 100 if "个人综合分" in personal_df.columns else 0
        html += f"""
    <h2>📊 总体概览</h2>
    <div class="summary-box">
        <table>
            <tr>
                <th>总参与人数</th>
                <th>整体平均分</th>
                <th>整体达标率</th>
                <th>涉及声部数</th>
                <th>数据源数量</th>
            </tr>
            <tr>
                <td>{len(personal_df)} 人</td>
                <td>{self._format_value(avg_score)} 分</td>
                <td>{self._format_value(pass_rate)} %</td>
                <td>{len(section_metrics)} 个</td>
                <td>{len(sources)} 个</td>
            </tr>
        </table>
"""
        if sources:
            html += "<p><strong>数据源:</strong></p><ul>"
            for s in sources:
                html += f"<li>[{s['source_type']}] {s['source_name']} ({s['record_count']}条记录)</li>"
            html += "</ul>"
        if param_diff:
            html += f'<div class="warning"><strong>⚠️ 本批次使用了 {len(param_diff)} 个人工调优参数（非默认值）:</strong><ul>'
            for key, diff in param_diff.items():
                html += f"<li>{key}: {diff.get('default')} → <strong>{diff.get('current')}</strong></li>"
            html += "</ul></div>"
        html += "</div>"
        html += """
    <h2>📈 分析图表</h2>
    <p><em>点击图表或链接可查看对应明细</em></p>
"""
        for chart in self.chart_generator.charts:
            chart_path = Path(chart["file_path"])
            drilldown = chart["drilldown_config"]
            html += f'''
    <div class="chart-container">
        <h3>{chart["chart_title"]}</h3>
        <img src="{chart_path.absolute().as_uri()}" alt="{chart["chart_title"]}"
             onclick="toggleDetail('detail_{chart["id"]}')">
        <p class="drilldown-link" onclick="toggleDetail('detail_{chart["id"]}')">
            🔍 点击查看{drilldown.get("click_field", "")}明细
        </p>
        <div id="detail_{chart["id"]}" class="detail-section">
            <p><strong>下钻说明:</strong> 点击{drilldown.get("click_field", "")}后可筛选对应人员明细</p>
            <p><strong>图表ID:</strong> <span class="record-id">{chart["id"]}</span></p>
        </div>
    </div>
'''
        html += """
    <h2>🎯 各声部排练安排建议</h2>
"""
        if not section_metrics.empty:
            priority_order = ["优先排练", "加强排练", "正常排练", "保持状态"]
            sorted_sections = section_metrics.sort_values(
                "排练优先级",
                key=lambda x: x.map(lambda p: priority_order.index(p))
            )
            html += "<table>"
            html += "<tr><th>声部</th><th>排练优先级</th><th>人数</th><th>平均分</th><th>达标率</th><th>优秀率</th><th>标准差</th><th>操作</th></tr>"
            for _, row in sorted_sections.iterrows():
                section_name = row["声部"]
                html += f"""
            <tr>
                <td>{section_name}</td>
                <td class="priority-{row['排练优先级']} priority-highlight">{row['排练优先级']}</td>
                <td>{row['声部人数']}</td>
                <td>{self._format_value(row['声部平均分'])}</td>
                <td>{self._format_value(row['声部达标率'])}%</td>
                <td>{self._format_value(row['声部优秀率'])}%</td>
                <td>{self._format_value(row['声部标准差'])}</td>
                <td><span class="drilldown-link" onclick="toggleDetail('section_{section_name}')">查看人员明细</span></td>
            </tr>
"""
            html += "</table>"
            for _, row in sorted_sections.iterrows():
                section_name = row["声部"]
                section_people = personal_df[personal_df["声部"] == section_name]
                if not section_people.empty:
                    html += f'<div id="section_{section_name}" class="detail-section">'
                    html += f"<h4>{section_name} 人员明细</h4>"
                    html += "<table><tr><th>人员</th><th>个人综合分</th><th>音准</th><th>节奏</th><th>合声</th><th>音量</th><th>情感</th><th>出勤</th><th>记录ID</th></tr>"
                    for _, p in section_people.iterrows():
                        rid = p.get("_record_id", "")
                        html += f"""
                    <tr>
                        <td>{p.get('人员', '')}</td>
                        <td><strong>{self._format_value(p.get('个人综合分', 0))}</strong></td>
                        <td>{self._format_value(p.get('音准得分', 0))}</td>
                        <td>{self._format_value(p.get('节奏得分', 0))}</td>
                        <td>{self._format_value(p.get('合声得分', 0))}</td>
                        <td>{self._format_value(p.get('音量平衡', 0))}</td>
                        <td>{self._format_value(p.get('情感表达', 0))}</td>
                        <td>{p.get('出勤状态', '')}</td>
                        <td><span class="record-id" onclick="toggleDetail('calc_{rid}')">{rid[:8]}...</span></td>
                    </tr>
"""
                    html += "</table></div>"
        html += """
    <h2>⚠️ 异常检测结果</h2>
"""
        anomaly_total = anomaly_summary.get("total", 0)
        if anomaly_total == 0:
            html += '<div class="success">✅ 未检测到异常</div>'
        else:
            high = anomaly_summary.get("by_severity", {}).get("high", 0)
            medium = anomaly_summary.get("by_severity", {}).get("medium", 0)
            low = anomaly_summary.get("by_severity", {}).get("low", 0)
            html += f'<p>共检测到 <strong>{anomaly_total}</strong> 个异常: '
            html += f'<span class="severity-high">高{high}个</span>, '
            html += f'<span class="severity-medium">中{medium}个</span>, '
            html += f'<span class="severity-low">低{low}个</span></p>'
            for a in anomaly_summary.get("details", []):
                color = self._severity_color(a["severity"])
                sev_label = {"high": "高", "medium": "中", "low": "低"}.get(a["severity"], "")
                html += f'''
    <div class="anomaly-card" style="border-color: {color};">
        <span class="severity-{a["severity"]}"><strong>[{sev_label}] {a["anomaly_name"]}</strong></span>
        <p>{a["description"]}</p>
        <p><small>异常ID: <span class="record-id">{a["id"]}</span></small></p>
    </div>
'''
        html += """
    <h2>🔀 数据冲突检测</h2>
"""
        conflict_total = conflict_summary.get("total", 0)
        if conflict_total == 0:
            html += '<div class="success">✅ 未检测到数据冲突</div>'
        else:
            unresolved = conflict_summary.get("unresolved", 0)
            html += f'<p>共检测到 <strong>{conflict_total}</strong> 个冲突，其中 <strong>{unresolved}</strong> 个待决策</p>'
            for c in conflict_summary.get("details", []):
                status_icon = "✅" if c.get("is_resolved") else "⚠️"
                status_text = "已解决" if c.get("is_resolved") else "待决策"
                html += f'''
    <div class="conflict-card">
        <h4>{status_icon} 字段[{c["field_name"]}] - {status_text}</h4>
        <table>
            <tr><th>来源</th><th>值</th><th>证据</th></tr>
            <tr><td>{c["source_a"]}</td><td><strong>{c["value_a"]}</strong></td><td>{c["evidence_a"]}</td></tr>
            <tr><td>{c["source_b"]}</td><td><strong>{c["value_b"]}</strong></td><td>{c["evidence_b"]}</td></tr>
        </table>
        <p><strong>建议动作:</strong> {c["suggested_action"]}</p>
'''
                if c.get("is_resolved"):
                    html += f'<div class="success"><strong>解决结果:</strong> {c.get("resolution")}</div>'
                html += f'<p><small>冲突ID: <span class="record-id">{c["id"]}</span></small></p></div>'
        html += """
    <h2>📝 补录记录</h2>
"""
        supplement_total = supplement_summary.get("total", 0)
        if supplement_total == 0:
            html += "<p>本批次无补录记录</p>"
        else:
            html += f'<p>共 <strong>{supplement_total}</strong> 条补录记录:</p>'
            for s in supplement_summary.get("diff_summary", []):
                html += f'''
    <div class="supplement-diff">
        <strong>[{s["type"]}]</strong> {s["field"]}<br>
        原值: <span style="text-decoration: line-through; color: #999;">{s["old"] if s["old"] else "(空)"}</span>
        → 新值: <strong>{s["new"]}</strong><br>
        <small>备注: {s["remark"]} (操作人: {s["operator"]})</small>
    </div>
'''
        supplement_compare = supplement_summary.get("comparison", {})
        if supplement_compare:
            comp_table = supplement_compare.get("comparison_table")
            if comp_table is not None and not comp_table.empty:
                html += "<h4>补录前后指标对比</h4><table>"
                html += "<tr><th>声部</th><th>人数变化</th><th>平均分变化</th><th>达标率变化</th></tr>"
                for _, row in comp_table.iterrows():
                    if row.get("人数变化") or row.get("平均分变化") or row.get("达标率变化"):
                        html += f"<tr><td>{row['声部']}</td>"
                        html += f"<td>{row.get('人数变化', 0):+d}</td>"
                        html += f"<td>{row.get('平均分变化', 0):+.1f}</td>"
                        html += f"<td>{row.get('达标率变化', 0):+.1f}%</td></tr>"
                html += "</table>"
        html += """
    <h2>🔍 计算可复查说明</h2>
    <div class="summary-box">
        <p>所有计算过程均可追溯，如需复核：</p>
        <ol>
            <li>每个人员的<strong>记录ID</strong>（形如 <span class="record-id">xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</span>）可用于查询完整计算步骤</li>
            <li>每个计算步骤包含：输入值、计算公式、输出值</li>
            <li>参数版本号可用于追溯当时使用的权重和阈值配置</li>
            <li>所有异常、冲突、补录均有独立ID，可单独查询详情</li>
        </ol>
    </div>
"""
        html += f"""
    <h2>⚙️ 计算参数配置</h2>
    <div class="summary-box">
        <p><strong>权重配置:</strong> {json.dumps(calc_results.get('weights_used', {}), ensure_ascii=False, indent=2)}</p>
        <p><strong>阈值配置:</strong> {json.dumps(calc_results.get('thresholds_used', {}), ensure_ascii=False, indent=2)}</p>
    </div>
"""
        html += """
</body>
</html>
"""
        report_path = REPORTS_DIR / f"{self.batch_id}_report.html"
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(html)
        return str(report_path)

    def export_detail_data(self, calc_results: Dict[str, Any],
                          anomaly_summary: Dict,
                          conflict_summary: Dict) -> Dict[str, str]:
        """导出明细数据，确保报告和明细一致"""
        personal_df = calc_results.get("personal_scores", pd.DataFrame())
        section_metrics = calc_results.get("section_metrics", pd.DataFrame())
        files = {}
        personal_path = EXPORTS_DIR / f"{self.batch_id}_个人明细.csv"
        personal_df.to_csv(personal_path, index=False, encoding='utf-8-sig')
        files["personal_detail"] = str(personal_path)
        if not section_metrics.empty:
            section_path = EXPORTS_DIR / f"{self.batch_id}_声部汇总.csv"
            section_metrics.to_csv(section_path, index=False, encoding='utf-8-sig')
            files["section_summary"] = str(section_path)
        anomaly_path = EXPORTS_DIR / f"{self.batch_id}_异常明细.json"
        with open(anomaly_path, 'w', encoding='utf-8') as f:
            json.dump(anomaly_summary, f, ensure_ascii=False, indent=2)
        files["anomaly_detail"] = str(anomaly_path)
        conflict_path = EXPORTS_DIR / f"{self.batch_id}_冲突明细.json"
        with open(conflict_path, 'w', encoding='utf-8') as f:
            json.dump(conflict_summary, f, ensure_ascii=False, indent=2)
        files["conflict_detail"] = str(conflict_path)
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"""
            SELECT c.id, c.record_id, c.calc_type, c.result_value, c.param_version,
                   s.step_order, s.step_name, s.formula, s.output_value
            FROM {CALCULATIONS_TABLE} c
            LEFT JOIN {CALC_STEPS_TABLE} s ON c.id = s.calc_id
            WHERE c.batch_id = ?
            ORDER BY c.id, s.step_order
            """,
            (self.batch_id,)
        )
        calc_rows = cursor.fetchall()
        calc_audit_path = EXPORTS_DIR / f"{self.batch_id}_计算审计.csv"
        calc_audit_data = []
        for r in calc_rows:
            calc_audit_data.append({
                "计算ID": r["id"],
                "记录ID": r["record_id"],
                "计算类型": r["calc_type"],
                "结果值": r["result_value"],
                "参数版本": r["param_version"],
                "步骤序号": r["step_order"],
                "步骤名称": r["step_name"],
                "计算公式": r["formula"],
                "步骤输出": r["output_value"]
            })
        if calc_audit_data:
            pd.DataFrame(calc_audit_data).to_csv(calc_audit_path, index=False, encoding='utf-8-sig')
            files["calc_audit"] = str(calc_audit_path)
        self.db.log_audit(
            "export_detail_data",
            {"files": list(files.keys())},
            batch_id=self.batch_id
        )
        return files

    def generate_full_report(self, calc_results: Dict[str, Any],
                            anomaly_summary: Dict,
                            conflict_summary: Dict,
                            supplement_summary: Dict,
                            sources: List[Dict],
                            param_diff: Dict) -> Dict[str, Any]:
        """生成全套报告和导出文件"""
        text_report = self.generate_text_report(
            calc_results, anomaly_summary, conflict_summary,
            supplement_summary, sources, param_diff
        )
        text_path = REPORTS_DIR / f"{self.batch_id}_report.txt"
        with open(text_path, 'w', encoding='utf-8') as f:
            f.write(text_report)
        html_path = self.generate_html_report(
            calc_results, anomaly_summary, conflict_summary,
            supplement_summary, sources, param_diff
        )
        detail_files = self.export_detail_data(
            calc_results, anomaly_summary, conflict_summary
        )
        charts_data_path = self.chart_generator.export_charts_data()
        return {
            "batch_id": self.batch_id,
            "text_report": str(text_path),
            "html_report": html_path,
            "detail_files": detail_files,
            "charts_data": charts_data_path,
            "text_content": text_report
        }
